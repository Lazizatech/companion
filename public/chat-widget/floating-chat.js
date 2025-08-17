/**
 * Floating Chat Widget JavaScript
 * Real-time communication with AI during automation
 */

class FloatingChatWidget {
  constructor() {
    this.ws = null;
    this.sessionId = this.getSessionId();
    this.isConnected = false;
    this.isCollapsed = false;
    this.isTyping = false;
    this.messageId = 0;
    
    // Make widget draggable
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    this.startLeft = 0;
    this.startTop = 0;
    
    this.init();
  }

  getSessionId() {
    // Extract session ID from URL fragment or parent window
    const hash = window.location.hash.substring(1);
    if (hash) return hash;
    
    // Try to get from parent window if in iframe
    try {
      if (window.parent && window.parent !== window) {
        return window.parent.chatSessionId || 'default';
      }
    } catch (e) {
      // Cross-origin, use default
    }
    
    return 'default';
  }

  init() {
    this.setupEventListeners();
    this.connect();
    this.makeDraggable();
    
    // Auto-resize textarea
    this.setupAutoResize();
    
    // Add welcome message
    this.addMessage('ai', "Hi! I'm your AI automation assistant. I can see everything happening and you can guide me in real-time! 🚀");
  }

  setupEventListeners() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    
    // Enter to send (Shift+Enter for new line)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    
    // Update send button state
    input.addEventListener('input', () => {
      sendBtn.disabled = !input.value.trim();
    });
    
