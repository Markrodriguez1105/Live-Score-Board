import React from "react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

const sizeClasses = {
  sm: "h-5 w-5 border-2",
  md: "h-8 w-8 border-[3px]",
  lg: "h-12 w-12 border-4",
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "md",
  label,
  className = "",
}) => (
  <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
    <div
      className={`${sizeClasses[size]} rounded-full border-indigo-500 border-t-transparent animate-spin`}
    />
    {label && (
      <p className="text-sm text-white/50 animate-pulse">{label}</p>
    )}
  </div>
);
