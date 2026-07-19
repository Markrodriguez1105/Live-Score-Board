// ============================================================
// Routes — Categories & Criteria CRUD
// ============================================================

import { Router } from "express";
import { CategoryQueries, CriteriaQueries } from "@pageant/database";
import { requireAdmin } from "../middleware/auth.js";

export const categoryRoutes = Router();

// ── Categories ───────────────────────────────────────────────

// List categories for a pageant (with criteria)
categoryRoutes.get(
  "/pageants/:pageantId/categories",
  async (req, res) => {
    try {
      const categories = await CategoryQueries.getWithCriteria(
        req.params.pageantId as string
      );
      res.json({ success: true, data: categories });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// Create category
categoryRoutes.post(
  "/pageants/:pageantId/categories",
  requireAdmin,
  async (req, res) => {
    try {
      const { name, order, weight } = req.body;
      if (!name || weight === undefined) {
        res.status(400).json({
          success: false,
          error: "name and weight are required",
        });
        return;
      }
      const category = await CategoryQueries.create(req.params.pageantId as string, {
        name,
        order: order ?? 0,
        weight,
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
