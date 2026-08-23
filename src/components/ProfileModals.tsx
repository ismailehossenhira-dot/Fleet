import React, { useState, useEffect } from 'react';
import { 
  User, 
  Truck, 
  Phone, 
  CreditCard, 
  MapPin, 
  HeartHandshake, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileText, 
  Wrench, 
  ShieldAlert, 
  ExternalLink, 
  Edit3, 
  X,
  Clock,
  Check,
  Ban,
  TrendingUp,
  History,
  Eye,
  Info,
  Printer,
  Download,
  Star,
  Award,
  ShieldCheck,
  Maximize2,
  Minimize2,
  Sparkles,
  Users,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Button, AuditDetailsDropdown } from './Common';
import { subscribeToCollection, updateVehicle, updateDriver, findStaffById } from '../db';
import { useAuth } from '../AuthContext';
import { cn, FAMILY_RELATIONS, FamilyRelation } from '../lib/utils';
import { exportStaffProfilePrint, downloadStaffBiodataFile } from '../utils/exportUtils';

// Standard Tools list
export const STANDARD_VEHICLE_TOOLS = [
  { key: 'jack', label: 'জগ (Jack)', icon: Wrench },
  { key: 'wheelWrench', label: 'হুইল রেঞ্জ (Wheel Wrench)', icon: Wrench },
  { key: 'lever', label: 'লিভার (Lever)', icon: Wrench },
  { key: 'spareWheel', label: 'অতিরিক্ত চাকা (Spare Wheel)', icon: Truck },
  { key: 'pipe', label: 'পাইপ (Pipe)', icon: Wrench },
] as const;

// Standard Documents list
export const STANDARD_VEHICLE_DOCS = [
  { key: 'TT', label: 'TT (ট্যাক্স টোকেন / Tax Token)', code: 'TT' },
  { key: 'FC', label: 'FC (ফিটনেস সার্টিফিকেট / Fitness Certificate)', code: 'FC' },
  { key: 'RP', label: 'RP (রুট পারমিট / Route Permit)', code: 'RP' },
  { key: 'RC', label: 'RC (রেজিস্ট্রেশন সার্টিফিকেট / Registration Certificate)', code: 'RC' },
  { key: 'Ads', label: 'Ads (অগ্রিম আয়কর / বিজ্ঞাপন / বীমা)', code: 'Ads' },
] as const;

// Helper to translate family relation value to Bangla readable string
export const getFamilyRelationLabel = (relationVal?: string) => {
  const match = FAMILY_RELATIONS.find(r => r.value === relationVal);
  return match ? match.label : (relationVal || 'পারিবারিক সম্পর্ক উল্লেখ নেই');
};

// Default tool state
export const getDefaultVehicleTools = (existing?: any) => {
  return {
    jack: existing?.jack ?? true,
    wheelWrench: existing?.wheelWrench ?? existing?.wheel_wrench ?? existing?.wheelRange ?? true,
    lever: existing?.lever ?? true,
    spareWheel: existing?.spareWheel ?? true,
    pipe: existing?.pipe ?? true,
  };
};

// Default doc state
export const getDefaultVehicleDocs = (existing?: any) => {
  return {
    TT: existing?.TT ?? true,
    FC: existing?.FC ?? true,
    RP: existing?.RP ?? true,
    RC: existing?.RC ?? true,
    Ads: existing?.Ads ?? true,
  };
};

