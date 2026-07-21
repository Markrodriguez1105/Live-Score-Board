// ============================================================
// Database Queries — Data Access Layer
// ============================================================

import { v4 as uuidv4 } from "uuid";
import { query, execute } from "./index.js";
import type { RowDataPacket } from "mysql2/promise";

import type {
  Pageant,
  Segment,
  Category,
  Criteria,
  Candidate,
  Judge,
  Score,
  PresentationState,
  CreatePageant,
  UpdatePageant,
  CreateSegment,
  CreateCategory,
  CreateCriteria,
  CreateCandidate,
  CreateJudge,
  CategoryWithCriteria,
  CategoryWithCandidates,
  SegmentWithCategories,
} from "@pageant/types";

// === Helpers ===

function toPageant(row: RowDataPacket): Pageant {
  let dateStr = "";
  if (row.date) {
    if (row.date instanceof Date) {
      const year = row.date.getFullYear();
      const month = String(row.date.getMonth() + 1).padStart(2, "0");
      const day = String(row.date.getDate()).padStart(2, "0");
      dateStr = `${year}-${month}-${day}`;
    } else {
      dateStr = String(row.date).split("T")[0].split(" ")[0];
    }
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    date: dateStr,
    venue: row.venue,
    logoUrl: row.logo_url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSegment(row: RowDataPacket): Segment {
  return {
    id: row.id,
    pageantId: row.pageant_id,
    name: row.name,
    order: row.order,
    isLocked: !!row.is_locked || !!row.is_hidden,
    isHidden: !!row.is_hidden || !!row.is_locked,
    createdAt: row.created_at,
  };
}

function toCategory(row: RowDataPacket): Category {
  return {
    id: row.id,
    segmentId: row.segment_id,
    name: row.name,
    order: row.order,
    weight: Number(row.weight),
  };
}

function toCriteria(row: RowDataPacket): Criteria {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    weight: Number(row.weight),
    minScore: row.min_score,
    maxScore: row.max_score,
    order: row.order,
  };
}

function toCandidate(row: RowDataPacket): Candidate {
  return {
    id: row.id,
    pageantId: row.pageant_id,
    name: row.name,
    candidateNumber: row.candidate_number,
    photoUrl: row.photo_url ?? undefined,
  };
}

function toJudge(row: RowDataPacket): Judge {
  return {
    id: row.id,
    pageantId: row.pageant_id,
    name: row.name,
    pin: row.pin,
  };
}

function toScore(row: RowDataPacket): Score & { judgeName?: string; criteriaWeight?: number; criteriaMaxScore?: number } {
  return {
    id: row.id,
    judgeId: row.judge_id,
    candidateId: row.candidate_id,
    criteriaId: row.criteria_id,
    value: Number(row.value),
    submittedAt: row.submitted_at,
    judgeName: row.judge_name ?? undefined,
    criteriaWeight: row.criteria_weight !== undefined ? Number(row.criteria_weight) : undefined,
    criteriaMaxScore: row.criteria_max_score !== undefined ? Number(row.criteria_max_score) : undefined,
  };
}

function toPresentationState(row: RowDataPacket): PresentationState {
  return {
    pageantId: row.pageant_id,
    activeSegmentId: row.active_segment_id ?? null,
    activeCategoryId: row.active_category_id,
    activeCandidateId: row.active_candidate_id,
    isIdle: !!row.is_idle,
    showScores: !!row.show_scores,
    showJudgeBreakdown: !!row.show_judge_breakdown,
  };
}

// ============================================================
// Pageant Queries
// ============================================================

export const PageantQueries = {
  async getAll(): Promise<Pageant[]> {
    const rows = await query("SELECT * FROM pageants ORDER BY created_at DESC");
    return rows.map(toPageant);
  },

  async getById(id: string): Promise<Pageant | null> {
    const rows = await query("SELECT * FROM pageants WHERE id = ?", [id]);
    return rows.length > 0 ? toPageant(rows[0]) : null;
  },

  async create(data: CreatePageant): Promise<Pageant> {
    const id = uuidv4();
    const cleanDate = data.date ? String(data.date).split("T")[0].split(" ")[0] : "";
    await execute(
      "INSERT INTO pageants (id, name, description, date, venue, logo_url) VALUES (?, ?, ?, ?, ?, ?)",
      [id, data.name, data.description ?? null, cleanDate, data.venue, data.logoUrl]
    );
    // Also create presentation_state row
    await execute(
      "INSERT INTO presentation_state (pageant_id) VALUES (?)",
      [id]
    );
    return (await PageantQueries.getById(id))!;
  },

  async update(id: string, data: UpdatePageant): Promise<Pageant | null> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
    if (data.description !== undefined) { fields.push("description = ?"); values.push(data.description); }
    if (data.date !== undefined) {
      fields.push("date = ?");
      values.push(data.date ? String(data.date).split("T")[0].split(" ")[0] : "");
    }
    if (data.venue !== undefined) { fields.push("venue = ?"); values.push(data.venue); }
    if (data.logoUrl !== undefined) { fields.push("logo_url = ?"); values.push(data.logoUrl); }
    if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }

    if (fields.length === 0) return PageantQueries.getById(id);

    values.push(id);
    await execute(`UPDATE pageants SET ${fields.join(", ")} WHERE id = ?`, values);
    return PageantQueries.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    const result = await execute("DELETE FROM pageants WHERE id = ?", [id]);
    return result.affectedRows > 0;
  },
};

