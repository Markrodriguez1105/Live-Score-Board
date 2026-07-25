// ============================================================
// Routes — Scores (Submit, Override, Results)
// ============================================================

import { Router, Request, Response } from "express";
import {
  ScoreQueries,
  CriteriaQueries,
  CandidateQueries,
  CategoryQueries,
  JudgeQueries,
  SegmentQueries,
} from "@pageant/database";
import { requireJudge, requireAdmin } from "../middleware/auth.js";
import { getCache, setCache, delCache } from "../redis.js";

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

    // Batch fetch all criteria in one query
    const criteriaIds = scores.map((s: any) => s.criteriaId);
    const allCriteria = await CriteriaQueries.getByIds(criteriaIds);

    if (allCriteria.length !== criteriaIds.length) {
      res.status(400).json({
        success: false,
        error: "One or more criteria IDs are invalid",
      });
      return;
    }

    // Batch lock check: single query for all criteria
    const isLocked = await SegmentQueries.areCriteriaLocked(criteriaIds);
    if (isLocked) {
      res.status(403).json({
        success: false,
        error: "Segment is locked by controller. Scores cannot be submitted or altered.",
      });
      return;
    }

    // Validate score ranges using a Map lookup
    const criteriaMap = new Map(allCriteria.map(c => [c.id, c]));
    for (const s of scores) {
      const criteria = criteriaMap.get(s.criteriaId);
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

    // Invalidate pageant results cache on new score submit
    await delCache("pageant:results:*");

    // Single consolidated broadcast (removed duplicate score:update event)
    const io = req.app.get("io");
    if (io) {
      io.emit("scores:update", { candidateId });
    }

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

    // Invalidate cache on override
    await delCache("pageant:results:*");

    const io = req.app.get("io");
    if (io) {
      io.emit("scores:update", { candidateId, judgeId, criteriaId });
    }

    res.json({ success: true, data: score });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ── Admin/Tabulator: Clear Score ─────────────────────────────

const clearScoreHandler = async (req: Request, res: Response) => {
  try {
    const judgeId = (req.body?.judgeId || req.query?.judgeId) as string;
    const candidateId = (req.body?.candidateId || req.query?.candidateId) as string;
    const categoryId = (req.body?.categoryId || req.query?.categoryId) as string;

    if (!judgeId || !candidateId || !categoryId) {
      res.status(400).json({
        success: false,
        error: "judgeId, candidateId, and categoryId are required",
      });
      return;
    }

    await ScoreQueries.deleteByJudgeCandidateCategory(
      judgeId,
      candidateId,
      categoryId
    );

    // Invalidate cache on score clear
    await delCache("pageant:results:*");

    const io = req.app.get("io");
    if (io) {
      io.emit("scores:update", { candidateId, judgeId, categoryId });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
};

scoreRoutes.post("/scores/clear", requireAdmin, clearScoreHandler);
scoreRoutes.delete("/scores/clear", requireAdmin, clearScoreHandler);

// ── Get Scores for Candidate + Category ──────────────────────

scoreRoutes.get(
  "/scores/candidate/:candidateId/category/:categoryId",
  async (req, res) => {
    try {
      const scores = await ScoreQueries.getByCandidateAndCategory(
        req.params.candidateId as string,
        req.params.categoryId as string
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
      const candidate = await CandidateQueries.getById(req.params.candidateId as string);
      if (!candidate) {
        res.status(404).json({ success: false, error: "Candidate not found" });
        return;
      }

      const judges = await JudgeQueries.getByPageantId(candidate.pageantId);
      const judgeIds = judges.map((j) => j.id);

      const statusMap = await ScoreQueries.getSubmissionStatus(
        req.params.candidateId as string,
        req.params.categoryId as string,
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
    const pageantId = req.params.pageantId as string;
    const cacheKey = `pageant:results:${pageantId}`;

    // 1. Try Redis cache first
    const cachedData = await getCache<any>(cacheKey);
    if (cachedData) {
      res.json({
        success: true,
        cached: true,
        data: cachedData,
      });
      return;
    }

    // 2. Cache miss — query MySQL database
    const rawScores = await ScoreQueries.getResultsByPageant(pageantId);
    const candidates = await CandidateQueries.getByPageantId(pageantId);
    const segments = await SegmentQueries.getWithCategories(pageantId);
    const judges = await JudgeQueries.getByPageantId(pageantId);
    const categories = await CategoryQueries.getAllWithCriteria(pageantId);

    const resultData = {
      scores: rawScores,
      candidates,
      segments,
      categories,
      judges,
    };

    // 3. Save to Redis cache (TTL: 60 seconds)
    await setCache(cacheKey, resultData, 60);

    res.json({
      success: true,
      cached: false,
      data: resultData,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});
