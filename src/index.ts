import { ApiException, fromHono } from "chanfana";
import { Hono } from "hono";
import { tasksRouter } from "./endpoints/tasks/router";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { DummyEndpoint } from "./endpoints/dummyEndpoint";
import {
  CreateAgent,
  ListAgents,
  GetAgent,
  CreateTask,
  ExecuteTask,
  StopAgent,
  GetMemory,
  StoreMemory
} from "./endpoints/cua/cleanEndpoints";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

app.onError((err, c) => {
  if (err instanceof ApiException) {
    return c.json(
      { success: false, errors: err.buildResponse() },
      err.status as ContentfulStatusCode,
    );
  }

  console.error("Global error handler caught:", err);
  return c.json(
    {
      success: false,
      errors: [{ code: 7000, message: "Internal Server Error" }],
    },
    500,
  );
});

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
  schema: {
    info: {
      title: "Unified CUA API",
      version: "3.0.0",
      description: "Single, clean Computer Use Agent API with Drizzle ORM.",
    },
  },
});

// Register Tasks Sub router
openapi.route("/tasks", tasksRouter);

// Register CUA endpoints directly
openapi.post("/cua/agents", CreateAgent);
openapi.get("/cua/agents", ListAgents);
openapi.get("/cua/agents/:id", GetAgent);
openapi.post("/cua/agents/:id/tasks", CreateTask);
openapi.post("/cua/agents/:id/tasks/:taskId/execute", ExecuteTask);
openapi.delete("/cua/agents/:id", StopAgent);
openapi.get("/cua/memory/:agentId", GetMemory);
openapi.post("/cua/memory/:agentId", StoreMemory);

// Register other endpoints
openapi.post("/dummy/:slug", DummyEndpoint);

// Export the Hono app
export default app;