// ============================================================
// Segment Queries
// ============================================================

export const SegmentQueries = {
  async getByPageantId(pageantId: string): Promise<Segment[]> {
    const rows = await query(
      "SELECT * FROM segments WHERE pageant_id = ? ORDER BY `order` ASC",
      [pageantId]
    );
    return rows.map(toSegment);
  },

  async getById(id: string): Promise<Segment | null> {
    const rows = await query("SELECT * FROM segments WHERE id = ?", [id]);
    return rows.length > 0 ? toSegment(rows[0]) : null;
  },

  async getWithCategories(pageantId: string): Promise<SegmentWithCategories[]> {
    const segments = await SegmentQueries.getByPageantId(pageantId);
    const result: SegmentWithCategories[] = [];
    for (const seg of segments) {
      const categories = await CategoryQueries.getWithCandidates(seg.id);
      result.push({ ...seg, categories });
    }
    return result;
  },

  async create(pageantId: string, data: CreateSegment): Promise<Segment> {
    const id = uuidv4();
    const hiddenVal = (data.isHidden || data.isLocked) ? 1 : 0;
    await execute(
      "INSERT INTO segments (id, pageant_id, name, `order`, is_locked, is_hidden) VALUES (?, ?, ?, ?, ?, ?)",
      [id, pageantId, data.name, data.order, hiddenVal, hiddenVal]
    );
    return (await SegmentQueries.getById(id))!;
  },

  async update(id: string, data: Partial<CreateSegment>): Promise<Segment | null> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
    if (data.order !== undefined) { fields.push("`order` = ?"); values.push(data.order); }
    if (data.isHidden !== undefined) {
      fields.push("is_hidden = ?, is_locked = ?");
      values.push(data.isHidden ? 1 : 0, data.isHidden ? 1 : 0);
    } else if (data.isLocked !== undefined) {
      fields.push("is_hidden = ?, is_locked = ?");
      values.push(data.isLocked ? 1 : 0, data.isLocked ? 1 : 0);
    }

    if (fields.length === 0) return SegmentQueries.getById(id);

    values.push(id);
    await execute(`UPDATE segments SET ${fields.join(", ")} WHERE id = ?`, values);
    return SegmentQueries.getById(id);
  },

  async isCategoryLocked(categoryId: string): Promise<boolean> {
    const rows = await query(
      `SELECT s.is_locked, s.is_hidden FROM segments s
       JOIN categories c ON c.segment_id = s.id
       WHERE c.id = ?`,
      [categoryId]
    );
    return rows.length > 0 ? (!!rows[0].is_locked || !!rows[0].is_hidden) : false;
  },

  async isCriteriaLocked(criteriaId: string): Promise<boolean> {
    const rows = await query(
      `SELECT s.is_locked, s.is_hidden FROM segments s
       JOIN categories c ON c.segment_id = s.id
       JOIN criteria cr ON cr.category_id = c.id
       WHERE cr.id = ?`,
      [criteriaId]
    );
    return rows.length > 0 ? (!!rows[0].is_locked || !!rows[0].is_hidden) : false;
  },

  async delete(id: string): Promise<boolean> {
    const result = await execute("DELETE FROM segments WHERE id = ?", [id]);
    return result.affectedRows > 0;
  },
};

