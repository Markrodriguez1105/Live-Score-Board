import React, { useEffect, useRef, useState } from "react";
import type { Candidate } from "../types";

interface SpotlightProps {
  candidate: Candidate;
  onNext: () => void;
  onPrev: () => void;
  currentIndex: number;
  totalCandidates: number;
  controlsVisible?: boolean;
  activeCategory?: string;
}

export const Spotlight: React.FC<SpotlightProps> = ({
  candidate,
  onNext,
  onPrev,
  currentIndex,
  totalCandidates,
  controlsVisible = true,
  activeCategory,
}) => {
  const [displayScore, setDisplayScore] = useState(0);
  const requestRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number | undefined>(undefined);
  const startValueRef = useRef<number>(0);
  const endValueRef = useRef<number>(candidate.totalPercentage);

  // Animate Score
  useEffect(() => {
    startValueRef.current = displayScore;
    endValueRef.current = candidate.totalPercentage;
    startTimeRef.current = undefined;

    const animate = (time: number) => {
      if (startTimeRef.current === undefined) {
        startTimeRef.current = time;
      }
      const progress = Math.min((time - startTimeRef.current) / 800, 1); // 800ms duration
      const value =
        progress * (endValueRef.current - startValueRef.current) +
        startValueRef.current;

      setDisplayScore(value);

      if (progress < 1) {
        requestRef.current = requestAnimationFrame(animate);
      }
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [candidate.totalPercentage]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNext, onPrev]);

  return (
    <div className="spotlight-container relative w-full h-full overflow-hidden bg-black text-white">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-500 ease-in-out scale-105"
        style={{ backgroundImage: `url("${candidate.photoUrl}")` }}
      />

      {/* Gradient Overlay - Adaptive */}
      <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/80 via-black/40 to-transparent md:from-transparent md:via-black/40 md:to-black/90" />

      {/* Active Category Banner */}
      {activeCategory && (
        <div className="absolute top-0 left-0 right-0 z-20 flex justify-center pt-6 md:pt-8">
          <div className="px-6 py-2 md:px-8 md:py-3 bg-black/60 backdrop-blur-md rounded-full border border-pageant-gold/30">
            <span className="text-pageant-gold text-sm md:text-xl font-bold uppercase tracking-[0.2em] md:tracking-[0.3em]">
              {activeCategory}
            </span>
          </div>
        </div>
      )}

      {/* Content Container - Bottom on Mobile, Right on Desktop */}
      <div className="absolute inset-x-0 bottom-0 md:inset-y-0 md:right-0 md:left-auto h-2/3 md:h-full md:w-1/2 flex flex-col justify-end md:justify-center items-center px-6 md:px-12 z-10 space-y-4 md:space-y-8 pb-20 md:pb-0">
        <div className="text-center space-y-2 animate-fade-in-up">
          {candidate.category && (
            <div className="text-lg md:text-2xl text-pageant-gold/80 uppercase tracking-widest font-semibold mb-1 md:mb-2">
              {candidate.category}
            </div>
          )}
          <h2 className="text-4xl md:text-7xl font-bold tracking-tight drop-shadow-2xl text-white">
            {candidate.name}
          </h2>
          <p className="text-pageant-gold text-xl md:text-2xl tracking-[0.3em] md:tracking-[0.5em] uppercase font-light">
            Candidate
          </p>
        </div>

        {/* Scores Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 w-full max-w-2xl mt-4 md:mt-8">
          {candidate.scores.map((score, i) => (
            <div
              key={i}
              className="flex flex-col items-center p-3 md:p-6 rounded-xl md:rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl"
            >
              <span className="text-[10px] md:text-xs text-pageant-gold uppercase tracking-widest mb-1 md:mb-2 font-bold">
                Judge {i + 1}
              </span>
              <span className="text-3xl md:text-6xl font-bold font-mono text-white flex items-baseline">
                {score.toFixed(0)}
                <span className="text-pageant-gold text-2xl md:text-5xl ml-1 md:ml-2">
                  %
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Controls - Centered or Right aligned? Let's keep them bottom right inside the content area for consistency, or absolute bottom right of screen. */}
      {controlsVisible && (
        <div className="absolute bottom-8 right-12 flex space-x-4 z-50 opacity-50 hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous Candidate"
            className="p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md border border-white/20"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="self-center font-mono text-xs text-white/50">
            {currentIndex + 1} / {totalCandidates}
          </div>
          <button
            type="button"
            onClick={onNext}
            aria-label="Next Candidate"
            className="p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md border border-white/20"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      )}

      <div className="absolute bottom-8 left-8 text-white/30 text-xs font-mono">
        LIVE SCOREBOARD
      </div>
    </div>
  );
};
