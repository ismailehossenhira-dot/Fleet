import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Compass, 
  Truck, 
  QrCode, 
  Fuel, 
  Building2, 
  Wrench, 
  FileText,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, THEME_OPTIONS, ThemeMode } from '../ThemeContext';

interface AppPreloaderProps {
  message?: string;
  subMessage?: string;
}

// 6 Core services of FleetFlow Pro with concise, punchy information
const APP_SERVICES = [
  {
    id: 'trip-dispatch',
    icon: Truck,
    title: 'ট্রিপ ডিসপ্যাচ ও মনিটরিং',
    shortName: 'ট্রিপ',
    summary: 'রুট নির্ধারণ, চালক অ্যাসাইন ও লাইভ ট্রিপ ট্র্যাকিং'
  },
  {
    id: 'gate-scan',
    icon: QrCode,
    title: 'ডিজিটাল ইন ও আউট স্ক্যান',
    shortName: 'ইন/আউট স্ক্যান',
    summary: 'কিউআর ও ক্যামেরা দিয়ে গাড়ির আগমন-প্রস্থান ও ওডোমিটার স্ক্যান'
  },
  {
    id: 'fuel-logs',
    icon: Fuel,
    title: 'জ্বালানি ও সিএনজি লগ',
    shortName: 'ফুয়েল লগ',
    summary: 'কিলোমিটার প্রতি তেল ও গ্যাসের খরচ হিসাব এবং ভাউচার অডিট'
  },
  {
    id: 'depot-control',
    icon: Building2,
    title: 'মাল্টি-ডিপো ও হাব ফ্লিট',
    shortName: 'ডিপো ও হাব',
    summary: 'ডিপোভিত্তিক গাড়ি বরাদ্দ ও ইন্টার-ডিপো ট্রান্সফার নিয়ন্ত্রণ'
  },
  {
    id: 'maintenance-cases',
    icon: Wrench,
    title: 'রক্ষণাবেক্ষণ ও কেস ডায়েরি',
    shortName: 'মেইনটেন্যান্স',
    summary: 'সার্ভিসিং শিডিউল, ফিটনেস নবায়ন ও ট্রাফিক কেস রেকর্ড'
  },
  {
    id: 'reports-audit',
    icon: FileText,
    title: 'অ্যানালিটিক্স ও রিপোর্ট',
    shortName: 'রিপোর্ট',
    summary: 'ট্রিপ সামারি, ড্রাইভার পারফরম্যান্স ও তাৎক্ষণিক প্রিন্টেবল রিপোর্ট'
  }
];

