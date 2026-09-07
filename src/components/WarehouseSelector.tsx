import React, { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Check, Globe, MapPin, Search } from 'lucide-react';
import { useWarehouse, ALL_WAREHOUSES_KEY } from '../WarehouseContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface WarehouseSelectorProps {
  compact?: boolean;
  className?: string;
}

export const WarehouseSelector: React.FC<WarehouseSelectorProps> = ({ compact = false, className }) => {
  const { selectedWarehouse, setSelectedWarehouse, warehouses, currentWarehouseObj, isAll, isWarehouseLocked } = useWarehouse();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const filteredWarehouses = warehouses.filter(w => 
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.nameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.region.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // If user is locked to their designated warehouse, show clean non-switchable badge
  if (isWarehouseLocked) {
    return (
      <div 
        className={cn(
          "inline-flex items-center gap-2 rounded-xl font-bold select-none border shadow-2xs",
          compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-xs sm:text-sm",
          currentWarehouseObj?.bgColor || 'bg-blue-50',
          currentWarehouseObj?.borderColor || 'border-blue-200',
          currentWarehouseObj?.textColor || 'text-blue-800',
          className
        )}
        title={`আপনার অ্যাকাউন্টে নির্ধারিত ডিপো: ${currentWarehouseObj?.name || selectedWarehouse}`}
      >
        <Building2 size={compact ? 14 : 16} className="shrink-0 text-blue-600" />
        <span className="font-extrabold truncate">
          {currentWarehouseObj?.name || selectedWarehouse}
        </span>
        {currentWarehouseObj?.code && (
          <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-white/80 text-blue-900 shadow-2xs">
            {currentWarehouseObj.code}
          </span>
        )}
        <span className="text-[10px] font-medium text-slate-500 hidden sm:inline-block">
          (কর্মস্থল)
        </span>
      </div>
    );
  }

  return (
    <div className={cn("relative inline-block text-left", className)} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 rounded-xl transition-all font-bold select-none cursor-pointer border active:scale-95",
          compact
            ? "px-2.5 py-1.5 text-xs"
            : "px-3 py-2 text-xs sm:text-sm shadow-2xs",
          isAll
            ? "bg-slate-100/90 hover:bg-slate-200/80 border-slate-300/80 text-slate-800"
            : `${currentWarehouseObj?.bgColor || 'bg-blue-50'} ${currentWarehouseObj?.borderColor || 'border-blue-200'} ${currentWarehouseObj?.textColor || 'text-blue-800'} hover:opacity-90`
        )}
        title="বর্তমান ওয়ারহাউজ পরিবর্তন করুন"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {isAll ? (
            <Globe size={compact ? 14 : 16} className="text-slate-500 shrink-0" />
          ) : (
            <Building2 size={compact ? 14 : 16} className="shrink-0" />
          )}

          <div className="flex items-center gap-1.5 truncate">
            <span className="font-extrabold truncate">
              {isAll ? 'সকল ওয়ারহাউজ' : currentWarehouseObj?.name || selectedWarehouse}
            </span>
            {!isAll && currentWarehouseObj?.code && (
              <span className="text-[10px] font-black px-1 py-0.2 rounded bg-white/70 shadow-2xs">
                {currentWarehouseObj.code}
              </span>
            )}
          </div>
        </div>

        <ChevronDown 
          size={14} 
          className={cn("transition-transform duration-200 opacity-60 shrink-0", isOpen && "rotate-180")} 
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-slate-200/90 z-50 overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 size={14} className="text-blue-600" />
                  <span>ওয়ারহাউজ ফিল্টার (১০টি ডিপো)</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">গাড়ি ও স্টাফ দেখতে ডিপো নির্বাচন করুন</p>
              </div>
            </div>

            {/* Quick Search */}
            <div className="p-2 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ডিপো খুঁজুন (যেমন: সাভার, রংপুর)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:bg-white text-slate-800"
                />
              </div>
            </div>

            {/* List */}
            <div className="p-2 overflow-y-auto space-y-1 divide-y divide-slate-100 max-h-72">
              {/* All Option */}
              <button
                type="button"
                onClick={() => {
                  setSelectedWarehouse(ALL_WAREHOUSES_KEY);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors font-bold text-xs group cursor-pointer",
                  isAll 
                    ? "bg-blue-50 text-blue-800 font-black border border-blue-200" 
                    : "hover:bg-slate-100 text-slate-700"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-2xs",
                    isAll ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600 group-hover:bg-slate-300"
                  )}>
                    <Globe size={14} />
                  </div>
                  <div>
                    <p className="text-xs font-black">🌐 সকল ওয়ারহাউজ</p>
                    <p className="text-[10px] text-slate-400 font-medium">সমগ্র ফ্লিট ও সব ডিপো একসাথে দেখুন</p>
                  </div>
                </div>

                {isAll && <Check size={16} className="text-blue-600 shrink-0" />}
              </button>

              <div className="pt-1">
                {filteredWarehouses.map((wh) => {
                  const isSelected = selectedWarehouse === wh.name;
                  return (
                    <button
                      key={wh.id}
                      type="button"
                      onClick={() => {
                        setSelectedWarehouse(wh.name);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors text-xs group cursor-pointer my-0.5",
                        isSelected 
                          ? `${wh.bgColor} ${wh.textColor} font-black border ${wh.borderColor}` 
                          : "hover:bg-slate-100/90 text-slate-700 font-semibold"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 shadow-2xs",
                          isSelected ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 border border-slate-200"
                        )}>
                          {wh.code}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-black truncate flex items-center gap-1.5">
                            <span>{wh.name}</span>
                            <span className="text-[10px] font-normal text-slate-400">({wh.nameEn})</span>
                          </p>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                            <MapPin size={10} />
                            <span>{wh.region}</span>
                          </p>
                        </div>
                      </div>

                      {isSelected && <Check size={16} className={cn("shrink-0", wh.textColor)} />}
                    </button>
                  );
                })}

                {filteredWarehouses.length === 0 && (
                  <p className="text-center text-slate-400 text-xs py-4">কোন ওয়ারহাউজ পাওয়া যায়নি</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>মোট ১০টি আঞ্চলিক ডিপো</span>
              <a
                href="#/warehouses"
                onClick={() => setIsOpen(false)}
                className="text-blue-600 font-bold hover:underline"
              >
                ডিপো ওভারভিউ ও ট্রান্সফার →
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
