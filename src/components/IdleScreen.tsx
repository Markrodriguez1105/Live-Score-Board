import React from "react";
import Logo from "../images/Logo.png";

export const IdleScreen: React.FC = () => {
  return (
    <div className="h-screen w-screen bg-black flex items-center justify-center overflow-hidden relative">
      {/* Animated Background Gradient */}
      <div className="absolute inset-0 ethereal-gradient opacity-30 animate-pulse" />

      {/* Centered glowing logo only */}
      <div className="relative z-10 text-center p-6 animate-fade-in-up grid place-items-center h-full">
        <div className="logo-badge-wrapper">
          <div className="relative z-10 logo-badge">
            <img src={Logo} alt="Event Logo" className="logo-image w-150" />
          </div>
        </div>
      </div>
    </div>
  );
};