export const AppPreloader: React.FC<AppPreloaderProps> = ({
  message = "FleetFlow Pro লোড হচ্ছে...",
  subMessage = "সিস্টেম প্রস্তুত করা হচ্ছে"
}) => {
  // Gracefully read active theme from context
  let themeContext: {
    theme: ThemeMode;
    currentThemeOption: typeof THEME_OPTIONS[0];
  } | null = null;
  
  try {
    themeContext = useTheme();
  } catch {
    themeContext = null;
  }

  const activeTheme = themeContext?.theme || 'ocean-blue';
  const currentOption = themeContext?.currentThemeOption || THEME_OPTIONS[0];

  // Cycling active service animation index and direction for slide effect
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);
  const [direction, setDirection] = useState<number>(1); // 1 for next, -1 for prev
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const goToSlide = (nextIndex: number, newDir: number) => {
    setDirection(newDir);
    setActiveFeatureIndex(nextIndex);
  };

  const handleNext = () => {
    goToSlide((activeFeatureIndex + 1) % APP_SERVICES.length, 1);
  };

  const handlePrev = () => {
    goToSlide((activeFeatureIndex - 1 + APP_SERVICES.length) % APP_SERVICES.length, -1);
  };

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setDirection(1);
      setActiveFeatureIndex(prev => (prev + 1) % APP_SERVICES.length);
    }, 2800);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeFeatureIndex]);

  // Vibrant rich theme glow colors with high saturation and brilliance
  const themeStyles = useMemo(() => {
    switch (activeTheme) {
      case 'emerald-teal':
        return {
          glowColor1: 'rgba(46, 168, 132, 0.40)',
          glowColor2: 'rgba(24, 94, 73, 0.45)',
          glowColor3: 'rgba(62, 189, 151, 0.30)',
          accentHex: '#2ea884',
          accentLight: '#3ebd97',
          ringColor: 'border-[#2ea884]/60',
          progressBar: 'from-[#3ebd97] via-[#2ea884] to-[#185e49]',
          activeCardBorder: 'border-[#2ea884]',
          activeCardShadow: '0 0 35px -5px rgba(46, 168, 132, 0.45)',
          activeBg: 'bg-[#2ea884]/25 text-[#3ebd97]',
          chipBorder: 'border-[#2ea884]/70'
        };
      case 'crimson-red':
        return {
          glowColor1: 'rgba(234, 35, 64, 0.40)',
          glowColor2: 'rgba(159, 18, 57, 0.45)',
          glowColor3: 'rgba(255, 75, 104, 0.30)',
          accentHex: '#ea2340',
          accentLight: '#ff4b68',
          ringColor: 'border-[#ea2340]/60',
          progressBar: 'from-[#ff385c] via-[#ea2340] to-[#9f1239]',
          activeCardBorder: 'border-[#ea2340]',
          activeCardShadow: '0 0 35px -5px rgba(234, 35, 64, 0.45)',
          activeBg: 'bg-[#ea2340]/25 text-[#ff4b68]',
          chipBorder: 'border-[#ea2340]/70'
        };
      case 'carrybee-amber':
        return {
          glowColor1: 'rgba(245, 158, 11, 0.40)',
          glowColor2: 'rgba(180, 83, 9, 0.45)',
          glowColor3: 'rgba(251, 191, 36, 0.30)',
          accentHex: '#f59e0b',
          accentLight: '#fbbf24',
          ringColor: 'border-[#f59e0b]/60',
          progressBar: 'from-[#fbbf24] via-[#f59e0b] to-[#b45309]',
          activeCardBorder: 'border-[#f59e0b]',
          activeCardShadow: '0 0 35px -5px rgba(245, 158, 11, 0.45)',
          activeBg: 'bg-[#f59e0b]/25 text-[#fbbf24]',
          chipBorder: 'border-[#f59e0b]/70'
        };
      case 'ocean-blue':
      default:
        return {
          glowColor1: 'rgba(37, 99, 235, 0.40)',
          glowColor2: 'rgba(79, 70, 229, 0.45)',
          glowColor3: 'rgba(6, 182, 212, 0.30)',
          accentHex: '#2563eb',
          accentLight: '#3b82f6',
          ringColor: 'border-blue-500/60',
          progressBar: 'from-cyan-400 via-blue-500 to-indigo-600',
          activeCardBorder: 'border-blue-500',
          activeCardShadow: '0 0 35px -5px rgba(37, 99, 235, 0.45)',
          activeBg: 'bg-blue-600/25 text-blue-400',
          chipBorder: 'border-blue-500/70'
        };
    }
  }, [activeTheme]);

  const activeService = APP_SERVICES[activeFeatureIndex];
  const ActiveIcon = activeService.icon;

  // Slide Animation Variants (Fluid horizontal spring physics with directional awareness & blur fade)
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 90 : -90,
      opacity: 0,
      scale: 0.94,
      filter: 'blur(8px)'
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      filter: 'blur(0px)',
      transition: {
        x: { type: 'spring' as const, stiffness: 320, damping: 28 },
        opacity: { duration: 0.32 },
        scale: { duration: 0.32 },
        filter: { duration: 0.28 }
      }
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -90 : 90,
      opacity: 0,
      scale: 0.94,
      filter: 'blur(8px)',
      transition: {
        x: { type: 'spring' as const, stiffness: 320, damping: 28 },
        opacity: { duration: 0.24 },
        filter: { duration: 0.2 }
      }
    })
  };

  return (
    <motion.div
      key="preloader-overlay"
      initial={{ opacity: 1 }}
      exit={{
        opacity: [1, 1, 0],
        transition: { duration: 0.45, times: [0, 0.7, 1], ease: "easeInOut" }
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[#070d1d] via-[#0b1329] to-[#050914] text-white overflow-y-auto px-4 py-6 select-none pointer-events-auto"
    >
      {/* Super-Vibrant Animated Ambient Glow Halos */}
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.75, 0.95, 0.75]
        }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-[550px] h-[550px] rounded-full blur-[90px] pointer-events-none -top-24 -left-20"
        style={{ backgroundColor: themeStyles.glowColor1 }}
      />
      <motion.div
        animate={{
          scale: [1.1, 1, 1.1],
          opacity: [0.7, 0.9, 0.7]
        }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute w-[550px] h-[550px] rounded-full blur-[100px] pointer-events-none -bottom-24 -right-20"
        style={{ backgroundColor: themeStyles.glowColor2 }}
      />
      <motion.div
        animate={{
          scale: [0.9, 1.15, 0.9],
          opacity: [0.35, 0.6, 0.35]
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute w-[400px] h-[400px] rounded-full blur-[80px] pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ backgroundColor: themeStyles.glowColor3 }}
      />

      {/* Subtle Star / Light-Dot Field */}
      <div 
        className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[radial-gradient(#ffffff_1.5px,transparent_1.5px)] [background-size:28px_28px]" 
      />

      <div className="relative z-10 w-full max-w-lg mx-auto flex flex-col items-center text-center my-auto">
        
        {/* Brand Header with Rich Multi-Ring Glow */}
        <motion.div 
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="flex flex-col items-center mb-5"
        >
          {/* Logo Card with Rotating Rings */}
          <div className="relative flex items-center justify-center mb-3.5">
            {/* Multiple animated pulsing ripple rings with theme colors */}
            <motion.div 
              className={`absolute w-22 h-22 rounded-full border-2 ${themeStyles.ringColor} animate-ping`}
              style={{ animationDuration: '2.8s' }}
            />
            <motion.div 
              className="absolute w-28 h-28 rounded-full border border-white/10"
              animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            
            {/* Intense Radiant Blur behind logo */}
            <div 
              className="absolute w-16 h-16 rounded-3xl blur-xl"
              style={{ backgroundColor: themeStyles.accentHex, opacity: 0.6 }}
            />

            {/* Glowing Logo Card */}
            <div 
              className={`relative w-15 h-15 rounded-2xl bg-gradient-to-br ${currentOption.previewGradient} p-[2px] shadow-2xl flex items-center justify-center`}
              style={{ boxShadow: `0 0 25px ${themeStyles.accentHex}66` }}
            >
              <div className="w-full h-full bg-slate-950/90 rounded-[13px] flex items-center justify-center overflow-hidden backdrop-blur-md">
                <Compass 
                  size={30} 
                  className="text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.9)] animate-[spin_9s_linear_infinite]" 
                />
              </div>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center justify-center gap-1.5 drop-shadow-md">
            <span>FleetFlow</span>
            <span 
              className="text-transparent bg-clip-text bg-gradient-to-r drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]"
              style={{
                backgroundImage: `linear-gradient(to right, #ffffff, ${themeStyles.accentLight})`
              }}
            >
              Pro
            </span>
          </h1>

          <p className="text-xs text-slate-300 font-semibold tracking-wider uppercase mt-1">
            লজিস্টিকস ও ফ্লিট ম্যানেজমেন্ট
          </p>
        </motion.div>

        {/* Eye-Catching Animated Spotlight Card with Fluid Slide-in & Slide-out */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="w-full relative rounded-2xl p-[1.5px] mb-4 shadow-2xl overflow-hidden group"
          style={{
            background: `linear-gradient(135deg, ${themeStyles.accentHex}, transparent 60%, ${themeStyles.accentLight})`,
            boxShadow: themeStyles.activeCardShadow
          }}
        >
          {/* Shimmer sweep effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_3s_infinite] pointer-events-none" />

          {/* Inner card container */}
          <div className="w-full bg-[#0d162e]/95 backdrop-blur-xl rounded-[15px] p-4 relative overflow-hidden">
            
            {/* Top row with step and navigation arrows */}
            <div className="flex items-center justify-between mb-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span 
                  className="w-2 h-2 rounded-full animate-ping"
                  style={{ backgroundColor: themeStyles.accentHex }}
                />
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={11} style={{ color: themeStyles.accentLight }} />
                  <span>সার্ভিস পরিচিতি</span>
                </span>
              </div>

              {/* Prev / Next Controls for immediate interactive slide */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="p-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="পূর্ববর্তী"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[10px] font-mono text-slate-400 px-1">
                  {activeFeatureIndex + 1}/{APP_SERVICES.length}
                </span>
                <button
                  type="button"
                  onClick={handleNext}
                  className="p-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="পরবর্তী"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Slide-in / Slide-out Service Presentation Area */}
            <div className="relative min-h-[72px] flex items-center justify-center overflow-hidden">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={activeService.id}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="w-full flex items-center gap-3.5 text-left"
                >
                  {/* Glowing Animated Icon Container */}
                  <motion.div 
                    animate={{ 
                      scale: [1, 1.08, 1],
                      boxShadow: [
                        `0 0 10px ${themeStyles.accentHex}40`,
                        `0 0 20px ${themeStyles.accentHex}80`,
                        `0 0 10px ${themeStyles.accentHex}40`
                      ]
                    }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                    className={`p-3 rounded-2xl shrink-0 border ${themeStyles.activeBg}`}
                    style={{ borderColor: `${themeStyles.accentHex}70` }}
                  >
                    <ActiveIcon size={26} style={{ color: themeStyles.accentLight }} />
                  </motion.div>

                  {/* Title & Summary */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-white tracking-wide mb-1 flex items-center gap-2">
                      <span>{activeService.title}</span>
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed font-normal">
                      {activeService.summary}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Progress Dots with Active Glow Expansion */}
            <div className="flex items-center justify-center gap-1.5 mt-3 pt-2.5 border-t border-slate-800/80">
              {APP_SERVICES.map((item, i) => {
                const isSelected = i === activeFeatureIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => goToSlide(i, i > activeFeatureIndex ? 1 : -1)}
                    className={`h-1.5 rounded-full transition-all duration-400 cursor-pointer ${
                      isSelected 
                        ? 'w-7 shadow-sm' 
                        : 'w-1.5 bg-slate-700/80 hover:bg-slate-600'
                    }`}
                    style={{
                      backgroundColor: isSelected ? themeStyles.accentLight : undefined,
                      boxShadow: isSelected ? `0 0 10px ${themeStyles.accentHex}` : undefined
                    }}
                    title={item.title}
                  />
                );
              })}
            </div>

          </div>
        </motion.div>

        {/* Compact Interactive Service Pills with Rich Color Fades */}
        <div className="w-full grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-5">
          {APP_SERVICES.map((item, idx) => {
            const Icon = item.icon;
            const isActive = activeFeatureIndex === idx;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goToSlide(idx, idx > activeFeatureIndex ? 1 : -1)}
                className={`relative flex flex-col items-center justify-center p-2 rounded-xl border transition-all duration-300 cursor-pointer overflow-hidden ${
                  isActive
                    ? `bg-slate-900 ${themeStyles.chipBorder} shadow-lg scale-105`
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:bg-slate-900/80 hover:text-slate-200'
                }`}
                style={{
                  boxShadow: isActive ? `0 0 16px -2px ${themeStyles.accentHex}50` : undefined
                }}
              >
                {/* Active pill background aura */}
                {isActive && (
                  <div 
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{ backgroundColor: themeStyles.accentHex }}
                  />
                )}

                <Icon 
                  size={17} 
                  style={{ color: isActive ? themeStyles.accentLight : undefined }}
                  className={`mb-1 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}
                />
                <span className={`text-[10px] font-medium truncate w-full transition-colors ${
                  isActive ? 'text-white font-bold' : 'text-slate-400'
                }`}>
                  {item.shortName}
                </span>
              </button>
            );
          })}
        </div>

        {/* Glowing Progress Line & Status with Saturated Flare */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="w-full max-w-sm flex flex-col items-center"
        >
          {/* Animated Neon Progress Track */}
          <div 
            className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden mb-2 relative border border-slate-800/80"
            style={{ boxShadow: `0 0 12px -2px ${themeStyles.accentHex}40` }}
          >
            <div 
              className={`h-full bg-gradient-to-r ${themeStyles.progressBar} rounded-full w-full animate-[progress_1.6s_ease-in-out_infinite]`}
            />
          </div>

          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <span 
              className="w-2 h-2 rounded-full animate-ping"
              style={{ backgroundColor: themeStyles.accentLight }}
            />
            <span className="font-semibold text-slate-200">{message}</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400 text-[11px] font-medium">{subMessage}</span>
          </div>
        </motion.div>

      </div>
    </motion.div>
  );
};

export default AppPreloader;
