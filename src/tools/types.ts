import { z } from 'zod';

// Tool definition schema
export const ToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  input_schema: z.object({
    type: z.literal('object'),
    properties: z.record(z.any()),
    required: z.array(z.string()).optional(),
  }),
});

export type Tool = z.infer<typeof ToolSchema>;

// Tool execution result
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  execution_time_ms: number;
}

// Tool executor interface
export interface ToolExecutor {
  getDefinition(): Tool;
  execute(input: Record<string, any>): Promise<ToolResult>;
}
