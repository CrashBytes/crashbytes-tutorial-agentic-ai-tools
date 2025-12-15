import 'dotenv/config';
import { AgentController, AgentConfig } from './agent/controller';
import { logger } from './utils/logger';
import { randomUUID } from 'crypto';

async function main() {
  const config: AgentConfig = {
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
    temperature: 1.0,
    maxIterations: 10,
  };

  const agent = new AgentController(config);
  
  // Example conversation
  const sessionId = randomUUID();
  
  logger.info('Starting agent demo', { session_id: sessionId });

  // Message 1: Simple query
  console.log('\n=== Query 1: Simple question ===');
  const response1 = await agent.processMessage(
    sessionId,
    'What is the current status of AI development in 2025?'
  );
  console.log('Assistant:', response1);

  // Message 2: Tool use - web search
  console.log('\n=== Query 2: Web search ===');
  const response2 = await agent.processMessage(
    sessionId,
    'Search for recent news about agentic AI systems'
  );
  console.log('Assistant:', response2);

  // Message 3: Tool use - file writing
  console.log('\n=== Query 3: File writing ===');
  const response3 = await agent.processMessage(
    sessionId,
    'Write a summary of our conversation to a file called summary.txt'
  );
  console.log('Assistant:', response3);

  // Show metrics
  console.log('\n=== Metrics ===');
  console.log(JSON.stringify(agent.getMetrics(), null, 2));
}

main().catch(error => {
  logger.error('Fatal error', { error });
  process.exit(1);
});
