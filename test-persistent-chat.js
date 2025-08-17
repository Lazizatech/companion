/**
 * Test Persistent AI Chat During Full Automation
 * Run with: node test-persistent-chat.js
 */

const { chromium } = require('playwright');
const { PersistentChatWidget } = require('./src/chat/persistent-chat-widget');

async function testPersistentChat() {
  console.log('🧪 TESTING PERSISTENT AI CHAT DURING AUTOMATION\n');
  console.log('=' .repeat(60));
  
  // Start the chat widget server
  console.log('\n🚀 Starting persistent chat widget...');
  const chatWidget = new PersistentChatWidget(3002);
  
  // Launch browser
  console.log('🌐 Launching browser...');
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  
  const page = await context.newPage();
  
  // Create chat session
  console.log('💬 Creating chat session...');
  const chatSessionId = await chatWidget.createChatSession('test-agent', page);
  
  console.log(`\n🎨 CHAT INTERFACE READY!`);
  console.log(`📱 Open this URL to chat with AI during automation:`);
  console.log(`🔗 http://localhost:3002/chat/${chatSessionId}`);
  console.log(`\n💡 You can also embed the floating widget:`);
  console.log(`🔗 file://${__dirname}/public/chat-widget/floating-chat.html#${chatSessionId}`);
  
  console.log('\n🤖 Starting automated browsing with real-time chat...\n');
  
  // Automation flow with chat notifications
  const steps = [
    {
      action: 'Navigate to Google',
      execute: async () => {
        chatWidget.notifyAutomationUpdate(chatSessionId, 'Starting automation: Going to Google');
        await page.goto('https://www.google.com');
        chatWidget.notifyPageChange(chatSessionId, 'https://www.google.com', 'Google');
      }
    },
    {
      action: 'Search for "AI automation"',
      execute: async () => {
        chatWidget.notifyActionTaken(chatSessionId, 'Typing', 'AI automation');
        await page.fill('[name="q"]', 'AI automation');
        await page.keyboard.press('Enter');
        chatWidget.notifyAutomationUpdate(chatSessionId, 'Search submitted, waiting for results...');
      }
    },
    {
      action: 'Navigate to reCAPTCHA demo',
      execute: async () => {
        chatWidget.notifyAutomationUpdate(chatSessionId, 'Going to test CAPTCHA page');
        await page.goto('https://www.google.com/recaptcha/api2/demo');
        chatWidget.notifyPageChange(chatSessionId, 'https://www.google.com/recaptcha/api2/demo', 'reCAPTCHA Demo');
      }
    },
    {
      action: 'Detect CAPTCHA',
      execute: async () => {
        const hasCaptcha = await page.evaluate(() => {
          return document.querySelector('.g-recaptcha') !== null;
        });
        
        if (hasCaptcha) {
          chatWidget.notifyAutomationUpdate(chatSessionId, '🚨 CAPTCHA detected! This would normally trigger handoff.');
          chatWidget.notifyAutomationUpdate(chatSessionId, 'In a real scenario, I would pause and let you solve this through the handoff interface.');
        } else {
          chatWidget.notifyAutomationUpdate(chatSessionId, 'No CAPTCHA found, continuing automation...');
        }
      }
    },
    {
      action: 'Wait for user interaction',
      execute: async () => {
        chatWidget.notifyAutomationUpdate(chatSessionId, `💬 I'm now waiting! Try chatting with me:
        
🔹 Ask "Where are we?" to see current page
🔹 Say "What can you see?" for page analysis  
🔹 Tell me "Click the CAPTCHA" or give other instructions
🔹 Type "Continue" when ready for next step

I'll respond intelligently to your messages!`);
        
        // Wait for 30 seconds for user to interact
        console.log('⏳ Waiting 30 seconds for user to chat...');
        await page.waitForTimeout(30000);
      }
    }
  ];
  
  // Execute automation steps
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`${i + 1}. ${step.action}`);
    
    try {
      await step.execute();
      await page.waitForTimeout(2000); // Pause between steps
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      chatWidget.notifyAutomationUpdate(chatSessionId, `❌ Error during ${step.action}: ${error.message}`);
    }
  }
  
  console.log('\n✅ Automation complete!');
  chatWidget.notifyAutomationUpdate(chatSessionId, '✅ Automation sequence complete! Thanks for chatting with me during the process.');
  
  console.log('\n💡 Key Features Demonstrated:');
  console.log('   🔹 Real-time chat during automation');
  console.log('   🔹 Contextual AI responses');
  console.log('   🔹 Live automation updates');
  console.log('   🔹 Page change notifications');
  console.log('   🔹 Action descriptions');
  console.log('   🔹 Intelligent conversation flow');
  
  console.log('\n⏰ Keeping browser open for 60 more seconds for testing...');
  await page.waitForTimeout(60000);
  
  // Cleanup
  await browser.close();
  console.log('\n🧹 Test complete!');
  process.exit(0);
}

// Run the test
testPersistentChat().catch(console.error);