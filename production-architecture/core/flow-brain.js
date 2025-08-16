#!/usr/bin/env node

/**
 * Flow Brain - Traffic cop for automation
 * 
 * Watches step-by-step execution, detects stalls, and decides whether to:
 * - Retry with different approach
 * - Switch models/strategies  
 * - Present intentional handoff options to human
 * - Persist context for resume
 */

const axios = require('axios');

class FlowBrain {
  constructor(options = {}) {
    this.id = Date.now().toString();
    this.context = {
      task: null,
      currentStep: 0,
      totalSteps: 0,
      attemptHistory: [],
      modelHistory: [],
      selectorHistory: [],
      failurePatterns: [],
      successPatterns: [],
      pageStates: [],
      userPreferences: {}
    };
    
    this.models = {
      coding: ['qwen/qwen3-coder:free', 'deepseek/deepseek-chat-v3-0324:free'],
      general: ['mistralai/mistral-small-3.2-24b-instruct:free', 'openai/gpt-oss-20b:free'],
      vision: ['moonshotai/kimi-vl-a3b-thinking:free'],
      reasoning: ['deepseek/deepseek-r1-0528:free', 'tngtech/deepseek-r1t2-chimera:free']
    };
    
    this.strategies = {
      selectorStrategies: [
        'exact_text_match',
        'partial_text_match', 
        'aria_label_match',
        'placeholder_match',
        'css_selector_match',
        'xpath_fallback'
      ],
      retryStrategies: [
        'wait_and_retry',
        'refresh_and_retry',
        'alternative_selector',
        'human_verification',
        'model_switch'
      ]
    };
    
    this.maxRetries = 3;
    this.maxModelSwitches = 5;
    this.handoffCallback = options.onHandoff || null;
  }

  async executeFlow(task, agent) {
    console.log(`🧠 Flow Brain ${this.id} orchestrating: ${task.description}`);
    
    this.context.task = task;
    this.context.currentStep = 0;
    this.context.totalSteps = task.steps?.length || 1;
    
    try {
      const result = await this.orchestrateExecution(task, agent);
      
      // Learn from success
      this.learnFromSuccess(result);
      
      return {
        success: true,
        result,
        context: this.context,
        brain: this.id
      };
      
    } catch (error) {
      console.error(`💥 Flow Brain orchestration failed:`, error.message);
      
      // Learn from failure
      this.learnFromFailure(error);
      
      return {
        success: false,
        error: error.message,
        context: this.context,
        brain: this.id
      };
    }
  }

  async orchestrateExecution(task, agent) {
    console.log(`🎯 Orchestrating execution with context awareness`);
    
    let currentAttempt = 0;
    let lastError = null;
    
    while (currentAttempt < this.maxRetries) {
      try {
        // Capture page state before attempt
        const pageState = await this.capturePageState(agent);
        this.context.pageStates.push(pageState);
        
        // Choose optimal model/strategy based on context
        const strategy = this.chooseStrategy(currentAttempt, lastError);
        console.log(`🔧 Using strategy: ${strategy.name} (attempt ${currentAttempt + 1})`);
        
        // Execute with chosen strategy
        const result = await this.executeWithStrategy(task, agent, strategy);
        
        if (result.success) {
          console.log(`✅ Flow Brain: Success with ${strategy.name}`);
          return result;
        } else {
          lastError = result.error;
          currentAttempt++;
          
          // Decide if we should continue or hand off
          const decision = await this.decideOnFailure(result, currentAttempt, strategy);
          
          if (decision.action === 'handoff') {
            return await this.initiateHandoff(decision);
          } else if (decision.action === 'abort') {
            throw new Error(`Flow Brain decided to abort: ${decision.reason}`);
          }
          
          // Continue to next attempt with learned context
        }
        
      } catch (error) {
        lastError = error;
        currentAttempt++;
        
        if (currentAttempt >= this.maxRetries) {
          throw error;
        }
        
        console.log(`⚠️ Flow Brain: Attempt ${currentAttempt} failed, analyzing...`);
      }
    }
    
    throw new Error(`Flow Brain exhausted all retry strategies`);
  }

