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

export interface Category {
  id: string;
  pageantId: string;
  name: string;
  order: number;
  weight: number; // percentage of total (e.g. 30 = 30%)
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
}

export interface Judge {
  id: string;
  pageantId: string;
  name: string;
  pin: string;
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
  isIdle: boolean;
  showScores: boolean;
  showJudgeBreakdown: boolean;
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
  };
}

export interface JudgeJwtPayload {
  judgeId: string;
  pageantId: string;
  judgeName: string;
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
  "judge:assistance-alert": (payload: {
    judgeId: string;
    judgeName: string;
    pageantId?: string;
    timestamp?: string;
  }) => void;
}

export interface ClientToServerEvents {
  "judge:submit-score": (payload: ScoreSubmission) => void;
  "admin:set-presentation": (state: Partial<PresentationState>) => void;
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

// === Pageant with full nested data ===

export interface PageantFull extends Pageant {
  categories: CategoryWithCriteria[];
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

export interface CreateCategory {
  name: string;
  order: number;
  weight: number;
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
}

export interface CreateJudge {
  name: string;
  pin: string;
}
