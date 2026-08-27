// ============================================================
// Socket.IO Event Handlers
// ============================================================

import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import {
  ScoreQueries,
  PresentationQueries,
  CriteriaQueries,
  SegmentQueries,
} from "@pageant/database";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  JudgeJwtPayload,
  PresentationState,
} from "@pageant/types";
import { createChildLogger } from "./logger.js";

const socketLogger = createChildLogger("Socket");
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("Missing required environment variable: JWT_SECRET");
}

type PageantIO = Server<ClientToServerEvents, ServerToClientEvents>;
type PageantSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// In-memory store of judge scoring statuses (key: judgeId:candidateId:categoryId)
const judgeStatusMap = new Map<string, {
  judgeId: string;
  judgeName: string;
  judgeNumber: number;
  candidateId: string;
  categoryId: string;
  status: "unsaved" | "saved" | "pending";
}>();

export function setupSocketHandlers(io: PageantIO) {
  io.on("connection", (socket: PageantSocket) => {
    socketLogger.info(`Connected: ${socket.id}`);

    // Send current judge statuses to newly connected admin clients
    if (judgeStatusMap.size > 0) {
      socket.emit("admin:initial-judge-statuses", Array.from(judgeStatusMap.values()));
    }

    // ── Judge: Submit Score ──────────────────────────────────
    socket.on("judge:submit-score", async (payload) => {
      try {
        // Extract judge info from auth token (passed as query param or auth)
        const token =
          (socket.handshake.auth?.token as string) ||
          (socket.handshake.query?.token as string);

        if (!token) {
          socketLogger.warn({ socketId: socket.id }, "Judge submit without token");
          return;
        }

        const decoded = jwt.verify(token, JWT_SECRET || "") as JudgeJwtPayload;

        // Batch validate: fetch all criteria in one query
        const criteriaIds = payload.scores.map((s: { criteriaId: string }) => s.criteriaId);
        const allCriteria = await CriteriaQueries.getByIds(criteriaIds);

        if (allCriteria.length !== criteriaIds.length) {
          socketLogger.warn({ socketId: socket.id, criteriaIds }, "One or more criteria IDs are invalid");
          return;
        }

        // Batch lock check: single query for all criteria
        const isLocked = await SegmentQueries.areCriteriaLocked(criteriaIds);
        if (isLocked) {
          socketLogger.warn({ socketId: socket.id, criteriaIds }, "Segment locked for criteria");
          return;
        }

        // Validate score ranges using a Map lookup
        const criteriaMap = new Map(allCriteria.map(c => [c.id, c]));
        for (const s of payload.scores) {
          const criteria = criteriaMap.get(s.criteriaId);
          if (!criteria) return;
          if (s.value < criteria.minScore || s.value > criteria.maxScore) {
            socketLogger.warn(
              { value: s.value, minScore: criteria.minScore, maxScore: criteria.maxScore },
              `Score ${s.value} out of range [${criteria.minScore}, ${criteria.maxScore}]`
            );
            return;
          }
        }

        // Submit scores (now batch INSERT)
        await ScoreQueries.submit(
          decoded.judgeId,
          payload.candidateId,
          payload.scores
        );

        // Determine the categoryId from the first criteria
        const categoryId = allCriteria.length > 0 ? allCriteria[0].categoryId : "";

        // Single broadcast to all clients
        io.emit("scores:update", {
          candidateId: payload.candidateId,
          categoryId,
          judgeScores: [],
        });

        socketLogger.info(
          { judgeId: decoded.judgeId, candidateId: payload.candidateId },
          `Score submitted by judge ${decoded.judgeId} for candidate ${payload.candidateId}`
        );
      } catch (err) {
        socketLogger.error(err as Error, "Error submitting score");
      }
    });

    // ── Admin: Set Presentation State ────────────────────────
    socket.on("admin:set-presentation", async (state) => {
      try {
        if (state.pageantId) {
          const updated = await PresentationQueries.update(
            state.pageantId,
            state
          );
          if (updated) {
            io.emit("presentation:update", updated);
            socketLogger.info({ pageantId: state.pageantId }, `Presentation updated for pageant ${state.pageantId}`);
          }
        }
      } catch (err) {
        socketLogger.error(err as Error, "Error updating presentation");
      }
    });

    // ── Admin: Toggle Segment Lock / Hide ─────────────────────
    socket.on("admin:toggle-segment-lock", async (payload) => {
      try {
        if (payload.segmentId) {
          const updated = await SegmentQueries.update(payload.segmentId, {
            isLocked: payload.isLocked,
            isHidden: payload.isLocked,
          });
          if (updated) {
            io.emit("segment:lock-update", {
              segmentId: updated.id,
              isLocked: updated.isLocked,
            });
            io.emit("segment:hide-update", {
              segmentId: updated.id,
              isHidden: updated.isHidden,
            });
            socketLogger.info({ segmentId: updated.id, isHidden: updated.isHidden }, `Segment ${updated.id} visibility state: ${updated.isHidden}`);
          }
        }
      } catch (err) {
        socketLogger.error(err as Error, "Error toggling segment lock");
      }
    });

    socket.on("admin:toggle-segment-hide", async (payload) => {
      try {
        if (payload.segmentId) {
          const updated = await SegmentQueries.update(payload.segmentId, {
            isHidden: payload.isHidden,
            isLocked: payload.isHidden,
          });
          if (updated) {
            io.emit("segment:hide-update", {
              segmentId: updated.id,
              isHidden: updated.isHidden,
            });
            io.emit("segment:lock-update", {
              segmentId: updated.id,
              isLocked: updated.isHidden,
            });
            socketLogger.info({ segmentId: updated.id, isHidden: updated.isHidden }, `Segment ${updated.id} hide state: ${updated.isHidden}`);
          }
        }
      } catch (err) {
        socketLogger.error(err as Error, "Error toggling segment hide");
      }
    });


    // ── Tabulator: Override Score ─────────────────────────────
    socket.on("tabulator:override-score", async (payload) => {
      try {
        await ScoreQueries.override(
          payload.judgeId,
          payload.candidateId,
          payload.criteriaId,
          payload.value
        );

        // Determine categoryId from criteria
        const criteria = await CriteriaQueries.getById(payload.criteriaId);
        const categoryId = criteria?.categoryId || "";

        // Broadcast updated scores
        io.emit("scores:update", {
          candidateId: payload.candidateId,
          categoryId,
          judgeScores: [],
        });

        socketLogger.info(
          { judgeId: payload.judgeId, candidateId: payload.candidateId, criteriaId: payload.criteriaId, value: payload.value },
          `Score overridden: judge=${payload.judgeId} candidate=${payload.candidateId} criteria=${payload.criteriaId} value=${payload.value}`
        );
      } catch (err) {
        socketLogger.error(err as Error, "Error overriding score");
      }
    });

    // ── Judge: Request Assistance ─────────────────────────────
    socket.on("judge:request-assistance", (payload) => {
      try {
        const alertData = {
          ...payload,
          timestamp: new Date().toISOString(),
        };
        io.emit("judge:assistance-alert", alertData);
        socketLogger.info(
          { judgeId: payload.judgeId, judgeName: payload.judgeName },
          `Assistance requested by Judge ${payload.judgeName} (${payload.judgeId})`
        );
      } catch (err) {
        socketLogger.error(err as Error, "Error processing assistance request");
      }
    });

    // ── Judge: Status Update (unsaved/saved/pending) ──────────
    socket.on("judge:status-update", (payload) => {
      try {
        const token =
          (socket.handshake.auth?.token as string) ||
          (socket.handshake.query?.token as string);
        if (!token) return;

        const decoded = jwt.verify(token, JWT_SECRET || "") as JudgeJwtPayload;

        const statusEntry = {
          judgeId: decoded.judgeId,
          judgeName: decoded.judgeName || "",
          judgeNumber: decoded.judgeNumber || 0,
          candidateId: payload.candidateId,
          categoryId: payload.categoryId,
          status: payload.status,
        };

        // Store in memory for new admin connections
        const key = `${decoded.judgeId}:${payload.candidateId}:${payload.categoryId}`;
        judgeStatusMap.set(key, statusEntry);

        // Broadcast to all clients (admin will listen)
        io.emit("judge:status-update", statusEntry);

        socketLogger.info(
          { judgeId: decoded.judgeId, candidateId: payload.candidateId, status: payload.status },
          `Judge ${decoded.judgeId} status → ${payload.status} for candidate ${payload.candidateId}`
        );
      } catch (err) {
        socketLogger.error(err as Error, "Error processing judge status");
      }
    });

    socket.on("disconnect", () => {
      socketLogger.info(`Disconnected: ${socket.id}`);
    });
  });
}
