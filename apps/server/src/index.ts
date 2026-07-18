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
import type { ServerToClientEvents, ClientToServerEvents } from "@pageant/types";

import { pageantRoutes } from "./routes/pageants.js";
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
const uploadsPath = path.resolve(__dirname, "../../uploads");
app.use("/uploads", express.static(uploadsPath));

// ── API Routes ───────────────────────────────────────────────

app.use("/api/pageants", pageantRoutes);
app.use("/api", categoryRoutes);
app.use("/api", candidateRoutes);
app.use("/api", judgeRoutes);
app.use("/api", scoreRoutes);
app.use("/api", presentationRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// ── Socket.IO ────────────────────────────────────────────────

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

setupSocketHandlers(io);

// ── Database Init & Start ────────────────────────────────────

async function start() {
  // Initialize MySQL connection
  initDatabase({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "pageant_db",
  });

  // Create tables if they don't exist
  await initSchema();

  // Start server
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 Pageant Server running on port ${PORT}`);
    console.log(`   API:       http://0.0.0.0:${PORT}/api`);
    console.log(`   Socket.IO: http://0.0.0.0:${PORT}`);
    console.log(`   Uploads:   http://0.0.0.0:${PORT}/uploads\n`);
  });
}

start().catch((err) => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});
