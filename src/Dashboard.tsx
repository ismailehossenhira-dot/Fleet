import React, { useEffect, useState } from 'react';
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
  Sparkles
} from 'lucide-react';
import { Card } from './components/Common';
import { subscribeToCollection, updateVehicleStatus } from './db';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useSearch } from './SearchContext';
import { cn } from './lib/utils';
import { useAuth } from './AuthContext';

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
          ✓ নির্বাচিত (Selected)
        </span>
      ) : (
        <span className="text-slate-400 hover:text-slate-600">
          বিস্তারিত দেখতে ক্লিক করুন (Click for details) →
        </span>
      )}
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const { profile } = useAuth();
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
  const [maintTypeFilter, setMaintTypeFilter] = useState<'All' | 'Small' | 'Medium' | 'Large'>('All');

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
    return () => {
      unsubVehicles();
      unsubTrips();
      unsubDrivers();
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

  const stats = {
    totalVehicles: vehicles.length,
    activeFleet: vehicles.filter(v => v.status !== 'Maintenance').length,
    availableVehicles: vehicles.filter(v => v.status === 'Available').length,
    onTripVehicles: vehicles.filter(v => v.status === 'On Trip').length,
    maintenanceVehicles: vehicles.filter(v => v.status === 'Maintenance').length,
    runningTrips: trips.filter(t => t.status === 'Running').length,
    completedTrips: trips.filter(t => t.status === 'Completed').length,
    totalDrivers: drivers.length,
    typeBreakdown: {
      Small: vehicles.filter(v => v.type === 'Small').length,
      Medium: vehicles.filter(v => v.type === 'Medium').length,
      Large: vehicles.filter(v => v.type === 'Large').length,
    }
  };

  const filteredSearch = {
    vehicles: vehicles.filter(v => 
      v.vehicleNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.vin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.id?.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    drivers: drivers.filter(d => 
      d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.driverId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.role?.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    trips: trips.filter(t => 
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
      const existingNotes = vehicles.find(v => v.id === vehicleId)?.maintenanceNotes || '';
      await updateVehicleStatus(vehicleId, nextStatus, nextStatus === 'Maintenance' ? existingNotes : '', profile);
    } catch (err) {
      console.error(err);
    }
  };

  // Filter vehicles for Maintenance Overview table
  const maintOverviewVehicles = vehicles.filter(v => {
    const hasNotesOrMaint = v.status === 'Maintenance' || (v.maintenanceNotes && v.maintenanceNotes.trim() !== '');
    if (!hasNotesOrMaint) return false;

    if (maintTypeFilter !== 'All' && v.type !== maintTypeFilter) return false;

    if (maintStatusFilter === 'Maintenance' && v.status !== 'Maintenance') return false;
    if (maintStatusFilter === 'WithNotes' && (!v.maintenanceNotes || v.maintenanceNotes.trim() === '')) return false;

    if (maintSearch.trim() !== '') {
      const q = maintSearch.toLowerCase();
      const matchesNum = v.vehicleNumber?.toLowerCase().includes(q);
      const matchesVin = v.vin?.toLowerCase().includes(q);
      const matchesNotes = v.maintenanceNotes?.toLowerCase().includes(q);
      const matchesType = v.type?.toLowerCase().includes(q);
      if (!matchesNum && !matchesVin && !matchesNotes && !matchesType) return false;
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
                      <p className="text-[10px] text-text-muted mt-1">{v.type} • VIN: {v.vin}</p>
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
            {/* Bengali Rotating Quote Banner */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 sm:p-5 flex items-center gap-4 shadow-2xs overflow-hidden relative">
              <div className="p-3 bg-blue-100/80 rounded-xl text-blue-600 shrink-0">
                <Sparkles size={20} className="animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">আজকের উক্তি ও সচেতনতা বার্তা (Daily Quote & Safety Message)</div>
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
                            {activeStatFilter === 'onTrip' && "ট্রিপে থাকা গাড়ি সমুহ এবং গন্তব্য (Vehicles On Trip & Destinations)"}
                            {activeStatFilter === 'available' && "উপলব্ধ গাড়ি সমুহ (Available Vehicles)"}
                            {activeStatFilter === 'activeFleet' && "নেট একটিভ ফ্লিট এবং গাড়ির অবস্থা (Net Active Fleet & Status)"}
                            {activeStatFilter === 'maintenance' && "মেইনটেনেন্স বা মেরামতে থাকা গাড়ি সমুহ (Vehicles Under Maintenance)"}
                          </span>
                        </div>
                        <button
                          onClick={() => { setActiveStatFilter(null); setDetailSearch(''); }}
                          className="text-xs font-bold text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                        >
                          বন্ধ করুন (Close) ×
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
                            placeholder="গাড়ির নাম্বার দিয়ে খুঁজুন... (Search by vehicle number...)"
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
                                <th className="px-4 py-3 font-semibold text-slate-500">গাড়ির নাম্বার (Vehicle Plate)</th>
                                <th className="px-4 py-3 font-semibold text-slate-500">চালক (Driver)</th>
                                <th className="px-4 py-3 font-semibold text-slate-500">কোথায় গেছে/গন্তব্য (Destination)</th>
                                <th className="px-4 py-3 font-semibold text-slate-500">শুরুর সময় (Start Time)</th>
                                <th className="px-4 py-3 font-semibold text-slate-500 text-right">স্ট্যাটাস (Status)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {vehicles
                                .filter(v => v.status === 'On Trip' && (detailSearch ? v.vehicleNumber?.toLowerCase().includes(detailSearch.toLowerCase()) : true))
                                .map(v => {
                                  const activeTrip = trips.find(t => t.vehicleId === v.id && t.status === 'Running');
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
                                        {activeTrip ? formatMaintDate(activeTrip.startTime) : 'N/A'}
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold uppercase">
                                          On Trip
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              {vehicles.filter(v => v.status === 'On Trip').length === 0 && (
                                <tr>
                                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                                    এই মুহূর্তে কোনো গাড়ি ট্রিপে নেই। (No vehicles currently on a trip)
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
                                <th className="px-4 py-3 font-semibold text-slate-500">গাড়ির নাম্বার (Vehicle Plate)</th>
                                <th className="px-4 py-3 font-semibold text-slate-500">ধরণ (Type)</th>
                                <th className="px-4 py-3 font-semibold text-slate-500">আইডি/ভ্যালু (Vehicle ID)</th>
                                <th className="px-4 py-3 font-semibold text-slate-500">লাইসেন্স/VIN</th>
                                <th className="px-4 py-3 font-semibold text-slate-500 text-right">অবস্থা (State)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {vehicles
                                .filter(v => v.status === 'Available' && (detailSearch ? v.vehicleNumber?.toLowerCase().includes(detailSearch.toLowerCase()) : true))
                                .map(v => (
                                  <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-3 font-bold text-accent">{v.vehicleNumber}</td>
                                    <td className="px-4 py-3">
                                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[10px]">
                                        {v.type}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">{v.id}</td>
                                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{v.vin || 'N/A'}</td>
                                    <td className="px-4 py-3 text-right">
                                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase inline-flex items-center gap-1">
                                        <CheckCircle size={10} />
                                        <span>Available</span>
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              {vehicles.filter(v => v.status === 'Available').length === 0 && (
                                <tr>
                                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                                    বর্তমানে কোনো গাড়ি খালি/উপলব্ধ নেই। (No available vehicles in garage)
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
                            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">গাড়ির বর্তমান অবস্থা বিশ্লেষণ (Vehicle Status Distribution)</div>
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
                                <span>উপলব্ধ (Available): {stats.availableVehicles} টি</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                <span>চলমান ট্রিপে (On Trip): {stats.onTripVehicles} টি</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                                <span>মেইনটেনেন্সে (Maintenance): {stats.maintenanceVehicles} টি</span>
                              </div>
                              <div className="ml-auto font-mono text-slate-500">মোট গাড়ি (Total Vehicles): {stats.totalVehicles} টি</div>
                            </div>
                          </div>

                          <div className="overflow-x-auto border border-slate-150 rounded-xl bg-white">
                            <table className="w-full text-xs text-left">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-150">
                                  <th className="px-4 py-3 font-semibold text-slate-500">গাড়ির নাম্বার (Vehicle Plate)</th>
                                  <th className="px-4 py-3 font-semibold text-slate-500">ধরণ (Type)</th>
                                  <th className="px-4 py-3 font-semibold text-slate-500">লাইসেন্স/VIN</th>
                                  <th className="px-4 py-3 font-semibold text-slate-500">বর্তমান অবস্থান/চালক (Current Location / Driver)</th>
                                  <th className="px-4 py-3 font-semibold text-slate-500 text-right">স্ট্যাটাস (Status)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {vehicles
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
                                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{v.vin || 'N/A'}</td>
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
                                              <AlertCircle size={10} className="shrink-0" /> মেইনটেনেন্স গ্যারেজে (In Workshop)
                                            </span>
                                          ) : (
                                            <span className="text-emerald-700 text-[11px] flex items-center gap-1 font-medium">
                                              <Check size={10} className="shrink-0" /> গ্যারেজে প্রস্তুত (Ready in Garage)
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
                                <th className="px-4 py-3 font-semibold text-slate-500">গাড়ির নাম্বার (Vehicle Plate)</th>
                                <th className="px-4 py-3 font-semibold text-slate-500">ধরণ (Type)</th>
                                <th className="px-4 py-3 font-semibold text-slate-500">সমস্যা বা মেইনটেনেন্স নোট (Reported Issue / Repair Note)</th>
                                <th className="px-4 py-3 font-semibold text-slate-500">আপডেটের সময় (Last Updated)</th>
                                <th className="px-4 py-3 font-semibold text-slate-500 text-right">অবস্থা (State)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {vehicles
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
                                        <span className="text-slate-400 italic">কোনো সমস্যা উল্লেখ করা নেই (No notes reported)</span>
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
                              {vehicles.filter(v => v.status === 'Maintenance').length === 0 && (
                                <tr>
                                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                                    বর্তমানে কোনো গাড়ি মেইনটেনেন্সে নেই। (No vehicles currently in maintenance)
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(stats.typeBreakdown).map(([type, count]) => (
          <div key={type} className="bg-surface border border-border p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-bold text-text-muted">{type} Vehicles</p>
              <h4 className="text-xl font-bold text-text-main">{count}</h4>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-accent">
              <Truck size={20} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card title="Live Fleet Status">
             <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-border">
                    <th className="px-5 py-3 font-semibold text-text-muted">Vehicle Number (গাড়ির নাম্বার)</th>
                    <th className="px-5 py-3 font-semibold text-text-muted">Driver</th>
                    <th className="px-5 py-3 font-semibold text-text-muted">Destination</th>
                    <th className="px-5 py-3 font-semibold text-text-muted text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {trips.filter(t => t.status === 'Running').map(trip => {
                    const vehicleNum = trip.vehiclePlate || vehicles.find(v => v.id === trip.vehicleId)?.vehicleNumber || trip.vehicleId;
                    return (
                      <tr key={trip.id}>
                        <td className="px-5 py-3 font-bold text-accent">{vehicleNum}</td>
                        <td className="px-5 py-3 text-text-muted">{trip.driverName}</td>
                        <td className="px-5 py-3">{trip.location}</td>
                        <td className="px-5 py-3 text-right">
                          <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold text-[10px]">On Trip</span>
                        </td>
                      </tr>
                    );
                  })}
                  {stats.runningTrips === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-text-muted italic">No active trips running.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Maintenance Alerts">
            <div className="space-y-3">
              {vehicles.filter(v => v.status === 'Maintenance').map(v => (
                <div key={v.id} className="p-3 bg-red-50 border border-red-100 rounded-lg space-y-2">
                  <div className="flex items-start gap-3 justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={16} className="text-danger flex-shrink-0" />
                      <div className="text-xs">
                        <p className="font-bold text-danger">{v.vehicleNumber}</p>
                      </div>
                    </div>
                    {editingNotesId !== v.id && (
                      <button 
                        onClick={() => { setEditingNotesId(v.id); setTempNotes(v.maintenanceNotes || ''); }}
                        className="text-[10px] text-accent hover:underline flex items-center gap-1 bg-white border px-1.5 py-0.5 rounded shadow-2xs font-semibold cursor-pointer"
                        title="সমস্যা বা নোট পরিবর্তন করুন"
                      >
                        <Edit2 size={10} />
                        <span>নোট লিখুন</span>
                      </button>
                    )}
                  </div>

                  {editingNotesId === v.id ? (
                    <div className="space-y-1.5 pl-6">
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
                    <div className="pl-6 text-xs">
                      <p className="text-slate-600 font-medium">
                        {v.maintenanceNotes ? (
                          <span className="text-amber-700 bg-amber-50 border border-amber-100/50 px-2 py-1 rounded block whitespace-pre-wrap">
                            {v.maintenanceNotes}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">গাড়ির কোনো নির্দিষ্ট সমস্যা বা নোট লেখা নেই।</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              ))}
              {vehicles.filter(v => v.status === 'Maintenance').length === 0 && (
                <div className="text-center py-4 text-text-muted text-xs">No active alerts.</div>
              )}
            </div>
          </Card>

          <Card title="Quick Driver Stats">
             <Link to="/drivers" className="block group">
               <div className="space-y-4">
                 <div className="flex justify-between items-center text-xs">
                   <div className="flex flex-col">
                     <span className="text-text-muted">Total Active Drivers</span>
                     <span className="text-[9px] text-accent font-bold group-hover:underline flex items-center gap-1">
                       View All Drivers <ArrowRight size={10} />
                     </span>
                   </div>
                   <span className="font-bold text-lg">{stats.totalDrivers}</span>
                 </div>
                 <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                   <div className="h-full bg-accent transition-all duration-500" style={{ width: `${Math.min((stats.totalDrivers / (stats.totalVehicles || 1)) * 100, 100)}%` }} />
                 </div>
                 <div className="pt-2 border-t border-slate-50">
                    <div className="flex -space-x-2 overflow-hidden">
                      {drivers.slice(0, 5).map((driver, i) => (
                        <div key={driver.id || i} className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-600 uppercase">
                          {driver.name?.charAt(0) || 'D'}
                        </div>
                      ))}
                      {stats.totalDrivers > 5 && (
                        <div className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-400">
                          +{stats.totalDrivers - 5}
                        </div>
                      )}
                    </div>
                 </div>
               </div>
             </Link>
          </Card>
        </div>
      </div>

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
                placeholder="গাড়ি বা সমস্যা খুঁজুন (Search vehicle or note...)"
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
                  সব (All)
                </button>
                <button
                  onClick={() => setMaintStatusFilter('Maintenance')}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer",
                    maintStatusFilter === 'Maintenance' ? "bg-accent text-white" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  মেইনটেনেন্স (Under Repair)
                </button>
                <button
                  onClick={() => setMaintStatusFilter('WithNotes')}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer",
                    maintStatusFilter === 'WithNotes' ? "bg-accent text-white" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  নোট সহ (With Notes)
                </button>
              </div>

              {/* Vehicle Type Filter */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                {(['All', 'Small', 'Medium', 'Large'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setMaintTypeFilter(type)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer",
                      maintTypeFilter === type ? "bg-accent text-white" : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {type === 'All' ? 'সব (All)' : type}
                  </button>
                ))}
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
                          <span className="text-[9px] text-slate-400 font-mono font-normal">VIN: {v.vin || 'N/A'}</span>
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
                            title={v.status === 'Maintenance' ? "মেইনটেনেন্স সম্পন্ন করুন (Resolve & Make Available)" : "মেইনটেনেন্সে পাঠান (Mark as Under Repair)"}
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
                        ? "কোনো ম্যাচিং তথ্য পাওয়া যায়নি। (No matching vehicles found for selected filters)"
                        : "বর্তমানে কোনো গাড়ির মেইনটেনেন্স বা সমস্যা লগ নেই। (No active maintenance or issue notes recorded)"}
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
    </div>
  );
};

export default Dashboard;