// ============================================================
// Category Queries
// ============================================================

export const CategoryQueries = {
  async getBySegmentId(segmentId: string): Promise<Category[]> {
    const rows = await query(
      "SELECT * FROM categories WHERE segment_id = ? ORDER BY `order` ASC",
      [segmentId]
    );
    return rows.map(toCategory);
  },

  async getById(id: string): Promise<Category | null> {
    const rows = await query("SELECT * FROM categories WHERE id = ?", [id]);
    return rows.length > 0 ? toCategory(rows[0]) : null;
  },

  async getWithCriteria(segmentId: string): Promise<CategoryWithCriteria[]> {
    const categories = await CategoryQueries.getBySegmentId(segmentId);
    const result: CategoryWithCriteria[] = [];
    for (const cat of categories) {
      const criteria = await CriteriaQueries.getByCategoryId(cat.id);
      result.push({ ...cat, criteria });
    }
    return result;
  },

  async getWithCandidates(segmentId: string): Promise<CategoryWithCandidates[]> {
    const categories = await CategoryQueries.getBySegmentId(segmentId);
    const result: CategoryWithCandidates[] = [];
    for (const cat of categories) {
      const criteria = await CriteriaQueries.getByCategoryId(cat.id);
      const candidates = await CategoryCandidateQueries.getByCategoryId(cat.id);
      result.push({ ...cat, criteria, candidates });
    }
    return result;
  },

  /**
   * Get all categories across all segments for a given pageant.
   * Useful for results aggregation.
   */
  async getByPageantId(pageantId: string): Promise<Category[]> {
    const rows = await query(
      `SELECT c.* FROM categories c
       JOIN segments s ON c.segment_id = s.id
       WHERE s.pageant_id = ?
       ORDER BY s.\`order\` ASC, c.\`order\` ASC`,
      [pageantId]
    );
    return rows.map(toCategory);
  },

  /**
   * Get all categories with criteria for a pageant (across all segments).
   */
  async getAllWithCriteria(pageantId: string): Promise<CategoryWithCandidates[]> {
    const categories = await CategoryQueries.getByPageantId(pageantId);
    const result: CategoryWithCandidates[] = [];
    for (const cat of categories) {
      const criteria = await CriteriaQueries.getByCategoryId(cat.id);
      const candidates = await CategoryCandidateQueries.getByCategoryId(cat.id);
      result.push({ ...cat, criteria, candidates });
    }
    return result;
  },

  async create(segmentId: string, data: CreateCategory): Promise<Category> {
    const id = uuidv4();
    await execute(
      "INSERT INTO categories (id, segment_id, name, `order`, weight) VALUES (?, ?, ?, ?, ?)",
      [id, segmentId, data.name, data.order, data.weight]
    );
    // If candidateIds were provided, assign them
    if (data.candidateIds && data.candidateIds.length > 0) {
      await CategoryCandidateQueries.setCandidates(id, data.candidateIds);
    }
    return (await CategoryQueries.getById(id))!;
  },

  async update(id: string, data: Partial<CreateCategory>): Promise<Category | null> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
    if (data.order !== undefined) { fields.push("`order` = ?"); values.push(data.order); }
    if (data.weight !== undefined) { fields.push("weight = ?"); values.push(data.weight); }

    if (fields.length === 0 && !data.candidateIds) return CategoryQueries.getById(id);

    if (fields.length > 0) {
      values.push(id);
      await execute(`UPDATE categories SET ${fields.join(", ")} WHERE id = ?`, values);
    }

    if (data.candidateIds) {
      await CategoryCandidateQueries.setCandidates(id, data.candidateIds);
    }

    return CategoryQueries.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    const result = await execute("DELETE FROM categories WHERE id = ?", [id]);
    return result.affectedRows > 0;
  },
};

// ============================================================
// Category-Candidate Junction Queries
// ============================================================

