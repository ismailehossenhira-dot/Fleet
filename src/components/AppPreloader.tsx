import React from 'react';
import { Compass, Sparkles } from 'lucide-react';

interface AppPreloaderProps {
  message?: string;
  subMessage?: string;
}

export const AppPreloader: React.FC<AppPreloaderProps> = ({
  message = "FleetFlow Pro লোড হচ্ছে...",
  subMessage = "লজিস্টিকস ও ফ্লিট সিস্টেম প্রস্তুত করা হচ্ছে"
}) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white overflow-hidden select-none">
      {/* Dynamic Background Glows */}
      <div className="absolute w-96 h-96 bg-blue-600/15 rounded-full blur-3xl animate-pulse pointer-events-none -top-20 -left-20"></div>
      <div className="absolute w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl animate-pulse pointer-events-none -bottom-20 -right-20" style={{ animationDelay: '1s' }}></div>

      <div className="relative z-10 flex flex-col items-center max-w-sm px-6 text-center">
        {/* Animated Icon Container with Radar Waves */}
        <div className="relative flex items-center justify-center mb-8">
          {/* Pulsing Ripple Rings */}
          <div className="absolute w-28 h-28 rounded-full border border-blue-500/20 animate-ping" style={{ animationDuration: '3s' }}></div>
          <div className="absolute w-36 h-36 rounded-full border border-indigo-500/15 animate-ping" style={{ animationDuration: '2.4s', animationDelay: '0.5s' }}></div>
          <div className="absolute w-20 h-20 rounded-2xl bg-blue-500/20 blur-xl animate-pulse"></div>

          {/* Central Compass Icon Card */}
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 p-0.5 shadow-2xl shadow-blue-500/30 flex items-center justify-center group">
            <div className="w-full h-full bg-slate-900/60 rounded-[14px] flex items-center justify-center backdrop-blur-xs relative overflow-hidden">
              {/* Rotating glowing sweep */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
              
              <Compass 
                size={38} 
                className="text-white drop-shadow-[0_0_12px_rgba(59,130,246,0.8)] animate-[spin_8s_linear_infinite]" 
              />
            </div>
            
            {/* Sparkle Tag */}
            <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-md animate-bounce">
              <Sparkles size={13} className="fill-slate-950" />
            </div>
          </div>
        </div>

        {/* Brand Title */}
        <div className="space-y-1.5 mb-6">
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <span>FleetFlow</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">Pro</span>
          </h1>
          <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
            Logistics & Transport Intelligence
          </p>
        </div>

        {/* Loading Progress Bar */}
        <div className="w-56 h-1.5 bg-slate-800/80 rounded-full overflow-hidden mb-4 border border-white/5 relative">
          <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-400 to-cyan-400 rounded-full w-full animate-[progress_1.8s_ease-in-out_infinite]"></div>
        </div>

        {/* Loading Status Text */}
        <div className="space-y-1">
          <p className="text-sm font-bold text-slate-200 tracking-wide">
            {message}
          </p>
          <p className="text-[11px] text-slate-400">
            {subMessage}
          </p>
        </div>
      </div>
    </div>
  );
};
export default AppPreloader;
