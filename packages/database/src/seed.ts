// ============================================================
// Database Seed — Development Sample Data
// ============================================================

import "dotenv/config";
import { initDatabase, initSchema } from "./index.js";
import {
  PageantQueries,
  CategoryQueries,
  CriteriaQueries,
  CandidateQueries,
  JudgeQueries,
} from "./queries.js";

async function seed() {
  // Initialize database connection
  initDatabase({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "pageant_db",
  });

  // Create tables
  await initSchema();

  console.log("\n🌱 Seeding database...\n");

  // 1. Create a sample pageant
  const pageant = await PageantQueries.create({
    name: "Miss Universe 2026",
    description: "Annual beauty pageant showcasing talent, beauty, and grace.",
    date: "2026-12-15",
    venue: "Grand Ballroom, Manila",
    logoUrl: "/uploads/logo-default.png",
  });
  console.log(`✅ Pageant created: ${pageant.name} (${pageant.id})`);

  // 2. Create categories
  const swimwear = await CategoryQueries.create(pageant.id, {
    name: "Swimwear",
    order: 1,
    weight: 25,
  });
  const eveningGown = await CategoryQueries.create(pageant.id, {
    name: "Evening Gown",
    order: 2,
    weight: 25,
  });
  const talent = await CategoryQueries.create(pageant.id, {
    name: "Talent",
    order: 3,
    weight: 25,
  });
  const qa = await CategoryQueries.create(pageant.id, {
    name: "Question & Answer",
    order: 4,
    weight: 25,
  });
  console.log(`✅ Categories created: 4`);

  // 3. Create criteria for each category
  const criteriaData = [
    {
      categoryId: swimwear.id, criteria: [
        { name: "Poise & Bearing", weight: 40, minScore: 10, maxScore: 20, order: 1 },
        { name: "Stage Presence", weight: 30, minScore: 10, maxScore: 20, order: 2 },
        { name: "Audience Impact", weight: 30, minScore: 10, maxScore: 20, order: 3 },
      ]
    },
    {
      categoryId: eveningGown.id, criteria: [
        { name: "Elegance", weight: 40, minScore: 10, maxScore: 20, order: 1 },
        { name: "Overall Appearance", weight: 35, minScore: 10, maxScore: 20, order: 2 },
        { name: "Confidence", weight: 25, minScore: 10, maxScore: 20, order: 3 },
      ]
    },
    {
      categoryId: talent.id, criteria: [
        { name: "Performance Quality", weight: 50, minScore: 10, maxScore: 20, order: 1 },
        { name: "Creativity", weight: 30, minScore: 10, maxScore: 20, order: 2 },
        { name: "Entertainment Value", weight: 20, minScore: 10, maxScore: 20, order: 3 },
      ]
    },
    {
      categoryId: qa.id, criteria: [
        { name: "Content & Substance", weight: 50, minScore: 10, maxScore: 20, order: 1 },
        { name: "Communication Skills", weight: 30, minScore: 10, maxScore: 20, order: 2 },
        { name: "Wit & Spontaneity", weight: 20, minScore: 10, maxScore: 20, order: 3 },
      ]
    },
  ];

  let criteriaCount = 0;
  for (const { categoryId, criteria } of criteriaData) {
    for (const c of criteria) {
      await CriteriaQueries.create(categoryId, c);
      criteriaCount++;
    }
  }
  console.log(`✅ Criteria created: ${criteriaCount}`);

  // 4. Create candidates
  const candidateNames = [
    "Maria Santos",
    "Isabella Cruz",
    "Sofia Reyes",
    "Gabriella Torres",
    "Ana Gonzales",
    "Lucia Fernandez",
    "Valentina Aquino",
    "Camila Rivera",
    "Elena Mendoza",
    "Victoria Lim",
  ];

  for (let i = 0; i < candidateNames.length; i++) {
    await CandidateQueries.create(pageant.id, {
      name: candidateNames[i],
      candidateNumber: i + 1,
    });
  }
  console.log(`✅ Candidates created: ${candidateNames.length}`);

  // 5. Create judges
  const judges = [
    { name: "Judge Alpha", pin: "1001" },
    { name: "Judge Bravo", pin: "1002" },
    { name: "Judge Charlie", pin: "1003" },
    { name: "Judge Delta", pin: "1004" },
    { name: "Judge Echo", pin: "1005" },
  ];

  for (const j of judges) {
    await JudgeQueries.create(pageant.id, j);
  }
  console.log(`✅ Judges created: ${judges.length}`);

  console.log("\n🎉 Seed complete!\n");
  console.log("Judge PINs:");
  judges.forEach((j) => console.log(`  ${j.name}: ${j.pin}`));
  console.log();

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
