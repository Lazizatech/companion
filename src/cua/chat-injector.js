/**
 * Chat Widget Injector
 * Injects floating chat widget directly into any automated browser page
 */

class ChatInjector {
  static async injectChatWidget(page, sessionId) {
    // Inject the floating chat widget directly into the page
    await page.addInitScript((sessionId) => {
      // Only inject once
      if (window.chatWidgetInjected) return;
      window.chatWidgetInjected = true;
      
      // Create the chat widget container
      const chatContainer = document.createElement('div');
      chatContainer.id = 'ai-chat-widget-container';
      
      const widgetHTML = `
        <div id="aiChatWidget" style="
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 380px;
          height: 500px;
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 1rem;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          z-index: 999999;
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        ">
          <div id="chatHeader" style="
            background: rgba(0, 0, 0, 0.3);
            padding: 1rem;
            border-radius: 1rem 1rem 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            user-select: none;
          ">
            <div style="display: flex; align-items: center; gap: 0.5rem; font-weight: 600;">
              <span>🤖</span>
              <span>AI Assistant</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; opacity: 0.8;">
              <div style="width: 8px; height: 8px; background: #10b981; border-radius: 50%; animation: pulse 2s infinite;"></div>
              <span>Active</span>
            </div>
            <button id="minimizeBtn" style="
              background: rgba(255, 255, 255, 0.1);
              border: none;
              color: white;
              width: 28px;
              height: 28px;
              border-radius: 0.375rem;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 0.875rem;
            ">−</button>
          </div>
          
          <div id="chatContent" style="
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          ">
            <div id="chatMessages" style="
              flex: 1;
              padding: 1rem;
              overflow-y: auto;
              display: flex;
              flex-direction: column;
              gap: 0.75rem;
              scrollbar-width: thin;
              scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
            "></div>
            
            <div style="
              border-top: 1px solid rgba(255, 255, 255, 0.1);
              padding: 0.75rem;
              background: rgba(0, 0, 0, 0.2);
              border-radius: 0 0 1rem 1rem;
            ">
              <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
                <button class="quick-action" data-message="Where are we?" style="
                  background: rgba(255, 255, 255, 0.1);
                  border: 1px solid rgba(255, 255, 255, 0.2);
                  color: white;
                  padding: 0.25rem 0.5rem;
                  border-radius: 1rem;
                  font-size: 0.75rem;
                  cursor: pointer;
                  white-space: nowrap;
                ">📍 Where are we?</button>
                <button class="quick-action" data-message="What can you see?" style="
                  background: rgba(255, 255, 255, 0.1);
                  border: 1px solid rgba(255, 255, 255, 0.2);
                  color: white;
                  padding: 0.25rem 0.5rem;
                  border-radius: 1rem;
                  font-size: 0.75rem;
                  cursor: pointer;
                  white-space: nowrap;
                ">👀 What can you see?</button>
                <button class="quick-action" data-message="Wait please" style="
                  background: rgba(255, 255, 255, 0.1);
                  border: 1px solid rgba(255, 255, 255, 0.2);
                  color: white;
                  padding: 0.25rem 0.5rem;
                  border-radius: 1rem;
                  font-size: 0.75rem;
                  cursor: pointer;
                  white-space: nowrap;
                ">⏸️ Wait</button>
                <button class="quick-action" data-message="Continue" style="
                  background: rgba(255, 255, 255, 0.1);
                  border: 1px solid rgba(255, 255, 255, 0.2);
                  color: white;
                  padding: 0.25rem 0.5rem;
                  border-radius: 1rem;
                  font-size: 0.75rem;
                  cursor: pointer;
                  white-space: nowrap;
                ">▶️ Continue</button>
              </div>
              <div style="display: flex; gap: 0.5rem; align-items: flex-end;">
                <textarea id="chatInput" placeholder="Guide me in real-time..." style="
                  flex: 1;
                  background: rgba(255, 255, 255, 0.1);
                  border: 1px solid rgba(255, 255, 255, 0.2);
                  border-radius: 0.5rem;
                  padding: 0.5rem 0.75rem;
                  color: white;
                  font-size: 0.875rem;
                  resize: none;
                  min-height: 36px;
                  max-height: 100px;
                  font-family: inherit;
                "></textarea>
                <button id="sendBtn" style="
                  background: #6366f1;
                  border: none;
                  color: white;
                  width: 36px;
                  height: 36px;
                  border-radius: 0.5rem;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 1rem;
                ">→</button>
              </div>
            </div>
          </div>
        </div>
      `;
      
      chatContainer.innerHTML = widgetHTML;
      
      // Add to page when DOM is ready
      function addChatWidget() {
        if (document.body) {
          document.body.appendChild(chatContainer);
          initializeChatWidget();
        } else {
          setTimeout(addChatWidget, 100);
        }
      }
      
      function initializeChatWidget() {
        const widget = document.getElementById('aiChatWidget');
        const header = document.getElementById('chatHeader');
        const minimizeBtn = document.getElementById('minimizeBtn');
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendBtn');
        const messagesContainer = document.getElementById('chatMessages');
        
        let isMinimized = false;
        let ws = null;
        let messageId = 0;
        
        // WebSocket connection
        function connectToChat() {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const wsUrl = protocol + '//' + window.location.hostname + ':3002/chat/' + sessionId;
          
          ws = new WebSocket(wsUrl);
          
          ws.onopen = () => {
            console.log('💬 Chat widget connected');
            addSystemMessage('Connected to AI assistant! 🚀');
          };
          
          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              handleMessage(data);
            } catch (error) {
              console.error('Chat message error:', error);
            }
          };
          
          ws.onclose = () => {
            console.log('💬 Chat widget disconnected');
            addSystemMessage('Disconnected. Attempting to reconnect...');
            setTimeout(connectToChat, 3000);
          };
        }
        
        function handleMessage(data) {
          if (data.type === 'new_message') {
            displayMessage(data.message);
          } else if (data.type === 'chat_history') {
            messagesContainer.innerHTML = '';
            data.messages.forEach(msg => displayMessage(msg));
          }
        }
        
        function displayMessage(message) {
          const messageEl = document.createElement('div');
          
          const isHuman = message.type === 'human';
          const avatar = message.type === 'ai' ? '🤖' : message.type === 'human' ? '👤' : '⚙️';
          const bgColor = message.type === 'ai' ? 'rgba(255, 255, 255, 0.1)' : 
                         message.type === 'human' ? '#6366f1' : '#ec4899';
          
          messageEl.style.cssText = `
            display: flex;
            gap: 0.5rem;
            align-items: flex-start;
            ${isHuman ? 'flex-direction: row-reverse;' : ''}
          `;
          
          messageEl.innerHTML = `
            <div style="
              width: 28px;
              height: 28px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 0.875rem;
              flex-shrink: 0;
              background: ${isHuman ? '#6366f1' : 'rgba(255, 255, 255, 0.1)'};
            ">${avatar}</div>
            <div style="flex: 1; min-width: 0; ${isHuman ? 'text-align: right;' : ''}">
              <div style="
                background: ${bgColor};
                border-radius: 1rem;
                padding: 0.75rem;
                font-size: 0.875rem;
                line-height: 1.4;
                word-wrap: break-word;
                white-space: pre-wrap;
              ">${message.content}</div>
              <div style="
                font-size: 0.7rem;
                opacity: 0.6;
                margin-top: 0.25rem;
              ">${new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          `;
          
          messagesContainer.appendChild(messageEl);
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        
        function addSystemMessage(content) {
          displayMessage({
            type: 'system',
            content,
            timestamp: Date.now()
          });
        }
        
        function sendMessage(content) {
          if (!content.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;
          
          // Add to UI immediately
          displayMessage({
            type: 'human',
            content,
            timestamp: Date.now()
          });
          
          // Send to server
          ws.send(JSON.stringify({
            type: 'human',
            content: content
          }));
        }
        
        // Event listeners
        minimizeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          isMinimized = !isMinimized;
          if (isMinimized) {
            widget.style.height = '60px';
            widget.style.width = '200px';
            document.getElementById('chatContent').style.display = 'none';
            minimizeBtn.textContent = '+';
          } else {
            widget.style.height = '500px';
            widget.style.width = '380px';
            document.getElementById('chatContent').style.display = 'flex';
            minimizeBtn.textContent = '−';
          }
        });
        
        chatInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const content = chatInput.value.trim();
            if (content) {
              sendMessage(content);
              chatInput.value = '';
            }
          }
        });
        
        sendBtn.addEventListener('click', () => {
          const content = chatInput.value.trim();
          if (content) {
            sendMessage(content);
            chatInput.value = '';
          }
        });
        
        // Quick action buttons
        document.querySelectorAll('.quick-action').forEach(btn => {
          btn.addEventListener('click', () => {
            const message = btn.getAttribute('data-message');
            sendMessage(message);
          });
        });
        
        // Make draggable
        let isDragging = false;
        let startX, startY, startLeft, startTop;
        
        header.addEventListener('mousedown', (e) => {
          if (e.target === minimizeBtn) return;
          
          isDragging = true;
          startX = e.clientX;
          startY = e.clientY;
          
          const rect = widget.getBoundingClientRect();
          startLeft = rect.left;
          startTop = rect.top;
          
          document.addEventListener('mousemove', onDrag);
          document.addEventListener('mouseup', onDragEnd);
        });
        
        function onDrag(e) {
          if (!isDragging) return;
          
          const deltaX = e.clientX - startX;
          const deltaY = e.clientY - startY;
          
          const newLeft = Math.max(0, Math.min(window.innerWidth - widget.offsetWidth, startLeft + deltaX));
          const newTop = Math.max(0, Math.min(window.innerHeight - widget.offsetHeight, startTop + deltaY));
          
          widget.style.left = newLeft + 'px';
          widget.style.top = newTop + 'px';
          widget.style.right = 'auto';
          widget.style.bottom = 'auto';
        }
        
        function onDragEnd() {
          isDragging = false;
          document.removeEventListener('mousemove', onDrag);
          document.removeEventListener('mouseup', onDragEnd);
        }
        
        // Connect to chat
        connectToChat();
        
        // Add welcome message
        setTimeout(() => {
          addSystemMessage('Hi! I am your AI automation assistant. I can see everything happening and you can guide me in real-time! 🚀');
        }, 1000);
      }
      
      // Add CSS animations
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        #aiChatWidget textarea::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }
        #aiChatWidget textarea:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
        }
        .quick-action:hover {
          background: rgba(255, 255, 255, 0.2) !important;
        }
      `;
      document.head.appendChild(style);
      
      // Start injection
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addChatWidget);
      } else {
        addChatWidget();
      }
    }, sessionId);
  }
}

module.exports = { ChatInjector };