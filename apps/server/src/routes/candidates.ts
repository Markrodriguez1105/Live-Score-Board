// ============================================================
// Routes — Candidates CRUD + Photo Upload
// ============================================================

import { Router } from "express";
import { CandidateQueries } from "@pageant/database";
import { requireAdmin } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

export const candidateRoutes = Router();

// List candidates for a pageant
candidateRoutes.get(
  "/pageants/:pageantId/candidates",
  async (req, res) => {
    try {
      const candidates = await CandidateQueries.getByPageantId(
        req.params.pageantId as string
      );
      res.json({ success: true, data: candidates });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// Get single candidate
candidateRoutes.get("/candidates/:id", async (req, res) => {
  try {
    const candidate = await CandidateQueries.getById(req.params.id as string);
    if (!candidate) {
      res.status(404).json({ success: false, error: "Candidate not found" });
      return;
    }
    res.json({ success: true, data: candidate });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Create candidate
candidateRoutes.post(
  "/pageants/:pageantId/candidates",
  requireAdmin,
  async (req, res) => {
    try {
      const { name, candidateNumber } = req.body;
      if (!name || candidateNumber === undefined) {
        res.status(400).json({
          success: false,
          error: "name and candidateNumber are required",
        });
        return;
      }
      const candidate = await CandidateQueries.create(req.params.pageantId as string, {
        name,
        candidateNumber,
      });
      res.status(201).json({ success: true, data: candidate });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// Update candidate
candidateRoutes.put("/candidates/:id", requireAdmin, async (req, res) => {
  try {
    const candidate = await CandidateQueries.update(req.params.id as string, req.body);
    if (!candidate) {
      res.status(404).json({ success: false, error: "Candidate not found" });
      return;
    }
    res.json({ success: true, data: candidate });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Delete candidate
candidateRoutes.delete("/candidates/:id", requireAdmin, async (req, res) => {
  try {
    const deleted = await CandidateQueries.delete(req.params.id as string);
    if (!deleted) {
      res.status(404).json({ success: false, error: "Candidate not found" });
      return;
    }
    res.json({ success: true, data: { message: "Candidate deleted" } });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Upload candidate photo
candidateRoutes.post(
  "/candidates/:id/photo",
  requireAdmin,
  upload.single("photo"),
  async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: "No file uploaded" });
        return;
      }
      const photoUrl = `/uploads/${req.file.filename}`;
      const candidate = await CandidateQueries.update(req.params.id as string, {
        photoUrl,
      });
      res.json({ success: true, data: candidate });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  }
);
