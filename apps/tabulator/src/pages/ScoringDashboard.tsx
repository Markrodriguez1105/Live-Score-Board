import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { useToast } from "@pageant/ui";
import type { Pageant, Candidate, Judge, CategoryWithCriteria } from "@pageant/types";

const API_BASE = "/api";
const SOCKET_URL = window.location.origin;

export function ScoringDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pageants, setPageants] = useState<Pageant[]>([]);
  const [selectedPageant, setSelectedPageant] = useState<string>("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [categories, setCategories] = useState<CategoryWithCriteria[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [scores, setScores] = useState<Record<string, Record<string, Record<string, number>>>>({});
  const [submissionStatus, setSubmissionStatus] = useState<Record<string, Record<string, boolean>>>({});

  // Fetch pageants on mount
  useEffect(() => {
    (async () => {
      const res = await fetch(`${API_BASE}/pageants`, { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setPageants(data.data);
        if (data.data.length > 0) setSelectedPageant(data.data[0].id);
      } else if (res.status === 401) navigate("/");
    })();
  }, []);

  // Fetch data when pageant changes
  useEffect(() => {
    if (!selectedPageant) return;
    (async () => {
      const [candRes, judgeRes, catRes] = await Promise.all([
        fetch(`${API_BASE}/pageants/${selectedPageant}/candidates`, { credentials: "include" }),
        fetch(`${API_BASE}/pageants/${selectedPageant}/judges`, { credentials: "include" }),
        fetch(`${API_BASE}/pageants/${selectedPageant}/categories`, { credentials: "include" }),
      ]);
      const [candData, judgeData, catData] = await Promise.all([candRes.json(), judgeRes.json(), catRes.json()]);
      if (candData.success) setCandidates(candData.data);
      if (judgeData.success) setJudges(judgeData.data);
      if (catData.success) {
        setCategories(catData.data);
        if (catData.data.length > 0 && !selectedCategory) setSelectedCategory(catData.data[0].id);
      }
    })();
  }, [selectedPageant]);

  // Fetch submission status
  useEffect(() => {
    if (!selectedCategory || candidates.length === 0) return;
    candidates.forEach(async (c) => {
      const res = await fetch(`${API_BASE}/scores/status/${c.id}/${selectedCategory}`, { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        const statusMap: Record<string, boolean> = {};
        data.data.forEach((s: { judgeId: string; submitted: boolean }) => {
          statusMap[s.judgeId] = s.submitted;
        });
        setSubmissionStatus((prev) => ({ ...prev, [c.id]: statusMap }));
      }
    });
  }, [selectedCategory, candidates]);

  // Socket for real-time updates
  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.on("scores:update", () => {
      // Refresh submission status
      if (selectedCategory) {
        candidates.forEach(async (c) => {
          const res = await fetch(`${API_BASE}/scores/status/${c.id}/${selectedCategory}`, { credentials: "include" });
          const data = await res.json();
          if (data.success) {
            const statusMap: Record<string, boolean> = {};
            data.data.forEach((s: { judgeId: string; submitted: boolean }) => {
              statusMap[s.judgeId] = s.submitted;
            });
            setSubmissionStatus((prev) => ({ ...prev, [c.id]: statusMap }));
          }
        });
      }
    });
    return () => { socket.close(); };
  }, [selectedCategory, candidates]);

  const handleOverride = async (judgeId: string, candidateId: string, criteriaId: string) => {
    const valueStr = prompt("Enter new score value:");
    if (!valueStr) return;
    const value = Number(valueStr);
    if (isNaN(value)) return;

    const res = await fetch(`${API_BASE}/scores/override`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ judgeId, candidateId, criteriaId, value }),
    });
    const data = await res.json();
    if (data.success) {
      toast("Score overridden successfully", "success");
    } else {
      toast(data.error || "Failed to override", "error");
    }
  };

  const currentCategory = categories.find((c) => c.id === selectedCategory);

  return (
    <div className="min-h-screen bg-surface-primary">
      <header className="border-b border-border-subtle bg-surface-secondary/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-full mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-2xl">📊</span>
            <h1 className="text-lg font-bold text-white">Tabulator Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedPageant}
              onChange={(e) => setSelectedPageant(e.target.value)}
              className="bg-surface-primary border border-border-default rounded-lg px-3 py-2 text-white text-sm"
            >
              {pageants.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="px-6 py-6 animate-fade-in-up">
        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? "bg-pageant-gold text-black"
                  : "bg-surface-secondary text-white/50 hover:text-white border border-border-subtle"
              }`}
            >
              {cat.name} ({cat.weight}%)
            </button>
          ))}
        </div>

        {/* Scoring Matrix */}
        {currentCategory && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wider font-semibold sticky left-0 bg-surface-primary z-10">
                    Candidate
                  </th>
                  {judges.map((j) => (
                    <th key={j.id} className="text-center px-4 py-3 text-xs text-white/40 uppercase tracking-wider font-semibold min-w-[100px]">
                      {j.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.id} className="border-b border-border-subtle hover:bg-white/[0.02]">
                    <td className="px-4 py-3 sticky left-0 bg-surface-primary z-10">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/30 font-mono w-6">#{c.candidateNumber}</span>
                        <span className="text-sm font-medium text-white">{c.name}</span>
                      </div>
                    </td>
                    {judges.map((j) => {
                      const submitted = submissionStatus[c.id]?.[j.id] || false;
                      return (
                        <td key={j.id} className="text-center px-4 py-3">
                          {submitted ? (
                            <button
                              onClick={() => {
                                if (currentCategory.criteria.length > 0) {
                                  handleOverride(j.id, c.id, currentCategory.criteria[0].id);
                                }
                              }}
                              className="inline-flex items-center gap-1 text-green-400 text-sm font-semibold hover:text-green-300 transition-colors"
                            >
                              ✓ Scored
                            </button>
                          ) : (
                            <span className="text-white/20 text-sm">⏳ Pending</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {candidates.length === 0 && (
          <div className="text-center py-16 text-white/30">
            <div className="text-5xl mb-4">📋</div>
            <p>No data to display. Select a pageant with candidates.</p>
          </div>
        )}
      </main>
    </div>
  );
}
