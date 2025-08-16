const { chromium } = require('playwright');
const OpenAI = require('openai');
require('dotenv').config();

/**
 * DEFINITIVE CUA - Production Ready Computer Use Agent
 * Enterprise-grade browser automation with AI intelligence
 */

class DefinitiveCUA {
  constructor(config = {}) {
    this.config = {
      headless: false,
      useVision: true,
      maxAttempts: 5,
      timeout: 30000,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...config
    };
    
    this.browser = null;
    this.context = null;
    this.page = null;
    this.ai = null;
    this.memory = new Map();
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) return;
    
    console.log('🚀 Initializing Definitive CUA...');
    
    // Initialize AI
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
        '--disable-dev-shm-usage'
      ]
    });

    // Create context with human-like behavior
    this.context = await this.browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent: this.config.userAgent,
      locale: 'en-US',
      timezoneId: 'America/New_York'
    });

    // Anti-detection measures
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
    this.isInitialized = true;
    
    console.log('✅ CUA initialized successfully');
  }

  async executeTask(taskDescription) {
    if (!this.isInitialized) await this.init();
    
    console.log(`\n🎯 Executing: ${taskDescription}`);
    
    try {
      // Analyze task with AI
      const action = await this.analyzeTask(taskDescription);
      
      // Execute action
      const result = await this.executeAction(action);
      
      // Store in memory
      this.memory.set(Date.now(), {
        task: taskDescription,
        action,
        result,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        result,
        action
      };

    } catch (error) {
      console.error('❌ Task failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async analyzeTask(taskDescription) {
    // Get page context
    const pageInfo = await this.page.evaluate(() => ({
      title: document.title,
      url: window.location.href,
      text: document.body.innerText.substring(0, 1000),
      links: Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.innerText.trim(),
        href: a.href,
        visible: a.offsetParent !== null
      })).filter(l => l.text && l.visible).slice(0, 10),
      buttons: Array.from(document.querySelectorAll('button, input[type="submit"]')).map(b => ({
        text: b.innerText || b.value,
        id: b.id,
        visible: b.offsetParent !== null
      })).filter(b => b.text && b.visible).slice(0, 5)
    }));

    // Try vision model first
    if (this.config.useVision) {
      try {
        const screenshot = await this.page.screenshot({ encoding: 'base64' });
        
        const response = await this.ai.chat.completions.create({
          model: 'moonshotai/kimi-vl-a3b-thinking:free',
          messages: [
            {
              role: 'system',
              content: `You are an AI browser agent. Analyze the screen and decide what to do next.
              
              Available actions:
              - "click": Click on an element (use text, selector, or coordinates)
              - "type": Type text into a field (use selector or just type)
              - "search": Search for something (use query parameter)
              - "navigate": Go to a URL (use url parameter)
              - "scroll": Scroll the page (use distance parameter)
              - "wait": Wait for a moment (use duration parameter)
              
              Always respond with valid JSON in this exact format:
              {
                "action": "action_name",
                "text": "text to click or type",
                "selector": "CSS selector",
                "query": "search query",
                "url": "url to navigate to",
                "distance": 300,
                "duration": 2000
              }`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Task: ${taskDescription}\n\nPage Info: ${JSON.stringify(pageInfo)}`
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
          content: `You are an AI browser agent. Analyze the page and decide what to do next.
          
          Available actions:
          - "click": Click on an element (use text, selector, or coordinates)
          - "type": Type text into a field (use selector or just type)
          - "search": Search for something (use query parameter)
          - "navigate": Go to a URL (use url parameter)
          - "scroll": Scroll the page (use distance parameter)
          - "wait": Wait for a moment (use duration parameter)
          
          Always respond with valid JSON in this exact format:
          {
            "action": "action_name",
            "text": "text to click or type",
            "selector": "CSS selector",
            "query": "search query",
            "url": "url to navigate to",
            "distance": 300,
            "duration": 2000
          }`
        },
        {
          role: 'user',
          content: `Task: ${taskDescription}\n\nPage Info: ${JSON.stringify(pageInfo)}`
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 300
    });

    return JSON.parse(response.choices[0].message.content);
  }

  async executeAction(action) {
    console.log(`⚡ Executing: ${action.action}`);
    console.log('Action details:', JSON.stringify(action, null, 2));

    // Handle common AI response variations
    if (action.action === 'click_link' || action.action === 'click_link') {
      action.action = 'click';
    }
    
    if (action.action === 'type_text' || action.action === 'input') {
      action.action = 'type';
    }

    switch (action.action) {
      case 'click':
        if (action.coordinates) {
          await this.page.mouse.click(action.coordinates.x, action.coordinates.y);
        } else if (action.text) {
          await this.page.click(`text="${action.text}"`);
        } else if (action.selector) {
          await this.page.click(action.selector);
        } else {
          // Default click behavior for search
          await this.page.click('input[name="q"]');
        }
        break;

      case 'type':
        if (action.selector) {
          await this.page.fill(action.selector, action.text);
        } else if (action.query) {
          await this.page.fill('input[name="q"]', action.query);
        } else {
          await this.page.keyboard.type(action.text);
        }
        break;

      case 'search':
        if (action.query) {
          await this.page.fill('input[name="q"]', action.query);
          await this.page.press('input[name="q"]', 'Enter');
        } else if (action.text) {
          await this.page.fill('input[name="q"]', action.text);
          await this.page.press('input[name="q"]', 'Enter');
        }
        break;

      case 'navigate':
        if (action.url) {
          await this.page.goto(action.url, { waitUntil: 'networkidle' });
        } else {
          // Default navigation for common sites
          const task = action.task || '';
          if (task.includes('google')) {
            await this.page.goto('https://www.google.com', { waitUntil: 'networkidle' });
          } else if (task.includes('pinterest')) {
            await this.page.goto('https://www.pinterest.com', { waitUntil: 'networkidle' });
          }
        }
        break;

      case 'scroll':
        await this.page.mouse.wheel(0, action.distance || 300);
        break;

      case 'wait':
        await this.page.waitForTimeout(action.duration || 2000);
        break;

      default:
        console.log(`⚠️ Unknown action: ${action.action}, trying to handle intelligently...`);
        
        // Intelligent fallback
        if (action.text && action.text.includes('search')) {
          await this.page.fill('input[name="q"]', action.text.replace('search', '').trim());
          await this.page.press('input[name="q"]', 'Enter');
        } else if (action.text) {
          await this.page.click(`text="${action.text}"`);
        } else {
          throw new Error(`Cannot handle action: ${action.action}`);
        }
    }

    // Wait after action
    await this.page.waitForTimeout(1000);
    
    return { action: action.action, success: true };
  }

  async navigate(url) {
    if (!this.isInitialized) await this.init();
    console.log(`📍 Navigating to ${url}`);
    await this.page.goto(url, { waitUntil: 'networkidle' });
  }

  async screenshot() {
    if (!this.isInitialized) await this.init();
    return await this.page.screenshot({ encoding: 'base64' });
  }

  async close() {
    if (this.page) await this.page.close();
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    this.isInitialized = false;
  }

  getMemory() {
    return Array.from(this.memory.entries()).map(([key, value]) => ({
      id: key,
      ...value
    }));
  }
}

// Demo function
async function demo() {
  const cua = new DefinitiveCUA({
    headless: false,
    useVision: true
  });

  try {
    await cua.init();
    
    // Navigate to Google
    await cua.navigate('https://www.google.com');
    
    // Execute tasks
    const tasks = [
      'Search for "OpenAI"',
      'Click on the first search result',
      'Take a screenshot of the page'
    ];

    for (const task of tasks) {
      const result = await cua.executeTask(task);
      console.log(`Task result:`, result);
      
      if (!result.success) {
        console.log('Task failed, stopping...');
        break;
      }
      
      // Wait between tasks
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log('\n🎉 Demo completed!');
    console.log('Memory:', cua.getMemory());

  } catch (error) {
    console.error('Demo failed:', error);
  } finally {
    console.log('\nPress Ctrl+C to close browser...');
    // Keep browser open to see results
  }
}

// Export for use
module.exports = DefinitiveCUA;

// Run demo if called directly
if (require.main === module) {
  demo();
}
