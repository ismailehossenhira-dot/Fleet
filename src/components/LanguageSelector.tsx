import React from 'react';
import { Check, Globe } from 'lucide-react';
import { useLanguage, LANGUAGE_OPTIONS, LanguageMode } from '../LanguageContext';
import { cn } from '../lib/utils';
import { useTheme } from '../ThemeContext';

interface LanguageSelectorProps {
  compact?: boolean;
  onSelect?: () => void;
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ compact = false, onSelect, className }) => {
  const { language, setLanguage, t } = useLanguage();
  const { isEmerald, isCrimson, isAmber } = useTheme();

  const handleSelect = (id: LanguageMode) => {
    setLanguage(id);
    if (onSelect) {
      onSelect();
    }
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {LANGUAGE_OPTIONS.map((opt) => {
        const isSelected = language === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => handleSelect(opt.id)}
            className={cn(
              "w-full flex items-center justify-between text-left rounded-xl transition-all cursor-pointer active:scale-98",
              compact ? "px-2.5 py-1.5" : "px-3 py-2.5",
              isSelected
                ? isEmerald
                  ? "bg-[#e8f7f2] border-[#2ea884] ring-1 ring-[#2ea884] shadow-xs"
                  : isCrimson
                    ? "bg-[#fff1f2] border-[#ea2340] ring-1 ring-[#ea2340] shadow-xs"
                    : isAmber
                      ? "bg-[#fef3c7] border-[#f59e0b] ring-1 ring-[#f59e0b] shadow-xs"
                      : "bg-blue-50 border-blue-600 ring-1 ring-blue-600 shadow-xs"
                : "bg-slate-50 border border-slate-200 hover:bg-slate-100/80"
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={cn(
                "rounded-lg flex items-center justify-center flex-shrink-0 font-medium",
                compact ? "text-sm w-6 h-6" : "text-base w-7 h-7 bg-white shadow-2xs border border-slate-100"
              )}>
                {opt.icon}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "text-xs font-bold truncate",
                    isSelected ? "text-slate-900 font-extrabold" : "text-slate-700"
                  )}>
                    {opt.name}
                  </span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded font-semibold tracking-wide hidden sm:inline-block",
                    isSelected 
                      ? isEmerald ? "bg-emerald-200 text-emerald-900" : isCrimson ? "bg-rose-200 text-rose-900" : isAmber ? "bg-amber-200 text-amber-900" : "bg-blue-200 text-blue-900"
                      : "bg-slate-200/80 text-slate-600"
                  )}>
                    {opt.badge}
                  </span>
                </div>
                {!compact && (
                  <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                    {opt.tagline}
                  </p>
                )}
              </div>
            </div>

            {isSelected && (
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ml-2 shadow-2xs",
                isEmerald 
                  ? "bg-[#2ea884] text-white" 
                  : isCrimson 
                    ? "bg-[#ea2340] text-white" 
                    : isAmber 
                      ? "bg-[#f59e0b] text-slate-950" 
                      : "bg-blue-600 text-white"
              )}>
                <Check size={12} className="stroke-[3]" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};
