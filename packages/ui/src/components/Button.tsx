import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "gold";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button: React.FC<React.PropsWithChildren<ButtonProps>> = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  disabled,
  ...props
}) => {
  const baseStyles = "inline-flex items-center justify-center font-semibold rounded-xl transition-all select-none active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none";

  const variants = {
    primary: "bg-pageant-purple hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/10",
    secondary: "bg-surface-elevated hover:bg-white/10 text-white/90 border border-white/5",
    outline: "bg-transparent border border-white/10 hover:bg-white/5 text-white/80",
    ghost: "bg-transparent hover:bg-white/5 text-white/70 hover:text-white",
    danger: "bg-red-500/15 border border-red-500/20 hover:bg-red-500/25 text-red-400 font-bold",
    gold: "bg-pageant-gold hover:bg-amber-400 text-black shadow-md shadow-pageant-gold/10 font-bold",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-3 text-base",
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
};
