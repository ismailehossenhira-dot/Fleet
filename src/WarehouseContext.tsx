import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { cn } from './lib/utils';

export interface Warehouse {
  id: string;
  name: string;
  nameEn: string;
  code: string;
  region: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

export const DEFAULT_WAREHOUSES: Warehouse[] = [
  {
    id: 'mohammadpur',
    name: 'মোহাম্মদপুর',
    nameEn: 'Mohammadpur',
    code: 'MHP',
    region: 'ঢাকা মেট্রো',
    color: 'blue',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700'
  },
  {
    id: 'savar',
    name: 'সাভার',
    nameEn: 'Savar',
    code: 'SVR',
    region: 'ঢাকা উত্তর',
    color: 'emerald',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-700'
  },
  {
    id: 'bhanga',
    name: 'ভাঙ্গা',
    nameEn: 'Bhanga',
    code: 'BHG',
    region: 'ফরিদপুর / পদ্মা জোন',
    color: 'amber',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700'
  },
  {
    id: 'cumilla',
    name: 'কুমিল্লা',
    nameEn: 'Cumilla',
    code: 'CML',
    region: 'চট্টগ্রাম হাইওয়ে জোন',
    color: 'indigo',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    textColor: 'text-indigo-700'
  },
  {
    id: 'chittagong',
    name: 'চিটাগাং',
    nameEn: 'Chittagong',
    code: 'CTG',
    region: 'চট্টগ্রাম পোর্ট জোন',
    color: 'cyan',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    textColor: 'text-cyan-700'
  },
  {
    id: 'rangpur',
    name: 'রংপুর',
    nameEn: 'Rangpur',
    code: 'RNG',
    region: 'উত্তরবঙ্গ জোন',
    color: 'orange',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-700'
  },
  {
    id: 'sylhet',
    name: 'সিলেট',
    nameEn: 'Sylhet',
    code: 'SYL',
    region: 'সুরমা জোন',
    color: 'teal',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    textColor: 'text-teal-700'
  },
  {
    id: 'mirpur',
    name: 'মিরপুর',
    nameEn: 'Mirpur',
    code: 'MRP',
    region: 'ঢাকা মেট্রো',
    color: 'purple',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700'
  },
  {
    id: 'khulna',
    name: 'খুলনা',
    nameEn: 'Khulna',
    code: 'KLN',
    region: 'দক্ষিণবঙ্গ জোন',
    color: 'rose',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    textColor: 'text-rose-700'
  },
  {
    id: 'jashore',
    name: 'যশোর',
    nameEn: 'Jashore',
    code: 'JSR',
    region: 'খুলনা ডিভিশন',
    color: 'violet',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    textColor: 'text-violet-700'
  }
];

export const SUPPORTED_WAREHOUSES = DEFAULT_WAREHOUSES;

export const ALL_WAREHOUSES_KEY = 'all';

interface WarehouseContextType {
  selectedWarehouse: string; // 'all' or warehouse name e.g. 'মোহাম্মদপুর'
  setSelectedWarehouse: (wh: string) => void;
  warehouses: Warehouse[];
  currentWarehouseObj: Warehouse | null;
  getWarehouseObj: (nameOrId?: string) => Warehouse | undefined;
  getWarehouseBadge: (warehouseName?: string) => { text: string; bg: string; border: string; textCol: string; code: string };
  isAll: boolean;
  isWarehouseLocked: boolean;
  userWarehouse: string;
  assignedWarehouse: string;
  filterByWarehouse: <T>(items: T[], getWarehouseProp?: (item: T) => string | undefined) => T[];
}

const WarehouseContext = createContext<WarehouseContextType | undefined>(undefined);

export const WarehouseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, isSuperAdmin } = useAuth();
  
  // A user is locked to their warehouse if they have an assigned warehouse that is not 'all', and they are not global Super Admin
  const profileWh = profile?.warehouse?.trim();
  const isGlobalAdmin = isSuperAdmin || profileWh === 'all' || profileWh === 'সকল ডিপো';
  const isWarehouseLocked = !isGlobalAdmin && Boolean(profileWh && profileWh !== 'all');
  const userWarehouse = profileWh && profileWh !== 'all' ? profileWh : (isGlobalAdmin ? 'all' : 'মোহাম্মদপুর');

  const [selectedWarehouse, setSelectedWarehouseState] = useState<string>(() => {
    if (isWarehouseLocked && profileWh) {
      return profileWh;
    }
    try {
      const saved = localStorage.getItem('fleetflow_selected_warehouse');
      if (saved) return saved;
    } catch {
      // ignore
    }
    return ALL_WAREHOUSES_KEY;
  });

  // Keep state synchronized with profile assignment
  useEffect(() => {
    if (isWarehouseLocked && profileWh) {
      setSelectedWarehouseState(profileWh);
    }
  }, [isWarehouseLocked, profileWh]);

  const setSelectedWarehouse = (wh: string) => {
    if (isWarehouseLocked && profileWh) {
      // Cannot switch to another warehouse if account is scoped to one
      setSelectedWarehouseState(profileWh);
      return;
    }
    setSelectedWarehouseState(wh);
    try {
      localStorage.setItem('fleetflow_selected_warehouse', wh);
    } catch {
      // ignore
    }
  };

  const warehouses = DEFAULT_WAREHOUSES;

  const currentWarehouseObj = warehouses.find(
    w => w.name === selectedWarehouse || w.id === selectedWarehouse || w.nameEn.toLowerCase() === selectedWarehouse.toLowerCase()
  ) || null;

  // The warehouse to assign when this user creates a vehicle, staff, trip, or user ID
  const assignedWarehouse = isWarehouseLocked && profileWh
    ? profileWh
    : (selectedWarehouse !== ALL_WAREHOUSES_KEY ? selectedWarehouse : 'মোহাম্মদপুর');

  const getWarehouseObj = (nameOrId?: string) => {
    if (!nameOrId) return undefined;
    const clean = nameOrId.trim().toLowerCase();
    return warehouses.find(
      w => w.name === nameOrId || w.id === clean || w.nameEn.toLowerCase() === clean || w.code.toLowerCase() === clean
    );
  };

  const getWarehouseBadge = (warehouseName?: string) => {
    if (!warehouseName || warehouseName === 'all' || warehouseName === 'সকল ডিপো' || warehouseName === 'অনির্ধারিত') {
      return {
        text: warehouseName === 'all' || warehouseName === 'সকল ডিপো' ? 'সকল ডিপো' : (warehouseName || 'অনির্ধারিত'),
        bg: 'bg-slate-100',
        border: 'border-slate-200',
        textCol: 'text-slate-600',
        code: 'ALL'
      };
    }
    const wh = getWarehouseObj(warehouseName);
    if (wh) {
      return {
        text: wh.name,
        bg: wh.bgColor,
        border: wh.borderColor,
        textCol: wh.textColor,
        code: wh.code
      };
    }
    return {
      text: warehouseName,
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      textCol: 'text-blue-700',
      code: 'DEP'
    };
  };

  const isAll = selectedWarehouse === ALL_WAREHOUSES_KEY || selectedWarehouse === 'all' || selectedWarehouse === 'সকল ডিপো' || selectedWarehouse === 'সকল ওয়ারহাউজ';

  const filterByWarehouse = <T,>(items: T[], getWarehouseProp?: (item: T) => string | undefined): T[] => {
    if (isAll || !selectedWarehouse) return items;
    
    const targetObj = getWarehouseObj(selectedWarehouse);
    const targetClean = selectedWarehouse.trim().toLowerCase();

    return items.filter(item => {
      const rawWh = getWarehouseProp 
        ? getWarehouseProp(item) 
        : ((item as any)?.warehouse || (item as any)?.originWarehouse);
      
      const wh = rawWh ? String(rawWh).trim() : '';
      if (!wh) {
        // If an item has no warehouse explicitly specified, match if Mohammadpur (default hub) is selected
        if (targetClean === 'মোহাম্মদপুর' || targetClean === 'mohammadpur' || targetObj?.id === 'mohammadpur') {
          return true;
        }
        return false;
      }

      // Exact match
      if (wh === selectedWarehouse) return true;
      if (wh.toLowerCase() === targetClean) return true;

      // Match via warehouse object resolution (matches id, English name, code, Bengali name)
      const itemObj = getWarehouseObj(wh);
      if (targetObj && itemObj && targetObj.id === itemObj.id) return true;

      return false;
    });
  };

  return (
    <WarehouseContext.Provider
      value={{
        selectedWarehouse,
        setSelectedWarehouse,
        warehouses,
        currentWarehouseObj,
        getWarehouseObj,
        getWarehouseBadge,
        isAll,
        isWarehouseLocked,
        userWarehouse,
        assignedWarehouse,
        filterByWarehouse
      }}
    >
      {children}
    </WarehouseContext.Provider>
  );
};

export const WarehouseBadge: React.FC<{ warehouse?: string; className?: string }> = ({ warehouse, className = '' }) => {
  const { getWarehouseBadge } = useWarehouse();
  const badge = getWarehouseBadge(warehouse);
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border', badge.bg, badge.border, badge.textCol, className)}>
      <span className="font-mono text-[9px] opacity-75">[{badge.code}]</span>
      <span>{badge.text}</span>
    </span>
  );
};

export const useWarehouse = () => {
  const context = useContext(WarehouseContext);
  if (!context) {
    throw new Error('useWarehouse must be used within a WarehouseProvider');
  }
  return context;
};