  chooseStrategy(attemptNumber, lastError) {
    // Intelligent strategy selection based on context
    const context = this.context;
    const task = context.task;
    
    // First attempt: Use optimal model for task type
    if (attemptNumber === 0) {
      if (task.description.toLowerCase().includes('search')) {
        return {
          name: 'search_optimized',
          model: this.models.general[0],
          selectorStrategy: 'placeholder_match',
          prompt: this.buildSearchOptimizedPrompt(task)
        };
      } else if (task.description.toLowerCase().includes('code')) {
        return {
          name: 'code_optimized', 
          model: this.models.coding[0],
          selectorStrategy: 'css_selector_match',
          prompt: this.buildCodeOptimizedPrompt(task)
        };
      } else {
        return {
          name: 'general_purpose',
          model: this.models.general[0],
          selectorStrategy: 'exact_text_match',
          prompt: this.buildGeneralPrompt(task)
        };
      }
    }
    
    // Second attempt: Switch model, keep strategy
    if (attemptNumber === 1) {
      return {
        name: 'model_switch',
        model: this.getNextUntriedModel(),
        selectorStrategy: 'aria_label_match',
        prompt: this.buildAlternativePrompt(task, lastError)
      };
    }
    
    // Third attempt: Reasoning model with error context
    return {
      name: 'reasoning_with_context',
      model: this.models.reasoning[0],
      selectorStrategy: 'xpath_fallback',
      prompt: this.buildReasoningPrompt(task, context.attemptHistory)
    };
  }

  async executeWithStrategy(task, agent, strategy) {
    console.log(`⚡ Executing with model: ${strategy.model}`);
    
    // Record attempt
    this.context.attemptHistory.push({
      strategy: strategy.name,
      model: strategy.model,
      timestamp: new Date().toISOString(),
      prompt: strategy.prompt
    });
    
    try {
      // Call agent with specific strategy
      const result = await agent.executeTask(task.description);
      
      // Enhance result with Flow Brain metadata
      return {
        ...result,
        strategy: strategy.name,
        model: strategy.model,
        confidence: this.calculateConfidence(result, strategy),
        brain_analysis: this.analyzeResult(result)
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        strategy: strategy.name,
        model: strategy.model
      };
    }
  }

  async decideOnFailure(result, attemptNumber, strategy) {
    const error = result.error || 'Unknown error';
    
    // Analyze error pattern
    const errorPattern = this.classifyError(error);
    console.log(`🔍 Flow Brain: Classified error as ${errorPattern}`);
    
    // Check if we've seen this pattern before
    const seenBefore = this.context.failurePatterns.includes(errorPattern);
    
    // Decision logic
    if (errorPattern === 'captcha_detected') {
      return {
        action: 'handoff',
        reason: 'CAPTCHA detected - human verification required',
        options: ['solve_captcha', 'try_different_approach', 'abort_task'],
        context: { errorPattern, attemptNumber }
      };
    }
    
    if (errorPattern === 'selector_not_found' && attemptNumber < 2) {
      return {
        action: 'retry',
        reason: 'Selector not found - trying alternative approach',
        modifications: ['use_different_selector', 'wait_longer', 'refresh_page']
      };
    }
    
    if (errorPattern === 'timeout' && !seenBefore) {
      return {
        action: 'retry', 
        reason: 'Timeout - will retry with increased wait time',
        modifications: ['increase_timeout', 'check_network']
      };
    }
    
    if (attemptNumber >= 2) {
      return {
        action: 'handoff',
        reason: `Multiple failures detected (${attemptNumber + 1} attempts)`,
        options: ['manual_intervention', 'change_strategy', 'abort_task'],
        context: { 
          errorPattern, 
          attemptNumber,
          previousAttempts: this.context.attemptHistory
        }
      };
    }
    
    return {
      action: 'retry',
      reason: 'Retryable error - continuing with next strategy'
    };
  }

