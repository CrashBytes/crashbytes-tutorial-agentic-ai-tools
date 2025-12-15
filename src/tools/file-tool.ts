import { promises as fs } from 'fs';
import { join } from 'path';
import { Tool, ToolExecutor, ToolResult } from './types';

export class FileTool implements ToolExecutor {
  private readonly allowedDir: string;

  constructor(allowedDir: string = './data') {
    this.allowedDir = allowedDir;
  }

  getDefinition(): Tool {
    return {
      name: 'write_file',
      description: 'Write content to a file in the allowed directory. Creates parent directories if needed.',
      input_schema: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description: 'Name of the file to write',
          },
          content: {
            type: 'string',
            description: 'Content to write to the file',
          },
        },
        required: ['filename', 'content'],
      },
    };
  }

  async execute(input: Record<string, any>): Promise<ToolResult> {
    const start = Date.now();
    
    try {
      const { filename, content } = input;

      // Security: Validate filename
      if (!this.isValidFilename(filename)) {
        return {
          success: false,
          error: 'Invalid filename or path traversal detected',
          execution_time_ms: Date.now() - start,
        };
      }

      const filepath = join(this.allowedDir, filename);
      
      // Ensure directory exists
      await fs.mkdir(this.allowedDir, { recursive: true });
      
      // Write file
      await fs.writeFile(filepath, content, 'utf-8');

      return {
        success: true,
        data: { filepath, bytes_written: Buffer.byteLength(content) },
        execution_time_ms: Date.now() - start,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        execution_time_ms: Date.now() - start,
      };
    }
  }

  private isValidFilename(filename: string): boolean {
    // Prevent path traversal attacks
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return false;
    }
    
    // Only allow safe characters
    const safePattern = /^[a-zA-Z0-9_\-\.]+$/;
    return safePattern.test(filename);
  }
}
