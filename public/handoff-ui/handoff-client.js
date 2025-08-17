/**
 * Gorgeous Handoff Client
 * Smooth, responsive browser control with beautiful animations
 */

class HandoffClient {
  constructor() {
    this.ws = null;
    this.canvas = document.getElementById('browserCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.viewport = document.getElementById('viewport');
    this.mouseIndicator = document.getElementById('mouseIndicator');
    this.sessionId = this.getSessionId();
    this.isConnected = false;
    this.lastFrame = null;
    this.frameBuffer = [];
    this.smoothing = true;
    
    // Performance optimization
    this.rafId = null;
    this.lastMouseMove = 0;
    this.mouseThrottle = 16; // ~60fps for mouse movement
    
    this.init();
  }

  getSessionId() {
    const path = window.location.pathname;
    const match = path.match(/\/handoff\/([^\/]+)/);
    return match ? match[1] : null;
  }

  init() {
    if (!this.sessionId) {
      this.showError('No session ID found');
      return;
    }

    this.connect();
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/session/${this.sessionId}`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('✅ Connected to handoff session');
      this.isConnected = true;
      this.updateConnectionStatus('connected');
      this.hideLoading();
      this.showToast('Connected to browser session', 'success');
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.showToast('Connection error', 'error');
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      this.updateConnectionStatus('disconnected');
      this.showToast('Connection lost. Reconnecting...', 'warning');
      setTimeout(() => this.reconnect(), 3000);
    };
  }

  reconnect() {
    if (!this.isConnected) {
      this.connect();
    }
  }

  handleMessage(message) {
    switch (message.type) {
      case 'initial_state':
        this.setupInitialState(message.data);
        break;
        
      case 'frame':
        this.renderFrame(message.data, message.timestamp);
        break;
        
      case 'error':
        this.showError(message.message);
        break;
        
      case 'handoff_complete':
        this.handleHandoffComplete(message.data);
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  setupInitialState(data) {
    // Update UI with session info
    document.getElementById('handoffReason').textContent = data.reason;
    document.getElementById('urlBar').value = data.url;
    
    // Setup canvas dimensions
    if (data.viewport) {
      this.canvas.width = data.viewport.width;
      this.canvas.height = data.viewport.height;
    }
  }

  renderFrame(imageData, timestamp) {
    // Smooth frame rendering with requestAnimationFrame
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    
    this.rafId = requestAnimationFrame(() => {
      const img = new Image();
      img.onload = () => {
        // Smooth scaling
        this.ctx.imageSmoothingEnabled = this.smoothing;
        this.ctx.imageSmoothingQuality = 'high';
        
        // Clear and draw
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
        
        // Update frame counter for performance monitoring
        this.updateFrameRate(timestamp);
      };
      img.src = `data:image/jpeg;base64,${imageData}`;
    });
  }

  updateFrameRate(timestamp) {
    if (!this.lastFrame) {
      this.lastFrame = timestamp;
      return;
    }
    
    const delta = timestamp - this.lastFrame;
    const fps = Math.round(1000 / delta);
    this.lastFrame = timestamp;
    
    // Optionally display FPS
    // console.log(`FPS: ${fps}`);
  }

  setupEventListeners() {
    // Mouse events with smooth tracking
    this.viewport.addEventListener('mousemove', (e) => {
      const now = Date.now();
      if (now - this.lastMouseMove < this.mouseThrottle) return;
      this.lastMouseMove = now;
      
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
      
      this.updateMouseIndicator(e.clientX - rect.left, e.clientY - rect.top);
      this.sendMessage('move', { x, y });
    });

    this.viewport.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
      
      // Visual feedback
      this.showClickAnimation(e.clientX - rect.left, e.clientY - rect.top);
      this.sendMessage('click', { x, y });
    });

    // Scroll events
    this.viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.sendMessage('scroll', { deltaY: e.deltaY });
    });

    // Keyboard input
    document.addEventListener('keydown', (e) => {
      // Don't capture if typing in URL bar
      if (e.target.id === 'urlBar') return;
      
      // Special keys
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return; // Let shortcuts handle these
      }
      
      // Send key press
      this.sendMessage('key', { key: e.key });
    });

    // URL bar
    document.getElementById('urlBar').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const url = e.target.value;
        this.sendMessage('navigate', { url });
      }
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Alt + Left Arrow - Back
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        this.sendMessage('back', {});
      }
      
      // Alt + Right Arrow - Forward
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        this.sendMessage('forward', {});
      }
      
      // Ctrl/Cmd + R - Refresh
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        this.sendMessage('refresh', {});
      }
      
      // Ctrl/Cmd + S - Screenshot
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.sendMessage('screenshot', {});
        this.showToast('Screenshot captured!', 'success');
      }
      
      // Ctrl/Cmd + Enter - Complete handoff
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handoffControl.complete('solved');
      }
    });
  }

  updateMouseIndicator(x, y) {
    this.mouseIndicator.style.display = 'block';
    this.mouseIndicator.style.left = x + 'px';
    this.mouseIndicator.style.top = y + 'px';
  }

  showClickAnimation(x, y) {
    const ripple = document.createElement('div');
    ripple.style.position = 'absolute';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.style.width = '20px';
    ripple.style.height = '20px';
    ripple.style.borderRadius = '50%';
    ripple.style.border = '2px solid #ec4899';
    ripple.style.transform = 'translate(-50%, -50%)';
    ripple.style.pointerEvents = 'none';
    ripple.style.animation = 'ripple 0.6s ease-out';
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes ripple {
        to {
          width: 60px;
          height: 60px;
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
    
    this.viewport.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }

  sendMessage(type, data) {
    if (!this.isConnected || !this.ws) return;
    
    this.ws.send(JSON.stringify({ type, data }));
  }

  updateConnectionStatus(status) {
    const statusBadge = document.getElementById('connectionStatus');
    const statusText = document.getElementById('statusText');
    
    switch (status) {
      case 'connected':
        statusBadge.className = 'status-badge connected';
        statusText.textContent = 'Connected';
        break;
      case 'disconnected':
        statusBadge.className = 'status-badge waiting';
        statusText.textContent = 'Disconnected';
        break;
      default:
        statusBadge.className = 'status-badge waiting';
        statusText.textContent = 'Connecting...';
    }
  }

  hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 300);
  }

  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    
    // Set icon based on type
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    toast.querySelector('.toast-icon').textContent = icons[type] || icons.info;
    
    // Show toast
    toast.classList.add('show');
    
    // Hide after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  showError(message) {
    this.showToast(message, 'error');
    console.error('Handoff error:', message);
  }

  handleHandoffComplete(data) {
    this.showToast('Handoff completed successfully!', 'success');
    setTimeout(() => {
      window.close(); // Or redirect to dashboard
    }, 2000);
  }
}

// Browser control functions
const browserControl = {
  goBack() {
    client.sendMessage('back', {});
  },
  
  goForward() {
    client.sendMessage('forward', {});
  },
  
  refresh() {
    client.sendMessage('refresh', {});
  },
  
  screenshot() {
    client.sendMessage('screenshot', {});
    client.showToast('Screenshot captured!', 'success');
  }
};

// Handoff control functions
const handoffControl = {
  complete(resolution) {
    const reasons = {
      solved: 'CAPTCHA or verification solved',
      manual: 'Manual intervention completed',
      abort: 'Task aborted by operator'
    };
    
    client.sendMessage('complete_handoff', { 
      resolution,
      reason: reasons[resolution] || resolution
    });
    
    client.showToast('Completing handoff...', 'info');
  }
};

// Initialize client when DOM is ready
let client;
document.addEventListener('DOMContentLoaded', () => {
  client = new HandoffClient();
  
  // Add smooth page transitions
  document.body.style.opacity = '0';
  setTimeout(() => {
    document.body.style.transition = 'opacity 0.5s ease-in';
    document.body.style.opacity = '1';
  }, 100);
});