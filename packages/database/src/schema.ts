// ============================================================
// Database Schema — Table Creation
// ============================================================

import { getPool } from "./index.js";

/**
 * Create all tables if they don't exist.
 * Call this once at server startup after initDatabase().
 */
export async function initSchema(): Promise<void> {
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    // Pageants
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS pageants (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        date DATE NOT NULL,
        venue VARCHAR(255) NOT NULL,
        logo_url VARCHAR(500) NOT NULL,
        status ENUM('draft', 'active', 'completed') NOT NULL DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Categories
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(36) PRIMARY KEY,
        pageant_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        \`order\` INT NOT NULL DEFAULT 0,
        weight DECIMAL(5,2) NOT NULL DEFAULT 0,
        FOREIGN KEY (pageant_id) REFERENCES pageants(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Criteria
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS criteria (
        id VARCHAR(36) PRIMARY KEY,
        category_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        weight DECIMAL(5,2) NOT NULL DEFAULT 0,
        min_score INT NOT NULL DEFAULT 1,
        max_score INT NOT NULL DEFAULT 100,
        \`order\` INT NOT NULL DEFAULT 0,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Candidates
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS candidates (
        id VARCHAR(36) PRIMARY KEY,
        pageant_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        candidate_number INT NOT NULL,
        photo_url VARCHAR(500),
        FOREIGN KEY (pageant_id) REFERENCES pageants(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Judges
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS judges (
        id VARCHAR(36) PRIMARY KEY,
        pageant_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        pin VARCHAR(20) NOT NULL,
        FOREIGN KEY (pageant_id) REFERENCES pageants(id) ON DELETE CASCADE,
        UNIQUE KEY unique_pin_per_pageant (pageant_id, pin)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Scores
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS scores (
        id VARCHAR(36) PRIMARY KEY,
        judge_id VARCHAR(36) NOT NULL,
        candidate_id VARCHAR(36) NOT NULL,
        criteria_id VARCHAR(36) NOT NULL,
        value DECIMAL(5,2) NOT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (judge_id) REFERENCES judges(id) ON DELETE CASCADE,
        FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
        FOREIGN KEY (criteria_id) REFERENCES criteria(id) ON DELETE CASCADE,
        UNIQUE KEY unique_score (judge_id, candidate_id, criteria_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Presentation State (one row per pageant)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS presentation_state (
        pageant_id VARCHAR(36) PRIMARY KEY,
        active_category_id VARCHAR(36),
        active_candidate_id VARCHAR(36),
        is_idle BOOLEAN NOT NULL DEFAULT TRUE,
        show_scores BOOLEAN NOT NULL DEFAULT TRUE,
        show_judge_breakdown BOOLEAN NOT NULL DEFAULT FALSE,
        FOREIGN KEY (pageant_id) REFERENCES pageants(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log("[DB] Schema initialized — all tables ready.");
  } finally {
    conn.release();
  }
}
