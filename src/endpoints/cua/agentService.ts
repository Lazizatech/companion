import { DB, agents, tasks, memory, NewAgent, NewTask, NewMemory } from '../../db';
import { CUAEngine, CUAConfig } from '../../cua/engine';

export class AgentService {
  constructor(private db: DB) {}

  async createAgent(data: { name: string; type?: string; config?: CUAConfig }): Promise<{ id: string; success: boolean }> {
    const agentId = `cua_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newAgent: NewAgent = {
      id: agentId,
      name: data.name,
      type: (data.type as any) || 'advanced',
      config: data.config ? JSON.stringify(data.config) : null,
      status: 'created',
      created_at: new Date().toISOString()
    };

    await this.db.insert(agents).values(newAgent);
    
    return { id: agentId, success: true };
  }

  async getAgents(filters: { status?: string; type?: string; limit?: number; offset?: number } = {}) {
    const { status, type, limit = 50, offset = 0 } = filters;
    
    let query = this.db.select().from(agents);
    
    if (status && status !== 'all') {
      query = query.where(this.db.eq(agents.status, status));
    }
    
    if (type) {
      query = query.where(this.db.eq(agents.type, type));
    }
    
    const results = await query.limit(limit).offset(offset);
    
    // Get task counts and success rates
    const agentsWithStats = await Promise.all(
      results.map(async (agent) => {
        const taskStats = await this.db
          .select({
            count: this.db.count(),
            success_rate: this.db.avg(this.db.case().when(this.db.eq(tasks.status, 'completed'), 1).else(0))
          })
          .from(tasks)
          .where(this.db.eq(tasks.agent_id, agent.id));
        
        return {
          ...agent,
          config: agent.config ? JSON.parse(agent.config) : {},
          task_count: taskStats[0]?.count || 0,
          success_rate: taskStats[0]?.success_rate || 0
        };
      })
    );
    
    return agentsWithStats;
  }

  async getAgent(agentId: string) {
    const agent = await this.db.select().from(agents).where(this.db.eq(agents.id, agentId)).first();
    
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    
    return {
      ...agent,
      config: agent.config ? JSON.parse(agent.config) : {}
    };
  }

  async createTask(agentId: string, data: { task: string; options?: any; priority?: string }): Promise<{ id: string; success: boolean }> {
    // Verify agent exists
    const agent = await this.getAgent(agentId);
    
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newTask: NewTask = {
      id: taskId,
      agent_id: agentId,
      task: data.task,
      options: data.options ? JSON.stringify(data.options) : null,
      priority: (data.priority as any) || 'normal',
      status: 'queued',
      created_at: new Date().toISOString()
    };

    await this.db.insert(tasks).values(newTask);
    
    // Update agent status
    await this.db.update(agents)
      .set({ status: 'busy', last_active: new Date().toISOString() })
      .where(this.db.eq(agents.id, agentId));
    
    return { id: taskId, success: true };
  }

  async executeTask(agentId: string, taskId: string) {
    // Get task
    const task = await this.db.select().from(tasks).where(this.db.eq(tasks.id, taskId)).first();
    
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    // Initialize CUA engine
    const config = task.options ? JSON.parse(task.options) : {};
    const engine = new CUAEngine(this.db, agentId, config);
    
    try {
      await engine.init();
      const result = await engine.executeTask(task.task);
      await engine.close();
      
      return result;
    } catch (error) {
      await engine.close();
      throw error;
    }
  }

  async getMemory(agentId: string, type?: string) {
    let query = this.db.select().from(memory).where(this.db.eq(memory.agent_id, agentId));
    
    if (type) {
      query = query.where(this.db.eq(memory.memory_type, type));
    }
    
    const memories = await query;
    
    return memories.map(mem => ({
      ...mem,
      data: JSON.parse(mem.data)
    }));
  }

  async storeMemory(agentId: string, type: string, data: any) {
    const newMemory: NewMemory = {
      agent_id: agentId,
      memory_type: type as any,
      data: JSON.stringify(data),
      created_at: new Date().toISOString()
    };

    await this.db.insert(memory).values(newMemory);
    
    return { success: true };
  }

  async stopAgent(agentId: string) {
    await this.db.update(agents)
      .set({ status: 'stopped', last_active: new Date().toISOString() })
      .where(this.db.eq(agents.id, agentId));
    
    return { success: true };
  }
}
