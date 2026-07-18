// ============================================================
// Routes — Scores (Submit, Override, Results)
// ============================================================

import { Router } from "express";
import {
  ScoreQueries,
  CriteriaQueries,
  CandidateQueries,
  CategoryQueries,
  JudgeQueries,
} from "@pageant/database";
import { requireJudge, requireAdmin } from "../middleware/auth.js";

export const scoreRoutes = Router();

// ── Judge: Submit Scores ─────────────────────────────────────

scoreRoutes.post("/scores", requireJudge, async (req, res) => {
  try {
    const { candidateId, scores } = req.body;

    if (!candidateId || !scores || !Array.isArray(scores) || scores.length === 0) {
      res.status(400).json({
        success: false,
        error: "candidateId and scores array are required",
      });
      return;
    }

    // Validate each score against criteria rules
    for (const s of scores) {
      const criteria = await CriteriaQueries.getById(s.criteriaId);
      if (!criteria) {
        res.status(400).json({
          success: false,
          error: `Invalid criteria: ${s.criteriaId}`,
        });
        return;
      }
      if (s.value < criteria.minScore || s.value > criteria.maxScore) {
        res.status(400).json({
          success: false,
          error: `Score for "${criteria.name}" must be between ${criteria.minScore} and ${criteria.maxScore}. Got: ${s.value}`,
        });
        return;
      }
    }

    const result = await ScoreQueries.submit(
      req.judge!.judgeId,
      candidateId,
      scores
    );

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ── Admin/Tabulator: Override Score ──────────────────────────

scoreRoutes.put("/scores/override", requireAdmin, async (req, res) => {
  try {
    const { judgeId, candidateId, criteriaId, value } = req.body;

    if (!judgeId || !candidateId || !criteriaId || value === undefined) {
      res.status(400).json({
        success: false,
        error: "judgeId, candidateId, criteriaId, and value are required",
      });
      return;
    }

    // Validate against criteria rules
    const criteria = await CriteriaQueries.getById(criteriaId);
    if (!criteria) {
      res.status(400).json({ success: false, error: "Invalid criteria" });
      return;
    }
    if (value < criteria.minScore || value > criteria.maxScore) {
      res.status(400).json({
        success: false,
        error: `Score must be between ${criteria.minScore} and ${criteria.maxScore}`,
      });
      return;
    }

    const score = await ScoreQueries.override(
      judgeId,
      candidateId,
      criteriaId,
      value
    );

    res.json({ success: true, data: score });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ── Get Scores for Candidate + Category ──────────────────────

scoreRoutes.get(
  "/scores/candidate/:candidateId/category/:categoryId",
  async (req, res) => {
    try {
      const scores = await ScoreQueries.getByCandidateAndCategory(
        req.params.candidateId,
        req.params.categoryId
      );
      res.json({ success: true, data: scores });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// ── Get Submission Status ────────────────────────────────────

scoreRoutes.get(
  "/scores/status/:candidateId/:categoryId",
  async (req, res) => {
    try {
      // Get the pageant ID from the candidate
      const candidate = await CandidateQueries.getById(req.params.candidateId);
      if (!candidate) {
        res.status(404).json({ success: false, error: "Candidate not found" });
        return;
      }

      const judges = await JudgeQueries.getByPageantId(candidate.pageantId);
      const judgeIds = judges.map((j) => j.id);

      const statusMap = await ScoreQueries.getSubmissionStatus(
        req.params.candidateId,
        req.params.categoryId,
        judgeIds
      );

      const status = judges.map((j) => ({
        judgeId: j.id,
        judgeName: j.name,
        submitted: statusMap.get(j.id) || false,
      }));

      res.json({ success: true, data: status });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// ── Get Aggregated Results ───────────────────────────────────

scoreRoutes.get("/pageants/:pageantId/results", async (req, res) => {
  try {
    const rawScores = await ScoreQueries.getResultsByPageant(
      req.params.pageantId
    );
    const candidates = await CandidateQueries.getByPageantId(
      req.params.pageantId
    );
    const categories = await CategoryQueries.getWithCriteria(
      req.params.pageantId
    );
    const judges = await JudgeQueries.getByPageantId(req.params.pageantId);

    res.json({
      success: true,
      data: {
        scores: rawScores,
        candidates,
        categories,
        judges,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});
