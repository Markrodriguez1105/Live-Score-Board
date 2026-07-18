// ============================================================
// Routes — Judges CRUD + PIN Authentication
// ============================================================

import { Router } from "express";
import { JudgeQueries } from "@pageant/database";
import { requireAdmin, generateJudgeToken } from "../middleware/auth.js";

export const judgeRoutes = Router();

// ── Judge Auth (Public) ──────────────────────────────────────

// Authenticate judge by PIN → returns JWT
judgeRoutes.post("/judges/auth", async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      res.status(400).json({ success: false, error: "PIN is required" });
      return;
    }

    const judge = await JudgeQueries.getByPin(pin);
    if (!judge) {
      res.status(401).json({ success: false, error: "Invalid PIN" });
      return;
    }

    const token = generateJudgeToken({
      judgeId: judge.id,
      pageantId: judge.pageantId,
      judgeName: judge.name,
    });

    res.json({
      success: true,
      data: {
        token,
        judge: {
          id: judge.id,
          name: judge.name,
          pageantId: judge.pageantId,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ── Judge CRUD (Admin Only) ──────────────────────────────────

// List judges for a pageant
judgeRoutes.get(
  "/pageants/:pageantId/judges",
  requireAdmin,
  async (req, res) => {
    try {
      const judges = await JudgeQueries.getByPageantId(req.params.pageantId);
      res.json({ success: true, data: judges });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// Create judge
judgeRoutes.post(
  "/pageants/:pageantId/judges",
  requireAdmin,
  async (req, res) => {
    try {
      const { name, pin } = req.body;
      if (!name || !pin) {
        res.status(400).json({
          success: false,
          error: "name and pin are required",
        });
        return;
      }

      // Check PIN uniqueness within the pageant
      const existing = await JudgeQueries.getByPin(pin);
      if (existing && existing.pageantId === req.params.pageantId) {
        res.status(409).json({
          success: false,
          error: "A judge with this PIN already exists in this pageant",
        });
        return;
      }

      const judge = await JudgeQueries.create(req.params.pageantId, {
        name,
        pin,
      });
      res.status(201).json({ success: true, data: judge });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// Delete judge
judgeRoutes.delete("/judges/:id", requireAdmin, async (req, res) => {
  try {
    const deleted = await JudgeQueries.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: "Judge not found" });
      return;
    }
    res.json({ success: true, data: { message: "Judge deleted" } });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});
