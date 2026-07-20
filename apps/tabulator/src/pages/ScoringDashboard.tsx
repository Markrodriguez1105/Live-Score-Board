import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import {
  Trophy,
  Hourglass,
  CheckCircle2,
  Edit3,
  Check,
  X,
  BarChart3,
  ListOrdered,
  LogOut,
  Trash2,
} from "lucide-react";
import { Button } from "@pageant/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@pageant/ui/components/dialog";
import { toast } from "sonner";
import type { Pageant } from "@pageant/types";

const API_BASE = "/api";
const SOCKET_URL = window.location.origin;

interface CriteriaItem {
  id: string;
  name: string;
  weight: number;
  minScore: number;
  maxScore: number;
}

interface CategoryItem {
  id: string;
  name: string;
  weight: number;
  criteria: CriteriaItem[];
  candidates?: CandidateItem[];
}

interface CandidateItem {
  id: string;
  name: string;
  candidateNumber: number;
  photoUrl?: string;
}

interface JudgeItem {
  id: string;
  name: string;
}

interface RawScore {
  score_id: string;
  value: number;
  judge_id: string;
  judge_name: string;
  candidate_id: string;
  candidate_name: string;
  candidate_number: number;
  criteria_id: string;
  criteria_name: string;
  criteria_weight: number;
  min_score: number;
  max_score: number;
  category_id: string;
  category_name: string;
  category_weight: number;
}

interface ResultData {
  scores: RawScore[];
  candidates: CandidateItem[];
  categories: CategoryItem[];
  judges: JudgeItem[];
}

interface EditModalState {
  candidate: CandidateItem;
  judge: JudgeItem;
  category: CategoryItem;
  values: Record<string, number>;
}

