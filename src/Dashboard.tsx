import React, { useEffect, useState, useMemo } from 'react';
import { 
  Truck, 
  Users, 
  MapPin, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Activity,
  ArrowRight,
  Edit2,
  Search,
  Filter,
  Wrench,
  Check,
  AlertTriangle,
  Sparkles,
  PlusCircle,
  Eye,
  EyeOff,
  Layers,
  ChevronDown,
  ChevronUp,
  BarChart3,
  LayoutGrid,
  ListFilter,
  ArrowUpDown,
  Car,
  Zap,
  X,
  ShieldCheck,
  CheckCheck,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import { Card } from './components/Common';
import { VehicleModelManagementModal } from './components/VehicleModelManagement';
import { subscribeToCollection, updateVehicleStatus, cancelPendingTrip, VehicleModelRecord } from './db';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useSearch } from './SearchContext';
import { cn, VEHICLE_TYPES } from './lib/utils';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { useWarehouse, SUPPORTED_WAREHOUSES } from './WarehouseContext';

const StatCard: React.FC<{ 
  label: string, 
  value: number | string, 
  icon: any, 
  trend?: string,
  isActive?: boolean,
  onClick?: () => void
}> = ({ label, value, trend, icon: Icon, isActive, onClick }) => (
  <div 
    onClick={onClick}
    className={cn(
      "bg-surface border p-5 rounded-xl shadow-xs transition-all cursor-pointer select-none relative overflow-hidden",
      isActive 
        ? "border-blue-500 ring-2 ring-blue-100 bg-blue-50/40 scale-[1.02]" 
        : "border-border hover:border-slate-300 hover:shadow-md"
    )}
  >
    <div className="flex justify-between items-start">
      <div className="stat-label text-[10px] uppercase font-bold text-text-muted tracking-wider">{label}</div>
      <div className={cn("text-accent opacity-20", isActive && "opacity-60 text-blue-600")}><Icon size={14} /></div>
    </div>
    <div className="mt-1 flex items-baseline gap-2">
      <div className="text-2xl font-bold text-text-main">{value}</div>
      {trend && <span className="text-xs font-semibold text-accent">{trend}</span>}
    </div>
    <div className="text-[9px] font-bold mt-2 flex items-center gap-1">
      {isActive ? (
        <span className="text-blue-600 flex items-center gap-1 bg-blue-100/60 px-1.5 py-0.5 rounded">
          ✓ নির্বাচিত
        </span>
      ) : (
        <span className="text-slate-400 hover:text-slate-600">
          বিস্তারিত দেখতে ক্লিক করুন  →
        </span>
      )}
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const { profile, isAdmin, isSuperAdmin } = useAuth();
  const { selectedWarehouse, setSelectedWarehouse, filterByWarehouse, getWarehouseBadge } = useWarehouse();
  const canManageModels = isAdmin || isSuperAdmin;
  const { isEmerald, isCrimson, isAmber, currentThemeOption } = useTheme();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const { searchQuery } = useSearch();

  // Active Stat Card Filter state
  const [activeStatFilter, setActiveStatFilter] = useState<'activeFleet' | 'available' | 'onTrip' | 'maintenance' | null>(null);
  const [detailSearch, setDetailSearch] = useState('');

  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Maintenance Overview States
  const [maintSearch, setMaintSearch] = useState('');
  const [maintStatusFilter, setMaintStatusFilter] = useState<'All' | 'Maintenance' | 'WithNotes'>('All');
  const [maintTypeFilter, setMaintTypeFilter] = useState<string>('All');

  // Vehicle Models Visibility & View Mode State (Stored in localStorage)
  const [showVehicleModels, setShowVehicleModels] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('fleetflow_dashboard_show_models');
      return saved !== null ? saved === 'true' : true;
    } catch (e) {
      return true;
    }
  });
  const [modelViewMode, setModelViewMode] = useState<'grid' | 'bars'>(() => {
    try {
      const saved = localStorage.getItem('fleetflow_dashboard_model_view_mode');
      return (saved === 'bars' || saved === 'grid') ? saved : 'grid';
    } catch (e) {
      return 'grid';
    }
  });
  const [modelSortBy, setModelSortBy] = useState<'count_desc' | 'name_asc' | 'available_desc' | 'ontrip_desc'>('count_desc');
  const [modelSearchFilter, setModelSearchFilter] = useState<string>('');
  const [selectedModelFilter, setSelectedModelFilter] = useState<string | null>(null);
  const [drilldownVehicleSearch, setDrilldownVehicleSearch] = useState<string>('');
  const [customModels, setCustomModels] = useState<VehicleModelRecord[]>([]);
  const [showModelManagement, setShowModelManagement] = useState<boolean>(false);

  const toggleShowVehicleModels = () => {
    setShowVehicleModels(prev => {
      const next = !prev;
      try {
        localStorage.setItem('fleetflow_dashboard_show_models', String(next));
      } catch (e) {}
      return next;
    });
  };

  const handleSetModelViewMode = (mode: 'grid' | 'bars') => {
    setModelViewMode(mode);
    try {
      localStorage.setItem('fleetflow_dashboard_model_view_mode', mode);
    } catch (e) {}
  };

  // Bengali quotes rotating every 10 seconds
  const bengaliQuotes = [
    "নিরাপদ পথচলাই জীবনের প্রথম জয়।",
    "গতি কমান, জীবন বাঁচান।",
    "সময়ের চেয়ে জীবনের মূল্য অনেক বেশি।",
    "শৃঙ্খলা মেনে চলুন, নিরাপদে গন্তব্যে পৌঁছান।",
    "একটি দুর্ঘটনা সারাজীবনের কান্না।",
    "সাবধানতা অবলম্বন করুন, পরিবার আপনার অপেক্ষায় আছে।",
    "ধৈর্যই চালকের সর্বোত্তম শক্তি।",
    "সঠিক সময়ে সঠিক সিদ্ধান্তই দুর্ঘটনার হাত থেকে রক্ষা করে।"
  ];
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex(prev => (prev + 1) % bengaliQuotes.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubVehicles = subscribeToCollection('vehicles', setVehicles);
    const unsubTrips = subscribeToCollection('trips', setTrips);
    const unsubDrivers = subscribeToCollection('drivers', setDrivers);
    const unsubModels = subscribeToCollection('vehicle_models', setCustomModels);
    return () => {
      unsubVehicles();
      unsubTrips();
      unsubDrivers();
      unsubModels();
    };
  }, []);

  const handleSaveNotes = async (vehicleId: string) => {
    setIsSavingNotes(true);
    try {
      await updateVehicleStatus(vehicleId, 'Maintenance', tempNotes.trim(), profile);
      setEditingNotesId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Filter collections by selected warehouse
  const warehouseVehicles = filterByWarehouse(vehicles);
  const warehouseTrips = filterByWarehouse(trips);
  const warehouseDrivers = filterByWarehouse(drivers);

  // Dynamically calculate operational status for display consistency and resilience
  const computedVehicles = warehouseVehicles.map(v => {
    if (v.status === 'Maintenance') {
      return v;
    }
    const hasRunningTrip = warehouseTrips.some(t => t.vehicleId === v.id && t.status === 'Running');
    if (hasRunningTrip) {
      return { ...v, status: 'On Trip' as const };
    }
    const hasPendingTrip = warehouseTrips.some(t => t.vehicleId === v.id && t.status === 'Pending');
    if (hasPendingTrip) {
      return { ...v, status: 'Pending Out Scan' as const };
    }
    return { ...v, status: 'Available' as const };
  });

  const allTypesList = useMemo(() => {
    return Array.from(
      new Set([
        ...VEHICLE_TYPES,
        ...customModels.map(m => m.name),
        ...computedVehicles.map(v => v.type).filter(Boolean)
      ])
    );
  }, [customModels, computedVehicles]);

  const stats = {
    totalVehicles: computedVehicles.length,
    activeFleet: computedVehicles.filter(v => v.status !== 'Maintenance').length,
    availableVehicles: computedVehicles.filter(v => v.status === 'Available').length,
    onTripVehicles: computedVehicles.filter(v => v.status === 'On Trip' || v.status === 'Pending Out Scan').length,
    maintenanceVehicles: computedVehicles.filter(v => v.status === 'Maintenance').length,
    runningTrips: warehouseTrips.filter(t => t.status === 'Running').length,
    completedTrips: warehouseTrips.filter(t => t.status === 'Completed').length,
    totalDrivers: warehouseDrivers.length,
    typeBreakdown: allTypesList.reduce((acc, type) => {
      acc[type] = computedVehicles.filter(v => v.type === type).length;
      return acc;
    }, {} as Record<string, number>)
  };

  const depotSummaries = useMemo(() => {
    return SUPPORTED_WAREHOUSES.map(w => {
      const hubVehicles = vehicles.filter(v => (v.warehouse || 'মোহাম্মদপুর') === w.name);
      return {
        ...w,
        count: hubVehicles.length
      };
    });
  }, [vehicles]);

  const modelAnalyticsList = useMemo(() => {
    const list = allTypesList.map(type => {
      const modelVehicles = computedVehicles.filter(v => v.type === type);
      const total = modelVehicles.length;
      const available = modelVehicles.filter(v => v.status === 'Available').length;
      const onTrip = modelVehicles.filter(v => v.status === 'On Trip' || v.status === 'Pending Out Scan').length;
      const maintenance = modelVehicles.filter(v => v.status === 'Maintenance').length;
      const percentOfTotal = stats.totalVehicles > 0 ? (total / stats.totalVehicles) * 100 : 0;
      const availableRatio = total > 0 ? (available / total) * 100 : 0;
      const onTripRatio = total > 0 ? (onTrip / total) * 100 : 0;
      const maintenanceRatio = total > 0 ? (maintenance / total) * 100 : 0;

      return {
        type,
        total,
        available,
        onTrip,
        maintenance,
        percentOfTotal,
        availableRatio,
        onTripRatio,
        maintenanceRatio,
        vehicles: modelVehicles
      };
    });

    let filtered = list;
    if (modelSearchFilter.trim()) {
      const q = modelSearchFilter.toLowerCase();
      filtered = filtered.filter(item => 
        item.type.toLowerCase().includes(q) ||
        item.vehicles.some(v => v.vehicleNumber?.toLowerCase().includes(q))
      );
    }

    return filtered.sort((a, b) => {
      if (modelSortBy === 'count_desc') return b.total - a.total || a.type.localeCompare(b.type);
      if (modelSortBy === 'name_asc') return a.type.localeCompare(b.type);
      if (modelSortBy === 'available_desc') return b.available - a.available || b.total - a.total;
      if (modelSortBy === 'ontrip_desc') return b.onTrip - a.onTrip || b.total - a.total;
      return 0;
    });
  }, [allTypesList, computedVehicles, stats.totalVehicles, modelSearchFilter, modelSortBy]);

  const filteredSearch = {
    vehicles: computedVehicles.filter(v => 
      v.vehicleNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.id?.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    drivers: warehouseDrivers.filter(d => 
      d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.driverId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.role?.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    trips: warehouseTrips.filter(t => 
      t.driverName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.vehicleId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.location?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  };

  const isSearching = searchQuery.length > 0;

  const handleResolveRepair = async (vehicleId: string) => {
    try {
      await updateVehicleStatus(vehicleId, 'Available', '', profile);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleMaintenance = async (vehicleId: string, currentStatus: string) => {
    try {
      const nextStatus = currentStatus === 'Maintenance' ? 'Available' : 'Maintenance';
      // Retain existing notes if putting under maintenance, or clear if moving to available
      const existingNotes = computedVehicles.find(v => v.id === vehicleId)?.maintenanceNotes || '';
      await updateVehicleStatus(vehicleId, nextStatus, nextStatus === 'Maintenance' ? existingNotes : '', profile);
    } catch (err) {
      console.error(err);
    }
  };

  // Filter vehicles for Maintenance Overview table
  const maintOverviewVehicles = computedVehicles.filter(v => {
    const hasNotesOrMaint = v.status === 'Maintenance' || (v.maintenanceNotes && v.maintenanceNotes.trim() !== '');
    if (!hasNotesOrMaint) return false;

    if (maintTypeFilter !== 'All' && v.type !== maintTypeFilter) return false;

    if (maintStatusFilter === 'Maintenance' && v.status !== 'Maintenance') return false;
    if (maintStatusFilter === 'WithNotes' && (!v.maintenanceNotes || v.maintenanceNotes.trim() === '')) return false;

    if (maintSearch.trim() !== '') {
      const q = maintSearch.toLowerCase();
      const matchesNum = v.vehicleNumber?.toLowerCase().includes(q);
      const matchesNotes = v.maintenanceNotes?.toLowerCase().includes(q);
      const matchesType = v.type?.toLowerCase().includes(q);
      if (!matchesNum && !matchesNotes && !matchesType) return false;
    }

    return true;
  });

  const formatMaintDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    try {
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        const d = timestamp.toDate();
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      }
      const d = new Date(timestamp);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (e) {
      return 'N/A';
    }
  };

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {isSearching ? (
          <motion.div
            key="search-results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between border-b border-border pb-4">
               <h2 className="text-xl font-bold text-text-main">Search Results for "{searchQuery}"</h2>
               <p className="text-xs text-text-muted">Found {filteredSearch.vehicles.length + filteredSearch.drivers.length + filteredSearch.trips.length} matches</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card title="Matching Vehicles">
                <div className="space-y-3">
                  {filteredSearch.vehicles.map(v => (
                    <Link key={v.id} to="/vehicles" className="block p-3 hover:bg-slate-50 border border-border rounded-xl transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">{v.vehicleNumber}</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-bold uppercase",
                          v.status === 'Available' ? 'bg-emerald-100 text-emerald-700' :
                          v.status === 'On Trip' ? 'bg-blue-100 text-blue-700' :
                          'bg-orange-100 text-orange-700'
                        )}>{v.status}</span>
                      </div>
                      <p className="text-[10px] text-text-muted mt-1">{v.type}</p>
                      {v.status === 'Maintenance' && v.maintenanceNotes && (
                        <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100/50 px-2 py-1 rounded mt-1.5 whitespace-pre-wrap break-words italic">
                          সমস্যা: {v.maintenanceNotes}
                        </p>
                      )}
                    </Link>
                  ))}
                  {filteredSearch.vehicles.length === 0 && <p className="text-xs text-text-muted italic py-4">No vehicles found.</p>}
                </div>
              </Card>

              <Card title="Matching Drivers">
                <div className="space-y-3">
                  {filteredSearch.drivers.map(d => (
                    <Link key={d.id} to="/drivers" className="block p-3 hover:bg-slate-50 border border-border rounded-xl transition-colors">
                      <div className="flex items-center justify-between">
                         <span className="font-bold text-sm">{d.name}</span>
                         <span className="text-[9px] font-bold text-accent uppercase tracking-wider">{d.driverId}</span>
                      </div>
                      <p className="text-[10px] text-text-muted mt-1">{d.role || 'Driver'}</p>
                    </Link>
                  ))}
                  {filteredSearch.drivers.length === 0 && <p className="text-xs text-text-muted italic py-4">No staff found.</p>}
                </div>
              </Card>

              <Card title="Matching Trips">
                <div className="space-y-3">
                  {filteredSearch.trips.map(t => (
                    <Link key={t.id} to="/trips" className="block p-3 hover:bg-slate-50 border border-border rounded-xl transition-colors">
                      <div className="flex items-center justify-between">
                         <span className="font-bold text-sm">{t.location}</span>
                         <span className={cn(
                            "px-2 py-0.5 rounded text-[9px] font-bold uppercase",
                            t.status === 'Running' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                         )}>{t.status}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-text-muted">{t.driverName}</span>
                        <span className="text-[10px] font-bold text-slate-400">{t.vehicleId}</span>
                      </div>
                    </Link>
                  ))}
                  {filteredSearch.trips.length === 0 && <p className="text-xs text-text-muted italic py-4">No trips found.</p>}
                </div>
              </Card>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="dashboard-stats"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Theme-Adaptive Bengali Rotating Quote Banner (Hidden on Mobile) */}
            <div className={cn(
              "hidden md:flex border rounded-2xl p-4 sm:p-5 items-center gap-4 shadow-2xs overflow-hidden relative",
              isEmerald 
                ? "bg-gradient-to-r from-[#e8f7f2] to-[#d3f1e7] border-[#b5e7d8]"
                : isCrimson
                  ? "bg-gradient-to-r from-[#fff1f2] to-[#ffe4e6] border-[#fecdd3]"
                  : isAmber
                    ? "bg-gradient-to-r from-[#fef3c7] to-[#fde68a] border-[#fcd34d]"
                    : "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100"
            )}>
              <div className={cn(
                "p-3 rounded-xl shrink-0",
                isEmerald ? "bg-[#d0f0e4] text-[#1b6b54]" :
                isCrimson ? "bg-[#fed7dd] text-[#be123c]" :
                isAmber ? "bg-[#fde68a] text-[#92400e]" :
                "bg-blue-100/80 text-blue-600"
              )}>
                <Sparkles size={20} className="animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <div className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  isEmerald ? "text-[#1b6b54]" :
                  isCrimson ? "text-[#be123c]" :
                  isAmber ? "text-[#92400e]" :
                  "text-blue-500"
                )}>
                  আজকের উক্তি ও সচেতনতা বার্তা (Daily Safety & Motivational Message)
                </div>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={quoteIndex}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.3 }}
                    className="text-sm sm:text-base font-bold text-slate-800 tracking-wide"
                  >
                    “{bengaliQuotes[quoteIndex]}”
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard 
                  label="Net Active Fleet" 
                  value={stats.activeFleet} 
                  icon={Truck} 
                  isActive={activeStatFilter === 'activeFleet'}
                  onClick={() => {
                    setActiveStatFilter(prev => prev === 'activeFleet' ? null : 'activeFleet');
                    setDetailSearch('');
                  }}
                />
                <StatCard 
                  label="Available (Ready)" 
                  value={stats.availableVehicles} 
                  icon={CheckCircle} 
                  isActive={activeStatFilter === 'available'}
                  onClick={() => {
                    setActiveStatFilter(prev => prev === 'available' ? null : 'available');
                    setDetailSearch('');
                  }}
                />
                <StatCard 
                  label="On Trip (Running)" 
                  value={stats.onTripVehicles} 
                  trend="▲" 
                  icon={Activity} 
                  isActive={activeStatFilter === 'onTrip'}
                  onClick={() => {
                    setActiveStatFilter(prev => prev === 'onTrip' ? null : 'onTrip');
                    setDetailSearch('');
                  }}
                />
              </div>
              <div 
                onClick={() => {
                  setActiveStatFilter(prev => prev === 'maintenance' ? null : 'maintenance');
                  setDetailSearch('');
                }}
                className={cn(
                  "p-5 rounded-xl flex flex-col justify-center cursor-pointer select-none transition-all duration-200",
                  activeStatFilter === 'maintenance' 
                    ? "bg-slate-900 ring-4 ring-orange-400/40 border border-orange-400" 
                    : "bg-primary text-white hover:bg-primary/95 hover:shadow-md"
                )}
              >
                <div className="text-[10px] uppercase font-bold opacity-60 tracking-wider">Under Maintenance (Offline)</div>
                <div className="text-2xl font-bold mt-1 text-orange-300">{stats.maintenanceVehicles}</div>
                <div className="text-[9px] mt-1 opacity-50">Total Fleet: {stats.totalVehicles}</div>
                <div className="text-[9px] font-bold mt-2 text-orange-400 flex items-center gap-1">
                  {activeStatFilter === 'maintenance' ? "✓ নির্বাচিত" : "বিস্তারিত দেখতে ক্লিক করুন →"}
                </div>
              </div>
            </div>

            {/* Detailed Filter Panel */}
            <AnimatePresence>
              {activeStatFilter && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <Card 
                    title={
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping shrink-0"></span>
                          <span className="font-bold text-slate-800 text-sm sm:text-base">
                            {activeStatFilter === 'onTrip' && "ট্রিপে থাকা গাড়িসমূহ এবং গন্তব্য"}
                            {activeStatFilter === 'available' && "উপলব্ধ গাড়িসমূহ"}
                            {activeStatFilter === 'activeFleet' && "নেট একটিভ ফ্লিট এবং গাড়ির অবস্থা"}
                            {activeStatFilter === 'maintenance' && "মেইনটেনেন্সে থাকা গাড়িসমূহ"}
                          </span>
                        </div>
                        <button
                          onClick={() => { setActiveStatFilter(null); setDetailSearch(''); }}
                          className="text-xs font-bold text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                        >
                          বন্ধ করুন ×
                        </button>
                      </div>
                    }
                    className="border-blue-100 bg-blue-50/10 shadow-xs"
                  >
                    <div className="space-y-4">
                      {/* Search box inside detail panel */}
                      <div className="flex items-center gap-2 max-w-md">
                        <div className="relative flex-1">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="text"
                            placeholder="গাড়ির নম্বর দিয়ে খুঁজুন..."
                            value={detailSearch}
                            onChange={e => setDetailSearch(e.target.value)}
                            className="w-full pl-8 pr-4 py-1.5 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:border-blue-400 font-medium"
                          />
                        </div>
                      </div>

                      {/* Filter logic & content rendering */}
                      {activeStatFilter === 'onTrip' && (
                        <div className="overflow-x-auto border border-slate-150 rounded-xl bg-white">
                          <table className="w-full text-xs text-left">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-150">
                                <th className="px-4 py-3 font-semibold text-slate-500">গাড়ির নম্বর</th>
                                <th className="px-4 py-3 font-semibold text-slate-500">চালক</th>
                                <th className="px-4 py-3 font-semibold text-slate-500">গন্তব্য</th>
                                <th className="px-4 py-3 font-semibold text-slate-500">শুরুর সময়</th>
                                <th className="px-4 py-3 font-semibold text-slate-500 text-right">স্ট্যাটাস</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {computedVehicles
                                .filter(v => (v.status === 'On Trip' || v.status === 'Pending Out Scan') && (detailSearch ? v.vehicleNumber?.toLowerCase().includes(detailSearch.toLowerCase()) : true))
                                .map(v => {
                                  const activeTrip = trips.find(t => t.vehicleId === v.id && (t.status === 'Running' || t.status === 'Pending'));
                                  return (
                                    <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="px-4 py-3 font-bold text-accent">{v.vehicleNumber}</td>
                                      <td className="px-4 py-3 text-slate-600 font-medium">{activeTrip?.driverName || 'N/A'}</td>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5">
                                          <MapPin size={12} className="text-red-500 shrink-0" />
                                          <span className="font-bold text-slate-850">{activeTrip?.location || 'Unknown'}</span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-slate-500">
                                        {activeTrip ? (
                                          activeTrip.status === 'Running' 
                                            ? formatMaintDate(activeTrip.startTime) 
                                            : `পেন্ডিং (Created: ${formatMaintDate(activeTrip.createdAt)})`
                                        ) : 'N/A'}
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                        {v.status === 'Pending Out Scan' ? (
                                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold uppercase whitespace-nowrap animate-pulse">
                                            Pending Out Scan
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold uppercase whitespace-nowrap">
                                            On Trip
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              {computedVehicles.filter(v => v.status === 'On Trip' || v.status === 'Pending Out Scan').length === 0 && (
                                <tr>
                                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                                    এই মুহূর্তে কোনো গাড়ি ট্রিপে নেই।
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {activeStatFilter === 'available' && (
                        <div className="overflow-x-auto border border-slate-150 rounded-xl bg-white">
                          <table className="w-full text-xs text-left">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-150">
                                <th className="px-4 py-3 font-semibold text-slate-500">গাড়ির নম্বর</th>
                                <th className="px-4 py-3 font-semibold text-slate-500">ধরণ</th>
                                <th className="px-4 py-3 font-semibold text-slate-500">ইনস্ট্যান্ট ট্রিপ</th>
                                <th className="px-4 py-3 font-semibold text-slate-500 text-right">অবস্থা</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {computedVehicles
                                .filter(v => v.status === 'Available' && (detailSearch ? v.vehicleNumber?.toLowerCase().includes(detailSearch.toLowerCase()) : true))
                                .map(v => (
                                  <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-3 font-bold text-accent">{v.vehicleNumber}</td>
                                    <td className="px-4 py-3">
                                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[10px]">
                                        {v.type}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <Link 
                                        to={`/new-trip?vehicleId=${v.id}`}
                                        className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold inline-flex items-center gap-1 shadow-sm hover:shadow transition-all cursor-pointer"
                                      >
                                        <PlusCircle size={10} />
                                        <span>Instant Trip Entry</span>
                                      </Link>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase inline-flex items-center gap-1">
                                        <CheckCircle size={10} />
                                        <span>Available</span>
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              {computedVehicles.filter(v => v.status === 'Available').length === 0 && (
                                <tr>
                                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">
                                    বর্তমানে কোনো গাড়ি খালি বা উপলব্ধ নেই।
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {activeStatFilter === 'activeFleet' && (
                        <div className="space-y-4">
                          {/* Aggregate fleet overview summary bar */}
                          <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl">
                            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">গাড়ির বর্তমান অবস্থা বিশ্লেষণ</div>
                            <div className="h-4 w-full bg-slate-200 rounded-full overflow-hidden flex">
                              <div 
                                style={{ width: `${(stats.availableVehicles / (stats.totalVehicles || 1)) * 100}%` }} 
                                className="bg-emerald-500 h-full transition-all duration-300" 
                                title={`Available: ${stats.availableVehicles}`}
                              />
                              <div 
                                style={{ width: `${(stats.onTripVehicles / (stats.totalVehicles || 1)) * 100}%` }} 
                                className="bg-blue-500 h-full transition-all duration-300" 
                                title={`On Trip: ${stats.onTripVehicles}`}
                              />
                              <div 
                                style={{ width: `${(stats.maintenanceVehicles / (stats.totalVehicles || 1)) * 100}%` }} 
                                className="bg-orange-500 h-full transition-all duration-300" 
                                title={`Maintenance: ${stats.maintenanceVehicles}`}
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-4 mt-3 text-[10px] font-bold text-slate-600">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                <span>উপলব্ধ: {stats.availableVehicles} টি</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                <span>চলমান ট্রিপে: {stats.onTripVehicles} টি</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                                <span>মেইনটেনেন্সে: {stats.maintenanceVehicles} টি</span>
                              </div>
                              <div className="ml-auto font-mono text-slate-500">মোট গাড়ি: {stats.totalVehicles} টি</div>
                            </div>
                          </div>

                          <div className="overflow-x-auto border border-slate-150 rounded-xl bg-white">
                            <table className="w-full text-xs text-left">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-150">
                                  <th className="px-4 py-3 font-semibold text-slate-500">গাড়ির নম্বর</th>
                                  <th className="px-4 py-3 font-semibold text-slate-500">ধরণ</th>
                                  <th className="px-4 py-3 font-semibold text-slate-500">বর্তমান অবস্থান / চালক</th>
                                  <th className="px-4 py-3 font-semibold text-slate-500 text-right">স্ট্যাটাস</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {computedVehicles
                                  .filter(v => detailSearch ? v.vehicleNumber?.toLowerCase().includes(detailSearch.toLowerCase()) : true)
                                  .map(v => {
                                    const activeTrip = trips.find(t => t.vehicleId === v.id && t.status === 'Running');
                                    return (
                                      <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3 font-bold text-accent">{v.vehicleNumber}</td>
                                        <td className="px-4 py-3">
                                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[10px]">
                                            {v.type}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3">
                                          {v.status === 'On Trip' ? (
                                            <div className="flex flex-col">
                                              <span className="font-bold text-slate-800 flex items-center gap-1 text-[11px]">
                                                <MapPin size={10} className="text-red-500 shrink-0" /> {activeTrip?.location || 'On Route'}
                                              </span>
                                              <span className="text-[10px] text-slate-500">চালক: {activeTrip?.driverName || 'N/A'}</span>
                                            </div>
                                          ) : v.status === 'Maintenance' ? (
                                            <span className="text-amber-700 text-[11px] flex items-center gap-1 font-medium">
                                              <AlertCircle size={10} className="shrink-0" /> মেইনটেনেন্স গ্যারেজে
                                            </span>
                                          ) : (
                                            <span className="text-emerald-700 text-[11px] flex items-center gap-1 font-medium">
                                              <Check size={10} className="shrink-0" /> গ্যারেজে প্রস্তুত
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                          <span className={cn(
                                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                            v.status === 'Available' ? 'bg-emerald-100 text-emerald-700' :
                                            v.status === 'On Trip' ? 'bg-blue-100 text-blue-700' :
                                            'bg-orange-100 text-orange-700'
                                          )}>
                                            {v.status}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {activeStatFilter === 'maintenance' && (
                        <div className="overflow-x-auto border border-slate-150 rounded-xl bg-white">
                          <table className="w-full text-xs text-left">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-150">
                                <th className="px-4 py-3 font-semibold text-slate-500">গাড়ির নম্বর</th>
                                <th className="px-4 py-3 font-semibold text-slate-500">ধরণ</th>
                                <th className="px-4 py-3 font-semibold text-slate-500">সমস্যা বা মেইনটেনেন্স নোট</th>
                                <th className="px-4 py-3 font-semibold text-slate-500">আপডেটের সময়</th>
                                <th className="px-4 py-3 font-semibold text-slate-500 text-right">অবস্থা</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {computedVehicles
                                .filter(v => v.status === 'Maintenance' && (detailSearch ? v.vehicleNumber?.toLowerCase().includes(detailSearch.toLowerCase()) : true))
                                .map(v => (
                                  <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-3 font-bold text-accent">{v.vehicleNumber}</td>
                                    <td className="px-4 py-3">
                                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[10px]">
                                        {v.type}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-700 font-medium">
                                      {v.maintenanceNotes ? (
                                        <span className="text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-100/55 text-[11px] block">
                                          {v.maintenanceNotes}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 italic">কোনো সমস্যা উল্লেখ করা নেই</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">{formatMaintDate(v.updatedAt || v.createdAt)}</td>
                                    <td className="px-4 py-3 text-right">
                                      <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px] font-bold uppercase inline-flex items-center gap-1">
                                        <Wrench size={10} />
                                        <span>Maintenance</span>
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              {computedVehicles.filter(v => v.status === 'Maintenance').length === 0 && (
                                <tr>
                                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                                    বর্তমানে কোনো গাড়ি মেইনটেনেন্সে নেই।
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
                         {/* Vehicle Models Breakdown / Category Section with Show/Hide Toggle */}
      <div className="mt-6 bg-surface border border-border rounded-xl shadow-xs transition-all overflow-hidden">
        {/* Top Header Bar */}
        <div className="p-4 sm:p-5 border-b border-border bg-slate-50/50">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Title & Stats Badges */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0 border border-accent/20">
                <Layers size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="font-bold text-sm sm:text-base text-text-main tracking-tight">
                    গাড়ির মডেল ও ক্যাটাগরি বিশ্লেষণ
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono border border-slate-200">
                    {allTypesList.length} Models
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md font-mono bg-accent/10 text-accent border border-accent/20">
                    {stats.totalVehicles} Vehicles
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-text-muted flex-wrap">
                  <span>সচল সক্ষমতা: <strong className="text-emerald-600 font-mono">{stats.totalVehicles > 0 ? Math.round((stats.availableVehicles / stats.totalVehicles) * 100) : 0}%</strong> ({stats.availableVehicles}টি)</span>
                  <span>•</span>
                  <span>ট্রিপে: <strong className="text-accent font-mono">{stats.onTripVehicles}টি</strong></span>
                  {stats.maintenanceVehicles > 0 && (
                    <>
                      <span>•</span>
                      <span>মেরামতে: <strong className="text-amber-600 font-mono">{stats.maintenanceVehicles}টি</strong></span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right Header Action Controls */}
            <div className="flex items-center gap-2 flex-wrap ml-auto">
              {canManageModels && (
                <button
                  type="button"
                  onClick={() => setShowModelManagement(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs border cursor-pointer active:scale-95 bg-surface hover:bg-slate-100 text-text-main border-border"
                  title="গাড়ির মডেল যুক্ত বা কনফিগার করুন"
                >
                  <Layers size={14} className="text-accent" />
                  <span>মডেল কনফিগার</span>
                  <span className="text-[9px] bg-accent/10 text-accent font-bold px-1.5 py-0.2 rounded-sm ml-0.5">Admin</span>
                </button>
              )}
              <button
                type="button"
                onClick={toggleShowVehicleModels}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs border cursor-pointer active:scale-95",
                  showVehicleModels
                    ? "bg-surface hover:bg-slate-100 text-text-muted hover:text-text-main border-border"
                    : "bg-accent text-white hover:opacity-90 border-transparent"
                )}
                title={showVehicleModels ? "গাড়ির মডেলসমূহ হাইড করুন" : "সকল মডেলের তালিকা খুলুন"}
              >
                {showVehicleModels ? (
                  <>
                    <EyeOff size={14} />
                    <span>মডেল হাইড করুন</span>
                  </>
                ) : (
                  <>
                    <Eye size={14} />
                    <span>সকল মডেল দেখুন</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Compact Mini Pill Bar when Collapsed */}
          {!showVehicleModels && (
            <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar max-w-full">
                <span className="text-[11px] font-bold text-text-muted shrink-0 mr-1">সংক্ষিপ্ত রূপ:</span>
                {allTypesList.slice(0, 7).map(type => {
                  const count = computedVehicles.filter(v => v.type === type).length;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setShowVehicleModels(true);
                        setSelectedModelFilter(type);
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-border bg-surface hover:border-accent/40 text-text-main shrink-0 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span>{type}</span>
                      <span className="font-mono font-bold px-1.5 py-0.2 rounded bg-accent/10 text-accent text-[10px]">
                        {count}
                      </span>
                    </button>
                  );
                })}
                {allTypesList.length > 7 && (
                  <span className="text-[10px] text-text-muted font-bold px-1 shrink-0">
                    +{allTypesList.length - 7} more
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowVehicleModels(true)}
                className="text-[11px] font-bold text-accent hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <span>সম্পূর্ণ বিস্তারিত খুলুন</span>
                <ChevronDown size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Collapsible Content */}
        <AnimatePresence initial={false}>
          {showVehicleModels && (
            <motion.div
              key="models-main-container"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden p-4 sm:p-5 bg-slate-50/40"
            >
              {/* Secondary Sub-Controls: Search, Sorting & View Toggle */}
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap bg-surface p-2.5 rounded-lg border border-border shadow-2xs">
                {/* Search Input */}
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    value={modelSearchFilter}
                    onChange={(e) => setModelSearchFilter(e.target.value)}
                    placeholder="মডেল বা গাড়ির নম্বর দিয়ে ফিল্টার করুন..."
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50/70 border border-border rounded-md focus:outline-hidden focus:ring-2 focus:ring-accent/30 focus:border-accent text-text-main placeholder:text-text-muted/60 font-medium"
                  />
                  {modelSearchFilter && (
                    <button
                      type="button"
                      onClick={() => setModelSearchFilter('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap ml-auto">
                  {/* Sorting dropdown */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-text-muted text-[11px] font-medium hidden sm:inline">সাজান:</span>
                    <select
                      value={modelSortBy}
                      onChange={(e) => setModelSortBy(e.target.value as any)}
                      className="text-xs bg-slate-50/80 border border-border rounded-md px-2.5 py-1.5 text-text-main font-medium focus:outline-hidden cursor-pointer"
                    >
                      <option value="count_desc">সর্বোচ্চ গাড়ি</option>
                      <option value="name_asc">নাম অনুযায়ী</option>
                      <option value="available_desc">সর্বাধিক সচল</option>
                      <option value="ontrip_desc">সর্বাধিক ট্রিপে</option>
                    </select>
                  </div>

                  {/* View Mode Switcher */}
                  <div className="flex items-center p-0.5 bg-slate-100 rounded-md border border-slate-200">
                    <button
                      type="button"
                      onClick={() => handleSetModelViewMode('grid')}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer",
                        modelViewMode === 'grid'
                          ? "bg-surface text-accent shadow-xs border border-border/80"
                          : "text-text-muted hover:text-text-main"
                      )}
                      title="কার্ড গ্রিড ভিউ"
                    >
                      <LayoutGrid size={12} />
                      <span className="hidden sm:inline">কার্ড</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetModelViewMode('bars')}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer",
                        modelViewMode === 'bars'
                          ? "bg-surface text-accent shadow-xs border border-border/80"
                          : "text-text-muted hover:text-text-main"
                      )}
                      title="অ্যানালিটিক্স বার ভিউ"
                    >
                      <BarChart3 size={12} />
                      <span className="hidden sm:inline">বার</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* View Mode: Grid Cards */}
              {modelViewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-3.5">
                  {modelAnalyticsList.map(item => {
                    const isSelected = selectedModelFilter === item.type;

                    return (
                      <div 
                        key={item.type} 
                        onClick={() => setSelectedModelFilter(isSelected ? null : item.type)}
                        className={cn(
                          "p-3.5 rounded-xl flex flex-col justify-between transition-all cursor-pointer select-none border relative group overflow-hidden",
                          isSelected
                            ? "bg-accent/5 border-accent ring-2 ring-accent/20 shadow-xs scale-[1.01]"
                            : "bg-surface border-border hover:border-accent/40 hover:shadow-xs"
                        )}
                        title={`${item.type}: মোট ${item.total} টি গাড়ি। ক্লিক করে বিস্তারিত দেখুন`}
                      >
                        {/* Top Row: Type & Percent Share */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={cn(
                              "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors shadow-3xs",
                              isSelected 
                                ? "bg-accent text-white"
                                : "bg-slate-100 text-slate-600 group-hover:text-accent group-hover:bg-accent/10"
                            )}>
                              <Truck size={14} />
                            </div>
                            <span className="text-xs font-bold text-text-main truncate" title={item.type}>
                              {item.type}
                            </span>
                          </div>
                          <span className={cn(
                            "text-[10px] font-bold font-mono px-1.5 py-0.5 rounded shrink-0 border",
                            isSelected
                              ? "bg-accent/15 text-accent border-accent/30"
                              : "bg-slate-100 text-slate-600 border-slate-200/60"
                          )}>
                            {Math.round(item.percentOfTotal)}%
                          </span>
                        </div>

                        {/* Middle Row: Big Count & Label */}
                        <div className="flex items-baseline justify-between my-1">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-bold text-text-main font-mono tracking-tight">{item.total}</span>
                            <span className="text-[10px] font-medium text-text-muted">টি গাড়ি</span>
                          </div>
                          <span className="text-[10px] font-semibold text-emerald-600 font-mono">
                            {Math.round(item.availableRatio)}% সচল
                          </span>
                        </div>

                        {/* Segmented Capacity Progress Bar */}
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex my-2">
                          {item.available > 0 && (
                            <div 
                              style={{ width: `${item.availableRatio}%` }} 
                              className="bg-emerald-500 h-full transition-all"
                              title={`সচল: ${item.available} (${Math.round(item.availableRatio)}%)`}
                            />
                          )}
                          {item.onTrip > 0 && (
                            <div 
                              style={{ width: `${item.onTripRatio}%` }} 
                              className="bg-accent h-full transition-all"
                              title={`ট্রিপে: ${item.onTrip} (${Math.round(item.onTripRatio)}%)`}
                            />
                          )}
                          {item.maintenance > 0 && (
                            <div 
                              style={{ width: `${item.maintenanceRatio}%` }} 
                              className="bg-amber-400 h-full transition-all"
                              title={`মেরামতে: ${item.maintenance} (${Math.round(item.maintenanceRatio)}%)`}
                            />
                          )}
                        </div>

                        {/* Bottom Row: Micro Status Badges */}
                        <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-border/60 text-[10px] font-medium">
                          <span className="text-emerald-700 font-mono font-bold flex items-center gap-0.5" title={`সচল: ${item.available}টি`}>
                            <Check size={11} className="text-emerald-600 shrink-0" />
                            <span>{item.available}</span>
                          </span>
                          <span className="text-slate-200">•</span>
                          <span className="text-accent font-mono font-bold flex items-center gap-0.5" title={`ট্রিপে: ${item.onTrip}টি`}>
                            <Zap size={11} className="text-accent shrink-0" />
                            <span>{item.onTrip}</span>
                          </span>
                          <span className="text-slate-200">•</span>
                          <span className={cn(
                            "font-mono font-bold flex items-center gap-0.5",
                            item.maintenance > 0 ? "text-amber-700" : "text-slate-400 opacity-60"
                          )} title={`মেরামতে: ${item.maintenance}টি`}>
                            <Wrench size={10} className="shrink-0" />
                            <span>{item.maintenance}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* View Mode: Analytical Progress Bars */
                <div className="bg-surface rounded-xl border border-border overflow-hidden divide-y divide-border">
                  {modelAnalyticsList.map(item => {
                    const isSelected = selectedModelFilter === item.type;

                    return (
                      <div
                        key={item.type}
                        onClick={() => setSelectedModelFilter(isSelected ? null : item.type)}
                        className={cn(
                          "p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors cursor-pointer select-none",
                          isSelected && "bg-accent/5 border-l-4 border-accent"
                        )}
                      >
                        {/* Left: Model Name & Count */}
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                            isSelected ? "bg-accent text-white" : "bg-slate-100 text-slate-600"
                          )}>
                            <Truck size={15} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-xs text-text-main">{item.type}</h4>
                              <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                {Math.round(item.percentOfTotal)}%
                              </span>
                            </div>
                            <p className="text-[10px] text-text-muted font-mono mt-0.5">
                              মোট: <strong className="text-text-main">{item.total}টি</strong> গাড়ি
                            </p>
                          </div>
                        </div>

                        {/* Middle: Tri-color Progress Bar */}
                        <div className="flex-1 max-w-md mx-0 sm:mx-4">
                          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                            {item.available > 0 && (
                              <div 
                                style={{ width: `${item.availableRatio}%` }} 
                                className="bg-emerald-500 h-full transition-all"
                                title={`সচল: ${item.available}`}
                              />
                            )}
                            {item.onTrip > 0 && (
                              <div 
                                style={{ width: `${item.onTripRatio}%` }} 
                                className="bg-accent h-full transition-all"
                                title={`ট্রিপে: ${item.onTrip}`}
                              />
                            )}
                            {item.maintenance > 0 && (
                              <div 
                                style={{ width: `${item.maintenanceRatio}%` }} 
                                className="bg-amber-400 h-full transition-all"
                                title={`মেরামতে: ${item.maintenance}`}
                              />
                            )}
                          </div>
                        </div>

                        {/* Right: Quick Status Chips */}
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/70 text-[10px] font-mono font-bold">
                            সচল: {item.available}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border bg-accent/10 text-accent border-accent/20">
                            ট্রিপে: {item.onTrip}
                          </span>
                          {item.maintenance > 0 && (
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/70 text-[10px] font-mono font-bold">
                              মেরামত: {item.maintenance}
                            </span>
                          )}
                          <ChevronRight size={14} className={cn("text-text-muted transition-transform", isSelected && "rotate-90 text-accent")} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Zero State if Filter Yields Nothing */}
              {modelAnalyticsList.length === 0 && (
                <div className="p-8 text-center bg-surface rounded-xl border border-dashed border-border my-2">
                  <Truck size={28} className="mx-auto text-text-muted/60 mb-2" />
                  <p className="text-xs text-text-muted font-medium">
                    "{modelSearchFilter}" দিয়ে কোনো মডেল বা গাড়ি পাওয়া যায়নি।
                  </p>
                  <button
                    type="button"
                    onClick={() => setModelSearchFilter('')}
                    className="mt-2 text-xs text-accent font-bold hover:underline cursor-pointer"
                  >
                    ফিল্টার মুছুন
                  </button>
                </div>
              )}

              {/* Interactive Selected Model Drilldown Detail Panel */}
              <AnimatePresence>
                {selectedModelFilter && (
                  <motion.div
                    key="selected-model-drilldown"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                    className="mt-4 p-4 sm:p-5 bg-surface border border-accent/30 rounded-xl shadow-xs space-y-3"
                  >
                    {/* Header of Drilldown */}
                    <div className="flex items-center justify-between gap-3 flex-wrap border-b border-border pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-accent/10 text-accent font-bold shrink-0">
                          <Truck size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-text-main">
                              {selectedModelFilter} মডেলের বিস্তারিত গাড়ি তালিকা
                            </h4>
                            <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                              মোট {computedVehicles.filter(v => v.type === selectedModelFilter).length}টি গাড়ি
                            </span>
                          </div>
                          <p className="text-[11px] text-text-muted mt-0.5">
                            নিচে এই মডেলের সকল নিবন্ধিত গাড়ির বর্তমান লাইভ স্ট্যাটাস প্রদর্শিত হচ্ছে:
                          </p>
                        </div>
                      </div>

                      {/* Close & Action Buttons */}
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/vehicles?type=${encodeURIComponent(selectedModelFilter)}`}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg border border-accent/30 text-accent bg-accent/10 hover:bg-accent/20 transition-colors flex items-center gap-1"
                        >
                          <span>গাড়ির খাতায় দেখুন</span>
                          <ArrowRight size={12} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setSelectedModelFilter(null)}
                          className="text-xs font-bold text-text-muted hover:text-text-main bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <X size={13} />
                          <span>বন্ধ করুন</span>
                        </button>
                      </div>
                    </div>

                    {/* Vehicle Plate Tags Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 pt-1">
                      {computedVehicles
                        .filter(v => v.type === selectedModelFilter)
                        .map(v => {
                          const activeTrip = trips.find(t => (t.status === 'Running' || t.status === 'Pending') && t.vehicleId === v.id);

                          return (
                            <div
                              key={v.id}
                              className={cn(
                                "p-2.5 rounded-xl border flex flex-col justify-between gap-1.5 transition-all shadow-3xs",
                                v.status === 'Available'
                                  ? "bg-emerald-50/40 border-emerald-200/80"
                                  : v.status === 'On Trip' || v.status === 'Pending Out Scan'
                                  ? "bg-accent/5 border-accent/20"
                                  : "bg-amber-50/40 border-amber-200/80"
                              )}
                            >
                              <div className="flex items-start justify-between gap-1.5">
                                <span className="font-mono font-bold text-xs text-text-main tracking-tight">
                                  {v.vehicleNumber}
                                </span>
                                <span className={cn(
                                  "px-1.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase shrink-0",
                                  v.status === 'Available'
                                    ? "bg-emerald-100 text-emerald-800"
                                    : v.status === 'On Trip'
                                    ? "bg-accent text-white"
                                    : v.status === 'Pending Out Scan'
                                    ? "bg-amber-100 text-amber-800 animate-pulse"
                                    : "bg-orange-100 text-orange-800"
                                )}>
                                  {v.status === 'Available' ? 'সচল' : v.status === 'On Trip' ? 'ট্রিপে' : v.status === 'Pending Out Scan' ? 'পেন্ডিং' : 'মেরামত'}
                                </span>
                              </div>

                              {activeTrip && (
                                <div className="text-[10px] text-text-muted bg-surface/90 p-1.5 rounded-md flex items-center justify-between gap-1 border border-border">
                                  <span className="truncate">চালক: <strong className="text-text-main">{activeTrip.driverName}</strong></span>
                                  <span className="text-[9px] text-accent font-bold truncate shrink-0">📍 {activeTrip.location}</span>
                                </div>
                              )}

                              {v.maintenanceNotes && (
                                <p className="text-[10px] text-amber-800 truncate bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                                  🔧 {v.maintenanceNotes}
                                </p>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Live Fleet Status & Maintenance Alerts (Max 5 items visible, scrollable if more) */}
      {(() => {
        const liveFleetTrips = warehouseTrips.filter(t => t.status === 'Running' || t.status === 'Pending');
        const maintenanceAlertVehicles = warehouseVehicles.filter(v => v.status === 'Maintenance');

        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 items-start">
            {/* Live Fleet Status (Cap at 5 items) */}
            <div className="lg:col-span-2 flex flex-col">
              <Card 
                title={
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-text-main">Live Fleet Status</span>
                      <span className="px-2 py-0.5 text-[10px] font-extrabold bg-blue-100 text-blue-800 rounded-full">
                        {liveFleetTrips.length}
                      </span>
                    </div>
                    {liveFleetTrips.length > 5 && (
                      <span className="text-[10px] font-medium text-slate-400">
                        (সর্বোচ্চ ৫টি দৃশ্যমান, স্ক্রলযোগ্য)
                      </span>
                    )}
                  </div>
                } 
                className="shadow-xs" 
                bodyClassName="p-0 flex flex-col overflow-hidden"
              >
                {/* Mobile-First List View (Visible on Mobile, max 5 items visible) */}
                <div className="block md:hidden divide-y divide-border p-2 overflow-y-auto max-h-[365px] custom-scrollbar">
                  {liveFleetTrips.map(trip => {
                    const vehicleNum = trip.vehiclePlate || vehicles.find(v => v.id === trip.vehicleId)?.vehicleNumber || trip.vehicleId;
                    return (
                      <div key={trip.id} className="p-2.5 rounded-xl hover:bg-slate-50 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-extrabold text-slate-900 text-xs">{vehicleNum}</span>
                            <p className="text-[11px] text-slate-500 mt-0.5">চালক: <span className="font-semibold text-slate-700">{trip.driverName}</span></p>
                          </div>
                          {trip.status === 'Pending' ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-extrabold text-[10px] uppercase animate-pulse">
                              পেন্ডিং ছাড়পত্র
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-extrabold text-[10px] uppercase">
                              চলমান ট্রিপ
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">
                          <div className="flex items-center gap-1">
                            <MapPin size={12} className="text-red-500 shrink-0" />
                            <span className="font-bold text-slate-800 truncate max-w-[180px]">{trip.location}</span>
                          </div>

                          {trip.status === 'Pending' && (
                            <button
                              onClick={async () => {
                                if (window.confirm('আপনি কি নিশ্চিত যে এই গাড়ির পেন্ডিং ট্রিপটি বাতিল করে এটিকে Available করতে চান?')) {
                                  try {
                                    await cancelPendingTrip(trip.id, trip.vehicleId, profile);
                                  } catch (err) {
                                    console.error("Error cancelling pending trip and making vehicle available:", err);
                                  }
                                }
                              }}
                              className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-md text-[10px] font-bold transition-all cursor-pointer active:scale-95"
                            >
                              বাতিল
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {liveFleetTrips.length === 0 && (
                    <div className="p-6 text-center text-slate-400 text-xs italic">
                      কোনো চলমান বা পেন্ডিং ট্রিপ নেই।
                    </div>
                  )}
                </div>

                {/* Desktop Table View (Max 5 rows visible ~292px, scrollable if more) */}
                <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[292px] custom-scrollbar">
                  <table className="w-full text-xs text-left">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-[#f8fafc] border-b border-border shadow-2xs h-[40px]">
                        <th className="px-5 py-2.5 font-semibold text-text-muted">গাড়ির নম্বর</th>
                        <th className="px-5 py-2.5 font-semibold text-text-muted">চালক</th>
                        <th className="px-5 py-2.5 font-semibold text-text-muted">গন্তব্য</th>
                        <th className="px-5 py-2.5 font-semibold text-text-muted text-right">স্ট্যাটাস</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {liveFleetTrips.map(trip => {
                        const vehicleNum = trip.vehiclePlate || vehicles.find(v => v.id === trip.vehicleId)?.vehicleNumber || trip.vehicleId;
                        return (
                          <tr key={trip.id} className="hover:bg-slate-50/50 transition-colors h-[50px]">
                            <td className="px-5 py-2.5 font-bold text-accent whitespace-nowrap">{vehicleNum}</td>
                            <td className="px-5 py-2.5 text-text-muted font-medium whitespace-nowrap">{trip.driverName}</td>
                            <td className="px-5 py-2.5 max-w-[200px] truncate" title={trip.location}>{trip.location}</td>
                            <td className="px-5 py-2.5 text-right whitespace-nowrap">
                              {trip.status === 'Pending' ? (
                                <div className="flex items-center justify-end gap-2">
                                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold text-[10px] animate-pulse">
                                    পেন্ডিং ছাড়পত্র
                                  </span>
                                  <button
                                    onClick={async () => {
                                      if (window.confirm('আপনি কি নিশ্চিত যে এই গাড়ির পেন্ডিং ট্রিপটি বাতিল করে এটিকে Available করতে চান?')) {
                                        try {
                                          await cancelPendingTrip(trip.id, trip.vehicleId, profile);
                                        } catch (err) {
                                          console.error("Error cancelling pending trip and making vehicle available:", err);
                                        }
                                      }
                                    }}
                                    className="px-2 py-0.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded text-[10px] font-bold transition-all cursor-pointer inline-block"
                                    title="পেন্ডিং ট্রিপ বাতিল করে গাড়ি Available করুন"
                                  >
                                    বাতিল
                                  </button>
                                </div>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold text-[10px]">
                                  চলমান ট্রিপ
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {liveFleetTrips.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-5 py-10 text-center text-text-muted italic">
                            কোনো চলমান বা পেন্ডিং ট্রিপ নেই।
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Maintenance Alerts (Cap at 5 items ~365px, scrollable if more) */}
            <div className="flex flex-col">
              <Card 
                title={
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-text-main">Maintenance Alerts</span>
                      <span className={cn(
                        "px-2 py-0.5 text-[10px] font-extrabold rounded-full",
                        maintenanceAlertVehicles.length > 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                      )}>
                        {maintenanceAlertVehicles.length}
                      </span>
                    </div>
                    {maintenanceAlertVehicles.length > 5 && (
                      <span className="text-[10px] font-medium text-slate-400">
                        (সর্বোচ্চ ৫টি দৃশ্যমান, স্ক্রলযোগ্য)
                      </span>
                    )}
                  </div>
                } 
                className="shadow-xs" 
                bodyClassName="p-3 sm:p-4 flex flex-col overflow-hidden"
              >
                <div className="space-y-2 overflow-y-auto max-h-[365px] pr-1 custom-scrollbar">
                  {maintenanceAlertVehicles.map(v => (
                    <div key={v.id} className="p-2.5 bg-red-50/90 border border-red-200/70 rounded-lg space-y-1.5 transition-all hover:border-red-300">
                      <div className="flex items-start gap-2 justify-between">
                        <div className="flex items-center gap-2">
                          <AlertCircle size={15} className="text-danger flex-shrink-0" />
                          <div className="text-xs">
                            <p className="font-bold text-danger">{v.vehicleNumber}</p>
                          </div>
                        </div>
                        {editingNotesId !== v.id && (
                          <button 
                            onClick={() => { setEditingNotesId(v.id); setTempNotes(v.maintenanceNotes || ''); }}
                            className="text-[10px] text-accent hover:underline flex items-center gap-1 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs font-semibold cursor-pointer active:scale-95"
                            title="সমস্যা বা নোট পরিবর্তন করুন"
                          >
                            <Edit2 size={10} />
                            <span>নোট লিখুন</span>
                          </button>
                        )}
                      </div>

                      {editingNotesId === v.id ? (
                        <div className="space-y-1.5 pl-5">
                          <textarea
                            className="w-full p-2 text-xs border border-amber-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-100 bg-white"
                            placeholder="গাড়ির কি কি সমস্যা রয়েছে লিখুন..."
                            value={tempNotes}
                            onChange={e => setTempNotes(e.target.value)}
                            rows={2}
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              disabled={isSavingNotes}
                              onClick={() => handleSaveNotes(v.id)}
                              className="px-2.5 py-1 bg-accent text-white rounded text-[10px] font-bold hover:bg-accent/95 disabled:opacity-50 cursor-pointer"
                            >
                              {isSavingNotes ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
                            </button>
                            <button
                              disabled={isSavingNotes}
                              onClick={() => setEditingNotesId(null)}
                              className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded text-[10px] font-bold hover:bg-slate-300 cursor-pointer"
                            >
                              বাতিল
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="pl-5 text-xs">
                          <p className="text-slate-600 font-medium">
                            {v.maintenanceNotes ? (
                              <span className="text-amber-800 bg-amber-50/80 border border-amber-200/60 px-2 py-0.5 rounded block whitespace-pre-wrap line-clamp-2 text-[11px]">
                                {v.maintenanceNotes}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">গাড়ির কোনো নির্দিষ্ট সমস্যা বা নোট লেখা নেই।</span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                  {maintenanceAlertVehicles.length === 0 && (
                    <div className="py-10 flex flex-col items-center justify-center text-center text-text-muted text-xs italic">
                      <CheckCircle size={28} className="text-emerald-500 mb-2 opacity-60" />
                      <p className="font-semibold text-slate-700">কোনো সতর্কতা নেই</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">সব গাড়ি সচল রয়েছে</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        );
      })()}

      {/* Maintenance Overview Section */}
      <Card className="mt-6">
        <div className="flex flex-col gap-4">
          {/* Header & Badges */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                <Wrench size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-text-main">Maintenance Overview</h3>
                <p className="text-[10px] text-text-muted mt-0.5">Aggregate logs of all vehicle issues & repairs</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-lg flex items-center gap-1">
                <AlertTriangle size={12} />
                <span>{vehicles.filter(v => v.status === 'Maintenance').length} Pending Repairs</span>
              </span>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-lg">
                {vehicles.filter(v => v.maintenanceNotes && v.maintenanceNotes.trim() !== '').length} Total Issues Listed
              </span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/50">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="গাড়ি বা সমস্যা খুঁজুন..."
                className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-text-main placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                value={maintSearch}
                onChange={e => setMaintSearch(e.target.value)}
              />
              {maintSearch && (
                <button 
                  onClick={() => setMaintSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-600 bg-slate-100 px-1 rounded cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                <button
                  onClick={() => setMaintStatusFilter('All')}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer",
                    maintStatusFilter === 'All' ? "bg-accent text-white" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  সব
                </button>
                <button
                  onClick={() => setMaintStatusFilter('Maintenance')}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer",
                    maintStatusFilter === 'Maintenance' ? "bg-accent text-white" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  মেইনটেনেন্স
                </button>
                <button
                  onClick={() => setMaintStatusFilter('WithNotes')}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer",
                    maintStatusFilter === 'WithNotes' ? "bg-accent text-white" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  নোটসহ
                </button>
              </div>

              {/* Vehicle Type / Model Filter */}
              <div className="flex items-center">
                <select
                  value={maintTypeFilter}
                  onChange={(e) => setMaintTypeFilter(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg outline-none focus:border-accent shadow-2xs cursor-pointer"
                >
                  <option value="All">সকল মডেল</option>
                  {VEHICLE_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-150 rounded-xl bg-white">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-150">
                  <th className="px-4 py-3 font-semibold text-slate-500 w-1/5">Vehicle ID</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 w-[12%]">Type</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 w-[15%]">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 w-2/5">Reported Issue / Notes</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 w-[15%]">Last Updated</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-right w-[15%]">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {maintOverviewVehicles.map(v => {
                  const isEditingThisRow = editingNotesId === v.id;
                  
                  return (
                    <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Vehicle Link / Number */}
                      <td className="px-4 py-3">
                        <Link to="/vehicles" className="font-bold text-accent hover:underline flex flex-col">
                          <span>{v.vehicleNumber}</span>
                        </Link>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3 text-text-muted">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-medium">
                          {v.type}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-bold uppercase inline-block",
                          v.status === 'Available' ? 'bg-emerald-100 text-emerald-700' :
                          v.status === 'On Trip' ? 'bg-blue-100 text-blue-700' :
                          'bg-orange-100 text-orange-700'
                        )}>
                          {v.status === 'Maintenance' ? '🔧 In Repair' : v.status}
                        </span>
                      </td>

                      {/* Problem Notes */}
                      <td className="px-4 py-3">
                        {isEditingThisRow ? (
                          <div className="space-y-2 max-w-md">
                            <textarea
                              className="w-full p-2 text-xs border border-amber-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-100 bg-white"
                              placeholder="গাড়ির সমস্যা বা মেইনটেনেন্স আপডেট লিখুন..."
                              value={tempNotes}
                              onChange={e => setTempNotes(e.target.value)}
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <button
                                disabled={isSavingNotes}
                                onClick={() => handleSaveNotes(v.id)}
                                className="px-2 py-1 bg-accent text-white rounded text-[10px] font-bold hover:bg-accent/95 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                              >
                                {isSavingNotes ? 'সংরক্ষণ হচ্ছে...' : 'Save'}
                              </button>
                              <button
                                disabled={isSavingNotes}
                                onClick={() => setEditingNotesId(null)}
                                className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[10px] font-bold hover:bg-slate-300 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="max-w-md">
                            {v.maintenanceNotes ? (
                              <p className="text-amber-800 bg-amber-50/70 border border-amber-100/50 px-2.5 py-1.5 rounded-lg whitespace-pre-wrap break-words italic font-medium text-xs">
                                {v.maintenanceNotes}
                              </p>
                            ) : (
                              <span className="text-slate-400 italic">কোনো সমস্যা বা মেইনটেনেন্স নোট লেখা নেই।</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Updated Date */}
                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {formatMaintDate(v.updatedAt || v.createdAt)}
                      </td>

                      {/* Quick Actions column */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Notes Trigger */}
                          {!isEditingThisRow && (
                            <button
                              onClick={() => {
                                setEditingNotesId(v.id);
                                setTempNotes(v.maintenanceNotes || '');
                              }}
                              className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-accent hover:border-accent rounded-lg shadow-3xs cursor-pointer transition-colors"
                              title="সমস্যা বা নোট পরিবর্তন করুন"
                            >
                              <Edit2 size={12} />
                            </button>
                          )}

                          {/* Quick Toggle Status between Maintenance and Available */}
                          <button
                            onClick={() => handleToggleMaintenance(v.id, v.status)}
                            className={cn(
                              "p-1.5 border rounded-lg shadow-3xs cursor-pointer transition-all",
                              v.status === 'Maintenance' 
                                ? "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100" 
                                : "bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100"
                            )}
                            title={v.status === 'Maintenance' ? "মেইনটেনেন্স সম্পন্ন করুন" : "মেইনটেনেন্সে পাঠান"}
                          >
                            {v.status === 'Maintenance' ? <Check size={12} /> : <Wrench size={12} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {maintOverviewVehicles.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400 italic">
                      {maintSearch || maintStatusFilter !== 'All' || maintTypeFilter !== 'All' 
                        ? "কোনো ম্যাচিং তথ্য পাওয়া যায়নি।"
                        : "বর্তমানে কোনো গাড়ির মেইনটেনেন্স বা সমস্যা লগ নেই।"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
      </motion.div>
        )}
      </AnimatePresence>
      {/* Vehicle Model Management Modal (Admin Only) */}
      <VehicleModelManagementModal
        isOpen={showModelManagement}
        onClose={() => setShowModelManagement(false)}
        customModels={customModels}
        vehicles={vehicles}
        onModelSelected={(selectedModelName) => {
          setSelectedModelFilter(selectedModelName);
          setShowVehicleModels(true);
        }}
      />
    </div>
  );
};

export default Dashboard;
