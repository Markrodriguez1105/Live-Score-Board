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
        is_simultaneous BOOLEAN NOT NULL DEFAULT FALSE,
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
        is_simultaneous BOOLEAN NOT NULL DEFAULT FALSE,
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
        display_mode VARCHAR(20) NOT NULL DEFAULT 'default',
        score_position VARCHAR(20) NOT NULL DEFAULT 'bottom',
        show_elements VARCHAR(20) NOT NULL DEFAULT 'all',
        score_layout VARCHAR(20) NOT NULL DEFAULT 'grid',
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

    // Add is_simultaneous to segments if it doesn't exist
    try {
      const [segCols] = await conn.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'segments' AND COLUMN_NAME = 'is_simultaneous'`
      );
      if (Array.isArray(segCols) && (segCols as any[]).length === 0) {
        await conn.execute(
          `ALTER TABLE segments ADD COLUMN is_simultaneous BOOLEAN NOT NULL DEFAULT FALSE AFTER is_hidden`
        );
        console.log("[DB] Added is_simultaneous to segments.");
      }
    } catch {
      // Column already exists or table is fresh
    }

    // Add is_simultaneous to categories if it doesn't exist
    try {
      const [catCols] = await conn.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'is_simultaneous'`
      );
      if (Array.isArray(catCols) && (catCols as any[]).length === 0) {
        await conn.execute(
          `ALTER TABLE categories ADD COLUMN is_simultaneous BOOLEAN NOT NULL DEFAULT FALSE AFTER weight`
        );
        console.log("[DB] Added is_simultaneous to categories.");
      }
    } catch {
      // Column already exists or table is fresh
    }

    // Add display_mode to presentation_state if it doesn't exist
    try {
      const [presCols] = await conn.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'presentation_state' AND COLUMN_NAME = 'display_mode'`
      );
      if (Array.isArray(presCols) && (presCols as any[]).length === 0) {
        await conn.execute(
          `ALTER TABLE presentation_state ADD COLUMN display_mode VARCHAR(20) NOT NULL DEFAULT 'default' AFTER show_judge_breakdown`
        );
        console.log("[DB] Added display_mode to presentation_state.");
      }
    } catch {
      // Column already exists or table is fresh
    }

    // Add score_position to presentation_state if it doesn't exist
    try {
      const [presCols] = await conn.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'presentation_state' AND COLUMN_NAME = 'score_position'`
      );
      if (Array.isArray(presCols) && (presCols as any[]).length === 0) {
        await conn.execute(
          `ALTER TABLE presentation_state ADD COLUMN score_position VARCHAR(20) NOT NULL DEFAULT 'bottom' AFTER display_mode`
        );
        console.log("[DB] Added score_position to presentation_state.");
      }
    } catch {
      // Column already exists or table is fresh
    }

    // Add show_elements to presentation_state if it doesn't exist
    try {
      const [presCols] = await conn.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'presentation_state' AND COLUMN_NAME = 'show_elements'`
      );
      if (Array.isArray(presCols) && (presCols as any[]).length === 0) {
        await conn.execute(
          `ALTER TABLE presentation_state ADD COLUMN show_elements VARCHAR(20) NOT NULL DEFAULT 'all' AFTER score_position`
        );
        console.log("[DB] Added show_elements to presentation_state.");
      }
    } catch {
      // Column already exists or table is fresh
    }

    // Add score_layout to presentation_state if it doesn't exist
    try {
      const [presCols] = await conn.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'presentation_state' AND COLUMN_NAME = 'score_layout'`
      );
      if (Array.isArray(presCols) && (presCols as any[]).length === 0) {
        await conn.execute(
          `ALTER TABLE presentation_state ADD COLUMN score_layout VARCHAR(20) NOT NULL DEFAULT 'grid' AFTER show_elements`
        );
        console.log("[DB] Added score_layout to presentation_state.");
      }
    } catch {
      // Column already exists or table is fresh
    }

    // Add judge_number to judges if it doesn't exist
    try {
      const [cols] = await conn.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'judges' AND COLUMN_NAME = 'judge_number'`
      );
      if (Array.isArray(cols) && (cols as any[]).length === 0) {
        await conn.execute(
          `ALTER TABLE judges ADD COLUMN judge_number INT AFTER pin`
        );
        console.log("[DB] Added judge_number to judges.");
      }
    } catch (err) {
      console.error("[DB] Error adding judge_number:", err);
    }

    // Backfill NULL judge_number for existing judges
    try {
      const [judgesRows]: any = await conn.execute(
        "SELECT id, pageant_id, name FROM judges WHERE judge_number IS NULL ORDER BY pageant_id, name"
      );
      if (judgesRows && judgesRows.length > 0) {
        console.log(`[DB] Backfilling judge_number for ${judgesRows.length} judges...`);
        const pageantCount: Record<string, number> = {};
        for (const j of judgesRows) {
          if (!pageantCount[j.pageant_id]) {
            const [maxRes]: any = await conn.execute(
              "SELECT MAX(judge_number) as max_num FROM judges WHERE pageant_id = ?",
              [j.pageant_id]
            );
            pageantCount[j.pageant_id] = (maxRes[0]?.max_num || 0) + 1;
          } else {
            pageantCount[j.pageant_id]++;
          }
          await conn.execute(
            "UPDATE judges SET judge_number = ? WHERE id = ?",
            [pageantCount[j.pageant_id], j.id]
          );
        }
        console.log("[DB] Finished backfilling judge_number.");
      }
    } catch (err) {
      console.error("[DB] Error backfilling judge_number:", err);
    }

    // Add location fields to candidates if they don't exist
    const locCols = ["barangay", "municipality", "province", "region", "country"];
    for (const col of locCols) {
      try {
        const [cols] = await conn.execute(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'candidates' AND COLUMN_NAME = '${col}'`
        );
        if (Array.isArray(cols) && (cols as any[]).length === 0) {
          await conn.execute(
            `ALTER TABLE candidates ADD COLUMN ${col} VARCHAR(255) NULL`
          );
          console.log(`[DB] Added column ${col} to candidates.`);
        }
      } catch (err) {
        console.error(`[DB] Error adding column ${col} to candidates:`, err);
      }
    }

    console.log("[DB] Schema initialized — all tables ready.");
  } finally {
    conn.release();
  }
}
