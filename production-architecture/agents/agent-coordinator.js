#!/usr/bin/env node

/**
 * Agent Coordinator System
 * Manages multiple autonomous agents and handles inter-agent communication
 */

const AutonomousAgent = require('./autonomous-agent.js');
const axios = require('axios');

class AgentCoordinator {
  constructor() {
    this.agents = new Map();
    this.taskQueue = [];
    this.humanInterventionQueue = [];
    this.isProcessing = false;
    
    // Service endpoints
    this.services = {
      companion: 'http://localhost:8787',
      browser: 'http://localhost:3000', 
      aiderNeo: 'http://localhost:5001'
    };
  }

  async createAgent(options = {}) {
    const agent = new AutonomousAgent({
      ...options,
      onHumanHandoff: (data) => this.handleHumanHandoff(data),
      onTaskComplete: (agentId, result) => this.handleTaskComplete(agentId, result)
    });

    await agent.init();
    this.agents.set(agent.id, agent);
    
    console.log(`🤖 Created Agent ${agent.id}`);
    return agent.id;
  }

  async executeCoordinatedTask(taskDescription) {
    console.log(`🎯 Coordinating task: ${taskDescription}`);
    
    try {
      // Step 1: Use Aider-Neo to plan the task
      const plan = await this.planTask(taskDescription);
      console.log(`📋 Task plan created:`, plan);
      
      // Step 2: Create specialized agent for the task
      const agentId = await this.createAgent({
        headless: false,
        useVision: true
      });
      
      // Step 3: Execute plan with the agent
      const results = [];
      for (const step of plan.steps) {
        const result = await this.executeStep(agentId, step);
        results.push(result);
        
        if (!result.success) {
          console.log(`❌ Step failed: ${step.description}`);
          break;
        }
      }
      
      // Step 4: Analyze results with Aider-Neo
      const analysis = await this.analyzeResults(taskDescription, results);
      
      return {
        success: true,
        plan,
        results,
        analysis,
        agent: agentId
      };
      
    } catch (error) {
      console.error(`❌ Coordinated task failed:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async planTask(taskDescription) {
    try {
      console.log(`🧠 Planning task with Aider-Neo: ${taskDescription}`);
      
      const response = await axios.post(`${this.services.aiderNeo}/api/v1/ai/orchestrate`, {
        task: taskDescription,
        agents: ['planner', 'browser', 'analyzer']
      });
      
      // Convert AI response to actionable steps
      const aiPlan = response.data;
      
      return {
        task: taskDescription,
        steps: this.convertAIPlanToSteps(taskDescription, aiPlan),
        estimatedTime: aiPlan.estimated_completion || '5-10 minutes',
        agents: aiPlan.agents_involved || ['browser', 'analyzer']
      };
      
    } catch (error) {
      console.log(`⚠️ AI planning failed, using default plan: ${error.message}`);
      return this.createDefaultPlan(taskDescription);
    }
  }

  convertAIPlanToSteps(taskDescription, aiPlan) {
    // Extract actionable steps from AI orchestration plan
    if (aiPlan.orchestration_plan) {
      return aiPlan.orchestration_plan.map(step => ({
        id: step.step,
        description: step.action,
        agent: step.agent,
        status: 'pending',
        url: this.inferUrlFromTask(taskDescription)
      }));
    }
    
    // Fallback to default steps
    return this.createDefaultSteps(taskDescription);
  }

  createDefaultPlan(taskDescription) {
    return {
      task: taskDescription,
      steps: this.createDefaultSteps(taskDescription),
      estimatedTime: '5 minutes',
      agents: ['browser']
    };
  }

  createDefaultSteps(taskDescription) {
    const steps = [];
    
    if (taskDescription.toLowerCase().includes('alibaba')) {
      steps.push({
        id: 1,
        description: 'Navigate to Alibaba.com',
        url: 'https://alibaba.com',
        status: 'pending'
      });
      
      steps.push({
        id: 2,
        description: `Search for products related to: ${taskDescription}`,
        status: 'pending'
      });
      
      steps.push({
        id: 3,
        description: 'Analyze product prices and specifications',
        status: 'pending'
      });
    } else {
      steps.push({
        id: 1,
        description: taskDescription,
        status: 'pending'
      });
    }
    
    return steps;
  }

  inferUrlFromTask(taskDescription) {
    const taskLower = taskDescription.toLowerCase();
    
    if (taskLower.includes('alibaba')) return 'https://alibaba.com';
    if (taskLower.includes('google')) return 'https://google.com';
    if (taskLower.includes('amazon')) return 'https://amazon.com';
    
    return null;
  }

  async executeStep(agentId, step) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    
    console.log(`⚡ Executing step ${step.id}: ${step.description}`);
    
    try {
      const task = {
        description: step.description,
        url: step.url
      };
      
      const result = await agent.executeTask(task);
      
      if (result.success) {
        step.status = 'completed';
        console.log(`✅ Step ${step.id} completed`);
      } else {
        step.status = 'failed';
        console.log(`❌ Step ${step.id} failed: ${result.error}`);
      }
      
      return {
        ...result,
        step: step.id,
        description: step.description
      };
      
    } catch (error) {
      step.status = 'error';
      console.log(`💥 Step ${step.id} error: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        step: step.id,
        description: step.description
      };
    }
  }

