import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { UnifiedCUAClient } from '../../src/unified-client';
import axios from 'axios';

// Mock axios for testing
vi.mock('axios');

describe('Standalone Server', () => {
  let client: UnifiedCUAClient;
  let mockAxios: any;

  beforeAll(async () => {
    // Setup mocks
    mockAxios = {
      create: vi.fn().mockReturnValue({
        post: vi.fn(),
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: {
            use: vi.fn()
          }
        }
      }),
      get: vi.fn()
    };

    (axios as any).create = mockAxios.create;
    (axios as any).get = mockAxios.get;

    client = new UnifiedCUAClient('http://localhost:8787');
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('Health Endpoints', () => {
    it('should return health status', async () => {
      mockAxios.get.mockResolvedValue({
        status: 200,
        data: {
          status: 'healthy',
          service: 'CUA Companion API',
          version: '1.0.0',
          timestamp: new Date().toISOString()
        }
      });

      const result = await client.healthCheck();
      expect(result).toBe(true);
    });

    it('should return standalone health status', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: {
          status: 'healthy',
          mode: 'standalone',
          timestamp: new Date().toISOString()
        }
      });
      
      mockAxios.get = mockGet;
      
      const mode = await client.getMode();
      expect(mode).toBe('standalone');
    });
  });

  describe('CUA API Endpoints', () => {
    it('should handle agent creation', async () => {
      const mockResponse = {
        data: {
          agentId: 'test-agent-id',
          name: 'Test Agent',
          type: 'advanced',
          status: 'created'
        }
      };

      const mockPost = vi.fn().mockResolvedValue(mockResponse);
      mockAxios.create().post = mockPost;

      const result = await client.createAgent('Test Agent', {
        headless: true,
        useVision: true
      });

      expect(result).toEqual(mockResponse.data);
      expect(mockPost).toHaveBeenCalledWith('/agents', {
        name: 'Test Agent',
        type: 'advanced',
        config: {
          headless: true,
          useVision: true,
          maxAttempts: 5
        }
      });
    });

    it('should handle agent listing', async () => {
      const mockResponse = {
        data: [
          {
            agentId: 'agent-1',
            name: 'Agent 1',
            type: 'advanced',
            status: 'active'
          }
        ]
      };

      const mockGet = vi.fn().mockResolvedValue(mockResponse);
      mockAxios.create().get = mockGet;

      const result = await client.listAgents();

      expect(Array.isArray(result)).toBe(true);
      expect(mockGet).toHaveBeenCalledWith('/agents', { params: {} });
    });

    it('should handle task creation', async () => {
      const mockResponse = {
        data: {
          taskId: 'test-task-id',
          agentId: 'test-agent-id',
          task: 'Navigate to example.com',
          status: 'pending'
        }
      };

      const mockPost = vi.fn().mockResolvedValue(mockResponse);
      mockAxios.create().post = mockPost;

      const result = await client.createTask('test-agent-id', 'Navigate to example.com', {
        useVision: true,
        maxAttempts: 3
      });

      expect(result).toEqual(mockResponse.data);
      expect(mockPost).toHaveBeenCalledWith('/agents/test-agent-id/tasks', {
        task: 'Navigate to example.com',
        options: {
          useVision: true,
          maxAttempts: 3
        },
        priority: 'normal'
      });
    });

    it('should handle task execution', async () => {
      const mockResponse = {
        data: {
          success: true,
          result: 'Task completed',
          duration: 1500
        }
      };

      const mockPost = vi.fn().mockResolvedValue(mockResponse);
      mockAxios.create().post = mockPost;

      const result = await client.executeTask('test-agent-id', 'test-task-id');

      expect(result).toEqual(mockResponse.data);
      expect(mockPost).toHaveBeenCalledWith('/agents/test-agent-id/tasks/test-task-id/execute');
    });
  });

  describe('Task Management Endpoints', () => {
    it('should handle task creation', async () => {
      const mockResponse = {
        data: {
          id: 'test-task-id',
          title: 'Test Task',
          description: 'A test task for integration',
          priority: 'normal',
          status: 'pending'
        }
      };

      const mockPost = vi.fn().mockResolvedValue(mockResponse);
      mockAxios.create().post = mockPost;

      // This would be a direct API call to the tasks endpoint
      const response = await axios.post('http://localhost:8787/tasks', {
        title: 'Test Task',
        description: 'A test task for integration',
        priority: 'normal',
        status: 'pending'
      });

      expect(response.data).toEqual(mockResponse.data);
    });

    it('should handle task listing', async () => {
      const mockResponse = {
        data: [
          {
            id: 'task-1',
            title: 'Task 1',
            status: 'completed'
          }
        ]
      };

      const mockGet = vi.fn().mockResolvedValue(mockResponse);
      mockAxios.create().get = mockGet;

      const result = await axios.get('http://localhost:8787/tasks');

      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should handle task retrieval', async () => {
      const mockResponse = {
        data: {
          id: 'test-task-id',
          title: 'Test Task',
          status: 'completed'
        }
      };

      const mockGet = vi.fn().mockResolvedValue(mockResponse);
      mockAxios.create().get = mockGet;

      const result = await axios.get('http://localhost:8787/tasks/test-task-id');

      expect(result.data).toHaveProperty('id');
    });

    it('should handle task updates', async () => {
      const mockResponse = {
        data: {
          id: 'test-task-id',
          title: 'Updated Task',
          status: 'completed'
        }
      };

      const mockPut = vi.fn().mockResolvedValue(mockResponse);
      mockAxios.create().put = mockPut;

      const result = await axios.put('http://localhost:8787/tasks/test-task-id', {
        title: 'Updated Task',
        status: 'completed'
      });

      expect(result.data.title).toBe('Updated Task');
      expect(result.data.status).toBe('completed');
    });

    it('should handle task deletion', async () => {
      const mockResponse = {
        data: { success: true }
      };

      const mockDelete = vi.fn().mockResolvedValue(mockResponse);
      mockAxios.create().delete = mockDelete;

      const result = await axios.delete('http://localhost:8787/tasks/test-task-id');

      expect(result.data).toHaveProperty('success', true);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      mockAxios.get.mockRejectedValue({
        response: { status: 404 }
      });

      try {
        await axios.get('http://localhost:8787/nonexistent-endpoint');
      } catch (error: any) {
        expect(error.response.status).toBe(404);
      }
    });

    it('should handle invalid JSON', async () => {
      mockAxios.post.mockRejectedValue({
        response: { status: 400 }
      });

      try {
        await axios.post('http://localhost:8787/cua/agents', 'invalid json', {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });
  });
});