export function ScoringDashboard() {
  const navigate = useNavigate();
  const [pageants, setPageants] = useState<Pageant[]>([]);
  const [selectedPageant, setSelectedPageant] = useState<string>("");
  const [data, setData] = useState<ResultData | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");
  const [editModal, setEditModal] = useState<EditModalState | null>(null);
  const [categorySortBy, setCategorySortBy] = useState<"candidateNumber" | "rank">("candidateNumber");
  const [savingScore, setSavingScore] = useState(false);
  const [clearingScore, setClearingScore] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Fetch pageants list on mount
  useEffect(() => {
    (async () => {
      const res = await fetch(`${API_BASE}/pageants`, { credentials: "include" });
      const json = await res.json();
      if (json.success) {
        setPageants(json.data);
        if (json.data.length > 0) setSelectedPageant(json.data[0].id);
      } else if (res.status === 401) {
        navigate("/");
      }
    })();
  }, [navigate]);

  // Fetch scores and results for selected pageant
  const fetchResults = async () => {
    if (!selectedPageant) return;
    try {
      const res = await fetch(`${API_BASE}/pageants/${selectedPageant}/results`, { credentials: "include" });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        if (json.data.categories.length > 0) {
          setActiveTab((prev) => prev || json.data.categories[0].id);
        }
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchResults();
  }, [selectedPageant]);

  // Setup real-time socket connection
  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    const handleUpdate = () => {
      fetchResults();
    };

    const handleAssistanceAlert = (data: { judgeName: string; judgeId: string }) => {
      toast.warning(`🚨 Assistance Requested`, {
        id: `assistance-${data.judgeId}`,
        description: `Judge "${data.judgeName}" is requesting assistance at their scoring table.`,
        position: "bottom-left",
        duration: 3000,
      });
    };

    newSocket.on("score:update", handleUpdate);
    newSocket.on("scores:update", handleUpdate);
    newSocket.on("category:candidates-update", handleUpdate);
    newSocket.on("judge:assistance-alert", handleAssistanceAlert);

    return () => {
      newSocket.off("judge:assistance-alert", handleAssistanceAlert);
      newSocket.close();
    };
  }, [selectedPageant]);

  const handleLogout = async () => {
    await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
    navigate("/");
  };

  const getFallback = (name: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=128&bold=true`;

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Helper to compute a candidate's average score across judges for a given category
  const calcCategoryAverageScore = (candidateId: string, category: CategoryItem) => {
    if (!data) return 0;
    const judgeTotals: number[] = [];
    for (const j of data.judges) {
      let judgeTotal = 0;
      let hasAnyScore = false;
      for (const cr of category.criteria) {
        const scoreRow = data.scores.find(
          (s) => s.candidate_id === candidateId && s.judge_id === j.id && s.criteria_id === cr.id
        );
        if (scoreRow) {
          judgeTotal += Number(scoreRow.value);
          hasAnyScore = true;
        }
      }
      if (hasAnyScore) {
        judgeTotals.push(judgeTotal);
      }
    }
    if (judgeTotals.length === 0) return 0;
    const avg = judgeTotals.reduce((sum, val) => sum + val, 0) / judgeTotals.length;
    return Math.round(avg * 100) / 100;
  };

  // Calculate Overall Standings (with 2 decimal places)
  const candidateTotals = data.candidates
    .map((c) => {
      let total = 0;
      for (const cat of data.categories) {
        const category_total_score = calcCategoryAverageScore(c.id, cat);
        total += category_total_score * (cat.weight / 100);
      }
      return { ...c, total: Math.round(total * 100) / 100 };
    })
    .sort((a, b) => b.total - a.total);

  // Open manual score edit modal
  const openEditModal = (candidate: CandidateItem, judge: JudgeItem, category: CategoryItem) => {
    const existingValues: Record<string, number> = {};
    for (const cr of category.criteria) {
      const found = data.scores.find(
        (s) => s.candidate_id === candidate.id && s.judge_id === judge.id && s.criteria_id === cr.id
      );
      if (found) {
        existingValues[cr.id] = Math.round(Number(found.value));
      } else {
        existingValues[cr.id] = cr.minScore;
      }
    }

    setEditModal({
      candidate,
      judge,
      category,
      values: existingValues,
    });
  };

  // Save score overrides
  const handleSaveScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;

    setSavingScore(true);
    try {
      for (const [criteriaId, val] of Object.entries(editModal.values)) {
        const res = await fetch(`${API_BASE}/scores/override`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            judgeId: editModal.judge.id,
            candidateId: editModal.candidate.id,
            criteriaId,
            value: Math.round(Number(val)),
          }),
        });
        if (res.status === 401) {
          toast.error("Session expired. Please sign in again.");
          navigate("/");
          return;
        }
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error || "Failed to save score");
          setSavingScore(false);
          return;
        }
      }
      toast.success("Score updated successfully");
      socket?.emit("admin:score-updated", { pageantId: selectedPageant });
      await fetchResults();
      setEditModal(null);
    } catch {
      toast.error("An error occurred while saving scores");
    } finally {
      setSavingScore(false);
    }
  };

  // Clear score for judge + candidate + category
  const handleClearScore = async () => {
    if (!editModal) return;
    setClearingScore(true);
    try {
      const res = await fetch(`${API_BASE}/scores/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          judgeId: editModal.judge.id,
          candidateId: editModal.candidate.id,
          categoryId: editModal.category.id,
        }),
      });
      if (res.status === 401) {
        toast.error("Session expired. Please sign in again.");
        navigate("/");
        return;
      }
      const json = await res.json();
      if (json.success) {
        toast.success("Score cleared successfully");
        socket?.emit("admin:score-updated", { pageantId: selectedPageant });
        await fetchResults();
        setEditModal(null);
      } else {
        toast.error(json.error || "Failed to clear score");
      }
    } catch {
      toast.error("An error occurred while clearing score");
    } finally {
      setClearingScore(false);
    }
  };

  const selectedCategory = data.categories.find((cat) => cat.id === activeTab);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Navigation Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-lg font-bold text-foreground">Tabulator Dashboard</h1>
              <p className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
                SCORING MATRIX & OVERRIDES
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Pageant Dropdown */}
            <select
              value={selectedPageant}
              onChange={(e) => {
                setSelectedPageant(e.target.value);
                setActiveTab("");
              }}
              className="bg-card border border-border rounded-xl px-4 py-2 text-foreground text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer"
            >
              {pageants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Logout Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground gap-1.5"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Category Tabs Selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-border">
          {data.categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${activeTab === cat.id
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "bg-card text-muted-foreground border border-border hover:bg-muted hover:text-foreground"
                }`}
            >
              <BarChart3 className="w-4 h-4" />
              {cat.name} ({cat.weight}%)
            </button>
          ))}
        </div>
        {selectedCategory && (() => {
          const categoryCandidates = (selectedCategory.candidates && selectedCategory.candidates.length > 0)
            ? selectedCategory.candidates
            : (data?.candidates || []);

          const rankedCategoryCandidates = categoryCandidates
            .map((c) => {
              const catTotal = calcCategoryAverageScore(c.id, selectedCategory);
              return { ...c, catTotal };
            })
            .sort((a, b) => b.catTotal - a.catTotal)
            .map((c, i) => ({ ...c, rank: i + 1 }));

          const displayCandidates = [...rankedCategoryCandidates].sort((a, b) => {
            if (categorySortBy === "rank") {
              return a.rank - b.rank;
            }
            return a.candidateNumber - b.candidateNumber;
          });

          return (
            <div className="space-y-3">
              {/* Sort Control Bar */}
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-mono font-bold tracking-widest text-muted-foreground uppercase">
                  Category Score Matrix
                </span>
                <div className="flex items-center gap-1 bg-card/80 border border-border p-1 rounded-xl text-xs font-medium">
                  <span className="text-muted-foreground/70 text-[10px] font-mono uppercase px-2">Order by:</span>
                  <button
                    onClick={() => setCategorySortBy("candidateNumber")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${categorySortBy === "candidateNumber"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      }`}
                  >
                    Candidate #
                  </button>
                  <button
                    onClick={() => setCategorySortBy("rank")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${categorySortBy === "rank"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      }`}
                  >
                    Rank
                  </button>
                </div>
              </div>

              <div className="bg-[#121318] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/2">
                        <th
                          onClick={() => setCategorySortBy("candidateNumber")}
                          className="py-4 px-6 text-[11px] font-mono font-bold tracking-widest text-muted-foreground hover:text-white uppercase w-64 cursor-pointer select-none"
                        >
                          CANDIDATE {categorySortBy === "candidateNumber" && "↓"}
                        </th>
                        {data.judges.map((j, idx) => (
                          <th
                            key={j.id}
                            className="py-4 px-6 text-[11px] font-mono font-bold tracking-widest text-muted-foreground uppercase text-center"
                          >
                            JUDGE {idx + 1}
                            <span className="block text-[9px] font-normal text-muted-foreground/60 truncate max-w-30 mx-auto mt-0.5">
                              {j.name}
                            </span>
                          </th>
                        ))}
                        <th
                          onClick={() => setCategorySortBy("rank")}
                          className="py-4 px-6 text-[11px] font-mono font-bold tracking-widest text-amber-400 hover:text-amber-300 uppercase text-center w-36 cursor-pointer select-none"
                        >
                          TOTAL SCORE
                        </th>
                        <th
                          onClick={() => setCategorySortBy("rank")}
                          className="py-4 px-6 text-[11px] font-mono font-bold tracking-widest text-muted-foreground hover:text-white uppercase text-center w-24 cursor-pointer select-none"
                        >
                          RANK {categorySortBy === "rank" && "↓"}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {displayCandidates.map((c) => {
                        return (
                          <tr key={c.id} className="hover:bg-white/2 transition-colors">
                            {/* Candidate Info Cell */}
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3.5">
                                <img
                                  src={c.photoUrl || getFallback(c.name)}
                                  alt={c.name}
                                  className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0"
                                />
                                <div className="min-w-0">
                                  <h4 className="font-bold text-white text-sm truncate">{c.name}</h4>
                                  <p className="text-xs font-mono font-bold text-amber-400 mt-0.5">
                                    #{String(c.candidateNumber).padStart(2, "0")}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Judge Score Cells */}
                            {data.judges.map((j) => {
                              const judgeCriteriaScores = selectedCategory.criteria.map((cr) => {
                                const scoreRow = data.scores.find(
                                  (s) =>
                                    s.candidate_id === c.id &&
                                    s.judge_id === j.id &&
                                    s.criteria_id === cr.id
                                );
                                return scoreRow ? Number(scoreRow.value) : null;
                              });

                              const isComplete = judgeCriteriaScores.every((s) => s !== null);
                              const totalValue = isComplete
                                ? judgeCriteriaScores.reduce((sum, val) => sum! + val!, 0)
                                : 0;

                              return (
                                <td key={j.id} className="py-4 px-6 text-center">
                                  {isComplete ? (
                                    <button
                                      onClick={() => openEditModal(c, j, selectedCategory)}
                                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold transition-all cursor-pointer shadow-sm group"
                                      title="Click to edit score"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>{Math.round(totalValue)}</span>
                                      <Edit3 className="w-3 h-3 text-emerald-400/50 group-hover:text-emerald-400 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => openEditModal(c, j, selectedCategory)}
                                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-muted-foreground border border-white/10 text-xs font-medium transition-all cursor-pointer group"
                                      title="Click to manually enter score"
                                    >
                                      <Hourglass className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-amber-400 transition-colors" />
                                      <span>Pending</span>
                                    </button>
                                  )}
                                </td>
                              );
                            })}

                            {/* Category Total Score Cell */}
                            <td className="py-4 px-6 text-center font-mono font-black text-amber-400 text-base">
                              {c.catTotal.toFixed(2)}
                            </td>

                            {/* Plain Text Rank Cell (Last Column) */}
                            <td className="py-4 px-6 text-center font-mono font-bold text-foreground text-sm">
                              {c.rank}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}
      </main>

      {/* Manual Score Entry / Override Dialog with Sliders matching Judge Page */}
      <Dialog open={!!editModal} onOpenChange={(open) => { if (!open) setEditModal(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-primary" />
              Tabulator Score Override
            </DialogTitle>
          </DialogHeader>

          {editModal && (
            <form onSubmit={handleSaveScore} className="space-y-5 my-2">
              {/* Context Summary Box */}
              <div className="p-3.5 rounded-xl bg-card border border-border flex items-center gap-3">
                <img
                  src={editModal.candidate.photoUrl || getFallback(editModal.candidate.name)}
                  alt=""
                  className="w-12 h-12 rounded-xl object-cover border border-white/10"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-foreground text-sm truncate">{editModal.candidate.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    Candidate #{editModal.candidate.candidateNumber} · <span className="font-semibold text-primary">{editModal.judge.name}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                    Category: <span className="font-medium">{editModal.category.name}</span>
                  </p>
                </div>
              </div>

              {/* Criteria Sliders (matching Judge Page layout) */}
              <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                {editModal.category.criteria.map((cr) => {
                  const val = editModal.values[cr.id] ?? cr.minScore;

                  return (
                    <div key={cr.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-foreground">{cr.name}</h4>
                          <p className="text-[10px] text-muted-foreground">
                            Weight: {cr.weight}% · Range: {cr.minScore}–{cr.maxScore}
                          </p>
                        </div>
                        <input
                          type="number"
                          min={cr.minScore}
                          max={cr.maxScore}
                          value={val === undefined || isNaN(val) ? "" : Math.round(val)}
                          onChange={(e) => {
                            const raw = e.target.value === "" ? cr.minScore : Number(e.target.value);
                            const newScore = Math.min(cr.maxScore, Math.max(cr.minScore, raw));
                            setEditModal({
                              ...editModal,
                              values: {
                                ...editModal.values,
                                [cr.id]: newScore,
                              },
                            });
                          }}
                          className="w-20 text-xl font-black font-mono text-primary bg-secondary/50 border border-border rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-primary py-1"
                        />
                      </div>

                      {/* Slider Control */}
                      <input
                        type="range"
                        min={cr.minScore}
                        max={cr.maxScore}
                        step={1}
                        value={Math.round(val)}
                        onChange={(e) => {
                          const newScore = Math.min(cr.maxScore, Math.max(cr.minScore, Number(e.target.value)));
                          setEditModal({
                            ...editModal,
                            values: {
                              ...editModal.values,
                              [cr.id]: newScore,
                            },
                          });
                        }}
                        className="w-full h-2 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-between items-center pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleClearScore}
                  disabled={clearingScore || savingScore}
                  className="gap-1.5 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {clearingScore ? "Clearing..." : "Clear Score"}
                </Button>

                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => setEditModal(null)}>
                    <X className="w-4 h-4 mr-1" /> Cancel
                  </Button>
                  <Button type="submit" disabled={savingScore || clearingScore} className="gap-1.5">
                    <Check className="w-4 h-4" />
                    {savingScore ? "Saving..." : "Save Score"}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
