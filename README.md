# CUA Companion - Unified Computer Use Agent

A production-ready Computer Use Agent (CUA) system that combines browser automation, AI intelligence, and database persistence. Supports both Cloudflare Workers and standalone Node.js deployment modes.

## 🚀 Features

- **Dual Architecture Support**: Cloudflare Workers (serverless) and standalone Node.js/Express
- **AI-Powered Browser Automation**: Uses OpenAI/OpenRouter for intelligent task execution
- **Database Integration**: D1 database for persistent storage
- **Docker Support**: Complete containerization for easy deployment
- **Comprehensive Testing**: Unit, integration, and Docker tests
- **TypeScript**: Full type safety and modern development experience
- **RESTful API**: Clean, documented API endpoints
- **Memory Management**: Persistent task and result storage
- **Vision Analysis**: Screenshot analysis for complex tasks

## 🏗️ Architecture

### Cloudflare Workers Mode
- Serverless deployment on Cloudflare's edge network
- D1 database for persistence
- Hono framework for API routing
- Zero infrastructure management

### Standalone Mode
- Traditional Node.js/Express server
- SQLite/PostgreSQL database support
- Docker containerization
- Full control over infrastructure

## 📦 Installation

### Prerequisites
- Node.js 18+
- npm or pnpm
- Docker (for containerized deployment)
- Cloudflare account (for Workers deployment)

### Quick Start

1. **Clone the repository**
```bash
git clone <repository-url>
cd companion
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Run database migrations**
```bash
npm run seedLocalDb
```

## 🚀 Running the Application

### Development Mode

#### Cloudflare Workers (Default)
```bash
npm run dev
```

#### Standalone Mode
```bash
npm run dev:standalone
```

### Production Mode

#### Docker Deployment
```bash
# Build and run with Docker Compose
npm run docker:compose

# Or build and run individual container
npm run docker:build
npm run docker:run
```

#### Cloudflare Workers Deployment
```bash
npm run deploy
```

## 🧪 Testing

### Run All Tests
```bash
npm run test:all
```

### Individual Test Suites
```bash
# Cloudflare Workers tests
npm run test

# Standalone server tests
npm run test:standalone

# Integration tests
npm run test:integration

# Docker integration tests
npm run docker:test
```

## 📚 API Documentation

### Base URL
- **Cloudflare Workers**: `https://your-worker.your-subdomain.workers.dev`
- **Standalone**: `http://localhost:8787`

### Health Check
```http
GET /
```

### Agent Management

#### Create Agent
```http
POST /cua/agents
Content-Type: application/json

{
  "name": "My Agent",
  "type": "advanced",
  "config": {
    "headless": true,
    "useVision": true,
    "maxAttempts": 5
  }
}
```

#### List Agents
```http
GET /cua/agents
```

#### Get Agent
```http
GET /cua/agents/{agentId}
```

#### Stop Agent
```http
DELETE /cua/agents/{agentId}
```

### Task Management

#### Create Task
```http
POST /cua/agents/{agentId}/tasks
Content-Type: application/json

{
  "task": "Navigate to https://example.com",
  "options": {
    "useVision": true,
    "maxAttempts": 3
  },
  "priority": "normal"
}
```

#### Execute Task
```http
POST /cua/agents/{agentId}/tasks/{taskId}/execute
```

#### List Tasks
```http
GET /cua/agents/{agentId}/tasks
```

### Memory Management

#### Get Memory
```http
GET /memory/{agentId}
```

#### Store Memory
```http
POST /memory/{agentId}
Content-Type: application/json

{
  "type": "task_result",
  "data": {
    "result": "success",
    "screenshot": "base64_encoded_image"
  }
}
```

## 🔧 Configuration

### Environment Variables

```env
# Required
OPENROUTER_API_KEY=your_openrouter_api_key

# Optional
NODE_ENV=development
PORT=8787
DATABASE_URL=your_database_url
```

### CUA Configuration

```typescript
interface CUAConfig {
  headless?: boolean;        // Run browser in headless mode
  useVision?: boolean;       // Enable vision analysis
  maxAttempts?: number;      // Maximum retry attempts
  timeout?: number;          // Task timeout in milliseconds
  userAgent?: string;        // Custom user agent
  model?: string;           // AI model for task analysis
  visionModel?: string;     // AI model for vision analysis
}
```

## 🐳 Docker

### Docker Compose

The project includes a complete Docker Compose setup:

```yaml
services:
  companion-api:
    build: .
    ports:
      - "8787:8787"
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
```

