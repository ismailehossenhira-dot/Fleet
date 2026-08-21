import React from 'react';
import { Compass } from 'lucide-react';
import { motion } from 'framer-motion';

interface AppPreloaderProps {
  message?: string;
  subMessage?: string;
}

export const AppPreloader: React.FC<AppPreloaderProps> = ({
  message = "Fleet Manager লোড হচ্ছে...",
  subMessage = "লজিস্টিকস ও ফ্লিট সিস্টেম প্রস্তুত করা হচ্ছে"
}) => {
  return (
    <motion.div
      key="preloader-overlay"
      initial={{ opacity: 1 }}
      exit={{
        opacity: [1, 1, 0],
        transition: { duration: 0.7, times: [0, 0.7, 1], ease: "easeInOut" }
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white overflow-hidden select-none pointer-events-auto"
    >
      {/* Dynamic Background Glows */}
      <motion.div
        exit={{ scale: 2.5, opacity: 0, transition: { duration: 0.6, ease: "easeOut" } }}
        className="absolute w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-pulse pointer-events-none -top-20 -left-20"
      />
      <motion.div
        exit={{ scale: 2.5, opacity: 0, transition: { duration: 0.6, ease: "easeOut" } }}
        className="absolute w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse pointer-events-none -bottom-20 -right-20"
        style={{ animationDelay: '1s' }}
      />

      <div className="relative z-10 flex flex-col items-center max-w-sm px-6 text-center">
        {/* Animated Icon Container with Smooth Reveal on Exit */}
        <div className="relative flex items-center justify-center mb-8">
          {/* Pulsing Ripple Rings */}
          <motion.div
            exit={{ scale: 4, opacity: 0, transition: { duration: 0.5 } }}
            className="absolute w-28 h-28 rounded-full border border-blue-500/20 animate-ping"
            style={{ animationDuration: '3s' }}
          />
          <motion.div
            exit={{ scale: 5, opacity: 0, transition: { duration: 0.5 } }}
            className="absolute w-36 h-36 rounded-full border border-indigo-500/15 animate-ping"
            style={{ animationDuration: '2.4s', animationDelay: '0.5s' }}
          />
          <motion.div
            exit={{ scale: 3, opacity: 0 }}
            className="absolute w-20 h-20 rounded-2xl bg-blue-500/20 blur-xl animate-pulse"
          />

          {/* Central Compass Icon Card with Smooth Clean Zoom Out */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{
              scale: [1, 1.1, 14],
              opacity: [1, 1, 0],
              filter: ["blur(0px)", "blur(0px)", "blur(12px)"],
              transition: {
                duration: 0.65,
                times: [0, 0.25, 1],
                ease: [0.22, 1, 0.36, 1]
              }
            }}
            className="relative w-22 h-22 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 p-0.5 shadow-2xl shadow-blue-500/40 flex items-center justify-center"
          >
            <div className="w-full h-full bg-slate-900/70 rounded-[14px] flex items-center justify-center backdrop-blur-xs relative overflow-hidden">
              {/* Rotating glowing sweep */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
              
              <Compass 
                size={42} 
                className="text-white drop-shadow-[0_0_16px_rgba(59,130,246,0.9)] animate-[spin_8s_linear_infinite]" 
              />
            </div>
          </motion.div>
        </div>

        {/* Brand Title */}
        <motion.div
          exit={{ opacity: 0, scale: 0.8, y: 20, transition: { duration: 0.25 } }}
          className="space-y-1.5 mb-6"
        >
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <span>Fleet</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">Manager</span>
          </h1>
          <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
            লজিস্টিকস ও ট্রান্সপোর্ট সিস্টেম
          </p>
        </motion.div>

        {/* Loading Progress Bar */}
        <motion.div
          exit={{ opacity: 0, scaleX: 0, transition: { duration: 0.2 } }}
          className="w-56 h-1.5 bg-slate-800/80 rounded-full overflow-hidden mb-4 border border-white/5 relative"
        >
          <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-400 to-cyan-400 rounded-full w-full animate-[progress_1.8s_ease-in-out_infinite]"></div>
        </motion.div>

        {/* Loading Status Text */}
        <motion.div
          exit={{ opacity: 0, y: 10, transition: { duration: 0.2 } }}
          className="space-y-1"
        >
          <p className="text-sm font-bold text-slate-200 tracking-wide">
            {message}
          </p>
          <p className="text-[11px] text-slate-400">
            {subMessage}
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
};
export default AppPreloader;
