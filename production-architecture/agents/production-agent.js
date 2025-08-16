#!/usr/bin/env node

/**
 * Production-Ready Agent
 * 
 * Integrates:
 * - Flow Brain for intelligent orchestration
 * - Human Handoff API for state persistence
 * - Model exhaustion before fallback
 * - Role-scoped prompts with domain expertise
 * - Intentional pauses with user choice
 */

const DefinitiveCUA = require('./cua.js');
const FlowBrain = require('./flow-brain.js');
const HumanHandoffAPI = require('./human-handoff-api.js');

class ProductionAgent {
  constructor(options = {}) {
    this.id = `prod_agent_${Date.now()}`;
    this.cua = new DefinitiveCUA({
      headless: options.headless || false,
      useVision: options.useVision || true
    });
    
    // Initialize Flow Brain with handoff integration
    this.brain = new FlowBrain({
      onHandoff: (data) => this.handleIntelligentHandoff(data)
    });
    
    // Start Human Handoff API if needed
    this.handoffAPI = new HumanHandoffAPI({ port: 9000 });
    this.handoffAPI.start();
    
    this.state = 'initialized';
    this.executionLog = [];
    
    console.log(`🚀 Production Agent ${this.id} initialized`);
    console.log(`📊 Dashboard: http://localhost:9000/dashboard`);
  }

  async init() {
    console.log(`🤖 Initializing Production Agent ${this.id}`);
    await this.cua.init();
    this.state = 'ready';
    console.log(`✅ Production Agent ready - browser visible`);
  }

  async executeProductionTask(taskDescription, options = {}) {
    console.log(`\n🎯 Production Agent executing: ${taskDescription}`);
    
    this.state = 'executing';
    
    const task = {
      description: taskDescription,
      urgency: options.urgency || 'normal',
      domain: this.detectDomain(taskDescription),
      expectedSteps: options.expectedSteps || this.estimateSteps(taskDescription),
      maxRetries: options.maxRetries || 3,
      humanApprovalRequired: options.humanApprovalRequired || false
    };

    // Log task start
    this.logExecution('task_started', { task, timestamp: new Date().toISOString() });

    try {
      // Pre-execution approval for sensitive tasks
      if (task.humanApprovalRequired) {
        const approval = await this.requestHumanApproval(task);
        if (!approval.approved) {
          return { success: false, reason: 'Human approval denied', approval };
        }
      }

      // Execute with Flow Brain orchestration
      const result = await this.brain.executeFlow(task, this);
      
      this.state = 'completed';
      this.logExecution('task_completed', { result, timestamp: new Date().toISOString() });

      return {
        success: true,
        result,
        agent: this.id,
        execution_log: this.executionLog,
        brain_context: this.brain.exportContext()
      };

    } catch (error) {
      this.state = 'failed';
      this.logExecution('task_failed', { error: error.message, timestamp: new Date().toISOString() });

      console.error(`💥 Production Agent task failed:`, error.message);
      
      return {
        success: false,
        error: error.message,
        agent: this.id,
        execution_log: this.executionLog,
        recovery_options: this.generateRecoveryOptions(error)
      };
    }
  }