export const CategoryCandidateQueries = {
  async getByCategoryId(categoryId: string): Promise<Candidate[]> {
    const rows = await query(
      `SELECT c.* FROM candidates c
       JOIN category_candidates cc ON c.id = cc.candidate_id
       WHERE cc.category_id = ?
       ORDER BY c.candidate_number ASC`,
      [categoryId]
    );
    return rows.map(toCandidate);
  },

  /**
   * Bulk-set the candidates assigned to a category (replaces all existing assignments).
   */
  async setCandidates(categoryId: string, candidateIds: string[]): Promise<void> {
    // Remove all existing assignments
    await execute("DELETE FROM category_candidates WHERE category_id = ?", [categoryId]);

    // Insert new assignments
    for (const candidateId of candidateIds) {
      await execute(
        "INSERT INTO category_candidates (category_id, candidate_id) VALUES (?, ?)",
        [categoryId, candidateId]
      );
    }
  },

  async addCandidate(categoryId: string, candidateId: string): Promise<void> {
    await execute(
      "INSERT IGNORE INTO category_candidates (category_id, candidate_id) VALUES (?, ?)",
      [categoryId, candidateId]
    );
  },

  async removeCandidate(categoryId: string, candidateId: string): Promise<void> {
    await execute(
      "DELETE FROM category_candidates WHERE category_id = ? AND candidate_id = ?",
      [categoryId, candidateId]
    );
  },
};

// ============================================================
// Criteria Queries
// ============================================================

export const CriteriaQueries = {
  async getByCategoryId(categoryId: string): Promise<Criteria[]> {
    const rows = await query(
      "SELECT * FROM criteria WHERE category_id = ? ORDER BY `order` ASC",
      [categoryId]
    );
    return rows.map(toCriteria);
  },

  async getById(id: string): Promise<Criteria | null> {
    const rows = await query("SELECT * FROM criteria WHERE id = ?", [id]);
    return rows.length > 0 ? toCriteria(rows[0]) : null;
  },

  async create(categoryId: string, data: CreateCriteria): Promise<Criteria> {
    const id = uuidv4();
    await execute(
      "INSERT INTO criteria (id, category_id, name, weight, min_score, max_score, `order`) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, categoryId, data.name, data.weight, data.minScore, data.maxScore, data.order]
    );
    return (await CriteriaQueries.getById(id))!;
  },

  async update(id: string, data: Partial<CreateCriteria>): Promise<Criteria | null> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
    if (data.weight !== undefined) { fields.push("weight = ?"); values.push(data.weight); }
    if (data.minScore !== undefined) { fields.push("min_score = ?"); values.push(data.minScore); }
    if (data.maxScore !== undefined) { fields.push("max_score = ?"); values.push(data.maxScore); }
    if (data.order !== undefined) { fields.push("`order` = ?"); values.push(data.order); }

    if (fields.length === 0) return CriteriaQueries.getById(id);

    values.push(id);
    await execute(`UPDATE criteria SET ${fields.join(", ")} WHERE id = ?`, values);
    return CriteriaQueries.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    const result = await execute("DELETE FROM criteria WHERE id = ?", [id]);
    return result.affectedRows > 0;
  },
};

// ============================================================
// Candidate Queries
// ============================================================

export const CandidateQueries = {
  async getByPageantId(pageantId: string): Promise<Candidate[]> {
    const rows = await query(
      "SELECT * FROM candidates WHERE pageant_id = ? ORDER BY candidate_number ASC",
      [pageantId]
    );
    return rows.map(toCandidate);
  },

  async getById(id: string): Promise<Candidate | null> {
    const rows = await query("SELECT * FROM candidates WHERE id = ?", [id]);
    return rows.length > 0 ? toCandidate(rows[0]) : null;
  },

  async create(pageantId: string, data: CreateCandidate): Promise<Candidate> {
    const id = uuidv4();
    await execute(
      "INSERT INTO candidates (id, pageant_id, name, candidate_number) VALUES (?, ?, ?, ?)",
      [id, pageantId, data.name, data.candidateNumber]
    );
    return (await CandidateQueries.getById(id))!;
  },

  async update(id: string, data: Partial<CreateCandidate> & { photoUrl?: string }): Promise<Candidate | null> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
    if (data.candidateNumber !== undefined) { fields.push("candidate_number = ?"); values.push(data.candidateNumber); }
    if (data.photoUrl !== undefined) { fields.push("photo_url = ?"); values.push(data.photoUrl); }

    if (fields.length === 0) return CandidateQueries.getById(id);

    values.push(id);
    await execute(`UPDATE candidates SET ${fields.join(", ")} WHERE id = ?`, values);
    return CandidateQueries.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    const result = await execute("DELETE FROM candidates WHERE id = ?", [id]);
    return result.affectedRows > 0;
  },
};

