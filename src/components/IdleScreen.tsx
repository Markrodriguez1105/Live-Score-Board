import React from 'react';

export const IdleScreen: React.FC = () => {
    return (
        <div className="h-screen w-screen bg-black flex items-center justify-center overflow-hidden relative">
            {/* Animated Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-pageant-purple/30 via-black to-blue-900/30 animate-pulse" />

            {/* Content */}
            <div className="relative z-10 text-center p-10 animate-fade-in-up">
                {/* Logo Placeholder - You can replace src with actual logo URL */}
                <div className="mb-8 relative inline-block">
                    <div className="absolute -inset-4 bg-pageant-gold/20 blur-xl rounded-full animate-pulse"></div>
                    <img
                        src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
                        alt="Event Logo"
                        className="w-48 h-48 md:w-64 md:h-64 object-contain drop-shadow-2xl relative z-10"
                    />
                </div>

                <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-4 drop-shadow-lg">
                    LIVE RESULTS
                </h1>
                <p className="text-pageant-gold text-xl md:text-2xl tracking-[0.5em] uppercase font-light">
                    Stay Tuned
                </p>
            </div>

            <div className="absolute bottom-8 text-white/20 text-sm font-mono tracking-widest">
                WAITING FOR RESULTS
            </div>
        </div>
    );
};
