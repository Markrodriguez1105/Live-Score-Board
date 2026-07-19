import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { BarChart3, Check, Clock, ClipboardList } from "lucide-react";
import type { Pageant, Candidate, Judge, CategoryWithCriteria } from "@pageant/types";
import { Button } from "@pageant/ui/components/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@pageant/ui/components/table";
import { toast } from "sonner";

const API_BASE = "/api";
const SOCKET_URL = window.location.origin;

export function ScoringDashboard() {
  const navigate = useNavigate();
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
      toast.success("Score overridden successfully");
    } else {
      toast.error(data.error || "Failed to override");
    }
  };

  const currentCategory = categories.find((c) => c.id === selectedCategory);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-full mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-bold text-foreground">Tabulator Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedPageant}
              onChange={(e) => setSelectedPageant(e.target.value)}
              className="bg-background border border-border rounded-xl px-4 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            >
              {pageants.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="px-6 py-6">
        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
          {categories.map((cat) => (
            <Button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              variant={selectedCategory === cat.id ? "secondary" : "outline"}
              className="whitespace-nowrap"
            >
              {cat.name} ({cat.weight}%)
            </Button>
          ))}
        </div>

        {/* Scoring Matrix */}
        {currentCategory && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card/90 backdrop-blur z-10">
                  Candidate
                </TableHead>
                {judges.map((j) => (
                  <TableHead key={j.id} className="text-center min-w-30">
                    {j.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="sticky left-0 bg-card/90 backdrop-blur z-10">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono w-6">#{c.candidateNumber}</span>
                      <span className="text-sm font-semibold text-foreground">{c.name}</span>
                    </div>
                  </TableCell>
                  {judges.map((j) => {
                    const submitted = submissionStatus[c.id]?.[j.id] || false;
                    return (
                      <TableCell key={j.id} className="text-center">
                        {submitted ? (
                          <button
                            onClick={() => {
                              if (currentCategory.criteria.length > 0) {
                                handleOverride(j.id, c.id, currentCategory.criteria[0].id);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 text-emerald-400 text-sm font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg hover:bg-emerald-500/25 transition-all cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" /> Scored
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-white/20 text-sm bg-white/5 border border-white/5 px-3 py-1 rounded-lg font-medium">
                            <Clock className="w-3.5 h-3.5" /> Pending
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {candidates.length === 0 && (
          <div className="text-center py-16 text-white/30">
            <ClipboardList className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p>No data to display. Select a pageant with candidates.</p>
          </div>
        )}
      </main>
    </div>
  );
}
