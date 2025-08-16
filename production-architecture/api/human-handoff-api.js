#!/usr/bin/env node

/**
 * Human Handoff API
 * 
 * Not just a pause - it's an interactive system that:
 * - Captures complete automation state
 * - Presents actionable options to humans
 * - Persists context across sessions
 * - Resumes exactly where it left off
 */

const express = require('express');
const axios = require('axios');

class HumanHandoffAPI {
  constructor(options = {}) {
    this.app = express();
    this.port = options.port || 9000;
    this.handoffs = new Map(); // Active handoff sessions
    this.completedHandoffs = new Map(); // Historical data
    
    this.setupRoutes();
    this.setupMiddleware();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static('public')); // For handoff UI
    
    // CORS for web interface
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
      next();
    });
  }

  setupRoutes() {
    // Create new handoff session
    this.app.post('/api/handoff', (req, res) => this.createHandoff(req, res));
    
    // Get handoff details
    this.app.get('/api/handoff/:id', (req, res) => this.getHandoff(req, res));
    
    // Submit human response
    this.app.post('/api/handoff/:id/respond', (req, res) => this.respondToHandoff(req, res));
    
    // List active handoffs
    this.app.get('/api/handoffs', (req, res) => this.listHandoffs(req, res));
    
    // Get handoff context (for debugging)
    this.app.get('/api/handoff/:id/context', (req, res) => this.getHandoffContext(req, res));
    
    // Resume automation after human action
    this.app.post('/api/handoff/:id/resume', (req, res) => this.resumeAutomation(req, res));
    
    // Web interface for human operators
    this.app.get('/handoff/:id', (req, res) => this.serveHandoffUI(req, res));
    
    // Dashboard for all handoffs
    this.app.get('/dashboard', (req, res) => this.serveDashboard(req, res));
  }

  async createHandoff(req, res) {
    const {
      brain_id,
      reason,
      task,
      context,
      options,
      urgency = 'normal',
      screenshot,
      page_state
    } = req.body;

    const handoffId = `handoff_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    const handoffData = {
      id: handoffId,
      brain_id,
      reason,
      task,
      context,
      options: options || ['continue', 'modify_approach', 'abort'],
      urgency,
      screenshot,
      page_state,
      status: 'waiting',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + (urgency === 'urgent' ? 5*60*1000 : 30*60*1000)).toISOString(),
      human_response: null,
      resolution_time: null
    };

    this.handoffs.set(handoffId, handoffData);
    
    console.log(`👤 Human handoff created: ${handoffId}`);
    console.log(`Reason: ${reason}`);
    console.log(`Options: ${options.join(', ')}`);

    // In production, trigger notifications here
    await this.notifyHumanOperators(handoffData);

    res.status(201).json({
      handoff_id: handoffId,
      status: 'created',
      web_interface: `http://localhost:${this.port}/handoff/${handoffId}`,
      api_endpoint: `/api/handoff/${handoffId}`,
      expires_at: handoffData.expires_at
    });
  }

  async getHandoff(req, res) {
    const handoffId = req.params.id;
    const handoff = this.handoffs.get(handoffId);
    
    if (!handoff) {
      return res.status(404).json({ error: 'Handoff not found' });
    }

    // Check if expired
    if (new Date() > new Date(handoff.expires_at)) {
      handoff.status = 'expired';
    }

    res.json({
      ...handoff,
      // Don't expose sensitive context in basic view
      context: undefined,
      screenshot: handoff.screenshot ? 'available' : 'none'
    });
  }

  async respondToHandoff(req, res) {
    const handoffId = req.params.id;
    const { action, comment, new_strategy, modifications } = req.body;
    
    const handoff = this.handoffs.get(handoffId);
    
    if (!handoff) {
      return res.status(404).json({ error: 'Handoff not found' });
    }

    if (handoff.status !== 'waiting') {
      return res.status(400).json({ error: `Handoff already ${handoff.status}` });
    }

    // Validate action is in available options
    if (!handoff.options.includes(action)) {
      return res.status(400).json({ 
        error: 'Invalid action', 
        available_options: handoff.options 
      });
    }

    const response = {
      action,
      comment,
      new_strategy,
      modifications,
      responded_by: req.headers['x-operator-id'] || 'anonymous',
      responded_at: new Date().toISOString()
    };

    handoff.human_response = response;
    handoff.status = 'responded';
    handoff.resolution_time = Date.now() - new Date(handoff.created_at).getTime();

    // Move to completed handoffs
    this.completedHandoffs.set(handoffId, handoff);

    console.log(`✅ Human response received for ${handoffId}: ${action}`);

    res.json({
      handoff_id: handoffId,
      status: 'responded',
      response,
      next_step: 'automation_will_resume'
    });

    // Trigger automation resume if applicable
    if (action === 'continue' || action === 'modify_approach') {
      await this.triggerAutomationResume(handoffId, response);
    }
  }

  async listHandoffs(req, res) {
    const { status, urgency } = req.query;
    
    let handoffs = Array.from(this.handoffs.values());
    
    if (status) {
      handoffs = handoffs.filter(h => h.status === status);
    }
    
    if (urgency) {
      handoffs = handoffs.filter(h => h.urgency === urgency);
    }

    // Sort by urgency and creation time
    handoffs.sort((a, b) => {
      if (a.urgency === 'urgent' && b.urgency !== 'urgent') return -1;
      if (b.urgency === 'urgent' && a.urgency !== 'urgent') return 1;
      return new Date(a.created_at) - new Date(b.created_at);
    });

    res.json({
      handoffs: handoffs.map(h => ({
        id: h.id,
        reason: h.reason,
        status: h.status,
        urgency: h.urgency,
        created_at: h.created_at,
        expires_at: h.expires_at,
        brain_id: h.brain_id
      })),
      total: handoffs.length,
      waiting: handoffs.filter(h => h.status === 'waiting').length,
      urgent: handoffs.filter(h => h.urgency === 'urgent').length
    });
  }

  async getHandoffContext(req, res) {
    const handoffId = req.params.id;
    const handoff = this.handoffs.get(handoffId);
    
    if (!handoff) {
      return res.status(404).json({ error: 'Handoff not found' });
    }

    res.json({
      id: handoffId,
      full_context: handoff.context,
      page_state: handoff.page_state,
      screenshot: handoff.screenshot,
      task_history: handoff.context?.attemptHistory || [],
      failure_patterns: handoff.context?.failurePatterns || []
    });
  }

  async resumeAutomation(req, res) {
    const handoffId = req.params.id;
    const { force = false } = req.body;
    
    const handoff = this.completedHandoffs.get(handoffId);
    
    if (!handoff) {
      return res.status(404).json({ error: 'Completed handoff not found' });
    }

    if (!handoff.human_response && !force) {
      return res.status(400).json({ error: 'No human response available' });
    }

    try {
      // Call back to the Flow Brain to resume
      const resumeResult = await this.callFlowBrainResume(handoff);
      
      res.json({
        handoff_id: handoffId,
        status: 'resumed',
        automation_result: resumeResult
      });
      
    } catch (error) {
      res.status(500).json({
        error: 'Failed to resume automation',
        details: error.message
      });
    }
  }

  // UI serving methods
  serveHandoffUI(req, res) {
    const handoffId = req.params.id;
    
    // In production, this would serve a proper React/Vue app
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Human Handoff - ${handoffId}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .handoff-card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .urgent { border-color: #ff4444; background-color: #fff5f5; }
        .options { margin: 20px 0; }
        .option { margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; }
        .option:hover { background-color: #f0f0f0; }
        .screenshot { max-width: 100%; margin: 20px 0; }
        .context { background-color: #f9f9f9; padding: 15px; border-radius: 4px; margin: 20px 0; }
        button { padding: 10px 20px; margin: 5px; border: none; border-radius: 4px; cursor: pointer; }
        .primary { background-color: #007bff; color: white; }
        .secondary { background-color: #6c757d; color: white; }
        .danger { background-color: #dc3545; color: white; }
    </style>
</head>
<body>
    <h1>🤖 Human Handoff Required</h1>
    <div id="handoff-content">Loading...</div>
    
    <script>
        async function loadHandoff() {
            try {
                const response = await fetch('/api/handoff/${handoffId}');
                const handoff = await response.json();
                
                const content = document.getElementById('handoff-content');
                content.innerHTML = \`
                    <div class="handoff-card \${handoff.urgency === 'urgent' ? 'urgent' : ''}">
                        <h2>🚨 \${handoff.reason}</h2>
                        <p><strong>Task:</strong> \${handoff.task?.description || 'N/A'}</p>
                        <p><strong>Status:</strong> \${handoff.status}</p>
                        <p><strong>Urgency:</strong> \${handoff.urgency}</p>
                        <p><strong>Created:</strong> \${new Date(handoff.created_at).toLocaleString()}</p>
                        
                        <div class="context">
                            <h3>📋 Context</h3>
                            <p>Previous attempts: \${handoff.context?.attemptHistory?.length || 0}</p>
                            <p>Current step: \${handoff.context?.currentStep || 0} / \${handoff.context?.totalSteps || 0}</p>
                        </div>
                        
                        <div class="options">
                            <h3>⚡ Available Actions</h3>
                            \${handoff.options.map(option => \`
                                <div class="option" onclick="selectOption('\${option}')">
                                    <strong>\${option.replace('_', ' ').toUpperCase()}</strong>
                                    <p>\${getOptionDescription(option)}</p>
                                </div>
                            \`).join('')}
                        </div>
                        
                        <div style="margin-top: 30px;">
                            <button class="primary" onclick="submitResponse('continue')">✅ Continue</button>
                            <button class="secondary" onclick="submitResponse('modify_approach')">🔧 Modify Approach</button>
                            <button class="danger" onclick="submitResponse('abort')">❌ Abort Task</button>
                        </div>
                    </div>
                \`;
            } catch (error) {
                document.getElementById('handoff-content').innerHTML = \`<p>Error loading handoff: \${error.message}</p>\`;
            }
        }
        
        function getOptionDescription(option) {
            const descriptions = {
                'continue': 'Let automation continue with current approach',
                'modify_approach': 'Change strategy and retry',
                'abort': 'Stop automation completely',
                'manual_intervention': 'I will handle this manually',
                'solve_captcha': 'I will solve the CAPTCHA',
                'try_different_approach': 'Try a completely different method'
            };
            return descriptions[option] || 'Choose this option';
        }
        
        function selectOption(option) {
            document.querySelectorAll('.option').forEach(o => o.style.backgroundColor = '');
            event.target.closest('.option').style.backgroundColor = '#e7f3ff';
            window.selectedOption = option;
        }
        
        async function submitResponse(action) {
            const comment = prompt('Add any comments or instructions (optional):');
            
            try {
                const response = await fetch('/api/handoff/${handoffId}/respond', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: action,
                        comment: comment || '',
                        responded_by: 'web_interface'
                    })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    alert('✅ Response submitted! Automation will resume.');
                    location.reload();
                } else {
                    alert('❌ Error: ' + result.error);
                }
            } catch (error) {
                alert('❌ Failed to submit response: ' + error.message);
            }
        }
        
        loadHandoff();
        
        // Auto-refresh every 30 seconds
        setInterval(loadHandoff, 30000);
    </script>
</body>
</html>`;

    res.send(html);
  }

  serveDashboard(req, res) {
    // Simple dashboard HTML
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Human Handoff Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .stats { display: flex; gap: 20px; margin: 20px 0; }
        .stat-card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; min-width: 150px; }
        .handoff-list { border: 1px solid #ddd; border-radius: 8px; margin: 20px 0; }
        .handoff-item { border-bottom: 1px solid #eee; padding: 15px; }
        .urgent { background-color: #fff5f5; border-left: 4px solid #ff4444; }
        .waiting { background-color: #fff9e6; border-left: 4px solid #ffa500; }
    </style>
</head>
<body>
    <h1>🤖 Human Handoff Dashboard</h1>
    <div id="dashboard-content">Loading...</div>
    
    <script>
        async function loadDashboard() {
            try {
                const response = await fetch('/api/handoffs');
                const data = await response.json();
                
                const content = document.getElementById('dashboard-content');
                content.innerHTML = \`
                    <div class="stats">
                        <div class="stat-card">
                            <h3>Total Handoffs</h3>
                            <p style="font-size: 2em; margin: 0;">\${data.total}</p>
                        </div>
                        <div class="stat-card">
                            <h3>Waiting</h3>
                            <p style="font-size: 2em; margin: 0; color: orange;">\${data.waiting}</p>
                        </div>
                        <div class="stat-card">
                            <h3>Urgent</h3>
                            <p style="font-size: 2em; margin: 0; color: red;">\${data.urgent}</p>
                        </div>
                    </div>
                    
                    <div class="handoff-list">
                        <h2>🚨 Active Handoffs</h2>
                        \${data.handoffs.map(handoff => \`
                            <div class="handoff-item \${handoff.urgency} \${handoff.status}">
                                <h3><a href="/handoff/\${handoff.id}">\${handoff.reason}</a></h3>
                                <p><strong>Status:</strong> \${handoff.status} | <strong>Urgency:</strong> \${handoff.urgency}</p>
                                <p><strong>Created:</strong> \${new Date(handoff.created_at).toLocaleString()}</p>
                                <p><strong>Brain:</strong> \${handoff.brain_id}</p>
                            </div>
                        \`).join('')}
                    </div>
                \`;
            } catch (error) {
                document.getElementById('dashboard-content').innerHTML = \`<p>Error loading dashboard: \${error.message}</p>\`;
            }
        }
        
        loadDashboard();
        setInterval(loadDashboard, 10000); // Refresh every 10 seconds
    </script>
</body>
</html>`;

    res.send(html);
  }

  // Integration methods
  async notifyHumanOperators(handoffData) {
    // In production, this would:
    // - Send Slack/Discord notifications
    // - Email alerts for urgent handoffs
    // - Push notifications to operator apps
    // - Log to monitoring systems
    
    console.log(`📢 Notifying operators: ${handoffData.urgency} handoff created`);
    console.log(`Web interface: http://localhost:${this.port}/handoff/${handoffData.id}`);
  }

  async triggerAutomationResume(handoffId, humanResponse) {
    // Call back to Flow Brain or agent coordinator to resume
    console.log(`🔄 Triggering automation resume for ${handoffId}`);
    
    // In production, this would make HTTP calls to resume the automation
    // For now, just log the action
    console.log(`Human action: ${humanResponse.action}`);
    if (humanResponse.comment) {
      console.log(`Human comment: ${humanResponse.comment}`);
    }
  }

  async callFlowBrainResume(handoff) {
    // Mock implementation - in production would call actual Flow Brain
    return {
      resumed: true,
      brain_id: handoff.brain_id,
      human_action: handoff.human_response.action,
      timestamp: new Date().toISOString()
    };
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`👤 Human Handoff API running on http://localhost:${this.port}`);
      console.log(`📊 Dashboard: http://localhost:${this.port}/dashboard`);
    });
  }
}

module.exports = HumanHandoffAPI;

// CLI usage
if (require.main === module) {
  const api = new HumanHandoffAPI({ port: 9000 });
  api.start();
}