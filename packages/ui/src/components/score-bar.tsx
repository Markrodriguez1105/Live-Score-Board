import React from "react";

interface ScoreBarProps {
  value: number;
  min: number;
  max: number;
  label?: string;
  className?: string;
}

export const ScoreBar: React.FC<ScoreBarProps> = ({
  value,
  min,
  max,
  label,
  className = "",
}) => {
  const percentage = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs font-medium text-white/60">{label}</span>
          <span className="text-xs font-mono font-bold text-amber-400">
            {value}/{max}
          </span>
        </div>
      )}
      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${Math.min(100, Math.max(0, percentage))}%`,
            background:
              percentage > 80
                ? "linear-gradient(90deg, #22c55e, #4ade80)"
                : percentage > 50
                ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                : "linear-gradient(90deg, #6366f1, #818cf8)",
          }}
        />
      </div>
    </div>
  );
};