### Docker Commands

```bash
# Build image
npm run docker:build

# Run container
npm run docker:run

# Run with Docker Compose
npm run docker:compose

# Run tests in Docker
npm run docker:test

# Stop containers
npm run docker:compose:down
```

## 📁 Project Structure

```
companion/
├── src/
│   ├── cua/                    # CUA engine implementations
│   │   ├── engine.ts          # Legacy engine
│   │   └── unified-engine.ts  # Unified engine
│   ├── db/                    # Database layer
│   │   ├── index.ts           # Database connection
│   │   └── schema.ts          # Database schema
│   ├── endpoints/             # API endpoints
│   │   ├── cua/              # CUA-specific endpoints
│   │   └── tasks/            # Task management endpoints
│   ├── schemas/              # Validation schemas
│   ├── index.ts              # Main application entry
│   ├── standalone-server.ts  # Standalone Express server
│   ├── unified-client.ts     # Unified client library
│   └── types.ts              # TypeScript type definitions
├── tests/
│   ├── standalone/           # Standalone server tests
│   ├── integration/          # Integration tests
│   ├── cua-api.test.ts      # API endpoint tests
│   ├── cua-engine.test.ts   # Engine tests
│   └── vitest.config.mts    # Test configuration
├── migrations/              # Database migrations
├── Dockerfile              # Docker configuration
├── docker-compose.yml      # Docker Compose setup
└── package.json           # Dependencies and scripts
```

## 🔌 Client Usage

### JavaScript/TypeScript

```typescript
import { UnifiedCUAClient, quickTask } from './src/unified-client';

// Create client
const client = new UnifiedCUAClient('http://localhost:8787');

// Create agent
const agent = await client.createAgent('My Agent', {
  headless: true,
  useVision: true
});

// Execute task
const task = await client.createTask(agent.agentId, 'Navigate to https://example.com');
const result = await client.executeTask(agent.agentId, task.taskId);

// Quick task (convenience method)
const quickResult = await quickTask('Navigate to https://example.com');
```

### Command Line

```bash
# Using curl
curl -X POST http://localhost:8787/cua/agents \
  -H "Content-Type: application/json" \
  -d '{"name": "CLI Agent", "type": "advanced"}'

# Using the unified client
node -e "
const { quickTask } = require('./src/unified-client');
quickTask('Navigate to https://example.com').then(console.log);
"
```

## 🚀 Deployment

### Cloudflare Workers

1. **Set up Wrangler**
```bash
npm install -g wrangler
wrangler login
```

2. **Configure wrangler.toml**
```toml
name = "cua-companion"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "cua-companion-db"
database_id = "your-database-id"
```

3. **Deploy**
```bash
npm run deploy
```

### Standalone Server

1. **Build for production**
```bash
npm run build:standalone
```

2. **Start server**
```bash
npm run start:standalone
```

### Docker

1. **Build and run**
```bash
docker-compose up --build
```

2. **Or use individual commands**
```bash
docker build -t companion-cua .
docker run -p 8787:8787 companion-cua
```

## 🧪 Testing Strategy

### Test Types

1. **Unit Tests**: Individual component testing
2. **Integration Tests**: End-to-end API testing
3. **Docker Tests**: Containerized environment testing
4. **Performance Tests**: Load and stress testing

### Running Tests

```bash
# All tests
npm run test:all

# Specific test suites
npm run test              # Cloudflare Workers
npm run test:standalone   # Standalone server
npm run test:integration  # Integration tests

# With coverage
npm run test:coverage
```

## 🔧 Development

### Adding New Features

1. **Create feature branch**
```bash
git checkout -b feature/new-feature
```

2. **Implement feature**
   - Add TypeScript types in `src/types.ts`
   - Implement logic in appropriate module
   - Add tests in `tests/` directory
   - Update documentation

3. **Test thoroughly**
```bash
npm run test:all
```

4. **Submit pull request**

### Code Style

- Use TypeScript for all new code
- Follow ESLint configuration
- Write comprehensive tests
- Document public APIs
- Use conventional commit messages

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Issues**: Create an issue on GitHub
- **Documentation**: Check the `/docs` directory
- **Discussions**: Use GitHub Discussions for questions

## 🔄 Migration from Root Project

If you're migrating from the root-level CUA project:

1. **Update imports** to use the new unified client
2. **Replace direct API calls** with the client library
3. **Update Docker configurations** to use the new setup
4. **Run tests** to ensure compatibility

The unified client provides backward compatibility with existing code while offering new features and improved architecture.