  async handleIntelligentHandoff(handoffData) {
    console.log(`🧠 Flow Brain requesting intelligent handoff`);
    
    // Classify the handoff type and urgency
    const classification = this.classifyHandoff(handoffData);
    
    // Create handoff via API
    const handoffRequest = {
      brain_id: this.brain.id,
      reason: handoffData.decision.reason,
      task: handoffData.task,
      context: handoffData.context,
      options: handoffData.decision.options,
      urgency: classification.urgency,
      screenshot: await this.captureScreenshot(),
      page_state: await this.capturePageState(),
      classification
    };

    try {
      const response = await fetch('http://localhost:9000/api/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(handoffRequest)
      });

      const handoffResult = await response.json();
      
      console.log(`👤 Handoff created: ${handoffResult.handoff_id}`);
      console.log(`🌐 Web interface: ${handoffResult.web_interface}`);

      // Wait for human response with intelligent timeout
      const humanResponse = await this.waitForHumanResponse(
        handoffResult.handoff_id, 
        classification.timeoutMs
      );

      return {
        success: true,
        human_action: humanResponse.action,
        handoff_id: handoffResult.handoff_id,
        response: humanResponse
      };

    } catch (error) {
      console.error(`❌ Handoff creation failed:`, error.message);
      
      // Fallback to local prompt if API fails
      return await this.fallbackLocalHandoff(handoffData);
    }
  }

  classifyHandoff(handoffData) {
    const reason = handoffData.decision.reason.toLowerCase();
    
    if (reason.includes('captcha')) {
      return {
        type: 'captcha_intervention',
        urgency: 'urgent',
        timeoutMs: 5 * 60 * 1000, // 5 minutes
        autoNotify: ['security_team', 'primary_operator']
      };
    }
    
    if (reason.includes('multiple failures')) {
      return {
        type: 'strategy_consultation',
        urgency: 'high',
        timeoutMs: 15 * 60 * 1000, // 15 minutes
        autoNotify: ['technical_team']
      };
    }
    
    if (reason.includes('selector not found')) {
      return {
        type: 'page_analysis_needed',
        urgency: 'normal',
        timeoutMs: 30 * 60 * 1000, // 30 minutes
        autoNotify: ['qa_team']
      };
    }
    
    return {
      type: 'general_assistance',
      urgency: 'normal',
      timeoutMs: 20 * 60 * 1000, // 20 minutes
      autoNotify: ['default_operators']
    };
  }

  async waitForHumanResponse(handoffId, timeoutMs) {
    const startTime = Date.now();
    const pollInterval = 2000; // Check every 2 seconds
    
    console.log(`⏳ Waiting for human response (timeout: ${timeoutMs/1000}s)`);
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await fetch(`http://localhost:9000/api/handoff/${handoffId}`);
        const handoff = await response.json();
        
        if (handoff.status === 'responded') {
          console.log(`✅ Human response received: ${handoff.human_response.action}`);
          return handoff.human_response;
        }
        
        if (handoff.status === 'expired') {
          throw new Error('Handoff expired before human response');
        }
        
        // Show periodic updates
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        if (elapsed % 30 === 0) { // Every 30 seconds
          console.log(`⏳ Still waiting for human response... (${elapsed}s elapsed)`);
        }
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
      } catch (error) {
        console.log(`⚠️ Error checking handoff status: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }
    
    throw new Error(`Human response timeout after ${timeoutMs/1000} seconds`);
  }

  async fallbackLocalHandoff(handoffData) {
    console.log(`🚨 Using local handoff fallback`);
    console.log(`Reason: ${handoffData.decision.reason}`);
    console.log(`Options: ${handoffData.decision.options.join(', ')}`);
    
    // In production, this could show a system notification
    // For now, return a default safe action
    return {
      success: true,
      human_action: 'continue',
      fallback: true,
      note: 'Used fallback - human handoff API unavailable'
    };
  }

  async requestHumanApproval(task) {
    console.log(`🛡️ Requesting human approval for sensitive task`);
    
    const approvalRequest = {
      brain_id: this.brain.id,
      reason: 'Human approval required for sensitive automation',
      task,
      context: { requires_approval: true },
      options: ['approve', 'deny', 'modify_task'],
      urgency: 'high'
    };

    // Create approval handoff
    try {
      const response = await fetch('http://localhost:9000/api/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(approvalRequest)
      });

      const result = await response.json();
      console.log(`🌐 Approval interface: ${result.web_interface}`);

      const approval = await this.waitForHumanResponse(result.handoff_id, 10 * 60 * 1000);
      
      return {
        approved: approval.action === 'approve',
        action: approval.action,
        comment: approval.comment
      };

    } catch (error) {
      console.error(`❌ Approval request failed:`, error.message);
      return { approved: false, error: error.message };
    }
  }

  // Domain detection for role-scoped prompts
  detectDomain(taskDescription) {
    const task = taskDescription.toLowerCase();
    
    if (task.includes('alibaba') || task.includes('dropship') || task.includes('product')) {
      return 'ecommerce';
    }
    if (task.includes('google') || task.includes('search')) {
      return 'search';
    }
    if (task.includes('form') || task.includes('submit') || task.includes('login')) {
      return 'forms';
    }
    if (task.includes('code') || task.includes('github') || task.includes('programming')) {
      return 'development';
    }
    
    return 'general';
  }

  estimateSteps(taskDescription) {
    const task = taskDescription.toLowerCase();
    
    if (task.includes('search')) return 3; // navigate, search, results
    if (task.includes('login')) return 4; // navigate, username, password, submit
    if (task.includes('form')) return 5; // navigate, fill fields, validate, submit, confirm
    if (task.includes('analyze') || task.includes('extract')) return 6; // complex multi-step
    
    return 3; // default estimate
  }

  generateRecoveryOptions(error) {
    const errorType = this.classifyError(error.message);
    
    const options = {
      timeout: [
        'retry_with_longer_timeout',
        'check_network_connection',
        'try_different_browser_profile'
      ],
      selector_not_found: [
        'refresh_page_and_retry',
        'try_alternative_selectors',
        'manual_element_identification'
      ],
      captcha_detected: [
        'human_captcha_solving',
        'try_different_ip',
        'use_captcha_solving_service'
      ],
      permission_error: [
        'check_authentication',
        'verify_account_permissions',
        'try_incognito_mode'
      ]
    };

    return options[errorType] || [
      'retry_with_different_strategy',
      'request_human_assistance',
      'abort_and_report'
    ];
  }

  classifyError(errorMessage) {
    const error = errorMessage.toLowerCase();
    
    if (error.includes('timeout')) return 'timeout';
    if (error.includes('not found') || error.includes('selector')) return 'selector_not_found';
    if (error.includes('captcha')) return 'captcha_detected';
    if (error.includes('permission') || error.includes('access')) return 'permission_error';
    
    return 'unknown_error';
  }

  async captureScreenshot() {
    try {
      return await this.cua.screenshot();
    } catch (error) {
      return null;
    }
  }

  async capturePageState() {
    try {
      return {
        url: await this.cua.page.url(),
        title: await this.cua.page.title(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  logExecution(event, data) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      data,
      agent: this.id,
      state: this.state
    };
    
    this.executionLog.push(logEntry);
    console.log(`📝 Log: ${event}`, data);
  }

  async close() {
    console.log(`🔒 Closing Production Agent ${this.id}`);
    await this.cua.close();
    this.state = 'closed';
  }

  // Integration with existing agent system
  async executeTask(taskDescription) {
    // Wrapper method for Flow Brain compatibility
    return await this.cua.executeTask(taskDescription);
  }

  // Export execution report for analysis
  exportExecutionReport() {
    return {
      agent: this.id,
      state: this.state,
      execution_log: this.executionLog,
      brain_context: this.brain.exportContext(),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ProductionAgent;

// CLI Demo
if (require.main === module) {
  async function productionDemo() {
    console.log(`🚀 Production Agent Demo Starting`);
    
    const agent = new ProductionAgent({
      headless: false,
      useVision: true
    });

    try {
      await agent.init();
      
      // Demo task with all production features
      const result = await agent.executeProductionTask(
        'Search Google for "hasan mohammed" and capture results',
        {
          urgency: 'normal',
          expectedSteps: 3,
          humanApprovalRequired: false
        }
      );

      console.log(`\n🎉 Production Demo Result:`);
      console.log(JSON.stringify(result, null, 2));

      // Export execution report
      const report = agent.exportExecutionReport();
      console.log(`\n📊 Execution Report:`, JSON.stringify(report, null, 2));

    } catch (error) {
      console.error('Production demo failed:', error);
    } finally {
      await agent.close();
    }
  }

  productionDemo();
}