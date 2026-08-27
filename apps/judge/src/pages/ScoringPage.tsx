import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { Crown, Footprints, Check, Clock, CheckCircle2, RefreshCw, PhoneCall, Lock, EyeOff, Zap, Hourglass } from "lucide-react";
import { Button } from "@pageant/ui/components/button";
import { Card } from "@pageant/ui/components/card";
import { Dialog, DialogContent } from "@pageant/ui/components/dialog";
import { toast } from "sonner";
import type { PresentationState, Candidate, Criteria, CategoryWithCandidates, SegmentWithCategories } from "@pageant/types";

const API_BASE = "/api";
const SOCKET_URL = window.location.origin;

export function ScoringPage() {
  const navigate = useNavigate();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [presentation, setPresentation] = useState<PresentationState | null>(null);

  // Pageant data
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [categories, setCategories] = useState<CategoryWithCandidates[]>([]);
  const [segments, setSegments] = useState<SegmentWithCategories[]>([]);

  // Selection state
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  // Scoring state
  const [scoreValues, setScoreValues] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error" | "unsaved">("idle");
  const [loading, setLoading] = useState(true);
  const [unsavedEditsCache, setUnsavedEditsCache] = useState<Record<string, Record<string, number>>>({});
  const [lightboxData, setLightboxData] = useState<{
    url: string;
    name: string;
    number: number;
    barangay?: string;
    municipality?: string;
    province?: string;
    region?: string;
    country?: string;
  } | null>(null);

  const isInitialLoad = useRef(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scored map (candidateId -> categoryId -> true)
  const [scoredMap, setScoredMap] = useState<Record<string, Record<string, boolean>>>({});

  // Judge preference for simultaneous scoring
  const [isSimultaneousEnabled, setIsSimultaneousEnabled] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem("judge_simultaneous_enabled");
      return val !== "false"; // default to true
    } catch {
      return true;
    }
  });

  const token = sessionStorage.getItem("judgeToken");
  const judgeInfo = JSON.parse(sessionStorage.getItem("judgeInfo") || "null");
  const isChairman = Number(judgeInfo?.judgeNumber) === 1;

  const [assistancePopping, setAssistancePopping] = useState(false);

  const handleRequestAssistance = () => {
    if (!judgeInfo || !socket || assistancePopping) return;
    socket.emit("judge:request-assistance", {
      judgeId: judgeInfo.id,
      judgeName: judgeInfo.name,
      pageantId: judgeInfo.pageantId,
    });
    setAssistancePopping(true);
    setTimeout(() => {
      setAssistancePopping(false);
    }, 2000);
  };

  // Redirect if no token
  useEffect(() => {
    if (!token || !judgeInfo) navigate("/");
  }, [token, judgeInfo, navigate]);

  // Fetch initial pageant data (candidates, categories, segments, and judge's own scores)
  const fetchPageantData = async () => {
    if (!judgeInfo) return;
    try {
      const res = await fetch(`${API_BASE}/pageants/${judgeInfo.pageantId}/results`);
      const d = await res.json();
      if (d.success) {
        setCandidates(d.data.candidates);
        setCategories(d.data.categories);
        if (d.data.segments) setSegments(d.data.segments);

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

    newSocket.on("segment:lock-update", () => fetchPageantData());
    newSocket.on("segment:hide-update", () => fetchPageantData());

    // Debounced handler: coalesce rapid score broadcasts into a single refetch
    const debouncedScoreUpdate = () => {
      if (refetchDebounceRef.current) clearTimeout(refetchDebounceRef.current);
      refetchDebounceRef.current = setTimeout(() => {
        fetchPageantData();
      }, 500);
    };
    newSocket.on("score:update", debouncedScoreUpdate);
    newSocket.on("scores:update", debouncedScoreUpdate);
    newSocket.on("category:candidates-update", debouncedScoreUpdate);

    return () => {
      if (refetchDebounceRef.current) clearTimeout(refetchDebounceRef.current);
      newSocket.close();
    };
  }, [token]);

  // Determine current segment & simultaneous mode
  const selectedCat = categories.find((c) => c.id === selectedCategoryId);
  const currentSegment = segments.find(
    (s) => s.id === selectedCategoryId || (selectedCat && s.id === selectedCat.segmentId)
  );

  const currentSegmentId = currentSegment?.id || selectedCat?.segmentId || "";
  const isCatSimultaneous = !!selectedCat?.isSimultaneous;
  const isSimultaneousMode = isCatSimultaneous && isSimultaneousEnabled;

  const activeCategoriesInSelection: CategoryWithCandidates[] = isSimultaneousMode && currentSegmentId
    ? (categories.filter((c) => c.segmentId === currentSegmentId && c.isSimultaneous) as CategoryWithCandidates[])
    : categories.filter((c) => c.id === selectedCategoryId);

  const activeCriteriaList: Criteria[] = activeCategoriesInSelection.flatMap((c) => c.criteria || []);

  const isSegmentHidden = segments.some(
    (seg) => (seg.isHidden || seg.isLocked) && (seg.id === currentSegmentId || seg.categories?.some((c) => c.id === selectedCategoryId))
  );
  const isSegmentLocked = isSegmentHidden;

  // Perform backend auto-save
  const performSave = useCallback(
    async (currentScores: Record<string, number>) => {
      if (!selectedCandidateId || activeCategoriesInSelection.length === 0 || !token) return;
      if (activeCriteriaList.length === 0) return;

      if (isSegmentLocked) {
        toast.error("This segment is locked by the controller. Scores cannot be altered.");
        return;
      }

      setSaveStatus("saving");

      try {
        const payloadScores = activeCriteriaList.map((c) => {
          const raw = currentScores[c.id];
          const val = raw === undefined || isNaN(raw) ? c.minScore : raw;
          const clamped = Math.min(c.maxScore, Math.max(c.minScore, val));
          return {
            criteriaId: c.id,
            value: clamped,
          };
        });

        const res = await fetch(`${API_BASE}/scores`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ candidateId: selectedCandidateId, scores: payloadScores }),
        });

        const data = await res.json();
        if (data.success) {
          setSubmitted(true);
          setSaveStatus("saved");

          // Clear local unsaved cache for this candidate since they are formally submitted
          setUnsavedEditsCache((prev) => {
            const updated = { ...prev };
            delete updated[selectedCandidateId];
            return updated;
          });

          // Broadcast saved status to admin
          activeCategoriesInSelection.forEach((cat) => {
            socket?.emit("judge:status-update", {
              candidateId: selectedCandidateId,
              categoryId: cat.id,
              status: "saved" as const,
            });
          });

          // Sync local state to clamped scores
          setScoreValues((prev) => {
            const synced = { ...prev };
            activeCriteriaList.forEach((c) => {
              const raw = synced[c.id];
              const val = raw === undefined || isNaN(raw) ? c.minScore : raw;
              synced[c.id] = Math.min(c.maxScore, Math.max(c.minScore, val));
            });
            return synced;
          });

          setScoredMap((prev) => {
            const updated = { ...prev };
            if (!updated[selectedCandidateId]) updated[selectedCandidateId] = {};
            activeCategoriesInSelection.forEach((cat) => {
              updated[selectedCandidateId][cat.id] = true;
            });
            return updated;
          });

          // Scores already saved via HTTP POST — do NOT re-submit via Socket.IO
          // (removed duplicate socket.emit('judge:submit-score') to prevent double DB writes)
        } else {
          setSaveStatus("error");
        }
      } catch {
        setSaveStatus("error");
      }
    },
    [selectedCandidateId, activeCategoriesInSelection, activeCriteriaList, isSegmentLocked, token, socket]
  );

  const getCandidateState = (candidateId: string) => {
    // 1. If it has unsaved changes locally:
    if (unsavedEditsCache[candidateId] && Object.keys(unsavedEditsCache[candidateId]).length > 0) {
      return "unsaved";
    }
    // 2. If it is already fully scored in database:
    const isScored = activeCategoriesInSelection.every((cat) => scoredMap[candidateId]?.[cat.id]);
    if (isScored) {
      return "saved";
    }
    // 3. Otherwise:
    return "pending";
  };

  const handleSelectCandidate = async (newCandidateId: string) => {
    if (newCandidateId === selectedCandidateId) return;
    setSelectedCandidateId(newCandidateId);
  };

  const handleSelectCategory = async (newCategoryId: string) => {
    if (newCategoryId === selectedCategoryId) return;
    setSelectedCategoryId(newCategoryId);
  };

  // Load scores for selected candidate + active categories in selection
  useEffect(() => {
    if (!selectedCandidateId || activeCategoriesInSelection.length === 0) return;

    isInitialLoad.current = true;
    setSaveStatus("idle");

    const defaults: Record<string, number> = {};
    activeCriteriaList.forEach((c) => {
      defaults[c.id] = c.minScore;
    });

    const fetchPromises = activeCategoriesInSelection.map((cat) =>
      fetch(`${API_BASE}/scores/candidate/${selectedCandidateId}/category/${cat.id}`).then((r) => r.json())
    );

    Promise.all(fetchPromises)
      .then((results) => {
        const savedScores: Record<string, number> = {};
        let hasAnySaved = false;

        results.forEach((d) => {
          if (d.success && Array.isArray(d.data)) {
            const judgeScores = d.data.filter((s: any) => s.judgeId === judgeInfo?.id);
            if (judgeScores.length > 0) {
              hasAnySaved = true;
              judgeScores.forEach((s: any) => {
                savedScores[s.criteriaId] = Number(s.value);
              });
            }
          }
        });

        const localEdits = unsavedEditsCache[selectedCandidateId] || {};
        const finalScores = { ...defaults, ...savedScores, ...localEdits };
        const hasUnsaved = Object.keys(localEdits).length > 0;

        setScoreValues(finalScores);
        setSubmitted(hasAnySaved && !hasUnsaved);
        setSaveStatus(hasUnsaved ? "unsaved" : (hasAnySaved ? "saved" : "idle"));
      })
      .catch(() => {
        const localEdits = unsavedEditsCache[selectedCandidateId] || {};
        const finalScores = { ...defaults, ...localEdits };
        const hasUnsaved = Object.keys(localEdits).length > 0;

        setScoreValues(finalScores);
        setSubmitted(false);
        setSaveStatus(hasUnsaved ? "unsaved" : "idle");
      })
      .finally(() => {
        setTimeout(() => {
          isInitialLoad.current = false;
        }, 150);
      });
  }, [selectedCandidateId, selectedCategoryId, activeCategoriesInSelection.length, isSimultaneousEnabled, judgeInfo?.id]);

  const handleScoreChange = (criteriaId: string, value: number, min: number, max: number) => {
    if (isSegmentLocked) return;
    const clamped = Math.min(max, Math.max(min, value));

    setScoreValues((prev) => ({ ...prev, [criteriaId]: clamped }));

    if (!isInitialLoad.current) {
      setUnsavedEditsCache((prev) => {
        const candidateEdits = prev[selectedCandidateId] ? { ...prev[selectedCandidateId] } : {};
        candidateEdits[criteriaId] = clamped;
        return { ...prev, [selectedCandidateId]: candidateEdits };
      });
      setSaveStatus("unsaved");
      setSubmitted(false);

      // Broadcast unsaved status to admin
      activeCategoriesInSelection.forEach((cat) => {
        socket?.emit("judge:status-update", {
          candidateId: selectedCandidateId,
          categoryId: cat.id,
          status: "unsaved" as const,
        });
      });
    }
  };

  const handleSubmit = async () => {
    performSave(scoreValues);
  };

  const activeCategoryCandidates =
    activeCategoriesInSelection.length > 0 && Array.isArray(activeCategoriesInSelection[0].candidates)
      ? activeCategoriesInSelection[0].candidates
      : candidates;

  const selectedCandidate =
    activeCategoryCandidates.find((c) => c.id === selectedCandidateId) || null;

  // Auto-select first candidate in current category if selected candidate is invalid for this category
  useEffect(() => {
    if (activeCategoryCandidates.length > 0) {
      const exists = activeCategoryCandidates.some((c) => c.id === selectedCandidateId);
      if (!exists) {
        setSelectedCandidateId(activeCategoryCandidates[0].id);
      }
    } else {
      setSelectedCandidateId("");
    }
  }, [selectedCategoryId, activeCategoryCandidates, selectedCandidateId]);

  const getFallback = (name: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=128&bold=true`;

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="h-8 w-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const getSequenceLabel = (idx: number) => {
    const n = idx + 1;
    if (n === 1) return "1st to score";
    if (n === 2) return "2nd to score";
    if (n === 3) return "3rd to score";
    return `${n}th to score`;
  };

  // Sort segments by order
  const sortedSegments = [...segments].sort((a, b) => a.order - b.order);

  // Filter visible categories
  const visibleCategories = categories.filter((cat) => {
    const seg = segments.find((s) => s.categories?.some((c) => c.id === cat.id));
    return !seg || !(seg.isHidden || seg.isLocked);
  });

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl shrink-0 z-20">
        <div className="w-full px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground text-sm">Judge Portal</span>
          </div>
          <span className="text-xs text-primary font-semibold">
            {judgeInfo?.judgeNumber ? `Judge ${judgeInfo.judgeNumber} — ` : ""}{judgeInfo?.name}
          </span>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="flex-1 w-full px-6 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* Column 1: Category/Segment Selector */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border p-4 shrink-0 flex flex-col min-h-0 overflow-y-auto">
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Category Sequence</label>
          <div className="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0">
            {sortedSegments.map((seg) => {
              const segCategories = visibleCategories.filter((c) => c.segmentId === seg.id);
              if (segCategories.length === 0) return null;

              const isSegActive = seg.id === currentSegmentId;

              return (
                <div key={seg.id} className="space-y-1.5 shrink-0 md:shrink">
                  <div className="flex items-center justify-between px-1 gap-2">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider truncate">{seg.name}</span>
                    {segCategories.some((c) => c.isSimultaneous) && (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                        ⚡ SIMULTANEOUS
                      </span>
                    )}
                  </div>

                  {segCategories.map((cat) => {
                    const idx = visibleCategories.findIndex((c) => c.id === cat.id);
                    const presentationActiveCat = categories.find((c) => c.id === presentation?.activeCategoryId);
                    const isPresentationActiveSimultaneous = !!presentationActiveCat?.isSimultaneous;
                    const isDirectlyActive = presentation?.activeCategoryId === cat.id;
                    const isSimultaneousActive = isPresentationActiveSimultaneous && !!cat.isSimultaneous && presentationActiveCat?.segmentId === cat.segmentId;
                    const isActiveCategory = isDirectlyActive || isSimultaneousActive;

                    const isSelectedCategory = isSimultaneousMode
                      ? (isSegActive && !!cat.isSimultaneous)
                      : selectedCategoryId === cat.id;
                    const seqText = getSequenceLabel(idx);

                    return (
                      <button
                        key={cat.id}
                        onClick={() => handleSelectCategory(cat.id)}
                        className={`w-full p-2.5 rounded-xl text-xs font-bold text-left whitespace-nowrap transition-all flex flex-col gap-1 border ${isSelectedCategory
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                          }`}
                      >
                        <div className="flex items-center justify-between gap-2 w-full">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isSelectedCategory ? "bg-white/20 text-white" : "bg-primary/20 text-primary"
                              }`}>
                              #{idx + 1}
                            </span>
                            <span className="truncate">{cat.name} ({cat.weight}%)</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isActiveCategory && (
                              <span
                                className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-1 uppercase tracking-wider ${isSelectedCategory
                                    ? "bg-white/20 text-white"
                                    : "bg-emerald-500/20 text-emerald-400"
                                  }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                                ACTIVE
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] opacity-80 gap-2">
                          <span className={`font-semibold ${isSelectedCategory ? "text-white/90" : "text-emerald-400"}`}>
                            {seqText}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Column 2: Candidates List */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border p-4 shrink-0 flex flex-col max-h-60 md:max-h-none overflow-hidden">
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Candidates</label>
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pr-1">
            <div className="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0">
              {activeCategoryCandidates.length === 0 ? (
                <div className="text-xs text-muted-foreground/60 italic p-4 text-center border border-dashed border-border rounded-xl">
                  No candidates selected for this category
                </div>
              ) : (
                activeCategoryCandidates.map((c) => {
                  const isWalking = presentation?.activeCandidateId === c.id;
                  const isScored = activeCategoriesInSelection.every((cat) => scoredMap[c.id]?.[cat.id]);
                  const isSelected = selectedCandidateId === c.id;

                  return (
                    <button
                      key={c.id}
                      onClick={() => handleSelectCandidate(c.id)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl text-left border transition-all shrink-0 md:shrink min-w-50 md:min-w-0 ${isSelected
                        ? "bg-primary/15 border-primary text-foreground"
                        : isWalking
                          ? "bg-green-500/10 border-green-500/80 shadow-[0_0_12px_rgba(34,197,94,0.2)] animate-[pulse_2s_infinite] text-foreground"
                          : "bg-muted/50 border-border hover:bg-muted text-muted-foreground"
                        }`}
                    >
                      <img
                        src={c.photoUrl || getFallback(c.name)}
                        alt=""
                        className="w-10 h-10 rounded-xl object-cover shrink-0 cursor-zoom-in hover:ring-2 hover:ring-primary transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxData({
                            url: c.photoUrl || getFallback(c.name),
                            name: c.name,
                            number: c.candidateNumber,
                            barangay: c.barangay,
                            municipality: c.municipality,
                            province: c.province,
                            region: c.region,
                            country: c.country,
                          });
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded shrink-0 ${isSelected ? "bg-white/20 text-white" : isWalking ? "bg-green-500 text-white" : "bg-primary/20 text-primary"
                              }`}>
                              #{c.candidateNumber}
                            </span>
                            <p className="text-xs font-bold truncate">{c.name}</p>
                          </div>
                          {getCandidateState(c.id) === "unsaved" ? (
                            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                          ) : getCandidateState(c.id) === "saved" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <span className="w-3.5 h-3.5 rounded-full border border-dashed border-muted-foreground/40 shrink-0" />
                          )}
                        </div>
                        {isWalking && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] bg-green-500/20 text-green-400 font-bold px-1.5 py-0.5 rounded animate-pulse flex items-center">
                              <Footprints className="w-3 h-3 inline mr-0.5" /> ON STAGE
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* Right Side: Scoring sliders */}
        <main className="flex-1 p-6 overflow-y-auto min-h-0">
          {selectedCandidate ? (
            <div className="max-w-4xl w-full mx-auto space-y-6">
              {/* Candidate Card Summary */}
              <Card className="p-5 flex flex-row items-center justify-between gap-4">
                {/* Left Side: Candidate Profile (Photo + Name & Number) */}
                <div className="flex items-center gap-5">
                  <img
                    src={selectedCandidate.photoUrl || getFallback(selectedCandidate.name)}
                    alt=""
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover ring-4 ring-primary/30 shrink-0 shadow-lg cursor-zoom-in hover:ring-primary/60 hover:scale-105 active:scale-95 transition-all"
                    onClick={() => setLightboxData({
                      url: selectedCandidate.photoUrl || getFallback(selectedCandidate.name),
                      name: selectedCandidate.name,
                      number: selectedCandidate.candidateNumber,
                      barangay: selectedCandidate.barangay,
                      municipality: selectedCandidate.municipality,
                      province: selectedCandidate.province,
                      region: selectedCandidate.region,
                      country: selectedCandidate.country,
                    })}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl sm:text-2xl font-bold text-foreground">{selectedCandidate.name}</h2>
                      {presentation?.activeCandidateId === selectedCandidate.id && (
                        <span className="text-[9px] bg-green-500/20 text-green-400 font-bold px-2 py-0.5 rounded animate-pulse">
                          ON STAGE
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-0.5">
                      Candidate #{selectedCandidate.candidateNumber}
                    </p>
                    {([
                      selectedCandidate.barangay,
                      selectedCandidate.municipality,
                      selectedCandidate.province,
                      selectedCandidate.region,
                      selectedCandidate.country
                    ].some(Boolean)) && (
                        <p className="text-xs text-muted-foreground/80 mt-1">
                          {[
                            selectedCandidate.barangay,
                            selectedCandidate.municipality,
                            selectedCandidate.province,
                            selectedCandidate.region,
                            selectedCandidate.country
                          ].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    {isSimultaneousMode ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 mt-1 uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                        ⚡ Simultaneous Scoring ({activeCategoriesInSelection.length} Categories)
                      </span>
                    ) : (
                      activeCategoriesInSelection[0] && (
                        <p className="text-xs sm:text-sm text-primary font-bold mt-1 uppercase tracking-wider">
                          {activeCategoriesInSelection[0].name}
                        </p>
                      )
                    )}
                  </div>
                </div>

                {/* Right Side: Total Score & Submit Button */}
                <div className="flex flex-col items-stretch gap-2 shrink-0 min-w-31.25">
                  {/* Total Score Boxes */}
                  <div className="flex gap-2">
                    {activeCategoriesInSelection.map((cat) => {
                      const catTotal = (cat.criteria || []).reduce((sum, c) => sum + Number(scoreValues[c.id] ?? c.minScore), 0).toFixed(2);
                      return (
                        <div key={cat.id} className="text-center bg-secondary/40 border border-border px-4 py-2 rounded-xl flex-1 min-w-[125px]">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block truncate max-w-[100px] mx-auto" title={cat.name}>
                            {activeCategoriesInSelection.length > 1 ? cat.name : "Total Score"}
                          </span>
                          <span className="text-3xl font-black font-mono text-primary">
                            {catTotal}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Submit Button (placed directly below the score box) */}
                  <Button
                    type="button"
                    onClick={() => performSave(scoreValues)}
                    disabled={saveStatus === "saving" || saveStatus === "idle" || isSegmentLocked}
                    className={`w-full py-2.5 px-3 text-xs font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 ${saveStatus === "saving"
                        ? "bg-indigo-950 text-indigo-400 border border-indigo-800/50 cursor-not-allowed"
                        : saveStatus === "saved"
                          ? "bg-emerald-600/90 text-white border border-emerald-500/50 shadow-emerald-500/20"
                          : saveStatus === "unsaved"
                            ? "bg-amber-500 hover:bg-amber-600 text-white animate-pulse shadow-amber-500/30"
                            : saveStatus === "error"
                              ? "bg-rose-600 hover:bg-rose-700 text-white animate-pulse"
                              : "bg-zinc-800/80 text-zinc-500 border border-zinc-700 cursor-not-allowed"
                      }`}
                  >
                    {saveStatus === "saving" ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Submitting...
                      </>
                    ) : saveStatus === "saved" ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Submitted
                      </>
                    ) : saveStatus === "error" ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Retry Submit
                      </>
                    ) : saveStatus === "unsaved" ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Submit Score
                      </>
                    ) : (
                      <>
                        <Hourglass className="w-3.5 h-3.5" /> Pending Score
                      </>
                    )}
                  </Button>
                </div>
              </Card>

              {/* Admin Simultaneous Recommendation Banner */}
              {isCatSimultaneous && categories.some(c => c.segmentId === currentSegmentId && c.isSimultaneous && c.id !== selectedCategoryId) && (
                <div className="bg-primary/10 border border-primary/20 p-4 rounded-2xl flex items-center justify-between gap-4 shadow-md backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/20 border border-primary/30 shrink-0 text-primary">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                        ⚡ Admin Recommendation
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        These categories are scheduled to happen at the same time. Score them together on one screen?
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0 bg-secondary/50 px-3.5 py-1.5 rounded-xl border border-border">
                    <span className="text-xs font-bold text-foreground">Score simultaneously</span>
                    <input
                      type="checkbox"
                      checked={isSimultaneousEnabled}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setIsSimultaneousEnabled(val);
                        localStorage.setItem("judge_simultaneous_enabled", String(val));
                        toast.success(val ? "Simultaneous scoring enabled" : "Simultaneous scoring disabled");
                      }}
                      className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Segment Hide Warning Banner */}
              {isSegmentHidden && (
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-4 rounded-2xl flex items-center gap-3.5 shadow-lg">
                  <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 shrink-0">
                    <EyeOff className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Segment Hidden by Controller</h4>
                    <p className="text-xs text-amber-400/80 mt-0.5">
                      This segment is currently hidden by the competition controller. Scores cannot be submitted or altered right now.
                    </p>
                  </div>
                </div>
              )}

              {/* Sliders Grouped by Category */}
              <div className="space-y-6">
                {activeCategoriesInSelection.map((cat) => {
                  const catCriteria = cat.criteria || [];
                  const catTotal = catCriteria.reduce((sum, c) => sum + Number(scoreValues[c.id] ?? c.minScore), 0).toFixed(2);

                  return (
                    <div key={cat.id} className="space-y-3 pb-4">
                      {/* Always show Category Title and Subtotal */}
                      <div className="flex items-center justify-between px-1 border-b border-border/30 pb-2 mb-2 flex-wrap gap-2">
                        <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                          <span>{cat.name}</span>
                          <span className="text-xs text-muted-foreground font-normal">({cat.weight}%)</span>
                        </h3>
                        <div className="bg-primary/10 border border-primary/20 px-3 py-1 rounded-lg text-xs font-bold text-primary tracking-wider">
                          CATEGORY TOTAL: <span className="font-mono text-sm font-black ml-1">{catTotal}</span>
                        </div>
                      </div>

                      {catCriteria.map((c) => (
                        <div key={c.id} className={`bg-card border border-border rounded-xl p-5 space-y-4 transition-opacity ${isSegmentLocked ? "opacity-60" : ""}`}>
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <h3 className="text-base font-bold text-foreground">{c.name}</h3>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <span className="text-xs font-bold px-2.5 py-1 bg-secondary border border-border/60 rounded-md text-muted-foreground">
                                  Weight: {c.weight}%
                                </span>
                                <span className="text-xs font-bold px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md">
                                  Range: {c.minScore}–{c.maxScore}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 bg-secondary/85 border border-border/60 rounded-xl px-1.5 py-0.5 shrink-0">
                              {/* Decrement Button */}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const currentVal = scoreValues[c.id] === undefined || isNaN(scoreValues[c.id]) ? c.minScore : scoreValues[c.id];
                                  handleScoreChange(c.id, currentVal - 0.5, c.minScore, c.maxScore);
                                }}
                                disabled={isSegmentLocked || (scoreValues[c.id] === undefined || isNaN(scoreValues[c.id]) ? c.minScore : scoreValues[c.id]) <= c.minScore}
                                className="h-8 w-8 text-xl font-bold shrink-0 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-lg disabled:opacity-30"
                              >
                                -
                              </Button>

                              {/* Display */}
                              <div className="w-12 text-2xl font-black font-mono text-amber-400 text-center select-none">
                                {scoreValues[c.id] === undefined || isNaN(scoreValues[c.id]) ? c.minScore : scoreValues[c.id]}
                              </div>

                              {/* Increment Button */}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const currentVal = scoreValues[c.id] === undefined || isNaN(scoreValues[c.id]) ? c.minScore : scoreValues[c.id];
                                  handleScoreChange(c.id, currentVal + 0.5, c.minScore, c.maxScore);
                                }}
                                disabled={isSegmentLocked || (scoreValues[c.id] === undefined || isNaN(scoreValues[c.id]) ? c.minScore : scoreValues[c.id]) >= c.maxScore}
                                className="h-8 w-8 text-xl font-bold shrink-0 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-lg disabled:opacity-30"
                              >
                                +
                              </Button>
                            </div>
                          </div>



                          <div className="mt-3">
                            <input
                              type="range"
                              min={c.minScore}
                              max={c.maxScore}
                            step={0.5}
                            disabled={isSegmentLocked}
                            value={scoreValues[c.id] === undefined || isNaN(scoreValues[c.id]) ? c.minScore : scoreValues[c.id]}
                            onChange={(e) => handleScoreChange(c.id, Number(e.target.value), c.minScore, c.maxScore)}
                              className="w-full h-3 bg-secondary rounded-full appearance-none cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 text-sm gap-2 py-12">
              {activeCategoryCandidates.length === 0 ? (
                <p>No candidates selected for this category yet.</p>
              ) : (
                <p>Select a candidate from the list to start scoring.</p>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Floating Call Assistance Icon Button (Bottom Left) */}
      <div className="fixed bottom-6 left-6 z-50 flex items-center justify-center">
        {assistancePopping && (
          <span className="absolute w-12 h-12 rounded-full bg-amber-400 opacity-75 animate-ping" />
        )}
        <button
          onClick={handleRequestAssistance}
          className={`relative flex items-center justify-center w-12 h-12 rounded-full shadow-xl transition-all duration-300 active:scale-90 cursor-pointer ${assistancePopping
            ? "bg-amber-400 text-slate-950 scale-125 shadow-amber-400/60 ring-4 ring-amber-300/60"
            : "bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/30 hover:scale-110"
            }`}
          title="Call Assistance"
          aria-label="Call Assistance"
        >
          <PhoneCall className={`w-5 h-5 text-slate-950 transition-transform ${assistancePopping ? "animate-bounce" : ""}`} />
        </button>
      </div>

      {/* Lightbox Image Modal */}
      <Dialog open={!!lightboxData} onOpenChange={(open) => { if (!open) setLightboxData(null); }}>
        <DialogContent className="max-w-2xl p-2 bg-black/95 border border-white/10 flex flex-col items-center justify-center overflow-hidden rounded-2xl shadow-2xl">
          {lightboxData && (
            <div className="relative w-full max-h-[85vh] flex flex-col items-center justify-center p-3">
              {/* Zoomed Image */}
              <img
                src={lightboxData.url}
                alt={lightboxData.name}
                className="max-w-full max-h-[65vh] rounded-xl object-contain shadow-2xl"
              />

              {/* Candidate Info Overlay card */}
              <div className="mt-4 w-full bg-white/5 border border-white/10 backdrop-blur-md px-5 py-3 rounded-xl text-center shadow-lg">
                <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                  Candidate #{lightboxData.number}
                </span>
                <h3 className="text-base font-extrabold text-white mt-1.5">{lightboxData.name}</h3>

                {([
                  lightboxData.barangay,
                  lightboxData.municipality,
                  lightboxData.province,
                  lightboxData.region,
                  lightboxData.country
                ].some(Boolean)) && (
                    <p className="text-xs text-muted-foreground mt-1.5 font-medium">
                      {[
                        lightboxData.barangay,
                        lightboxData.municipality,
                        lightboxData.province,
                        lightboxData.region,
                        lightboxData.country
                      ].filter(Boolean).join(" · ")}
                    </p>
                  )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