// ==========================================
// 1. STAFF PROFILE MODAL (Driver / Helper)
// ==========================================
export const StaffProfileModal: React.FC<{
  staff: any;
  onClose: () => void;
  onEdit?: (staff: any) => void;
}> = ({ staff, onClose, onEdit }) => {
  const { isAdmin, isSubAdmin } = useAuth();
  const canManage = isAdmin || isSubAdmin;
  const [trips, setTrips] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'trips' | 'biodata'>('overview');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [tripSearch, setTripSearch] = useState('');
  
  const [editForm, setEditForm] = useState({
    name: staff?.name || '',
    phoneNumber: staff?.phoneNumber || '',
    licenseNo: staff?.licenseNo || '',
    address: staff?.address || '',
    familyPhone: staff?.familyPhone || '',
    familyPhoneRelation: staff?.familyPhoneRelation || 'Father',
    role: staff?.role || 'Driver',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsub = subscribeToCollection('trips', setTrips);
    return () => unsub();
  }, []);

  if (!staff) return null;

  const staffId = (staff.driverId || '').trim().toUpperCase();

  // Find all trips for this staff
  const staffTrips = trips.filter(t => {
    const dId = (t.driverId || '').trim().toUpperCase();
    const hId = (t.helperId || '').trim().toUpperCase();
    return dId === staffId || hId === staffId;
  });

  // Calculate monthly completed trips (current month)
  const now = new Date();
  const currentMonthYear = `${now.getFullYear()}-${now.getMonth()}`;

  const monthlyCompletedTrips = staffTrips.filter(t => {
    if (t.status !== 'Completed') return false;
    let tripDate: Date | null = null;
    if (t.createdAt?.toDate) {
      tripDate = t.createdAt.toDate();
    } else if (t.createdAt) {
      tripDate = new Date(t.createdAt);
    } else if (t.startTime?.toDate) {
      tripDate = t.startTime.toDate();
    } else if (t.startTime) {
      tripDate = new Date(t.startTime);
    }
    if (!tripDate) return false;
    return `${tripDate.getFullYear()}-${tripDate.getMonth()}` === currentMonthYear;
  });

  const totalCompletedTrips = staffTrips.filter(t => t.status === 'Completed');
  const activeRunningTrip = staffTrips.find(t => t.status === 'Running');
  const pendingTrip = staffTrips.find(t => t.status === 'Pending');

  // Performance calculations
  const totalCount = totalCompletedTrips.length;
  let baseRating = 4.0;
  if (totalCount >= 50) baseRating = 5.0;
  else if (totalCount >= 25) baseRating = 4.9;
  else if (totalCount >= 15) baseRating = 4.8;
  else if (totalCount >= 8) baseRating = 4.6;
  else if (totalCount >= 3) baseRating = 4.4;
  else if (totalCount >= 1) baseRating = 4.2;

  if (staff.isSuspended) {
    baseRating = Math.max(1.0, baseRating - 1.2);
  }

  let grade = 'A+ (টপ স্টার পারফরমার)';
  if (baseRating < 3.0) grade = 'D (সতর্কবার্তা প্রয়োজন)';
  else if (baseRating < 3.8) grade = 'C (উন্নতি দরকার)';
  else if (baseRating < 4.4) grade = 'B+ (ভালো পারফরম্যান্স)';
  else if (baseRating < 4.8) grade = 'A (চমৎকার রেকর্ড)';

  const statusText = staff.isSuspended 
    ? `সাসপেন্ডেড (${staff.suspensionDays || 0} দিন)` 
    : (activeRunningTrip ? 'ট্রিপে নিয়োজিত' : (pendingTrip ? 'পেন্ডিং ট্রিপ' : 'উপলব্ধ (Free)'));

  const performanceData = {
    rating: baseRating,
    grade,
    totalTrips: totalCompletedTrips.length,
    monthlyTrips: monthlyCompletedTrips.length,
    activeTrip: activeRunningTrip,
    statusText
  };

  const handleSaveInline = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateDriver(staff.id, editForm);
      setIsEditingInline(false);
    } catch (err) {
      console.error("Save staff profile error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered trips for history tab
  const filteredTrips = staffTrips.filter(t => {
    if (!tripSearch.trim()) return true;
    const q = tripSearch.toLowerCase();
    return (
      (t.vehiclePlate && t.vehiclePlate.toLowerCase().includes(q)) ||
      (t.location && t.location.toLowerCase().includes(q)) ||
      (t.status && t.status.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-sm overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', damping: 26, stiffness: 340 }}
        onClick={e => e.stopPropagation()} 
        className={cn(
          "relative bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col transition-all duration-300",
          isFullscreen 
            ? "w-full h-[96vh] max-w-none rounded-2xl" 
            : "w-full max-w-4xl lg:max-w-5xl max-h-[92vh]"
        )}
      >
        {/* Header with Role Banner & Action Controls */}
        <div className={cn(
          "px-5 sm:px-8 py-5 text-white flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-sm",
          staff.role === 'Helper' 
            ? "bg-gradient-to-r from-teal-700 via-emerald-700 to-teal-800" 
            : "bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900"
        )}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white font-black text-2xl shadow-inner border border-white/20">
              {staff.name ? staff.name.charAt(0).toUpperCase() : <User size={28} />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-black uppercase tracking-wider border border-white/20">
                  {staff.role === 'Helper' ? 'হেলপার (Helper)' : 'ড্রাইভার (Driver)'}
                </span>
                <span className="text-white/90 text-xs font-mono font-bold bg-black/20 px-2 py-0.5 rounded-md">
                  #{staff.driverId}
                </span>
                <span className="flex items-center gap-1 text-amber-300 bg-amber-950/40 border border-amber-400/30 px-2 py-0.5 rounded-md text-xs font-black">
                  <Star size={12} className="fill-amber-400 text-amber-400" />
                  {baseRating.toFixed(1)}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
                {staff.name}
              </h3>
            </div>
          </div>

          {/* Action buttons (Print, Download, Edit, Fullscreen, Close) */}
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {/* Quick Print Button */}
            <button
              type="button"
              onClick={() => exportStaffProfilePrint(staff, performanceData, staffTrips)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-all border border-white/20 cursor-pointer shadow-sm active:scale-95"
              title="প্রোফাইল সরাসরি প্রিন্ট করুন"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">প্রিন্ট</span>
            </button>

            {/* Quick Download Button */}
            <button
              type="button"
              onClick={() => downloadStaffBiodataFile(staff, performanceData, staffTrips)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-all border border-white/20 cursor-pointer shadow-sm active:scale-95"
              title="বায়োডাটা ফাইল ডাউনলোড করুন"
            >
              <Download size={15} />
              <span className="hidden sm:inline">ডাউনলোড</span>
            </button>

            {canManage && !isEditingInline && (
              <button
                type="button"
                onClick={() => {
                  if (onEdit) {
                    onClose();
                    onEdit(staff);
                  } else {
                    setIsEditingInline(true);
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-all border border-white/20 cursor-pointer shadow-sm active:scale-95"
                title="তথ্য পরিবর্তন বা সম্পাদন"
              >
                <Edit3 size={15} />
                <span className="hidden sm:inline">এডিট</span>
              </button>
            )}

            {/* Toggle Fullscreen / Expand */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer border border-white/20"
              title={isFullscreen ? "আগের আকারে ফিরুন" : "বড় ভিউ / ফুলস্ক্রিন করুন"}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/15 hover:bg-red-500/80 text-white transition-colors cursor-pointer border border-white/20"
              title="বন্ধ করুন"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div className="px-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between overflow-x-auto gap-2 py-2 shrink-0">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap",
                activeTab === 'overview'
                  ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              )}
            >
              <User size={15} className={activeTab === 'overview' ? "text-blue-600" : "text-slate-400"} />
              <span>১. প্রোফাইল ও পরিচিতি</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('performance')}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap",
                activeTab === 'performance'
                  ? "bg-white text-indigo-700 shadow-sm border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              )}
            >
              <Award size={15} className={activeTab === 'performance' ? "text-amber-500" : "text-slate-400"} />
              <span>২. পারফরম্যান্স স্কোরকার্ড</span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
                {baseRating.toFixed(1)} ★
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('trips')}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap",
                activeTab === 'trips'
                  ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              )}
            >
              <History size={15} className={activeTab === 'trips' ? "text-blue-600" : "text-slate-400"} />
              <span>৩. ট্রিপ হিস্ট্রি</span>
              <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black">
                {staffTrips.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('biodata')}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap",
                activeTab === 'biodata'
                  ? "bg-white text-teal-700 shadow-sm border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              )}
            >
              <FileText size={15} className={activeTab === 'biodata' ? "text-teal-600" : "text-slate-400"} />
              <span>৪. প্রিন্ট ও বায়োডাটা</span>
            </button>
          </div>

          <div className="text-[11px] font-semibold text-slate-500 hidden md:block">
            {staff.role === 'Helper' ? 'হেলপার ডাটাবেজ' : 'ড্রাইভার ডাটাবেজ'} • আইডি: <strong className="text-slate-800 font-mono">{staff.driverId}</strong>
          </div>
        </div>

        {/* Modal Body - Tabbed Content */}
        <div className="overflow-y-auto p-5 sm:p-7 space-y-6 grow">
          {/* Suspension Alert if applicable */}
          {staff.isSuspended && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 shadow-xs">
              <Ban className="text-red-600 shrink-0 mt-0.5" size={20} />
              <div className="text-xs text-red-800">
                <div className="font-bold text-sm text-red-900 flex items-center gap-2">
                  <span>বর্তমানে সাময়িক বরখাস্ত (Suspended)</span>
                  <span className="px-2 py-0.5 bg-red-200 text-red-900 rounded-md font-bold text-[11px]">মেয়াদ: {staff.suspensionDays || '০'} দিন</span>
                </div>
                <p className="mt-1 font-medium text-red-700">কারণ: {staff.suspensionReason || 'উল্লেখ নেই'}</p>
                {staff.suspendedBy && (
                  <div className="mt-1.5 text-[11px] font-semibold text-red-800">
                    আদেশকারী: {staff.suspendedBy}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Active Running Trip Banner */}
          {activeRunningTrip && (
            <div className="p-4 bg-blue-50/90 border border-blue-200 rounded-2xl flex items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
                  <Truck size={20} />
                </div>
                <div>
                  <div className="text-xs font-bold text-blue-900 uppercase tracking-wide">বর্তমানে চলমান ট্রিপে নিয়োজিত আছেন</div>
                  <div className="text-xs text-blue-700 font-medium mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>গাড়ি: <strong className="text-blue-950 font-mono">{activeRunningTrip.vehiclePlate}</strong></span>
                    <span>•</span>
                    <span>গন্তব্য: <strong className="text-blue-950">{activeRunningTrip.location}</strong></span>
                  </div>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider animate-pulse shadow-xs">
                Active Trip
              </span>
            </div>
          )}

          {/* ================= TAB 1: OVERVIEW ================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Quick 4-box metrics banner */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/60 border border-blue-100">
                  <div className="flex items-center justify-between text-blue-600 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">চলতি মাসের ট্রিপ</span>
                    <TrendingUp size={16} />
                  </div>
                  <div className="text-2xl font-black text-blue-950">
                    {monthlyCompletedTrips.length}
                    <span className="text-xs font-semibold text-blue-700 ml-1">টি</span>
                  </div>
                  <p className="text-[10px] text-blue-600 mt-1 font-medium">বর্তমান মাসে সম্পন্ন ট্রিপ</p>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/60 border border-emerald-100">
                  <div className="flex items-center justify-between text-emerald-600 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">মোট সম্পন্ন ট্রিপ</span>
                    <CheckCircle2 size={16} />
                  </div>
                  <div className="text-2xl font-black text-emerald-950">
                    {totalCompletedTrips.length}
                    <span className="text-xs font-semibold text-emerald-700 ml-1">টি</span>
                  </div>
                  <p className="text-[10px] text-emerald-600 mt-1 font-medium">নিবন্ধন পরবর্তী সর্বমোট</p>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/60 border border-amber-200">
                  <div className="flex items-center justify-between text-amber-600 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">পারফরম্যান্স রেটিং</span>
                    <Star size={16} className="fill-amber-500 text-amber-500" />
                  </div>
                  <div className="text-2xl font-black text-amber-950 flex items-baseline gap-1">
                    {baseRating.toFixed(1)}
                    <span className="text-xs font-bold text-amber-700">/ 5.0</span>
                  </div>
                  <p className="text-[10px] text-amber-700 mt-1 font-semibold">{grade.split(' ')[0]}</p>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/70 border border-slate-200">
                  <div className="flex items-center justify-between text-slate-600 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">ডিউটি স্ট্যাটাস</span>
                    <User size={16} />
                  </div>
                  <div className="text-sm font-black text-slate-900 mt-1">
                    {staff.isSuspended ? (
                      <span className="text-red-600 font-bold">সাসপেন্ডেড</span>
                    ) : activeRunningTrip ? (
                      <span className="text-blue-600 font-bold">ট্রিপে নিয়োজিত</span>
                    ) : pendingTrip ? (
                      <span className="text-amber-600 font-bold">পেন্ডিং ট্রিপ</span>
                    ) : (
                      <span className="text-emerald-600 font-bold">উপলব্ধ (Free)</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">বর্তমানে প্রস্তুত</p>
                </div>
              </div>

              {/* Edit Mode vs View Mode */}
              <AnimatePresence mode="wait">
                {isEditingInline ? (
                  <motion.form 
                    key="edit-form"
                    initial={{ opacity: 0, height: 0, y: -8 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    onSubmit={handleSaveInline} 
                    className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 overflow-hidden shadow-xs"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <div className="text-sm font-black text-slate-800 flex items-center gap-2">
                        <Edit3 size={17} className="text-blue-600" />
                        <span>স্টাফ ও পারিবারিক তথ্য পরিবর্তন / সম্পাদন</span>
                      </div>
                      <span className="text-xs text-slate-500 font-medium">আইডি: {staff.driverId}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">পূর্ণ নাম (Full Name) *</label>
                        <input 
                          type="text" 
                          required
                          className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-300 outline-none focus:border-blue-500 font-medium text-slate-800"
                          value={editForm.name}
                          onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">নিজস্ব মোবাইল নম্বর (Staff Phone) *</label>
                        <input 
                          type="tel" 
                          required
                          className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-300 outline-none focus:border-blue-500 font-medium text-slate-800"
                          value={editForm.phoneNumber}
                          onChange={e => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">ড্রাইভিং লাইসেন্স নং (License No)</label>
                        <input 
                          type="text" 
                          placeholder="DL-XXXX-XXXX"
                          className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-300 outline-none focus:border-blue-500 font-medium text-slate-800"
                          value={editForm.licenseNo}
                          onChange={e => setEditForm({ ...editForm, licenseNo: e.target.value })}
                        />
                      </div>

                      {/* Family Phone & Relation Selector */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">পরিবারের নাম্বার (Family Phone)</label>
                          <input 
                            type="tel" 
                            placeholder="01XXXXXXXXX"
                            className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-300 outline-none focus:border-blue-500 font-medium text-slate-800"
                            value={editForm.familyPhone}
                            onChange={e => setEditForm({ ...editForm, familyPhone: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-emerald-800">নাম্বারটি কার? (Relation) *</label>
                          <select
                            value={editForm.familyPhoneRelation}
                            onChange={e => setEditForm({ ...editForm, familyPhoneRelation: e.target.value })}
                            className="w-full px-3 py-2.5 bg-emerald-50 rounded-xl border border-emerald-300 outline-none focus:border-emerald-600 font-bold text-slate-800 text-xs cursor-pointer"
                          >
                            {FAMILY_RELATIONS.map(rel => (
                              <option key={rel.value} value={rel.value}>
                                {rel.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-slate-700 font-bold mb-1">বর্তমান ও স্থায়ী ঠিকানা (Address)</label>
                        <textarea 
                          rows={2}
                          placeholder="গ্রাম/বাড়ি, থানা, জেলা..."
                          className="w-full px-3.5 py-2 bg-white rounded-xl border border-slate-300 outline-none focus:border-blue-500 font-medium text-slate-800"
                          value={editForm.address}
                          onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                      <Button type="button" variant="secondary" className="text-xs px-4 py-2" onClick={() => setIsEditingInline(false)}>
                        বাতিল
                      </Button>
                      <Button type="submit" className="text-xs px-5 py-2 font-bold" disabled={isSaving}>
                        {isSaving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
                      </Button>
                    </div>
                  </motion.form>
                ) : (
                  <motion.div 
                    key="view-details"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-5"
                  >
                    {/* Card 1: Personal & License */}
                    <div className="p-5 bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-3.5 text-xs shadow-2xs">
                      <div className="font-bold text-slate-900 text-sm flex items-center justify-between border-b border-slate-200/70 pb-2.5">
                        <div className="flex items-center gap-2 text-blue-700">
                          <CreditCard size={17} />
                          <span>ব্যক্তিগত ও লাইসেন্স তথ্য</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                          {staff.role === 'Helper' ? 'হেলপার' : 'ড্রাইভার'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">পূর্ণ নাম:</span>
                        <span className="font-bold text-slate-900 text-sm">{staff.name}</span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">মোবাইল নম্বর:</span>
                        <a 
                          href={`tel:${staff.phoneNumber}`}
                          className="font-bold text-blue-600 hover:underline flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 transition-colors"
                        >
                          <Phone size={12} />
                          <span>{staff.phoneNumber || 'উল্লেখ নেই'}</span>
                        </a>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">লাইসেন্স নম্বর:</span>
                        <span className="font-bold text-slate-800 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                          {staff.licenseNo || 'দেওয়া হয়নি'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-500 font-medium">যোগদানের তারিখ:</span>
                        <span className="font-semibold text-slate-700 flex items-center gap-1">
                          <Calendar size={13} className="text-slate-400" />
                          {staff.createdAt?.toDate ? staff.createdAt.toDate().toLocaleDateString('bn-BD') : (staff.createdAt ? new Date(staff.createdAt).toLocaleDateString('bn-BD') : 'N/A')}
                        </span>
                      </div>
                    </div>

                    {/* Card 2: Family & Emergency Contact */}
                    <div className="p-5 bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-3.5 text-xs shadow-2xs">
                      <div className="font-bold text-slate-900 text-sm flex items-center justify-between border-b border-slate-200/70 pb-2.5">
                        <div className="flex items-center gap-2 text-emerald-700">
                          <HeartHandshake size={17} />
                          <span>পারিবারিক ও জরুরী যোগাযোগ</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                          জরুরী কন্টাক্ট
                        </span>
                      </div>

                      {/* Family Phone with Explicit Relation */}
                      <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-emerald-900 font-bold text-[11px] flex items-center gap-1">
                            <Phone size={13} />
                            <span>পারিবারিক নম্বর:</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-700 text-white text-[11px] font-black tracking-wide">
                            সম্পর্ক: {getFamilyRelationLabel(staff.familyPhoneRelation)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          {staff.familyPhone ? (
                            <a 
                              href={`tel:${staff.familyPhone}`}
                              className="font-black text-sm text-emerald-800 hover:underline flex items-center gap-1.5"
                            >
                              <span>{staff.familyPhone}</span>
                              <span className="text-[10px] font-normal text-emerald-600">(কল করতে ক্লিক করুন)</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 font-medium italic">কোনো পারিবারিক নম্বর এন্ট্রি করা হয়নি</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 pt-1">
                        <span className="text-slate-500 font-medium flex items-center gap-1">
                          <MapPin size={13} className="text-slate-400" />
                          <span>বর্তমান ও স্থায়ী ঠিকানা:</span>
                        </span>
                        <p className="text-slate-800 font-medium bg-white p-2.5 rounded-xl border border-slate-200 leading-relaxed text-xs">
                          {staff.address || 'কোনো স্থায়ী ঠিকানা এন্ট্রি করা হয়নি।'}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mini Recent Trips Widget */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <History size={16} className="text-blue-600" />
                    <span className="text-xs font-bold text-slate-800">সাম্প্রতিক ট্রিপ সমূহ (সর্বশেষ ৪টি)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('trips')}
                    className="text-xs text-blue-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>সব ট্রিপ দেখুন ({staffTrips.length})</span>
                    <ExternalLink size={11} />
                  </button>
                </div>

                {staffTrips.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    কোনো পূর্ববর্তী ট্রিপ রেকর্ড পাওয়া যায়নি।
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {staffTrips.slice(0, 4).map((trip, idx) => (
                      <div key={trip.id || idx} className="p-3 bg-slate-50 hover:bg-blue-50/50 rounded-xl border border-slate-200/70 flex items-center justify-between gap-3 text-xs transition-colors">
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <Truck size={13} className="text-slate-500" />
                            <span>{trip.vehiclePlate}</span>
                          </div>
                          <div className="text-[11px] text-slate-600 mt-0.5">
                            {trip.location || 'গন্তব্য উল্লেখ নেই'}
                          </div>
                        </div>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0",
                          trip.status === 'Completed' ? "bg-emerald-100 text-emerald-800" :
                          trip.status === 'Running' ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
                        )}>
                          {trip.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 2: PERFORMANCE & RATING ================= */}
          {activeTab === 'performance' && (
            <div className="space-y-6">
              {/* Scorecard Hero Banner */}
              <div className="p-6 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                        <Sparkles size={11} />
                        অফিসিয়াল পারফরম্যান্স গ্রেড
                      </span>
                      <span className="text-xs text-slate-400">লাইফটাইম মূল্যায়ন</span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black text-white mt-2">
                      {grade}
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 max-w-lg leading-relaxed">
                      সম্পন্ন ট্রিপের সংখ্যা, নিয়মিত উপস্থিতি, সময়ানুবর্তিতা এবং শৃঙ্খলা বজায় রাখার রেকর্ডের ভিত্তিতে এই স্কোর স্বয়ংক্রিয়ভাবে পরিগণিত হয়।
                    </p>
                  </div>

                  <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 text-center shrink-0 min-w-[170px]">
                    <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">ওভারঅল রেটিং</div>
                    <div className="text-4xl font-black text-white my-1 flex items-center justify-center gap-1">
                      <span>{baseRating.toFixed(1)}</span>
                      <span className="text-sm font-normal text-slate-400">/ 5</span>
                    </div>
                    <div className="flex items-center justify-center gap-1 text-amber-400">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star 
                          key={star} 
                          size={15} 
                          className={star <= Math.round(baseRating) ? "fill-amber-400 text-amber-400" : "text-slate-600"} 
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2">
                    <TrendingUp size={16} className="text-blue-600" />
                    <span>চলতি মাসের সক্রিয়তা</span>
                  </div>
                  <div className="text-3xl font-black text-slate-900 mt-2">
                    {monthlyCompletedTrips.length} <span className="text-xs font-bold text-slate-500">টি ট্রিপ</span>
                  </div>
                  <div className="mt-2 w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full rounded-full transition-all" 
                      style={{ width: `${Math.min(100, (monthlyCompletedTrips.length / 20) * 100)}%` }} 
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 font-semibold mt-1.5 flex justify-between">
                    <span>টার্গেট: ২০টি</span>
                    <span>{Math.round(Math.min(100, (monthlyCompletedTrips.length / 20) * 100))}% সম্পন্ন</span>
                  </div>
                </div>

                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-600" />
                    <span>সেফটি ও শৃঙ্খলা ইনডেক্স</span>
                  </div>
                  <div className="text-3xl font-black text-emerald-950 mt-2">
                    {staff.isSuspended ? '70%' : '100%'} <span className="text-xs font-bold text-emerald-700">মামলামুক্ত</span>
                  </div>
                  <div className="mt-2 w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all" 
                      style={{ width: staff.isSuspended ? '70%' : '100%' }} 
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 font-semibold mt-1.5">
                    {staff.isSuspended ? 'বর্তমানে পেনাল্টি কার্যকর' : 'ক্লিন সেফটি রেকর্ড সংরক্ষিত'}
                  </div>
                </div>

                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2">
                    <Award size={16} className="text-amber-600" />
                    <span>সর্বমোট অর্জন</span>
                  </div>
                  <div className="text-3xl font-black text-slate-900 mt-2">
                    {totalCompletedTrips.length} <span className="text-xs font-bold text-slate-500">মোট ট্রিপ</span>
                  </div>
                  <div className="mt-2 text-xs font-bold text-amber-700 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px]">
                      {totalCount > 30 ? '🏆 অভিজ্ঞ সিনিয়র স্টাফ' : (totalCount > 10 ? '⭐ নিয়মিত পারফরমার' : '🔰 ট্রেইনি স্টাফ')}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-semibold mt-1">
                    মোট সক্রিয় ট্রিপ রেকর্ড
                  </div>
                </div>
              </div>

              {/* Performance Badges and Recognition */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Award size={16} className="text-blue-600" />
                  <span>অর্জিত ব্যাজ ও যোগ্যতা (Recognition & Badges)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black">
                      ⭐
                    </div>
                    <div>
                      <div className="text-xs font-bold text-blue-950">রেগুলার রানার</div>
                      <div className="text-[10px] text-blue-700">ধারাবাহিক ট্রিপ পরিচালনায় সক্রিয়</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
                      🛡️
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-950">নিরাপদ চালক</div>
                      <div className="text-[10px] text-emerald-700">মামলামুক্ত ও ঝুঁকিমুক্ত ড্রাইভিং</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black">
                      ⚡
                    </div>
                    <div>
                      <div className="text-xs font-bold text-amber-950">দ্রুত দায়িত্ব পালন</div>
                      <div className="text-[10px] text-amber-700">ডিউটিতে সময়ানুবর্তিতা বজায় রাখা</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: TRIPS HISTORY ================= */}
          {activeTab === 'trips' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <History size={17} className="text-blue-600" />
                    <span>সম্পূর্ণ ট্রিপ হিস্ট্রি ও ডিটেইল লগ</span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    এই স্টাফের নামের সাথে যুক্ত সকল পূর্ববর্তী ও বর্তমান ট্রিপের তালিকা
                  </p>
                </div>

                {/* Search in trips */}
                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="গাড়ি বা গন্তব্য খুঁজুন..."
                    value={tripSearch}
                    onChange={e => setTripSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs outline-none focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              {filteredTrips.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                  {tripSearch ? 'অনুসন্ধান অনুযায়ী কোনো ট্রিপ পাওয়া যায়নি।' : 'কোনো ট্রিপ record পাওয়া যায়নি।'}
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-900 text-white font-bold sticky top-0 z-10 text-[11px]">
                        <tr>
                          <th className="p-3 text-center w-12">#</th>
                          <th className="p-3">গাড়ির নম্বর</th>
                          <th className="p-3">গন্তব্য / রুট</th>
                          <th className="p-3">শুরুর সময়</th>
                          <th className="p-3">সমাপ্তির সময়</th>
                          <th className="p-3 text-center">স্ট্যাটাস</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredTrips.map((trip, idx) => (
                          <tr key={trip.id || idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                            <td className="p-3 font-bold text-slate-900">
                              <div className="flex items-center gap-1.5">
                                <Truck size={14} className="text-slate-400" />
                                <span>{trip.vehiclePlate || 'N/A'}</span>
                              </div>
                            </td>
                            <td className="p-3 text-slate-700 font-medium">{trip.location || '-'}</td>
                            <td className="p-3 text-slate-500">
                              {trip.startTime?.toDate ? trip.startTime.toDate().toLocaleString('bn-BD') : (trip.startTime || (trip.createdAt?.toDate ? trip.createdAt.toDate().toLocaleDateString('bn-BD') : '-'))}
                            </td>
                            <td className="p-3 text-slate-500">
                              {trip.endTime?.toDate ? trip.endTime.toDate().toLocaleString('bn-BD') : (trip.endTime || '-')}
                            </td>
                            <td className="p-3 text-center">
                              <span className={cn(
                                "px-2.5 py-1 rounded-full text-[10px] font-black uppercase inline-block",
                                trip.status === 'Completed' ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                                trip.status === 'Running' ? "bg-blue-100 text-blue-800 border border-blue-200 animate-pulse" : 
                                "bg-amber-100 text-amber-800 border border-amber-200"
                              )}>
                                {trip.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 4: BIODATA & PRINT PREVIEW ================= */}
          {activeTab === 'biodata' && (
            <div className="space-y-5">
              <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-teal-950 flex items-center gap-2">
                    <Printer size={16} className="text-teal-700" />
                    <span>অফিসিয়াল বায়োডাটা ডাউনলোড ও প্রিন্ট প্রিভিউ</span>
                  </h4>
                  <p className="text-xs text-teal-800 mt-0.5">
                    ড্রাইভার/হেলপারের পূর্ণাঙ্গ জীবনবৃত্তান্ত, জরুরি পারিবারিক যোগাযোগ ও পারফরম্যান্স সহ প্রিন্ট-রেডি কার্ড
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => exportStaffProfilePrint(staff, performanceData, staffTrips)}
                    className="text-xs px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <Printer size={14} />
                    <span>প্রিন্ট করুন (Print)</span>
                  </Button>

                  <Button
                    onClick={() => downloadStaffBiodataFile(staff, performanceData, staffTrips)}
                    variant="secondary"
                    className="text-xs px-4 py-2 font-bold flex items-center gap-1.5"
                  >
                    <Download size={14} />
                    <span>ডাউনলোড (Save)</span>
                  </Button>
                </div>
              </div>

              {/* Visual Card Preview */}
              <div className="p-6 bg-white rounded-2xl border-2 border-dashed border-slate-300 space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="text-sm font-black text-slate-800 uppercase">
                    Fleet Logistics System • Staff Biodata Card
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    ID: BIO-{staff.driverId}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2">
                    <div><strong>নাম:</strong> {staff.name}</div>
                    <div><strong>পদবি:</strong> {staff.role === 'Helper' ? 'হেলপার' : 'ড্রাইভার'}</div>
                    <div><strong>মোবাইল:</strong> {staff.phoneNumber || 'N/A'}</div>
                    <div><strong>লাইসেন্স নং:</strong> {staff.licenseNo || 'N/A'}</div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <strong>পারিবারিক নম্বর:</strong> {staff.familyPhone || 'N/A'}{' '}
                      <span className="text-emerald-700 font-bold">({getFamilyRelationLabel(staff.familyPhoneRelation)})</span>
                    </div>
                    <div><strong>ঠিকানা:</strong> {staff.address || 'N/A'}</div>
                    <div><strong>পারফরম্যান্স:</strong> {baseRating.toFixed(1)} / 5.0 ({grade})</div>
                    <div><strong>মোট সম্পন্ন ট্রিপ:</strong> {totalCompletedTrips.length} টি</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <AuditDetailsDropdown createdBy={staff.createdBy} updatedBy={staff.updatedBy} />
          
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="text-xs px-3 py-1.5 flex items-center gap-1"
              onClick={() => exportStaffProfilePrint(staff, performanceData, staffTrips)}
            >
              <Printer size={13} />
              <span>প্রিন্ট</span>
            </Button>
            
            <Button variant="secondary" className="text-xs px-4 py-1.5" onClick={onClose}>
              বন্ধ করুন (Close)
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ==========================================
// 2. VEHICLE PROFILE MODAL (Vehicles, Tools, Docs, Cases)
// ==========================================
export const VehicleProfileModal: React.FC<{
  vehicle: any;
  onClose: () => void;
  onEdit?: (vehicle: any) => void;
}> = ({ vehicle, onClose, onEdit }) => {
  const { isAdmin, isSubAdmin, isLineSupervisor, isChecker, profile } = useAuth();
  const canManage = isAdmin || isSubAdmin || isLineSupervisor || isChecker;

  const [activeTab, setActiveTab] = useState<'overview' | 'tools' | 'documents' | 'cases'>('overview');
  const [cases, setCases] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  // Local state for tools and documents for instant feedback
  const [tools, setTools] = useState(() => getDefaultVehicleTools(vehicle?.tools));
  const [docs, setDocs] = useState(() => getDefaultVehicleDocs(vehicle?.documents));

  useEffect(() => {
    if (vehicle) {
      setTools(getDefaultVehicleTools(vehicle.tools));
      setDocs(getDefaultVehicleDocs(vehicle.documents));
    }
  }, [vehicle]);

  useEffect(() => {
    const unsubCases = subscribeToCollection('cases', setCases);
    const unsubTrips = subscribeToCollection('trips', setTrips);
    return () => {
      unsubCases();
      unsubTrips();
    };
  }, []);

  if (!vehicle) return null;

  const vehiclePlate = (vehicle.vehicleNumber || '').trim().toUpperCase();

  // All cases for this vehicle
  const vehicleCases = cases.filter(c => (c.vehicleId || '').trim().toUpperCase() === vehiclePlate);
  const activeCases = vehicleCases.filter(c => (c.status || 'Open') === 'Open');
  const totalFineAmount = vehicleCases.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const unpaidFineAmount = activeCases.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  // All trips for this vehicle
  const vehicleTrips = trips.filter(t => (t.vehiclePlate || '').trim().toUpperCase() === vehiclePlate || t.vehicleId === vehicle.id);
  const completedTrips = vehicleTrips.filter(t => t.status === 'Completed');
  const activeRunningTrip = vehicleTrips.find(t => t.status === 'Running');

  // Toggle tool
  const handleToggleTool = async (key: string, value: boolean) => {
    if (!canManage) return;
    const updatedTools = { ...tools, [key]: value };
    setTools(updatedTools);
    try {
      setIsUpdating(true);
      await updateVehicle(vehicle.id, { tools: updatedTools }, profile);
    } catch (err) {
      console.error("Tool toggle error:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Toggle document
  const handleToggleDoc = async (key: string, value: boolean) => {
    if (!canManage) return;
    const updatedDocs = { ...docs, [key]: value };
    setDocs(updatedDocs);
    try {
      setIsUpdating(true);
      await updateVehicle(vehicle.id, { documents: updatedDocs }, profile);
    } catch (err) {
      console.error("Doc toggle error:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <motion.div 
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        onClick={e => e.stopPropagation()} 
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-blue-400 font-black text-xl shadow-inner border border-white/10">
              <Truck size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-black uppercase tracking-wider">
                  {vehicle.type || 'Vehicle'}
                </span>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                  vehicle.status === 'Available' ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                  vehicle.status === 'On Trip' ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" :
                  "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                )}>
                  {vehicle.status}
                </span>
              </div>
              <h3 className="text-xl font-black text-white tracking-tight mt-0.5">
                {vehicle.vehicleNumber}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (isAdmin || isSubAdmin) && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(vehicle);
                }}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="গাড়ি এডিট করুন"
              >
                <Edit3 size={17} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50 px-6 gap-2 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={cn(
              "px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5",
              activeTab === 'overview'
                ? "bg-white text-slate-900 border-t border-x border-slate-200 shadow-2xs -mb-px"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Info size={14} />
            <span>ওভারভিউ ও ট্রিপ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tools')}
            className={cn(
              "px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 relative",
              activeTab === 'tools'
                ? "bg-white text-blue-700 border-t border-x border-slate-200 shadow-2xs -mb-px"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Wrench size={14} />
            <span>টুলস অপশন (Tools)</span>
            {Object.values(tools).some(val => !val) && (
              <span className="w-2 h-2 rounded-full bg-red-500" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={cn(
              "px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 relative",
              activeTab === 'documents'
                ? "bg-white text-emerald-700 border-t border-x border-slate-200 shadow-2xs -mb-px"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <FileText size={14} />
            <span>ডকুমেন্ট অপশন (Docs)</span>
            {Object.values(docs).some(val => !val) && (
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cases')}
            className={cn(
              "px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 relative",
              activeTab === 'cases'
                ? "bg-white text-red-700 border-t border-x border-slate-200 shadow-2xs -mb-px"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <ShieldAlert size={14} />
            <span>মামলা ({vehicleCases.length})</span>
            {activeCases.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-100 text-red-700 text-[9px] font-black">
                {activeCases.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Contents */}
        <div className="overflow-y-auto p-6 flex-1 space-y-5">
          <AnimatePresence mode="wait">
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <motion.div 
                key="overview-tab"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                {/* Status and maintenance info */}
                {vehicle.status === 'Maintenance' && vehicle.maintenanceNotes && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900">
                    <div className="font-bold flex items-center gap-1.5 text-amber-950 mb-1">
                      <Wrench size={16} />
                      <span>বর্তমান সমস্যা / মেরামত সংক্রান্ত নোট:</span>
                    </div>
                    <p className="font-medium whitespace-pre-wrap">{vehicle.maintenanceNotes}</p>
                  </div>
                )}

              {/* Quick Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block font-semibold mb-1">গাড়ির ধরণ:</span>
                  <div className="font-bold text-slate-800 text-sm uppercase">{vehicle.type || 'Medium'}</div>
                  <span className="text-[10px] text-slate-400 mt-1 block">নিবন্ধন: #{vehicle.vehicleNumber}</span>
                </div>

                <div className="p-4 rounded-2xl bg-red-50/60 border border-red-100">
                  <span className="text-red-600 block font-semibold mb-1">মোট মামলা:</span>
                  <div className="font-black text-red-900 text-base">
                    {vehicleCases.length} টি
                    {activeCases.length > 0 && (
                      <span className="text-xs font-bold text-red-600 ml-1">({activeCases.length} সক্রিয়)</span>
                    )}
                  </div>
                  <span className="text-[10px] text-red-600 font-bold mt-1 block">বকেয়া জরিমানা: ৳{unpaidFineAmount.toLocaleString()}</span>
                </div>

                <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-blue-50/60 border border-blue-100">
                  <span className="text-blue-600 block font-semibold mb-1">মোট সম্পন্ন ট্রিপ:</span>
                  <div className="font-black text-blue-900 text-base">
                    {completedTrips.length} টি
                  </div>
                  <span className="text-[10px] text-blue-600 mt-1 block">চলতি ট্রিপ: {activeRunningTrip ? 'চলমান' : 'নেই'}</span>
                </div>
              </div>

              {/* Quick Status Check */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3 text-xs">
                <div className="font-bold text-slate-800 flex items-center justify-between border-b border-slate-200 pb-2">
                  <span>সরঞ্জাম ও ডকুমেন্ট সারসংক্ষেপ</span>
                  <span className="text-[10px] text-slate-400">QR ও ট্রিপে দৃশ্যমান</span>
                </div>

                      </div>
              </motion.div>
            )}

            {/* TAB 2: TOOLS MANAGEMENT */}
            {activeTab === 'tools' && (
              <motion.div 
                key="tools-tab"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl text-xs text-blue-800 flex items-start gap-2">
                  <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-blue-900">গাড়ির টুলস নিয়ন্ত্রণ (Tools Verification)</div>
                    <p className="mt-0.5 text-blue-700">
                      এখানে হ্যাঁ বা না পরিবর্তন করলে তা স্বয়ংক্রিয়ভাবে <strong>QR চেক করার সময়</strong> এবং <strong>ট্রিপ এন্ট্রি করার সময়</strong> রিয়েলটাইমে প্রদর্শিত হবে।
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {STANDARD_VEHICLE_TOOLS.map(item => {
                    const isPresent = (tools as any)[item.key] ?? true;
                    return (
                      <div 
                        key={item.key}
                        className={cn(
                          "p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3",
                          isPresent 
                            ? "bg-white border-slate-200 hover:border-blue-300" 
                            : "bg-red-50/50 border-red-200"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-8 h-8 rounded-xl flex items-center justify-center font-bold",
                              isPresent ? "bg-blue-50 text-blue-600" : "bg-red-100 text-red-600"
                            )}>
                              <item.icon size={16} />
                            </div>
                            <div>
                              <span className="font-bold text-slate-800 text-xs block">{item.label}</span>
                              <span className={cn("text-[10px] font-semibold", isPresent ? "text-emerald-600" : "text-red-600")}>
                                {isPresent ? 'উপলব্ধ (Available)' : 'অনুপলব্ধ (Missing)'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Yes / No Toggle Controls */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            disabled={!canManage}
                            onClick={() => handleToggleTool(item.key, true)}
                            className={cn(
                              "py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                              isPresent 
                                ? "bg-emerald-600 text-white shadow-xs" 
                                : "bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                            )}
                          >
                            <Check size={13} strokeWidth={3} />
                            <span>হ্যাঁ (আছে)</span>
                          </button>

                          <button
                            type="button"
                            disabled={!canManage}
                            onClick={() => handleToggleTool(item.key, false)}
                            className={cn(
                              "py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                              !isPresent 
                                ? "bg-red-600 text-white shadow-xs" 
                                : "bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-700"
                            )}
                          >
                            <X size={13} strokeWidth={3} />
                            <span>না (নেই)</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* TAB 3: DOCUMENTS MANAGEMENT */}
            {activeTab === 'documents' && (
              <motion.div 
                key="documents-tab"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs text-emerald-800 flex items-start gap-2">
                  <Info size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-emerald-900">গাড়ির ডকুমেন্ট নিয়ন্ত্রণ (Documents Status)</div>
                    <p className="mt-0.5 text-emerald-700">
                      এখানে TT, FC, RP, RC, Ads ইত্যাদি ডকুমেন্টের অবস্থা নির্বাচন করুন। ট্রিপ ছাড়ার আগে ও কিউআর স্ক্যান চেকিংয়ে এগুলো নির্দেশক হিসেবে কাজ করবে।
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {STANDARD_VEHICLE_DOCS.map(docItem => {
                    const isPresent = (docs as any)[docItem.key] ?? true;
                    return (
                      <div 
                        key={docItem.key}
                        className={cn(
                          "p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-4",
                          isPresent 
                            ? "bg-white border-slate-200 hover:border-emerald-300" 
                            : "bg-amber-50/50 border-amber-200"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs",
                            isPresent ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          )}>
                            {docItem.code}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs">{docItem.label}</div>
                            <div className={cn("text-[10px] font-semibold mt-0.5", isPresent ? "text-emerald-600" : "text-amber-700")}>
                              {isPresent ? 'ডকুমেন্ট সঠিক ও গাড়ির সাথে আছে' : 'ডকুমেন্ট অমিল / নবায়ন প্রয়োজন / আটক'}
                            </div>
                          </div>
                        </div>

                        {/* Yes / No Toggle Controls */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={!canManage}
                            onClick={() => handleToggleDoc(docItem.key, true)}
                            className={cn(
                              "py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer",
                              isPresent 
                                ? "bg-emerald-600 text-white shadow-xs" 
                                : "bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                            )}
                          >
                            <Check size={12} strokeWidth={3} />
                            <span>হ্যাঁ</span>
                          </button>

                          <button
                            type="button"
                            disabled={!canManage}
                            onClick={() => handleToggleDoc(docItem.key, false)}
                            className={cn(
                              "py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer",
                              !isPresent 
                                ? "bg-amber-600 text-white shadow-xs" 
                                : "bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700"
                            )}
                          >
                            <X size={12} strokeWidth={3} />
                            <span>না</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* TAB 4: CASES (MAMLA) */}
            {activeTab === 'cases' && (
              <motion.div 
                key="cases-tab"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-red-50 border border-red-200 rounded-2xl">
                    <span className="text-red-700 block font-semibold mb-0.5">সক্রিয় মামলা (Active):</span>
                    <div className="text-xl font-black text-red-900">{activeCases.length} টি</div>
                    <span className="text-[10px] text-red-700 font-bold mt-1 block">বকেয়া: ৳{unpaidFineAmount.toLocaleString()}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                    <span className="text-slate-600 block font-semibold mb-0.5">সর্বমোট মামলা রেকর্ড:</span>
                    <div className="text-xl font-black text-slate-900">{vehicleCases.length} টি</div>
                    <span className="text-[10px] text-slate-500 font-medium mt-1 block">মোট জরিমানা: ৳{totalFineAmount.toLocaleString()}</span>
                  </div>
                </div>

                {vehicleCases.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-400">
                    <ShieldAlert size={28} className="mx-auto text-slate-300 mb-2" />
                    এই গাড়ির কোনো মামলা রেকর্ড নেই।
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-60 overflow-y-auto">
                    {vehicleCases.map((c, idx) => (
                      <div key={c.id || idx} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-slate-900 font-mono">
                            #{c.caseId || 'CASE'}
                          </div>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                            (c.status || 'Open') === 'Open' ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                          )}>
                            {(c.status || 'Open') === 'Open' ? 'সক্রিয় (UNPAID)' : 'সমাধান (PAID)'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-600">
                          <span>জরিমানা: <strong className="text-slate-900">৳{Number(c.amount || 0).toLocaleString()}</strong></span>
                          <span className="text-[10px] text-slate-400">
                            {c.createdAt?.toDate?.().toLocaleDateString('bn-BD') || 'তারিখ নেই'}
                          </span>
                        </div>

                        {c.reason && (
                          <p className="text-[11px] text-slate-700 italic bg-white p-2 rounded-xl border border-slate-100">
                            "{c.reason}"
                          </p>
                        )}

                        {c.seizedDocuments && c.seizedDocuments.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap pt-1">
                            <span className="text-[10px] text-red-600 font-bold">আটক ডকুমেন্ট:</span>
                            {c.seizedDocuments.map((d: string) => (
                              <span key={d} className="px-1.5 py-0.2 rounded bg-red-100 text-red-800 text-[9px] font-bold">
                                {d}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <AuditDetailsDropdown createdBy={vehicle.createdBy} updatedBy={vehicle.updatedBy} />
          <Button variant="secondary" className="text-xs px-3 py-1.5" onClick={onClose}>
            বন্ধ করুন (Close)
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

// ==========================================
// 3. STAFF PROFILE BUTTON (Reusable inline trigger)
// ==========================================
export const StaffProfileButton: React.FC<{
  staff?: any;
  staffId?: string;
  staffName?: string;
  role?: 'Driver' | 'Helper';
  className?: string;
}> = ({ staff, staffId, staffName, role, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loadedStaff, setLoadedStaff] = useState<any | null>(staff || null);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!staff && staffId) {
      const found = await findStaffById(staffId);
      if (found) {
        setLoadedStaff(found);
      } else {
        setLoadedStaff({
          driverId: staffId,
          name: staffName || staffId,
          role: role || (staffId.startsWith('HLP-') ? 'Helper' : 'Driver'),
          phoneNumber: '',
        });
      }
    } else if (staff) {
      setLoadedStaff(staff);
    }
    setIsOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "inline-flex items-center justify-center p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer group",
          className
        )}
        title="প্রোফাইল বিবরণ দেখতে ক্লিক করুন"
        aria-label="স্টাফ প্রোফাইল"
      >
        <User size={13} className="group-hover:scale-110 transition-transform" />
      </button>

      <AnimatePresence>
        {isOpen && loadedStaff && (
          <StaffProfileModal staff={loadedStaff} onClose={() => setIsOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
};

// ==========================================
// 4. VEHICLE PROFILE BUTTON (Reusable inline trigger)
// ==========================================
export const VehicleProfileButton: React.FC<{
  vehicle?: any;
  vehicleNumber?: string;
  vehicleId?: string;
  className?: string;
}> = ({ vehicle, vehicleNumber, vehicleId, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [vehiclesList, setVehiclesList] = useState<any[]>([]);
  const [loadedVehicle, setLoadedVehicle] = useState<any | null>(vehicle || null);

  useEffect(() => {
    if (!vehicle) {
      const unsub = subscribeToCollection('vehicles', setVehiclesList);
      return () => unsub();
    }
  }, [vehicle]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (vehicle) {
      setLoadedVehicle(vehicle);
    } else {
      const match = vehiclesList.find(v => 
        (vehicleId && v.id === vehicleId) || 
        (vehicleNumber && v.vehicleNumber?.trim().toUpperCase() === vehicleNumber.trim().toUpperCase())
      );
      if (match) {
        setLoadedVehicle(match);
      } else {
        setLoadedVehicle({
          id: vehicleId || '',
          vehicleNumber: vehicleNumber || 'Unknown',
          type: 'Medium',
          status: 'Available',
          tools: getDefaultVehicleTools(),
          documents: getDefaultVehicleDocs(),
        });
      }
    }
    setIsOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "inline-flex items-center justify-center p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer group",
          className
        )}
        title="গাড়ির প্রোফাইল ও টুলস দেখতে ক্লিক করুন"
        aria-label="গাড়ি প্রোফাইল"
      >
        <Truck size={13} className="group-hover:scale-110 transition-transform" />
      </button>

      <AnimatePresence>
        {isOpen && loadedVehicle && (
          <VehicleProfileModal vehicle={loadedVehicle} onClose={() => setIsOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
};

