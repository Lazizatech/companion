import { Hono } from 'hono';
import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';
import { UnifiedCUAEngine, CUAConfig } from '../../cua/unified-engine';
import { createDB } from '../../db';
import { agents, tasks } from '../../db/schema';
import { eq } from 'drizzle-orm';

const app = new Hono();

// Schemas
const CreateAgentSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['basic', 'llm', 'vision', 'unified', 'advanced']).default('advanced'),
  config: z.object({
    headless: z.boolean().default(false),
    useVision: z.boolean().default(true),
    timeout: z.number().min(1000).max(60000).default(30000),
    model: z.string().optional(),
    visionModel: z.string().optional()
  }).optional()
});

const TaskSchema = z.object({
  task: z.string().min(1).max(1000),
  options: z.record(z.any()).optional()
});

const AgentResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  status: z.string(),
  created_at: z.string(),
  last_active: z.string().optional()
});

const TaskResponseSchema = z.object({
  id: z.string(),
  agent_id: z.string(),
  task: z.string(),
  status: z.string(),
  result: z.any().optional(),
  error: z.string().optional(),
  created_at: z.string(),
  completed_at: z.string().optional()
});

// Routes
const createAgentRoute = createRoute({
  method: 'post',
  path: '/agents',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateAgentSchema
        }
      }
    }
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: AgentResponseSchema
        }
      },
      description: 'Agent created successfully'
    }
  }
});

const listAgentsRoute = createRoute({
  method: 'get',
  path: '/agents',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(AgentResponseSchema)
        }
      },
      description: 'List of agents'
    }
  }
});

const getAgentRoute = createRoute({
  method: 'get',
  path: '/agents/{id}',
  request: {
    params: z.object({
      id: z.string()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: AgentResponseSchema
        }
      },
      description: 'Agent details'
    }
  }
});

const executeTaskRoute = createRoute({
  method: 'post',
  path: '/agents/{id}/tasks',
  request: {
    params: z.object({
      id: z.string()
    }),
    body: {
      content: {
        'application/json': {
          schema: TaskSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TaskResponseSchema
        }
      },
      description: 'Task executed successfully'
    }
  }
});

const getAgentTasksRoute = createRoute({
  method: 'get',
  path: '/agents/{id}/tasks',
  request: {
    params: z.object({
      id: z.string()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(TaskResponseSchema)
        }
      },
      description: 'Agent tasks'
    }
  }
});

// Route handlers
app.openapi(createAgentRoute, async (c) => {
  const db = createDB(c.env.DB);
  const body = await c.req.json();
  
  const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const agent = await db.insert(agents).values({
    id: agentId,
    name: body.name,
    type: body.type || 'advanced',
    config: body.config ? JSON.stringify(body.config) : null,
    status: 'created',
    created_at: new Date().toISOString()
  }).returning();

  return c.json(agent[0], 201);
});

app.openapi(listAgentsRoute, async (c) => {
  const db = createDB(c.env.DB);
  
  const agentList = await db.select()
    .from(agents)
    .orderBy(agents.created_at);

  return c.json(agentList);
});

app.openapi(getAgentRoute, async (c) => {
  const db = createDB(c.env.DB);
  const { id } = c.req.valid('param');
  
  const agent = await db.select()
    .from(agents)
    .where(eq(agents.id, id))
    .limit(1);

  if (agent.length === 0) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  return c.json(agent[0]);
});

app.openapi(executeTaskRoute, async (c) => {
  const db = createDB(c.env.DB);
  const { id } = c.req.valid('param');
  const body = await c.req.valid('json');
  
  // Get agent
  const agent = await db.select()
    .from(agents)
    .where(eq(agents.id, id))
    .limit(1);

  if (agent.length === 0) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  // Create task record
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await db.insert(tasks).values({
    id: taskId,
    agent_id: id,
    task: body.task,
    options: body.options ? JSON.stringify(body.options) : null,
    status: 'queued',
    created_at: new Date().toISOString()
  });

  // Execute task with CUA engine
  try {
    const config: CUAConfig = agent[0].config ? JSON.parse(agent[0].config) : {};
    const engine = new UnifiedCUAEngine(db, id, config);
    
    await engine.init();
    const result = await engine.executeTask(body.task);
    await engine.close();

    // Update task with result
    await db.update(tasks)
      .set({
        status: result.success ? 'completed' : 'failed',
        result: result.success ? JSON.stringify(result) : null,
        error: result.success ? null : result.error,
        completed_at: new Date().toISOString()
      })
      .where(eq(tasks.id, taskId));

    const updatedTask = await db.select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    return c.json(updatedTask[0]);

  } catch (error) {
    // Update task with error
    await db.update(tasks)
      .set({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString()
      })
      .where(eq(tasks.id, taskId));

    return c.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

app.openapi(getAgentTasksRoute, async (c) => {
  const db = createDB(c.env.DB);
  const { id } = c.req.valid('param');
  
  const taskList = await db.select()
    .from(tasks)
    .where(eq(tasks.agent_id, id))
    .orderBy(tasks.created_at);

  return c.json(taskList);
});

export default app;