  async initiateHandoff(decision) {
    console.log(`👤 Flow Brain: Initiating human handoff`);
    console.log(`Reason: ${decision.reason}`);
    
    const handoffData = {
      brain: this.id,
      decision,
      context: this.context,
      task: this.context.task,
      timestamp: new Date().toISOString(),
      options: decision.options || ['continue', 'modify_approach', 'abort']
    };
    
    if (this.handoffCallback) {
      console.log(`🔄 Presenting options to human:`);
      decision.options?.forEach((option, i) => {
        console.log(`  ${i + 1}. ${option.replace('_', ' ')}`);
      });
      
      const humanChoice = await this.handoffCallback(handoffData);
      return this.resumeFromHandoff(humanChoice);
    } else {
      // Default behavior - structured pause
      console.log(`⏸️ Flow Brain paused. Options available:`);
      decision.options?.forEach(option => console.log(`  - ${option}`));
      
      return {
        success: false,
        paused_for_human: true,
        handoff_data: handoffData,
        resume_token: this.generateResumeToken()
      };
    }
  }

  async resumeFromHandoff(humanChoice) {
    console.log(`🔄 Flow Brain: Resuming from human choice: ${humanChoice.action}`);
    
    switch (humanChoice.action) {
      case 'continue':
        return { success: true, resumed: true, human_action: 'continue' };
      
      case 'modify_approach':
        // Human provided new strategy
        this.context.userPreferences.preferredStrategy = humanChoice.strategy;
        return { success: true, resumed: true, human_action: 'modified', strategy: humanChoice.strategy };
      
      case 'abort':
        return { success: false, aborted_by_human: true };
      
      default:
        return { success: true, resumed: true, human_action: humanChoice.action };
    }
  }

  // Learning and context methods
  learnFromSuccess(result) {
    if (result.strategy) {
      this.context.successPatterns.push({
        strategy: result.strategy,
        model: result.model,
        task_type: this.classifyTaskType(this.context.task),
        timestamp: new Date().toISOString()
      });
    }
  }

  learnFromFailure(error) {
    const pattern = this.classifyError(error.message);
    if (!this.context.failurePatterns.includes(pattern)) {
      this.context.failurePatterns.push(pattern);
    }
  }

  classifyError(errorMessage) {
    const error = errorMessage.toLowerCase();
    
    if (error.includes('captcha') || error.includes('recaptcha')) return 'captcha_detected';
    if (error.includes('timeout')) return 'timeout';
    if (error.includes('not found') || error.includes('selector')) return 'selector_not_found';
    if (error.includes('network') || error.includes('connection')) return 'network_error';
    if (error.includes('permission') || error.includes('access denied')) return 'permission_error';
    
    return 'unknown_error';
  }

  classifyTaskType(task) {
    const desc = task.description.toLowerCase();
    if (desc.includes('search')) return 'search';
    if (desc.includes('login') || desc.includes('sign in')) return 'authentication';
    if (desc.includes('form') || desc.includes('submit')) return 'form_interaction';
    if (desc.includes('click') || desc.includes('button')) return 'navigation';
    return 'general';
  }

  getNextUntriedModel() {
    const tried = this.context.modelHistory;
    const allModels = [...this.models.general, ...this.models.coding, ...this.models.reasoning];
    
    for (const model of allModels) {
      if (!tried.includes(model)) {
        this.context.modelHistory.push(model);
        return model;
      }
    }
    
    // If all tried, use best performing
    return this.models.general[0];
  }

  calculateConfidence(result, strategy) {
    let confidence = 0.5; // Base confidence
    
    // Boost confidence for successful results
    if (result.success) confidence += 0.3;
    
    // Boost for strategies that worked before
    const successfulStrategies = this.context.successPatterns.map(p => p.strategy);
    if (successfulStrategies.includes(strategy.name)) confidence += 0.2;
    
    // Reduce for failed models
    const failedModels = this.context.attemptHistory
      .filter(a => !a.success)
      .map(a => a.model);
    if (failedModels.includes(strategy.model)) confidence -= 0.1;
    
    return Math.max(0, Math.min(1, confidence));
  }

  analyzeResult(result) {
    return {
      likely_success: result.success,
      error_pattern: result.error ? this.classifyError(result.error) : null,
      recommended_next_action: result.success ? 'continue' : 'retry_with_modification'
    };
  }

