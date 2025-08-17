/**
 * Beautiful Browser Streaming Server
 * Real-time browser control with smooth handoff experience
 */

import { WebSocketServer } from 'ws';
import { Page, Browser } from 'playwright';
import express from 'express';
import { createServer } from 'http';
import sharp from 'sharp';

interface HandoffSession {
  id: string;
  page: Page;
  browser: Browser;
  reason: string;
  startTime: Date;
  isActive: boolean;
  humanConnected: boolean;
  streamInterval?: NodeJS.Timer;
  lastActivity: Date;
  context: any;
}

export class BrowserStreamServer {
  private wss: WebSocketServer;
  private sessions: Map<string, HandoffSession> = new Map();
  private app: express.Application;
  private server: any;
  private frameRate = 30; // 30 FPS for smooth experience

  constructor(port: number = 3001) {
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    
    this.setupRoutes();
    this.setupWebSocket();
    this.server.listen(port, () => {
      console.log(`🎨 Beautiful Browser Stream Server running on port ${port}`);
    });
  }

  private setupRoutes() {
    // Serve the gorgeous handoff UI
    this.app.use(express.static('public/handoff-ui'));
    
    // API endpoints
    this.app.get('/api/sessions', (req, res) => {
      const activeSessions = Array.from(this.sessions.values()).map(s => ({
        id: s.id,
        reason: s.reason,
        startTime: s.startTime,
        isActive: s.isActive,
        humanConnected: s.humanConnected
      }));
      res.json(activeSessions);
    });

    this.app.get('/api/session/:id', (req, res) => {
      const session = this.sessions.get(req.params.id);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json({
        id: session.id,
        reason: session.reason,
        context: session.context,
        isActive: session.isActive
      });
    });
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      const sessionId = this.extractSessionId(req.url || '');
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Session not found' 
        }));
        ws.close();
        return;
      }

      console.log(`👤 Human operator connected to session ${sessionId}`);
      session.humanConnected = true;
      session.lastActivity = new Date();

      // Send initial state
      this.sendInitialState(ws, session);

      // Start streaming browser viewport
      this.startStreaming(ws, session);

      // Handle human input
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleHumanInput(message, session);
          session.lastActivity = new Date();
        } catch (error) {
          console.error('Error handling message:', error);
        }
      });

      ws.on('close', () => {
        console.log(`👤 Human operator disconnected from session ${sessionId}`);
        session.humanConnected = false;
        if (session.streamInterval) {
          clearInterval(session.streamInterval);
        }
      });
    });
  }

  private async sendInitialState(ws: any, session: HandoffSession) {
    try {
      // Get current page info
      const url = await session.page.url();
      const title = await session.page.title();
      const viewport = await session.page.viewportSize();
      
      ws.send(JSON.stringify({
        type: 'initial_state',
        data: {
          url,
          title,
          viewport,
          reason: session.reason,
          context: session.context
        }
      }));

      // Send initial screenshot
      const screenshot = await this.captureOptimizedScreenshot(session.page);
      ws.send(JSON.stringify({
        type: 'frame',
        data: screenshot
      }));
    } catch (error) {
      console.error('Error sending initial state:', error);
    }
  }

  private async startStreaming(ws: any, session: HandoffSession) {
    // Clear any existing interval
    if (session.streamInterval) {
      clearInterval(session.streamInterval);
    }

    // Stream at specified framerate
    session.streamInterval = setInterval(async () => {
      if (!session.humanConnected || !session.isActive) {
        if (session.streamInterval) {
          clearInterval(session.streamInterval);
        }
        return;
      }

      try {
        const screenshot = await this.captureOptimizedScreenshot(session.page);
        ws.send(JSON.stringify({
          type: 'frame',
          data: screenshot,
          timestamp: Date.now()
        }));
      } catch (error) {
        // Page might be navigating or closed
      }
    }, 1000 / this.frameRate);
  }

  private async captureOptimizedScreenshot(page: Page): Promise<string> {
    // Capture screenshot with optimization for streaming
    const screenshot = await page.screenshot({ 
      type: 'jpeg',
      quality: 85, // Good quality vs size tradeoff
      fullPage: false
    });

    // Optional: Resize for better performance if needed
    // const optimized = await sharp(screenshot)
    //   .resize(1280, 720, { fit: 'inside' })
    //   .jpeg({ quality: 85 })
    //   .toBuffer();

    return screenshot.toString('base64');
  }

  private async handleHumanInput(message: any, session: HandoffSession) {
    const { type, data } = message;

    switch (type) {
      case 'click':
        await session.page.mouse.click(data.x, data.y);
        break;

      case 'move':
        await session.page.mouse.move(data.x, data.y);
        break;

      case 'scroll':
        await session.page.mouse.wheel(0, data.deltaY);
        break;

      case 'type':
        await session.page.keyboard.type(data.text);
        break;

      case 'key':
        await session.page.keyboard.press(data.key);
        break;

      case 'navigate':
        await session.page.goto(data.url);
        break;

      case 'back':
        await session.page.goBack();
        break;

      case 'forward':
        await session.page.goForward();
        break;

      case 'refresh':
        await session.page.reload();
        break;

      case 'screenshot':
        const screenshot = await session.page.screenshot({ type: 'png', fullPage: true });
        // Send high quality screenshot
        break;

      case 'complete_handoff':
        await this.completeHandoff(session.id, data.resolution);
        break;

      default:
        console.log('Unknown message type:', type);
    }
  }

  public async createHandoffSession(
    page: Page, 
    browser: Browser, 
    reason: string, 
    context?: any
  ): Promise<string> {
    const sessionId = `handoff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: HandoffSession = {
      id: sessionId,
      page,
      browser,
      reason,
      startTime: new Date(),
      isActive: true,
      humanConnected: false,
      lastActivity: new Date(),
      context
    };

    this.sessions.set(sessionId, session);
    
    console.log(`🚨 Handoff session created: ${sessionId}`);
    console.log(`📝 Reason: ${reason}`);
    
    // Notify dashboard
    this.broadcastSessionUpdate();
    
    return sessionId;
  }

  private async completeHandoff(sessionId: string, resolution: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.isActive = false;
    
    console.log(`✅ Handoff completed: ${sessionId}`);
    console.log(`📊 Resolution: ${resolution}`);
    
    // Clean up after a delay
    setTimeout(() => {
      if (session.streamInterval) {
        clearInterval(session.streamInterval);
      }
      this.sessions.delete(sessionId);
    }, 5000);

    this.broadcastSessionUpdate();
  }

  private broadcastSessionUpdate() {
    const update = {
      type: 'sessions_update',
      data: Array.from(this.sessions.values()).map(s => ({
        id: s.id,
        reason: s.reason,
        isActive: s.isActive,
        humanConnected: s.humanConnected
      }))
    };

    this.wss.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify(update));
      }
    });
  }

  private extractSessionId(url: string): string {
    const match = url.match(/\/session\/([^\/]+)/);
    return match ? match[1] : '';
  }

  public getHandoffUrl(sessionId: string): string {
    return `http://localhost:3001/handoff/${sessionId}`;
  }
}

// Export for use in CUA engine
export default BrowserStreamServer;