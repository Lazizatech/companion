import { z } from 'zod';

/**
 * Zod Validation Schemas
 * Handles API input validation (request/response schemas)
 * Works with Drizzle for complete type safety
 */

// Agent Creation Schema
export const CreateAgentSchema = z.object({
  name: z.string().min(1, 'Agent name is required').max(100, 'Agent name too long'),
  type: z.enum(['basic', 'llm', 'vision', 'unified', 'advanced']).default('advanced'),
  config: z.object({
    headless: z.boolean().default(false),
    useVision: z.boolean().default(true),
    maxAttempts: z.number().min(1).max(20).default(5),
    timeout: z.number().min(1000).max(60000).default(30000),
    userAgent: z.string().optional()
  }).optional()
});

// Task Creation Schema
export const CreateTaskSchema = z.object({
  task: z.string().min(1, 'Task description is required').max(1000, 'Task description too long'),
  options: z.object({
    useVision: z.boolean().default(true),
    maxAttempts: z.number().min(1).max(20).default(5),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal')
  }).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal')
});

// Memory Storage Schema
export const StoreMemorySchema = z.object({
  type: z.enum(['behavior_patterns', 'learning_data', 'context', 'preferences']),
  data: z.record(z.any()).refine(data => Object.keys(data).length > 0, 'Memory data cannot be empty')
});

// Agent Filters Schema
export const AgentFiltersSchema = z.object({
  status: z.enum(['all', 'active', 'idle', 'busy', 'stopped']).default('all'),
  type: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0)
});

// Memory Filters Schema
export const MemoryFiltersSchema = z.object({
  type: z.enum(['behavior_patterns', 'learning_data', 'context', 'preferences']).optional()
});

// Response Schemas
export const AgentResponseSchema = z.object({
  success: z.boolean(),
  agentId: z.string().optional(),
  agent: z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    status: z.string(),
    created_at: z.string(),
    last_active: z.string().optional(),
    config: z.record(z.any()).optional(),
    task_count: z.number().optional(),
    success_rate: z.number().optional()
  }).optional(),
  message: z.string().optional(),
  error: z.string().optional()
});

export const TaskResponseSchema = z.object({
  success: z.boolean(),
  taskId: z.string().optional(),
  result: z.record(z.any()).optional(),
  message: z.string().optional(),
  error: z.string().optional()
});

export const MemoryResponseSchema = z.object({
  success: z.boolean(),
  memory: z.array(z.object({
    id: z.number(),
    agent_id: z.string(),
    memory_type: z.string(),
    data: z.record(z.any()),
    created_at: z.string(),
    updated_at: z.string()
  })).optional(),
  message: z.string().optional(),
  error: z.string().optional()
});

// Type exports for TypeScript
export type CreateAgentInput = z.infer<typeof CreateAgentSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type StoreMemoryInput = z.infer<typeof StoreMemorySchema>;
export type AgentFiltersInput = z.infer<typeof AgentFiltersSchema>;
export type MemoryFiltersInput = z.infer<typeof MemoryFiltersSchema>;
export type AgentResponse = z.infer<typeof AgentResponseSchema>;
export type TaskResponse = z.infer<typeof TaskResponseSchema>;
export type MemoryResponse = z.infer<typeof MemoryResponseSchema>;
