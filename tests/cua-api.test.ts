import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import { createDB } from '../src/db';
import agentRoutes from '../src/endpoints/cua/agent';

// Mock dependencies
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        addInitScript: vi.fn(),
        newPage: vi.fn().mockResolvedValue({
          url: vi.fn().mockReturnValue('https://example.com'),
          title: vi.fn().mockResolvedValue('Example Page'),
          goto: vi.fn(),
          waitForSelector: vi.fn(),
          click: vi.fn(),
          type: vi.fn(),
          keyboard: { press: vi.fn() },
          evaluate: vi.fn(),
          waitForTimeout: vi.fn(),
          $: vi.fn(),
          screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
          close: vi.fn()
        }),
        close: vi.fn()
      })
    })
  }
}));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                action: 'navigate',
                target: 'https://example.com',
                confidence: 0.95,
                reasoning: 'Test navigation'
              })
            }
          }]
        })
      }
    }
  }))
}));

describe('CUA API Endpoints', () => {
  let app: Hono;
  let mockDB: any;
  let mockD1: any;

  beforeEach(() => {
    // Mock D1 database
    mockD1 = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn(),
          all: vi.fn().mockResolvedValue([])
        })
      })
    };

    mockDB = createDB(mockD1 as any);
    
    // Mock database operations
    vi.spyOn(mockDB, 'insert').mockReturnValue({
      values: vi.fn().mockResolvedValue([{
        id: 'test-agent-id',
        name: 'Test Agent',
        type: 'advanced',
        status: 'created',
        created_at: new Date().toISOString()
      }])
    } as any);
    
    vi.spyOn(mockDB, 'update').mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined)
      })
    } as any);
    
    vi.spyOn(mockDB, 'select').mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
          limit: vi.fn().mockResolvedValue([{
            id: 'test-agent-id',
            name: 'Test Agent',
            type: 'advanced',
            status: 'created',
            created_at: new Date().toISOString()
          }])
        })
      })
    } as any);

    app = new Hono();
    app.route('/api/cua', agentRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/cua/agents', () => {
    it('should create a new agent', async () => {
      const response = await app.request('/api/cua/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Test Agent',
          type: 'advanced',
          config: {
            headless: true,
            useVision: true
          }
        })
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.name).toBe('Test Agent');
      expect(data.type).toBe('advanced');
    });

    it('should validate required fields', async () => {
      const response = await app.request('/api/cua/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Missing name
          type: 'advanced'
        })
      });

      expect(response.status).toBe(400);
    });

    it('should use default values', async () => {
      const response = await app.request('/api/cua/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Test Agent'
          // No type specified
        })
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.type).toBe('advanced'); // Default value
    });
  });

  describe('GET /api/cua/agents', () => {
    it('should list all agents', async () => {
      // Mock agents list
      vi.spyOn(mockDB, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([
            {
              id: 'agent-1',
              name: 'Agent 1',
              type: 'advanced',
              status: 'active',
              created_at: new Date().toISOString()
            },
            {
              id: 'agent-2',
              name: 'Agent 2',
              type: 'basic',
              status: 'idle',
              created_at: new Date().toISOString()
            }
          ])
        })
      } as any);

      const response = await app.request('/api/cua/agents');
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(2);
      expect(data[0].name).toBe('Agent 1');
    });
  });

  describe('GET /api/cua/agents/{id}', () => {
    it('should get agent by ID', async () => {
      const response = await app.request('/api/cua/agents/test-agent-id');
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe('test-agent-id');
      expect(data.name).toBe('Test Agent');
    });

    it('should return 404 for non-existent agent', async () => {
      // Mock empty result
      vi.spyOn(mockDB, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      } as any);

      const response = await app.request('/api/cua/agents/non-existent-id');
      
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/cua/agents/{id}/tasks', () => {
    it('should execute a task successfully', async () => {
      // Mock task execution
      vi.spyOn(mockDB, 'insert').mockReturnValue({
        values: vi.fn().mockResolvedValue([{
          id: 'task-1',
          agent_id: 'test-agent-id',
          task: 'Navigate to Google',
          status: 'completed',
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        }])
      } as any);

      const response = await app.request('/api/cua/agents/test-agent-id/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          task: 'Navigate to Google'
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.task).toBe('Navigate to Google');
      expect(data.status).toBe('completed');
    });

    it('should handle task execution errors', async () => {
      // Mock agent not found
      vi.spyOn(mockDB, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      } as any);

      const response = await app.request('/api/cua/agents/non-existent-id/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          task: 'Test task'
        })
      });

      expect(response.status).toBe(404);
    });

    it('should validate task input', async () => {
      const response = await app.request('/api/cua/agents/test-agent-id/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Missing task
          options: { some: 'option' }
        })
      });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/cua/agents/{id}/tasks', () => {
    it('should list agent tasks', async () => {
      // Mock tasks list
      vi.spyOn(mockDB, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              {
                id: 'task-1',
                agent_id: 'test-agent-id',
                task: 'Navigate to Google',
                status: 'completed',
                created_at: new Date().toISOString(),
                completed_at: new Date().toISOString()
              },
              {
                id: 'task-2',
                agent_id: 'test-agent-id',
                task: 'Search for something',
                status: 'running',
                created_at: new Date().toISOString()
              }
            ])
          })
        })
      } as any);

      const response = await app.request('/api/cua/agents/test-agent-id/tasks');
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(2);
      expect(data[0].task).toBe('Navigate to Google');
      expect(data[1].task).toBe('Search for something');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      vi.spyOn(mockDB, 'insert').mockRejectedValue(new Error('Database error'));

      const response = await app.request('/api/cua/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Test Agent'
        })
      });

      expect(response.status).toBe(500);
    });

    it('should handle invalid JSON', async () => {
      const response = await app.request('/api/cua/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: 'invalid json'
      });

      expect(response.status).toBe(400);
    });
  });

  describe('OpenAPI Schema Validation', () => {
    it('should validate request schemas', async () => {
      const response = await app.request('/api/cua/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: '', // Empty name should fail validation
          type: 'invalid-type' // Invalid type should fail validation
        })
      });

      expect(response.status).toBe(400);
    });

    it('should validate response schemas', async () => {
      const response = await app.request('/api/cua/agents/test-agent-id');
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      // Verify response structure matches schema
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('type');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('created_at');
    });
  });
});
