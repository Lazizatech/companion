import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

/**
 * Unified CUA Client - Works with both Cloudflare Workers and Standalone modes
 * Automatically detects the environment and adapts accordingly
 */

export interface CUAConfig {
  headless?: boolean;
  useVision?: boolean;
  maxAttempts?: number;
  timeout?: number;
  userAgent?: string;
  model?: string;
  visionModel?: string;
}

export interface Agent {
  agentId: string;
  name: string;
  type: string;
  status: string;
  config: CUAConfig;
  created_at: string;
}

export interface Task {
  taskId: string;
  agentId: string;
  task: string;
  options: any;
  priority: string;
  status: string;
  created_at: string;
}

export interface TaskResult {
  success: boolean;
  result?: any;
  error?: string;
  screenshot?: string;
  duration: number;
  action?: string;
  confidence?: number;
}

export interface MemoryEntry {
  id: string;
  agentId: string;
  type: string;
  data: any;
  created_at: string;
}

export class UnifiedCUAClient {
  private client: AxiosInstance;
  private baseURL: string;
  private mode: 'workers' | 'standalone';

  constructor(baseURL = 'http://localhost:8787') {
    this.baseURL = baseURL;
    this.mode = this.detectMode();
    
    this.client = axios.create({
      baseURL: `${baseURL}/cua`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor for mode-specific handling
    this.client.interceptors.request.use((config) => {
      if (this.mode === 'workers') {
        // Add Cloudflare Workers specific headers if needed
        config.headers['CF-Worker'] = 'true';
      }
      return config;
    });
  }

  private detectMode(): 'workers' | 'standalone' {
    // Detect mode based on environment or URL
    if (typeof globalThis !== 'undefined' && 'Cloudflare' in globalThis) {
      return 'workers';
    }
    return 'standalone';
  }

  // Agent Management
  async createAgent(name: string, config: CUAConfig = {}): Promise<Agent> {
    const response = await this.client.post('/agents', {
      name,
      type: 'advanced',
      config: {
        headless: false,
        useVision: true,
        maxAttempts: 5,
        ...config
      }
    });
    return response.data;
  }

  async listAgents(filters: any = {}): Promise<Agent[]> {
    const response = await this.client.get('/agents', { params: filters });
    return response.data;
  }

  async getAgent(agentId: string): Promise<Agent> {
    const response = await this.client.get(`/agents/${agentId}`);
    return response.data;
  }

  async updateAgent(agentId: string, updates: Partial<Agent>): Promise<Agent> {
    const response = await this.client.put(`/agents/${agentId}`, updates);
    return response.data;
  }

  async stopAgent(agentId: string): Promise<{ success: boolean }> {
    const response = await this.client.delete(`/agents/${agentId}`);
    return response.data;
  }

  // Task Management
  async createTask(agentId: string, task: string, options: any = {}): Promise<Task> {
    const response = await this.client.post(`/agents/${agentId}/tasks`, {
      task,
      options: {
        useVision: true,
        maxAttempts: 5,
        ...options
      },
      priority: 'normal'
    });
    return response.data;
  }

  async executeTask(agentId: string, taskId: string): Promise<TaskResult> {
    const response = await this.client.post(`/agents/${agentId}/tasks/${taskId}/execute`);
    return response.data;
  }

  async getTask(agentId: string, taskId: string): Promise<Task> {
    const response = await this.client.get(`/agents/${agentId}/tasks/${taskId}`);
    return response.data;
  }

  async listTasks(agentId: string): Promise<Task[]> {
    const response = await this.client.get(`/agents/${agentId}/tasks`);
    return response.data;
  }

  async deleteTask(agentId: string, taskId: string): Promise<{ success: boolean }> {
    const response = await this.client.delete(`/agents/${agentId}/tasks/${taskId}`);
    return response.data;
  }

  // Memory Management
  async getMemory(agentId: string, type?: string): Promise<MemoryEntry[]> {
    const params = type ? { type } : {};
    const response = await this.client.get(`/memory/${agentId}`, { params });
    return response.data;
  }

  async storeMemory(agentId: string, type: string, data: any): Promise<MemoryEntry> {
    const response = await this.client.post(`/memory/${agentId}`, { type, data });
    return response.data;
  }

  async deleteMemory(agentId: string, memoryId: string): Promise<{ success: boolean }> {
    const response = await this.client.delete(`/memory/${agentId}/${memoryId}`);
    return response.data;
  }

  // Utility Methods
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseURL}/`);
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getMode(): Promise<'workers' | 'standalone'> {
    try {
      const response = await axios.get(`${this.baseURL}/standalone/health`);
      return response.data.mode === 'standalone' ? 'standalone' : 'workers';
    } catch (error) {
      return 'workers';
    }
  }

  // High-level convenience methods
  async quickTask(task: string, config: CUAConfig = {}): Promise<TaskResult> {
    // Create agent, execute task, return result
    const agent = await this.createAgent('Quick Task Agent', config);
    const taskObj = await this.createTask(agent.agentId, task);
    const result = await this.executeTask(agent.agentId, taskObj.taskId);
    await this.stopAgent(agent.agentId);
    return result;
  }

  async batchTasks(tasks: string[], config: CUAConfig = {}): Promise<TaskResult[]> {
    const agent = await this.createAgent('Batch Task Agent', config);
    const results: TaskResult[] = [];

    for (const task of tasks) {
      const taskObj = await this.createTask(agent.agentId, task);
      const result = await this.executeTask(agent.agentId, taskObj.taskId);
      results.push(result);
    }

    await this.stopAgent(agent.agentId);
    return results;
  }

  // Error handling
  private handleError(error: any): never {
    if (error.response) {
      throw new Error(`API Error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`);
    } else if (error.request) {
      throw new Error(`Network Error: Unable to connect to ${this.baseURL}`);
    } else {
      throw new Error(`Client Error: ${error.message}`);
    }
  }
}

// Export convenience functions
export const createCUAClient = (baseURL?: string) => new UnifiedCUAClient(baseURL);

export const quickTask = async (task: string, baseURL?: string, config?: CUAConfig) => {
  const client = new UnifiedCUAClient(baseURL);
  return await client.quickTask(task, config || {});
};

export const batchTasks = async (tasks: string[], baseURL?: string, config?: CUAConfig) => {
  const client = new UnifiedCUAClient(baseURL);
  return await client.batchTasks(tasks, config || {});
};
