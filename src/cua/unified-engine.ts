import { chromium, Browser, Page, BrowserContext } from 'playwright';
import OpenAI from 'openai';
import { DB } from '../db';
import { agents, tasks, memory } from '../db/schema';
import { eq } from 'drizzle-orm';
import BrowserStreamServer from '../handoff/browser-stream-server';

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
  handoffSession?: string;
  handoffUrl?: string;
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
  private streamServer: BrowserStreamServer | null = null;
  private currentHandoffSession: string | null = null;

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

    // Launch browser with advanced anti-detection
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection'
      ]
    });

    // Create context with human-like behavior
    this.context = await this.browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent: this.config.userAgent,
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation'],
      geolocation: { longitude: -74.006, latitude: 40.7128 }, // NYC
      colorScheme: 'light'
    });

    // Advanced anti-detection measures
    await this.context.addInitScript(() => {
      // Remove automation indicators
      delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Array;
      delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Promise;
      delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
      
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      
      // Mock plugins with more realistic data
      Object.defineProperty(navigator, 'plugins', { 
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' }
        ]
      });
      
      // Add language and platform
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
      
      // Mock chrome object with more complete implementation
      (window as any).chrome = {
        runtime: {
          onConnect: {},
          onMessage: {},
          sendMessage: () => {},
          connect: () => ({ postMessage: () => {} })
        },
        loadTimes: () => ({
          commitLoadTime: Date.now() / 1000,
          connectionInfo: 'h2',
          finishDocumentLoadTime: Date.now() / 1000,
          finishLoadTime: Date.now() / 1000,
          firstPaintAfterLoadTime: Date.now() / 1000,
          navigationType: 'Other',
          npnNegotiatedProtocol: 'h2',
          requestTime: Date.now() / 1000,
          startLoadTime: Date.now() / 1000,
          wasAlternateProtocolAvailable: false,
          wasFetchedViaSpdy: true,
          wasNpnNegotiated: true
        })
      };
    });

    this.page = await this.context.newPage();
    
    // Initialize handoff streaming server
    if (!this.streamServer) {
      this.streamServer = new BrowserStreamServer(3001);
    }
    
    // Add human-like behavior patterns
    await this.addHumanBehavior();
    
    this.isInitialized = true;
    
    console.log('✅ Unified CUA Engine initialized successfully');
  }

  private async addHumanBehavior(): Promise<void> {
    // Random mouse movements
    setInterval(async () => {
      if (this.page && !this.page.isClosed()) {
        try {
          const x = Math.random() * 1000;
          const y = Math.random() * 600;
          await this.page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
        } catch (e) {
          // Page might be navigating
        }
      }
    }, 5000 + Math.random() * 10000);
    
    // Random scrolling
    setInterval(async () => {
      if (this.page && !this.page.isClosed()) {
        try {
          const scrollY = Math.random() * 100 - 50;
          await this.page.mouse.wheel(0, scrollY);
        } catch (e) {
          // Page might be navigating
        }
      }
    }, 8000 + Math.random() * 15000);
  }

  async executeTask(taskDescription: string): Promise<TaskResult> {
    if (!this.isInitialized) await this.init();
    
    console.log(`\n🎯 Executing: ${taskDescription}`);
    
    const startTime = Date.now();
    
    try {
      // Update agent status to busy
      await this.updateAgentStatus('busy');
      
      // 🚨 Check if handoff is needed before proceeding
      const handoffReason = await this.detectHandoffNeeds();
      if (handoffReason) {
        console.log(`🚨 Handoff required: ${handoffReason}`);
        const sessionId = await this.triggerHandoff(handoffReason, { taskDescription });
        
        await this.updateAgentStatus('waiting_for_human');
        
        return {
          success: false,
          error: `Handoff required: ${handoffReason}`,
          duration: Date.now() - startTime,
          action: 'handoff_triggered',
          handoffSession: sessionId,
          handoffUrl: this.streamServer?.getHandoffUrl(sessionId)
        };
      }
      
      // Analyze task with AI
      const action = await this.analyzeTask(taskDescription);
      
      // Execute action
      const result = await this.executeAction(action);
      
      // 🚨 Check again after action execution for any new handoff needs
      const postActionHandoff = await this.detectHandoffNeeds();
      if (postActionHandoff) {
        console.log(`🚨 Post-action handoff required: ${postActionHandoff}`);
        const sessionId = await this.triggerHandoff(postActionHandoff, { 
          taskDescription, 
          lastAction: action.action,
          result 
        });
        
        await this.updateAgentStatus('waiting_for_human');
        
        return {
          success: false,
          error: `Handoff required after action: ${postActionHandoff}`,
          duration: Date.now() - startTime,
          action: action.action,
          confidence: action.confidence,
          handoffSession: sessionId,
          handoffUrl: this.streamServer?.getHandoffUrl(sessionId)
        };
      }
      
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
      
      // 🚨 Check if error requires handoff
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('captcha') || 
          errorMessage.includes('verification') ||
          errorMessage.includes('login') ||
          errorMessage.includes('authentication')) {
        
        const sessionId = await this.triggerHandoff(`Error requiring handoff: ${errorMessage}`, { 
          taskDescription, 
          error: errorMessage 
        });
        
        await this.updateAgentStatus('waiting_for_human');
        
        return {
          success: false,
          error: errorMessage,
          duration,
          handoffSession: sessionId,
          handoffUrl: this.streamServer?.getHandoffUrl(sessionId)
        };
      }
      
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
    
    // Try vision analysis first if enabled
    if (this.config.useVision && this.page) {
      try {
        return await this.analyzeWithVision(taskDescription);
      } catch (error) {
        console.log('Vision analysis failed, falling back to text-only');
      }
    }
    
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

  private async analyzeWithVision(taskDescription: string): Promise<AIAction> {
    if (!this.ai || !this.page) throw new Error('AI or page not initialized');
    
    // Take screenshot
    const screenshot = await this.page.screenshot({ type: 'png' });
    const screenshotBase64 = screenshot.toString('base64');
    
    // Get page structure
    const pageInfo = await this.page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.textContent?.trim(),
        href: a.href
      }));
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim());
      const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
        type: i.type,
        name: i.name,
        placeholder: i.placeholder
      }));
      
      return { links, buttons, inputs, title: document.title, url: window.location.href };
    });
    
    const response = await this.ai.chat.completions.create({
      model: this.config.visionModel!,
      messages: [
        {
          role: 'system',
          content: `You are an advanced AI browser agent with vision capabilities.
You can SEE the screen and understand context from visual elements.
Analyze the visual content and page structure to make intelligent decisions.
Available actions: navigate, click, type, scroll, wait, screenshot
Always respond with valid JSON.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Task: ${taskDescription}\n\nPage Info: ${JSON.stringify(pageInfo, null, 2)}`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${screenshotBase64}`
              }
            }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from vision model');
    
    return JSON.parse(content);
  }

  private async detectHandoffNeeds(): Promise<string | null> {
    if (!this.page) return null;

    try {
      // Check for common handoff scenarios
      const handoffChecks = await this.page.evaluate(() => {
        const body = document.body.innerHTML.toLowerCase();
        
        // CAPTCHA detection
        if (body.includes('captcha') || 
            body.includes('recaptcha') || 
            body.includes('verify you are human') ||
            document.querySelector('[id*="captcha"]') ||
            document.querySelector('[class*="captcha"]')) {
          return { type: 'captcha', reason: 'CAPTCHA verification required' };
        }

        // 2FA detection
        if (body.includes('two-factor') || 
            body.includes('2fa') ||
            body.includes('verification code') ||
            body.includes('authenticator') ||
            body.includes('sms code')) {
          return { type: '2fa', reason: 'Two-factor authentication required' };
        }

        // Login issues
        if (body.includes('incorrect password') ||
            body.includes('login failed') ||
            body.includes('authentication failed')) {
          return { type: 'login', reason: 'Login credentials issue' };
        }

        // Payment verification
        if (body.includes('payment verification') ||
            body.includes('billing verification') ||
            body.includes('credit card')) {
          return { type: 'payment', reason: 'Payment verification required' };
        }

        // Age verification
        if (body.includes('age verification') ||
            body.includes('confirm you are') ||
            body.includes('date of birth')) {
          return { type: 'age', reason: 'Age verification required' };
        }

        // Terms and conditions
        if (body.includes('terms and conditions') ||
            body.includes('privacy policy') ||
            body.includes('accept terms')) {
          return { type: 'terms', reason: 'Terms acceptance required' };
        }

        return null;
      });

      return handoffChecks ? handoffChecks.reason : null;
    } catch (error) {
      return null;
    }
  }

  private async triggerHandoff(reason: string, context?: any): Promise<string> {
    if (!this.page || !this.browser || !this.streamServer) {
      throw new Error('Cannot trigger handoff: browser or stream server not available');
    }

    console.log(`🚨 Triggering beautiful handoff for: ${reason}`);

    // Create handoff session with context
    const sessionId = await this.streamServer.createHandoffSession(
      this.page,
      this.browser,
      reason,
      {
        ...context,
        agentId: this.agentId,
        timestamp: new Date().toISOString(),
        url: await this.page.url(),
        title: await this.page.title()
      }
    );

    this.currentHandoffSession = sessionId;

    // Store handoff in database
    await this.storeHandoffSession(sessionId, reason, context);

    // Generate handoff URL
    const handoffUrl = this.streamServer.getHandoffUrl(sessionId);
    
    console.log(`🎨 Beautiful handoff interface available at: ${handoffUrl}`);
    console.log(`💫 Streaming browser session with smooth controls enabled`);

    // Send notification (could integrate with Discord, Slack, etc.)
    await this.notifyOperators(sessionId, reason, handoffUrl);

    return sessionId;
  }

  private async storeHandoffSession(sessionId: string, reason: string, context: any) {
    try {
      // Store in memory table for tracking
      await this.db.insert(memory).values({
        id: `handoff_${sessionId}`,
        agent_id: this.agentId,
        type: 'handoff_session',
        data: JSON.stringify({
          sessionId,
          reason,
          context,
          status: 'active',
          createdAt: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Failed to store handoff session:', error);
    }
  }

  private async notifyOperators(sessionId: string, reason: string, handoffUrl: string) {
    // Beautiful notification system
    console.log(`
    ╔══════════════════════════════════════════════════════════════╗
    ║                  🎮 HANDOFF REQUIRED 🎮                      ║
    ╠══════════════════════════════════════════════════════════════╣
    ║  Session ID: ${sessionId.substring(0, 20)}...                   ║
    ║  Reason: ${reason.substring(0, 45).padEnd(45)}║
    ║  Interface: ${handoffUrl.substring(0, 42)}...                    ║
    ║                                                              ║
    ║  🎨 Beautiful browser control interface is ready!            ║
    ║  🖱️  Smooth mouse and keyboard control                       ║
    ║  📱 Works on desktop, mobile, and tablet                    ║
    ║  ⚡ Real-time streaming at 30 FPS                           ║
    ╚══════════════════════════════════════════════════════════════╝
    `);

    // TODO: Add integrations for:
    // - Discord webhook notifications
    // - Slack notifications  
    // - Email alerts
    // - SMS notifications
    // - Push notifications
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
        // Human-like click with mouse movement
        try {
          const element = await this.page.locator(action.target).first();
          const box = await element.boundingBox();
          if (box) {
            // Move mouse to element with human-like movement
            await this.page.mouse.move(box.x + box.width/2, box.y + box.height/2, { steps: 10 });
            await this.page.waitForTimeout(100 + Math.random() * 200);
            await this.page.mouse.click(box.x + box.width/2, box.y + box.height/2);
          } else {
            // Fallback to regular click
            await this.page.click(action.target);
          }
        } catch {
          // Fallback to regular click if locator fails
          await this.page.click(action.target);
        }
        return { clicked: action.target };
        
      case 'type':
        if (!action.target || !action.value) throw new Error('Type target and value required');
        // Human-like typing with random delays
        await this.page.click(action.target); // Focus the input
        for (const char of action.value) {
          await this.page.keyboard.type(char);
          await this.page.waitForTimeout(50 + Math.random() * 150); // Random delay between keystrokes
        }
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
