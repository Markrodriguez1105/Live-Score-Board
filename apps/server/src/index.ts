// ============================================================
// Pageant Management System — Server Entry Point
// ============================================================

import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";

import { initDatabase, initSchema } from "@pageant/database";
import { initRedis } from "./redis.js";
import type { ServerToClientEvents, ClientToServerEvents } from "@pageant/types";
import { logger } from "./logger.js";
import { requestLogger } from "./middleware/requestLogger.js";

import { pageantRoutes } from "./routes/pageants.js";
import { segmentRoutes } from "./routes/segments.js";
import { categoryRoutes } from "./routes/categories.js";
import { candidateRoutes } from "./routes/candidates.js";
import { judgeRoutes } from "./routes/judges.js";
import { scoreRoutes } from "./routes/scores.js";
import { presentationRoutes } from "./routes/presentation.js";
import { setupSocketHandlers } from "./socket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || "3001");

// ── Express App ──────────────────────────────────────────────

const app = express();
const httpServer = createServer(app);

// HTTP Request Logger Middleware
app.use(requestLogger);

// CORS — allow all origins for local network
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session for admin auth
app.use(
  session({
    secret: process.env.JWT_SECRET || "pageant-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // set to true behind HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Serve uploaded files
const uploadsPath = path.resolve(__dirname, "../../../uploads");
app.use("/uploads", express.static(uploadsPath));

// ── Socket.IO ────────────────────────────────────────────────

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.set("io", io);
setupSocketHandlers(io);

// ── API Routes ───────────────────────────────────────────────

app.use("/api/pageants", pageantRoutes);
app.use("/api", segmentRoutes);
app.use("/api", categoryRoutes);
app.use("/api", candidateRoutes);
app.use("/api", judgeRoutes);
app.use("/api", scoreRoutes);
app.use("/api", presentationRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// ── Database Init & Start ────────────────────────────────────

async function start() {
  // Initialize MySQL connection
  initDatabase({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "pageant_db",
  });

  // Initialize Redis connection
  initRedis();

  // Create tables if they don't exist
  await initSchema();

  // Start server
  httpServer.listen(PORT, "0.0.0.0", () => {
    logger.info(`🚀 Pageant Server running on port ${PORT}`, {
      api: `http://0.0.0.0:${PORT}/api`,
      socketIo: `http://0.0.0.0:${PORT}`,
      uploads: `http://0.0.0.0:${PORT}/uploads`,
    });
  });
}

start().catch((err) => {
  logger.error(err, "❌ Failed to start server");
  process.exit(1);
});
