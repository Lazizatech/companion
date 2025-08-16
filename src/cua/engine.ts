import { chromium, Browser, Page, BrowserContext } from 'playwright';
import OpenAI from 'openai';
import { DB, Agent, Task, Memory } from '../db';

/**
 * Unified CUA Engine - Single, Clean Implementation
 * Combines browser control, LLM decision making, and vision capabilities
 */

export interface CUAConfig {
  headless?: boolean;
  useVision?: boolean;
  maxAttempts?: number;
  timeout?: number;
  userAgent?: string;
}

export interface TaskResult {
  success: boolean;
  result?: any;
  error?: string;
  screenshot?: string;
  duration: number;
}

export class CUAEngine {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private ai: OpenAI | null = null;
  private db: DB;
  private agentId: string;
  private config: CUAConfig;
  private memory: Map<string, any> = new Map();

  constructor(db: DB, agentId: string, config: CUAConfig = {}) {
    this.db = db;
    this.agentId = agentId;
    this.config = {
      headless: false,
      useVision: true,
      maxAttempts: 5,
      timeout: 30000,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...config
    };
  }

  async init() {
    // Initialize AI client
    this.ai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1'
    });

    // Initialize browser
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    // Create context with anti-detection
    this.context = await this.browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent: this.config.userAgent,
      locale: 'en-US',
      timezoneId: 'America/New_York'
    });

    // Add anti-detection scripts
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { 
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' }
        ]
      });
      window.chrome = { runtime: { onConnect: {}, onMessage: {} } };
    });

    this.page = await this.context.newPage();
    
    // Load memory from database
    await this.loadMemory();
  }

  async executeTask(taskDescription: string): Promise<TaskResult> {
    const startTime = Date.now();
    
    try {
      // Update task status
      await this.updateTaskStatus('running', new Date().toISOString());

      // Analyze task with AI
      const action = await this.analyzeTask(taskDescription);
      
      // Execute action
      const result = await this.executeAction(action);
      
      // Save to memory
      await this.saveToMemory('behavior_patterns', {
        task: taskDescription,
        action,
        result,
        timestamp: new Date().toISOString()
      });

      const duration = Date.now() - startTime;
      
      // Update task status
      await this.updateTaskStatus('completed', undefined, result, duration);

      return {
        success: true,
        result,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Update task status
      await this.updateTaskStatus('failed', undefined, undefined, duration, error.message);

      return {
        success: false,
        error: error.message,
        duration
      };
    }
  }

  private async analyzeTask(taskDescription: string) {
    if (!this.ai || !this.page) throw new Error('CUA not initialized');

    // Get page context
    const pageInfo = await this.page.evaluate(() => ({
      title: document.title,
      url: window.location.href,
      text: document.body.innerText.substring(0, 1000),
      links: Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.innerText.trim(),
        href: a.href,
        visible: a.offsetParent !== null
      })).filter(l => l.text && l.visible).slice(0, 10)
    }));

    // Get memory context
    const memoryContext = Array.from(this.memory.entries())
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(', ');

    // Try vision model first if enabled
    if (this.config.useVision) {
      try {
        const screenshot = await this.page.screenshot({ encoding: 'base64' });
        
        const response = await this.ai.chat.completions.create({
          model: 'moonshotai/kimi-vl-a3b-thinking:free',
          messages: [
            {
              role: 'system',
              content: 'You are an AI browser agent. Analyze the screen and decide what to do next. Respond with valid JSON.'
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `${taskDescription}\n\nPage Info: ${JSON.stringify(pageInfo)}\nMemory: ${memoryContext}`
                },
                {
                  type: 'image_url',
                  image_url: { url: `data:image/png;base64,${screenshot}` }
                }
              ]
            }
          ],
          response_format: { type: 'json_object' },
          max_tokens: 400
        });

        return JSON.parse(response.choices[0].message.content);
      } catch (error) {
        console.log('Vision model failed, falling back to text analysis');
      }
    }

    // Fallback to text analysis
    const response = await this.ai.chat.completions.create({
      model: 'mistralai/mistral-small-3.2-24b-instruct:free',
      messages: [
        {
          role: 'system',
          content: 'You are an AI browser agent. Analyze the page and decide what to do next. Respond with valid JSON.'
        },
        {
          role: 'user',
          content: `${taskDescription}\n\nPage Info: ${JSON.stringify(pageInfo)}\nMemory: ${memoryContext}`
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 300
    });

    return JSON.parse(response.choices[0].message.content);
  }

  private async executeAction(action: any) {
    if (!this.page) throw new Error('Page not initialized');

    console.log(`Executing: ${action.action}`);

    switch (action.action) {
      case 'click':
        if (action.coordinates) {
          await this.page.mouse.click(action.coordinates.x, action.coordinates.y);
        } else if (action.text) {
          await this.page.click(`text="${action.text}"`);
        } else if (action.selector) {
          await this.page.click(action.selector);
        }
        break;

      case 'type':
        if (action.selector) {
          await this.page.fill(action.selector, action.text);
        } else {
          await this.page.keyboard.type(action.text);
        }
        break;

      case 'search':
        await this.page.fill('input[name="q"]', action.query);
        await this.page.press('input[name="q"]', 'Enter');
        break;

      case 'navigate':
        await this.page.goto(action.url, { waitUntil: 'networkidle' });
        break;

      case 'scroll':
        await this.page.mouse.wheel(0, action.distance || 300);
        break;

      case 'wait':
        await this.page.waitForTimeout(action.duration || 2000);
        break;

      default:
        throw new Error(`Unknown action: ${action.action}`);
    }

    // Wait after action
    await this.page.waitForTimeout(1000);
  }

  private async loadMemory() {
    const memories = await this.db.select().from(this.db.memory).where(
      this.db.eq(this.db.memory.agent_id, this.agentId)
    );

    for (const mem of memories) {
      this.memory.set(mem.memory_type, JSON.parse(mem.data));
    }
  }

  private async saveToMemory(type: string, data: any) {
    this.memory.set(type, data);
    
    await this.db.insert(this.db.memory).values({
      agent_id: this.agentId,
      memory_type: type,
      data: JSON.stringify(data),
      created_at: new Date().toISOString()
    });
  }

  private async updateTaskStatus(
    status: string, 
    startedAt?: string, 
    result?: any, 
    duration?: number,
    error?: string
  ) {
    const updateData: any = { status };
    
    if (startedAt) updateData.started_at = startedAt;
    if (result) updateData.result = JSON.stringify(result);
    if (duration) updateData.completed_at = new Date().toISOString();
    if (error) updateData.error = error;

    await this.db.update(this.db.tasks)
      .set(updateData)
      .where(this.db.eq(this.db.tasks.agent_id, this.agentId));
  }

  async close() {
    if (this.page) await this.page.close();
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
  }
}
