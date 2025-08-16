import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UnifiedCUAClient, createCUAClient, quickTask, batchTasks } from '../../src/unified-client';
import axios from 'axios';

// Mock axios
vi.mock('axios');

describe('Unified CUA Client', () => {
  let client: UnifiedCUAClient;
  let mockAxios: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create mock axios instance
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Client Initialization', () => {
    it('should create client with default base URL', () => {
      const defaultClient = new UnifiedCUAClient();
      expect(defaultClient).toBeInstanceOf(UnifiedCUAClient);
    });

    it('should create client with custom base URL', () => {
      const customClient = new UnifiedCUAClient('http://custom-api.com');
      expect(customClient).toBeInstanceOf(UnifiedCUAClient);
    });

    it('should detect mode correctly', async () => {
      // Mock the mode detection
      const mockGet = vi.fn().mockResolvedValue({
        data: { mode: 'standalone' }
      });
      
      mockAxios.get = mockGet;
      
      const mode = await client.getMode();
      expect(mode).toBe('standalone');
    });
  });

  describe('Agent Management', () => {
    it('should create agent successfully', async () => {
      const mockResponse = {
        data: {
          agentId: 'test-agent-id',
          name: 'Test Agent',
          type: 'advanced',
          status: 'created',
          config: { headless: true },
          created_at: new Date().toISOString()
        }
      };

      const mockPost = vi.fn().mockResolvedValue(mockResponse);
      mockAxios.create().post = mockPost;

      const result = await client.createAgent('Test Agent', { headless: true });

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

    it('should list agents successfully', async () => {
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

      expect(result).toEqual(mockResponse.data);
      expect(mockGet).toHaveBeenCalledWith('/agents', { params: {} });
    });

    it('should get agent by ID successfully', async () => {
      const mockResponse = {
        data: {
          agentId: 'test-agent-id',
          name: 'Test Agent',
          type: 'advanced',
          status: 'active'
        }
      };

      const mockGet = vi.fn().mockResolvedValue(mockResponse);
      mockAxios.create().get = mockGet;

      const result = await client.getAgent('test-agent-id');

      expect(result).toEqual(mockResponse.data);
      expect(mockGet).toHaveBeenCalledWith('/agents/test-agent-id');
    });

    it('should update agent successfully', async () => {
      const mockResponse = {
        data: {
          agentId: 'test-agent-id',
          name: 'Updated Agent',
          type: 'advanced',
          status: 'active'
        }
      };

      const mockPut = vi.fn().mockResolvedValue(mockResponse);
      mockAxios.create().put = mockPut;

      const result = await client.updateAgent('test-agent-id', { name: 'Updated Agent' });

      expect(result).toEqual(mockResponse.data);
      expect(mockPut).toHaveBeenCalledWith('/agents/test-agent-id', { name: 'Updated Agent' });
    });

    it('should stop agent successfully', async () => {
      const mockResponse = {
        data: { success: true }
      };

      const mockDelete = vi.fn().mockResolvedValue(mockResponse);
      mockAxios.create().delete = mockDelete;

      const result = await client.stopAgent('test-agent-id');

      expect(result).toEqual(mockResponse.data);
      expect(mockDelete).toHaveBeenCalledWith('/agents/test-agent-id');
    });
  });

  describe('Task Management', () => {
    it('should create task successfully', async () => {
      const mockResponse = {
        data: {
          taskId: 'test-task-id',
          agentId: 'test-agent-id',
          task: 'Navigate to example.com',
          options: { useVision: true },
          priority: 'normal',
          status: 'pending',
          created_at: new Date().toISOString()
        }
      };

      const mockPost = vi.fn().mockResolvedValue(mockResponse);
      mockAxios.create().post = mockPost;

      const result = await client.createTask('test-agent-id', 'Navigate to example.com');

      expect(result).toEqual(mockResponse.data);
      expect(mockPost).toHaveBeenCalledWith('/agents/test-agent-id/tasks', {
        task: 'Navigate to example.com',
        options: {
          useVision: true,
          maxAttempts: 5
        },
        priority: 'normal'
      });
    });

    it('should execute task successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          result: 'Task completed successfully',
          duration: 1500,
          action: 'navigate'
        }
      };

      const mockPost = vi.fn().mockResolvedValue(mockResponse);
      mockAxios.create().post = mockPost;

      const result = await client.executeTask('test-agent-id', 'test-task-id');

      expect(result).toEqual(mockResponse.data);
      expect(mockPost).toHaveBeenCalledWith('/agents/test-agent-id/tasks/test-task-id/execute');
    });

    it('should get task successfully', async () => {
      const mockResponse = {
        data: {
          taskId: 'test-task-id',
          agentId: 'test-agent-id',
          task: 'Navigate to example.com',
          status: 'completed'
        }
      };

      const mockGet = vi.fn().mockResolvedValue(mockResponse);
      mockAxios.create().get = mockGet;

      const result = await client.getTask('test-agent-id', 'test-task-id');

      expect(result).toEqual(mockResponse.data);
      expect(mockGet).toHaveBeenCalledWith('/agents/test-agent-id/tasks/test-task-id');
    });

    it('should list tasks successfully', async () => {
      const mockResponse = {
        data: [
          {
            taskId: 'task-1',
            agentId: 'test-agent-id',
            task: 'Task 1',
            status: 'completed'
          }
        ]
      };

      const mockGet = vi.fn().mockResolvedValue(mockResponse);
      mockAxios.create().get = mockGet;

      const result = await client.listTasks('test-agent-id');

      expect(result).toEqual(mockResponse.data);
      expect(mockGet).toHaveBeenCalledWith('/agents/test-agent-id/tasks');
    });

    it('should delete task successfully', async () => {
      const mockResponse = {
        data: { success: true }
      };

      const mockDelete = vi.fn().mockResolvedValue(mockResponse);
      mockAxios.create().delete = mockDelete;

      const result = await client.deleteTask('test-agent-id', 'test-task-id');

      expect(result).toEqual(mockResponse.data);
      expect(mockDelete).toHaveBeenCalledWith('/agents/test-agent-id/tasks/test-task-id');
    });
  });

  describe('Memory Management', () => {
    it('should get memory successfully', async () => {
      const mockResponse = {
        data: [
          {
            id: 'memory-1',
            agentId: 'test-agent-id',
            type: 'task_result',
            data: { result: 'success' },
            created_at: new Date().toISOString()
          }
        ]
      };

      const mockGet = vi.fn().mockResolvedValue(mockResponse);
      mockAxios.create().get = mockGet;

      const result = await client.getMemory('test-agent-id');

      expect(result).toEqual(mockResponse.data);
      expect(mockGet).toHaveBeenCalledWith('/memory/test-agent-id', { params: {} });
    });

    it('should store memory successfully', async () => {
      const mockResponse = {
        data: {
          id: 'memory-1',
          agentId: 'test-agent-id',
          type: 'task_result',
          data: { result: 'success' },
          created_at: new Date().toISOString()
        }
      };

      const mockPost = vi.fn().mockResolvedValue(mockResponse);
      mockAxios.create().post = mockPost;

      const result = await client.storeMemory('test-agent-id', 'task_result', { result: 'success' });

      expect(result).toEqual(mockResponse.data);
      expect(mockPost).toHaveBeenCalledWith('/memory/test-agent-id', {
        type: 'task_result',
        data: { result: 'success' }
      });
    });

    it('should delete memory successfully', async () => {
      const mockResponse = {
        data: { success: true }
      };

      const mockDelete = vi.fn().mockResolvedValue(mockResponse);
      mockAxios.create().delete = mockDelete;

      const result = await client.deleteMemory('test-agent-id', 'memory-1');

      expect(result).toEqual(mockResponse.data);
      expect(mockDelete).toHaveBeenCalledWith('/memory/test-agent-id/memory-1');
    });
  });

  describe('Utility Methods', () => {
    it('should perform health check successfully', async () => {
      mockAxios.get.mockResolvedValue({ status: 200 });

      const result = await client.healthCheck();

      expect(result).toBe(true);
      expect(mockAxios.get).toHaveBeenCalledWith('http://localhost:8787/');
    });

    it('should handle health check failure', async () => {
      mockAxios.get.mockRejectedValue(new Error('Connection failed'));

      const result = await client.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('High-level Convenience Methods', () => {
    it('should execute quick task successfully', async () => {
      // Mock all the required API calls
      const mockAgentResponse = {
        data: { agentId: 'quick-agent-id' }
      };
      const mockTaskResponse = {
        data: { taskId: 'quick-task-id' }
      };
      const mockExecuteResponse = {
        data: { success: true, result: 'Task completed' }
      };
      const mockStopResponse = {
        data: { success: true }
      };

      const mockPost = vi.fn()
        .mockResolvedValueOnce(mockAgentResponse)
        .mockResolvedValueOnce(mockTaskResponse)
        .mockResolvedValueOnce(mockExecuteResponse);
      const mockDelete = vi.fn().mockResolvedValue(mockStopResponse);
      
      mockAxios.create().post = mockPost;
      mockAxios.create().delete = mockDelete;

      const result = await client.quickTask('Navigate to example.com');

      expect(result).toEqual(mockExecuteResponse.data);
      expect(mockPost).toHaveBeenCalledTimes(3);
      expect(mockDelete).toHaveBeenCalledWith('/agents/quick-agent-id');
    });

    it('should execute batch tasks successfully', async () => {
      const tasks = ['Task 1', 'Task 2', 'Task 3'];
      
      // Mock responses for batch execution
      const mockAgentResponse = {
        data: { agentId: 'batch-agent-id' }
      };
      const mockTaskResponses = tasks.map((_, i) => ({
        data: { taskId: `task-${i}-id` }
      }));
      const mockExecuteResponses = tasks.map(() => ({
        data: { success: true, result: 'Task completed' }
      }));
      const mockStopResponse = {
        data: { success: true }
      };

      const mockPost = vi.fn()
        .mockResolvedValueOnce(mockAgentResponse)
        .mockResolvedValueOnce(mockTaskResponses[0])
        .mockResolvedValueOnce(mockExecuteResponses[0])
        .mockResolvedValueOnce(mockTaskResponses[1])
        .mockResolvedValueOnce(mockExecuteResponses[1])
        .mockResolvedValueOnce(mockTaskResponses[2])
        .mockResolvedValueOnce(mockExecuteResponses[2]);
      const mockDelete = vi.fn().mockResolvedValue(mockStopResponse);
      
      mockAxios.create().post = mockPost;
      mockAxios.create().delete = mockDelete;

      const results = await client.batchTasks(tasks);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockPost).toHaveBeenCalledTimes(7); // 1 agent + 3 tasks + 3 executions
      expect(mockDelete).toHaveBeenCalledWith('/agents/batch-agent-id');
    });
  });

  describe('Convenience Functions', () => {
    it('should create client using convenience function', () => {
      const client = createCUAClient('http://custom-api.com');
      expect(client).toBeInstanceOf(UnifiedCUAClient);
    });

    it('should execute quick task using convenience function', async () => {
      // Mock the quickTask method
      const mockQuickTask = vi.fn().mockResolvedValue({ success: true });
      vi.spyOn(UnifiedCUAClient.prototype, 'quickTask').mockImplementation(mockQuickTask);

      const result = await quickTask('Test task', 'http://localhost:8787');

      expect(result).toEqual({ success: true });
      expect(mockQuickTask).toHaveBeenCalledWith('Test task', {});
    });

    it('should execute batch tasks using convenience function', async () => {
      // Mock the batchTasks method
      const mockBatchTasks = vi.fn().mockResolvedValue([{ success: true }, { success: true }]);
      vi.spyOn(UnifiedCUAClient.prototype, 'batchTasks').mockImplementation(mockBatchTasks);

      const tasks = ['Task 1', 'Task 2'];
      const result = await batchTasks(tasks, 'http://localhost:8787');

      expect(result).toEqual([{ success: true }, { success: true }]);
      expect(mockBatchTasks).toHaveBeenCalledWith(tasks, {});
    });
  });
});
