import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { 
  addMorningPrep, 
  deleteMorningPrep, 
  subscribeToCollection, 
  updateVehicleStatus 
} from './db';
import { Card, Button } from './components/Common';
import { cn } from './lib/utils';
import { 
  Sunrise, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Truck, 
  User, 
  FileText, 
  Plus, 
  Trash2, 
  Search, 
  CheckSquare, 
  Square,
  Activity,
  Milestone,
  HelpCircle,
  Clock,
  Navigation,
  AlertCircle,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Wrench,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  MapPin,
  Sparkles
} from 'lucide-react';

interface InspectionItem {
  key: string;
  labelBn: string;
  labelEn: string;
}

const MorningPrep: React.FC = () => {
  const { isAdmin, isSubAdmin, isChecker, isLineSupervisor, profile } = useAuth();
  const canInspect = isAdmin || isSubAdmin || isChecker || isLineSupervisor;

  // Real-time states
  const [preps, setPreps] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [statusLogs, setStatusLogs] = useState<any[]>([]);

  // UI States
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Ready' | 'Blocked'>('All');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Expanded details state for 24-hour summary cards
  const [activeDetailTab, setActiveDetailTab] = useState<'dispatched' | 'returned' | 'maintenance_in' | 'maintenance_out' | 'tolls' | null>(null);

  // Form states
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [odometer, setOdometer] = useState('');
  const [notes, setNotes] = useState('');
  const [overallStatus, setOverallStatus] = useState<'Ready' | 'Requires Maintenance'>('Ready');

  // Checklist state
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    fuelLevel: true,
    tireSpare: true,
    brakesOil: true,
    documentsCheck: true,
    driverFitness: true,
    helperReady: true,
    safetyKit: true,
    tripChallan: true
  });

  const inspectionItems: InspectionItem[] = [
    { key: 'fuelLevel', labelBn: 'জ্বালানি ৫০% বা তার বেশি আছে', labelEn: 'Fuel Level 50%+' },
    { key: 'tireSpare', labelBn: 'চাকার হাওয়া ও স্পেয়ার টায়ার ঠিক আছে', labelEn: 'Tire Pressure & Spare Tyre' },
    { key: 'brakesOil', labelBn: 'ব্রেক এবং ইঞ্জিন অয়েল ঠিক আছে', labelEn: 'Brakes & Lubricant Level' },
    { key: 'documentsCheck', labelBn: 'গাড়ির প্রয়োজনীয় কাগজপত্র সাথে আছে', labelEn: 'All Documents Valid' },
    { key: 'driverFitness', labelBn: 'চালকের ফিটনেস ও লাইসেন্স চেক করা হয়েছে', labelEn: 'Driver Fitness Verified' },
    { key: 'helperReady', labelBn: 'হেল্পার উপস্থিত ও প্রস্তুত আছে', labelEn: 'Helper Ready & Present' },
    { key: 'safetyKit', labelBn: 'নিরাপত্তা সরঞ্জাম ও ফায়ার এক্সটিংগুইশার সচল', labelEn: 'Safety Kit & Extinguisher' },
    { key: 'tripChallan', labelBn: 'ট্রিপ চালান ও জিপিএস চেক সঠিক আছে', labelEn: 'Trip Challan & GPS Active' }
  ];

  // Subscribe to collections
  useEffect(() => {
    const unsubPreps = subscribeToCollection('morning_preps', setPreps);
    const unsubVehicles = subscribeToCollection('vehicles', setVehicles);
    const unsubDrivers = subscribeToCollection('drivers', setDrivers);
    const unsubTrips = subscribeToCollection('trips', setTrips);
    const unsubStatusLogs = subscribeToCollection('vehicle_status_logs', setStatusLogs);

    return () => {
      unsubPreps();
      unsubVehicles();
      unsubDrivers();
      unsubTrips();
      unsubStatusLogs();
    };
  }, []);

  const handleToggleCheck = (key: string) => {
    setChecklist(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      // Auto adjust overallStatus based on checklist
      const allPassed = Object.values(updated).every(val => val === true);
      if (!allPassed) {
        setOverallStatus('Requires Maintenance');
      } else {
        setOverallStatus('Ready');
      }
      return updated;
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) {
      setError('দয়া করে গাড়ি নির্বাচন করুন।');
      return;
    }
    if (!selectedDriver) {
      setError('দয়া করে চালক নির্বাচন করুন।');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const vehicleObj = vehicles.find(v => v.id === selectedVehicle);
    const driverObj = drivers.find(d => d.id === selectedDriver);

    const prepPayload = {
      vehicleId: selectedVehicle,
      vehiclePlate: vehicleObj?.vehicleNumber || 'Unknown Vehicle',
      vehicleType: vehicleObj?.type || 'Medium',
      driverId: selectedDriver,
      driverName: driverObj?.name || 'Unknown Driver',
      driverPhone: driverObj?.phone || '',
      odometer: odometer ? Number(odometer) : 0,
      checklist,
      overallStatus,
      notes: notes.trim(),
      dateStr: new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })
    };

    try {
      // Save morning prep log
      await addMorningPrep(prepPayload, profile);

      // If marked as "Requires Maintenance", automatically update vehicle status
      if (overallStatus === 'Requires Maintenance') {
        const maintNotes = notes.trim() || 'Morning inspection check failed';
        await updateVehicleStatus(selectedVehicle, 'Maintenance', maintNotes, profile);
      } else {
        // Mark vehicle as Available if they passed inspection and was on maintenance or other state
        if (vehicleObj?.status === 'Maintenance') {
          await updateVehicleStatus(selectedVehicle, 'Available', 'Ready after passing morning prep', profile);
        }
      }

      setSuccess('সকালের প্রস্তুতি রিপোর্ট সফলভাবে সংরক্ষণ করা হয়েছে।');
      
      // Reset form
      setSelectedVehicle('');
      setSelectedDriver('');
      setOdometer('');
      setNotes('');
      setChecklist({
        fuelLevel: true,
        tireSpare: true,
        brakesOil: true,
        documentsCheck: true,
        driverFitness: true,
        helperReady: true,
        safetyKit: true,
        tripChallan: true
      });
      setOverallStatus('Ready');
      setShowForm(false);

      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'রিপোর্ট সেভ করতে ব্যর্থ হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!window.confirm('আপনি কি এই ইন্সপেকশন রেকর্ডটি মুছে ফেলতে চান?')) return;
    try {
      await deleteMorningPrep(id);
      setSuccess('রেকর্ডটি সফলভাবে মুছে ফেলা হয়েছে।');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('মুছে ফেলতে ব্যর্থ হয়েছে।');
    }
  };

  // Filter logs
  const filteredPreps = preps.filter(p => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      p.vehiclePlate.toLowerCase().includes(query) ||
      p.driverName.toLowerCase().includes(query) ||
      (p.createdBy && p.createdBy.toLowerCase().includes(query)) ||
      (p.notes && p.notes.toLowerCase().includes(query));

    if (!matchesSearch) return false;

    if (statusFilter === 'Ready') return p.overallStatus === 'Ready';
    if (statusFilter === 'Blocked') return p.overallStatus === 'Requires Maintenance';

    return true;
  });

  // Calculate standard morning metrics
  const totalInspected = preps.length;
  const countReady = preps.filter(p => p.overallStatus === 'Ready').length;
  const countBlocked = preps.filter(p => p.overallStatus === 'Requires Maintenance').length;

  // Calculate 24-hour operational statistics
  const get24HourStats = () => {
    const nowMs = Date.now();
    const twentyFourHoursAgoMs = nowMs - 24 * 60 * 60 * 1000;

    const getMs = (timestamp: any) => {
      if (!timestamp) return 0;
      if (timestamp.seconds) return timestamp.seconds * 1000;
      if (timestamp.toDate && typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
      return new Date(timestamp).getTime();
    };

    // 1. Vehicles dispatched on trips in the last 24h
    const dispatchedList = trips.filter(t => {
      const startMs = getMs(t.startTime || t.createdAt);
      return startMs >= twentyFourHoursAgoMs && (t.status === 'Running' || t.status === 'Completed');
    });

    // 2. Vehicles returned/completed trips in the last 24h
    const returnedList = trips.filter(t => {
      if (t.status !== 'Completed') return false;
      const endMs = getMs(t.endTime || t.updatedAt);
      return endMs >= twentyFourHoursAgoMs;
    });

    // 3. Went to maintenance in the last 24h (newStatus === 'Maintenance')
    const maintInList = statusLogs.filter(log => {
      if (log.newStatus !== 'Maintenance') return false;
      const createdMs = getMs(log.createdAt);
      return createdMs >= twentyFourHoursAgoMs;
    });

    // 4. Released from maintenance in the last 24h (oldStatus === 'Maintenance' && newStatus === 'Available')
    const maintOutList = statusLogs.filter(log => {
      if (log.oldStatus !== 'Maintenance' || log.newStatus !== 'Available') return false;
      const createdMs = getMs(log.createdAt);
      return createdMs >= twentyFourHoursAgoMs;
    });

    // 5. Total Bridge Toll Amount spent in the last 24h
    // To ensure exact cost capturing, we sum the toll amounts of trips dispatched or returned in the last 24h
    const activeTripIds = new Set<string>();
    dispatchedList.forEach(t => activeTripIds.add(t.id));
    returnedList.forEach(t => activeTripIds.add(t.id));

    // Also double-check any trips created/updated with toll amount in the last 24 hours
    trips.forEach(t => {
      const createdMs = getMs(t.createdAt);
      const updatedMs = getMs(t.updatedAt);
      if ((createdMs >= twentyFourHoursAgoMs || updatedMs >= twentyFourHoursAgoMs) && (t.tollAmount > 0)) {
        activeTripIds.add(t.id);
      }
    });

    const totalTollAmount = Array.from(activeTripIds).reduce((sum, tripId) => {
      const t = trips.find(trip => trip.id === tripId);
      return sum + (t?.tollAmount || 0);
    }, 0);

    const tollTrips = trips.filter(t => activeTripIds.has(t.id) && t.tollAmount > 0);

    return {
      dispatchedCount: dispatchedList.length,
      dispatchedList,
      returnedCount: returnedList.length,
      returnedList,
      maintInCount: maintInList.length,
      maintInList,
      maintOutCount: maintOutList.length,
      maintOutList,
      totalTollAmount,
      tollTrips
    };
  };

  const fleetStats = get24HourStats();

  // Dynamic relative time formatter
  const formatTimeAgo = (timestamp: any) => {
    if (!timestamp) return 'সদ্য';
    let ms = 0;
    if (timestamp.seconds) ms = timestamp.seconds * 1000;
    else ms = new Date(timestamp).getTime();

    if (!ms) return 'সদ্য';
    
    const diffMins = Math.floor((Date.now() - ms) / 60000);
    if (diffMins < 1) return 'এইমাত্র';
    if (diffMins < 60) return `${diffMins} মিনিট আগে`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} ঘণ্টা আগে`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} দিন আগে`;
  };

  const toggleDetailTab = (tab: 'dispatched' | 'returned' | 'maintenance_in' | 'maintenance_out' | 'tolls') => {
    if (activeDetailTab === tab) {
      setActiveDetailTab(null);
    } else {
      setActiveDetailTab(tab);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
          <Sunrise size={120} className="text-amber-500" />
        </div>
        <div className="space-y-1.5 relative z-10">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-600 shadow-sm">
              <Sunrise size={20} className="animate-spin-slow" />
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              প্রভাতী প্রস্তুতি ও ইন্সপেকশন বোর্ড (Morning Dispatch)
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium max-w-2xl">
            সকালে গাড়ি ছাড়ার আগে নিরাপত্তা ও ফিটনেস নিশ্চিত করার প্রি-ট্রিপ চেকলিস্ট এবং গত ২৪ ঘণ্টার অপারেশনাল অ্যাক্টিভিটি ট্র্যাকিং বোর্ড।
          </p>
        </div>
        
        {canInspect && (
          <Button 
            variant={showForm ? 'secondary' : 'primary'} 
            onClick={() => {
              setShowForm(!showForm);
              setActiveDetailTab(null);
            }}
            className="flex items-center gap-2 h-11 px-5 font-bold shadow-md rounded-xl text-xs z-10 transition-all duration-300 hover:-translate-y-0.5"
          >
            {showForm ? 'লগ ও ড্যাশবোর্ড দেখুন' : 'নতুন ইন্সপেকশন শুরু করুন'}
            {!showForm && <Plus size={15} />}
          </Button>
        )}
      </div>

      {/* 24-HOUR FLEET OPERATION MONITOR (Dynamic Dashboard Deck) */}
      {!showForm && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
          {/* Elegant geometric grid pattern background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:24px_24px] opacity-70 pointer-events-none" />

          {/* Header Panel */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Activity size={16} className="text-blue-600 animate-bounce" />
                  ২৪ ঘণ্টার অপারেশনাল ওভারভিউ (24-Hour Operational Overview)
                </h3>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                গত ২৪ ঘণ্টায় ফ্লিটের ট্রিপ ডিসপ্যাচ, গাড়ির আগমন, মেইনটেনেন্স চলাচল এবং টোল হিসাবের রিয়েল-টাইম স্টেট। (কার্ডে ক্লিক করে লাইভ তালিকা দেখুন)
              </p>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-700 font-bold font-mono bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
              <Clock size={12} className="text-blue-500" />
              হিসাব শুরুর সময়: {new Date(Date.now() - 24*3600*1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} থেকে আজ
            </div>
          </div>

          {/* Modern Bento Grid with Slate Border-Left Accents */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 relative z-10">
            
            {/* 1. Dispatched Bento Card */}
            <button
              onClick={() => toggleDetailTab('dispatched')}
              className={cn(
                "p-4 rounded-xl text-left border-y border-r border-l-4 transition-all duration-300 relative overflow-hidden group hover:shadow-md hover:-translate-y-0.5",
                activeDetailTab === 'dispatched'
                  ? "bg-blue-50/70 border-blue-200 border-l-blue-600 shadow-sm shadow-blue-100"
                  : "bg-white border-slate-200 border-l-blue-500"
              )}
            >
              <div className="absolute top-3 right-3 p-1.5 rounded-lg bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform duration-200">
                <ArrowUpRight size={14} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">ট্রিপ রওনা (Dispatched)</p>
              <div className="flex items-baseline gap-1 mt-4">
                <h4 className="text-3xl font-black text-slate-900 tracking-tight">{fleetStats.dispatchedCount}</h4>
                <span className="text-xs font-semibold text-slate-500">টি গাড়ি</span>
              </div>
              <p className="mt-2 text-[9px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-1">
                {activeDetailTab === 'dispatched' ? "• তালিকা সচল" : "➔ তালিকা দেখুন"}
              </p>
            </button>

            {/* 2. Returned Bento Card */}
            <button
              onClick={() => toggleDetailTab('returned')}
              className={cn(
                "p-4 rounded-xl text-left border-y border-r border-l-4 transition-all duration-300 relative overflow-hidden group hover:shadow-md hover:-translate-y-0.5",
                activeDetailTab === 'returned'
                  ? "bg-emerald-50/70 border-emerald-200 border-l-emerald-600 shadow-sm shadow-emerald-100"
                  : "bg-white border-slate-200 border-l-emerald-500"
              )}
            >
              <div className="absolute top-3 right-3 p-1.5 rounded-lg bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform duration-200">
                <ArrowDownLeft size={14} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">ফিরে এসেছে (Returned)</p>
              <div className="flex items-baseline gap-1 mt-4">
                <h4 className="text-3xl font-black text-slate-900 tracking-tight">{fleetStats.returnedCount}</h4>
                <span className="text-xs font-semibold text-slate-500">টি গাড়ি</span>
              </div>
              <p className="mt-2 text-[9px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                {activeDetailTab === 'returned' ? "• তালিকা সচল" : "➔ তালিকা দেখুন"}
              </p>
            </button>

            {/* 3. Maintenance In Bento Card */}
            <button
              onClick={() => toggleDetailTab('maintenance_in')}
              className={cn(
                "p-4 rounded-xl text-left border-y border-r border-l-4 transition-all duration-300 relative overflow-hidden group hover:shadow-md hover:-translate-y-0.5",
                activeDetailTab === 'maintenance_in'
                  ? "bg-rose-50/70 border-rose-200 border-l-rose-600 shadow-sm shadow-rose-100"
                  : "bg-white border-slate-200 border-l-rose-500"
              )}
            >
              <div className="absolute top-3 right-3 p-1.5 rounded-lg bg-rose-50 text-rose-600 group-hover:scale-110 transition-transform duration-200">
                <Wrench size={14} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">ওয়ার্কশপে গেছে (In)</p>
              <div className="flex items-baseline gap-1 mt-4">
                <h4 className="text-3xl font-black text-slate-900 tracking-tight">{fleetStats.maintInCount}</h4>
                <span className="text-xs font-semibold text-slate-500">টি গাড়ি</span>
              </div>
              <p className="mt-2 text-[9px] font-bold text-rose-600 uppercase tracking-widest flex items-center gap-1">
                {activeDetailTab === 'maintenance_in' ? "•  তালিকা সচল" : "➔ তালিকা দেখুন"}
              </p>
            </button>

            {/* 4. Maintenance Out Bento Card */}
            <button
              onClick={() => toggleDetailTab('maintenance_out')}
              className={cn(
                "p-4 rounded-xl text-left border-y border-r border-l-4 transition-all duration-300 relative overflow-hidden group hover:shadow-md hover:-translate-y-0.5",
                activeDetailTab === 'maintenance_out'
                  ? "bg-cyan-50/70 border-cyan-200 border-l-cyan-600 shadow-sm shadow-cyan-100"
                  : "bg-white border-slate-200 border-l-cyan-500"
              )}
            >
              <div className="absolute top-3 right-3 p-1.5 rounded-lg bg-cyan-50 text-cyan-600 group-hover:scale-110 transition-transform duration-200">
                <ShieldCheck size={14} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">রিলিজ পেয়েছে (Out)</p>
              <div className="flex items-baseline gap-1 mt-4">
                <h4 className="text-3xl font-black text-slate-900 tracking-tight">{fleetStats.maintOutCount}</h4>
                <span className="text-xs font-semibold text-slate-500">টি গাড়ি</span>
              </div>
              <p className="mt-2 text-[9px] font-bold text-cyan-600 uppercase tracking-widest flex items-center gap-1">
                {activeDetailTab === 'maintenance_out' ? "• তালিকা সচল" : "➔ তালিকা দেখুন"}
              </p>
            </button>

            {/* 5. Toll Bento Card */}
            <button
              onClick={() => toggleDetailTab('tolls')}
              className={cn(
                "p-4 rounded-xl text-left border-y border-r border-l-4 transition-all duration-300 col-span-2 md:col-span-1 relative overflow-hidden group hover:shadow-md hover:-translate-y-0.5",
                activeDetailTab === 'tolls'
                  ? "bg-violet-50/70 border-violet-200 border-l-violet-600 shadow-sm shadow-violet-100"
                  : "bg-white border-slate-200 border-l-violet-500"
              )}
            >
              <div className="absolute top-3 right-3 p-1.5 rounded-lg bg-violet-50 text-violet-600 group-hover:scale-110 transition-transform duration-200">
                <Coins size={14} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">সেতু টোল খরচ (Tolls)</p>
              <div className="flex items-baseline gap-0.5 mt-4">
                <span className="text-sm font-bold text-slate-400">৳</span>
                <h4 className="text-2xl font-black text-slate-900 tracking-tight">{fleetStats.totalTollAmount}</h4>
              </div>
              <p className="mt-2.5 text-[9px] font-bold text-violet-600 uppercase tracking-widest flex items-center gap-1">
                {activeDetailTab === 'tolls' ? "• তালিকা সচল" : "➔ তালিকা দেখুন"}
              </p>
            </button>

          </div>

          {/* EXPANDABLE DETAIL DRAWER PANEL WITH SLIDE DOWN */}
          {activeDetailTab && (
            <div className="mt-6 p-5 bg-slate-50 rounded-2xl border border-slate-200/80 animate-in slide-in-from-top-4 duration-300 relative z-10">
              
              {/* Header inside expanded drawer */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                    {activeDetailTab === 'dispatched' && <ArrowUpRight size={15} className="text-blue-500" />}
                    {activeDetailTab === 'returned' && <ArrowDownLeft size={15} className="text-emerald-500" />}
                    {activeDetailTab === 'maintenance_in' && <Wrench size={15} className="text-rose-500" />}
                    {activeDetailTab === 'maintenance_out' && <ShieldCheck size={15} className="text-cyan-500" />}
                    {activeDetailTab === 'tolls' && <Coins size={15} className="text-violet-500" />}
                  </span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    {activeDetailTab === 'dispatched' && '২৪ ঘণ্টায় ট্রিপে রওনা হওয়া গাড়িসমূহ'}
                    {activeDetailTab === 'returned' && '২৪ ঘণ্টায় সফলভাবে ফেরত আসা গাড়িসমূহ'}
                    {activeDetailTab === 'maintenance_in' && '২৪ ঘণ্টায় মেইনটেনেন্স/রক্ষণাবেক্ষণে নেওয়া গাড়িসমূহ'}
                    {activeDetailTab === 'maintenance_out' && '২৪ ঘণ্টায় মেইনটেনেন্স থেকে রিলিজ পাওয়া সচল গাড়ি'}
                    {activeDetailTab === 'tolls' && '২৪ ঘণ্টায় পরিশোধিত সেতু ও হাইওয়ে টোল বিস্তারিত'}
                  </h4>
                </div>
                <button 
                  onClick={() => setActiveDetailTab(null)}
                  className="text-slate-500 hover:text-slate-800 text-xs font-semibold bg-slate-200/60 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors"
                >
                  বন্ধ করুন (Close)
                </button>
              </div>

              {/* Data list view based on activeDetailTab */}
              
              {/* Dispatch Tab List */}
              {activeDetailTab === 'dispatched' && (
                <div className="overflow-x-auto">
                  {fleetStats.dispatchedList.length === 0 ? (
                    <p className="text-slate-500 text-xs italic py-4 text-center">গত ২৪ ঘণ্টায় কোন গাড়ি ট্রিপ শুরু করেনি।</p>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase">
                          <th className="py-2.5 px-3">গাড়ি প্লেট / নম্বর</th>
                          <th className="py-2.5 px-3">চালক ও ফোন</th>
                          <th className="py-2.5 px-3">রুট / গন্তব্য</th>
                          <th className="py-2.5 px-3">সময় কাল</th>
                          <th className="py-2.5 px-3 text-right">স্ট্যাটাস</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/50">
                        {fleetStats.dispatchedList.map(t => (
                          <tr key={t.id} className="hover:bg-slate-200/40 transition-colors">
                            <td className="py-3 px-3 font-bold text-slate-800">
                              <div className="flex items-center gap-1.5">
                                <Truck size={12} className="text-blue-500" />
                                {t.vehiclePlate || t.vehicleNumber}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-semibold text-slate-800">{t.driverName}</div>
                              <div className="text-[10px] text-slate-500 font-medium">{t.driverPhone || 'No Phone'}</div>
                            </td>
                            <td className="py-3 px-3 text-slate-700">
                              <div className="flex items-center gap-1 font-semibold">
                                <MapPin size={11} className="text-slate-400" />
                                {t.startLocation || 'আড়ত'} ➔ {t.endLocation || 'গন্তব্য'}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-600 font-mono">
                              <div className="font-medium">{formatTimeAgo(t.startTime || t.createdAt)}</div>
                              <div className="text-[9px] text-slate-400">
                                {t.startTime ? new Date(t.startTime.seconds ? t.startTime.seconds * 1000 : t.startTime).toLocaleTimeString('bn-BD', {hour:'2-digit', minute:'2-digit'}) : 'সদ্য'}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-bold ${
                                t.status === 'Running' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}>
                                {t.status === 'Running' ? 'চলমান' : 'সম্পন্ন'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Returned Tab List */}
              {activeDetailTab === 'returned' && (
                <div className="overflow-x-auto">
                  {fleetStats.returnedList.length === 0 ? (
                    <p className="text-slate-500 text-xs italic py-4 text-center">গত ২৪ ঘণ্টায় কোন গাড়ি ট্রিপ সম্পন্ন করে ফিরে আসেনি।</p>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase">
                          <th className="py-2.5 px-3">গাড়ি প্লেট / নম্বর</th>
                          <th className="py-2.5 px-3">চালক</th>
                          <th className="py-2.5 px-3">গন্তব্য রুট</th>
                          <th className="py-2.5 px-3">ফেরত আসার সময়</th>
                          <th className="py-2.5 px-3 text-right">রিসিভার</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/50">
                        {fleetStats.returnedList.map(t => (
                          <tr key={t.id} className="hover:bg-slate-200/40 transition-colors">
                            <td className="py-3 px-3 font-bold text-slate-800">
                              <div className="flex items-center gap-1.5">
                                <Truck size={12} className="text-emerald-500" />
                                {t.vehiclePlate || t.vehicleNumber}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-800 font-semibold">{t.driverName}</td>
                            <td className="py-3 px-3 text-slate-700 font-medium">
                              <div className="flex items-center gap-1 font-semibold">
                                <MapPin size={11} className="text-slate-400" />
                                {t.startLocation} ➔ {t.endLocation}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-emerald-700 font-mono">
                              <div className="font-semibold">{formatTimeAgo(t.endTime)}</div>
                              <div className="text-[9px] text-slate-400">
                                {new Date(t.endTime.seconds ? t.endTime.seconds * 1000 : t.endTime).toLocaleTimeString('bn-BD', {hour:'2-digit', minute:'2-digit'})}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right text-slate-500 text-[10px] font-mono font-bold">{t.completedBy || 'Checker'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Maintenance Entered Tab List */}
              {activeDetailTab === 'maintenance_in' && (
                <div className="overflow-x-auto">
                  {fleetStats.maintInList.length === 0 ? (
                    <p className="text-slate-500 text-xs italic py-4 text-center">গত ২৪ ঘণ্টায় নতুন কোন গাড়ি রক্ষণাবেক্ষণে (Maintenance) পাঠানো হয়নি।</p>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase">
                          <th className="py-2.5 px-3">গাড়ি নম্বর</th>
                          <th className="py-2.5 px-3">পূর্ববর্তী অবস্থা</th>
                          <th className="py-2.5 px-3">নির্ধারণের সময়</th>
                          <th className="py-2.5 px-3">মেরামত / ত্রুটি বিবরণী</th>
                          <th className="py-2.5 px-3 text-right">নির্ধারক</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/50">
                        {fleetStats.maintInList.map(l => (
                          <tr key={l.id} className="hover:bg-slate-200/40 transition-colors">
                            <td className="py-3 px-3 font-bold text-slate-800">
                              <div className="flex items-center gap-1.5">
                                <Truck size={12} className="text-rose-500" />
                                {l.vehiclePlate}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-500 font-mono italic font-semibold">{l.oldStatus || 'Available'}</td>
                            <td className="py-3 px-3 text-rose-700 font-mono">
                              <div className="font-semibold">{formatTimeAgo(l.createdAt)}</div>
                              <div className="text-[9px] text-slate-400">
                                {new Date(l.createdAt.seconds ? l.createdAt.seconds * 1000 : l.createdAt).toLocaleTimeString('bn-BD', {hour:'2-digit', minute:'2-digit'})}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-700 font-medium max-w-xs truncate" title={l.notes}>
                              {l.notes || 'সাধারণ রক্ষণাবেক্ষণ এবং সকালে ত্রুটি ফাইন্ডিং'}
                            </td>
                            <td className="py-3 px-3 text-right text-slate-500 font-mono text-[10px] font-semibold">{l.createdBy}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Maintenance Released Tab List */}
              {activeDetailTab === 'maintenance_out' && (
                <div className="overflow-x-auto">
                  {fleetStats.maintOutList.length === 0 ? (
                    <p className="text-slate-500 text-xs italic py-4 text-center">গত ২৪ ঘণ্টায় মেইনটেনেন্স থেকে ত্রুটিমুক্ত হয়ে কোন গাড়ি ছাড়া পায়নি।</p>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase">
                          <th className="py-2.5 px-3">গাড়ি নম্বর</th>
                          <th className="py-2.5 px-3">বর্তমান স্ট্যাটাস</th>
                          <th className="py-2.5 px-3">মুক্তির সময় কাল</th>
                          <th className="py-2.5 px-3">মন্তব্য / রিপোর্ট</th>
                          <th className="py-2.5 px-3 text-right">অনুমোদনকারী</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/50">
                        {fleetStats.maintOutList.map(l => (
                          <tr key={l.id} className="hover:bg-slate-200/40 transition-colors">
                            <td className="py-3 px-3 font-bold text-slate-800">
                              <div className="flex items-center gap-1.5">
                                <Truck size={12} className="text-cyan-500" />
                                {l.vehiclePlate}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="inline-block px-2 py-0.5 rounded-md text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                সচল (Available)
                              </span>
                            </td>
                            <td className="py-3 px-3 text-cyan-700 font-mono">
                              <div className="font-semibold">{formatTimeAgo(l.createdAt)}</div>
                              <div className="text-[9px] text-slate-400">
                                {new Date(l.createdAt.seconds ? l.createdAt.seconds * 1000 : l.createdAt).toLocaleTimeString('bn-BD', {hour:'2-digit', minute:'2-digit'})}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-700 font-medium max-w-xs truncate" title={l.notes}>
                              {l.notes || 'সফল মেরামত ও প্রভাতী পরীক্ষায় সচল সাপেক্ষে মুক্তি'}
                            </td>
                            <td className="py-3 px-3 text-right text-slate-500 font-mono text-[10px] font-semibold">{l.createdBy}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Bridge Toll Details List */}
              {activeDetailTab === 'tolls' && (
                <div className="overflow-x-auto">
                  {fleetStats.tollTrips.length === 0 ? (
                    <p className="text-slate-500 text-xs italic py-4 text-center">গত ২৪ ঘণ্টায় কোন ট্রিপের টোল সেতু ফি বা খরচ পাওয়া যায়নি।</p>
                  ) : (
                    <div>
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase">
                            <th className="py-2.5 px-3">গাড়ি নম্বর ও চালক</th>
                            <th className="py-2.5 px-3">সেতু ও রুট</th>
                            <th className="py-2.5 px-3">সময় কাল</th>
                            <th className="py-2.5 px-3 text-right">টোল এ খরচ (Toll Paid)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/50">
                          {fleetStats.tollTrips.map(t => (
                            <tr key={t.id} className="hover:bg-slate-200/40 transition-colors">
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-800">{t.vehiclePlate || t.vehicleNumber}</div>
                                <div className="text-[10px] text-slate-500 font-medium">{t.driverName}</div>
                              </td>
                              <td className="py-3 px-3 text-slate-700 font-semibold">
                                <div className="text-slate-800">{t.bridgeName || 'পদ্মা/যমুনা/মেঘনা সেতু'}</div>
                                <div className="text-[10px] text-slate-500 font-medium">{t.startLocation} ➔ {t.endLocation}</div>
                              </td>
                              <td className="py-3 px-3 text-slate-600 font-mono font-medium">
                                <div>{formatTimeAgo(t.startTime || t.createdAt)}</div>
                              </td>
                              <td className="py-3 px-3 text-right font-black text-violet-700 text-sm font-mono">
                                ৳ {t.tollAmount}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-bold">মোট সেতু ও রোড টোল হিসাব:</span>
                        <span className="font-black text-sm bg-violet-50 text-violet-700 border border-violet-200 px-3 py-1.5 rounded-xl">
                          ৳ {fleetStats.totalTollAmount} BDT
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      )}

      {/* STANDARD STATS BANNER (PREVIOUS MORNING STATISTICS) */}
      {!showForm && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200/60 p-5 rounded-2xl flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">আজকের মোট প্রভাতী ইন্সপেকশন</p>
              <h3 className="text-3xl font-black text-indigo-900 mt-1">{totalInspected} টি</h3>
            </div>
            <Activity size={36} className="text-indigo-400 opacity-80" />
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200/60 p-5 rounded-2xl flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">সম্পূর্ণ প্রস্তুত (Certified Ready)</p>
              <h3 className="text-3xl font-black text-emerald-900 mt-1">{countReady} টি</h3>
            </div>
            <CheckCircle size={36} className="text-emerald-500 opacity-80" />
          </div>

          <div className="bg-gradient-to-br from-rose-50 to-rose-100 border border-rose-200/60 p-5 rounded-2xl flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">হোল্ড / রক্ষণাবেক্ষণ প্রয়োজন</p>
              <h3 className="text-3xl font-black text-rose-900 mt-1">{countBlocked} টি</h3>
            </div>
            <AlertTriangle size={36} className="text-rose-500 opacity-80 animate-pulse" />
          </div>
        </div>
      )}

      {/* Notifications */}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center gap-2 animate-in fade-in">
          <CheckCircle size={18} className="text-emerald-600 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm flex items-center gap-2 animate-in fade-in">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Permission message */}
      {!canInspect && (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500 font-medium">
          আপনার এই জোন বা ইন্সপেকশন মডিউল ব্যবহার করার অনুমতি নেই।
        </div>
      )}

      {/* New Inspection Form */}
      {canInspect && showForm && (
        <Card title="নতুন প্রি-ট্রিপ ইন্সপেকশন ফর্ম (Daily Safety & Fitness Check)" className="max-w-3xl mx-auto shadow-md">
          <form onSubmit={handleFormSubmit} className="space-y-6">
            
            {/* Pick Vehicle & Driver */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  গাড়ি নির্বাচন করুন (Select Vehicle) <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-accent focus:bg-white transition-all"
                  value={selectedVehicle}
                  onChange={(e) => setSelectedVehicle(e.target.value)}
                >
                  <option value="">গাড়ি সিলেক্ট করুন...</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.vehicleNumber} ({v.type}) - [{v.status === 'Maintenance' ? 'রক্ষণাবেক্ষণ' : 'সচল'}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  চালক নির্বাচন করুন (Select Driver) <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-accent focus:bg-white transition-all"
                  value={selectedDriver}
                  onChange={(e) => setSelectedDriver(e.target.value)}
                >
                  <option value="">চালক সিলেক্ট করুন...</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.phone ? `(${d.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Odometer Input */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  ওডোমিটার রিডিং (Odometer Reading - KM)
                </label>
                <input
                  type="number"
                  placeholder="বর্তমান রিডিং লিখুন..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-accent focus:bg-white transition-all"
                  value={odometer}
                  onChange={(e) => setOdometer(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  চূড়ান্ত অবস্থা (Overall Suitability Status)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOverallStatus('Ready')}
                    className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                      overallStatus === 'Ready'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    সম্পূর্ণ প্রস্তুত (Ready)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverallStatus('Requires Maintenance')}
                    className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                      overallStatus === 'Requires Maintenance'
                        ? 'bg-rose-50 border-rose-500 text-rose-700 ring-2 ring-rose-500/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    হোল্ড / মেরামত প্রয়োজন
                  </button>
                </div>
              </div>
            </div>

            {/* Structured Morning Pre-Trip Checklist */}
            <div className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-200/60">
              <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5 mb-2">
                <CheckSquare size={14} className="text-accent" />
                বাধ্যতামূলক সকালের চেকলিস্ট (Checklist Verification)
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {inspectionItems.map(item => {
                  const passed = checklist[item.key];
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleToggleCheck(item.key)}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                        passed 
                          ? 'bg-white border-slate-200 hover:border-slate-300' 
                          : 'bg-rose-50/50 border-rose-200 text-rose-900 hover:bg-rose-50'
                      }`}
                    >
                      <span className="mt-0.5 flex-shrink-0">
                        {passed ? (
                          <CheckCircle size={18} className="text-emerald-500" />
                        ) : (
                          <XCircle size={18} className="text-rose-500 animate-pulse" />
                        )}
                      </span>
                      <div>
                        <p className="text-xs font-bold leading-tight">{item.labelBn}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{item.labelEn}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                মন্তব্য বা ত্রুটির বিবরণ (Checker Remarks / Issue Details)
              </label>
              <textarea
                placeholder="চেকিং বা ফিটনেস সংক্রান্ত কোন সমস্যা থাকলে বিস্তারিত লিখুন..."
                rows={3}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-accent focus:bg-white transition-all"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                বাতিল
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'রিপোর্ট সংরক্ষণ হচ্ছে...' : 'রিপোর্ট সাবমিট করুন'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Logs Dashboard view */}
      {canInspect && !showForm && (
        <div className="space-y-4">
          
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Status Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 self-start">
              {(['All', 'Ready', 'Blocked'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    statusFilter === tab 
                      ? 'bg-white text-slate-800 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab === 'All' && 'সব ইন্সপেকশন'}
                  {tab === 'Ready' && 'শুধুমাত্র প্রস্তুত'}
                  {tab === 'Blocked' && 'ত্রুটিযুক্ত / অন-হোল্ড'}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative flex-1 max-w-xs md:ml-auto">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="গাড়ি, চালক বা বিবরণ খুঁজুন..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:border-accent focus:bg-white transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Checklist Cards List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPreps.length === 0 ? (
              <div className="col-span-full bg-white p-12 text-center text-slate-400 border border-slate-200 rounded-xl italic">
                কোন প্রভাতী ইন্সপেকশন লগ পাওয়া যায়নি।
              </div>
            ) : (
              filteredPreps.map(prep => {
                const dateVal = prep.createdAt?.seconds 
                  ? new Date(prep.createdAt.seconds * 1000) 
                  : new Date();
                const formattedTime = dateVal.toLocaleTimeString('bn-BD', { hour: 'numeric', minute: 'numeric' });
                
                // Count passes
                const listValues = Object.values(prep.checklist || {});
                const passedCount = listValues.filter(v => v === true).length;
                const totalChecks = listValues.length;

                return (
                  <div 
                    key={prep.id}
                    className={`bg-white rounded-xl border p-5 shadow-sm space-y-4 relative overflow-hidden transition-all hover:shadow-md ${
                      prep.overallStatus === 'Ready' 
                        ? 'border-emerald-100/80 hover:border-emerald-200' 
                        : 'border-rose-100/80 hover:border-rose-200'
                    }`}
                  >
                    {/* Top status indicator line */}
                    <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                      prep.overallStatus === 'Ready' ? 'bg-emerald-500' : 'bg-rose-500'
                    }`} />

                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="p-1 rounded bg-slate-100 text-slate-600">
                            <Truck size={13} />
                          </span>
                          <h4 className="font-bold text-slate-900 text-sm">{prep.vehiclePlate}</h4>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium">{prep.vehicleType} • ওডোমিটার: {prep.odometer || 'N/A'} KM</p>
                      </div>

                      <div className="text-right">
                        {prep.overallStatus === 'Ready' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                            <CheckCircle size={10} />
                            সচল (Ready)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 rounded-full">
                            <AlertTriangle size={10} />
                            ত্রুটি (Hold)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Driver and checker info */}
                    <div className="text-xs space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <p className="text-slate-600 flex items-center gap-1.5">
                        <User size={12} className="text-slate-400" />
                        চালক: <strong className="text-slate-800">{prep.driverName}</strong>
                      </p>
                      {prep.driverPhone && (
                        <p className="text-[10px] text-slate-400 pl-4">মোবাইল: {prep.driverPhone}</p>
                      )}
                    </div>

                    {/* Checklist summary */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">চেকলিস্ট ভেরিফিকেশন:</span>
                      <span className={`font-bold px-2 py-0.5 rounded ${
                        passedCount === totalChecks 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : 'bg-rose-50 text-rose-700'
                      }`}>
                        {passedCount}/{totalChecks} Passed
                      </span>
                    </div>

                    {/* Notes if any */}
                    {prep.notes && (
                      <div className="text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-slate-600 leading-relaxed italic">
                        &ldquo;{prep.notes}&rdquo;
                      </div>
                    )}

                    {/* Footer */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">ইন্সপেক্টর: {prep.createdBy}</p>
                        <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                          <Clock size={11} className="text-slate-400" />
                          {prep.dateStr} • {formattedTime}
                        </p>
                      </div>

                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteLog(prep.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MorningPrep;