// ============================================================
// Judge Queries
// ============================================================

export const JudgeQueries = {
  async getByPageantId(pageantId: string): Promise<Judge[]> {
    const rows = await query(
      "SELECT * FROM judges WHERE pageant_id = ? ORDER BY name ASC",
      [pageantId]
    );
    return rows.map(toJudge);
  },

  async getById(id: string): Promise<Judge | null> {
    const rows = await query("SELECT * FROM judges WHERE id = ?", [id]);
    return rows.length > 0 ? toJudge(rows[0]) : null;
  },

  async getByPin(pin: string): Promise<Judge | null> {
    const rows = await query("SELECT * FROM judges WHERE pin = ?", [pin]);
    return rows.length > 0 ? toJudge(rows[0]) : null;
  },

  async create(pageantId: string, data: CreateJudge): Promise<Judge> {
    const id = uuidv4();
    await execute(
      "INSERT INTO judges (id, pageant_id, name, pin) VALUES (?, ?, ?, ?)",
      [id, pageantId, data.name, data.pin]
    );
    return (await JudgeQueries.getById(id))!;
  },

  async delete(id: string): Promise<boolean> {
    const result = await execute("DELETE FROM judges WHERE id = ?", [id]);
    return result.affectedRows > 0;
  },

  async update(id: string, data: Partial<CreateJudge>): Promise<Judge | null> {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.name !== undefined) {
      fields.push("name = ?");
      values.push(data.name);
    }
    if (data.pin !== undefined) {
      fields.push("pin = ?");
      values.push(data.pin);
    }
    if (fields.length === 0) return JudgeQueries.getById(id);
    values.push(id);
    await execute(
      `UPDATE judges SET ${fields.join(", ")} WHERE id = ?`,
      values
    );
    return JudgeQueries.getById(id);
  },
};

// ============================================================
// Score Queries
// ============================================================

