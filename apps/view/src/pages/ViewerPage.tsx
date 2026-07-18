import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { IdleScreen, ScoreDisplay } from "@pageant/ui";
import type { PresentationState, Candidate, Pageant, Category, CategoryWithCriteria } from "@pageant/types";

const API_BASE = "/api";
const SOCKET_URL = window.location.origin;

const getFallback = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=512`;

export function ViewerPage() {
  const [presentation, setPresentation] = useState<PresentationState | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [pageant, setPageant] = useState<Pageant | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [scores, setScores] = useState<{ judgeId?: string; judgeName: string; value: number | null }[]>([]);
  const [imageUrl, setImageUrl] = useState("");

  const [categories, setCategories] = useState<CategoryWithCriteria[]>([]);
  const categoriesRef = useRef<CategoryWithCriteria[]>([]);

  const [judges, setJudges] = useState<any[]>([]);
  const judgesRef = useRef<any[]>([]);

  useEffect(() => {
    judgesRef.current = judges;
  }, [judges]);

  const activeCandidateIdRef = useRef<string | null>(null);
  const activeCategoryIdRef = useRef<string | null>(null);

  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

  useEffect(() => {
    activeCandidateIdRef.current = presentation?.activeCandidateId || null;
    activeCategoryIdRef.current = presentation?.activeCategoryId || null;
  }, [presentation?.activeCandidateId, presentation?.activeCategoryId]);

  const handlePresentationUpdate = async (state: PresentationState) => {
    setPresentation(state);

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

  const fetchScores = async (candidateId: string, categoryId: string) => {
    try {
      const res = await fetch(`${API_BASE}/scores/candidate/${candidateId}/category/${categoryId}`);
      const data = await res.json();
      if (data.success) {
        let currentCategories = categoriesRef.current;
        if (currentCategories.length === 0 && presentation?.pageantId) {
          const catRes = await fetch(`${API_BASE}/pageants/${presentation.pageantId}/categories`);
          const catData = await catRes.json();
          if (catData.success) {
            currentCategories = catData.data;
            setCategories(catData.data);
          }
        }

        const cat = currentCategories.find((c) => c.id === categoryId);
        const criteriaList = cat?.criteria || [];

        const scoresByJudge: Record<string, { judgeName: string; totalWeighted: number; totalWeight: number }> = {};

        data.data.forEach((s: any) => {
          const crit = criteriaList.find((c) => c.id === s.criteriaId);
          if (!crit) return;

          if (!scoresByJudge[s.judgeId]) {
            scoresByJudge[s.judgeId] = {
              judgeName: s.judgeName || `Judge`,
              totalWeighted: 0,
              totalWeight: 0,
            };
          }

          const pct = (Number(s.value) / crit.maxScore) * 100;
          const weighted = pct * (crit.weight / 100);

          scoresByJudge[s.judgeId].totalWeighted += weighted;
          scoresByJudge[s.judgeId].totalWeight += crit.weight;
        });

        // Sort judges by ID to keep the mapping consistent
        const sortedJudges = [...judgesRef.current].sort((a, b) => a.id.localeCompare(b.id));

        const judgeResults = sortedJudges.map((j, idx) => {
          const scoreObj = scoresByJudge[j.id];
          const value = scoreObj
            ? (scoreObj.totalWeight > 0 ? (scoreObj.totalWeighted / (scoreObj.totalWeight / 100)) : 0)
            : null;

          return {
            judgeId: j.id,
            judgeName: `Judge ${idx + 1}`,
            value,
          };
        });

        setScores(judgeResults);
      }
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
          if (d.data.pageantName) {
            setPageant({
              id: d.data.pageantId,
              name: d.data.pageantName,
              logoUrl: d.data.pageantLogoUrl,
              description: "",
              date: "",
              venue: "",
              status: "active",
              createdAt: "",
              updatedAt: "",
            });

            fetch(`${API_BASE}/pageants/${d.data.pageantId}/results`)
              .then((r) => r.json())
              .then((resData) => {
                if (resData.success) {
                  setJudges(resData.data.judges);
                  judgesRef.current = resData.data.judges;
                  setCategories(resData.data.categories);
                  if (d.data.activeCategoryId) {
                    const cat = resData.data.categories.find((c: any) => c.id === d.data.activeCategoryId);
                    if (cat) setCategory(cat);
                  }
                  if (d.data.activeCandidateId && d.data.activeCategoryId) {
                    fetchScores(d.data.activeCandidateId, d.data.activeCategoryId);
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
      const cat = categoriesRef.current.find((c) => c.id === state.activeCategoryId);
      if (cat) setCategory(cat);
    });

    socket.on("scores:update", () => {
      if (activeCandidateIdRef.current && activeCategoryIdRef.current) {
        fetchScores(activeCandidateIdRef.current, activeCategoryIdRef.current);
      }
    });

    return () => { socket.close(); };
  }, []);

  // Fetch scores when candidate/category changes or scores are shown
  useEffect(() => {
    if (presentation?.activeCandidateId && presentation?.activeCategoryId && (presentation?.showScores || presentation?.showJudgeBreakdown)) {
      fetchScores(presentation.activeCandidateId, presentation.activeCategoryId);
    }
  }, [presentation?.activeCandidateId, presentation?.activeCategoryId, presentation?.showScores, presentation?.showJudgeBreakdown]);

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
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/40 to-black/90" />

      {/* Content */}
      <div className="absolute inset-y-0 right-0 w-1/2 flex flex-col justify-center items-center px-12 z-10 space-y-8 animate-fade-in-up">
        {/* Category Badge */}
        {category && (
          <div className="px-8 py-3 bg-black/60 backdrop-blur-md rounded-full border border-pageant-gold/30">
            <span className="text-pageant-gold text-xl font-bold uppercase tracking-[0.3em]">
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

        {/* Scores */}
        {presentation.showScores && scores.length > 0 && (
          <div className="grid grid-cols-3 gap-4 w-full max-w-2xl mt-4 animate-fade-in-up">
            {scores.map((s, i) => (
              <div
                key={s.judgeId || i}
                className="flex flex-col items-center p-4 rounded-xl border border-white/5 bg-white/5 backdrop-blur-md shadow-lg"
                style={{
                  animation: `fadeInFromTop 500ms cubic-bezier(.2,.8,.2,1) ${i * 120}ms forwards`,
                  opacity: 0,
                }}
              >
                <span className="text-[10px] text-white/50 uppercase tracking-wider mb-1 font-semibold truncate max-w-full">
                  {s.judgeName}
                </span>
                <span className="text-3xl font-bold font-mono text-amber-400">
                  {s.value !== null ? (
                    <ScoreDisplay
                      target={s.value}
                      duration={1500}
                      suffix="%"
                      showRandomPhase={false}
                    />
                  ) : (
                    <span className="leading-none text-white/20">-%</span>
                  )}
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
