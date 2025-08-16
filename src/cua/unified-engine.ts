import { chromium, Browser, Page, BrowserContext } from 'playwright';
import OpenAI from 'openai';
import { DB } from '../db';
import { agents, tasks, memory } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Unified CUA Engine - Production Ready
 * Combines browser automation, AI intelligence, and database persistence
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

export interface TaskResult {
  success: boolean;
  result?: any;
  error?: string;
  screenshot?: string;
  duration: number;
  action?: string;
  confidence?: number;
}

export interface AIAction {
  action: string;
  target?: string;
  value?: string;
  confidence: number;
  reasoning: string;
}

export class UnifiedCUAEngine {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private ai: OpenAI | null = null;
  private db: DB;
  private agentId: string;
  private config: CUAConfig;
  private isInitialized = false;

  constructor(db: DB, agentId: string, config: CUAConfig = {}) {
    this.db = db;
    this.agentId = agentId;
    this.config = {
      headless: false,
      useVision: true,
      maxAttempts: 5,
      timeout: 30000,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      model: 'mistralai/mistral-small-3.2-24b-instruct:free',
      visionModel: 'moonshotai/kimi-vl-a3b-thinking:free',
      ...config
    };
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🚀 Initializing Unified CUA Engine...');

    // Initialize AI client
    this.ai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1'
    });

    // Launch browser with anti-detection
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    // Create context with human-like behavior
    this.context = await this.browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent: this.config.userAgent,
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation']
    });

    // Anti-detection measures
    await this.context.addInitScript(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      
      // Mock plugins
      Object.defineProperty(navigator, 'plugins', { 
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' }
        ]
      });
      
      // Mock chrome object
      (globalThis as any).chrome = { 
        runtime: { onConnect: {}, onMessage: {} } 
      };
    });

    this.page = await this.context.newPage();
    this.isInitialized = true;
    
    console.log('✅ Unified CUA Engine initialized successfully');
  }

  async executeTask(taskDescription: string): Promise<TaskResult> {
    if (!this.isInitialized) await this.init();
    
    console.log(`\n🎯 Executing: ${taskDescription}`);
    
    const startTime = Date.now();
    
    try {
      // Update agent status to busy
      await this.updateAgentStatus('busy');
      
      // Analyze task with AI
      const action = await this.analyzeTask(taskDescription);
      
      // Execute action
      const result = await this.executeAction(action);
      
      // Store in memory
      await this.storeMemory('task_result', {
        task: taskDescription,
        action,
        result,
        timestamp: new Date().toISOString()
      });

      const duration = Date.now() - startTime;
      
      // Update agent status to idle
      await this.updateAgentStatus('idle');
      
      return {
        success: true,
        result,
        action: action.action,
        confidence: action.confidence,
        duration
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('Task execution failed:', error);
      
      // Update agent status to error
      await this.updateAgentStatus('error');
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      };
    }
  }

  private async analyzeTask(taskDescription: string): Promise<AIAction> {
    if (!this.ai) throw new Error('AI client not initialized');
    
    const prompt = `
You are an AI assistant that helps control a web browser. Analyze the following task and determine the best action to take.

Task: ${taskDescription}

Available actions:
- navigate: Go to a specific URL
- click: Click on an element
- type: Type text into an input field
- wait: Wait for a specific condition
- scroll: Scroll the page
- screenshot: Take a screenshot

Respond with a JSON object containing:
{
  "action": "the action to take",
  "target": "target element or URL (if applicable)",
  "value": "value to use (if applicable)",
  "confidence": 0.95,
  "reasoning": "explanation of your decision"
}
`;

    const response = await this.ai.chat.completions.create({
      model: this.config.model!,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from AI');
    
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse AI response: ${content}`);
    }
  }

  private async executeAction(action: AIAction): Promise<any> {
    if (!this.page) throw new Error('Browser page not initialized');
    
    switch (action.action.toLowerCase()) {
      case 'navigate':
        if (!action.target) throw new Error('Navigation target required');
        await this.page.goto(action.target, { waitUntil: 'networkidle' });
        return { url: action.target, title: await this.page.title() };
        
      case 'click':
        if (!action.target) throw new Error('Click target required');
        await this.page.click(action.target);
        return { clicked: action.target };
        
      case 'type':
        if (!action.target || !action.value) throw new Error('Type target and value required');
        await this.page.type(action.target, action.value);
        return { typed: action.value, into: action.target };
        
      case 'wait':
        await this.page.waitForTimeout(2000);
        return { waited: '2 seconds' };
        
      case 'scroll':
        await this.page.evaluate(() => {
          document.body.scrollTop += 500;
        });
        return { scrolled: 'down 500px' };
        
      case 'screenshot':
        const screenshot = await this.page.screenshot({ type: 'png' });
        return { screenshot: screenshot.toString('base64') };
        
      default:
        throw new Error(`Unknown action: ${action.action}`);
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.isInitialized = false;
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  private async updateAgentStatus(status: string): Promise<void> {
    try {
      await this.db.update(agents)
        .set({ 
          status,
          last_active: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .where(eq(agents.id, this.agentId));
    } catch (error) {
      console.error('Error updating agent status:', error);
    }
  }

  async storeMemory(type: string, data: any): Promise<void> {
    try {
      await this.db.insert(memory).values({
        id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        agent_id: this.agentId,
        type,
        data: JSON.stringify(data),
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error storing memory:', error);
    }
  }

  async getMemory(): Promise<any[]> {
    try {
      return await this.db.select()
        .from(memory)
        .where(eq(memory.agent_id, this.agentId))
        .orderBy(memory.created_at);
    } catch (error) {
      console.error('Error retrieving memory:', error);
      return [];
    }
  }

  async getMemoryById(id: string): Promise<any> {
    try {
      const result = await this.db.select()
        .from(memory)
        .where(eq(memory.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error retrieving specific memory:', error);
      return null;
    }
  }
}
