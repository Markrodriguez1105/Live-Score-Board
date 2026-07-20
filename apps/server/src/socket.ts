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

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("Missing required environment variable: JWT_SECRET");
}

type PageantIO = Server<ClientToServerEvents, ServerToClientEvents>;
type PageantSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function setupSocketHandlers(io: PageantIO) {
  io.on("connection", (socket: PageantSocket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ── Judge: Submit Score ──────────────────────────────────
    socket.on("judge:submit-score", async (payload) => {
      try {
        // Extract judge info from auth token (passed as query param or auth)
        const token =
          (socket.handshake.auth?.token as string) ||
          (socket.handshake.query?.token as string);

        if (!token) {
          console.warn("[Socket] Judge submit without token");
          return;
        }

        const decoded = jwt.verify(token, JWT_SECRET || "") as JudgeJwtPayload;

        // Validate score values against criteria rules and check segment lock
        for (const s of payload.scores) {
          const criteria = await CriteriaQueries.getById(s.criteriaId);
          if (!criteria) {
            console.warn(`[Socket] Invalid criteria: ${s.criteriaId}`);
            return;
          }

          const isLocked = await SegmentQueries.isCriteriaLocked(s.criteriaId);
          if (isLocked) {
            console.warn(`[Socket] Segment locked for criteria: ${s.criteriaId}`);
            return;
          }

          if (s.value < criteria.minScore || s.value > criteria.maxScore) {
            console.warn(
              `[Socket] Score ${s.value} out of range [${criteria.minScore}, ${criteria.maxScore}]`
            );
            return;
          }
        }

        // Submit scores
        await ScoreQueries.submit(
          decoded.judgeId,
          payload.candidateId,
          payload.scores
        );

        // Determine the categoryId from the first criteria
        let categoryId = "";
        if (payload.scores.length > 0) {
          const firstCriteria = await CriteriaQueries.getById(
            payload.scores[0].criteriaId
          );
          if (firstCriteria) categoryId = firstCriteria.categoryId;
        }

        // Broadcast updated scores to all clients
        io.emit("scores:update", {
          candidateId: payload.candidateId,
          categoryId,
          judgeScores: [],
        });

        console.log(
          `[Socket] Score submitted by judge ${decoded.judgeId} for candidate ${payload.candidateId}`
        );
      } catch (err) {
        console.error("[Socket] Error submitting score:", err);
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
            console.log(`[Socket] Presentation updated for pageant ${state.pageantId}`);
          }
        }
      } catch (err) {
        console.error("[Socket] Error updating presentation:", err);
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
            console.log(`[Socket] Segment ${updated.id} visibility state: ${updated.isHidden}`);
          }
        }
      } catch (err) {
        console.error("[Socket] Error toggling segment lock:", err);
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
            console.log(`[Socket] Segment ${updated.id} hide state: ${updated.isHidden}`);
          }
        }
      } catch (err) {
        console.error("[Socket] Error toggling segment hide:", err);
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

        console.log(
          `[Socket] Score overridden: judge=${payload.judgeId} candidate=${payload.candidateId} criteria=${payload.criteriaId} value=${payload.value}`
        );
      } catch (err) {
        console.error("[Socket] Error overriding score:", err);
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
        console.log(
          `[Socket] Assistance requested by Judge ${payload.judgeName} (${payload.judgeId})`
        );
      } catch (err) {
        console.error("[Socket] Error processing assistance request:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });
}
