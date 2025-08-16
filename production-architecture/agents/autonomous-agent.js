#!/usr/bin/env node

/**
 * Autonomous Agent System
 * Handles browser automation with CAPTCHA detection and human handoff
 */

const DefinitiveCUA = require('./cua.js');

class AutonomousAgent {
  constructor(options = {}) {
    this.id = Date.now().toString();
    this.cua = new DefinitiveCUA({
      headless: options.headless || false,
      useVision: options.useVision || true
    });
    this.state = 'idle';
    this.currentTask = null;
    this.humanHandoffCallback = options.onHumanHandoff || null;
    this.taskCompleteCallback = options.onTaskComplete || null;
    this.captchaDetected = false;
    this.waitingForHuman = false;
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  async init() {
    console.log(`🤖 Initializing Autonomous Agent ${this.id}`);
    await this.cua.init();
    this.state = 'ready';
    console.log(`✅ Agent ${this.id} ready for tasks`);
  }

  async executeTask(task) {
    this.currentTask = task;
    this.state = 'working';
    this.retryCount = 0;
    
    console.log(`🎯 Agent ${this.id} executing: ${task.description}`);
    
    try {
      // Step 1: Navigate if URL provided
      if (task.url) {
        await this.navigateWithRetry(task.url);
      }

      // Step 2: Execute main task
      const result = await this.executeTaskWithCaptchaDetection(task);
      
      // Step 3: Handle result
      if (result.success) {
        this.state = 'completed';
        if (this.taskCompleteCallback) {
          this.taskCompleteCallback(this.id, result);
        }
        return result;
      } else {
        throw new Error(result.error || 'Task failed');
      }
      
    } catch (error) {
      console.error(`❌ Agent ${this.id} task failed:`, error.message);
      this.state = 'error';
      return { success: false, error: error.message, agent: this.id };
    }
  }

  async navigateWithRetry(url) {
    for (let i = 0; i < this.maxRetries; i++) {
      try {
        console.log(`📍 Agent ${this.id} navigating to ${url} (attempt ${i + 1})`);
        await this.cua.navigate(url);
        
        // Check for CAPTCHA after navigation
        if (await this.detectCaptcha()) {
          await this.handleCaptcha('Navigation CAPTCHA detected');
        }
        
        return;
      } catch (error) {
        console.log(`⚠️ Navigation attempt ${i + 1} failed: ${error.message}`);
        if (i === this.maxRetries - 1) throw error;
        await this.wait(2000);
      }
    }
  }

  async executeTaskWithCaptchaDetection(task) {
    try {
      // Execute the task
      const result = await this.cua.executeTask(task.description);
      
      // Check for CAPTCHA after task execution
      if (await this.detectCaptcha()) {
        return await this.handleCaptcha('CAPTCHA detected after task execution');
      }
      
      return result;
      
    } catch (error) {
      // Check if error indicates CAPTCHA or human intervention needed
      if (this.isCaptchaError(error)) {
        return await this.handleCaptcha('CAPTCHA error detected');
      }
      throw error;
    }
  }

  async detectCaptcha() {
    try {
      // Take screenshot for analysis
      const screenshot = await this.cua.screenshot();
      
      // Simple CAPTCHA detection - look for common CAPTCHA elements
      const page = this.cua.page;
      
      const captchaSelectors = [
        '.g-recaptcha',
        '#captcha',
        '[class*="captcha"]',
        '[id*="captcha"]',
        '.cf-challenge',
        '.challenge-form',
        'iframe[src*="recaptcha"]'
      ];
      
      for (const selector of captchaSelectors) {
        const element = await page.$(selector);
        if (element) {
          console.log(`🔍 CAPTCHA detected: ${selector}`);
          return true;
        }
      }
      
      // Check for common CAPTCHA text
      const content = await page.content();
      const captchaKeywords = [
        'prove you are human',
        'verify you are human', 
        'recaptcha',
        'cloudflare',
        'security check',
        'robot verification',
        'captcha'
      ];
      
      for (const keyword of captchaKeywords) {
        if (content.toLowerCase().includes(keyword)) {
          console.log(`🔍 CAPTCHA keyword detected: ${keyword}`);
          return true;
        }
      }
      
      return false;
      
    } catch (error) {
      console.log(`⚠️ CAPTCHA detection failed: ${error.message}`);
      return false;
    }
  }

  async handleCaptcha(reason) {
    console.log(`🚨 Agent ${this.id} CAPTCHA detected: ${reason}`);
    this.captchaDetected = true;
    this.waitingForHuman = true;
    this.state = 'waiting_for_human';
    
    // Take screenshot for human reference
    const screenshot = await this.cua.screenshot();
    
    const handoffData = {
      agent: this.id,
      reason,
      screenshot,
      timestamp: new Date().toISOString(),
      currentUrl: await this.cua.page.url(),
      task: this.currentTask
    };
    
    console.log(`👤 Requesting human intervention for Agent ${this.id}`);
    
    if (this.humanHandoffCallback) {
      // Call human handoff callback and wait for response
      const humanResult = await this.humanHandoffCallback(handoffData);
      return this.resumeAfterHuman(humanResult);
    } else {
      // Default behavior - wait and retry
      console.log(`⏳ Agent ${this.id} waiting for manual CAPTCHA resolution...`);
      await this.waitForHumanIntervention();
      return { success: true, human_intervention: true };
    }
  }

  async waitForHumanIntervention(timeoutMs = 60000) {
    const startTime = Date.now();
    
    while (this.waitingForHuman && (Date.now() - startTime) < timeoutMs) {
      // Check if CAPTCHA is still present
      if (!(await this.detectCaptcha())) {
        console.log(`✅ Agent ${this.id} CAPTCHA resolved by human`);
        this.waitingForHuman = false;
        this.captchaDetected = false;
        this.state = 'working';
        return;
      }
      
      await this.wait(2000);
    }
    
    if (this.waitingForHuman) {
      throw new Error('Human intervention timeout');
    }
  }

  resumeAfterHuman(humanResult) {
    console.log(`🔄 Agent ${this.id} resuming after human intervention`);
    this.waitingForHuman = false;
    this.captchaDetected = false;
    this.state = 'working';
    
    if (humanResult && humanResult.success) {
      return { success: true, human_intervention: true, result: humanResult };
    } else {
      return { success: false, error: 'Human intervention failed' };
    }
  }

  isCaptchaError(error) {
    const captchaErrorPatterns = [
      'captcha',
      'recaptcha',
      'cloudflare',
      'access denied',
      'blocked',
      'security check',
      'verification required',
      'prove you are human'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return captchaErrorPatterns.some(pattern => errorMessage.includes(pattern));
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getStatus() {
    return {
      id: this.id,
      state: this.state,
      currentTask: this.currentTask,
      waitingForHuman: this.waitingForHuman,
      captchaDetected: this.captchaDetected,
      retryCount: this.retryCount
    };
  }

  async close() {
    console.log(`🔒 Closing Agent ${this.id}`);
    await this.cua.close();
    this.state = 'closed';
  }
}

module.exports = AutonomousAgent;

// CLI usage example
if (require.main === module) {
  async function demo() {
    const agent = new AutonomousAgent({
      headless: false,
      onHumanHandoff: async (data) => {
        console.log(`👤 Human handoff requested:`, data);
        // In a real system, this would trigger notifications to humans
        return { success: true, message: 'Human completed CAPTCHA' };
      },
      onTaskComplete: (agentId, result) => {
        console.log(`✅ Agent ${agentId} completed task:`, result);
      }
    });

    try {
      await agent.init();
      
      const task = {
        description: 'Search for wireless earbuds',
        url: 'https://alibaba.com'
      };
      
      const result = await agent.executeTask(task);
      console.log('Final result:', result);
      
    } catch (error) {
      console.error('Demo failed:', error);
    } finally {
      await agent.close();
    }
  }

  demo();
}