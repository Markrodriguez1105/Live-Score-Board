import React, { useEffect, useRef, useState } from "react";
import type { Candidate } from "../types";

// Small animated number component: counts from 0 to target on mount/when target changes
const AnimatedNumber: React.FC<{
  target: number;
  duration?: number;
  className?: string;
}> = ({ target, duration = 3000, className = "" }) => {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const [pulse, setPulse] = useState(false);
  const pulseTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startRef.current = null;
    // Show random high numbers first (80-100) for a portion of the duration,
    // then settle smoothly to the real target for the remaining time.
    const randomPhaseRatio = 0.7; // 70% time showing randoms
    const randomPhaseDuration = duration * randomPhaseRatio;
    const settleDuration = Math.max(1, duration - randomPhaseDuration);
    let lastRandom = 90;
    let settleStartValue: number | null = null;
    // random tick will accelerate -> decelerate: start fast, end slow
    const randomTickMin = 80; // start updating very fast (ms)
    const randomTickMax = 500; // end updating slowly (ms)
    const lastRandomTimeRef = { current: 0 } as { current: number };
    const randomTargetRef = { current: lastRandom } as { current: number };
    const randomStartRef = { current: lastRandom } as { current: number };
    const tickStartRef = { current: 0 } as { current: number };

    const start = (t: number) => {
      if (!startRef.current) startRef.current = t;
      const elapsed = t - startRef.current;

      if (elapsed < randomPhaseDuration) {
        // Random phase: show random high numbers (80-100)
        // Tick interval interpolates from randomTickMin -> randomTickMax over the phase
        const phaseProgress = Math.min(elapsed / randomPhaseDuration, 1);
        const tickInterval = Math.round(
          randomTickMin + (randomTickMax - randomTickMin) * phaseProgress,
        );

        // time to start a new random tick
        if (
          !lastRandomTimeRef.current ||
          t - lastRandomTimeRef.current >= tickInterval
        ) {
          const nextRandom = Math.floor(80 + Math.random() * 20); // 80..99
          lastRandomTimeRef.current = t;
          // set up interpolation from previous target -> new target over tickInterval
          randomStartRef.current = randomTargetRef.current;
          randomTargetRef.current = nextRandom;
          tickStartRef.current = t;
          // pulse visual feedback on each new random value
          setPulse(true);
          if (pulseTimeoutRef.current)
            window.clearTimeout(pulseTimeoutRef.current);
          pulseTimeoutRef.current = window.setTimeout(
            () => setPulse(false),
            240,
          ) as any;
        }

        // interpolate between randomStart -> randomTarget for smooth numeric transition
        const sinceTick = t - tickStartRef.current;
        const innerProgress = tickStartRef.current
          ? Math.min(sinceTick / Math.max(1, tickInterval), 1)
          : 1;
        const easedInner = 1 - Math.pow(1 - innerProgress, 3);
        const interp = Math.round(
          randomStartRef.current +
          easedInner * (randomTargetRef.current - randomStartRef.current),
        );
        setValue(interp);
        rafRef.current = requestAnimationFrame(start);
        return;
      }

      // Settle phase: smoothly move from lastRandom to target
      if (settleStartValue === null) {
        settleStartValue = lastRandom;
      }
      const settleElapsed = Math.min(
        elapsed - randomPhaseDuration,
        settleDuration,
      );
      const progress =
        settleDuration <= 0 ? 1 : Math.min(settleElapsed / settleDuration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const v = Math.round(
        settleStartValue + eased * (target - settleStartValue),
      );
      setValue(v);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(start);
      } else {
        setValue(Math.round(target));
        setPulse(true);
        if (pulseTimeoutRef.current)
          window.clearTimeout(pulseTimeoutRef.current);
        pulseTimeoutRef.current = window.setTimeout(
          () => setPulse(false),
          260,
        ) as any;
      }
    };
    rafRef.current = requestAnimationFrame(start);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (pulseTimeoutRef.current) window.clearTimeout(pulseTimeoutRef.current);
    };
  }, [target, duration]);

  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        transform: pulse ? "scale(1.08)" : "scale(1)",
        transition: "transform 180ms ease",
      }}
    >
      {value}
    </span>
  );
};

