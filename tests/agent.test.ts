import { AgentController, AgentConfig } from '../src/agent/controller';
import { describe, it, expect, beforeEach } from 'vitest';

describe('AgentController', () => {
  let agent: AgentController;
  
  beforeEach(() => {
    const config: AgentConfig = {
      apiKey: process.env.ANTHROPIC_API_KEY!,
      model: 'claude-sonnet-4-20250514',
      maxTokens: 1024,
      temperature: 0,
      maxIterations: 5,
    };
    agent = new AgentController(config);
  });

  it('should process simple message without tools', async () => {
    const response = await agent.processMessage('test-1', 'Hello, how are you?');
    expect(response).toBeTruthy();
    expect(typeof response).toBe('string');
  });

  it('should handle tool execution', async () => {
    const response = await agent.processMessage(
      'test-2',
      'Search for information about TypeScript'
    );
    expect(response).toContain('TypeScript'); // Should mention the search topic
  });

  it('should maintain conversation context', async () => {
    const sessionId = 'test-3';
    await agent.processMessage(sessionId, 'My name is Alice');
    const response = await agent.processMessage(sessionId, 'What is my name?');
    expect(response.toLowerCase()).toContain('alice');
  });

  it('should handle tool errors gracefully', async () => {
    // This will trigger a file write with invalid filename
    const response = await agent.processMessage(
      'test-4',
      'Write to file "../../../etc/passwd"'
    );
    expect(response).toBeTruthy(); // Should not crash
  });

  it('should respect rate limits', async () => {
    const promises = Array.from({ length: 60 }, (_, i) =>
      agent.processMessage(`test-rate-${i}`, 'Quick test')
    );
    
    const start = Date.now();
    await Promise.all(promises);
    const duration = Date.now() - start;
    
    // Should take at least 1 minute due to 50/min rate limit
    expect(duration).toBeGreaterThan(60000);
  }, 120000); // 2 minute timeout for this test
});
