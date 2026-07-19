import React from "react";

interface IdleScreenProps {
  logoUrl?: string;
  eventName?: string;
  className?: string;
}

export const IdleScreen: React.FC<IdleScreenProps> = ({
  logoUrl,
  eventName,
  className = "",
}) => (
  <div
    className={`h-screen w-screen bg-gray-950 flex items-center justify-center overflow-hidden relative ${className}`}
  >
    {/* Animated gradient background */}
    <div
      className="absolute inset-0 opacity-20"
      style={{
        background:
          "radial-gradient(ellipse at 30% 50%, rgba(99,102,241,0.3), transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(245,158,11,0.2), transparent 60%)",
        animation: "pulse 4s ease-in-out infinite",
      }}
    />

    {/* Floating particles */}
    <div className="absolute inset-0 overflow-hidden">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-amber-400/10"
          style={{
            width: `${8 + i * 4}px`,
            height: `${8 + i * 4}px`,
            left: `${15 + i * 14}%`,
            top: `${20 + (i % 3) * 25}%`,
            animation: `float ${6 + i * 1.5}s ease-in-out infinite ${i * 0.8}s`,
          }}
        />
      ))}
    </div>

    {/* Logo and branding */}
    <div className="relative z-10 text-center flex flex-col items-center gap-6">
      {logoUrl && (
        <div className="relative">
          {/* Glow effect */}
          <div
            className="absolute inset-0 blur-3xl opacity-30 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(245,158,11,0.4), transparent 70%)",
              transform: "scale(1.5)",
            }}
          />
          <img
            src={logoUrl}
            alt="Event Logo"
            className="relative z-10 max-w-70 md:max-w-100 object-contain drop-shadow-2xl"
            style={{
              animation: "float 6s ease-in-out infinite",
            }}
          />
        </div>
      )}

      {eventName && (
        <h1
          className="text-2xl md:text-4xl font-bold text-white/80 tracking-wider uppercase"
          style={{
            textShadow: "0 0 40px rgba(245,158,11,0.3)",
          }}
        >
          {eventName}
        </h1>
      )}

      {/* "LIVE" indicator */}
      <div className="flex items-center gap-2 mt-4">
        <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50" />
        <span className="text-xs text-white/40 uppercase tracking-[0.3em] font-semibold">
          Live Scoreboard
        </span>
      </div>
    </div>

    {/* CSS animations */}
    <style>{`
      @keyframes float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-12px); }
      }
    `}</style>
  </div>
);
