import React, { useState, useEffect, useMemo } from 'react';
import { 
  Compass, 
  Truck, 
  QrCode, 
  Fuel, 
  Building2, 
  Wrench, 
  FileText
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

  // Cycling active service animation index
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveFeatureIndex(prev => (prev + 1) % APP_SERVICES.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  // Theme-specific colors and gradients
  const themeStyles = useMemo(() => {
    switch (activeTheme) {
      case 'emerald-teal':
        return {
          glow: 'bg-[#2ea884]/15',
          ringColor: 'border-[#2ea884]/40',
          progressBar: 'from-[#3ebd97] via-[#2ea884] to-[#185e49]',
          activeCardBorder: 'border-[#2ea884] shadow-[#2ea884]/25',
          activeBg: 'bg-[#2ea884]/15 text-[#3ebd97]',
          accentHex: '#2ea884'
        };
      case 'crimson-red':
        return {
          glow: 'bg-[#ea2340]/15',
          ringColor: 'border-[#ea2340]/40',
          progressBar: 'from-[#ff385c] via-[#ea2340] to-[#9f1239]',
          activeCardBorder: 'border-[#ea2340] shadow-[#ea2340]/25',
          activeBg: 'bg-[#ea2340]/15 text-[#ff4b68]',
          accentHex: '#ea2340'
        };
      case 'carrybee-amber':
        return {
          glow: 'bg-[#f59e0b]/15',
          ringColor: 'border-[#f59e0b]/40',
          progressBar: 'from-[#fbbf24] via-[#f59e0b] to-[#b45309]',
          activeCardBorder: 'border-[#f59e0b] shadow-[#f59e0b]/25',
          activeBg: 'bg-[#f59e0b]/15 text-[#fbbf24]',
          accentHex: '#f59e0b'
        };
      case 'ocean-blue':
      default:
        return {
          glow: 'bg-blue-600/15',
          ringColor: 'border-blue-500/40',
          progressBar: 'from-blue-500 via-indigo-500 to-cyan-400',
          activeCardBorder: 'border-blue-500 shadow-blue-500/25',
          activeBg: 'bg-blue-500/15 text-blue-400',
          accentHex: '#2563eb'
        };
    }
  }, [activeTheme]);

  const activeService = APP_SERVICES[activeFeatureIndex];
  const ActiveIcon = activeService.icon;

  return (
    <motion.div
      key="preloader-overlay"
      initial={{ opacity: 1 }}
      exit={{
        opacity: [1, 1, 0],
        transition: { duration: 0.45, times: [0, 0.7, 1], ease: "easeInOut" }
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[#0b1329] via-[#0f172a] to-[#080d1a] text-white overflow-y-auto px-4 py-6 select-none pointer-events-auto"
    >
      {/* Dynamic Ambient Halos */}
      <motion.div
        exit={{ scale: 1.6, opacity: 0 }}
        className={`absolute w-[450px] h-[450px] ${themeStyles.glow} rounded-full blur-3xl pointer-events-none -top-20 -left-20 animate-pulse`}
        style={{ animationDuration: '4s' }}
      />
      <motion.div
        exit={{ scale: 1.6, opacity: 0 }}
        className={`absolute w-[450px] h-[450px] ${themeStyles.glow} rounded-full blur-3xl pointer-events-none -bottom-20 -right-20 animate-pulse`}
        style={{ animationDuration: '4s', animationDelay: '1.2s' }}
      />

      <div className="relative z-10 w-full max-w-lg mx-auto flex flex-col items-center text-center my-auto">
        
        {/* Brand Header */}
        <motion.div 
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center mb-5"
        >
          {/* Logo Card with Rotating Rings */}
          <div className="relative flex items-center justify-center mb-3">
            <div 
              className={`absolute w-18 h-18 rounded-full border ${themeStyles.ringColor} animate-ping`}
              style={{ animationDuration: '2.6s' }}
            />
            <div className={`absolute w-14 h-14 rounded-2xl ${themeStyles.glow} blur-md`} />

            <div className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${currentOption.previewGradient} p-0.5 shadow-xl flex items-center justify-center`}>
              <div className="w-full h-full bg-slate-950/80 rounded-[13px] flex items-center justify-center overflow-hidden">
                <Compass 
                  size={28} 
                  className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.7)] animate-[spin_10s_linear_infinite]" 
                />
              </div>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center justify-center gap-1.5">
            <span>FleetFlow</span>
            <span 
              className="text-transparent bg-clip-text bg-gradient-to-r"
              style={{
                backgroundImage: `linear-gradient(to right, #ffffff, ${themeStyles.accentHex})`
              }}
            >
              Pro
            </span>
          </h1>

          <p className="text-xs text-slate-400 font-medium tracking-wide mt-1">
            লজিস্টিকস ও ফ্লিট ম্যানেজমেন্ট
          </p>
        </motion.div>

        {/* Animated Service Spotlight Showcase */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl backdrop-blur-md relative overflow-hidden"
        >
          <div 
            className="absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl opacity-20 pointer-events-none transition-colors duration-500"
            style={{ backgroundColor: themeStyles.accentHex }}
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={activeService.id}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex items-center gap-3.5 text-left"
            >
              <motion.div 
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className={`p-3 rounded-xl shrink-0 border ${themeStyles.activeBg}`}
                style={{ borderColor: `${themeStyles.accentHex}40` }}
              >
                <ActiveIcon size={24} style={{ color: themeStyles.accentHex }} />
              </motion.div>

              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white tracking-wide mb-0.5">
                  {activeService.title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeService.summary}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Clean Progress Dots (1 to 6) */}
          <div className="flex items-center justify-center gap-1.5 mt-3 pt-2.5 border-t border-slate-800/80">
            {APP_SERVICES.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveFeatureIndex(i)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  i === activeFeatureIndex 
                    ? 'w-6' 
                    : 'w-1.5 bg-slate-700 hover:bg-slate-600'
                }`}
                style={{
                  backgroundColor: i === activeFeatureIndex ? themeStyles.accentHex : undefined
                }}
                title={item.title}
              />
            ))}
          </div>
        </motion.div>

        {/* Compact Quick-Navigation Service Pills */}
        <div className="w-full grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-5">
          {APP_SERVICES.map((item, idx) => {
            const Icon = item.icon;
            const isActive = activeFeatureIndex === idx;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveFeatureIndex(idx)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? `bg-slate-800 border ${themeStyles.activeCardBorder} shadow-sm scale-105`
                    : 'bg-slate-900/50 border-slate-800/70 text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                }`}
              >
                <Icon 
                  size={16} 
                  style={{ color: isActive ? themeStyles.accentHex : undefined }}
                  className="mb-1"
                />
                <span className={`text-[10px] font-medium truncate w-full ${
                  isActive ? 'text-white font-bold' : 'text-slate-400'
                }`}>
                  {item.shortName}
                </span>
              </button>
            );
          })}
        </div>

        {/* Minimal Progress Line & Status */}
        <div className="w-full max-w-sm flex flex-col items-center">
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2 relative">
            <div 
              className={`h-full bg-gradient-to-r ${themeStyles.progressBar} rounded-full w-full animate-[progress_1.6s_ease-in-out_infinite]`}
            />
          </div>

          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <span 
              className="w-1.5 h-1.5 rounded-full animate-ping"
              style={{ backgroundColor: themeStyles.accentHex }}
            />
            <span className="font-medium text-slate-300">{message}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400 text-[11px]">{subMessage}</span>
          </div>
        </div>

      </div>
    </motion.div>
  );
};

export default AppPreloader;
