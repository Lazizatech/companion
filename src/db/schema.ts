import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  status: text('status').notNull(),
  config: text('config', { mode: 'json' }),
  created_at: text('created_at').notNull(),
  last_active: text('last_active'),
  updated_at: text('updated_at').default(sql`datetime('now')`)
});

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  agent_id: text('agent_id').notNull().references(() => agents.id),
  task: text('task').notNull(),
  options: text('options', { mode: 'json' }),
  priority: text('priority').notNull(),
  status: text('status').notNull(),
  result: text('result', { mode: 'json' }),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').default(sql`datetime('now')`)
});

export const memory = sqliteTable('memory', {
  id: text('id').primaryKey(),
  agent_id: text('agent_id').notNull().references(() => agents.id),
  type: text('type').notNull(),
  data: text('data', { mode: 'json' }).notNull(),
  created_at: text('created_at').notNull()
});

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Memory = typeof memory.$inferSelect;
export type NewMemory = typeof memory.$inferInsert;
