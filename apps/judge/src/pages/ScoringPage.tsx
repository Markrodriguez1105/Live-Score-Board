import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { Crown, Footprints, Check, Clock } from "lucide-react";
import { Button } from "@pageant/ui/components/button";
import { Card } from "@pageant/ui/components/card";
import { toast } from "sonner";
import type { PresentationState, Candidate, Criteria, CategoryWithCriteria } from "@pageant/types";

const API_BASE = "/api";
const SOCKET_URL = window.location.origin;

export function ScoringPage() {
  const navigate = useNavigate();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [presentation, setPresentation] = useState<PresentationState | null>(null);

  // Pageant data
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [categories, setCategories] = useState<CategoryWithCriteria[]>([]);

  // Selection state
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  // Scoring state
  const [scoreValues, setScoreValues] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Scored map (candidateId -> categoryId -> true)
  const [scoredMap, setScoredMap] = useState<Record<string, Record<string, boolean>>>({});

  const token = sessionStorage.getItem("judgeToken");
  const judgeInfo = JSON.parse(sessionStorage.getItem("judgeInfo") || "null");

  // Redirect if no token
  useEffect(() => {
    if (!token || !judgeInfo) navigate("/");
  }, [token, judgeInfo, navigate]);

  // Fetch initial pageant data (candidates, categories, and judge's own scores)
  const fetchPageantData = async () => {
    if (!judgeInfo) return;
    try {
      const res = await fetch(`${API_BASE}/pageants/${judgeInfo.pageantId}/results`);
      const d = await res.json();
      if (d.success) {
        setCandidates(d.data.candidates);
        setCategories(d.data.categories);

        // Build map of scored candidates for the current judge
        const map: Record<string, Record<string, boolean>> = {};
        d.data.scores.forEach((s: any) => {
          if (s.judge_id === judgeInfo.id) {
            if (!map[s.candidate_id]) map[s.candidate_id] = {};
            map[s.candidate_id][s.category_id] = true;
          }
        });
        setScoredMap(map);
      }
    } catch (err) {
      console.error("Error fetching pageant data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPageantData();
  }, []);

  // Fetch current presentation state on mount + Setup Socket
  useEffect(() => {
    if (!token || !judgeInfo) return;

    fetch(`${API_BASE}/pageants/${judgeInfo.pageantId}/presentation`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setPresentation(d.data);
          // Set initial selection to the active candidate/category if not set yet
          if (d.data.activeCandidateId) setSelectedCandidateId(d.data.activeCandidateId);
          if (d.data.activeCategoryId) setSelectedCategoryId(d.data.activeCategoryId);
        }
      });

    const newSocket = io(SOCKET_URL, { auth: { token } });
    setSocket(newSocket);

    newSocket.on("presentation:update", (state: PresentationState) => {
      setPresentation(state);
    });

    return () => { newSocket.close(); };
  }, [token]);

  // Load scores for selected candidate + category
  useEffect(() => {
    if (!selectedCandidateId || !selectedCategoryId || categories.length === 0) return;

    // Set criteria list
    const currentCategory = categories.find((c) => c.id === selectedCategoryId);
    const categoryCriteria = currentCategory?.criteria || [];

    // Initialize score values to defaults first
    const defaults: Record<string, number> = {};
    categoryCriteria.forEach((c) => {
      defaults[c.id] = c.minScore;
    });

    // Fetch if the judge has already scored this candidate
    fetch(`${API_BASE}/scores/candidate/${selectedCandidateId}/category/${selectedCategoryId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const judgeScores = d.data.filter((s: any) => s.judgeId === judgeInfo.id);
          if (judgeScores.length > 0) {
            const savedScores: Record<string, number> = {};
            judgeScores.forEach((s: any) => {
              savedScores[s.criteriaId] = Number(s.value);
            });
            setScoreValues({ ...defaults, ...savedScores });
            setSubmitted(true);
          } else {
            setScoreValues(defaults);
            setSubmitted(false);
          }
        }
      })
      .catch(() => {
        setScoreValues(defaults);
        setSubmitted(false);
      });
  }, [selectedCandidateId, selectedCategoryId, categories, judgeInfo.id]);

  const handleScoreChange = (criteriaId: string, value: number, min: number, max: number) => {
    const clamped = Math.min(max, Math.max(min, value));
    setScoreValues((prev) => ({ ...prev, [criteriaId]: clamped }));
  };

  const handleSubmit = async () => {
    if (!selectedCandidateId || !selectedCategoryId) return;
    const currentCategory = categories.find((c) => c.id === selectedCategoryId);
    const categoryCriteria = currentCategory?.criteria || [];
    if (categoryCriteria.length === 0) return;

    setSubmitting(true);

    try {
      const scores = categoryCriteria.map((c) => ({
        criteriaId: c.id,
        value: scoreValues[c.id] ?? c.minScore,
      }));

      const res = await fetch(`${API_BASE}/scores`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ candidateId: selectedCandidateId, scores }),
      });

      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        toast.success("Scores submitted successfully!");

        // Update scored map locally
        setScoredMap((prev) => ({
          ...prev,
          [selectedCandidateId]: {
            ...(prev[selectedCandidateId] || {}),
            [selectedCategoryId]: true,
          },
        }));

        // Emit socket event to notify other screens
        socket?.emit("judge:submit-score", { candidateId: selectedCandidateId, scores });
      } else {
        toast.error(data.error || "Failed to submit score");
      }
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentCategory = categories.find((c) => c.id === selectedCategoryId);
  const criteriaList = currentCategory?.criteria || [];
  const selectedCandidate = candidates.find((c) => c.id === selectedCandidateId);

  const getFallback = (name: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=128&bold=true`;

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="h-8 w-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground text-sm">Judge Portal</span>
          </div>
          <span className="text-xs text-primary font-semibold">{judgeInfo?.name}</span>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="flex-1 max-w-6xl w-full mx-auto flex flex-col md:flex-row overflow-hidden">
        {/* Left Side: Category and Candidates List */}
        <aside className="w-full md:w-80 border-b md:border-b-0 md:border-r border-border p-4 space-y-4 shrink-0 flex flex-col max-h-80 md:max-h-none overflow-y-auto">
          {/* Category Selector */}
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Category</label>
            <div className="flex md:flex-col gap-1.5 overflow-x-auto pb-2 md:pb-0">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold text-left whitespace-nowrap transition-all shrink-0 md:shrink ${selectedCategoryId === cat.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                >
                  {cat.name} ({cat.weight}%)
                </button>
              ))}
            </div>
          </div>

          {/* Candidates List */}
          <div className="flex-1 flex flex-col min-h-0">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Candidates</label>
            <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto pb-2 md:pb-0 pr-1">
              {candidates.map((c) => {
                const isWalking = presentation?.activeCandidateId === c.id;
                const isScored = scoredMap[c.id]?.[selectedCategoryId] || false;
                const isSelected = selectedCandidateId === c.id;

                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCandidateId(c.id)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl text-left border transition-all shrink-0 md:shrink min-w-50 md:min-w-0 ${isSelected
                      ? "bg-primary/15 border-primary text-foreground"
                      : "bg-muted/50 border-border hover:bg-muted text-muted-foreground"
                      }`}
                  >
                    <img src={c.photoUrl || getFallback(c.name)} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">#{c.candidateNumber} {c.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {isWalking && (
                          <span className="text-[9px] bg-green-500/20 text-green-400 font-bold px-1.5 py-0.5 rounded animate-pulse flex items-center">
                            <Footprints className="w-3 h-3 inline mr-0.5" /> ON STAGE
                          </span>
                        )}
                        {isScored ? (
                          <span className="text-[9px] bg-blue-500/20 text-blue-400 font-bold px-1.5 py-0.5 rounded flex items-center">
                            <Check className="w-3 h-3 inline mr-0.5" /> SCORED
                          </span>
                        ) : (
                          <span className="text-[9px] bg-muted text-muted-foreground font-bold px-1.5 py-0.5 rounded flex items-center">
                            <Clock className="w-3 h-3 inline mr-0.5" /> PENDING
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Right Side: Scoring sliders */}
        <main className="flex-1 p-6 overflow-y-auto">
          {selectedCandidate ? (
            <div className="max-w-md mx-auto space-y-6">
              {/* Candidate Card Summary */}
              <Card className="p-5 flex items-center gap-4">
                <img src={selectedCandidate.photoUrl || getFallback(selectedCandidate.name)} alt="" className="w-16 h-16 rounded-full object-cover ring-4 ring-primary/30" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-foreground">{selectedCandidate.name}</h2>
                    {presentation?.activeCandidateId === selectedCandidate.id && (
                      <span className="text-[9px] bg-green-500/20 text-green-400 font-bold px-2 py-0.5 rounded animate-pulse">ON STAGE</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Candidate #{selectedCandidate.candidateNumber}</p>
                  {currentCategory && (
                    <p className="text-xs text-primary font-bold mt-1 uppercase tracking-wider">{currentCategory.name}</p>
                  )}
                </div>
              </Card>

              {/* Sliders */}
              <div className="space-y-4">
                {criteriaList.map((c) => (
                  <div key={c.id} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-xs font-semibold text-foreground">{c.name}</h3>
                        <p className="text-[10px] text-muted-foreground">
                          Weight: {c.weight}% · Range: {c.minScore}–{c.maxScore}
                        </p>
                      </div>
                      <div className="text-xl font-bold font-mono text-primary w-16 text-center">
                        {scoreValues[c.id] ?? c.minScore}
                      </div>
                    </div>

                    <input
                      type="range"
                      min={c.minScore}
                      max={c.maxScore}
                      step={1}
                      value={scoreValues[c.id] ?? c.minScore}
                      onChange={(e) => handleScoreChange(c.id, Number(e.target.value), c.minScore, c.maxScore)}
                      className="w-full h-2 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
                    />

                    <div className="flex justify-between mt-2 gap-1">
                      {[c.minScore, Math.round((c.minScore + c.maxScore) / 2), c.maxScore].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => handleScoreChange(c.id, v, c.minScore, c.maxScore)}
                          className={`flex-1 py-1 rounded text-[10px] font-semibold transition-all ${scoreValues[c.id] === v
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground hover:text-foreground"
                            }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Submit / Update Button */}
              <Button
                onClick={handleSubmit}
                disabled={submitting || criteriaList.length === 0}
                variant="secondary"
                size="lg"
                className="w-full py-4 text-base"
              >
                {submitted ? "Update Scores" : "Submit Scores"}
              </Button>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-white/30 text-sm">
              Select a candidate from the list to start scoring.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
