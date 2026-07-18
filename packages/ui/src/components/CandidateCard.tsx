import React, { useState, useEffect } from "react";

interface CandidateCardProps {
  name: string;
  candidateNumber: number;
  photoUrl?: string;
  isActive?: boolean;
  onClick?: () => void;
  score?: number;
  className?: string;
}

const getFallbackAvatar = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=256&bold=true`;

export const CandidateCard: React.FC<CandidateCardProps> = ({
  name,
  candidateNumber,
  photoUrl,
  isActive = false,
  onClick,
  score,
  className = "",
}) => {
  const [imgSrc, setImgSrc] = useState(getFallbackAvatar(name));

  useEffect(() => {
    if (photoUrl) {
      const img = new Image();
      img.onload = () => setImgSrc(photoUrl);
      img.onerror = () => setImgSrc(getFallbackAvatar(name));
      img.src = photoUrl;
    } else {
      setImgSrc(getFallbackAvatar(name));
    }
  }, [photoUrl, name]);

  return (
    <div
      onClick={onClick}
      className={`
        relative flex items-center gap-3 p-3 rounded-xl cursor-pointer
        transition-all duration-200 ease-out
        ${isActive
          ? "bg-indigo-600/20 border-2 border-indigo-500 shadow-lg shadow-indigo-500/10"
          : "bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20"
        }
        ${className}
      `}
    >
      {/* Candidate Number Badge */}
      <div className="absolute -top-2 -left-2 w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md z-10">
        {candidateNumber}
      </div>

      {/* Photo */}
      <img
        src={imgSrc}
        alt={name}
        className="w-12 h-12 rounded-full object-cover ring-2 ring-white/10 flex-shrink-0"
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white truncate text-sm">{name}</p>
        <p className="text-xs text-white/40">Candidate #{candidateNumber}</p>
      </div>

      {/* Score Badge */}
      {score !== undefined && (
        <div className="text-right">
          <span className="text-lg font-bold text-amber-400 font-mono">
            {score.toFixed(1)}
          </span>
        </div>
      )}

      {/* Active Indicator */}
      {isActive && (
        <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50" />
      )}
    </div>
  );
};
