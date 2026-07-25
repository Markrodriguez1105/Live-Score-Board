/**
 * ============================================================
 * Load Test: Concurrent Score Submission
 * ============================================================
 *
 * This script simulates 10 judges scoring 50 candidates simultaneously
 * to verify the performance fixes applied to the Live Score Board.
 *
 * Usage:
 *   npx tsx tests/load-test.ts [--server http://localhost:3001]
 *
 * Prerequisites:
 *   - Server and MySQL must be running
 *   - Admin credentials must match .env (default: admin/admin123)
 */

const SERVER_URL = process.argv.includes("--server")
  ? process.argv[process.argv.indexOf("--server") + 1]
  : "http://localhost:3001";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

const NUM_JUDGES = 50;
const NUM_CANDIDATES = 100;
const NUM_CRITERIA = 5; // criteria per category

// ── Helpers ──────────────────────────────────────────────────

let adminCookie = "";

async function adminFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${SERVER_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      ...((options.headers as Record<string, string>) || {}),
    },
  });
  return res;
}

async function judgeFetch(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(`${SERVER_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...((options.headers as Record<string, string>) || {}),
    },
  });
  return res;
}

function formatMs(ms: number) {
  return `${ms.toFixed(0)}ms`;
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// ── Step 1: Admin Login ─────────────────────────────────────

async function adminLogin() {
  console.log("🔐 Logging in as admin...");

  const loginRes = await fetch(`${SERVER_URL}/api/pageants/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
  });

  const setCookie = loginRes.headers.get("set-cookie");
  if (setCookie) {
    adminCookie = setCookie.split(";")[0];
  }

  const loginData = await loginRes.json();
  if (!loginData.success) throw new Error(`Admin login failed: ${JSON.stringify(loginData)}`);
  console.log("   ✅ Admin logged in");
}

// ── Step 2: Create Test Pageant ─────────────────────────────

