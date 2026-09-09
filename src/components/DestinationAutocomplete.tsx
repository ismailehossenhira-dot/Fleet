import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  MapPin, 
  Search,
  X, 
  ArrowRight,
  Navigation
} from 'lucide-react';
import { cn } from '../lib/utils';

// Helper to strip any Bengali text in parentheses or alongside English names, e.g. "Rajshahi (রাজশাহী)" -> "Rajshahi"
export const cleanDestinationName = (name: string): string => {
  if (!name) return '';
  // 1. Remove parenthesized Bengali text like "(রাজশাহী)" or "(চট্টগ্রাম বন্দর)"
  let cleaned = name.replace(/\s*\([\u0980-\u09FF\s,.\-/]+\)/gi, '');
  // 2. Remove " - রাজশাহী" or " / রাজশাহী"
  cleaned = cleaned.replace(/\s*[-/:]\s*[\u0980-\u09FF\s,.\-/]+/gi, '');
  // 3. Remove any remaining Bengali text if English characters exist
  if (/[a-zA-Z]/.test(cleaned)) {
    cleaned = cleaned.replace(/[\u0980-\u09FF]+/g, '').replace(/\s{2,}/g, ' ');
  }
  cleaned = cleaned.trim();
  return cleaned || name.trim();
};

// Helper to save a destination to localStorage history for past trips
export const LOCAL_STORAGE_KEY_DESTINATIONS = 'fleet_saved_destinations';

export const rememberDestinationLocation = (location: string) => {
  if (!location || !location.trim()) return;
  const trimmed = cleanDestinationName(location.trim());
  if (!trimmed) return;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_DESTINATIONS);
    const existing: string[] = raw ? JSON.parse(raw) : [];
    const filtered = existing
      .map(item => cleanDestinationName(item))
      .filter(item => item.toLowerCase() !== trimmed.toLowerCase());
    const updated = [trimmed, ...filtered].slice(0, 100);
    localStorage.setItem(LOCAL_STORAGE_KEY_DESTINATIONS, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to save destination location:", err);
  }
};

// Preset prominent hubs in English only (no Bengali names alongside)
const DEFAULT_PRESET_DESTINATIONS: string[] = [
  'Rajshahi',
  'Rangpur',
  'Rupsha, Khulna',
  'Chittagong Port',
  'Benapole Port',
  'Dhaka Tejgaon',
  'Gazipur Chowrasta',
  'Tongi',
  'Narayanganj',
  'Savar EPZ',
  'Bogra Charmatha',
  'Cumilla Paduar Bazar',
  'Sylhet Kadamtoli',
  'Mymensingh',
  'Jashore Monihar',
  'Barishal',
  'Feni Mohipal',
  'Uttara Abdullahpur'
];

interface DestinationAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  trips?: any[];
  placeholder?: string;
  required?: boolean;
  className?: string;
  onSelect?: (val: string) => void;
  id?: string;
}

