// ============================================================
// Routes — Pageants CRUD + Admin Auth
// ============================================================

import { Router } from "express";
import { PageantQueries } from "@pageant/database";
import {
  requireAdmin,
  loginAdmin,
  logoutAdmin,
  checkAdminSession,
} from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

export const pageantRoutes = Router();

// ── Admin Auth (mounted under /api/pageants but logically separate) ──

// We mount admin auth here for convenience
pageantRoutes.post("/admin/login", loginAdmin);
pageantRoutes.post("/admin/logout", logoutAdmin);
pageantRoutes.get("/admin/session", checkAdminSession);

// ── Pageant CRUD ─────────────────────────────────────────────

// List all pageants
pageantRoutes.get("/", requireAdmin, async (_req, res) => {
  try {
    const pageants = await PageantQueries.getAll();
    res.json({ success: true, data: pageants });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Get single pageant
pageantRoutes.get("/:id", requireAdmin, async (req, res) => {
  try {
    const pageant = await PageantQueries.getById(req.params.id as string);
    if (!pageant) {
      res.status(404).json({ success: false, error: "Pageant not found" });
      return;
    }
    res.json({ success: true, data: pageant });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Create pageant
pageantRoutes.post("/", requireAdmin, async (req, res) => {
  try {
    const { name, description, date, venue, logoUrl } = req.body;
    if (!name || !date || !venue || !logoUrl) {
      res.status(400).json({
        success: false,
        error: "name, date, venue, and logoUrl are required",
      });
      return;
    }
    const cleanDate = String(date).split("T")[0].split(" ")[0];
    const pageant = await PageantQueries.create({
      name,
      description,
      date: cleanDate,
      venue,
      logoUrl,
    });
    res.status(201).json({ success: true, data: pageant });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Update pageant
pageantRoutes.put("/:id", requireAdmin, async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.date) {
      payload.date = String(payload.date).split("T")[0].split(" ")[0];
    }
    const pageant = await PageantQueries.update(req.params.id as string, payload);
    if (!pageant) {
      res.status(404).json({ success: false, error: "Pageant not found" });
      return;
    }
    res.json({ success: true, data: pageant });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Delete pageant
pageantRoutes.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const deleted = await PageantQueries.delete(req.params.id as string);
    if (!deleted) {
      res.status(404).json({ success: false, error: "Pageant not found" });
      return;
    }
    res.json({ success: true, data: { message: "Pageant deleted" } });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Upload pageant logo
pageantRoutes.post(
  "/:id/logo",
  requireAdmin,
  upload.single("logo"),
  async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: "No file uploaded" });
        return;
      }
      const logoUrl = `/uploads/${req.file.filename}`;
      const pageant = await PageantQueries.update(req.params.id as string, { logoUrl });
      res.json({ success: true, data: pageant });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  }
);
