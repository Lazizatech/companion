/**
 * Test Integrated Chat Widget
 * Shows chat widget embedded directly in browser during automation
 */

const { chromium } = require('playwright');
const { PersistentChatWidget } = require('./src/chat/persistent-chat-widget');
const { ChatInjector } = require('./src/cua/chat-injector');

async function testIntegratedChat() {
  console.log('🎯 TESTING INTEGRATED AI CHAT WIDGET\n');
  console.log('=' .repeat(60));
  
  // Start the chat widget server
  console.log('🚀 Starting chat server...');
  const chatWidget = new PersistentChatWidget(3002);
  
  // Launch browser
  console.log('🌐 Launching browser...');
  const browser = await chromium.launch({ 
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--start-maximized'
    ]
  });
  
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  
  const page = await context.newPage();
  
  // Create chat session
  console.log('💬 Creating chat session...');
  const chatSessionId = await chatWidget.createChatSession('demo-agent', page);
  
  // Inject chat widget into the page
  console.log('🎨 Injecting chat widget into browser...');
  await ChatInjector.injectChatWidget(page, chatSessionId);
  
  console.log(`\n✅ INTEGRATED CHAT WIDGET READY!`);
  console.log(`🎯 The AI chat widget is now embedded in the browser!`);
  console.log(`💬 You'll see a floating chat widget in the bottom-right corner`);
  console.log(`🚀 Try interacting with it during the automation!\n`);
  
  // Automation flow with embedded chat
  const steps = [
    {
      name: 'Navigate to Google',
      action: async () => {
        console.log('📍 Going to Google...');
        chatWidget.notifyAutomationUpdate(chatSessionId, 'Navigating to Google homepage');
        await page.goto('https://www.google.com');
        chatWidget.notifyPageChange(chatSessionId, 'https://www.google.com', 'Google');
        await page.waitForTimeout(3000);
      }
    },
    {
      name: 'Search for something',
      action: async () => {
        console.log('🔍 Performing search...');
        chatWidget.notifyActionTaken(chatSessionId, 'Typing', 'search query');
        
        // Type in search box
        await page.fill('[name="q"]', 'OpenAI ChatGPT');
        await page.keyboard.press('Enter');
        
        chatWidget.notifyAutomationUpdate(chatSessionId, 'Search completed! Viewing results page');
        await page.waitForTimeout(3000);
      }
    },
    {
      name: 'Navigate to reCAPTCHA demo',
      action: async () => {
        console.log('🤖 Going to CAPTCHA demo...');
        chatWidget.notifyAutomationUpdate(chatSessionId, 'Navigating to reCAPTCHA demo page');
        await page.goto('https://www.google.com/recaptcha/api2/demo');
        chatWidget.notifyPageChange(chatSessionId, 'https://www.google.com/recaptcha/api2/demo', 'reCAPTCHA Demo');
        
        // Check for CAPTCHA
        const hasCaptcha = await page.evaluate(() => {
          return document.querySelector('.g-recaptcha') !== null;
        });
        
        if (hasCaptcha) {
          chatWidget.notifyAutomationUpdate(chatSessionId, '🚨 CAPTCHA detected! This is where I would normally hand off to you.');
          chatWidget.notifyAutomationUpdate(chatSessionId, 'Try chatting with me! Ask questions or give me instructions.');
        }
        
        await page.waitForTimeout(3000);
      }
    },
    {
      name: 'Interactive waiting period',
      action: async () => {
        console.log('💬 Interactive period - try chatting with the AI!');
        chatWidget.notifyAutomationUpdate(chatSessionId, `🎉 Perfect! Now you can chat with me in real-time!

Try these interactions:
• Ask "Where are we?" 
• Say "What can you see?"
• Tell me "Click the CAPTCHA checkbox"
• Ask "What should I do next?"

I'm actively monitoring the page and ready to help! The chat widget will stay with you on every page during automation.`);
        
        console.log('\n💡 INTERACTION TIME!');
        console.log('🔹 Look for the floating chat widget in the browser');
        console.log('🔹 Try the quick action buttons');
        console.log('🔹 Type messages to the AI');
        console.log('🔹 The AI will respond based on the current page');
        console.log('\n⏳ Waiting 45 seconds for you to test the chat...\n');
        
        await page.waitForTimeout(45000);
      }
    }
  ];
  
  // Execute steps
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`\n${i + 1}. ${step.name}`);
    
    try {
      await step.action();
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      chatWidget.notifyAutomationUpdate(chatSessionId, `❌ Error during ${step.name}: ${error.message}`);
    }
  }
  
  console.log('\n✅ DEMONSTRATION COMPLETE!');
  chatWidget.notifyAutomationUpdate(chatSessionId, '🎯 Demo complete! The chat widget will remain active for any future automation.');
  
  console.log('\n🎯 Key Features Demonstrated:');
  console.log('   ✅ Chat widget embedded directly in browser');
  console.log('   ✅ Real-time communication during automation');
  console.log('   ✅ Contextual AI responses');
  console.log('   ✅ Live automation updates');
  console.log('   ✅ Draggable, minimizable interface');
  console.log('   ✅ Quick action buttons');
  console.log('   ✅ Persistent across page navigation');
  
  console.log('\n⏰ Browser will stay open for continued testing...');
  console.log('🎨 You can continue automating and chatting!');
  
  // Keep running indefinitely for testing
  await new Promise(() => {}); // Keep alive
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  process.exit(0);
});

// Run the test
testIntegratedChat().catch(console.error);