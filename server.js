import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all origins for local network ease
    methods: ["GET", "POST"],
  },
});

// Serve static files from dist if production
// For dev, we just use the socket server.

let currentIndex = 0; // Server-side state of truth
let cachedCandidates = []; // Cache candidates so new connections get data
let isIdle = false; // Idle state
let currentCategory = ""; // Current category/sheet name (empty = use first available)

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Send current state to new connector
  socket.emit("STATE_UPDATE", {
    currentIndex,
    candidates: cachedCandidates,
    isIdle,
    category: currentCategory,
  });

  socket.on("SET_INDEX", (payload) => {
    // Payload can be number (old) or object { index, candidates }
    if (typeof payload === "object") {
      currentIndex = payload.index;
      if (payload.candidates) {
        cachedCandidates = payload.candidates;
      }
      // Broadcast everything including category
      io.emit("STATE_UPDATE", {
        currentIndex,
        candidates: cachedCandidates,
        isIdle,
        category: currentCategory,
      });
    } else {
      currentIndex = payload;
      io.emit("STATE_UPDATE", {
        currentIndex: payload,
        candidates: cachedCandidates,
        isIdle,
        category: currentCategory,
      });
    }
  });

  socket.on("SET_IDLE", (payload) => {
    isIdle = !!payload;
    io.emit("STATE_UPDATE", {
      currentIndex,
      candidates: cachedCandidates,
      isIdle,
      category: currentCategory,
    });
  });

  socket.on("SET_CATEGORY", (payload) => {
    if (typeof payload === "object") {
      currentCategory = payload.category;
      if (payload.candidates) {
        cachedCandidates = payload.candidates;
      }
      // Reset index to 0 when changing category
      currentIndex = 0;
      io.emit("STATE_UPDATE", {
        currentIndex,
        candidates: cachedCandidates,
        isIdle,
        category: currentCategory,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = 3001;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Socket.io server running on port ${PORT}`);
});
