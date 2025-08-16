// Simple API endpoints without browser dependencies
// Basic Hono routes for testing

import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

// Enable CORS
app.use('*', cors());

// In-memory storage for testing (replace with actual DB in production)
const agents = new Map();
const tasks = new Map();
const memory = new Map();

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    service: 'companion-api',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint with API info
app.get('/', (c) => {
  return c.json({
    name: 'Companion API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      agents: {
        list: 'GET /cua/agents',
        create: 'POST /cua/agents',
        get: 'GET /cua/agents/:id',
        delete: 'DELETE /cua/agents/:id'
      },
      tasks: {
        create: 'POST /cua/agents/:id/tasks',
        execute: 'POST /cua/agents/:id/tasks/:taskId/execute'
      },
      memory: {
        get: 'GET /cua/memory/:agentId',
        store: 'POST /cua/memory/:agentId'
      }
    }
  });
});

// List agents
app.get('/cua/agents', (c) => {
  const agentList = Array.from(agents.values());
  return c.json({
    agents: agentList,
    total: agentList.length
  });
});

// Create agent
app.post('/cua/agents', async (c) => {
  try {
    const body = await c.req.json();
    
    const agent = {
      id: crypto.randomUUID(),
      name: body.name || 'Unnamed Agent',
      type: body.type || 'browser',
      status: 'active',
      capabilities: body.capabilities || [],
      configuration: body.configuration || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    agents.set(agent.id, agent);
    
    return c.json(agent, 201);
  } catch (error) {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
});

// Get agent
app.get('/cua/agents/:id', (c) => {
  const agentId = c.req.param('id');
  const agent = agents.get(agentId);
  
  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }
  
  return c.json(agent);
});

// Delete agent
app.delete('/cua/agents/:id', (c) => {
  const agentId = c.req.param('id');
  const agent = agents.get(agentId);
  
  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }
  
  agent.status = 'stopped';
  agent.updated_at = new Date().toISOString();
  agents.set(agentId, agent);
  
  return c.body(null, 204);
});

// Create task for agent
app.post('/cua/agents/:id/tasks', async (c) => {
  try {
    const agentId = c.req.param('id');
    const agent = agents.get(agentId);
    
    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }
    
    const body = await c.req.json();
    
    const task = {
      id: crypto.randomUUID(),
      agent_id: agentId,
      task: body.task || '',
      options: body.options || {},
      priority: body.priority || 3,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    tasks.set(task.id, task);
    
    return c.json(task, 201);
  } catch (error) {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
});

// Execute task
app.post('/cua/agents/:id/tasks/:taskId/execute', (c) => {
  const agentId = c.req.param('id');
  const taskId = c.req.param('taskId');
  
  const agent = agents.get(agentId);
  const task = tasks.get(taskId);
  
  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }
  
  if (!task || task.agent_id !== agentId) {
    return c.json({ error: 'Task not found' }, 404);
  }
  
  // Update task status
  task.status = 'in_progress';
  task.updated_at = new Date().toISOString();
  tasks.set(taskId, task);
  
  return c.json({
    task_id: taskId,
    status: 'in_progress',
    message: 'Task execution started (would delegate to browser service)',
    note: 'This is a mock execution - in production would call browser service'
  });
});

// Get agent memory
app.get('/cua/memory/:agentId', (c) => {
  const agentId = c.req.param('agentId');
  const agentMemory = memory.get(agentId) || [];
  
  return c.json({
    agent_id: agentId,
    memory: agentMemory
  });
});

// Store agent memory
app.post('/cua/memory/:agentId', async (c) => {
  try {
    const agentId = c.req.param('agentId');
    const body = await c.req.json();
    
    const memoryEntry = {
      id: crypto.randomUUID(),
      agent_id: agentId,
      type: body.type || 'short_term',
      data: body.data || {},
      created_at: new Date().toISOString()
    };
    
    const agentMemory = memory.get(agentId) || [];
    agentMemory.push(memoryEntry);
    memory.set(agentId, agentMemory);
    
    return c.json(memoryEntry, 201);
  } catch (error) {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
});

// List tasks for agent
app.get('/cua/agents/:id/tasks', (c) => {
  const agentId = c.req.param('id');
  const agentTasks = Array.from(tasks.values()).filter(task => task.agent_id === agentId);
  
  return c.json({
    agent_id: agentId,
    tasks: agentTasks,
    total: agentTasks.length
  });
});

export default app;