export const DestinationAutocomplete: React.FC<DestinationAutocompleteProps> = ({
  value,
  onChange,
  trips = [],
  placeholder = "e.g. Ra লিখলে Rajshahi বা পূর্বের নামগুলো দেখাবে...",
  required = false,
  className,
  onSelect,
  id = "destination-location-input"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [localHistory, setLocalHistory] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY_DESTINATIONS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setLocalHistory(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  // Collect all unique past locations from trips data + local history
  const allPastLocations = useMemo(() => {
    const list: { name: string; count: number }[] = [];
    const map = new Map<string, { original: string; count: number }>();

    // 1. From database trips
    if (Array.isArray(trips)) {
      trips.forEach(t => {
        const rawLoc = t?.location ? String(t.location).trim() : '';
        const loc = cleanDestinationName(rawLoc);
        if (loc) {
          const lower = loc.toLowerCase();
          const cur = map.get(lower);
          if (cur) {
            cur.count += 1;
          } else {
            map.set(lower, { original: loc, count: 1 });
          }
        }
      });
    }

    // 2. From previously submitted destinations
    localHistory.forEach(rawLoc => {
      const loc = cleanDestinationName(rawLoc.trim());
      if (!loc) return;
      const lower = loc.toLowerCase();
      const cur = map.get(lower);
      if (cur) {
        cur.count += 2;
      } else {
        map.set(lower, { original: loc, count: 2 });
      }
    });

    // 3. Fallback preset hubs
    DEFAULT_PRESET_DESTINATIONS.forEach(loc => {
      const lower = loc.toLowerCase();
      if (!map.has(lower)) {
        map.set(lower, { original: loc, count: 0 });
      }
    });

    map.forEach(val => {
      list.push({ name: val.original, count: val.count });
    });

    return list;
  }, [trips, localHistory]);

  // Filter locations matching prefix (starts with typed letters, e.g., "Ra" -> "Rajshahi", "Rangpur")
  const { matchingPrefixList, topMatch } = useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    if (!q) {
      return { matchingPrefixList: [], topMatch: null };
    }

    // Matches that START with the user's typed letters (যেমন Ra দিয়ে শুরু)
    const prefixMatches = allPastLocations
      .filter(item => item.name.toLowerCase().startsWith(q) || 
                      // also check if any word inside starts with q (e.g. "Port Ra...")
                      item.name.toLowerCase().split(/[\s,/-]+/).some(w => w.startsWith(q)))
      .sort((a, b) => {
        const aStartsExact = a.name.toLowerCase().startsWith(q);
        const bStartsExact = b.name.toLowerCase().startsWith(q);
        if (aStartsExact && !bStartsExact) return -1;
        if (!aStartsExact && bStartsExact) return 1;
        return b.count - a.count;
      });

    // If no direct prefix match, fall back to contains match
    const finalMatches = prefixMatches.length > 0 
      ? prefixMatches 
      : allPastLocations.filter(item => item.name.toLowerCase().includes(q));

    const top = prefixMatches.length > 0 ? prefixMatches[0].name : null;

    return {
      matchingPrefixList: finalMatches.slice(0, 6),
      topMatch: top
    };
  }, [value, allPastLocations]);

  // Ghost text for the current input box (shows remainder of top prefix match right in the input box)
  const ghostSuffix = useMemo(() => {
    if (!topMatch || !value || !value.trim()) return '';
    const q = value.trim().toLowerCase();
    if (topMatch.toLowerCase().startsWith(q) && topMatch.length > value.length) {
      return topMatch.slice(value.length);
    }
    return '';
  }, [topMatch, value]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectLocation = (locName: string) => {
    onChange(locName);
    rememberDestinationLocation(locName);
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (onSelect) onSelect(locName);
    inputRef.current?.focus();
  };

  const handleCompleteWithGhost = () => {
    if (topMatch) {
      handleSelectLocation(topMatch);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Pressing Tab or Right Arrow accepts the inline ghost text
    if ((e.key === 'Tab' || e.key === 'ArrowRight') && ghostSuffix && topMatch) {
      if (e.key === 'Tab' || (inputRef.current && inputRef.current.selectionStart === value.length)) {
        e.preventDefault();
        handleCompleteWithGhost();
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setHighlightedIndex(prev => (prev < matchingPrefixList.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : matchingPrefixList.length - 1));
    } else if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < matchingPrefixList.length) {
        e.preventDefault();
        handleSelectLocation(matchingPrefixList[highlightedIndex].name);
      } else if (ghostSuffix && topMatch) {
        e.preventDefault();
        handleCompleteWithGhost();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search Input Container */}
      <div 
        className={cn(
          "relative w-full rounded-xl border-2 transition-all shadow-3xs flex items-center bg-white overflow-hidden",
          isFocused ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-300 hover:border-slate-400",
          className
        )}
      >
        {/* MapPin / Search Icon */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-20 flex items-center">
          <MapPin size={16} className={value ? "text-blue-600" : "text-slate-400"} />
        </div>

        {/* 
          INLINE GHOST TEXT UNDERLAY:
          Renders right inside the Destination Location box behind the cursor!
          If user types "Ra", it renders "Ra" (invisible) followed by "jshahi" in faint gray text.
        */}
        <div 
          className="absolute inset-0 pointer-events-none flex items-center pl-9 pr-24 py-2.5 text-xs sm:text-sm font-medium overflow-hidden whitespace-pre select-none z-0"
          aria-hidden="true"
        >
          <span className="opacity-0 whitespace-pre">{value}</span>
          {ghostSuffix && (
            <span className="text-slate-400/90 whitespace-pre font-normal">
              {ghostSuffix}
            </span>
          )}
        </div>

        {/* Foreground Input */}
        <input
          ref={inputRef}
          id={id}
          type="text"
          required={required}
          value={value}
          onChange={e => {
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => {
            setIsFocused(true);
            if (value.trim()) setIsOpen(true);
          }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck="false"
          className="relative z-10 w-full pl-9 pr-24 py-2.5 bg-transparent outline-none text-slate-800 text-xs sm:text-sm font-medium"
        />

        {/* Inline Completion Pill & Clear Button inside input */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-20">
          {ghostSuffix && topMatch && (
            <button
              type="button"
              onClick={handleCompleteWithGhost}
              title="সম্পূর্ণ করতে চাপুন (Tab ⇥)"
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold border border-blue-200 transition-all cursor-pointer active:scale-95 shadow-3xs"
            >
              <span>{topMatch}</span>
              <span className="text-[9px] bg-blue-200/80 text-blue-900 px-1 rounded font-mono hidden sm:inline">
                Tab ⇥
              </span>
            </button>
          )}

          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="w-5 h-5 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="মুছে ফেলুন"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Suggested Matching Names Dropdown right under the input */}
      {isOpen && value.trim().length > 0 && matchingPrefixList.length > 0 && (
        <div 
          className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="divide-y divide-slate-100">
            {matchingPrefixList.map((item, idx) => {
              const isHighlighted = idx === highlightedIndex;
              const q = value.trim().toLowerCase();
              const lower = item.name.toLowerCase();
              const startsWithQ = lower.startsWith(q);

              return (
                <div
                  key={`${item.name}-${idx}`}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => handleSelectLocation(item.name)}
                  className={cn(
                    "px-3.5 py-2.5 flex items-center justify-between cursor-pointer transition-colors text-xs select-none",
                    isHighlighted ? "bg-blue-50 text-blue-900" : "hover:bg-slate-50 text-slate-800"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Navigation size={13} className="text-blue-500 shrink-0" />
                    <div className="truncate text-xs sm:text-sm">
                      {startsWithQ ? (
                        <>
                          <span className="text-slate-500 font-normal">{item.name.substring(0, value.length)}</span>
                          <strong className="text-slate-900 font-bold">{item.name.substring(value.length)}</strong>
                        </>
                      ) : (
                        <span className="font-semibold text-slate-800">{item.name}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-blue-600 font-medium shrink-0 ml-2">
                    নির্বাচন করুন
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
