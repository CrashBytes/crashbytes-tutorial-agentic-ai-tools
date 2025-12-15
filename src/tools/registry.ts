import { Tool, ToolExecutor } from './types';
import { SearchTool } from './search-tool';
import { FileTool } from './file-tool';

export class ToolRegistry {
  private tools = new Map<string, ToolExecutor>();

  constructor() {
    // Register default tools
    this.register(new SearchTool());
    this.register(new FileTool());
  }

  register(executor: ToolExecutor): void {
    const definition = executor.getDefinition();
    this.tools.set(definition.name, executor);
  }

  getExecutor(toolName: string): ToolExecutor | undefined {
    return this.tools.get(toolName);
  }

  getAllDefinitions(): Tool[] {
    return Array.from(this.tools.values()).map(executor => 
      executor.getDefinition()
    );
  }

  has(toolName: string): boolean {
    return this.tools.has(toolName);
  }
}
