// ============================================================
// Auth Middleware — Admin Session + Judge JWT
// ============================================================

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JudgeJwtPayload } from "@pageant/types";

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!JWT_SECRET || !ADMIN_USERNAME || !ADMIN_PASSWORD) {
  throw new Error(
    "Missing required authentication environment variables. Please check that JWT_SECRET, ADMIN_USERNAME, and ADMIN_PASSWORD are defined in your .env file."
  );
}

// Extend express-session
declare module "express-session" {
  interface SessionData {
    isAdmin?: boolean;
  }
}

// Extend Express Request to include judge info
declare global {
  namespace Express {
    interface Request {
      judge?: JudgeJwtPayload;
    }
  }
}

/**
 * Validate admin credentials and create session.
 */
export function loginAdmin(req: Request, res: Response) {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.json({ success: true, data: { message: "Logged in" } });
  } else {
    res.status(401).json({ success: false, error: "Invalid credentials" });
  }
}

/**
 * Logout admin — destroy session.
 */
export function logoutAdmin(req: Request, res: Response) {
  req.session.destroy(() => {
    res.json({ success: true, data: { message: "Logged out" } });
  });
}

/**
 * Check admin session status.
 */
export function checkAdminSession(req: Request, res: Response) {
  res.json({ success: true, data: { isAdmin: !!req.session.isAdmin } });
}

/**
 * Middleware: require admin session.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session.isAdmin) {
    next();
  } else {
    res.status(401).json({ success: false, error: "Admin authentication required" });
  }
}

/**
 * Generate a JWT for a judge.
 */
export function generateJudgeToken(payload: JudgeJwtPayload): string {
  return jwt.sign(payload, JWT_SECRET || "", { expiresIn: "24h" });
}

/**
 * Middleware: require valid judge JWT.
 * Token expected in Authorization: Bearer <token>
 */
export function requireJudge(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "Judge token required" });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET || "") as JudgeJwtPayload;
    req.judge = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}