  async capturePageState(agent) {
    try {
      return {
        url: await agent.cua.page.url(),
        title: await agent.cua.page.title(),
        timestamp: new Date().toISOString(),
        screenshot: await agent.cua.screenshot()
      };
    } catch (error) {
      return { error: error.message, timestamp: new Date().toISOString() };
    }
  }

  // Prompt builders for different strategies
  buildSearchOptimizedPrompt(task) {
    return `You are a search automation specialist. ${task.description}

SEARCH STRATEGY:
1. Identify the main search input (prioritize: placeholder text, aria-labels, name attributes)
2. Use exact search terms from the task
3. Submit search (Enter key or search button)

SELECTORS TO TRY:
- input[placeholder*="search" i]
- input[name*="search" i] 
- input[type="search"]
- textarea[title*="search" i]

RESPOND WITH THE OPTIMAL SEARCH ACTION.`;
  }

  buildCodeOptimizedPrompt(task) {
    return `You are a web automation engineer. ${task.description}

ENGINEERING APPROACH:
1. Analyze DOM structure methodically
2. Use robust selectors (prefer data attributes, IDs, then classes)
3. Handle dynamic content with appropriate waits

RELIABLE SELECTORS:
- [data-testid]
- #unique-ids
- .specific-classes
- CSS combinators

BUILD PRECISE, MAINTAINABLE AUTOMATION.`;
  }

  buildGeneralPrompt(task) {
    return `You are a web automation agent. ${task.description}

GENERAL APPROACH:
1. Understand the current page context
2. Identify target elements using multiple strategies
3. Execute actions with error handling

RESPOND WITH THE MOST APPROPRIATE ACTION.`;
  }

  buildAlternativePrompt(task, lastError) {
    return `PREVIOUS ATTEMPT FAILED: ${lastError}

${task.description}

ALTERNATIVE APPROACH:
1. Try different selectors than previous attempt
2. Consider waiting for dynamic content
3. Use text-based matching if CSS selectors fail

AVOID THE PREVIOUS FAILURE PATTERN.`;
  }

  buildReasoningPrompt(task, attemptHistory) {
    return `TASK: ${task.description}

PREVIOUS ATTEMPTS: ${JSON.stringify(attemptHistory, null, 2)}

REASONING REQUIRED:
1. Analyze why previous attempts failed
2. Identify patterns in the failures
3. Choose a fundamentally different approach
4. Consider if the task needs human intervention

PROVIDE REASONED SOLUTION OR RECOMMEND HANDOFF.`;
  }

  generateResumeToken() {
    return `${this.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Persistence methods for resuming across sessions
  exportContext() {
    return {
      brain: this.id,
      context: this.context,
      timestamp: new Date().toISOString()
    };
  }

  importContext(exportedContext) {
    this.context = exportedContext.context;
    console.log(`🧠 Flow Brain: Restored context from ${exportedContext.timestamp}`);
  }
}

module.exports = FlowBrain;

// CLI demo
if (require.main === module) {
  async function demo() {
    const FlowBrain = require('./flow-brain.js');
    
    const brain = new FlowBrain({
      onHandoff: async (handoffData) => {
        console.log('\n👤 HUMAN HANDOFF REQUESTED:');
        console.log('Options:', handoffData.options);
        
        // Simulate human choice
        return { action: 'continue', strategy: 'user_guided' };
      }
    });

    const mockTask = {
      description: 'Search Google for hasan mohammed',
      steps: [
        { action: 'navigate', target: 'https://google.com' },
        { action: 'search', query: 'hasan mohammed' }
      ]
    };

    const mockAgent = {
      executeTask: async (desc) => {
        // Simulate different outcomes for demo
        if (Math.random() > 0.7) {
          return { success: true, action: 'search_completed' };
        } else {
          throw new Error('Timeout waiting for search input');
        }
      },
      cua: {
        page: {
          url: () => 'https://google.com',
          title: () => 'Google'
        },
        screenshot: () => 'base64_screenshot_data'
      }
    };

    try {
      const result = await brain.executeFlow(mockTask, mockAgent);
      console.log('\n🎉 Flow Brain Demo Result:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Demo failed:', error);
    }
  }

  demo();
}