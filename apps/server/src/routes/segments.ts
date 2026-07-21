// ============================================================
// Routes — Segments CRUD
// ============================================================

import { Router } from "express";
import { SegmentQueries } from "@pageant/database";
import { requireAdmin } from "../middleware/auth.js";

export const segmentRoutes = Router();

// List segments for a pageant (with nested categories, criteria, and candidates)
segmentRoutes.get(
  "/pageants/:pageantId/segments",
  async (req, res) => {
    try {
      const segments = await SegmentQueries.getWithCategories(
        req.params.pageantId as string
      );
      res.json({ success: true, data: segments });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// Create segment
segmentRoutes.post(
  "/pageants/:pageantId/segments",
  requireAdmin,
  async (req, res) => {
    try {
      const { name, order } = req.body;
      if (!name) {
        res.status(400).json({
          success: false,
          error: "name is required",
        });
        return;
      }
      const segment = await SegmentQueries.create(req.params.pageantId as string, {
        name,
        order: order ?? 0,
      });
      res.status(201).json({ success: true, data: segment });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// Update segment
segmentRoutes.put("/segments/:id", requireAdmin, async (req, res) => {
  try {
    const segment = await SegmentQueries.update(req.params.id as string, req.body);
    if (!segment) {
      res.status(404).json({ success: false, error: "Segment not found" });
      return;
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("segment:lock-update", { segmentId: segment.id, isLocked: segment.isLocked });
      io.emit("segment:hide-update", { segmentId: segment.id, isHidden: segment.isHidden });
    }

    res.json({ success: true, data: segment });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Delete segment
segmentRoutes.delete("/segments/:id", requireAdmin, async (req, res) => {
  try {
    const deleted = await SegmentQueries.delete(req.params.id as string);
    if (!deleted) {
      res.status(404).json({ success: false, error: "Segment not found" });
      return;
    }
    res.json({ success: true, data: { message: "Segment deleted" } });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});
