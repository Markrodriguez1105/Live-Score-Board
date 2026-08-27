import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "pageant_secret_123",
    database: process.env.DB_NAME || "pageant_db",
  });

  console.log("Connected. Altering table...");
  try {
    await connection.execute("ALTER TABLE criteria MODIFY min_score DECIMAL(5,2) NOT NULL DEFAULT 1, MODIFY max_score DECIMAL(5,2) NOT NULL DEFAULT 100");
    console.log("Table altered successfully!");
  } catch (err) {
    console.error("Error altering table:", err);
  }
  
  await connection.end();
}

run();
