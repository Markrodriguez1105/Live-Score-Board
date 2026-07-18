import React from "react";

export const Card: React.FC<React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>> = ({ className = "", children, ...props }) => (
  <div className={`bg-surface-secondary border border-border-subtle rounded-2xl shadow-xl shadow-black/5 overflow-hidden ${className}`} {...props}>
    {children}
  </div>
);

export const CardHeader: React.FC<React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>> = ({ className = "", children, ...props }) => (
  <div className={`p-6 border-b border-border-subtle flex flex-col space-y-1.5 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.PropsWithChildren<React.HTMLAttributes<HTMLHeadingElement>>> = ({ className = "", children, ...props }) => (
  <h3 className={`text-base font-bold text-white tracking-tight ${className}`} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.PropsWithChildren<React.HTMLAttributes<HTMLParagraphElement>>> = ({ className = "", children, ...props }) => (
  <p className={`text-xs text-white/40 ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>> = ({ className = "", children, ...props }) => (
  <div className={`p-6 ${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>> = ({ className = "", children, ...props }) => (
  <div className={`p-6 border-t border-border-subtle flex items-center bg-white/[0.01] ${className}`} {...props}>
    {children}
  </div>
);
