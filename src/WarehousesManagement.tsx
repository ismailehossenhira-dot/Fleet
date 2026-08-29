import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Truck, 
  Users, 
  ArrowLeftRight, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Filter, 
  MapPin, 
  Repeat, 
  Send, 
  History, 
  ChevronRight, 
  PlusCircle, 
  ShieldCheck, 
  Sparkles,
  ExternalLink,
  Layers,
  Check,
  UserCheck
} from 'lucide-react';
import { useWarehouse, Warehouse } from './WarehouseContext';
import { subscribeToCollection, batchAssignWarehouse, WarehouseTransferRecord } from './db';
import { useAuth } from './AuthContext';
import { VehicleTransferModal } from './components/VehicleTransferModal';
import { StaffTransferModal } from './components/StaffTransferModal';
import { cn } from './lib/utils';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export const WarehousesManagement: React.FC = () => {
  const { warehouses, selectedWarehouse, setSelectedWarehouse, getWarehouseBadge } = useWarehouse();
  const { profile, isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);

  // Modals
  const [selectedVehicleForTransfer, setSelectedVehicleForTransfer] = useState<any | null>(null);
  const [isVehicleTransferOpen, setIsVehicleTransferOpen] = useState(false);

  const [selectedStaffForTransfer, setSelectedStaffForTransfer] = useState<any | null>(null);
  const [isStaffTransferOpen, setIsStaffTransferOpen] = useState(false);

  // Quick picker modals
  const [isQuickVehiclePickerOpen, setIsQuickVehiclePickerOpen] = useState(false);
  const [isQuickStaffPickerOpen, setIsQuickStaffPickerOpen] = useState(false);

  // Search & Filters for Transfers
  const [transferSearch, setTransferSearch] = useState('');
  const [transferTypeFilter, setTransferTypeFilter] = useState<'all' | 'vehicle' | 'staff' | 'exchange'>('all');
  const [transferDepoFilter, setTransferDepoFilter] = useState<string>('all');

  // Batch assign state
  const [isBatchAssigning, setIsBatchAssigning] = useState(false);
  const [batchSuccess, setBatchSuccess] = useState('');

  useEffect(() => {
    const unsubV = subscribeToCollection('vehicles', setVehicles);
    const unsubD = subscribeToCollection('drivers', setDrivers);
    const unsubT = subscribeToCollection('transfers', setTransfers);
    const unsubTrips = subscribeToCollection('trips', setTrips);
    return () => {
      unsubV();
      unsubD();
      unsubT();
      unsubTrips();
    };
  }, []);

  // Compute stats per warehouse
  const warehouseStats = useMemo(() => {
    const map: Record<string, {
      totalVehicles: number;
      availableVehicles: number;
      onTripVehicles: number;
      maintenanceVehicles: number;
      totalDrivers: number;
      totalHelpers: number;
      activeTrips: number;
    }> = {};

    warehouses.forEach(wh => {
      map[wh.name] = {
        totalVehicles: 0,
        availableVehicles: 0,
        onTripVehicles: 0,
        maintenanceVehicles: 0,
        totalDrivers: 0,
        totalHelpers: 0,
        activeTrips: 0
      };
    });

    // Count vehicles
    vehicles.forEach(v => {
      const wh = v.warehouse || 'মোহাম্মদপুর';
      if (map[wh]) {
        map[wh].totalVehicles += 1;
        if (v.status === 'Available') map[wh].availableVehicles += 1;
        else if (v.status === 'On Trip' || v.status === 'Pending Out Scan') map[wh].onTripVehicles += 1;
        else if (v.status === 'Maintenance') map[wh].maintenanceVehicles += 1;
      }
    });

    // Count drivers
    drivers.forEach(d => {
      const wh = d.warehouse || 'মোহাম্মদপুর';
      if (map[wh]) {
        if (d.role === 'Helper') {
          map[wh].totalHelpers += 1;
        } else {
          map[wh].totalDrivers += 1;
        }
      }
    });

    // Count running trips
    trips.forEach(t => {
      if (t.status === 'Running') {
        const wh = t.originWarehouse;
        if (wh && map[wh]) {
          map[wh].activeTrips += 1;
        }
      }
    });

    return map;
  }, [warehouses, vehicles, drivers, trips]);

  // Overall aggregate stats
  const totalStats = useMemo(() => {
    let totalVehicles = vehicles.length;
    let availableVehicles = vehicles.filter(v => v.status === 'Available').length;
    let onTripVehicles = vehicles.filter(v => v.status === 'On Trip' || v.status === 'Pending Out Scan').length;
    let maintenanceVehicles = vehicles.filter(v => v.status === 'Maintenance').length;
    let totalDrivers = drivers.filter(d => d.role !== 'Helper').length;
    let totalHelpers = drivers.filter(d => d.role === 'Helper').length;
    let activeTrips = trips.filter(t => t.status === 'Running').length;

    return {
      totalVehicles,
      availableVehicles,
      onTripVehicles,
      maintenanceVehicles,
      totalDrivers,
      totalHelpers,
      activeTrips
    };
  }, [vehicles, drivers, trips]);

  // Unassigned items count (items without warehouse or marked 'অনির্ধারিত')
  const unassignedVehicles = useMemo(() => {
    return vehicles.filter(v => !v.warehouse || v.warehouse === 'অনির্ধারিত');
  }, [vehicles]);

  const unassignedDrivers = useMemo(() => {
    return drivers.filter(d => !d.warehouse || d.warehouse === 'অনির্ধারিত');
  }, [drivers]);

  // Handle batch assigning unassigned items to Mohammadpur (central)
  const handleBatchAssign = async (targetWh: string = 'মোহাম্মদপুর') => {
    if (unassignedVehicles.length === 0 && unassignedDrivers.length === 0) return;
    setIsBatchAssigning(true);
    setBatchSuccess('');

    try {
      if (unassignedVehicles.length > 0) {
        await batchAssignWarehouse('vehicles', unassignedVehicles.map(v => v.id), targetWh, profile);
      }
      if (unassignedDrivers.length > 0) {
        await batchAssignWarehouse('drivers', unassignedDrivers.map(d => d.id), targetWh, profile);
      }
      setBatchSuccess(`সফলভাবে ${unassignedVehicles.length}টি গাড়ি এবং ${unassignedDrivers.length} জন স্টাফকে "${targetWh}" ডিপোতে নির্ধারিত করা হয়েছে!`);
      setTimeout(() => setBatchSuccess(''), 4000);
    } catch (err: any) {
      alert(`সমস্যা হয়েছে: ${err.message}`);
    } finally {
      setIsBatchAssigning(false);
    }
  };

  // Filtered transfers log
  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
      // Type filter
      if (transferTypeFilter !== 'all' && t.type !== transferTypeFilter) return false;
      // Depo filter
      if (transferDepoFilter !== 'all') {
        if (t.fromWarehouse !== transferDepoFilter && t.toWarehouse !== transferDepoFilter) return false;
      }
      // Search
      if (transferSearch.trim()) {
        const q = transferSearch.toLowerCase();
        const matchName = t.targetName?.toLowerCase().includes(q);
        const matchFrom = t.fromWarehouse?.toLowerCase().includes(q);
        const matchTo = t.toWarehouse?.toLowerCase().includes(q);
        const matchReason = t.reason?.toLowerCase().includes(q);
        const matchUser = t.transferredBy?.toLowerCase().includes(q);
        if (!matchName && !matchFrom && !matchTo && !matchReason && !matchUser) return false;
      }
      return true;
    });
  }, [transfers, transferTypeFilter, transferDepoFilter, transferSearch]);

  const handleSelectWarehouseAndNavigate = (whName: string, targetPath: string) => {
    setSelectedWarehouse(whName);
    navigate(targetPath);
  };

  // Selected warehouse object & stats
  const activeWhObj = warehouses.find(w => w.name === selectedWarehouse);
  const activeStats = activeWhObj ? warehouseStats[activeWhObj.name] : null;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-blue-500/10 pointer-events-none rounded-full blur-3xl transform translate-x-1/2"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full text-xs font-black tracking-wider uppercase flex items-center gap-1.5 shadow-2xs">
                <Building2 size={13} />
                <span>মাল্টি-ওয়্যারহাউজ ফ্লিট সিস্টেম</span>
              </span>
              <span className="text-xs text-slate-300 font-bold bg-white/10 px-2.5 py-0.5 rounded-full">
                ১০টি জোন ও ডিপো হাব
              </span>
              {selectedWarehouse !== 'all' && (
                <span className="text-xs text-emerald-300 font-bold bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Check size={12} />
                  <span>বর্তমান ফিল্টার: {selectedWarehouse}</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              ওয়্যারহাউজ ব্যবস্থাপনা ও ট্রান্সফার হাব (Warehouse Hub)
            </h1>
            <p className="text-sm text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
              মোহাম্মদপুর, সাভার, ভাঙ্গা, কুমিল্লা, চিটাগাং, রংপুর, সিলেট, মিরপুর, খুলনা ও যশোর ডিপোর গাড়ি, ড্রাইভার ও হেলপার আলাদাভাবে পর্যবেক্ষণ, ফিল্টার ও পারস্পরিক বদলি (Exchange / Transfer) করুন।
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => setIsQuickVehiclePickerOpen(true)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-black shadow-md flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <Truck size={16} />
              <span>গাড়ি ট্রান্সফার / বদলি</span>
            </button>

            <button
              onClick={() => setIsQuickStaffPickerOpen(true)}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs sm:text-sm font-black shadow-md flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <Users size={16} />
              <span>স্টাফ ট্রান্সফার</span>
            </button>
          </div>
        </div>

        {/* Global Stats bar inside header */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3 border border-white/10">
            <div className="text-[10px] uppercase font-bold text-slate-400">মোট সক্রিয় ডিপো</div>
            <div className="text-2xl font-black text-white mt-0.5">১০টি ডিপো</div>
          </div>
          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3 border border-white/10">
            <div className="text-[10px] uppercase font-bold text-slate-400">মোট নিবন্ধিত গাড়ি</div>
            <div className="text-2xl font-black text-blue-300 mt-0.5">{totalStats.totalVehicles} টি</div>
          </div>
          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3 border border-white/10">
            <div className="text-[10px] uppercase font-bold text-slate-400">মোট চালক ও সহকারী</div>
            <div className="text-2xl font-black text-purple-300 mt-0.5">{drivers.length} জন</div>
          </div>
          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3 border border-white/10">
            <div className="text-[10px] uppercase font-bold text-slate-400">মোট সম্পন্ন বদলি লগ</div>
            <div className="text-2xl font-black text-emerald-300 mt-0.5">{transfers.length} টি</div>
          </div>
        </div>
      </div>

      {/* Unassigned Notification Banner (If Any) */}
      {(unassignedVehicles.length > 0 || unassignedDrivers.length > 0) && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle size={22} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-900">
                অনির্ধারিত গাড়ি ও স্টাফ চিহ্নিত হয়েছে
              </h4>
              <p className="text-xs text-amber-700 mt-0.5">
                {unassignedVehicles.length}টি গাড়ি এবং {unassignedDrivers.length} জন স্টাফের জন্য কোনো ডিপো সেট করা নেই। আপনি এক ক্লিকে তাদের ডিফল্ট ডিপো (মোহাম্মদপুর)-এ যুক্ত করতে পারেন।
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleBatchAssign('মোহাম্মদপুর')}
              disabled={isBatchAssigning}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-2 cursor-pointer transition-all disabled:opacity-60"
            >
              {isBatchAssigning ? 'অ্যাসাইন হচ্ছে...' : 'মোহাম্মদপুরে যুক্ত করুন'}
            </button>
          </div>
        </div>
      )}

      {batchSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-600" />
          <span>{batchSuccess}</span>
        </div>
      )}

      {/* Master Warehouse Switcher & Options Tab Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Building2 size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">ওয়্যারহাউজ অপশন ও দ্রুত ফিল্টার (Depot Selector)</h3>
              <p className="text-[11px] text-slate-500">যেকোনো ডিপোতে ক্লিক করে এক ক্লিকে পুরো সিস্টেমের ভিউ পরিবর্তন করুন</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">সিলেক্টেড মোড:</span>
            <span className={cn(
              "px-3 py-1 rounded-xl text-xs font-black border",
              selectedWarehouse === 'all'
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-blue-50 text-blue-800 border-blue-200"
            )}>
              {selectedWarehouse === 'all' ? '🌐 সকল ডিপো (Global View)' : `🏢 ${selectedWarehouse}`}
            </span>
          </div>
        </div>

        {/* Horizontal Tab Pills Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {/* All Warehouses Option Button */}
          <button
            type="button"
            onClick={() => setSelectedWarehouse('all')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-2 border cursor-pointer shrink-0 shadow-2xs",
              selectedWarehouse === 'all'
                ? "bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            )}
          >
            <span>🌐</span>
            <span>সকল ডিপো (All Warehouses)</span>
            <span className={cn(
              "px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold",
              selectedWarehouse === 'all' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
            )}>
              {vehicles.length}
            </span>
          </button>

          {/* 10 Individual Depot Buttons */}
          {warehouses.map((wh) => {
            const isSelected = selectedWarehouse === wh.name;
            const stats = warehouseStats[wh.name];
            return (
              <button
                key={wh.id}
                type="button"
                onClick={() => setSelectedWarehouse(wh.name)}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 border cursor-pointer shrink-0 shadow-2xs",
                  isSelected
                    ? `${wh.bgColor} ${wh.borderColor} ${wh.textColor} ring-2 ring-blue-500 shadow-md`
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                )}
              >
                <span className={cn(
                  "px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border",
                  isSelected ? `${wh.bgColor} ${wh.borderColor} ${wh.textColor}` : "bg-slate-100 text-slate-600 border-slate-200"
                )}>
                  {wh.code}
                </span>
                <span>{wh.name}</span>
                {stats && (
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                    isSelected ? "bg-black/10 text-current font-bold" : "bg-slate-100 text-slate-500"
                  )}>
                    {stats.totalVehicles}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Warehouse Detailed Drilldown Panel */}
      {activeWhObj && activeStats && selectedWarehouse !== 'all' ? (
        <div className="bg-white rounded-2xl border-2 border-blue-400/80 p-5 shadow-md animate-in fade-in duration-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-black border",
                  activeWhObj.bgColor, activeWhObj.borderColor, activeWhObj.textColor
                )}>
                  {activeWhObj.code}
                </span>
                <h3 className="text-xl font-black text-slate-900">
                  {activeWhObj.name} ডিপো বিস্তারিত ({activeWhObj.nameEn})
                </h3>
                <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                  <MapPin size={12} className="text-slate-400" />
                  <span>জোন: {activeWhObj.region}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                এই ডিপোর বর্তমান ফ্লিট গাড়ি সংখ্যা, ড্রাইভার/সহকারী স্টাফ এবং চলমান অপারেশন রিপোর্ট
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectWarehouseAndNavigate(activeWhObj.name, '/vehicles')}
                className="px-3.5 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Truck size={14} />
                <span>এই ডিপোর গাড়ি ({activeStats.totalVehicles})</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectWarehouseAndNavigate(activeWhObj.name, '/drivers')}
                className="px-3.5 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Users size={14} />
                <span>এই ডিপোর স্টাফ ({activeStats.totalDrivers + activeStats.totalHelpers})</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectWarehouseAndNavigate(activeWhObj.name, '/new-trip')}
                className="px-3.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Send size={14} />
                <span>নতুন ট্রিপ শুরু</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedWarehouse('all')}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
              >
                <span>সব ডিপো দেখুন</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 block">মোট ফ্লিট গাড়ি</span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block">{activeStats.totalVehicles} টি</span>
            </div>
            <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-100">
              <span className="text-[11px] font-bold text-emerald-700 block">উপলব্ধ (Available)</span>
              <span className="text-xl font-black text-emerald-700 mt-0.5 block">{activeStats.availableVehicles} টি</span>
            </div>
            <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100">
              <span className="text-[11px] font-bold text-blue-700 block">ট্রিপে আছে (On Trip)</span>
              <span className="text-xl font-black text-blue-700 mt-0.5 block">{activeStats.onTripVehicles} টি</span>
            </div>
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-100">
              <span className="text-[11px] font-bold text-amber-700 block">মেইনটেন্যান্স (Maint.)</span>
              <span className="text-xl font-black text-amber-700 mt-0.5 block">{activeStats.maintenanceVehicles} টি</span>
            </div>
            <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-100">
              <span className="text-[11px] font-bold text-purple-700 block">চালকের সংখ্যা</span>
              <span className="text-xl font-black text-purple-700 mt-0.5 block">{activeStats.totalDrivers} জন</span>
            </div>
            <div className="p-3 bg-teal-50/70 rounded-xl border border-teal-100">
              <span className="text-[11px] font-bold text-teal-700 block">সহকারী (Helpers)</span>
              <span className="text-xl font-black text-teal-700 mt-0.5 block">{activeStats.totalHelpers} জন</span>
            </div>
          </div>
        </div>
      ) : (
        /* Global Overview when All Warehouses is selected */
        <div className="bg-gradient-to-r from-blue-50/60 via-indigo-50/40 to-slate-50 border border-blue-200/80 rounded-2xl p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blue-100">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-xs">
                🌐
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  সকল ডিপো একনজরে (Global Depots Consolidated View)
                </h3>
                <p className="text-xs text-slate-600">
                  বর্তমানে সকল ১০টি ডিপোর সামগ্রিক গাড়িবহর ও স্টাফ তথ্য প্রদর্শিত হচ্ছে
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 font-bold bg-white px-3 py-1.5 rounded-xl border border-blue-100">
              মোট হাব: <span className="text-blue-700 font-black">১০টি</span> | মোট গাড়ি: <span className="text-blue-700 font-black">{totalStats.totalVehicles}টি</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
            <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 block">মোট সক্রিয় গাড়ি</span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block">{totalStats.totalVehicles} টি</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-emerald-200/80 shadow-2xs">
              <span className="text-[11px] font-bold text-emerald-700 block">Available (ফ্রি)</span>
              <span className="text-xl font-black text-emerald-700 mt-0.5 block">{totalStats.availableVehicles} টি</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-blue-200/80 shadow-2xs">
              <span className="text-[11px] font-bold text-blue-700 block">চলমান ট্রিপে আছে</span>
              <span className="text-xl font-black text-blue-700 mt-0.5 block">{totalStats.onTripVehicles} টি</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-amber-200/80 shadow-2xs">
              <span className="text-[11px] font-bold text-amber-700 block">মেরামতাধীন</span>
              <span className="text-xl font-black text-amber-700 mt-0.5 block">{totalStats.maintenanceVehicles} টি</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-purple-200/80 shadow-2xs">
              <span className="text-[11px] font-bold text-purple-700 block">মোট ড্রাইভার</span>
              <span className="text-xl font-black text-purple-700 mt-0.5 block">{totalStats.totalDrivers} জন</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-teal-200/80 shadow-2xs">
              <span className="text-[11px] font-bold text-teal-700 block">মোট হেলপার</span>
              <span className="text-xl font-black text-teal-700 mt-0.5 block">{totalStats.totalHelpers} জন</span>
            </div>
          </div>
        </div>
      )}

      {/* 10 Warehouses Hub Grid - আগের মতো সাজানো গোছানো কার্ড ভিউ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Building2 size={20} className="text-blue-600" />
              <span>১০টি আঞ্চলিক ডিপোর ফ্লিট ও স্টাফ সামারি কার্ড</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              প্রতিটি কার্ডে ডিপোর নাম, জোন, গাড়ি উপস্থিতি এবং ড্রাইভারের সংখ্যা সাজানো রয়েছে
            </p>
          </div>

          {selectedWarehouse !== 'all' && (
            <button
              onClick={() => setSelectedWarehouse('all')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 cursor-pointer"
            >
              <span>ফিল্টার রিসেট (সকল ডিপো)</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {warehouses.map((wh) => {
            const stats = warehouseStats[wh.name] || {
              totalVehicles: 0,
              availableVehicles: 0,
              onTripVehicles: 0,
              maintenanceVehicles: 0,
              totalDrivers: 0,
              totalHelpers: 0,
              activeTrips: 0
            };
            const isSelected = selectedWarehouse === wh.name;

            return (
              <div
                key={wh.id}
                className={cn(
                  "bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-2xs hover:shadow-md",
                  isSelected
                    ? `${wh.borderColor} ring-2 ring-blue-500 shadow-md ${wh.bgColor}/20`
                    : "border-slate-200/90 hover:border-slate-300"
                )}
              >
                {/* Top Section */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-slate-900">{wh.name}</span>
                        <span className={cn(
                          "text-[10px] font-black px-1.5 py-0.5 rounded border shadow-2xs",
                          wh.bgColor, wh.borderColor, wh.textColor
                        )}>
                          {wh.code}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 font-medium mt-0.5">
                        <MapPin size={11} />
                        <span>{wh.region}</span>
                      </p>
                    </div>

                    {isSelected && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-600 text-white flex items-center gap-1">
                        <Check size={11} />
                        <span>অ্যাক্টিভ</span>
                      </span>
                    )}
                  </div>

                  {/* Vehicle Counter Grid */}
                  <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100 mb-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-600 flex items-center gap-1.5">
                        <Truck size={13} className="text-slate-400" />
                        <span>মোট গাড়ি</span>
                      </span>
                      <span className="font-black text-slate-900 text-sm">{stats.totalVehicles} টি</span>
                    </div>

                    {/* Breakdown */}
                    <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-200/60 text-center">
                      <div className="p-1 rounded bg-white border border-slate-100">
                        <span className="text-[9px] text-slate-400 block font-bold">Free</span>
                        <span className="text-xs font-black text-emerald-600">{stats.availableVehicles}</span>
                      </div>
                      <div className="p-1 rounded bg-white border border-slate-100">
                        <span className="text-[9px] text-slate-400 block font-bold">Trip</span>
                        <span className="text-xs font-black text-blue-600">{stats.onTripVehicles}</span>
                      </div>
                      <div className="p-1 rounded bg-white border border-slate-100">
                        <span className="text-[9px] text-slate-400 block font-bold">Maint.</span>
                        <span className="text-xs font-black text-amber-600">{stats.maintenanceVehicles}</span>
                      </div>
                    </div>
                  </div>

                  {/* Staff Counters */}
                  <div className="flex items-center justify-between text-xs px-1 text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Users size={13} className="text-purple-600" />
                      <span>ড্রাইভার: <strong className="text-slate-900">{stats.totalDrivers}</strong></span>
                    </div>
                    <div className="text-slate-400">|</div>
                    <div>
                      <span>সহকারী: <strong className="text-slate-900">{stats.totalHelpers}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedWarehouse(wh.name)}
                    className={cn(
                      "flex-1 py-1.5 px-2 rounded-lg font-bold transition-all text-center cursor-pointer text-xs",
                      isSelected
                        ? "bg-slate-900 text-white"
                        : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    {isSelected ? 'নির্বাচিত ডিপো' : 'ফিল্টার করুন'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectWarehouseAndNavigate(wh.name, '/vehicles')}
                    title="এই ডিপোর গাড়ি তালিকা দেখুন"
                    className="p-1.5 rounded-lg bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <Truck size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectWarehouseAndNavigate(wh.name, '/drivers')}
                    title="এই ডিপোর স্টাফ তালিকা দেখুন"
                    className="p-1.5 rounded-lg bg-white border border-slate-200 text-purple-600 hover:bg-purple-50 transition-colors"
                  >
                    <Users size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inter-Warehouse Transfer & Exchange Log */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <History size={18} className="text-indigo-600" />
              <span>ইন্টার-ডিপো ট্রান্সফার ও এক্সচেঞ্জ হিস্ট্রি (Transfer Logs)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              কোন গাড়ি বা স্টাফ কোন ডিপো থেকে কোথায় বদলি বা এক্সচেঞ্জ করা হয়েছে তার সম্পূর্ণ লগ
            </p>
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="গাড়ি, স্টাফ বা নোট খুঁজুন..."
                value={transferSearch}
                onChange={(e) => setTransferSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-slate-800 w-48 sm:w-56"
              />
            </div>

            {/* Type Filter */}
            <select
              value={transferTypeFilter}
              onChange={(e) => setTransferTypeFilter(e.target.value as any)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="all">সব ধরনের বদলি</option>
              <option value="vehicle">গাড়ি ট্রান্সফার</option>
              <option value="exchange">গাড়ি এক্সচেঞ্জ (Swap)</option>
              <option value="staff">স্টাফ ট্রান্সফার</option>
            </select>

            {/* Depo Filter */}
            <select
              value={transferDepoFilter}
              onChange={(e) => setTransferDepoFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="all">সকল ডিপো</option>
              {warehouses.map(wh => (
                <option key={wh.id} value={wh.name}>{wh.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Transfers Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">তারিখ ও সময়</th>
                <th className="px-4 py-3">ধরন</th>
                <th className="px-4 py-3">টার্গেট আইটেম</th>
                <th className="px-4 py-3">উৎস ডিপো</th>
                <th className="px-4 py-3 text-center">দিক</th>
                <th className="px-4 py-3">গন্তব্য ডিপো</th>
                <th className="px-4 py-3">কারণ / নোট</th>
                <th className="px-4 py-3">অনুমোদনকারী</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransfers.map((item) => {
                const fromBadge = getWarehouseBadge(item.fromWarehouse);
                const toBadge = getWarehouseBadge(item.toWarehouse);
                const dateStr = item.createdAt?.toDate 
                  ? item.createdAt.toDate().toLocaleString('bn-BD', { dateStyle: 'short', timeStyle: 'short' })
                  : 'সম্প্রতি';

                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {dateStr}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {item.type === 'exchange' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800">
                          <Repeat size={11} />
                          <span>এক্সচেঞ্জ</span>
                        </span>
                      ) : item.type === 'staff' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800">
                          <Users size={11} />
                          <span>{item.targetRole || 'স্টাফ'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">
                          <Truck size={11} />
                          <span>গাড়ি</span>
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span>{item.targetName}</span>
                        {item.exchangeVehiclePlate && (
                          <span className="text-[10px] text-indigo-600 font-semibold flex items-center gap-1">
                            <Repeat size={10} />
                            <span>↔ {item.exchangeVehiclePlate}</span>
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border",
                        fromBadge.bg, fromBadge.border, fromBadge.textCol
                      )}>
                        <Building2 size={11} />
                        <span>{item.fromWarehouse}</span>
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center text-slate-400">
                      {item.type === 'exchange' ? (
                        <ArrowLeftRight size={14} className="inline text-indigo-500" />
                      ) : (
                        <span className="text-slate-500 font-black">➔</span>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border",
                        toBadge.bg, toBadge.border, toBadge.textCol
                      )}>
                        <Building2 size={11} />
                        <span>{item.toWarehouse}</span>
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                      {item.reason || '-'}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-[11px] font-medium">
                      {item.transferredBy || 'Admin'}
                    </td>
                  </tr>
                );
              })}

              {filteredTransfers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    <History size={28} className="mx-auto mb-2 opacity-40" />
                    <p className="font-bold">কোন ট্রান্সফার রেকর্ড পাওয়া যায়নি</p>
                    <p className="text-[11px] mt-1">গাড়ি বা স্টাফ বদলি করলে এখানে বিস্তারিত ইতিহাস প্রদর্শিত হবে</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Vehicle Picker Modal */}
      {isQuickVehiclePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 flex items-center gap-2">
                <Truck size={18} className="text-blue-600" />
                <span>ট্রান্সফারের জন্য গাড়ি নির্বাচন করুন</span>
              </h3>
              <button 
                onClick={() => setIsQuickVehiclePickerOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-3 overflow-y-auto space-y-1.5 flex-1">
              {vehicles.map((v) => {
                const whBadge = getWarehouseBadge(v.warehouse);
                return (
                  <button
                    key={v.id}
                    onClick={() => {
                      setSelectedVehicleForTransfer(v);
                      setIsQuickVehiclePickerOpen(false);
                      setIsVehicleTransferOpen(true);
                    }}
                    className="w-full p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 flex items-center justify-between text-left transition-all group cursor-pointer"
                  >
                    <div>
                      <span className="font-black text-xs text-slate-900 block group-hover:text-blue-700">
                        {v.vehicleNumber}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {v.type} • স্ট্যাটাস: {v.status}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className={cn(
                        "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border",
                        whBadge.bg, whBadge.border, whBadge.textCol
                      )}>
                        <Building2 size={10} />
                        <span>{v.warehouse || 'অনির্ধারিত'}</span>
                      </span>
                      <span className="block text-[10px] text-blue-600 font-bold mt-1 group-hover:underline">
                        ট্রান্সফার করুন →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Quick Staff Picker Modal */}
      {isQuickStaffPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 flex items-center gap-2">
                <Users size={18} className="text-purple-600" />
                <span>ট্রান্সফারের জন্য স্টাফ নির্বাচন করুন</span>
              </h3>
              <button 
                onClick={() => setIsQuickStaffPickerOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-3 overflow-y-auto space-y-1.5 flex-1">
              {drivers.map((d) => {
                const whBadge = getWarehouseBadge(d.warehouse);
                return (
                  <button
                    key={d.id}
                    onClick={() => {
                      setSelectedStaffForTransfer(d);
                      setIsQuickStaffPickerOpen(false);
                      setIsStaffTransferOpen(true);
                    }}
                    className="w-full p-3 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50/50 flex items-center justify-between text-left transition-all group cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-xs text-slate-900 block group-hover:text-purple-700">
                          {d.name}
                        </span>
                        <span className={cn(
                          "text-[9px] font-bold px-1.5 py-0.2 rounded",
                          d.role === 'Helper' ? "bg-teal-100 text-teal-800" : "bg-blue-100 text-blue-800"
                        )}>
                          {d.role === 'Helper' ? 'সহকারী' : 'ড্রাইভার'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {d.driverId} {d.phoneNumber ? `• ${d.phoneNumber}` : ''}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className={cn(
                        "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border",
                        whBadge.bg, whBadge.border, whBadge.textCol
                      )}>
                        <Building2 size={10} />
                        <span>{d.warehouse || 'অনির্ধারিত'}</span>
                      </span>
                      <span className="block text-[10px] text-purple-600 font-bold mt-1 group-hover:underline">
                        ট্রান্সফার করুন →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Transfer Modal */}
      <VehicleTransferModal
        vehicle={selectedVehicleForTransfer}
        isOpen={isVehicleTransferOpen}
        onClose={() => {
          setIsVehicleTransferOpen(false);
          setSelectedVehicleForTransfer(null);
        }}
      />

      {/* Staff Transfer Modal */}
      <StaffTransferModal
        staff={selectedStaffForTransfer}
        isOpen={isStaffTransferOpen}
        onClose={() => {
          setIsStaffTransferOpen(false);
          setSelectedStaffForTransfer(null);
        }}
      />
    </div>
  );
};
