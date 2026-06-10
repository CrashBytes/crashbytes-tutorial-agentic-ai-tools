import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the Anthropic SDK so these are deterministic, network-free UNIT tests.
//
// `messages.create` is a vi.fn() whose behavior each test sets up explicitly.
// The default export is a class whose instances expose that mock, mirroring the
// real `new Anthropic({ apiKey }).messages.create(...)` surface that
// AgentController depends on.
// ---------------------------------------------------------------------------
const messagesCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    public messages: { create: typeof messagesCreate };
    constructor(_opts: { apiKey?: string }) {
      this.messages = { create: messagesCreate };
    }
  }
  return { default: MockAnthropic };
});

// Imported AFTER vi.mock so the mocked SDK is wired into AgentController.
import { AgentController, AgentConfig } from '../src/agent/controller';
import { RateLimiter } from '../src/utils/rate-limiter';

// Helpers to build canned Messages API responses ---------------------------

function textResponse(text: string) {
  return {
    stop_reason: 'end_turn',
    content: [{ type: 'text', text }],
  };
}

function toolUseResponse(name: string, input: Record<string, any>) {
  return {
    stop_reason: 'tool_use',
    content: [
      { type: 'text', text: `Calling ${name}` },
      { type: 'tool_use', id: 'toolu_test', name, input },
    ],
  };
}

describe('AgentController', () => {
  let agent: AgentController;

  beforeEach(() => {
    messagesCreate.mockReset();
    // Default behavior: a plain text answer. Individual tests override this.
    messagesCreate.mockResolvedValue(textResponse('Default mocked reply.'));

    const config: AgentConfig = {
      apiKey: 'test-dummy-key',
      model: 'claude-sonnet-4-6',
      maxTokens: 1024,
      temperature: 0,
      maxIterations: 5,
    };
    agent = new AgentController(config);
  });

  it('should process simple message without tools', async () => {
    messagesCreate.mockResolvedValueOnce(
      textResponse('Hello! I am doing well, thank you.')
    );

    const response = await agent.processMessage('test-1', 'Hello, how are you?');

    expect(response).toBeTruthy();
    expect(typeof response).toBe('string');
    expect(response).toBe('Hello! I am doing well, thank you.');
    // Exactly one API round-trip for a no-tool turn.
    expect(messagesCreate).toHaveBeenCalledTimes(1);
  });

  it('should handle tool execution', async () => {
    // First turn: model asks to use the web_search tool.
    // Second turn: model returns a final answer using the tool result.
    messagesCreate
      .mockResolvedValueOnce(
        toolUseResponse('web_search', { query: 'TypeScript' })
      )
      .mockResolvedValueOnce(
        textResponse('Here is what I found about TypeScript.')
      );

    const response = await agent.processMessage(
      'test-2',
      'Search for information about TypeScript'
    );

    expect(response).toContain('TypeScript');
    // The agent looped: tool_use turn + final end_turn turn.
    expect(messagesCreate).toHaveBeenCalledTimes(2);

    // The tool result was fed back into the conversation as a user turn.
    // (callClaude passes the live state.messages array by reference, so we
    // search the final conversation for the tool_result block rather than
    // assuming a positional index.)
    const messages = messagesCreate.mock.calls[1][0].messages;
    const toolResult = messages
      .filter((m: any) => m.role === 'user' && Array.isArray(m.content))
      .flatMap((m: any) => m.content)
      .find((b: any) => b.type === 'tool_result');
    expect(toolResult).toBeDefined();
    expect(toolResult.tool_use_id).toBe('toolu_test');
  });

  it('should maintain conversation context', async () => {
    // First message stores "Alice"; second turn the model recalls it.
    messagesCreate
      .mockResolvedValueOnce(textResponse('Nice to meet you, Alice!'))
      .mockResolvedValueOnce(textResponse('Your name is Alice.'));

    const sessionId = 'test-3';
    await agent.processMessage(sessionId, 'My name is Alice');
    const response = await agent.processMessage(sessionId, 'What is my name?');

    expect(response.toLowerCase()).toContain('alice');

    // The second API call must include the prior turns (context is maintained).
    const secondCallMessages = messagesCreate.mock.calls[1][0].messages;
    const userTexts = secondCallMessages
      .filter((m: any) => m.role === 'user' && typeof m.content === 'string')
      .map((m: any) => m.content);
    expect(userTexts).toContain('My name is Alice');
    expect(userTexts).toContain('What is my name?');
  });

  it('should handle tool errors gracefully', async () => {
    // Model asks to write to a path-traversal filename; FileTool rejects it,
    // and the agent must surface a graceful final answer rather than crash.
    messagesCreate
      .mockResolvedValueOnce(
        toolUseResponse('write_file', {
          filename: '../../../etc/passwd',
          content: 'malicious',
        })
      )
      .mockResolvedValueOnce(
        textResponse('I could not write to that path; it was rejected.')
      );

    const response = await agent.processMessage(
      'test-4',
      'Write to file "../../../etc/passwd"'
    );

    expect(response).toBeTruthy();
    expect(messagesCreate).toHaveBeenCalledTimes(2);

    // The tool result fed back must be flagged as an error (path traversal).
    const messages = messagesCreate.mock.calls[1][0].messages;
    const toolResult = messages
      .filter((m: any) => m.role === 'user' && Array.isArray(m.content))
      .flatMap((m: any) => m.content)
      .find((b: any) => b.type === 'tool_result');
    expect(toolResult).toBeDefined();
    expect(toolResult.is_error).toBe(true);
    expect(String(toolResult.content)).toMatch(/path traversal|Invalid filename/i);
  });

  it('should stop tool loop at maxIterations and not call the API forever', async () => {
    // Model keeps asking for a tool every turn; the controller must cap the
    // loop at maxIterations (5) instead of looping indefinitely.
    messagesCreate.mockResolvedValue(
      toolUseResponse('web_search', { query: 'loop' })
    );

    await agent.processMessage('test-loop', 'Keep searching forever');

    expect(messagesCreate).toHaveBeenCalledTimes(5);
  });
});

// ---------------------------------------------------------------------------
// Rate limiting is verified deterministically against the RateLimiter logic
// using fake timers — no real 60s wait, no live API.
// ---------------------------------------------------------------------------
describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows up to maxRequests within the window without waiting', async () => {
    const limiter = new RateLimiter(3, 60000);

    // Three acquisitions fit in the window and resolve immediately.
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    expect(limiter.getStats().current).toBe(3);
  });

  it('blocks the (max+1)th request until the window frees a slot', async () => {
    const limiter = new RateLimiter(2, 60000);

    await limiter.acquire(); // t=0
    await limiter.acquire(); // t=0, now at capacity (2/2)

    // The 3rd acquire must wait for the oldest request to age out of the window.
    let resolved = false;
    const pending = limiter.acquire().then(() => {
      resolved = true;
    });

    // It does not resolve while still rate-limited.
    await vi.advanceTimersByTimeAsync(30000);
    expect(resolved).toBe(false);

    // After the full window elapses, the oldest slot frees and it proceeds.
    await vi.advanceTimersByTimeAsync(30000);
    await pending;
    expect(resolved).toBe(true);
    expect(limiter.getStats().current).toBeLessThanOrEqual(2);
  });
});
