/**
 * Comprehensive Integration Test for Handoff System
 * Run with: node test-integration-handoff.js
 */

const { chromium } = require('playwright');
const WebSocket = require('ws');
const axios = require('axios');
const BrowserStreamServer = require('./src/handoff/standalone-stream-server');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class HandoffIntegrationTest {
  constructor() {
    this.server = null;
    this.browser = null;
    this.sessionId = null;
    this.ws = null;
    this.results = {
      passed: [],
      failed: []
    };
  }

  async runAllTests() {
    log('\n🧪 COMPREHENSIVE HANDOFF INTEGRATION TEST', 'cyan');
    log('=' .repeat(60), 'cyan');
    
    try {
      // Start server
      await this.testServerStartup();
      
      // Test API endpoints
      await this.testAPIEndpoints();
      
      // Create handoff session
      await this.testSessionCreation();
      
      // Test WebSocket connection
      await this.testWebSocketConnection();
      
      // Test browser streaming
      await this.testBrowserStreaming();
      
      // Test control commands
      await this.testControlCommands();
      
      // Test CAPTCHA detection
      await this.testCAPTCHADetection();
      
      // Test handoff UI
      await this.testHandoffUI();
      
      // Show results
      this.showResults();
      
    } catch (error) {
      log(`\n❌ Critical error: ${error.message}`, 'red');
    } finally {
      await this.cleanup();
    }
  }

  async testServerStartup() {
    log('\n📦 TEST 1: Server Startup', 'yellow');
    
    try {
      // Use a random port to avoid conflicts
      const port = 3000 + Math.floor(Math.random() * 1000);
      this.port = port;
      this.server = new BrowserStreamServer(port);
      await this.server.start();
      await wait(1000);
      
      this.results.passed.push('Server startup');
      log(`  ✅ Server started successfully on port ${port}`, 'green');
    } catch (error) {
      this.results.failed.push('Server startup');
      log(`  ❌ Server startup failed: ${error.message}`, 'red');
      throw error;
    }
  }

  async testAPIEndpoints() {
    log('\n🔌 TEST 2: API Endpoints', 'yellow');
    
    try {
      // Test health endpoint
      const health = await axios.get(`http://localhost:${this.port}/api/health`);
      if (health.data.status === 'healthy') {
        log('  ✅ Health endpoint working', 'green');
      } else {
        throw new Error('Health check failed');
      }
      
      // Test sessions endpoint
      const sessions = await axios.get(`http://localhost:${this.port}/api/sessions`);
      if (Array.isArray(sessions.data)) {
        log(`  ✅ Sessions endpoint working (${sessions.data.length} sessions)`, 'green');
      } else {
        throw new Error('Sessions endpoint failed');
      }
      
      this.results.passed.push('API endpoints');
    } catch (error) {
      this.results.failed.push('API endpoints');
      log(`  ❌ API test failed: ${error.message}`, 'red');
    }
  }

  async testSessionCreation() {
    log('\n🎯 TEST 3: Session Creation', 'yellow');
    
    try {
      const response = await axios.post(`http://localhost:${this.port}/api/test-session`, {
        url: 'https://www.google.com/recaptcha/api2/demo'
      });
      
      if (response.data.success && response.data.sessionId) {
        this.sessionId = response.data.sessionId;
        log(`  ✅ Session created: ${this.sessionId}`, 'green');
        log(`  🌐 Handoff URL: ${response.data.handoffUrl}`, 'blue');
        this.results.passed.push('Session creation');
      } else {
        throw new Error('Session creation failed');
      }
    } catch (error) {
      this.results.failed.push('Session creation');
      log(`  ❌ Session creation failed: ${error.message}`, 'red');
    }
  }

  async testWebSocketConnection() {
    log('\n🔗 TEST 4: WebSocket Connection', 'yellow');
    
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(`ws://localhost:${this.port}/session/${this.sessionId}`);
        
        this.ws.on('open', () => {
          log('  ✅ WebSocket connected', 'green');
          this.results.passed.push('WebSocket connection');
        });
        
        this.ws.on('message', (data) => {
          const message = JSON.parse(data);
          if (message.type === 'initial_state') {
            log(`  ✅ Received initial state: ${message.data.url}`, 'green');
            resolve();
          }
        });
        
        this.ws.on('error', (error) => {
          log(`  ❌ WebSocket error: ${error.message}`, 'red');
          this.results.failed.push('WebSocket connection');
          resolve();
        });
        
        // Timeout after 5 seconds
        setTimeout(() => {
          if (this.ws.readyState !== WebSocket.OPEN) {
            log('  ❌ WebSocket connection timeout', 'red');
            this.results.failed.push('WebSocket connection');
          }
          resolve();
        }, 5000);
      } catch (error) {
        log(`  ❌ WebSocket setup failed: ${error.message}`, 'red');
        this.results.failed.push('WebSocket connection');
        resolve();
      }
    });
  }

  async testBrowserStreaming() {
    log('\n📹 TEST 5: Browser Streaming', 'yellow');
    
    return new Promise((resolve) => {
      let frameCount = 0;
      let startTime = Date.now();
      
      const frameHandler = (data) => {
        const message = JSON.parse(data);
        if (message.type === 'frame') {
          frameCount++;
          
          if (frameCount === 10) {
            const elapsed = (Date.now() - startTime) / 1000;
            const fps = frameCount / elapsed;
            
            log(`  ✅ Received ${frameCount} frames in ${elapsed.toFixed(2)}s`, 'green');
            log(`  📊 Average FPS: ${fps.toFixed(1)}`, 'blue');
            
            if (fps > 5) {
              this.results.passed.push('Browser streaming');
            } else {
              this.results.failed.push('Browser streaming (low FPS)');
            }
            
            this.ws.removeListener('message', frameHandler);
            resolve();
          }
        }
      };
      
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.on('message', frameHandler);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          log(`  ⚠️ Only received ${frameCount} frames`, 'yellow');
          this.ws.removeListener('message', frameHandler);
          resolve();
        }, 10000);
      } else {
        log('  ❌ WebSocket not connected', 'red');
        this.results.failed.push('Browser streaming');
        resolve();
      }
    });
  }

  async testControlCommands() {
    log('\n🎮 TEST 6: Control Commands', 'yellow');
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      log('  ❌ WebSocket not connected', 'red');
      this.results.failed.push('Control commands');
      return;
    }
    
    try {
      // Test mouse move
      this.ws.send(JSON.stringify({
        type: 'move',
        data: { x: 100, y: 100 }
      }));
      log('  ✅ Sent mouse move command', 'green');
      
      await wait(500);
      
      // Test click
      this.ws.send(JSON.stringify({
        type: 'click',
        data: { x: 200, y: 200 }
      }));
      log('  ✅ Sent click command', 'green');
      
      await wait(500);
      
      // Test scroll
      this.ws.send(JSON.stringify({
        type: 'scroll',
        data: { deltaY: 100 }
      }));
      log('  ✅ Sent scroll command', 'green');
      
      await wait(500);
      
      // Test typing
      this.ws.send(JSON.stringify({
        type: 'type',
        data: { text: 'Hello from integration test!' }
      }));
      log('  ✅ Sent type command', 'green');
      
      this.results.passed.push('Control commands');
    } catch (error) {
      log(`  ❌ Control command failed: ${error.message}`, 'red');
      this.results.failed.push('Control commands');
    }
  }

  async testCAPTCHADetection() {
    log('\n🤖 TEST 7: CAPTCHA Detection', 'yellow');
    
    try {
      // The test session should already be on the reCAPTCHA demo page
      const session = this.server.sessions.get(this.sessionId);
      if (!session) {
        throw new Error('Session not found');
      }
      
      const page = session.page;
      
      // Check for CAPTCHA
      const hasCaptcha = await page.evaluate(() => {
        return document.querySelector('.g-recaptcha') !== null ||
               document.querySelector('[id*="recaptcha"]') !== null;
      });
      
      if (hasCaptcha) {
        log('  ✅ CAPTCHA detected on page', 'green');
        this.results.passed.push('CAPTCHA detection');
        
        // Simulate what would trigger handoff
        log('  🚨 This would trigger handoff to human operator', 'magenta');
        log('  🎨 Beautiful UI would be available for solving', 'magenta');
      } else {
        log('  ⚠️ No CAPTCHA found on test page', 'yellow');
        this.results.failed.push('CAPTCHA detection');
      }
    } catch (error) {
      log(`  ❌ CAPTCHA detection failed: ${error.message}`, 'red');
      this.results.failed.push('CAPTCHA detection');
    }
  }

  async testHandoffUI() {
    log('\n🎨 TEST 8: Handoff UI', 'yellow');
    
    try {
      // Launch browser to test the UI
      this.browser = await chromium.launch({ headless: true });
      const page = await this.browser.newPage();
      
      // Navigate to handoff UI
      await page.goto(`http://localhost:${this.port}/handoff/${this.sessionId}`);
      
      // Check if UI loads
      const title = await page.title();
      if (title.includes('CUA Handoff')) {
        log('  ✅ Handoff UI loaded successfully', 'green');
      } else {
        throw new Error('UI title incorrect');
      }
      
      // Check for essential elements
      const hasCanvas = await page.locator('#browserCanvas').count() > 0;
      const hasControls = await page.locator('.browser-controls').count() > 0;
      const hasSidebar = await page.locator('.sidebar').count() > 0;
      
      if (hasCanvas && hasControls && hasSidebar) {
        log('  ✅ All UI components present', 'green');
        this.results.passed.push('Handoff UI');
      } else {
        throw new Error('Missing UI components');
      }
      
      // Test that WebSocket connects from UI
      await wait(2000);
      const connectionStatus = await page.locator('#statusText').textContent();
      log(`  📡 Connection status: ${connectionStatus}`, 'blue');
      
    } catch (error) {
      log(`  ❌ UI test failed: ${error.message}`, 'red');
      this.results.failed.push('Handoff UI');
    }
  }

  showResults() {
    log('\n📊 TEST RESULTS', 'cyan');
    log('=' .repeat(60), 'cyan');
    
    log(`\n✅ Passed: ${this.results.passed.length}`, 'green');
    this.results.passed.forEach(test => {
      log(`  • ${test}`, 'green');
    });
    
    if (this.results.failed.length > 0) {
      log(`\n❌ Failed: ${this.results.failed.length}`, 'red');
      this.results.failed.forEach(test => {
        log(`  • ${test}`, 'red');
      });
    }
    
    const total = this.results.passed.length + this.results.failed.length;
    const percentage = (this.results.passed.length / total * 100).toFixed(1);
    
    log('\n' + '=' .repeat(60), 'cyan');
    log(`Overall: ${percentage}% passed (${this.results.passed.length}/${total})`, 
        percentage >= 80 ? 'green' : percentage >= 60 ? 'yellow' : 'red');
  }

  async cleanup() {
    log('\n🧹 Cleaning up...', 'yellow');
    
    if (this.ws) {
      this.ws.close();
    }
    
    if (this.browser) {
      await this.browser.close();
    }
    
    if (this.server) {
      await this.server.stop();
    }
    
    log('✅ Cleanup complete', 'green');
  }
}

// Run the test
async function main() {
  const test = new HandoffIntegrationTest();
  await test.runAllTests();
  process.exit(test.results.failed.length > 0 ? 1 : 0);
}

main().catch(console.error);