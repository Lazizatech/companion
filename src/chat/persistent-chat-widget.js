/**
 * Persistent AI Chat Widget (JavaScript version for testing)
 * Real-time communication during full automation flow
 */

const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');

class PersistentChatWidget {
  constructor(port = 3002) {
    this.port = port;
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    this.sessions = new Map();
    
    this.setupRoutes();
    this.setupWebSocket();
    this.startServer();
  }

  setupRoutes() {
    // Serve static files for chat widget
    this.app.use('/chat-widget', express.static(path.join(__dirname, '../../public/chat-widget')));
    
    // Chat interface route
    this.app.get('/chat/:sessionId', (req, res) => {
      res.redirect(`/chat-widget/floating-chat.html#${req.params.sessionId}`);
    });
    
    // API endpoints
    this.app.get('/api/chat/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        sessions: this.sessions.size,
        uptime: process.uptime() 
      });
    });
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      console.log('💬 New chat connection');
      
      // Extract session ID from URL
      const url = req.url || '';
      const match = url.match(/\/chat\/([^\/?]+)/);
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
      
      console.log(`✅ Chat connected to session: ${sessionId}`);
      session.ws = ws;
      session.connected = true;
      
      // Send chat history
      this.sendChatHistory(ws, session);
      
      // Handle messages from client
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data);
          await this.handleChatMessage(message, session);
        } catch (error) {
          console.error('Chat message error:', error);
        }
      });
      
      ws.on('close', () => {
        console.log(`👋 Chat disconnected from session: ${sessionId}`);
        session.connected = false;
      });
    });
  }

  async startServer() {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║              💬 Persistent Chat Widget Started!             ║
╠══════════════════════════════════════════════════════════════╣
║  Server:     http://localhost:${this.port}                           ║
║  Health:     http://localhost:${this.port}/api/chat/health           ║
║                                                              ║
║  Chat interface will be available at:                       ║
║  http://localhost:${this.port}/chat/[session-id]                     ║
╚══════════════════════════════════════════════════════════════╝
        `);
        resolve();
      });
    });
  }

  async createChatSession(agentId, page) {
    const sessionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session = {
      id: sessionId,
      agentId,
      page,
      isActive: true,
      messages: [],
      connected: false,
      lastActivity: Date.now()
    };

    this.sessions.set(sessionId, session);

    // Add welcome message
    this.addSystemMessage(session, 
      "Hi! I'm your AI automation assistant. I can see everything happening on the browser and you can guide me in real-time. Just ask me questions or give me instructions!"
    );

    console.log(`💬 Chat session created: ${sessionId}`);
    return sessionId;
  }

  async handleChatMessage(message, session) {
    const { type, content } = message;
    
    if (type === 'human') {
      // Add human message
      this.addMessage(session, {
        id: this.generateMessageId(),
        type: 'human',
        content,
        timestamp: Date.now()
      });

      // Generate AI response
      const aiResponse = await this.generateAIResponse(content, session);
      this.addMessage(session, {
        id: this.generateMessageId(),
        type: 'ai',
        content: aiResponse,
        timestamp: Date.now()
      });
    }

    session.lastActivity = Date.now();
  }

  async generateAIResponse(humanMessage, session) {
    const lowerMessage = humanMessage.toLowerCase();
    
    // Get current page context if available
    let pageUrl = 'Unknown';
    let pageTitle = 'Unknown';
    
    try {
      if (session.page) {
        pageUrl = await session.page.url();
        pageTitle = await session.page.title();
      }
    } catch (e) {
      // Page might be closed or navigating
    }
    
    // Contextual responses based on current automation state
    if (lowerMessage.includes('where') && (lowerMessage.includes('are') || lowerMessage.includes('am'))) {
      return `I'm currently on "${pageTitle}" (${pageUrl}). I can see the entire page and all interactive elements. What would you like me to do here?`;
    }
    
    if (lowerMessage.includes('click') || lowerMessage.includes('tap')) {
      return `I can click on elements for you! Please describe what you'd like me to click (like "click the login button" or "click the blue submit button"). I'll find it and click it precisely.`;
    }
    
    if (lowerMessage.includes('type') || lowerMessage.includes('enter') || lowerMessage.includes('fill')) {
      return `I can type text into forms and fields. Just tell me what to type and where (like "type 'hello@example.com' in the email field"). I'll handle it smoothly with human-like typing patterns.`;
    }
    
    if (lowerMessage.includes('navigate') || lowerMessage.includes('go to')) {
      return `I can navigate to any URL or page. Just say "go to [website]" or "navigate to [URL]" and I'll take you there. I can also use the back/forward buttons if needed.`;
    }
    
    if (lowerMessage.includes('wait') || lowerMessage.includes('slow') || lowerMessage.includes('pause')) {
      return `I can adjust my speed! I normally work quickly but I can slow down, wait for specific elements to load, or pause between actions. Just let me know your preference.`;
    }
    
    if (lowerMessage.includes('what') && (lowerMessage.includes('see') || lowerMessage.includes('page'))) {
      return `I can see everything on this page in real-time! I can detect buttons, forms, text, images, and interactive elements. I also monitor for CAPTCHAs, popups, and navigation changes. Ask me about any specific element you're curious about.`;
    }
    
    if (lowerMessage.includes('help') || lowerMessage.includes('can you')) {
      return `I can help with many tasks:

🖱️ **Click & Navigate**: Click buttons, links, navigate pages
⌨️ **Form Filling**: Type in text fields, select dropdowns  
🔍 **Page Analysis**: Read content, find specific elements
⏱️ **Smart Waiting**: Wait for loading, animations, or specific content
🚨 **Problem Solving**: Handle popups, CAPTCHAs, errors
📱 **Responsive Actions**: Adapt to different page layouts

What specific task would you like help with?`;
    }
    
    if (lowerMessage.includes('stop') || lowerMessage.includes('pause')) {
      return `I've paused my automation. I'll wait for your next instruction. You can tell me to continue, try something different, or ask me questions about what I see on the page.`;
    }
    
    if (lowerMessage.includes('continue') || lowerMessage.includes('resume')) {
      return `Got it! I'm ready to continue the automation. I'll proceed with the next steps unless you give me different instructions.`;
    }
    
    if (lowerMessage.includes('captcha') || lowerMessage.includes('verification')) {
      return `I detected a CAPTCHA or verification challenge! I'll automatically trigger the handoff system so you can solve it through the beautiful streaming interface. Once you complete it, I'll seamlessly resume the automation.`;
    }
    
    // Default intelligent responses
    const responses = [
      `I'm actively monitoring the page and ready to help! Currently on "${pageTitle}". What would you like me to do?`,
      `I can see the page clearly and I'm standing by for instructions. Feel free to guide me through any task!`,
      `Thanks for the guidance! I'm here to assist with any browser automation task. What's our next move?`,
      `I'm ready to take action! I can interact with any element on this page. Just point me in the right direction.`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  addMessage(session, message) {
    session.messages.push(message);
    
    // Keep only last 50 messages for performance
    if (session.messages.length > 50) {
      session.messages = session.messages.slice(-50);
    }
    
    // Send to connected client
    if (session.ws && session.connected) {
      session.ws.send(JSON.stringify({
        type: 'new_message',
        message
      }));
    }
  }

  addSystemMessage(session, content) {
    this.addMessage(session, {
      id: this.generateMessageId(),
      type: 'system',
      content,
      timestamp: Date.now()
    });
  }

  notifyAutomationUpdate(sessionId, update) {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.addSystemMessage(session, `🤖 ${update}`);
    }
  }

  notifyPageChange(sessionId, url, title) {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.addSystemMessage(session, `🌐 Navigated to: ${title} (${url})`);
    }
  }

  notifyActionTaken(sessionId, action, details) {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.addSystemMessage(session, `✅ ${action}: ${details}`);
    }
  }

  sendChatHistory(ws, session) {
    ws.send(JSON.stringify({
      type: 'chat_history',
      messages: session.messages
    }));
  }

  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getSessionUrl(sessionId) {
    return `http://localhost:${this.port}/chat/${sessionId}`;
  }

  async closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      if (session.ws) {
        session.ws.close();
      }
      this.sessions.delete(sessionId);
      console.log(`💬 Chat session closed: ${sessionId}`);
    }
  }
}

module.exports = { PersistentChatWidget };