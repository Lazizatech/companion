import express from 'express';
import cors from 'cors';
import { createDB } from './db';
import agentRoutes from './endpoints/cua/agent';
import taskRoutes from './endpoints/tasks/router';
import { Hono } from 'hono';
import { handle } from 'hono/vercel';

// Import the main app from index.ts
import { app as honoApp } from './index';

const app = express();
const PORT = process.env.PORT || 8787;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'CUA Companion API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Convert Hono app to Express middleware
app.use(async (req, res, next) => {
  try {
    // Create a mock D1 database for standalone mode
    const mockD1 = {
      prepare: (sql: string) => ({
        bind: (...args: any[]) => ({
          run: async () => ({ success: true }),
          all: async () => []
        })
      })
    };

    const db = createDB(mockD1 as any);
    
    // Add database to request context
    (req as any).db = db;
    
    // Convert Express request to Hono request
    const honoReq = new Request(`http://localhost${req.url}`, {
      method: req.method,
      headers: req.headers as any,
      body: req.body ? JSON.stringify(req.body) : undefined
    });

    // Handle with Hono app
    const honoRes = await honoApp.fetch(honoReq);
    
    // Convert Hono response back to Express
    const data = await honoRes.json();
    res.status(honoRes.status).json(data);
  } catch (error) {
    console.error('Error in Hono middleware:', error);
    next(error);
  }
});

// Standalone-specific endpoints
app.get('/standalone/health', (req, res) => {
  res.json({
    status: 'healthy',
    mode: 'standalone',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Express error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 CUA Companion API running in standalone mode on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/`);
  console.log(`🔧 API docs: http://localhost:${PORT}/docs`);
});

export default app;
