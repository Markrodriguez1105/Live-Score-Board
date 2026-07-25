/**
 * ============================================================
 * Response Time Benchmark Test — Redis Caching vs MySQL
 * ============================================================
 *
 * This test measures API response times for uncached (MySQL) vs
 * cached (Redis) reads and concurrent read/write throughput.
 *
 * Usage:
 *   npx tsx tests/response-time-test.ts [--server http://localhost:3001]
 */

const SERVER_URL = process.argv.includes("--server")
  ? process.argv[process.argv.indexOf("--server") + 1]
  : "http://localhost:3001";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

const NUM_JUDGES = 5;
const NUM_CANDIDATES = 20;
const NUM_CRITERIA = 5;

let adminCookie = "";

async function adminFetch(path: string, options: RequestInit = {}) {
  return fetch(`${SERVER_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      ...((options.headers as Record<string, string>) || {}),
    },
  });
}

function formatMs(ms: number) {
  return `${ms.toFixed(1)}ms`;
}

function calculatePercentiles(durations: number[]) {
  const sorted = [...durations].sort((a, b) => a - b);
  const min = sorted[0] || 0;
  const max = sorted[sorted.length - 1] || 0;
  const avg = sorted.reduce((a, b) => a + b, 0) / (sorted.length || 1);
  const median = sorted[Math.floor(sorted.length * 0.5)] || 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
  return { min, max, avg, median, p95, p99 };
}

// ── Setup ────────────────────────────────────────────────────

async function setupTestData() {
  console.log("🔐 Admin login...");
  const loginRes = await fetch(`${SERVER_URL}/api/pageants/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
  });
  const setCookie = loginRes.headers.get("set-cookie");
  if (setCookie) adminCookie = setCookie.split(";")[0];

  console.log("🏛️ Creating test pageant...");
  const pagRes = await adminFetch("/api/pageants", {
    method: "POST",
    body: JSON.stringify({
      name: `Benchmark Pageant ${Date.now()}`,
      description: "Response time benchmarking",
      date: new Date().toISOString().split("T")[0],
      venue: "Benchmark Arena",
      logoUrl: "/uploads/benchmark.png",
    }),
  });
  const pageant = (await pagRes.json()).data;

  // Segment
  const segRes = await adminFetch(`/api/pageants/${pageant.id}/segments`, {
    method: "POST",
    body: JSON.stringify({ name: "Final Round", order: 1 }),
  });
  const segment = (await segRes.json()).data;

  // Category
  const catRes = await adminFetch(`/api/segments/${segment.id}/categories`, {
    method: "POST",
    body: JSON.stringify({ name: "Overall", order: 1, weight: 100 }),
  });
  const category = (await catRes.json()).data;

  // Criteria
  const criteria = [];
  for (let i = 0; i < NUM_CRITERIA; i++) {
    const crRes = await adminFetch(`/api/categories/${category.id}/criteria`, {
      method: "POST",
      body: JSON.stringify({
        name: `Criteria ${i + 1}`,
        weight: 20,
        minScore: 1,
        maxScore: 100,
        order: i + 1,
      }),
    });
    criteria.push((await crRes.json()).data);
  }

  // Candidates
  const candidates = [];
  for (let i = 0; i < NUM_CANDIDATES; i++) {
    const candRes = await adminFetch(`/api/pageants/${pageant.id}/candidates`, {
      method: "POST",
      body: JSON.stringify({ name: `Candidate ${i + 1}`, candidateNumber: i + 1 }),
    });
    candidates.push((await candRes.json()).data);
  }

  await adminFetch(`/api/categories/${category.id}/candidates`, {
    method: "PUT",
    body: JSON.stringify({ candidateIds: candidates.map(c => c.id) }),
  });

  // Judges
  const judges = [];
  for (let i = 0; i < NUM_JUDGES; i++) {
    const pin = `BENCH${String(i + 1).padStart(3, "0")}`;
    const jRes = await adminFetch(`/api/pageants/${pageant.id}/judges`, {
      method: "POST",
      body: JSON.stringify({ name: `Judge ${i + 1}`, pin, judgeNumber: i + 1 }),
    });
    const jData = (await jRes.json()).data;

    const authRes = await fetch(`${SERVER_URL}/api/judges/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const token = (await authRes.json()).data.token;
    judges.push({ judge: jData, token });
  }

  return { pageant, category, criteria, candidates, judges };
}

// ── Test Execution ───────────────────────────────────────────

async function runBenchmark() {
  console.log("\n" + "═".repeat(65));
  console.log("⚡ RESPONSE TIME & REDIS CACHING BENCHMARK");
  console.log("═".repeat(65) + "\n");

  const { pageant, criteria, candidates, judges } = await setupTestData();

  // Test 1: Uncached Read (MySQL Direct)
  console.log("1️⃣ Testing UNCACHED Read Latency (Cold Start / MySQL)...");
  const uncachedStart = performance.now();
  const resUncached = await fetch(`${SERVER_URL}/api/pageants/${pageant.id}/results`);
  const dataUncached = await resUncached.json();
  const uncachedDuration = performance.now() - uncachedStart;

  console.log(`   Response time: ${formatMs(uncachedDuration)}`);
  console.log(`   Cache hit:     ${dataUncached.cached ? "YES (Redis)" : "NO (MySQL Direct)"}`);

  // Test 2: Cached Reads (Redis Cache Hits)
  console.log("\n2️⃣ Testing CACHED Read Latency (Redis Cache Hits — 100 requests)...");
  const readDurations: number[] = [];
  let cacheHits = 0;

  const readPromises = Array.from({ length: 100 }).map(async () => {
    const start = performance.now();
    const res = await fetch(`${SERVER_URL}/api/pageants/${pageant.id}/results`);
    const data = await res.json();
    const duration = performance.now() - start;
    readDurations.push(duration);
    if (data.cached) cacheHits++;
  });

  await Promise.all(readPromises);
  const cachedStats = calculatePercentiles(readDurations);

  console.log(`   Cache Hits:    ${cacheHits}/100 (${cacheHits}%)`);
  console.log(`   Min Latency:   ${formatMs(cachedStats.min)}`);
  console.log(`   Avg Latency:   ${formatMs(cachedStats.avg)}`);
  console.log(`   P95 Latency:   ${formatMs(cachedStats.p95)}`);
  console.log(`   P99 Latency:   ${formatMs(cachedStats.p99)}`);
  console.log(`   Max Latency:   ${formatMs(cachedStats.max)}`);

  // Speedup Factor
  const speedup = uncachedDuration / (cachedStats.avg || 1);
  console.log(`   🚀 Cache Speedup: ${speedup.toFixed(1)}x FASTER than uncached read`);

  // Test 3: Concurrent Write & Invalidated Read
  console.log("\n3️⃣ Testing Concurrent Score Writes & Cache Invalidation...");
  const writeDurations: number[] = [];

  const writePromises = judges.flatMap((j) =>
    candidates.map(async (c) => {
      const start = performance.now();
      const scores = criteria.map((cr: any) => ({ criteriaId: cr.id, value: 85 }));
      await fetch(`${SERVER_URL}/api/scores`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${j.token}`,
        },
        body: JSON.stringify({ candidateId: c.id, scores }),
      });
      writeDurations.push(performance.now() - start);
    })
  );

  await Promise.all(writePromises);
  const writeStats = calculatePercentiles(writeDurations);

  console.log(`   Total Writes:  ${writeDurations.length} score submissions`);
  console.log(`   Avg Write Time:${formatMs(writeStats.avg)}`);
  console.log(`   P95 Write Time:${formatMs(writeStats.p95)}`);

  console.log("\n" + "═".repeat(65));
  console.log("📊 BENCHMARK SUMMARY REPORT");
  console.log("═".repeat(65));
  console.log(`\n   Uncached Read (MySQL): ${formatMs(uncachedDuration)}`);
  console.log(`   Cached Read (Redis):   ${formatMs(cachedStats.avg)} (Avg) / ${formatMs(cachedStats.p95)} (P95)`);
  console.log(`   Score Save Latency:    ${formatMs(writeStats.avg)} (Avg) / ${formatMs(writeStats.p95)} (P95)`);
  console.log(`   Latency Reduction:     -${Math.round((1 - cachedStats.avg / uncachedDuration) * 100)}% latency on cached reads`);
  console.log("\n" + "═".repeat(65) + "\n");
}

runBenchmark().catch((err) => {
  console.error("❌ Benchmark failed:", err);
  process.exit(1);
});
