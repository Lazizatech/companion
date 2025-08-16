const express = require('express');
const DefinitiveCUA = require('./cua.js');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Store active CUA instances
const cuaInstances = new Map();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'cua-browser' });
});

// Create browser session
app.post('/api/v1/browser/sessions', async (req, res) => {
  try {
    const { headless = true, useVision = false } = req.body;
    const sessionId = Date.now().toString();
    
    console.log(`🌐 Creating browser session ${sessionId} (headless: ${headless}, vision: ${useVision})`);
    
    const cua = new DefinitiveCUA({ headless, useVision });
    await cua.init();
    
    cuaInstances.set(sessionId, cua);
    
    res.json({
      id: sessionId,
      status: 'active',
      headless,
      useVision,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Session creation failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Execute browser action
app.post('/api/v1/browser/sessions/:id/actions', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, target, value, options } = req.body;
    
    console.log(`⚡ Executing action: ${action} for session ${id}`);
    
    const cua = cuaInstances.get(id);
    if (!cua) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    let result;
    switch (action) {
      case 'navigate':
        result = await cua.navigate(target);
        break;
      case 'execute_task':
        result = await cua.executeTask(target);
        break;
      case 'screenshot':
        result = await cua.screenshot();
        break;
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
    
    console.log(`✅ Action completed: ${action}`);
    res.json({ success: true, result });
  } catch (error) {
    console.error(`❌ Action failed:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get session details
app.get('/api/v1/browser/sessions/:id', (req, res) => {
  const { id } = req.params;
  const cua = cuaInstances.get(id);
  
  if (!cua) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({
    id,
    status: 'active',
    memory: cua.getMemory(),
    created_at: new Date().toISOString()
  });
});

// Close session
app.delete('/api/v1/browser/sessions/:id', async (req, res) => {
  const { id } = req.params;
  const cua = cuaInstances.get(id);
  
  if (!cua) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  console.log(`🔒 Closing browser session ${id}`);
  await cua.close();
  cuaInstances.delete(id);
  
  res.status(204).send();
});

// List sessions
app.get('/api/v1/browser/sessions', (req, res) => {
  const sessions = Array.from(cuaInstances.keys()).map(id => ({
    id,
    status: 'active',
    created_at: new Date().toISOString()
  }));
  
  res.json({ sessions, total: sessions.length });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'CUA Browser Service',
    version: '1.0.0',
    features: [
      'Browser automation with Playwright',
      'AI vision analysis',
      'Anti-detection measures',
      'Multi-session support'
    ],
    endpoints: {
      health: 'GET /health',
      sessions: {
        create: 'POST /api/v1/browser/sessions',
        list: 'GET /api/v1/browser/sessions',
        get: 'GET /api/v1/browser/sessions/:id',
        delete: 'DELETE /api/v1/browser/sessions/:id'
      },
      actions: {
        execute: 'POST /api/v1/browser/sessions/:id/actions'
      }
    }
  });
});

app.listen(port, () => {
  console.log('🌐 CUA Browser Service starting...');
  console.log('📋 Features:');
  console.log('  • Playwright browser automation');
  console.log('  • AI vision analysis'); 
  console.log('  • Anti-detection measures');
  console.log('  • Multi-session support');
  console.log('');
  console.log(`✅ CUA Browser Service running on http://localhost:${port}`);
  console.log('');
  console.log('Available endpoints:');
  console.log(`  🏥 Health:           GET  http://localhost:${port}/health`);
  console.log(`  📋 Service Info:     GET  http://localhost:${port}/`);
  console.log(`  ➕ Create Session:   POST http://localhost:${port}/api/v1/browser/sessions`);
  console.log(`  👥 List Sessions:    GET  http://localhost:${port}/api/v1/browser/sessions`);
  console.log(`  👤 Get Session:      GET  http://localhost:${port}/api/v1/browser/sessions/:id`);
  console.log(`  ❌ Delete Session:   DEL  http://localhost:${port}/api/v1/browser/sessions/:id`);
  console.log(`  ⚡ Execute Action:   POST http://localhost:${port}/api/v1/browser/sessions/:id/actions`);
  console.log('');
  console.log('Test with:');
  console.log(`  curl http://localhost:${port}/health`);
  console.log('');
});