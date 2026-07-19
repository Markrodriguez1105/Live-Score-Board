import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { ScoreDisplay } from "@pageant/ui/components/score-display";
import type { PresentationState, Candidate, Pageant, Category, CategoryWithCriteria } from "@pageant/types";
import { IdleScreen } from "@pageant/ui/components/idle-screen";

const API_BASE = "/api";
const SOCKET_URL = window.location.origin;

const getFallback = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=512`;

export function ViewerPage() {
  const [presentation, setPresentation] = useState<PresentationState | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [pageant, setPageant] = useState<Pageant | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [scores, setScores] = useState<{ judgeId?: string; judgeName: string; value: number }[]>([]);
  const [imageUrl, setImageUrl] = useState("");

  const [categories, setCategories] = useState<CategoryWithCriteria[]>([]);
  const categoriesRef = useRef<CategoryWithCriteria[]>([]);

  const [judges, setJudges] = useState<any[]>([]);
  const judgesRef = useRef<any[]>([]);

  const presentationRef = useRef<PresentationState | null>(null);
  const pageantIdRef = useRef<string | null>(null);

  const activeCandidateIdRef = useRef<string | null>(null);
  const activeCategoryIdRef = useRef<string | null>(null);

  useEffect(() => {
    judgesRef.current = judges;
  }, [judges]);

  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

  useEffect(() => {
    presentationRef.current = presentation;
    if (presentation?.pageantId) {
      pageantIdRef.current = presentation.pageantId;
    }
    activeCandidateIdRef.current = presentation?.activeCandidateId || null;
    activeCategoryIdRef.current = presentation?.activeCategoryId || null;
  }, [presentation]);

  const handlePresentationUpdate = async (state: PresentationState) => {
    setPresentation(state);
    if (state.pageantId) {
      pageantIdRef.current = state.pageantId;
    }

    if (state.activeCandidateId) {
      try {
        const res = await fetch(`${API_BASE}/candidates/${state.activeCandidateId}`);
        const data = await res.json();
        if (data.success) setCandidate(data.data);
      } catch { /* ignore */ }
    } else {
      setCandidate(null);
    }

    if (state.activeCategoryId) {
      const cat = categoriesRef.current.find((c) => c.id === state.activeCategoryId);
      if (cat) setCategory(cat);
    } else {
      setCategory(null);
    }
  };

  const fetchScores = async (candidateId: string, categoryId: string, targetPageantId?: string) => {
    try {
      let pId: string | null = targetPageantId || pageantIdRef.current || presentationRef.current?.pageantId || null;

      if (!pId) {
        const presRes = await fetch(`${API_BASE}/presentation/active`);
        const presData = await presRes.json();
        if (presData.success && presData.data?.pageantId) {
          pId = presData.data.pageantId;
          pageantIdRef.current = pId;
        }
      }

      let currentCategories = categoriesRef.current;
      let currentJudges = judgesRef.current;

      // Ensure categories and judges are loaded
      if ((currentCategories.length === 0 || currentJudges.length === 0) && pId) {
        const pRes = await fetch(`${API_BASE}/pageants/${pId}/results`);
        const pData = await pRes.json();
        if (pData.success && pData.data) {
          if (pData.data.categories && pData.data.categories.length > 0) {
            currentCategories = pData.data.categories;
            setCategories(pData.data.categories);
            categoriesRef.current = pData.data.categories;
          }
          if (pData.data.judges && pData.data.judges.length > 0) {
            currentJudges = pData.data.judges;
            setJudges(pData.data.judges);
            judgesRef.current = pData.data.judges;
          }
        }
      }

      const res = await fetch(`${API_BASE}/scores/candidate/${candidateId}/category/${categoryId}`);
      const data = await res.json();
      if (!data.success) return;

      const rawScores: any[] = data.data || [];
      const cat = currentCategories.find((c) => c.id === categoryId);
      const criteriaList = cat?.criteria || [];

      const scoresByJudge: Record<string, { judgeName: string; totalWeighted: number; totalWeight: number }> = {};

      rawScores.forEach((s: any) => {
        const crit = criteriaList.find((c) => c.id === s.criteriaId);
        const weight = crit?.weight ?? s.criteriaWeight ?? 100;
        const max = crit?.maxScore ?? s.criteriaMaxScore ?? 100;

        if (!scoresByJudge[s.judgeId]) {
          scoresByJudge[s.judgeId] = {
            judgeName: s.judgeName || `Judge`,
            totalWeighted: 0,
            totalWeight: 0,
          };
        }

        const pct = (Number(s.value) / max) * 100;
        const weighted = pct * (weight / 100);

        scoresByJudge[s.judgeId].totalWeighted += weighted;
        scoresByJudge[s.judgeId].totalWeight += weight;
      });

      let judgeListToUse = [...currentJudges];

      // Fallback: extract unique judges from rawScores if pre-loaded judges list is empty
      if (judgeListToUse.length === 0) {
        const uniqueJudgeIds = Array.from(new Set(rawScores.map((s) => s.judgeId)));
        judgeListToUse = uniqueJudgeIds.map((jId) => {
          const sample = rawScores.find((s) => s.judgeId === jId);
          return { id: jId, name: sample?.judgeName || "Judge" };
        });
      }

      const sortedJudges = judgeListToUse.sort((a, b) => (a.id || "").localeCompare(b.id || ""));

      const judgeResults = sortedJudges.map((j, idx) => {
        const scoreObj = scoresByJudge[j.id];
        let value: number = 0;
        if (scoreObj && scoreObj.totalWeight > 0) {
          value = (scoreObj.totalWeighted / (scoreObj.totalWeight / 100));
          value = Math.round(value * 10) / 10;
        }

        return {
          judgeId: j.id,
          judgeName: j.name || `Judge ${idx + 1}`,
          value,
        };
      });

      setScores(judgeResults);
    } catch (err) {
      console.error("Error fetching scores:", err);
    }
  };

  // Socket connection & initial state fetch
  useEffect(() => {
    fetch(`${API_BASE}/presentation/active`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          const pId = d.data.pageantId;
          if (pId) {
            pageantIdRef.current = pId;
            setPageant({
              id: pId,
              name: d.data.pageantName || "Live Pageant",
              logoUrl: d.data.pageantLogoUrl,
              description: "",
              date: "",
              venue: "",
              status: "active",
              createdAt: "",
              updatedAt: "",
            });

            fetch(`${API_BASE}/pageants/${pId}/results`)
              .then((r) => r.json())
              .then((resData) => {
                if (resData.success) {
                  setJudges(resData.data.judges);
                  judgesRef.current = resData.data.judges;
                  setCategories(resData.data.categories);
                  categoriesRef.current = resData.data.categories;
                  if (d.data.activeCategoryId) {
                    const cat = resData.data.categories.find((c: any) => c.id === d.data.activeCategoryId);
                    if (cat) setCategory(cat);
                  }
                  if (d.data.activeCandidateId && d.data.activeCategoryId) {
                    fetchScores(d.data.activeCandidateId, d.data.activeCategoryId, pId);
                  }
                }
              });
          }
          handlePresentationUpdate(d.data);
        }
      })
      .catch((err) => console.error("Error fetching initial presentation:", err));

    const socket = io(SOCKET_URL);

    socket.on("presentation:update", async (state: PresentationState) => {
      handlePresentationUpdate(state);
      if (state.pageantId) {
        pageantIdRef.current = state.pageantId;
      }
      const cat = categoriesRef.current.find((c) => c.id === state.activeCategoryId);
      if (cat) setCategory(cat);
      if (state.activeCandidateId && state.activeCategoryId) {
        fetchScores(state.activeCandidateId, state.activeCategoryId, state.pageantId);
      }
    });

    const handleScoreUpdate = () => {
      if (activeCandidateIdRef.current && activeCategoryIdRef.current) {
        fetchScores(activeCandidateIdRef.current, activeCategoryIdRef.current);
      }
    };

    socket.on("scores:update", handleScoreUpdate);
    socket.on("score:update", handleScoreUpdate);

    return () => { socket.close(); };
  }, []);

  // Fetch scores when candidate/category changes or presentation update received
  useEffect(() => {
    if (presentation?.activeCandidateId && presentation?.activeCategoryId) {
      fetchScores(presentation.activeCandidateId, presentation.activeCategoryId);
    }
  }, [presentation?.activeCandidateId, presentation?.activeCategoryId, presentation?.showScores]);

  // Load candidate image
  useEffect(() => {
    if (candidate?.photoUrl) {
      const img = new Image();
      img.onload = () => setImageUrl(candidate.photoUrl!);
      img.onerror = () => setImageUrl(getFallback(candidate.name));
      img.src = candidate.photoUrl;
    } else if (candidate) {
      setImageUrl(getFallback(candidate.name));
    }
  }, [candidate]);


  // Idle screen
  if (!presentation || presentation.isIdle || !candidate) {
    return (
      <IdleScreen
        logoUrl={pageant?.logoUrl}
        eventName={pageant?.name}
      />
    );
  }

  // Candidate Spotlight
  return (
    <div className="h-screen w-screen overflow-hidden bg-black text-white relative">
      {/* Background image with gradient mask */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-700"
        style={{
          backgroundImage: `url("${imageUrl}")`,
          maskImage: "linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)",
        }}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-linear-to-r from-transparent via-black/40 to-black/90" />

      {/* Content */}
      <div className="absolute inset-y-0 right-0 w-1/2 flex flex-col justify-center items-center px-12 z-10 space-y-6">
        {/* Category Badge */}
        {category && (
          <div className="px-8 py-3 bg-black/60 backdrop-blur-md rounded-full border border-primary/30">
            <span className="text-primary text-xl font-bold uppercase tracking-[0.3em]">
              {category.name}
            </span>
          </div>
        )}

        {/* Candidate Name */}
        <div className="text-center">
          <h2 className="text-7xl font-bold tracking-tight drop-shadow-2xl">
            {candidate.name}
          </h2>
          <p className="text-lg text-white/40 mt-2 uppercase tracking-widest">
            Candidate #{candidate.candidateNumber}
          </p>
        </div>

        {/* Scores Display Section */}
        {(presentation?.showScores ?? true) && scores.length > 0 && (
          <div className="grid grid-cols-3 gap-4 w-full max-w-2xl mt-4">
            {scores.map((s, i) => (
              <div
                key={s.judgeId || i}
                className="flex flex-col items-center p-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md shadow-lg"
                style={{
                  animation: `fadeInFromTop 500ms cubic-bezier(.2,.8,.2,1) ${i * 120}ms forwards`,
                  opacity: 0,
                }}
              >
                <span className="text-[10px] text-white/60 uppercase tracking-wider mb-1 font-semibold truncate max-w-full">
                  Judge {i + 1}
                </span>
                <span className="text-3xl font-bold font-mono text-amber-400">
                  <ScoreDisplay
                    target={s.value}
                    duration={1500}
                    suffix="%"
                    showRandomPhase={false}
                  />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom branding */}
      <div className="absolute bottom-8 left-8 text-white/20 text-xs font-mono">
        LIVE SCOREBOARD
      </div>
    </div>
  );
}
