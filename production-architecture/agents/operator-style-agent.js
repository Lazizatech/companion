#!/usr/bin/env node

/**
 * Operator-Style Agent
 * Pauses for user confirmation and has much better prompting
 */

const DefinitiveCUA = require('./cua.js');
const readline = require('readline');

class OperatorStyleAgent {
  constructor(options = {}) {
    this.id = Date.now().toString();
    this.cua = new DefinitiveCUA({
      headless: options.headless || false,
      useVision: options.useVision || true
    });
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.pauseAfterSteps = options.pauseAfterSteps || true;
    this.stepCounter = 0;
  }

  async init() {
    console.log(`🤖 Initializing Operator-Style Agent ${this.id}`);
    await this.cua.init();
    console.log(`✅ Agent ready. Browser window should be visible.`);
  }

  async executeTaskWithPauses(taskDescription, targetUrl) {
    console.log(`\n🎯 Starting task: ${taskDescription}`);
    console.log(`🌐 Target: ${targetUrl}`);
    
    try {
      // Step 1: Navigate
      console.log(`\n📍 Step 1: Navigating to ${targetUrl}`);
      await this.cua.navigate(targetUrl);
      await this.pauseForUser("Navigation complete. Press Enter to continue or 'h' for help...");

      // Step 2: Get better context and plan
      const pageContext = await this.analyzeCurrentPage(taskDescription);
      console.log(`\n🔍 Page Analysis:`, pageContext);
      
      await this.pauseForUser("Page analyzed. Press Enter to proceed with task execution...");

      // Step 3: Execute task with smart prompting
      const result = await this.executeTaskWithBetterPrompting(taskDescription, pageContext);
      
      console.log(`\n✅ Task completed:`, result);
      return result;

    } catch (error) {
      console.error(`\n❌ Task failed:`, error.message);
      await this.pauseForUser("Error occurred. You can manually fix the issue, then press Enter to continue...");
      
      // Try to continue after user intervention
      try {
        const recoveryResult = await this.executeTaskWithBetterPrompting(taskDescription, null);
        return recoveryResult;
      } catch (recoveryError) {
        console.error(`💥 Recovery failed:`, recoveryError.message);
        return { success: false, error: recoveryError.message };
      }
    }
  }

  async analyzeCurrentPage(taskDescription) {
    try {
      const pageInfo = {
        url: await this.cua.page.url(),
        title: await this.cua.page.title(),
        hasSearchBox: await this.cua.page.$('input[type="search"], input[placeholder*="search" i], input[placeholder*="Search" i]') !== null,
        hasLoginForm: await this.cua.page.$('input[type="password"], [class*="login" i], [id*="login" i]') !== null,
        visibleButtons: await this.cua.page.$$eval('button:visible, input[type="submit"]:visible', 
          buttons => buttons.slice(0, 5).map(btn => ({
            text: btn.innerText.trim() || btn.value || btn.getAttribute('aria-label') || 'Button',
            classes: btn.className
          }))
        ),
        visibleLinks: await this.cua.page.$$eval('a:visible', 
          links => links.slice(0, 10).map(link => ({
            text: link.innerText.trim(),
            href: link.href
          })).filter(link => link.text.length > 0 && link.text.length < 50)
        )
      };

      return pageInfo;
    } catch (error) {
      console.log(`⚠️ Page analysis failed: ${error.message}`);
      return { url: 'unknown', title: 'unknown' };
    }
  }

  async executeTaskWithBetterPrompting(taskDescription, pageContext) {
    console.log(`\n🧠 Executing task with enhanced prompting...`);
    
    // Build a much more specific prompt based on the task and page
    let specificPrompt = this.buildSpecificPrompt(taskDescription, pageContext);
    
    console.log(`\n💭 Using prompt strategy: ${specificPrompt.strategy}`);
    
    const action = await this.cua.decideAction(specificPrompt.prompt, pageContext);
    console.log(`\n⚡ Decided action:`, action);
    
    await this.pauseForUser(`About to execute: ${action.action}. Press Enter to continue or manually intervene...`);
    
    const result = await this.cua.executeAction(action);
    
    await this.pauseForUser(`Action completed. Check the result and press Enter...`);
    
    return { success: true, action, result };
  }