    // Initial state
    sendBtn.disabled = true;
  }

  setupAutoResize() {
    const textarea = document.getElementById('chatInput');
    
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
    });
  }

  makeDraggable() {
    const widget = document.getElementById('chatWidget');
    const header = widget.querySelector('.chat-header');
    
    header.addEventListener('mousedown', (e) => {
      // Don't start dragging if clicking on controls
      if (e.target.closest('.chat-controls')) return;
      
      this.isDragging = true;
      this.startX = e.clientX;
      this.startY = e.clientY;
      
      const rect = widget.getBoundingClientRect();
      this.startLeft = rect.left;
      this.startTop = rect.top;
      
      widget.classList.add('dragging');
      document.addEventListener('mousemove', this.onDrag.bind(this));
      document.addEventListener('mouseup', this.onDragEnd.bind(this));
      
      e.preventDefault();
    });
  }

  onDrag(e) {
    if (!this.isDragging) return;
    
    const widget = document.getElementById('chatWidget');
    const deltaX = e.clientX - this.startX;
    const deltaY = e.clientY - this.startY;
    
    const newLeft = Math.max(0, Math.min(window.innerWidth - widget.offsetWidth, this.startLeft + deltaX));
    const newTop = Math.max(0, Math.min(window.innerHeight - widget.offsetHeight, this.startTop + deltaY));
    
    widget.style.left = newLeft + 'px';
    widget.style.top = newTop + 'px';
    widget.style.right = 'auto';
    widget.style.bottom = 'auto';
  }

  onDragEnd() {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    const widget = document.getElementById('chatWidget');
    widget.classList.remove('dragging');
    
    document.removeEventListener('mousemove', this.onDrag.bind(this));
    document.removeEventListener('mouseup', this.onDragEnd.bind(this));
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:3002/chat/${this.sessionId}`;
    
    this.updateConnectionStatus('connecting');
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('💬 Chat widget connected');
      this.isConnected = true;
      this.updateConnectionStatus('connected');
    };
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('Chat message parse error:', error);
      }
    };
    
    this.ws.onclose = () => {
      console.log('💬 Chat widget disconnected');
      this.isConnected = false;
      this.updateConnectionStatus('disconnected');
      
      // Attempt to reconnect
      setTimeout(() => this.connect(), 3000);
    };
    
    this.ws.onerror = (error) => {
      console.error('Chat WebSocket error:', error);
      this.updateConnectionStatus('disconnected');
    };
  }

  handleMessage(data) {
    switch (data.type) {
      case 'new_message':
        this.displayMessage(data.message);
        break;
      case 'chat_history':
        this.loadChatHistory(data.messages);
        break;
      case 'typing_indicator':
        this.showTypingIndicator();
        break;
      case 'stop_typing':
        this.hideTypingIndicator();
        break;
    }
  }

  loadChatHistory(messages) {
    const container = document.getElementById('chatMessages');
    container.innerHTML = '';
    
    messages.forEach(message => {
      this.displayMessage(message, false);
    });
    
    this.scrollToBottom();
  }

  displayMessage(message, animate = true) {
    const container = document.getElementById('chatMessages');
    const messageEl = document.createElement('div');
    messageEl.className = `message ${message.type}`;
    
    const avatar = this.getAvatar(message.type);
    const time = new Date(message.timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    messageEl.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">
        <div class="message-text">${this.formatMessageContent(message.content)}</div>
        <div class="message-time">${time}</div>
      </div>
    `;
    
    if (animate) {
      messageEl.style.opacity = '0';
      messageEl.style.transform = 'translateY(20px)';
    }
    
    container.appendChild(messageEl);
    
    if (animate) {
      requestAnimationFrame(() => {
        messageEl.style.transition = 'all 0.3s ease-out';
        messageEl.style.opacity = '1';
        messageEl.style.transform = 'translateY(0)';
      });
    }
    
    this.scrollToBottom();
  }

  getAvatar(type) {
    switch (type) {
      case 'ai': return '🤖';
      case 'human': return '👤';
      case 'system': return '⚙️';
      default: return '💬';
    }
  }

  formatMessageContent(content) {
    // Basic formatting for markdown-like syntax
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  addMessage(type, content) {
    const message = {
      id: `msg_${++this.messageId}`,
      type,
      content,
      timestamp: Date.now()
    };
    
    this.displayMessage(message);
  }

  sendMessage() {
    const input = document.getElementById('chatInput');
    const content = input.value.trim();
    
    if (!content || !this.isConnected) return;
    
    // Add to UI immediately
    this.addMessage('human', content);
    
    // Send to server
    this.ws.send(JSON.stringify({
      type: 'human',
      content: content
    }));
    
    // Clear input
    input.value = '';
    input.style.height = 'auto';
    document.getElementById('sendBtn').disabled = true;
    
    // Show typing indicator after a short delay
    setTimeout(() => {
      this.showTypingIndicator();
      
      // Hide typing indicator after AI response time
      setTimeout(() => {
        this.hideTypingIndicator();
      }, 1000 + Math.random() * 2000);
    }, 500);
  }

  quickMessage(message) {
    const input = document.getElementById('chatInput');
    input.value = message;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    document.getElementById('sendBtn').disabled = false;
    input.focus();
  }

  showTypingIndicator() {
    if (this.isTyping) return;
    
    this.isTyping = true;
    const container = document.getElementById('chatMessages');
    
    const typingEl = document.createElement('div');
    typingEl.className = 'message ai';
    typingEl.id = 'typingIndicator';
    
    typingEl.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="typing-indicator">
        <div class="typing-dots">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
        <span>AI is thinking...</span>
      </div>
    `;
    
    container.appendChild(typingEl);
    this.scrollToBottom();
  }

  hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
      indicator.remove();
    }
    this.isTyping = false;
  }

  scrollToBottom() {
    const container = document.getElementById('chatMessages');
    container.scrollTop = container.scrollHeight;
  }

  updateConnectionStatus(status) {
    const statusEl = document.getElementById('connectionStatus');
    
    switch (status) {
      case 'connected':
        statusEl.textContent = 'Connected';
        statusEl.className = 'connection-status';
        break;
      case 'connecting':
        statusEl.textContent = 'Connecting...';
        statusEl.className = 'connection-status connecting';
        break;
      case 'disconnected':
        statusEl.textContent = 'Disconnected';
        statusEl.className = 'connection-status disconnected';
        break;
    }
  }
}

// Global functions
function toggleChat() {
  const widget = document.getElementById('chatWidget');
  widget.classList.toggle('collapsed');
}

function clearChat() {
  const container = document.getElementById('chatMessages');
  container.innerHTML = '';
  chatWidget.addMessage('system', 'Chat cleared. How can I help you? 🤖');
}

function sendMessage() {
  chatWidget.sendMessage();
}

function quickMessage(message) {
  chatWidget.quickMessage(message);
}

// Initialize chat widget
let chatWidget;
document.addEventListener('DOMContentLoaded', () => {
  chatWidget = new FloatingChatWidget();
  
  // Smooth page transitions
  document.body.style.opacity = '0';
  setTimeout(() => {
    document.body.style.transition = 'opacity 0.5s ease-in';
    document.body.style.opacity = '1';
  }, 100);
});