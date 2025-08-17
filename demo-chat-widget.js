/**
 * Demo: Integrated AI Chat Widget
 * Run this to see the chat widget in YOUR browser
 */

const { chromium } = require('playwright');
const { PersistentChatWidget } = require('./src/chat/persistent-chat-widget');
const { ChatInjector } = require('./src/cua/chat-injector');

async function startDemo() {
  console.log('🎯 STARTING AI CHAT WIDGET DEMO');
  console.log('This will open a browser with the integrated chat widget\n');
  
  // Start chat server
  const chatWidget = new PersistentChatWidget(3002);
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for server
  
  // Launch browser (visible to you)
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--start-maximized']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  
  const page = await context.newPage();
  
  // Create chat session and inject widget
  const sessionId = await chatWidget.createChatSession('demo', page);
  await ChatInjector.injectChatWidget(page, sessionId);
  
  console.log('✅ Chat widget injected! Going to Google...');
  
  // Navigate to a page
  await page.goto('https://www.google.com');
  
  // Add some automation updates
  setTimeout(() => {
    chatWidget.notifyAutomationUpdate(sessionId, 'Welcome! Try chatting with me using the widget in the bottom-right corner.');
  }, 3000);
  
  setTimeout(() => {
    chatWidget.notifyAutomationUpdate(sessionId, 'I can see the Google homepage. Ask me questions or give me instructions!');
  }, 5000);
  
  console.log('\n🎨 LOOK IN YOUR BROWSER!');
  console.log('You should see a floating chat widget in the bottom-right corner');
  console.log('Try clicking the quick action buttons or typing messages');
  console.log('\nPress Ctrl+C to stop the demo');
  
  // Keep alive
  await new Promise(() => {});
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Demo stopped');
  process.exit(0);
});

startDemo().catch(console.error);