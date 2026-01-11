# Building Production Agentic AI Systems: Tool Calling Tutorial

[![Tests](https://github.com/CrashBytes/crashbytes-tutorial-agentic-ai-tools/workflows/Tests/badge.svg)](https://github.com/CrashBytes/crashbytes-tutorial-agentic-ai-tools/actions)
[![codecov](https://codecov.io/gh/CrashBytes/crashbytes-tutorial-agentic-ai-tools/branch/main/graph/badge.svg)](https://codecov.io/gh/CrashBytes/crashbytes-tutorial-agentic-ai-tools)

Production-ready agentic AI system with tool calling, error handling, rate limiting, state management, and comprehensive observability.

## Features

- **Tool System**: Extensible framework for web search, file operations, and custom tools
- **Rate Limiting**: Prevent API quota exhaustion with configurable limits
- **Error Handling**: Retry logic with exponential backoff for transient failures
- **State Management**: Conversation history and session management
- **Observability**: Structured logging and metrics tracking
- **Security**: Input validation, path traversal prevention, RBAC-ready
- **Production Ready**: Docker support, testing suite, scaling patterns

## Quick Start

### Prerequisites

- Node.js 18+
- Anthropic API key ([get one here](https://console.anthropic.com))

### Installation

```bash
# Clone the repository
git clone https://github.com/CrashBytes/crashbytes-tutorial-agentic-ai-tools.git
cd crashbytes-tutorial-agentic-ai-tools

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

### Run the Demo

```bash
npm run dev
```

### Run Tests

```bash
npm test
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Agent Controller                   │
│  - Conversation management                          │
│  - Tool execution orchestration                     │
│  - Error handling and retry logic                   │
└─────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Claude API │  │  Tool System │  │ State Manager│
│              │  │              │  │              │
│ - Messages   │  │ - Search     │  │ - History    │
│ - Tool use   │  │ - Files      │  │ - Context    │
│ - Responses  │  │ - Database   │  │ - Sessions   │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Project Structure

```
src/
├── agent/
│   └── controller.ts       # Main agent orchestration
├── tools/
│   ├── types.ts           # Tool interfaces
│   ├── search-tool.ts     # Web search implementation
│   ├── file-tool.ts       # File operations
│   └── registry.ts        # Tool management
├── utils/
│   ├── rate-limiter.ts    # API rate limiting
│   ├── retry.ts           # Retry logic with backoff
│   └── logger.ts          # Structured logging
├── state/
│   └── conversation-state.ts  # Session management
└── index.ts               # Application entry point

tests/
└── agent.test.ts          # Integration tests
```

## Configuration

Edit `.env` file:

```bash
ANTHROPIC_API_KEY=your_api_key_here  # Required
LOG_LEVEL=info                        # debug, info, warn, error
MAX_RETRIES=3                         # API retry attempts
RATE_LIMIT_PER_MINUTE=50             # API calls per minute
```

## Usage Examples

### Basic Conversation

```typescript
import { AgentController } from './agent/controller';

const agent = new AgentController({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 1.0,
  maxIterations: 10,
});

const response = await agent.processMessage(
  'session-123',
  'What is the current status of AI development?'
);

console.log(response);
```

### Tool Execution

```typescript
// Agent automatically calls tools when needed
const response = await agent.processMessage(
  'session-123',
  'Search for recent news about agentic AI systems'
);
// Agent will use web_search tool automatically
```

### Custom Tools

```typescript
import { Tool, ToolExecutor, ToolResult } from './tools/types';

class CustomTool implements ToolExecutor {
  getDefinition(): Tool {
    return {
      name: 'custom_tool',
      description: 'Description of what this tool does',
      input_schema: {
        type: 'object',
        properties: {
          param: { type: 'string', description: 'Parameter description' }
        },
        required: ['param']
      }
    };
  }

  async execute(input: Record<string, any>): Promise<ToolResult> {
    // Tool implementation
    return {
      success: true,
      data: { result: 'Tool output' },
      execution_time_ms: 100
    };
  }
}

// Register custom tool
agent.toolRegistry.register(new CustomTool());
```

## Production Deployment

### Docker

```bash
docker build -t agentic-ai-system .
docker run -e ANTHROPIC_API_KEY=your_key agentic-ai-system
```

### Environment Variables

- `ANTHROPIC_API_KEY`: Anthropic API key (required)
- `LOG_LEVEL`: Logging level (default: info)
- `MAX_RETRIES`: Retry attempts (default: 3)
- `RATE_LIMIT_PER_MINUTE`: Rate limit (default: 50)

### Scaling

- Use Redis for shared session state across instances
- Deploy behind load balancer (NGINX, AWS ALB)
- Implement message queues for async tool execution
- Monitor metrics and set up alerts

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Run specific test
npm test -- agent.test.ts
```

## Security

- Input validation on all tool parameters
- Path traversal prevention for file operations
- Rate limiting to prevent abuse
- API key rotation support
- RBAC-ready permission system

## Monitoring

- Structured JSON logging
- Metrics tracking (API calls, tool executions, latency)
- Distributed tracing support
- Error tracking and alerting

## Performance

- Parallel tool execution
- Response caching
- Request batching
- Token counting and cost tracking

## Tutorial Blog Post

Read the complete tutorial: [Building Production Agentic AI Systems](https://crashbytes.com/articles/building-production-agentic-ai-tool-calling-tutorial)

## License

MIT

## Author

Michael Eakins - [CrashBytes](https://crashbytes.com)

## Contributing

Contributions welcome! Please open an issue or PR.