// Helper to generate fallback avatar URL
const getFallbackAvatarUrl = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=512`;

interface SpotlightProps {
  candidate: Candidate;
  onNext: () => void;
  onPrev: () => void;
  currentIndex: number;
  totalCandidates: number;
  controlsVisible?: boolean;
  activeCategory?: string;
  showJudgeScores?: boolean;
}

export const Spotlight: React.FC<SpotlightProps> = ({
  candidate,
  onNext,
  onPrev,
  currentIndex,
  totalCandidates,
  controlsVisible = true,
  activeCategory,
  showJudgeScores = true,
}) => {
  const [displayScore, setDisplayScore] = useState(0);
  // Start with fallback URL, then switch to local image if it loads successfully
  const [imageUrl, setImageUrl] = useState(
    getFallbackAvatarUrl(candidate.name),
  );
  const requestRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number | undefined>(undefined);
  const startValueRef = useRef<number>(0);
  const endValueRef = useRef<number>(candidate.totalPercentage);

  // Check if image exists and use it, otherwise keep fallback
  useEffect(() => {
    // Always start with the fallback
    setImageUrl(getFallbackAvatarUrl(candidate.name));

    // Try to load the local image
    const img = new Image();
    img.onload = () => setImageUrl(candidate.photoUrl);
    // onerror: keep the fallback (already set above)
    img.src = candidate.photoUrl;
  }, [candidate.photoUrl, candidate.name]);

  // Animate Score
  useEffect(() => {
    startValueRef.current = displayScore;
    endValueRef.current = candidate.totalPercentage;
    startTimeRef.current = undefined;

    const animate = (time: number) => {
      if (startTimeRef.current === undefined) {
        startTimeRef.current = time;
      }
      // Faster counter animation when scores change (clicks feel snappy)
      const progress = Math.min((time - startTimeRef.current) / 300, 1); // 300ms duration
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
      {/* Mobile: full image without mask so it doesn't go black */}
      <div
        className="block md:hidden absolute inset-0 bg-no-repeat transition-all duration-500 ease-in-out"
        style={{
          backgroundImage: `url("${imageUrl}")`,
          backgroundSize: "cover",
          backgroundPosition: "top center",
        }}
      />

      {/* Desktop / md+: masked image with gradient fade */}
      <div
        className="hidden md:block absolute inset-0 bg-no-repeat transition-all right-100 duration-500 ease-in-out"
        style={{
          backgroundImage: `url("${imageUrl}")`,
          backgroundSize: "cover",
          // Position image toward the top so faces are visible
          backgroundPosition: "top center",
          maskImage:
            "linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)",
        }}
      />

      {/* Gradient Overlay - Adaptive (hidden on mobile) */}
      <div className="hidden md:block absolute inset-0 bg-linear-to-t md:bg-linear-to-r from-black/80 via-black/40 to-transparent md:from-transparent md:via-black/40 md:to-black/90" />

      {/* Circular overlay image centered-left (larger) */}
      {/* <div className="absolute z-30 left-1/2 md:left-[30%] top-1/4 md:top-[50%] -translate-x-1/2 -translate-y-1/2">
        <div className="w-28 h-28 md:w-200 md:h-200 rounded-full overflow-hidden border-4 border-white/10 shadow-2xl bg-gray-800">
          <img
            src={imageUrl}
            alt={candidate.name}
            className="w-full h-full object-cover object-top"
          />
        </div>
      </div> */}

      {/* Content Container - Bottom on Mobile, Right on Desktop */}
      <div className="absolute inset-x-0 bottom-0 md:inset-y-0 md:right-0 md:left-auto h-2/3 md:h-full md:w-1/2 flex flex-col justify-end md:justify-center items-center px-6 md:px-12 z-10 space-y-4 md:space-y-8 pb-20 md:pb-0">
        {/* Active Category Banner */}
        {activeCategory && (
          <div className="flex justify-center md:pb-9">
            <div className="px-6 py-2 md:px-8 md:py-3 bg-black/60 backdrop-blur-md rounded-full border border-pageant-gold/30">
              <span className="text-pageant-gold text-sm md:text-xl font-bold uppercase tracking-[0.2em] md:tracking-[0.3em]">
                {activeCategory}
              </span>
            </div>
          </div>
        )}
        <div className="text-center space-y-2 animate-fade-in-up">
          {candidate.category && (
            <div className="text-lg md:text-2xl text-pageant-gold/80 uppercase tracking-widest font-semibold mb-1 md:mb-2">
              {candidate.category}
            </div>
          )}
          <h2 className="text-4xl md:text-7xl font-bold tracking-tight drop-shadow-2xl text-white">
            {candidate.name}
          </h2>
        </div>

        {/* Scores Grid */}
        {showJudgeScores && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 w-full max-w-2xl mt-4 md:mt-8">
            {candidate.scores.map((score, i) => (
              <div
                key={i}
                className="judge-card flex flex-col items-center p-3 md:p-6 rounded-xl md:rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl"
                style={{
                  animationName: "fadeInFromTop",
                  // slightly slower reveal so cards appear gracefully one-by-one
                  animationDuration: "700ms",
                  animationTimingFunction: "cubic-bezier(.2,.8,.2,1)",
                  animationDelay: `${i * 160}ms`,
                  animationFillMode: "forwards",
                }}
              >
                <span className="text-[10px] md:text-xs text-pageant-gold uppercase tracking-widest mb-1 md:mb-2 font-bold">
                  Judge {i + 1}
                </span>
                <span className="text-3xl md:text-6xl font-bold font-mono text-white flex items-baseline">
                  <AnimatedNumber
                    target={Math.round(score)}
                    duration={2000}
                    className="leading-none"
                  />
                  <span className="text-pageant-gold text-2xl md:text-5xl ml-1 md:ml-2">
                    %
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
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
