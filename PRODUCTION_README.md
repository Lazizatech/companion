# CUA Multi-Service Platform

Production-ready Computer Use Agent (CUA) platform with intelligent orchestration, human-in-the-loop capabilities, and microservice architecture.

## 🏗️ Architecture Overview

This platform integrates three core services:
- **Companion API**: Pure backend service for task coordination
- **CUA Browser**: Playwright-based browser automation with AI vision
- **Aider-Neo**: Multi-agent AI system with real model integration

## 🚀 Production Components

### Core Production Architecture

Located in `production-architecture/`:

```
production-architecture/
├── core/
│   ├── flow-brain.js           # Intelligent orchestration layer
│   └── browser-server.js       # HTTP wrapper for CUA browser
├── agents/
│   ├── production-agent.js     # Complete production-ready agent
│   └── autonomous-agent.js     # Autonomous execution capabilities
├── api/
│   └── human-handoff-api.js    # Interactive human handoff system
└── docs/
    └── README.md               # This documentation
```

### Key Features

#### 🧠 Flow Brain (Intelligent Orchestration)
- **Role-scoped prompts**: Domain-specific strategies for ecommerce, search, forms
- **Model exhaustion**: Try multiple AI models before human handoff
- **Context memory**: Learns from failures and adapts approaches
- **Branching logic**: Different strategies based on attempt number and failure type

#### 👤 Human Handoff System
- **Interactive web interface**: Real-time handoff management at `http://localhost:9000/dashboard`
- **State persistence**: Complete automation state capture and resume
- **Urgency classification**: Automatic priority based on failure type
- **Operator notifications**: Ready for Slack/Discord/email integration

#### 🤖 Production Agent
- **Defensive automation**: Human approval required for sensitive tasks
- **Execution logging**: Complete audit trail of all actions
- **Recovery options**: Intelligent error classification and suggested fixes
- **Domain detection**: Automatic task categorization for optimal prompting

## 🛠️ Individual Services

### Companion API (`companion/`)
- **Framework**: Hono.js for high performance
- **Purpose**: Pure API service without browser dependencies
- **Endpoints**: Health checks, task coordination, status monitoring
- **Port**: 3001

### CUA Browser (`browser-server.js`)
- **Framework**: Express.js wrapper around Playwright
- **Purpose**: Browser automation with AI vision capabilities
- **Features**: Session management, screenshot capture, element interaction
- **Port**: 3002

### Aider-Neo (`../aider-neo/`)
- **Framework**: Flask Python API
- **Purpose**: Multi-agent AI system with OpenRouter integration
- **Agents**: 15+ specialized agents for different coding tasks
- **Port**: 5000

## 🔧 Quick Start

### Prerequisites
```bash
# Install dependencies
npm install
cd ../aider-neo && pip install -r requirements.txt
```

### Environment Setup
```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with your API keys
```

### Start Production Stack
```bash
# Terminal 1: Companion API
cd companion && npm run dev

# Terminal 2: CUA Browser Service
node browser-server.js

# Terminal 3: Aider-Neo
cd ../aider-neo && python api-server.py

# Terminal 4: Human Handoff API
node production-architecture/api/human-handoff-api.js
```

### Run Production Agent
```bash
# Complete production-ready automation
node production-architecture/agents/production-agent.js
```

## 📊 Monitoring & Dashboards

### Human Handoff Dashboard
- **URL**: http://localhost:9000/dashboard
- **Features**: Real-time handoff monitoring, urgency prioritization
- **Use Cases**: CAPTCHA solving, strategy consultation, manual intervention

### Service Health Checks
```bash
# Companion API
curl http://localhost:3001/health

# CUA Browser
curl http://localhost:3002/api/v1/browser/health

# Aider-Neo
curl http://localhost:5000/health
```

## 🔒 Security Features

- ✅ **No hardcoded API keys**: All secrets in environment variables
- ✅ **Human approval gates**: Sensitive tasks require explicit approval
- ✅ **Execution logging**: Complete audit trail of all actions
- ✅ **Error recovery**: Graceful handling of failures with recovery options
- ✅ **Session isolation**: Independent browser sessions for concurrent tasks

## 🧪 Testing Strategy

### Individual Service Testing
```bash
# Test each service independently before integration
npm test                    # Companion API tests
python -m pytest          # Aider-Neo tests
node test-browser.js       # CUA Browser tests
```

### End-to-End Testing
```bash
# Production agent with real AI integration
node production-architecture/agents/production-agent.js
```

## 🚢 Deployment

### Docker Support
Each service includes `Dockerfile` for containerization:
```bash
# Build individual services
docker build -t companion-api ./companion
docker build -t cua-browser .
docker build -t aider-neo ../aider-neo
```

### Kong Gateway Ready
Services are designed for Kong API Gateway orchestration with proper service separation.

## 🤖 Agent Capabilities

### Multi-Domain Expertise
- **E-commerce**: Alibaba, dropshipping, product research
- **Search**: Google, specialized search strategies
- **Forms**: Login flows, data entry, validation
- **Development**: Code analysis, GitHub integration

### Intelligence Features
- **Vision AI**: Screenshot analysis and element detection
- **Model Agnosticism**: Dynamic model selection (GPT-4, Claude, etc.)
- **Failure Learning**: Pattern recognition and strategy adaptation
- **Human Collaboration**: Seamless handoff and resume

## 📈 Production Ready Features

### Operator-Style Automation
- **Graceful handoffs**: No freezing or hanging when human input needed
- **Intentional pauses**: Strategic waiting with user choice
- **State persistence**: Resume exactly where left off
- **Context preservation**: Full automation history maintained

### Enterprise Integration Points
- **Monitoring**: OpenTelemetry ready for observability
- **Notifications**: Slack/Discord/email integration hooks
- **Authentication**: Operator identification and access control
- **Audit**: Complete execution logs for compliance

## 🔧 Configuration

### Environment Variables
```bash
# Core API Keys
OPENROUTER_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here

# Service URLs
COMPANION_API_URL=http://localhost:3001
CUA_BROWSER_URL=http://localhost:3002
AIDER_NEO_URL=http://localhost:5000
HUMAN_HANDOFF_URL=http://localhost:9000

# Production Settings
PRODUCTION_MODE=true
LOG_LEVEL=info
MAX_CONCURRENT_SESSIONS=5
```

## 🎯 Real-World Usage

This system has been tested with:
- ✅ **Alibaba product research**: Automated with CAPTCHA handoff
- ✅ **Google search automation**: Multi-strategy approach
- ✅ **Form submissions**: Login flows and data entry
- ✅ **Code generation**: Real AI model integration
- ✅ **Error recovery**: Multiple failure scenarios tested

## 🤝 Contributing

This is a production-ready implementation addressing real automation challenges:
- **No mock responses**: Real AI integration throughout
- **Human-centric design**: Operators as partners, not obstacles
- **Production hardened**: Error handling, logging, recovery
- **Scalable architecture**: Microservice separation for growth

Built for real-world automation workflows where reliability and human collaboration are essential.