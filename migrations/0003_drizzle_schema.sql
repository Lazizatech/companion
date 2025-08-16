-- Create clean Drizzle schema (only new tables)
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('basic', 'llm', 'vision', 'unified', 'advanced')) DEFAULT 'advanced',
    config TEXT,
    status TEXT NOT NULL CHECK (status IN ('created', 'active', 'idle', 'busy', 'stopped', 'error')) DEFAULT 'created',
    created_at TEXT NOT NULL,
    last_active TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    memory_type TEXT NOT NULL CHECK (memory_type IN ('behavior_patterns', 'learning_data', 'context', 'preferences')),
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
CREATE INDEX IF NOT EXISTS idx_memory_agent_id ON memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_memory_type ON memory(memory_type);
