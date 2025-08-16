import { createEndpoint } from "chanfana";
import { AgentService } from "./agentService";
import { createDB } from "../../db";
import { 
  CreateAgentSchema, 
  CreateTaskSchema, 
  StoreMemorySchema,
  AgentFiltersSchema,
  MemoryFiltersSchema,
  AgentResponseSchema,
  TaskResponseSchema,
  MemoryResponseSchema
} from "../../schemas/validation";

// Create service instance
const agentService = new AgentService(createDB(process.env.DB as any));

// Create Agent
export const CreateAgent = createEndpoint({
  method: "POST",
  path: "/agents",
  request: {
    body: CreateAgentSchema
  },
  responses: {
    200: AgentResponseSchema,
    400: {
      success: { type: "boolean" },
      error: { type: "string" }
    }
  },
  handler: async ({ body }) => {
    try {
      // Zod validation happens automatically via schema
      const result = await agentService.createAgent(body);
      return {
        success: true,
        agentId: result.id,
        message: `Agent '${body.name}' created successfully`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
});

// List Agents
export const ListAgents = createEndpoint({
  method: "GET",
  path: "/agents",
  request: {
    query: AgentFiltersSchema
  },
  responses: {
    200: {
      success: { type: "boolean" },
      agents: { type: "array", items: {
        id: { type: "string" },
        name: { type: "string" },
        type: { type: "string" },
        status: { type: "string" },
        task_count: { type: "number" },
        success_rate: { type: "number" }
      }},
      total: { type: "number" }
    }
  },
  handler: async ({ query }) => {
    try {
      // Zod validation happens automatically via schema
      const agents = await agentService.getAgents(query);
      return {
        success: true,
        agents,
        total: agents.length
      };
    } catch (error) {
      return {
        success: false,
        agents: [],
        total: 0
      };
    }
  }
});

// Get Agent
export const GetAgent = createEndpoint({
  method: "GET",
  path: "/agents/:id",
  request: {
    params: {
      id: { type: "string", required: true }
    }
  },
  responses: {
    200: {
      success: { type: "boolean" },
      agent: { type: "object" }
    },
    404: {
      success: { type: "boolean" },
      error: { type: "string" }
    }
  },
  handler: async ({ params }) => {
    try {
      const agent = await agentService.getAgent(params.id);
      return {
        success: true,
        agent
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
});

// Create Task
export const CreateTask = createEndpoint({
  method: "POST",
  path: "/agents/:id/tasks",
  request: {
    params: {
      id: { type: "string", required: true }
    },
    body: CreateTaskSchema
  },
  responses: {
    200: TaskResponseSchema,
    400: {
      success: { type: "boolean" },
      error: { type: "string" }
    }
  },
  handler: async ({ params, body }) => {
    try {
      // Zod validation happens automatically via schema
      const result = await agentService.createTask(params.id, body);
      return {
        success: true,
        taskId: result.id,
        message: `Task queued for agent ${params.id}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
});

// Execute Task
export const ExecuteTask = createEndpoint({
  method: "POST",
  path: "/agents/:id/tasks/:taskId/execute",
  request: {
    params: {
      id: { type: "string", required: true },
      taskId: { type: "string", required: true }
    }
  },
  responses: {
    200: {
      success: { type: "boolean" },
      result: { type: "object" }
    }
  },
  handler: async ({ params }) => {
    try {
      const result = await agentService.executeTask(params.id, params.taskId);
      return {
        success: true,
        result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
});

// Stop Agent
export const StopAgent = createEndpoint({
  method: "DELETE",
  path: "/agents/:id",
  request: {
    params: {
      id: { type: "string", required: true }
    }
  },
  responses: {
    200: {
      success: { type: "boolean" },
      message: { type: "string" }
    }
  },
  handler: async ({ params }) => {
    try {
      await agentService.stopAgent(params.id);
      return {
        success: true,
        message: `Agent ${params.id} stopped`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
});

// Get Memory
export const GetMemory = createEndpoint({
  method: "GET",
  path: "/memory/:agentId",
  request: {
    params: {
      agentId: { type: "string", required: true }
    },
    query: MemoryFiltersSchema
  },
  responses: {
    200: MemoryResponseSchema,
    400: {
      success: { type: "boolean" },
      error: { type: "string" }
    }
  },
  handler: async ({ params, query }) => {
    try {
      // Zod validation happens automatically via schema
      const memory = await agentService.getMemory(params.agentId, query.type);
      return {
        success: true,
        memory
      };
    } catch (error) {
      return {
        success: false,
        memory: []
      };
    }
  }
});

// Store Memory
export const StoreMemory = createEndpoint({
  method: "POST",
  path: "/memory/:agentId",
  request: {
    params: {
      agentId: { type: "string", required: true }
    },
    body: StoreMemorySchema
  },
  responses: {
    200: {
      success: { type: "boolean" },
      message: { type: "string" }
    },
    400: {
      success: { type: "boolean" },
      error: { type: "string" }
    }
  },
  handler: async ({ params, body }) => {
    try {
      // Zod validation happens automatically via schema
      await agentService.storeMemory(params.agentId, body.type, body.data);
      return {
        success: true,
        message: `Memory stored for agent ${params.agentId}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
});
