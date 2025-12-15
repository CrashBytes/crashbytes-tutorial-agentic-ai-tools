import Anthropic from '@anthropic-ai/sdk';
import { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { ToolRegistry } from '../tools/registry';
import { StateManager } from '../state/conversation-state';
import { RateLimiter } from '../utils/rate-limiter';
import { withRetry, isRetryableError } from '../utils/retry';
import { logger, Metrics } from '../utils/logger';

export interface AgentConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  maxIterations: number;
}

export class AgentController {
  private client: Anthropic;
  private config: AgentConfig;
  public toolRegistry: ToolRegistry;
  private stateManager: StateManager;
  private rateLimiter: RateLimiter;

  constructor(config: AgentConfig) {
    this.config = config;
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.toolRegistry = new ToolRegistry();
    this.stateManager = new StateManager();
    this.rateLimiter = new RateLimiter(
      parseInt(process.env.RATE_LIMIT_PER_MINUTE || '50')
    );
  }

  async processMessage(
    sessionId: string,
    userMessage: string
  ): Promise<string> {
    logger.info('Processing message', { sessionId, message_length: userMessage.length });
    Metrics.increment('messages_processed');

    // Get or create session
    let state = this.stateManager.get(sessionId);
    if (!state) {
      state = this.stateManager.create(sessionId);
    }

    // Add user message
    this.stateManager.addMessage(sessionId, {
      role: 'user',
      content: userMessage,
    });

    // Process with tool calling loop
    let iterations = 0;
    let finalResponse = '';

    while (iterations < this.config.maxIterations) {
      iterations++;
      logger.debug('Agent iteration', { sessionId, iteration: iterations });

      const response = await this.callClaude(state.messages);

      // Check stop reason
      if (response.stop_reason === 'end_turn') {
        // Extract text response
        const textContent = response.content.find(block => block.type === 'text');
        if (textContent && textContent.type === 'text') {
          finalResponse = textContent.text;
        }
        
        // Add assistant message to history
        this.stateManager.addMessage(sessionId, {
          role: 'assistant',
          content: response.content,
        });
        
        break;
      }

      if (response.stop_reason === 'tool_use') {
        // Execute tools
        const toolResults = await this.executeTools(response.content);
        
        // Add assistant message with tool use
        this.stateManager.addMessage(sessionId, {
          role: 'assistant',
          content: response.content,
        });

        // Add tool results
        this.stateManager.addMessage(sessionId, {
          role: 'user',
          content: toolResults,
        });

        // Continue loop to process tool results
        continue;
      }

      // Unexpected stop reason
      logger.warn('Unexpected stop reason', { 
        sessionId, 
        stop_reason: response.stop_reason 
      });
      break;
    }

    if (iterations >= this.config.maxIterations) {
      logger.warn('Max iterations reached', { sessionId });
      Metrics.increment('max_iterations_reached');
    }

    logger.info('Message processed', { sessionId, iterations, response_length: finalResponse.length });
    return finalResponse;
  }

  private async callClaude(messages: MessageParam[]): Promise<any> {
    await this.rateLimiter.acquire();
    Metrics.increment('api_calls');

    const start = Date.now();
    
    try {
      const response = await withRetry(
        () => this.client.messages.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          messages,
          tools: this.toolRegistry.getAllDefinitions(),
        }),
        {
          maxAttempts: parseInt(process.env.MAX_RETRIES || '3'),
          baseDelayMs: 1000,
          maxDelayMs: 10000,
          shouldRetry: isRetryableError,
        }
      );

      const duration = Date.now() - start;
      Metrics.gauge('api_latency_ms', duration);
      logger.debug('Claude API call succeeded', { duration_ms: duration });

      return response;
    } catch (error) {
      Metrics.increment('api_errors');
      logger.error('Claude API call failed', { error });
      throw error;
    }
  }

  private async executeTools(content: any[]): Promise<any[]> {
    const results: any[] = [];

    for (const block of content) {
      if (block.type === 'tool_use') {
        const { id, name, input } = block;
        
        logger.info('Executing tool', { tool_name: name, tool_use_id: id });
        Metrics.increment(`tool_executions.${name}`);

        const executor = this.toolRegistry.getExecutor(name);
        
        if (!executor) {
          logger.error('Tool not found', { tool_name: name });
          results.push({
            type: 'tool_result',
            tool_use_id: id,
            content: `Error: Tool ${name} not found`,
            is_error: true,
          });
          continue;
        }

        const result = await executor.execute(input);
        
        if (result.success) {
          logger.info('Tool executed successfully', { 
            tool_name: name, 
            execution_time_ms: result.execution_time_ms 
          });
          Metrics.gauge(`tool_latency.${name}`, result.execution_time_ms);
          
          results.push({
            type: 'tool_result',
            tool_use_id: id,
            content: JSON.stringify(result.data),
          });
        } else {
          logger.error('Tool execution failed', { 
            tool_name: name, 
            error: result.error 
          });
          Metrics.increment(`tool_errors.${name}`);
          
          results.push({
            type: 'tool_result',
            tool_use_id: id,
            content: `Error: ${result.error}`,
            is_error: true,
          });
        }
      }
    }

    return results;
  }

  getMetrics(): any {
    return {
      ...Metrics.getAll(),
      rate_limiter: this.rateLimiter.getStats(),
      active_sessions: this.stateManager.getAllSessions().length,
    };
  }
}
