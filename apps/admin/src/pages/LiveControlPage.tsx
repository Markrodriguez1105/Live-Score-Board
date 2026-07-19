import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { ArrowLeft, Radio, Eye, ChevronRight, Clapperboard } from "lucide-react";
import type { Candidate, Category, PresentationState } from "@pageant/types";
import { toast } from "sonner";

const API_BASE = "/api";
const SOCKET_URL = window.location.origin;

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  color?: "emerald" | "amber" | "purple";
}

function ToggleSwitch({ checked, onChange, color = "emerald" }: ToggleSwitchProps) {
  const activeBg = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    purple: "bg-purple-600",
  }[color];

  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? activeBg : "bg-muted/60 hover:bg-muted"
        }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${checked ? "translate-x-5" : "translate-x-0"
          }`}
      />
    </button>
  );
}

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
    return () => {
      newSocket.close();
    };
  }, [id]);

  const fetchData = async () => {
    const [candRes, catRes, presRes] = await Promise.all([
      fetch(`${API_BASE}/pageants/${id}/candidates`, { credentials: "include" }),
      fetch(`${API_BASE}/pageants/${id}/categories`, { credentials: "include" }),
      fetch(`${API_BASE}/pageants/${id}/presentation`, { credentials: "include" }),
    ]);
    const [candData, catData, presData] = await Promise.all([
      candRes.json(),
      catRes.json(),
      presRes.json(),
    ]);
    if (candData.success) setCandidates(candData.data);
    if (catData.success) setCategories(catData.data);
    if (presData.success) setPresentation(presData.data);
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const updatePresentation = async (updates: Partial<PresentationState>) => {
    await fetch(`${API_BASE}/pageants/${id}/presentation`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(updates),
    });
    socket?.emit("admin:set-presentation", { ...updates, pageantId: id });
  };

  const activeCandidate = candidates.find((c) => c.id === presentation?.activeCandidateId);
  const activeCategory = categories.find((c) => c.id === presentation?.activeCategoryId);

  const getFallback = (name: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=256&bold=true`;

  const isIdle = presentation?.isIdle ?? false;
  const showScores = presentation?.showScores ?? true;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky Header matching Candidates / Judges pages */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/pageants/${id}`)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Clapperboard className="w-5 h-5 text-primary" /> Live Control
            </h1>
          </div>

          {/* Live Status Badge */}
          <div className="flex items-center gap-2">
            {!isIdle ? (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold font-mono tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                LIVE
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold font-mono tracking-wider">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                IDLE
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Top Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Control 1: Set Idle */}
          <div className="bg-[#15171e] border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3.5">
              <div
                className={`p-3 rounded-xl border ${!isIdle
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  }`}
              >
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Set Idle</h3>
                <p className="text-[10px] font-mono font-medium tracking-wider text-muted-foreground uppercase mt-0.5">
                  {!isIdle ? "BROADCASTING" : "IDLE MODE"}
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={!isIdle}
              onChange={() => updatePresentation({ isIdle: !isIdle })}
              color="emerald"
            />
          </div>

          {/* Control 2: Reveal Scores */}
          <div className="bg-[#15171e] border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3.5">
              <div
                className={`p-3 rounded-xl border ${showScores
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-white/5 text-muted-foreground border-white/10"
                  }`}
              >
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Reveal Scores</h3>
                <p className="text-[10px] font-mono font-medium tracking-wider text-muted-foreground uppercase mt-0.5">
                  {showScores ? "SCORES SHOWN" : "RESULTS HIDDEN"}
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={showScores}
              onChange={() => updatePresentation({ showScores: !showScores })}
              color="amber"
            />
          </div>
        </div>

        {/* Main Grid Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Sidebar (Categories & On-Stage Preview) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Active Category Section */}
            <div>
              <h2 className="text-[11px] font-mono font-bold tracking-widest text-muted-foreground uppercase mb-3">
                ACTIVE CATEGORY
              </h2>
              <div className="space-y-2">
                {categories.map((cat) => {
                  const isActive = presentation?.activeCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => updatePresentation({ activeCategoryId: cat.id })}
                      className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group cursor-pointer ${isActive
                        ? "bg-indigo-950/40 border-indigo-500/50 shadow-lg shadow-indigo-500/10 text-white"
                        : "bg-[#15171e] border-white/5 text-muted-foreground hover:bg-white/5 hover:text-white"
                        }`}
                    >
                      <div>
                        <h4 className={`font-bold text-sm ${isActive ? "text-white" : "text-gray-300"}`}>
                          {cat.name}
                        </h4>
                        <p className={`text-xs mt-0.5 ${isActive ? "text-indigo-300" : "text-muted-foreground"}`}>
                          {cat.weight}% weight
                        </p>
                      </div>
                      {isActive && <ChevronRight className="w-4 h-4 text-indigo-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Now On Stage Card */}
            <div className="bg-[#15171e] border border-white/10 rounded-2xl p-4">
              <h2 className="text-[11px] font-mono font-bold tracking-widest text-muted-foreground uppercase mb-3">
                NOW ON STAGE
              </h2>
              {activeCandidate ? (
                <div className="flex items-center gap-3.5">
                  <div className="relative shrink-0">
                    <img
                      src={activeCandidate.photoUrl || getFallback(activeCandidate.name)}
                      alt={activeCandidate.name}
                      className="w-14 h-14 rounded-xl object-cover border border-emerald-500/40 shadow-md"
                    />
                    <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,1)] animate-pulse" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-white text-sm truncate">{activeCandidate.name}</h3>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
                      Candidate #{activeCandidate.candidateNumber}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic py-2">No candidate on stage</p>
              )}
            </div>
          </div>

          {/* Right Area: Candidate Selector */}
          <div className="lg:col-span-9">
            <h2 className="text-[11px] font-mono font-bold tracking-widest text-muted-foreground uppercase mb-3">
              CANDIDATE SELECTOR — TAP TO PUT ON STAGE
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {candidates.map((c) => {
                const isOnStage = presentation?.activeCandidateId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => updatePresentation({ activeCandidateId: c.id, isIdle: false })}
                    className={`group relative aspect-3/4 rounded-2xl overflow-hidden text-left transition-all duration-200 cursor-pointer border ${isOnStage
                      ? "ring-2 ring-emerald-500 border-emerald-400 shadow-2xl shadow-emerald-500/20 scale-[1.02]"
                      : "border-white/10 hover:border-white/30 hover:scale-[1.01]"
                      }`}
                  >
                    {/* Portrait Candidate Image */}
                    <img
                      src={c.photoUrl || getFallback(c.name)}
                      alt={c.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-linear-to-t from-black/95 via-black/30 to-transparent" />

                    {/* Active Indicator Dot on Stage */}
                    {isOnStage && (
                      <div className="absolute top-3 right-3 w-3 h-3 bg-emerald-400 rounded-full shadow-[0_0_12px_rgba(52,211,153,1)] animate-pulse" />
                    )}

                    {/* Bottom Candidate Info overlay */}
                    <div className="absolute bottom-3 left-3 right-3 space-y-0.5">
                      <p className={`text-[11px] font-mono font-bold ${isOnStage ? "text-emerald-400" : "text-amber-400"}`}>
                        #{String(c.candidateNumber).padStart(2, "0")}
                      </p>
                      <p className="text-sm font-bold text-white leading-tight truncate">{c.name}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
