import { beforeAll, afterAll } from 'vitest';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../.env' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'test-key';

// Global test setup
beforeAll(async () => {
  console.log('🧪 Setting up standalone test environment...');
});

// Global test cleanup
afterAll(async () => {
  console.log('🧹 Cleaning up standalone test environment...');
});
