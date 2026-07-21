import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { ArrowLeft, Radio, Eye, EyeOff, ChevronRight, Clapperboard, Layers } from "lucide-react";
import type { Candidate, Category, PresentationState, SegmentWithCategories } from "@pageant/types";

const API_BASE = "/api";
const SOCKET_URL = window.location.origin;

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  color?: "emerald" | "amber" | "purple" | "rose";
}

function ToggleSwitch({ checked, onChange, color = "emerald" }: ToggleSwitchProps) {
  const activeBg = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    purple: "bg-purple-600",
    rose: "bg-rose-500",
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
  const [segments, setSegments] = useState<SegmentWithCategories[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [presentation, setPresentation] = useState<PresentationState | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);
    newSocket.on("presentation:update", (state: PresentationState) => {
      if (state.pageantId === id) setPresentation(state);
    });
    newSocket.on("segment:lock-update", (payload) => {
      setSegments((prev) =>
        prev.map((s) => (s.id === payload.segmentId ? { ...s, isLocked: payload.isLocked, isHidden: payload.isLocked } : s))
      );
    });
    newSocket.on("segment:hide-update", (payload) => {
      setSegments((prev) =>
        prev.map((s) => (s.id === payload.segmentId ? { ...s, isHidden: payload.isHidden, isLocked: payload.isHidden } : s))
      );
    });
    newSocket.on("category:candidates-update", () => fetchData());
    return () => {
      newSocket.close();
    };
  }, [id]);

  const fetchData = async () => {
    const [segRes, presRes] = await Promise.all([
      fetch(`${API_BASE}/pageants/${id}/segments`, { credentials: "include" }),
      fetch(`${API_BASE}/pageants/${id}/presentation`, { credentials: "include" }),
    ]);
    const [segData, presData] = await Promise.all([
      segRes.json(),
      presRes.json(),
    ]);
    if (segData.success) {
      setSegments(segData.data);
      // Auto-select first segment if none selected
      if (segData.data.length > 0 && !activeSegmentId) {
        const initialSegId = presData.data?.activeSegmentId || segData.data[0].id;
        setActiveSegmentId(initialSegId);
      }
    }
    if (presData.success) {
      setPresentation(presData.data);
      if (presData.data?.activeSegmentId) {
        setActiveSegmentId(presData.data.activeSegmentId);
      }
    }
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

  const handleSegmentSelect = (segId: string) => {
    setActiveSegmentId(segId);
    updatePresentation({ activeSegmentId: segId, activeCategoryId: null, activeCandidateId: null });
  };

  // Derive data from selected segment
  const selectedSegment = segments.find((s) => s.id === activeSegmentId);
  const categories: Category[] = selectedSegment?.categories || [];

  const isSegmentHidden = selectedSegment?.isHidden ?? selectedSegment?.isLocked ?? false;

  const toggleSegmentHide = async () => {
    if (!selectedSegment) return;
    const newHideState = !isSegmentHidden;

    await fetch(`${API_BASE}/segments/${selectedSegment.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ isHidden: newHideState, isLocked: newHideState }),
    });

    setSegments((prev) =>
      prev.map((s) => (s.id === selectedSegment.id ? { ...s, isHidden: newHideState, isLocked: newHideState } : s))
    );

    socket?.emit("admin:toggle-segment-hide", {
      segmentId: selectedSegment.id,
      isHidden: newHideState,
    });
  };

  // Get candidates for the active category from the segment data
  const activeCategory = selectedSegment?.categories.find((c) => c.id === presentation?.activeCategoryId);
  const candidates: Candidate[] = activeCategory?.candidates || [];

  const activeCandidate = candidates.find((c) => c.id === presentation?.activeCandidateId);

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
            {isSegmentHidden && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold font-mono tracking-wider">
                <EyeOff className="w-3 h-3" />
                HIDDEN
              </div>
            )}
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
        {/* Segment Selector */}
        {segments.length > 0 && (
          <div>
            <h2 className="text-[11px] font-mono font-bold tracking-widest text-muted-foreground uppercase mb-3">
              ACTIVE SEGMENT
            </h2>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {segments.map((seg) => {
                const isActive = activeSegmentId === seg.id;
                const segHidden = seg.isHidden || seg.isLocked;

                return (
                  <button
                    key={seg.id}
                    onClick={() => handleSegmentSelect(seg.id)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${isActive
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "bg-card text-muted-foreground border border-border hover:bg-muted hover:text-foreground"
                      }`}
                  >
                    <Layers className="w-4 h-4" />
                    {seg.name}
                    {segHidden && <EyeOff className="w-3.5 h-3.5 text-amber-400 ml-1 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          {/* Control 3: Hide/Unhide Segment */}
          <div className="bg-[#15171e] border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3.5">
              <div
                className={`p-3 rounded-xl border ${isSegmentHidden
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  }`}
              >
                {isSegmentHidden ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Segment Visibility</h3>
                <p className="text-[10px] font-mono font-medium tracking-wider text-muted-foreground uppercase mt-0.5">
                  {isSegmentHidden ? "HIDDEN FROM JUDGES" : "VISIBLE TO JUDGES"}
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={!isSegmentHidden}
              onChange={toggleSegmentHide}
              color="emerald"
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
                {categories.length === 0 && (
                  <p className="text-xs text-muted-foreground/50 italic py-2">
                    {segments.length === 0 ? "No segments created yet" : "No categories in this segment"}
                  </p>
                )}
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
                <p className="text-xs text-muted-foreground italic py-2">
                  {activeCategory ? "Select a candidate below" : "Select a category first"}
                </p>
              )}
            </div>
          </div>

          {/* Right Area: Candidate Selector */}
          <div className="lg:col-span-9">
            <h2 className="text-[11px] font-mono font-bold tracking-widest text-muted-foreground uppercase mb-3">
              {activeCategory
                ? `CANDIDATES IN "${activeCategory.name.toUpperCase()}" — TAP TO PUT ON STAGE`
                : "CANDIDATE SELECTOR — SELECT A CATEGORY FIRST"}
            </h2>

            {activeCategory && candidates.length === 0 && (
              <div className="text-center py-12 text-muted-foreground/50 text-sm">
                No candidates assigned to this category yet
              </div>
            )}

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

            {!activeCategory && (
              <div className="text-center py-12 text-muted-foreground/50 text-sm">
                Select a category to see assigned candidates
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
