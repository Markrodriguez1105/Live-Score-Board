// ============================================================
// Routes — Categories & Criteria CRUD
// ============================================================

import { Router } from "express";
import { CategoryQueries, CriteriaQueries, CategoryCandidateQueries } from "@pageant/database";
import { requireAdmin } from "../middleware/auth.js";
import { createChildLogger } from "../logger.js";

const categoryLogger = createChildLogger("Categories");

export const categoryRoutes = Router();

// ── Categories ───────────────────────────────────────────────

// List categories for a segment (with criteria and assigned candidates)
categoryRoutes.get(
  "/segments/:segmentId/categories",
  async (req, res) => {
    try {
      const categories = await CategoryQueries.getWithCandidates(
        req.params.segmentId as string
      );
      res.json({ success: true, data: categories });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// Reorder categories in a segment
categoryRoutes.put(
  "/segments/:segmentId/categories/reorder",
  requireAdmin,
  async (req, res) => {
    try {
      const { categoryIds } = req.body;
      categoryLogger.debug({ segmentId: req.params.segmentId, categoryIds }, "Categories reorder request received");
      if (!Array.isArray(categoryIds)) {
        res.status(400).json({ success: false, error: "categoryIds array is required" });
        return;
      }
      await CategoryQueries.reorder(req.params.segmentId as string, categoryIds);
      const categories = await CategoryQueries.getWithCandidates(req.params.segmentId as string);
      categoryLogger.debug({ newOrder: categories.map(c => ({ id: c.id, name: c.name, order: c.order })) }, "Reordered categories in DB");

      const io = req.app.get("io");
      if (io) {
        io.emit("category:candidates-update", { segmentId: req.params.segmentId });
        io.emit("scores:update", { segmentId: req.params.segmentId });
      }

      res.json({ success: true, data: categories });
    } catch (err) {
      categoryLogger.error(err as Error, "Error in categories reorder route");
      res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// Create category under a segment
categoryRoutes.post(
  "/segments/:segmentId/categories",
  requireAdmin,
  async (req, res) => {
    try {
      const { name, order, weight, isSimultaneous, candidateIds } = req.body;
      if (!name || weight === undefined) {
        res.status(400).json({
          success: false,
          error: "name and weight are required",
        });
        return;
      }
      const category = await CategoryQueries.create(req.params.segmentId as string, {
        name,
        order: order ?? 0,
        weight,
        isSimultaneous: !!isSimultaneous,
        candidateIds,
      });
      res.status(201).json({ success: true, data: category });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// Update category
categoryRoutes.put("/categories/:id", requireAdmin, async (req, res) => {
  try {
    const category = await CategoryQueries.update(req.params.id as string, req.body);
    if (!category) {
      res.status(404).json({ success: false, error: "Category not found" });
      return;
    }
    const io = req.app.get("io");
    if (io) {
      io.emit("category:candidates-update", { segmentId: category.segmentId });
      io.emit("scores:update", { segmentId: category.segmentId });
    }
    res.json({ success: true, data: category });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Delete category
categoryRoutes.delete("/categories/:id", requireAdmin, async (req, res) => {
  try {
    const deleted = await CategoryQueries.delete(req.params.id as string);
    if (!deleted) {
      res.status(404).json({ success: false, error: "Category not found" });
      return;
    }
    res.json({ success: true, data: { message: "Category deleted" } });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ── Category Candidate Assignment ────────────────────────────

// Get candidates assigned to a category
categoryRoutes.get(
  "/categories/:categoryId/candidates",
  async (req, res) => {
    try {
      const candidates = await CategoryCandidateQueries.getByCategoryId(
        req.params.categoryId as string
      );
      res.json({ success: true, data: candidates });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// Set candidates assigned to a category (bulk replace)
categoryRoutes.put(
  "/categories/:categoryId/candidates",
  requireAdmin,
  async (req, res) => {
    try {
      const { candidateIds } = req.body;
      if (!Array.isArray(candidateIds)) {
        res.status(400).json({
          success: false,
          error: "candidateIds array is required",
        });
        return;
      }
      await CategoryCandidateQueries.setCandidates(
        req.params.categoryId as string,
        candidateIds
      );
      const candidates = await CategoryCandidateQueries.getByCategoryId(
        req.params.categoryId as string
      );

      const io = req.app.get("io");
      if (io) {
        io.emit("category:candidates-update", {
          categoryId: req.params.categoryId as string,
          candidateIds,
        });
        io.emit("scores:update", {
          candidateId: "",
          categoryId: req.params.categoryId as string,
          judgeScores: [],
        });
      }

      res.json({ success: true, data: candidates });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// ── Criteria ─────────────────────────────────────────────────

// List criteria for a category
categoryRoutes.get(
  "/categories/:categoryId/criteria",
  async (req, res) => {
    try {
      const criteria = await CriteriaQueries.getByCategoryId(
        req.params.categoryId as string
      );
      res.json({ success: true, data: criteria });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// Create criterion
categoryRoutes.post(
  "/categories/:categoryId/criteria",
  requireAdmin,
  async (req, res) => {
    try {
      const { name, weight, minScore, maxScore, order } = req.body;
      if (!name || weight === undefined || minScore === undefined || maxScore === undefined) {
        res.status(400).json({
          success: false,
          error: "name, weight, minScore, and maxScore are required",
        });
        return;
      }
      if (minScore >= maxScore) {
        res.status(400).json({
          success: false,
          error: "minScore must be less than maxScore",
        });
        return;
      }
      const criterion = await CriteriaQueries.create(req.params.categoryId as string, {
        name,
        weight,
        minScore,
        maxScore,
        order: order ?? 0,
      });
      res.status(201).json({ success: true, data: criterion });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// Update criterion
categoryRoutes.put("/criteria/:id", requireAdmin, async (req, res) => {
  try {
    const criterion = await CriteriaQueries.update(req.params.id as string, req.body);
    if (!criterion) {
      res.status(404).json({ success: false, error: "Criterion not found" });
      return;
    }
    res.json({ success: true, data: criterion });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Delete criterion
categoryRoutes.delete("/criteria/:id", requireAdmin, async (req, res) => {
  try {
    const deleted = await CriteriaQueries.delete(req.params.id as string);
    if (!deleted) {
      res.status(404).json({ success: false, error: "Criterion not found" });
      return;
    }
    res.json({ success: true, data: { message: "Criterion deleted" } });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});
