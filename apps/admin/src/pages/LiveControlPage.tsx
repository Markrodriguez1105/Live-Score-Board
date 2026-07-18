import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import type { Candidate, Category, PresentationState } from "@pageant/types";

const API_BASE = "/api";
const SOCKET_URL = window.location.origin;

export function LiveControlPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [presentation, setPresentation] = useState<PresentationState | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);
    newSocket.on("presentation:update", (state: PresentationState) => {
      if (state.pageantId === id) setPresentation(state);
    });
    return () => { newSocket.close(); };
  }, [id]);

  const fetchData = async () => {
    const [candRes, catRes, presRes] = await Promise.all([
      fetch(`${API_BASE}/pageants/${id}/candidates`, { credentials: "include" }),
      fetch(`${API_BASE}/pageants/${id}/categories`, { credentials: "include" }),
      fetch(`${API_BASE}/pageants/${id}/presentation`, { credentials: "include" }),
    ]);
    const [candData, catData, presData] = await Promise.all([candRes.json(), catRes.json(), presRes.json()]);
    if (candData.success) setCandidates(candData.data);
    if (catData.success) setCategories(catData.data);
    if (presData.success) setPresentation(presData.data);
  };

  useEffect(() => { fetchData(); }, [id]);

  const updatePresentation = async (updates: Partial<PresentationState>) => {
    await fetch(`${API_BASE}/pageants/${id}/presentation`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(updates),
    });
    // Also broadcast via socket
    socket?.emit("admin:set-presentation", { ...updates, pageantId: id });
  };

  const activeCandidate = candidates.find((c) => c.id === presentation?.activeCandidateId);
  const activeCategory = categories.find((c) => c.id === presentation?.activeCategoryId);

  const getFallback = (name: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=128`;

  return (
    <div className="min-h-screen bg-surface-primary">
      <header className="border-b border-border-subtle bg-surface-secondary/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/pageants/${id}`)} className="text-white/40 hover:text-white">← Back</button>
            <h1 className="text-lg font-bold text-white">🎬 Live Control</h1>
          </div>
          <div className="flex items-center gap-2">
            {presentation?.isIdle ? (
              <div className="flex items-center gap-2 text-amber-400 text-sm">
                <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse" />
                IDLE
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
                LIVE
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6 animate-fade-in-up">
        {/* Control Bar */}
        <div className="bg-surface-secondary border border-border-subtle rounded-2xl p-5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => updatePresentation({ isIdle: !presentation?.isIdle })}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                presentation?.isIdle
                  ? "bg-green-600 hover:bg-green-500 text-white"
                  : "bg-amber-600 hover:bg-amber-500 text-white"
              }`}
            >
              {presentation?.isIdle ? "▶ Go Live" : "⏸ Set Idle"}
            </button>

            <button
              onClick={() => updatePresentation({ showScores: !presentation?.showScores })}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all border ${
                presentation?.showScores
                  ? "bg-pageant-gold text-black border-pageant-gold"
                  : "bg-transparent border-white/20 text-white/60 hover:text-white hover:border-white/40"
              }`}
            >
              {presentation?.showScores ? "🙈 Hide Scores" : "👁 Reveal Scores"}
            </button>

            <button
              onClick={() => updatePresentation({ showJudgeBreakdown: !presentation?.showJudgeBreakdown })}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all border ${
                presentation?.showJudgeBreakdown
                  ? "bg-pageant-purple text-white border-pageant-purple"
                  : "bg-transparent border-white/20 text-white/60 hover:text-white hover:border-white/40"
              }`}
            >
              {presentation?.showJudgeBreakdown ? "Hide Judge Details" : "Show Judge Details"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Category Selector */}
          <div className="bg-surface-secondary border border-border-subtle rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-3">Active Category</h3>
            <div className="space-y-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => updatePresentation({ activeCategoryId: cat.id })}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all ${
                    presentation?.activeCategoryId === cat.id
                      ? "bg-pageant-purple text-white font-bold"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  {cat.name}
                  <span className="text-xs opacity-50 ml-2">{cat.weight}%</span>
                </button>
              ))}
            </div>
          </div>

          {/* Candidate Selector */}
          <div className="lg:col-span-2 bg-surface-secondary border border-border-subtle rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-3">
              Select Candidate to Display
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[500px] overflow-y-auto">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  onClick={() => updatePresentation({ activeCandidateId: c.id, isIdle: false })}
                  className={`relative p-3 rounded-xl text-center transition-all ${
                    presentation?.activeCandidateId === c.id
                      ? "bg-pageant-purple/20 border-2 border-pageant-purple shadow-lg"
                      : "bg-white/5 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  <img
                    src={c.photoUrl || getFallback(c.name)}
                    alt={c.name}
                    className="w-14 h-14 rounded-full object-cover mx-auto mb-2 ring-2 ring-white/10"
                  />
                  <p className="text-xs font-semibold text-white truncate">{c.name}</p>
                  <p className="text-[10px] text-white/30">#{c.candidateNumber}</p>
                  {presentation?.activeCandidateId === c.id && (
                    <div className="absolute top-1.5 right-1.5 w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Current State Preview */}
        {activeCandidate && (
          <div className="bg-surface-secondary border border-pageant-purple/20 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-3">Currently Displaying</h3>
            <div className="flex items-center gap-4">
              <img src={activeCandidate.photoUrl || getFallback(activeCandidate.name)} alt="" className="w-16 h-16 rounded-full object-cover ring-2 ring-pageant-gold" />
              <div>
                <h2 className="text-xl font-bold text-white">{activeCandidate.name}</h2>
                <p className="text-sm text-white/40">
                  Candidate #{activeCandidate.candidateNumber}
                  {activeCategory && <span> · {activeCategory.name}</span>}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-400 text-sm font-bold uppercase tracking-wider">Live</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
