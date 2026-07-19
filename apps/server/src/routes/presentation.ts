// ============================================================
// Routes — Presentation State (Live Control)
// ============================================================

import { Router } from "express";
import { PresentationQueries, PageantQueries } from "@pageant/database";
import { requireAdmin } from "../middleware/auth.js";

export const presentationRoutes = Router();

// Get the active pageant presentation state (public)
presentationRoutes.get(
  "/presentation/active",
  async (_req, res) => {
    try {
      const pageants = await PageantQueries.getAll();
      if (pageants.length === 0) {
        res.status(404).json({ success: false, error: "No pageants found" });
        return;
      }
      const activePageant = pageants.find(p => p.status === "active") || pageants[0];
      const state = await PresentationQueries.get(activePageant.id);
      if (!state) {
        res.status(404).json({ success: false, error: "Presentation state not found" });
        return;
      }
      res.json({
        success: true,
        data: {
          ...state,
          pageantName: activePageant.name,
          pageantLogoUrl: activePageant.logoUrl,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// Get current presentation state (public — viewers need this)
presentationRoutes.get(
  "/pageants/:pageantId/presentation",
  async (req, res) => {
    try {
      const state = await PresentationQueries.get(req.params.pageantId as string);
      if (!state) {
        res
          .status(404)
          .json({ success: false, error: "Presentation state not found" });
        return;
      }
      res.json({ success: true, data: state });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// Update presentation state (admin only)
presentationRoutes.put(
  "/pageants/:pageantId/presentation",
  requireAdmin,
  async (req, res) => {
    try {
      const state = await PresentationQueries.update(
        req.params.pageantId as string,
        req.body
      );
      if (!state) {
        res
          .status(404)
          .json({ success: false, error: "Presentation state not found" });
        return;
      }
      res.json({ success: true, data: state });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  }
);
