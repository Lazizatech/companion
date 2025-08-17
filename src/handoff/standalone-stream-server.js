/**
 * Standalone Browser Stream Server
 * Run with: node src/handoff/standalone-stream-server.js
 */

const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

class BrowserStreamServer {
  constructor(port = 3001) {
    this.port = port;
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    this.sessions = new Map();
    this.browsers = new Map();
    
    this.setupRoutes();
    this.setupWebSocket();
  }

  setupRoutes() {
    // Serve static files
    this.app.use('/handoff-ui', express.static(path.join(__dirname, '../../public/handoff-ui')));
    
    // Redirect handoff URLs to the UI
    this.app.get('/handoff/:sessionId', (req, res) => {
      res.redirect(`/handoff-ui/index.html#${req.params.sessionId}`);
    });
    
    // API endpoints
    this.app.get('/api/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        sessions: this.sessions.size,
        uptime: process.uptime() 
      });
    });
    
    this.app.get('/api/sessions', (req, res) => {
      const sessions = Array.from(this.sessions.values()).map(s => ({
        id: s.id,
        reason: s.reason,
        createdAt: s.createdAt,
        isActive: s.isActive
      }));
      res.json(sessions);
    });
    
    // Create test session endpoint
    this.app.post('/api/test-session', express.json(), async (req, res) => {
      try {
        const sessionId = await this.createTestSession(req.body.url || 'https://www.google.com/recaptcha/api2/demo');
        res.json({ 
          success: true, 
          sessionId,
          handoffUrl: `http://localhost:${this.port}/handoff/${sessionId}`
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      console.log('🔌 New WebSocket connection');
      
      // Extract session ID from URL
      const url = req.url || '';
      const match = url.match(/\/session\/([^\/]+)/);
      const sessionId = match ? match[1] : null;
      
      if (!sessionId) {
        ws.send(JSON.stringify({ type: 'error', message: 'No session ID provided' }));
        ws.close();
        return;
      }
      
      const session = this.sessions.get(sessionId);
      if (!session) {
        ws.send(JSON.stringify({ type: 'error', message: 'Session not found' }));
        ws.close();
        return;
      }
      
      console.log(`✅ Client connected to session: ${sessionId}`);
      session.ws = ws;
      session.connected = true;
      
      // Send initial state
      this.sendInitialState(ws, session);
      
      // Start streaming
      this.startStreaming(session);
      
      // Handle messages from client
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data);
          await this.handleClientMessage(message, session);
        } catch (error) {
          console.error('Error handling message:', error);
        }
      });
      
      ws.on('close', () => {
        console.log(`👋 Client disconnected from session: ${sessionId}`);
        session.connected = false;
        if (session.streamInterval) {
          clearInterval(session.streamInterval);
        }
      });
    });
  }

  async sendInitialState(ws, session) {
    try {
      const page = session.page;
      const url = await page.url();
      const title = await page.title();
      
      ws.send(JSON.stringify({
        type: 'initial_state',
        data: {
          url,
          title,
          reason: session.reason,
          viewport: await page.viewportSize()
        }
      }));
      
      // Send first frame
      const screenshot = await page.screenshot({ type: 'jpeg', quality: 85 });
      ws.send(JSON.stringify({
        type: 'frame',
        data: screenshot.toString('base64'),
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error sending initial state:', error);
    }
  }

  startStreaming(session) {
    if (session.streamInterval) {
      clearInterval(session.streamInterval);
    }
    
    // Stream at 10 FPS (lower for testing)
    session.streamInterval = setInterval(async () => {
      if (!session.connected || !session.ws || session.ws.readyState !== WebSocket.OPEN) {
        clearInterval(session.streamInterval);
        return;
      }
      
      try {
        const screenshot = await session.page.screenshot({ 
          type: 'jpeg', 
          quality: 70 
        });
        
        session.ws.send(JSON.stringify({
          type: 'frame',
          data: screenshot.toString('base64'),
          timestamp: Date.now()
        }));
      } catch (error) {
        // Page might be navigating
      }
    }, 100); // 10 FPS
  }

  async handleClientMessage(message, session) {
    const { type, data } = message;
    const page = session.page;
    
    console.log(`📨 Received: ${type}`, data);
    
    try {
      switch (type) {
        case 'click':
          await page.mouse.click(data.x, data.y);
          console.log(`🖱️ Clicked at (${data.x}, ${data.y})`);
          break;
          
        case 'move':
          await page.mouse.move(data.x, data.y);
          break;
          
        case 'type':
          await page.keyboard.type(data.text);
          console.log(`⌨️ Typed: ${data.text}`);
          break;
          
        case 'key':
          await page.keyboard.press(data.key);
          console.log(`⌨️ Key press: ${data.key}`);
          break;
          
        case 'scroll':
          await page.mouse.wheel(0, data.deltaY);
          break;
          
        case 'navigate':
          await page.goto(data.url);
          console.log(`🌐 Navigated to: ${data.url}`);
          break;
          
        case 'back':
          await page.goBack();
          break;
          
        case 'forward':
          await page.goForward();
          break;
          
        case 'refresh':
          await page.reload();
          break;
          
        case 'complete_handoff':
          console.log(`✅ Handoff completed: ${data.resolution}`);
          session.isActive = false;
          // Could resume automation here
          break;
          
        default:
          console.log(`Unknown message type: ${type}`);
      }
    } catch (error) {
      console.error(`Error handling ${type}:`, error);
      session.ws.send(JSON.stringify({
        type: 'error',
        message: `Failed to ${type}: ${error.message}`
      }));
    }
  }

  async createTestSession(url = 'https://www.google.com/recaptcha/api2/demo') {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🚀 Creating test session: ${sessionId}`);
    
    // Launch browser
    const browser = await chromium.launch({ 
      headless: false,
      args: ['--disable-blink-features=AutomationControlled']
    });
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });
    
    const page = await context.newPage();
    
    // Navigate to test page
    await page.goto(url);
    
    // Store session
    const session = {
      id: sessionId,
      page,
      browser,
      context,
      reason: 'CAPTCHA verification required',
      createdAt: new Date(),
      isActive: true,
      connected: false
    };
    
    this.sessions.set(sessionId, session);
    this.browsers.set(sessionId, browser);
    
    console.log(`✅ Session created: ${sessionId}`);
    console.log(`🌐 Navigated to: ${url}`);
    console.log(`🎨 Handoff URL: http://localhost:${this.port}/handoff/${sessionId}`);
    
    return sessionId;
  }

  async start() {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║          🎨 Browser Stream Server Started!                   ║
╠══════════════════════════════════════════════════════════════╣
║  Server:     http://localhost:${this.port}                           ║
║  Health:     http://localhost:${this.port}/api/health                ║
║  Sessions:   http://localhost:${this.port}/api/sessions              ║
║                                                              ║
║  Test CAPTCHA page:                                         ║
║  curl -X POST http://localhost:${this.port}/api/test-session         ║
╚══════════════════════════════════════════════════════════════╝
        `);
        resolve();
      });
    });
  }

  async stop() {
    // Clean up all sessions
    for (const [id, session] of this.sessions) {
      if (session.streamInterval) {
        clearInterval(session.streamInterval);
      }
      if (session.browser) {
        await session.browser.close();
      }
    }
    
    this.wss.close();
    this.server.close();
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new BrowserStreamServer(3001);
  server.start().catch(console.error);
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
}

module.exports = BrowserStreamServer;