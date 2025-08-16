#!/usr/bin/env node

// Simple standalone server for testing Companion API
// No browser dependencies, no complex frameworks

import { serve } from '@hono/node-server';
import app from './simple-api';

const port = parseInt(process.env.PORT || '8787');

console.log('🚀 Starting Simple Companion API Server...');
console.log('📋 Features:');
console.log('  • Agent management (create, list, get, delete)');
console.log('  • Task management (create, execute)');
console.log('  • Memory storage (get, store)');
console.log('  • Health monitoring');
console.log('  • No browser dependencies');
console.log('');

serve({
  fetch: app.fetch,
  port: port
}, (info) => {
  console.log(`✅ Companion API Server running on http://localhost:${info.port}`);
  console.log('');
  console.log('Available endpoints:');
  console.log(`  🏥 Health:          GET  http://localhost:${info.port}/health`);
  console.log(`  📋 API Info:        GET  http://localhost:${info.port}/`);
  console.log(`  👥 List Agents:     GET  http://localhost:${info.port}/cua/agents`);
  console.log(`  ➕ Create Agent:    POST http://localhost:${info.port}/cua/agents`);
  console.log(`  👤 Get Agent:       GET  http://localhost:${info.port}/cua/agents/:id`);
  console.log(`  ❌ Delete Agent:    DEL  http://localhost:${info.port}/cua/agents/:id`);
  console.log(`  📝 Create Task:     POST http://localhost:${info.port}/cua/agents/:id/tasks`);
  console.log(`  ⚡ Execute Task:    POST http://localhost:${info.port}/cua/agents/:id/tasks/:taskId/execute`);
  console.log(`  🧠 Get Memory:      GET  http://localhost:${info.port}/cua/memory/:agentId`);
  console.log(`  💾 Store Memory:    POST http://localhost:${info.port}/cua/memory/:agentId`);
  console.log('');
  console.log('Test with:');
  console.log(`  curl http://localhost:${info.port}/health`);
  console.log('');
});