async function createTestPageant() {
  console.log("🏛️  Creating test pageant...");
  const res = await adminFetch("/api/pageants", {
    method: "POST",
    body: JSON.stringify({
      name: `Load Test Pageant ${Date.now()}`,
      description: `Automated load test — ${NUM_JUDGES} judges × ${NUM_CANDIDATES} candidates`,
      date: new Date().toISOString().split("T")[0],
      venue: "Test Venue",
      logoUrl: "/uploads/test.png",
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(`Failed to create pageant: ${JSON.stringify(data)}`);
  console.log(`   ✅ Pageant created: ${data.data.id}`);
  return data.data;
}

// ── Step 3: Create Segment + Category + Criteria ────────────

async function createSegmentAndCriteria(pageantId: string) {
  console.log("📂 Creating segment, category, and criteria...");

  // Create segment
  const segRes = await adminFetch(`/api/pageants/${pageantId}/segments`, {
    method: "POST",
    body: JSON.stringify({ name: "Main Competition", order: 1 }),
  });
  const segData = await segRes.json();
  if (!segData.success) throw new Error(`Failed to create segment: ${JSON.stringify(segData)}`);
  const segmentId = segData.data.id;

  // Create category
  const catRes = await adminFetch(`/api/segments/${segmentId}/categories`, {
    method: "POST",
    body: JSON.stringify({ name: "Overall Performance", order: 1, weight: 100 }),
  });
  const catData = await catRes.json();
  if (!catData.success) throw new Error(`Failed to create category: ${JSON.stringify(catData)}`);
  const categoryId = catData.data.id;

  // Create criteria
  const criteria: any[] = [];
  const criteriaNames = [
    "Beauty", "Talent", "Intelligence", "Poise", "Personality",
    "Stage Presence", "Communication", "Elegance",
  ];
  for (let i = 0; i < NUM_CRITERIA; i++) {
    const crRes = await adminFetch(`/api/categories/${categoryId}/criteria`, {
      method: "POST",
      body: JSON.stringify({
        name: criteriaNames[i] || `Criteria ${i + 1}`,
        weight: 20,
        minScore: 1,
        maxScore: 100,
        order: i + 1,
      }),
    });
    const crData = await crRes.json();
    if (!crData.success) throw new Error(`Failed to create criteria: ${JSON.stringify(crData)}`);
    criteria.push(crData.data);
  }

  console.log(`   ✅ Segment: ${segmentId}, Category: ${categoryId}, Criteria: ${criteria.length}`);
  return { segmentId, categoryId, criteria };
}

// ── Step 4: Create Candidates ───────────────────────────────

async function createCandidates(pageantId: string, categoryId: string) {
  console.log(`👥 Creating ${NUM_CANDIDATES} candidates...`);
  const candidates: any[] = [];
  for (let i = 0; i < NUM_CANDIDATES; i++) {
    const res = await adminFetch(`/api/pageants/${pageantId}/candidates`, {
      method: "POST",
      body: JSON.stringify({
        name: `Candidate ${String(i + 1).padStart(2, "0")}`,
        candidateNumber: i + 1,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(`Failed to create candidate: ${JSON.stringify(data)}`);
    candidates.push(data.data);
  }

  // Assign all candidates to the category
  const candidateIds = candidates.map((c: any) => c.id);
  await adminFetch(`/api/categories/${categoryId}/candidates`, {
    method: "PUT",
    body: JSON.stringify({ candidateIds }),
  });

  console.log(`   ✅ ${candidates.length} candidates created and assigned`);
  return candidates;
}

// ── Step 5: Create Judges + Get Tokens ──────────────────────

async function createJudges(pageantId: string) {
  console.log(`👨‍⚖️ Creating ${NUM_JUDGES} judges...`);
  const judges: { judge: any; token: string }[] = [];

  for (let i = 0; i < NUM_JUDGES; i++) {
    const pin = `LOAD${String(i + 1).padStart(3, "0")}`;
    const res = await adminFetch(`/api/pageants/${pageantId}/judges`, {
      method: "POST",
      body: JSON.stringify({
        name: `Judge ${i + 1}`,
        pin,
        judgeNumber: i + 1,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(`Failed to create judge: ${JSON.stringify(data)}`);

    // Authenticate the judge to get a token
    const authRes = await fetch(`${SERVER_URL}/api/judges/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const authData = await authRes.json();
    if (!authData.success) throw new Error(`Failed to auth judge: ${JSON.stringify(authData)}`);

    judges.push({ judge: data.data, token: authData.data.token });
  }

  console.log(`   ✅ ${judges.length} judges created and authenticated`);
  return judges;
}

// ── Step 6: Load Test — All Judges Score All Candidates ─────

interface SubmitResult {
  judgeIndex: number;
  candidateIndex: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

async function runLoadTest(
  judges: { judge: any; token: string }[],
  candidates: any[],
  criteria: any[]
) {
  console.log("\n" + "═".repeat(60));
  console.log(`🚀 LOAD TEST: ${NUM_JUDGES} judges × ${NUM_CANDIDATES} candidates`);
  console.log(`   Total submissions: ${NUM_JUDGES * NUM_CANDIDATES}`);
  console.log(`   Criteria per submission: ${criteria.length}`);
  console.log(`   Total DB operations (before fix): ~${NUM_JUDGES * NUM_CANDIDATES * criteria.length * 4}`);
  console.log(`   Total DB operations (after fix):  ~${NUM_JUDGES * NUM_CANDIDATES * 4}`);
  console.log("═".repeat(60) + "\n");

  const results: SubmitResult[] = [];
  const overallStart = performance.now();

  // Create all submission promises — all judges submit for all candidates simultaneously
  const submissions: Promise<SubmitResult>[] = [];

  for (let j = 0; j < judges.length; j++) {
    for (let c = 0; c < candidates.length; c++) {
      const judgeToken = judges[j].token;
      const candidateId = candidates[c].id;

      const scores = criteria.map((cr: any) => ({
        criteriaId: cr.id,
        value: Math.floor(Math.random() * 50) + 50, // Random score 50-100
      }));

      submissions.push(
        (async (): Promise<SubmitResult> => {
          const start = performance.now();
          try {
            const res = await judgeFetch("/api/scores", judgeToken, {
              method: "POST",
              body: JSON.stringify({ candidateId, scores }),
            });
            const data = await res.json();
            const duration = performance.now() - start;
            return {
              judgeIndex: j,
              candidateIndex: c,
              durationMs: duration,
              success: data.success === true,
              error: data.success ? undefined : JSON.stringify(data),
            };
          } catch (err) {
            const duration = performance.now() - start;
            return {
              judgeIndex: j,
              candidateIndex: c,
              durationMs: duration,
              success: false,
              error: String(err),
            };
          }
        })()
      );
    }
  }

  console.log(`⏱️  Firing ${submissions.length} concurrent submissions...`);

  const allResults = await Promise.all(submissions);
  const overallDuration = performance.now() - overallStart;

  results.push(...allResults);

  // ── Generate Report ─────────────────────────────────────

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const durations = results.map(r => r.durationMs).sort((a, b) => a - b);

  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const median = durations[Math.floor(durations.length / 2)];
  const p95 = durations[Math.floor(durations.length * 0.95)];
  const p99 = durations[Math.floor(durations.length * 0.99)];
  const min = durations[0];
  const max = durations[durations.length - 1];

  console.log("\n" + "═".repeat(60));
  console.log("📊 LOAD TEST RESULTS");
  console.log("═".repeat(60));
  console.log(`\n   Total submissions:     ${results.length}`);
  console.log(`   Successful:            ${successful.length} ✅`);
  console.log(`   Failed:                ${failed.length} ${failed.length > 0 ? "❌" : "✅"}`);
  console.log(`\n   ⏱️  Overall wall time:   ${formatDuration(overallDuration)}`);
  console.log(`   📈 Throughput:          ${(results.length / (overallDuration / 1000)).toFixed(1)} submissions/sec`);
  console.log(`\n   Response Time Percentiles:`);
  console.log(`   ├── Min:      ${formatMs(min)}`);
  console.log(`   ├── Avg:      ${formatMs(avg)}`);
  console.log(`   ├── Median:   ${formatMs(median)}`);
  console.log(`   ├── P95:      ${formatMs(p95)}`);
  console.log(`   ├── P99:      ${formatMs(p99)}`);
  console.log(`   └── Max:      ${formatMs(max)}`);

  // Per-judge breakdown
  console.log(`\n   Per-Judge Average Response Time:`);
  for (let j = 0; j < judges.length; j++) {
    const judgeResults = results.filter(r => r.judgeIndex === j);
    const judgeAvg = judgeResults.reduce((a, r) => a + r.durationMs, 0) / judgeResults.length;
    const judgeFailed = judgeResults.filter(r => !r.success).length;
    const bar = "█".repeat(Math.min(50, Math.round(judgeAvg / 100)));
    console.log(`   Judge ${String(j + 1).padStart(2)}: ${formatMs(judgeAvg).padStart(8)} ${bar} ${judgeFailed > 0 ? `(${judgeFailed} failed)` : ""}`);
  }

  if (failed.length > 0) {
    console.log(`\n   ⚠️  Sample errors:`);
    const uniqueErrors = [...new Set(failed.map(r => r.error))];
    uniqueErrors.slice(0, 5).forEach((err, i) => {
      console.log(`   ${i + 1}. ${err?.substring(0, 120)}`);
    });
  }

  console.log("\n" + "═".repeat(60));

  // Performance verdict
  if (avg < 500 && p95 < 2000) {
    console.log("✅ VERDICT: PASS — Performance is within acceptable thresholds");
    console.log(`   (avg < 500ms ✓, p95 < 2000ms ✓)`);
  } else if (avg < 1000 && p95 < 5000) {
    console.log("⚠️  VERDICT: MARGINAL — Performance could be improved");
    console.log(`   (avg: ${formatMs(avg)}, p95: ${formatMs(p95)})`);
  } else {
    console.log("❌ VERDICT: FAIL — Performance is too slow");
    console.log(`   (avg: ${formatMs(avg)}, p95: ${formatMs(p95)})`);
  }
  console.log("═".repeat(60) + "\n");

  return {
    total: results.length,
    successful: successful.length,
    failed: failed.length,
    overallDurationMs: overallDuration,
    avgMs: avg,
    medianMs: median,
    p95Ms: p95,
    p99Ms: p99,
    minMs: min,
    maxMs: max,
  };
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("🔬 LIVE SCORE BOARD — PERFORMANCE LOAD TEST");
  console.log(`   Server: ${SERVER_URL}`);
  console.log(`   Judges: ${NUM_JUDGES}, Candidates: ${NUM_CANDIDATES}`);
  console.log("═".repeat(60) + "\n");

  try {
    // Setup
    await adminLogin();
    const pageant = await createTestPageant();
    const { categoryId, criteria } = await createSegmentAndCriteria(pageant.id);
    const candidates = await createCandidates(pageant.id, categoryId);
    const judges = await createJudges(pageant.id);

    console.log("\n✅ Setup complete. Starting load test...\n");

    // Run
    const metrics = await runLoadTest(judges, candidates, criteria);

    // Cleanup is optional — test data can be deleted from admin panel
    console.log("💡 Test data was created under pageant:", pageant.name);
    console.log("   Delete it from the Admin panel when done.\n");

    process.exit(metrics.failed > 0 ? 1 : 0);
  } catch (err) {
    console.error("\n❌ Load test failed:", err);
    process.exit(1);
  }
}

main();
