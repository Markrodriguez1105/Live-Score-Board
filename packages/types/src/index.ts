// ============================================================
// Pageant Management System — Shared Types
// ============================================================

// === Core Entities ===

export interface Pageant {
  id: string;
  name: string;
  description?: string;
  date: string;
  venue: string;
  logoUrl: string;
  status: "draft" | "active" | "completed";
  createdAt: string;
  updatedAt: string;
}

export interface Segment {
  id: string;
  pageantId: string;
  name: string;
  order: number;
  isLocked: boolean;
  isHidden: boolean;
  isSimultaneous?: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  segmentId: string;
  name: string;
  order: number;
  weight: number; // percentage of total (e.g. 30 = 30%)
  isSimultaneous?: boolean;
}

export interface Criteria {
  id: string;
  categoryId: string;
  name: string;
  weight: number; // percentage within category (e.g. 40 = 40%)
  minScore: number;
  maxScore: number;
  order: number;
}

export interface Candidate {
  id: string;
  pageantId: string;
  name: string;
  candidateNumber: number;
  photoUrl?: string;
  barangay?: string;
  municipality?: string;
  province?: string;
  region?: string;
  country?: string;
}

export interface Judge {
  id: string;
  pageantId: string;
  name: string;
  pin: string;
  judgeNumber: number;
}

export interface Score {
  id: string;
  judgeId: string;
  candidateId: string;
  criteriaId: string;
  value: number;
  submittedAt: string;
}

// === Presentation / Live Control ===

export interface PresentationState {
  pageantId: string;
  activeCategoryId: string | null;
  activeCandidateId: string | null;
  activeSegmentId: string | null;
  isIdle: boolean;
  showScores: boolean;
  showJudgeBreakdown: boolean;
  displayMode?: "default" | "chroma";
  scorePosition?: "bottom" | "left" | "right";
  showElements?: "all" | "score" | "candidate";
  scoreLayout?: "row" | "column" | "grid";
}

// === Auth ===

export interface AdminLoginPayload {
  username: string;
  password: string;
}

export interface JudgeAuthPayload {
  pin: string;
}

export interface JudgeAuthResponse {
  token: string;
  judge: {
    id: string;
    name: string;
    pageantId: string;
    judgeNumber: number;
  };
}

export interface JudgeJwtPayload {
  judgeId: string;
  pageantId: string;
  judgeName: string;
  judgeNumber: number;
}

// === Score Submission ===

export interface ScoreSubmission {
  candidateId: string;
  scores: {
    criteriaId: string;
    value: number;
  }[];
}

export interface ScoreOverride {
  judgeId: string;
  candidateId: string;
  criteriaId: string;
  value: number;
}

// === Score Aggregation (computed) ===

export interface CriteriaScore {
  criteriaId: string;
  criteriaName: string;
  value: number;
  minScore: number;
  maxScore: number;
}

export interface JudgeScoreSummary {
  judgeId: string;
  judgeName: string;
  scores: CriteriaScore[];
  submitted: boolean;
}

export interface CandidateScoreSummary {
  candidateId: string;
  candidateName: string;
  candidateNumber: number;
  photoUrl?: string;
  judgeScores: JudgeScoreSummary[];
  categoryTotal: number;
  overallTotal: number;
  rank?: number;
}

// === Socket.IO Event Maps ===

export interface ServerToClientEvents {
  "presentation:update": (state: PresentationState) => void;
  "scores:update": (payload: {
    candidateId: string;
    categoryId: string;
    judgeScores: JudgeScoreSummary[];
  }) => void;
  "scores:locked": (payload: {
    categoryId: string;
    candidateId: string;
  }) => void;
  "segment:lock-update": (payload: {
    segmentId: string;
    isLocked: boolean;
  }) => void;
  "segment:hide-update": (payload: {
    segmentId: string;
    isHidden: boolean;
  }) => void;
  "category:candidates-update": (payload: {
    categoryId: string;
    candidateIds: string[];
  }) => void;
  "judge:assistance-alert": (payload: {
    judgeId: string;
    judgeName: string;
    pageantId?: string;
    timestamp?: string;
  }) => void;
  "judge:status-update": (payload: {
    judgeId: string;
    judgeName: string;
    judgeNumber: number;
    candidateId: string;
    categoryId: string;
    status: "unsaved" | "saved" | "pending";
  }) => void;
  "admin:initial-judge-statuses": (payload: {
    judgeId: string;
    judgeName: string;
    judgeNumber: number;
    candidateId: string;
    categoryId: string;
    status: "unsaved" | "saved" | "pending";
  }[]) => void;
}

export interface ClientToServerEvents {
  "judge:submit-score": (payload: ScoreSubmission) => void;
  "judge:status-update": (payload: {
    candidateId: string;
    categoryId: string;
    status: "unsaved" | "saved" | "pending";
  }) => void;
  "admin:set-presentation": (state: Partial<PresentationState>) => void;
  "admin:toggle-segment-lock": (payload: { segmentId: string; isLocked: boolean }) => void;
  "admin:toggle-segment-hide": (payload: { segmentId: string; isHidden: boolean }) => void;
  "tabulator:override-score": (payload: ScoreOverride) => void;
  "judge:request-assistance": (payload: {
    judgeId: string;
    judgeName: string;
    pageantId?: string;
  }) => void;
}

// === API Response Wrappers ===

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// === Category with nested criteria (for admin forms) ===

export interface CategoryWithCriteria extends Category {
  criteria: Criteria[];
}

// === Category with nested criteria AND assigned candidates ===

export interface CategoryWithCandidates extends CategoryWithCriteria {
  candidates: Candidate[];
}

// === Segment with nested categories (each with criteria + candidates) ===

export interface SegmentWithCategories extends Segment {
  categories: CategoryWithCandidates[];
}

// === Pageant with full nested data ===

export interface PageantFull extends Pageant {
  segments: SegmentWithCategories[];
  candidates: Candidate[];
  judges: Judge[];
}

// === Create / Update DTOs ===

export interface CreatePageant {
  name: string;
  description?: string;
  date: string;
  venue: string;
  logoUrl: string;
}

export interface UpdatePageant extends Partial<CreatePageant> {
  status?: "draft" | "active" | "completed";
}

export interface CreateSegment {
  name: string;
  order: number;
  isLocked?: boolean;
  isHidden?: boolean;
  isSimultaneous?: boolean;
}

export interface CreateCategory {
  name: string;
  order: number;
  weight: number;
  isSimultaneous?: boolean;
  candidateIds?: string[];
}

export interface CreateCriteria {
  name: string;
  weight: number;
  minScore: number;
  maxScore: number;
  order: number;
}

export interface CreateCandidate {
  name: string;
  candidateNumber: number;
  barangay?: string;
  municipality?: string;
  province?: string;
  region?: string;
  country?: string;
}

export interface CreateJudge {
  name: string;
  pin: string;
  judgeNumber?: number;
}

export function getActualScoreValue(_judgeNumber: number | undefined, rawScore: number, _maxScore: number): number {
  return rawScore;
}