  async analyzeResults(originalTask, results) {
    try {
      console.log(`🔍 Analyzing results with Aider-Neo`);
      
      const analysisPrompt = `Analyze the following task execution results:
      
Original Task: ${originalTask}

Results: ${JSON.stringify(results, null, 2)}

Provide insights on:
1. Success rate and completion status
2. Any issues encountered 
3. Data extracted or findings
4. Recommendations for improvement`;

      const response = await axios.post(`${this.services.aiderNeo}/api/v1/ai/chat`, {
        messages: [
          { role: 'user', content: analysisPrompt }
        ]
      });
      
      return {
        analysis: response.data.message.content,
        model: response.data.model,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.log(`⚠️ Analysis failed: ${error.message}`);
      return {
        analysis: 'Analysis unavailable due to service error',
        error: error.message
      };
    }
  }

  async handleHumanHandoff(data) {
    console.log(`👤 Human intervention requested for Agent ${data.agent}`);
    console.log(`Reason: ${data.reason}`);
    console.log(`URL: ${data.currentUrl}`);
    
    // Add to human intervention queue
    this.humanInterventionQueue.push({
      ...data,
      requestTime: new Date().toISOString()
    });
    
    // In a real system, this would:
    // 1. Send notifications to human operators
    // 2. Provide a web interface for human intervention
    // 3. Wait for human response
    // 4. Resume agent execution
    
    // For now, simulate human intervention after a delay
    console.log(`⏳ Simulating human intervention for Agent ${data.agent}...`);
    
    // Wait for human intervention (simulated)
    await this.wait(5000);
    
    console.log(`✅ Human intervention completed for Agent ${data.agent}`);
    
    return {
      success: true,
      message: 'Human completed required action',
      timestamp: new Date().toISOString()
    };
  }

  handleTaskComplete(agentId, result) {
    console.log(`🎉 Agent ${agentId} completed task successfully`);
    
    // Store completion in Companion service
    this.storeTaskCompletion(agentId, result).catch(err => {
      console.log(`⚠️ Failed to store task completion: ${err.message}`);
    });
  }

  async storeTaskCompletion(agentId, result) {
    try {
      // Create agent record in Companion service
      const agentData = {
        name: `AutonomousAgent-${agentId}`,
        type: 'browser',
        capabilities: ['web_automation', 'captcha_handling', 'human_handoff'],
        configuration: {
          headless: false,
          useVision: true
        }
      };
      
      const agentResponse = await axios.post(`${this.services.companion}/cua/agents`, agentData);
      const companionAgentId = agentResponse.data.id;
      
      // Store task result
      const taskData = {
        task: `Autonomous task executed by ${agentId}`,
        options: {
          result: result,
          timestamp: new Date().toISOString()
        },
        priority: 2
      };
      
      await axios.post(`${this.services.companion}/cua/agents/${companionAgentId}/tasks`, taskData);
      
      console.log(`📝 Task completion stored in Companion service`);
      
    } catch (error) {
      console.log(`⚠️ Failed to store in Companion: ${error.message}`);
    }
  }

  async getSystemStatus() {
    const agentStatuses = [];
    
    for (const [id, agent] of this.agents) {
      const status = await agent.getStatus();
      agentStatuses.push(status);
    }
    
    return {
      totalAgents: this.agents.size,
      agents: agentStatuses,
      humanInterventionQueue: this.humanInterventionQueue.length,
      taskQueue: this.taskQueue.length,
      services: await this.checkServiceHealth()
    };
  }

  async checkServiceHealth() {
    const health = {};
    
    for (const [name, url] of Object.entries(this.services)) {
      try {
        const response = await axios.get(`${url}/health`, { timeout: 2000 });
        health[name] = {
          status: 'healthy',
          response: response.data
        };
      } catch (error) {
        health[name] = {
          status: 'unhealthy',
          error: error.message
        };
      }
    }
    
    return health;
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async shutdown() {
    console.log(`🔒 Shutting down Agent Coordinator`);
    
    for (const [id, agent] of this.agents) {
      await agent.close();
    }
    
    this.agents.clear();
    console.log(`✅ All agents closed`);
  }
}

module.exports = AgentCoordinator;

// CLI usage
if (require.main === module) {
  async function demo() {
    const coordinator = new AgentCoordinator();
    
    try {
      console.log(`🚀 Starting Agent Coordinator Demo`);
      
      // Test coordinated task execution
      const result = await coordinator.executeCoordinatedTask(
        'Search Alibaba for wireless earbuds and analyze pricing for dropshipping'
      );
      
      console.log(`\n🎯 Final Result:`, JSON.stringify(result, null, 2));
      
      // Show system status
      const status = await coordinator.getSystemStatus();
      console.log(`\n📊 System Status:`, JSON.stringify(status, null, 2));
      
    } catch (error) {
      console.error('Demo failed:', error);
    } finally {
      await coordinator.shutdown();
    }
  }

  demo();
}