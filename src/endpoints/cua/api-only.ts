// Pure API endpoints without browser automation
// These will delegate browser tasks to the separate CUA Browser service

import { CreateEndpoint } from "chanfana";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { agents, tasks, memory } from "../../db/schema";
import { eq } from "drizzle-orm";

// Schema definitions
const CreateAgentSchema = z.object({
  name: z.string(),
  type: z.enum(["browser", "ai", "coordinator"]).default("browser"),
  capabilities: z.array(z.string()).optional(),
  configuration: z.record(z.any()).optional(),
});

const CreateTaskSchema = z.object({
  task: z.string(),
  options: z.record(z.any()).optional(),
  priority: z.number().min(1).max(5).default(3),
});

const StoreMemorySchema = z.object({
  type: z.enum(["short_term", "long_term", "episodic"]),
  data: z.record(z.any()),
});

// Create Agent Endpoint
export const CreateAgent = CreateEndpoint({
  method: "POST",
  path: "/cua/agents",
  summary: "Create a new CUA agent",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateAgentSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Agent created successfully",
      content: {
        "application/json": {
          schema: z.object({
            id: z.string(),
            name: z.string(),
            type: z.string(),
            status: z.enum(["active", "idle", "stopped"]),
            created_at: z.string(),
          }),
        },
      },
    },
  },
  handler: async (c) => {
    const db = drizzle(c.env.DB);
    const body = await c.req.json();
    
    const agentData = {
      id: crypto.randomUUID(),
      name: body.name,
      type: body.type || "browser",
      status: "active" as const,
      configuration: JSON.stringify(body.configuration || {}),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.insert(agents).values(agentData);

    return c.json({
      id: agentData.id,
      name: agentData.name,
      type: agentData.type,
      status: agentData.status,
      created_at: agentData.created_at,
    }, 201);
  },
});

// List Agents Endpoint
export const ListAgents = CreateEndpoint({
  method: "GET",
  path: "/cua/agents",
  summary: "List all agents",
  responses: {
    200: {
      description: "List of agents",
      content: {
        "application/json": {
          schema: z.object({
            agents: z.array(z.object({
              id: z.string(),
              name: z.string(),
              type: z.string(),
              status: z.string(),
              created_at: z.string(),
            })),
            total: z.number(),
          }),
        },
      },
    },
  },
  handler: async (c) => {
    const db = drizzle(c.env.DB);
    const agentList = await db.select().from(agents);

    return c.json({
      agents: agentList.map(agent => ({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        status: agent.status,
        created_at: agent.created_at,
      })),
      total: agentList.length,
    });
  },
});

// Get Agent Endpoint
export const GetAgent = CreateEndpoint({
  method: "GET",
  path: "/cua/agents/:id",
  summary: "Get agent details",
  responses: {
    200: {
      description: "Agent details",
    },
  },
  handler: async (c) => {
    const db = drizzle(c.env.DB);
    const agentId = c.req.param("id");

    const agent = await db.select().from(agents).where(eq(agents.id, agentId)).get();

    if (!agent) {
      return c.json({ error: "Agent not found" }, 404);
    }

    return c.json({
      id: agent.id,
      name: agent.name,
      type: agent.type,
      status: agent.status,
      configuration: JSON.parse(agent.configuration || "{}"),
      created_at: agent.created_at,
      updated_at: agent.updated_at,
    });
  },
});

// Create Task Endpoint (delegates to browser service)
export const CreateTask = CreateEndpoint({
  method: "POST",
  path: "/cua/agents/:id/tasks",
  summary: "Create task for agent",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateTaskSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Task created",
    },
  },
  handler: async (c) => {
    const db = drizzle(c.env.DB);
    const agentId = c.req.param("id");
    const body = await c.req.json();

    // Check if agent exists
    const agent = await db.select().from(agents).where(eq(agents.id, agentId)).get();
    if (!agent) {
      return c.json({ error: "Agent not found" }, 404);
    }

    // Create task record
    const taskData = {
      id: crypto.randomUUID(),
      agent_id: agentId,
      task: body.task,
      options: JSON.stringify(body.options || {}),
      priority: body.priority || 3,
      status: "pending" as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.insert(tasks).values(taskData);

    return c.json({
      id: taskData.id,
      agent_id: agentId,
      task: taskData.task,
      status: taskData.status,
      created_at: taskData.created_at,
      note: "Task created. Use ExecuteTask endpoint to run it via browser service.",
    }, 201);
  },
});

// Execute Task Endpoint (delegates to browser service)
export const ExecuteTask = CreateEndpoint({
  method: "POST",
  path: "/cua/agents/:id/tasks/:taskId/execute",
  summary: "Execute task via browser service",
  responses: {
    200: {
      description: "Task execution started",
    },
  },
  handler: async (c) => {
    const db = drizzle(c.env.DB);
    const agentId = c.req.param("id");
    const taskId = c.req.param("taskId");

    // Get task details
    const task = await db.select().from(tasks)
      .where(eq(tasks.id, taskId))
      .get();

    if (!task || task.agent_id !== agentId) {
      return c.json({ error: "Task not found" }, 404);
    }

    // Update task status
    await db.update(tasks)
      .set({ 
        status: "in_progress",
        updated_at: new Date().toISOString()
      })
      .where(eq(tasks.id, taskId));

    // In a real implementation, this would call the browser service
    // For now, return a placeholder response
    return c.json({
      task_id: taskId,
      status: "in_progress",
      message: "Task execution delegated to browser service",
      browser_service_url: process.env.CUA_BROWSER_URL || "http://cua-browser:3000",
    });
  },
});

// Stop Agent Endpoint
export const StopAgent = CreateEndpoint({
  method: "DELETE",
  path: "/cua/agents/:id",
  summary: "Stop and remove agent",
  responses: {
    204: {
      description: "Agent stopped",
    },
  },
  handler: async (c) => {
    const db = drizzle(c.env.DB);
    const agentId = c.req.param("id");

    // Update agent status
    await db.update(agents)
      .set({ 
        status: "stopped",
        updated_at: new Date().toISOString()
      })
      .where(eq(agents.id, agentId));

    return c.body(null, 204);
  },
});

// Get Memory Endpoint
export const GetMemory = CreateEndpoint({
  method: "GET",
  path: "/cua/memory/:agentId",
  summary: "Get agent memory",
  responses: {
    200: {
      description: "Agent memory",
    },
  },
  handler: async (c) => {
    const db = drizzle(c.env.DB);
    const agentId = c.req.param("agentId");

    const memoryRecords = await db.select().from(memory)
      .where(eq(memory.agent_id, agentId));

    return c.json({
      agent_id: agentId,
      memory: memoryRecords.map(record => ({
        type: record.type,
        data: JSON.parse(record.data || "{}"),
        created_at: record.created_at,
      })),
    });
  },
});

// Store Memory Endpoint
export const StoreMemory = CreateEndpoint({
  method: "POST",
  path: "/cua/memory/:agentId",
  summary: "Store agent memory",
  request: {
    body: {
      content: {
        "application/json": {
          schema: StoreMemorySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Memory stored",
    },
  },
  handler: async (c) => {
    const db = drizzle(c.env.DB);
    const agentId = c.req.param("agentId");
    const body = await c.req.json();

    const memoryData = {
      id: crypto.randomUUID(),
      agent_id: agentId,
      type: body.type,
      data: JSON.stringify(body.data),
      created_at: new Date().toISOString(),
    };

    await db.insert(memory).values(memoryData);

    return c.json({
      id: memoryData.id,
      agent_id: agentId,
      type: memoryData.type,
      created_at: memoryData.created_at,
    }, 201);
  },
});