import React, { useEffect, useRef, useState } from "react";

interface ScoreDisplayProps {
  target: number;
  duration?: number;
  suffix?: string;
  className?: string;
  showRandomPhase?: boolean;
}

/**
 * Animated score counter with an optional random-number phase
 * that builds suspense before settling on the final value.
 */
export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  target,
  duration = 3000,
  suffix = "%",
  className = "",
  showRandomPhase = true,
}) => {
  const [value, setValue] = useState(0);
  const [pulse, setPulse] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startRef.current = null;

    const randomPhaseDuration = showRandomPhase ? duration * 0.7 : 0;
    const settleDuration = Math.max(1, duration - randomPhaseDuration);
    let settleStartValue: number | null = null;
    let lastRandomTime = 0;
    let randomTarget = 90;

    const animate = (t: number) => {
      if (!startRef.current) startRef.current = t;
      const elapsed = t - startRef.current;

      if (elapsed < randomPhaseDuration) {
        // Random phase
        const phaseProgress = Math.min(elapsed / randomPhaseDuration, 1);
        const tickInterval = Math.round(80 + 420 * phaseProgress);

        if (!lastRandomTime || t - lastRandomTime >= tickInterval) {
          randomTarget = Math.floor(80 + Math.random() * 20);
          lastRandomTime = t;
          setPulse(true);
          if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
          pulseTimeoutRef.current = setTimeout(() => setPulse(false), 240);
        }

        setValue(randomTarget);
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      // Settle phase
      if (settleStartValue === null) settleStartValue = randomTarget;
      const settleElapsed = Math.min(elapsed - randomPhaseDuration, settleDuration);
      const progress = settleDuration <= 0 ? 1 : Math.min(settleElapsed / settleDuration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const v = Math.round(settleStartValue + eased * (target - settleStartValue));
      setValue(v);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setValue(Math.round(target));
        setPulse(true);
        if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
        pulseTimeoutRef.current = setTimeout(() => setPulse(false), 260);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
    };
  }, [target, duration, showRandomPhase]);

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
      {suffix && <span className="text-amber-400 ml-0.5">{suffix}</span>}
    </span>
  );
};
