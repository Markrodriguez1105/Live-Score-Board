import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  className = "",
  id,
  ...props
}) => {
  const generatedId = id || React.useId();

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label
          htmlFor={generatedId}
          className="block text-[10px] font-bold text-white/40 uppercase tracking-widest"
        >
          {label}
        </label>
      )}
      <input
        id={generatedId}
        className={`
          w-full bg-surface-primary border rounded-xl px-4 py-3 text-sm text-white
          placeholder-white/20 focus:outline-none focus:ring-2 transition-all
          ${error
            ? "border-red-500/50 focus:ring-red-500/20"
            : "border-border-default focus:border-pageant-purple focus:ring-pageant-purple/20"
          }
          ${className}
        `}
        {...props}
      />
      {error ? (
        <p className="text-xs text-red-400 font-medium">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-white/30">{helperText}</p>
      ) : null}
    </div>
  );
};
