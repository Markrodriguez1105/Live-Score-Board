import React from "react";

interface CategoryBadgeProps {
  name: string;
  weight?: number;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({
  name,
  weight,
  isActive = false,
  onClick,
  className = "",
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`
      inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold
      uppercase tracking-wider transition-all duration-200
      ${isActive
        ? "bg-amber-400 text-gray-900 shadow-lg shadow-amber-400/20"
        : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white"
      }
      ${onClick ? "cursor-pointer" : "cursor-default"}
      ${className}
    `}
  >
    {name}
    {weight !== undefined && (
      <span
        className={`text-[10px] font-mono ${
          isActive ? "text-gray-900/60" : "text-white/40"
        }`}
      >
        {weight}%
      </span>
    )}
  </button>
);