  buildSpecificPrompt(taskDescription, pageContext) {
    const task = taskDescription.toLowerCase();
    
    // Alibaba-specific prompting
    if (pageContext && pageContext.url.includes('alibaba')) {
      if (task.includes('search') || task.includes('find') || task.includes('earbuds') || task.includes('product')) {
        return {
          strategy: 'Alibaba Product Search',
          prompt: `You are on Alibaba.com and need to search for products.

TASK: ${taskDescription}

CURRENT PAGE: ${pageContext.title}
URL: ${pageContext.url}

STEP-BY-STEP APPROACH:
1. Look for the main search box (usually prominently displayed)
2. Common selectors on Alibaba: 
   - input[placeholder*="Enter product name"]
   - input[placeholder*="Search for products"]
   - .search-bar input
   - #search-words
3. Type the EXACT search term from the task
4. Press Enter or click search button

EXTRACT EXACT SEARCH TERMS:
From "${taskDescription}" extract: wireless earbuds, earbuds, bluetooth earbuds, or similar

RESPOND WITH ONE ACTION ONLY - the search action to find products.`
        };
      }
    }

    // Google-specific prompting  
    if (pageContext && pageContext.url.includes('google')) {
      return {
        strategy: 'Google Search',
        prompt: `You are on Google and need to search.

TASK: ${taskDescription}

FIND THE SEARCH BOX (common selectors):
- input[name="q"]
- .gLFyf
- #APjFqb
- textarea[name="q"]

TYPE THE EXACT SEARCH QUERY AND PRESS ENTER.`
      };
    }

    // Generic prompting with context
    return {
      strategy: 'Context-Aware Generic',
      prompt: `Analyze the current page and execute this task: ${taskDescription}

PAGE CONTEXT:
- URL: ${pageContext?.url || 'unknown'}
- Title: ${pageContext?.title || 'unknown'}
- Has search box: ${pageContext?.hasSearchBox || 'unknown'}
- Available buttons: ${JSON.stringify(pageContext?.visibleButtons || [])}

Be specific and precise. Use exact text or reliable selectors.`
    };
  }

  async pauseForUser(message) {
    if (!this.pauseAfterSteps) return;
    
    return new Promise((resolve) => {
      this.rl.question(`\n⏸️  ${message} `, (answer) => {
        if (answer.toLowerCase() === 'h') {
          console.log(`
🛠️  Help Commands:
- Press Enter: Continue with next step
- Type 'h': Show this help
- Type 'c': Continue without pauses
- Type 's': Take screenshot
- Type 'q': Quit
          `);
          this.pauseForUser("Choose an option: ").then(resolve);
        } else if (answer.toLowerCase() === 'c') {
          this.pauseAfterSteps = false;
          console.log(`▶️  Continuing without pauses...`);
          resolve();
        } else if (answer.toLowerCase() === 's') {
          this.takeScreenshot().then(() => {
            this.pauseForUser("Screenshot taken. " + message).then(resolve);
          });
        } else if (answer.toLowerCase() === 'q') {
          console.log(`👋 Quitting...`);
          process.exit(0);
        } else {
          resolve();
        }
      });
    });
  }

  async takeScreenshot() {
    try {
      const screenshot = await this.cua.screenshot();
      console.log(`📸 Screenshot taken (base64 encoded)`);
      return screenshot;
    } catch (error) {
      console.log(`❌ Screenshot failed: ${error.message}`);
    }
  }

  async close() {
    console.log(`\n🔒 Closing Operator-Style Agent ${this.id}`);
    this.rl.close();
    await this.cua.close();
  }
}

module.exports = OperatorStyleAgent;

// CLI Demo
if (require.main === module) {
  async function demo() {
    const agent = new OperatorStyleAgent({
      headless: false,
      useVision: true,
      pauseAfterSteps: true
    });

    try {
      await agent.init();
      
      console.log(`
🎯 Demo Task: Search Alibaba for wireless earbuds and find pricing

This agent will:
1. Navigate to Alibaba
2. Pause for your confirmation
3. Execute search with better prompting  
4. Pause between steps so you can intervene
5. Continue or let you take over

Ready to start?
      `);

      await agent.pauseForUser("Press Enter to begin the demo...");

      const result = await agent.executeTaskWithPauses(
        'Search for wireless earbuds for dropshipping analysis',
        'https://alibaba.com'
      );

      console.log(`\n🎉 Demo completed:`, result);

    } catch (error) {
      console.error('Demo failed:', error);
    } finally {
      await agent.close();
    }
  }

  demo();
}