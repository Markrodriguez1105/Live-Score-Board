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

    // Segments
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS segments (
        id VARCHAR(36) PRIMARY KEY,
        pageant_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        \`order\` INT NOT NULL DEFAULT 0,
        is_locked BOOLEAN NOT NULL DEFAULT FALSE,
        is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pageant_id) REFERENCES pageants(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Categories (now belongs to segment instead of pageant)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(36) PRIMARY KEY,
        segment_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        \`order\` INT NOT NULL DEFAULT 0,
        weight DECIMAL(5,2) NOT NULL DEFAULT 0,
        FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE
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

    // Category-Candidate junction table (many-to-many)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS category_candidates (
        category_id VARCHAR(36) NOT NULL,
        candidate_id VARCHAR(36) NOT NULL,
        PRIMARY KEY (category_id, candidate_id),
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
        FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
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
        active_segment_id VARCHAR(36),
        active_category_id VARCHAR(36),
        active_candidate_id VARCHAR(36),
        is_idle BOOLEAN NOT NULL DEFAULT TRUE,
        show_scores BOOLEAN NOT NULL DEFAULT TRUE,
        show_judge_breakdown BOOLEAN NOT NULL DEFAULT FALSE,
        FOREIGN KEY (pageant_id) REFERENCES pageants(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ── Migration helpers ─────────────────────────────────────
    // Add segment_id column to categories if it doesn't exist (migration from old schema)
    try {
      const [cols] = await conn.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'pageant_id'`
      );
      if (Array.isArray(cols) && (cols as any[]).length > 0) {
        // Old schema detected — migrate categories to segments
        console.log("[DB] Migrating categories from pageant_id to segment_id...");

        // Check if segment_id column already exists
        const [segCols] = await conn.execute(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'segment_id'`
        );

        if (Array.isArray(segCols) && (segCols as any[]).length === 0) {
          // 1. Add segment_id column
          await conn.execute(`ALTER TABLE categories ADD COLUMN segment_id VARCHAR(36) AFTER id`);

          // 2. For each distinct pageant_id in categories, create a default segment
          const [pageantIds] = await conn.execute(
            `SELECT DISTINCT pageant_id FROM categories`
          );

          for (const row of pageantIds as any[]) {
            // Check if a segment already exists for this pageant
            const [existingSegs] = await conn.execute(
              `SELECT id FROM segments WHERE pageant_id = ?`, [row.pageant_id]
            );

            let segId: string;
            if (Array.isArray(existingSegs) && (existingSegs as any[]).length > 0) {
              segId = (existingSegs as any[])[0].id;
            } else {
              const { v4: uuidv4 } = await import("uuid");
              segId = uuidv4();
              await conn.execute(
                `INSERT INTO segments (id, pageant_id, name, \`order\`) VALUES (?, ?, 'Main Competition', 1)`,
                [segId, row.pageant_id]
              );
            }

            // 3. Update categories to point to the new segment
            await conn.execute(
              `UPDATE categories SET segment_id = ? WHERE pageant_id = ?`,
              [segId, row.pageant_id]
            );
          }

          // 4. Drop old FK and column, add new FK
          try {
            // Find the FK constraint name for pageant_id
            const [fks] = await conn.execute(
              `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'pageant_id' AND REFERENCED_TABLE_NAME = 'pageants'`
            );
            for (const fk of fks as any[]) {
              await conn.execute(`ALTER TABLE categories DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
            }
          } catch {
            // FK might not exist
          }

          await conn.execute(`ALTER TABLE categories DROP COLUMN pageant_id`);
          await conn.execute(
            `ALTER TABLE categories MODIFY COLUMN segment_id VARCHAR(36) NOT NULL`
          );
          await conn.execute(
            `ALTER TABLE categories ADD FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE`
          );

          console.log("[DB] Migration complete — categories now use segment_id.");
        }
      }
    } catch {
      // No migration needed or table is fresh
    }

    // Add active_segment_id to presentation_state if it doesn't exist
    try {
      const [presCols] = await conn.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'presentation_state' AND COLUMN_NAME = 'active_segment_id'`
      );
      if (Array.isArray(presCols) && (presCols as any[]).length === 0) {
        await conn.execute(
          `ALTER TABLE presentation_state ADD COLUMN active_segment_id VARCHAR(36) AFTER pageant_id`
        );
        console.log("[DB] Added active_segment_id to presentation_state.");
      }
    } catch {
      // Column already exists or table is fresh
    }

    // Add is_hidden to segments if it doesn't exist
    try {
      const [segCols] = await conn.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'segments' AND COLUMN_NAME = 'is_hidden'`
      );
      if (Array.isArray(segCols) && (segCols as any[]).length === 0) {
        await conn.execute(
          `ALTER TABLE segments ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT FALSE AFTER \`order\``
        );
        console.log("[DB] Added is_hidden to segments.");
      }
    } catch {
      // Column already exists or table is fresh
    }

    console.log("[DB] Schema initialized — all tables ready.");
  } finally {
    conn.release();
  }
}