export const ScoreQueries = {
  async getByCandidateAndCategory(
    candidateId: string,
    categoryId: string
  ): Promise<Score[]> {
    const rows = await query(
      `SELECT s.*, j.name as judge_name, cr.weight as criteria_weight, cr.max_score as criteria_max_score FROM scores s
       JOIN criteria cr ON s.criteria_id = cr.id
       JOIN judges j ON s.judge_id = j.id
       WHERE s.candidate_id = ? AND cr.category_id = ?`,
      [candidateId, categoryId]
    );
    return rows.map(toScore);
  },

  async getByJudgeCandidateCategory(
    judgeId: string,
    candidateId: string,
    categoryId: string
  ): Promise<Score[]> {
    const rows = await query(
      `SELECT s.* FROM scores s
       JOIN criteria cr ON s.criteria_id = cr.id
       WHERE s.judge_id = ? AND s.candidate_id = ? AND cr.category_id = ?`,
      [judgeId, candidateId, categoryId]
    );
    return rows.map(toScore);
  },

  async submit(
    judgeId: string,
    candidateId: string,
    scores: { criteriaId: string; value: number }[]
  ): Promise<Score[]> {
    const result: Score[] = [];
    for (const s of scores) {
      const id = uuidv4();
      // Upsert: insert or update if already exists
      await execute(
        `INSERT INTO scores (id, judge_id, candidate_id, criteria_id, value)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE value = ?, submitted_at = CURRENT_TIMESTAMP`,
        [id, judgeId, candidateId, s.criteriaId, s.value, s.value]
      );
      // Fetch the actual saved score
      const rows = await query(
        "SELECT * FROM scores WHERE judge_id = ? AND candidate_id = ? AND criteria_id = ?",
        [judgeId, candidateId, s.criteriaId]
      );
      if (rows.length > 0) result.push(toScore(rows[0]));
    }
    return result;
  },

  async override(
    judgeId: string,
    candidateId: string,
    criteriaId: string,
    value: number
  ): Promise<Score | null> {
    const id = uuidv4();
    await execute(
      `INSERT INTO scores (id, judge_id, candidate_id, criteria_id, value)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE value = ?, submitted_at = CURRENT_TIMESTAMP`,
      [id, judgeId, candidateId, criteriaId, value, value]
    );
    const rows = await query(
      "SELECT * FROM scores WHERE judge_id = ? AND candidate_id = ? AND criteria_id = ?",
      [judgeId, candidateId, criteriaId]
    );
    return rows.length > 0 ? toScore(rows[0]) : null;
  },

  async deleteByJudgeCandidateCategory(
    judgeId: string,
    candidateId: string,
    categoryId: string
  ): Promise<boolean> {
    await execute(
      `DELETE FROM scores
       WHERE judge_id = ? AND candidate_id = ? AND criteria_id IN (
         SELECT id FROM criteria WHERE category_id = ?
       )`,
      [judgeId, candidateId, categoryId]
    );
    return true;
  },

  /**
   * Get aggregated results for a pageant.
   * Returns all scores grouped by candidate and category with judge breakdown.
   */
  async getResultsByPageant(pageantId: string) {
    const rows = await query(
      `SELECT
         s.id as score_id,
         s.value,
         s.judge_id,
         j.name as judge_name,
         s.candidate_id,
         c.name as candidate_name,
         c.candidate_number,
         c.photo_url,
         s.criteria_id,
         cr.name as criteria_name,
         cr.weight as criteria_weight,
         cr.min_score,
         cr.max_score,
         cr.category_id,
         cat.name as category_name,
         cat.weight as category_weight,
         cat.segment_id,
         seg.name as segment_name,
         seg.\`order\` as segment_order
       FROM scores s
       JOIN judges j ON s.judge_id = j.id
       JOIN candidates c ON s.candidate_id = c.id
       JOIN criteria cr ON s.criteria_id = cr.id
       JOIN categories cat ON cr.category_id = cat.id
       JOIN segments seg ON cat.segment_id = seg.id
       WHERE seg.pageant_id = ?
       ORDER BY seg.\`order\`, c.candidate_number, cat.\`order\`, cr.\`order\`, j.name`,
      [pageantId]
    );
    return rows;
  },

  /**
   * Check which judges have submitted scores for a given candidate in a given category.
   */
  async getSubmissionStatus(
    candidateId: string,
    categoryId: string,
    judgeIds: string[]
  ): Promise<Map<string, boolean>> {
    const statusMap = new Map<string, boolean>();
    for (const jId of judgeIds) {
      statusMap.set(jId, false);
    }

    if (judgeIds.length === 0) return statusMap;

    const placeholders = judgeIds.map(() => "?").join(",");
    const rows = await query(
      `SELECT DISTINCT s.judge_id
       FROM scores s
       JOIN criteria cr ON s.criteria_id = cr.id
       WHERE s.candidate_id = ? AND cr.category_id = ? AND s.judge_id IN (${placeholders})`,
      [candidateId, categoryId, ...judgeIds]
    );

    for (const row of rows) {
      statusMap.set(row.judge_id, true);
    }
    return statusMap;
  },
};

// ============================================================
// Presentation State Queries
// ============================================================

export const PresentationQueries = {
  async get(pageantId: string): Promise<PresentationState | null> {
    const rows = await query(
      "SELECT * FROM presentation_state WHERE pageant_id = ?",
      [pageantId]
    );
    return rows.length > 0 ? toPresentationState(rows[0]) : null;
  },

  async update(
    pageantId: string,
    data: Partial<Omit<PresentationState, "pageantId">>
  ): Promise<PresentationState | null> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.activeSegmentId !== undefined) {
      fields.push("active_segment_id = ?");
      values.push(data.activeSegmentId);
    }
    if (data.activeCategoryId !== undefined) {
      fields.push("active_category_id = ?");
      values.push(data.activeCategoryId);
    }
    if (data.activeCandidateId !== undefined) {
      fields.push("active_candidate_id = ?");
      values.push(data.activeCandidateId);
    }
    if (data.isIdle !== undefined) {
      fields.push("is_idle = ?");
      values.push(data.isIdle);
    }
    if (data.showScores !== undefined) {
      fields.push("show_scores = ?");
      values.push(data.showScores);
    }
    if (data.showJudgeBreakdown !== undefined) {
      fields.push("show_judge_breakdown = ?");
      values.push(data.showJudgeBreakdown);
    }

    if (fields.length === 0) return PresentationQueries.get(pageantId);

    values.push(pageantId);
    await execute(
      `UPDATE presentation_state SET ${fields.join(", ")} WHERE pageant_id = ?`,
      values
    );
    return PresentationQueries.get(pageantId);
  },
};
