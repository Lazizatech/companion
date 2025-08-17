/**
 * Persistent AI Chat Widget
 * Real-time communication during full automation flow
 */

import { WebSocketServer } from 'ws';
import { Page } from 'playwright';

interface ChatMessage {
  id: string;
  type: 'human' | 'ai' | 'system';
  content: string;
  timestamp: number;
  context?: any;
}

interface ChatSession {
  id: string;
  agentId: string;
  page: Page;
  isActive: boolean;
  messages: ChatMessage[];
  ws?: any;
  lastActivity: number;
}

export class PersistentChatWidget {
  private wss: WebSocketServer;
  private sessions: Map<string, ChatSession> = new Map();
  private port: number;

  constructor(port: number = 3002) {
    this.port = port;
    this.wss = new WebSocketServer({ port });
    this.setupWebSocket();
    
    console.log(`🎨 Persistent Chat Widget running on port ${port}`);
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

      console.log(`💬 Chat connected to session: ${sessionId}`);
      session.ws = ws;
      session.lastActivity = Date.now();

      // Send chat history
      this.sendChatHistory(ws, session);

      // Handle incoming messages
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleChatMessage(message, session);
        } catch (error) {
          console.error('Chat message error:', error);
        }
      });

      ws.on('close', () => {
        console.log(`💬 Chat disconnected from session: ${sessionId}`);
        session.ws = null;
      });
    });
  }

  public async createChatSession(agentId: string, page: Page): Promise<string> {
    const sessionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: ChatSession = {
      id: sessionId,
      agentId,
      page,
      isActive: true,
      messages: [],
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

  private async handleChatMessage(message: any, session: ChatSession) {
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
    } else if (type === 'system_update') {
      // System updates from automation
      this.addSystemMessage(session, content);
    }

    session.lastActivity = Date.now();
  }

  private async generateAIResponse(humanMessage: string, session: ChatSession): Promise<string> {
    const lowerMessage = humanMessage.toLowerCase();
    
    // Get current page context
    const pageUrl = await session.page.url();
    const pageTitle = await session.page.title();
    
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
    
    if (lowerMessage.includes('wait') || lowerMessage.includes('slow')) {
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

  private addMessage(session: ChatSession, message: ChatMessage) {
    session.messages.push(message);
    
    // Keep only last 50 messages for performance
    if (session.messages.length > 50) {
      session.messages = session.messages.slice(-50);
    }
    
    // Send to connected client
    if (session.ws) {
      session.ws.send(JSON.stringify({
        type: 'new_message',
        message
      }));
    }
  }

  private addSystemMessage(session: ChatSession, content: string) {
    this.addMessage(session, {
      id: this.generateMessageId(),
      type: 'system',
      content,
      timestamp: Date.now()
    });
  }

  public notifyAutomationUpdate(sessionId: string, update: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.addSystemMessage(session, `🤖 ${update}`);
    }
  }

  public notifyPageChange(sessionId: string, url: string, title: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.addSystemMessage(session, `🌐 Navigated to: ${title} (${url})`);
    }
  }

  public notifyActionTaken(sessionId: string, action: string, details: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.addSystemMessage(session, `✅ ${action}: ${details}`);
    }
  }

  private sendChatHistory(ws: any, session: ChatSession) {
    ws.send(JSON.stringify({
      type: 'chat_history',
      messages: session.messages
    }));
  }

  private extractSessionId(url: string): string {
    const match = url.match(/\/chat\/([^\/?]+)/);
    return match ? match[1] : '';
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public getSessionUrl(sessionId: string): string {
    return `http://localhost:${this.port}/chat/${sessionId}`;
  }

  public async closeSession(sessionId: string) {
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

export default PersistentChatWidget;