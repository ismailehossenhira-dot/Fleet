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
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Button, AuditDetailsDropdown } from './Common';
import { subscribeToCollection, updateVehicle, updateDriver, findStaffById } from '../db';
import { useAuth } from '../AuthContext';
import { cn } from '../lib/utils';

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
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [editForm, setEditForm] = useState({
    name: staff?.name || '',
    phoneNumber: staff?.phoneNumber || '',
    licenseNo: staff?.licenseNo || '',
    address: staff?.address || '',
    familyPhone: staff?.familyPhone || '',
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
        {/* Header with Role Banner */}
        <div className={cn(
          "px-6 py-5 text-white flex items-center justify-between",
          staff.role === 'Helper' 
            ? "bg-gradient-to-r from-emerald-600 to-teal-700" 
            : "bg-gradient-to-r from-blue-600 to-indigo-700"
        )}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white font-black text-xl shadow-inner">
              <User size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black uppercase tracking-wider">
                  {staff.role === 'Helper' ? 'হেলপার (Helper)' : 'ড্রাইভার (Driver)'}
                </span>
                <span className="text-white/80 text-xs font-mono font-bold">#{staff.driverId}</span>
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight mt-0.5">
                {staff.name}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="তথ্য সম্পাদন করুন"
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

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 space-y-6">
          {/* Suspension Alert if applicable */}
          {staff.isSuspended && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
              <Ban className="text-red-600 shrink-0 mt-0.5" size={20} />
              <div className="text-xs text-red-800">
                <div className="font-bold text-sm text-red-900">বর্তমানে সাময়িক বরখাস্ত (Suspended)</div>
                <p className="mt-1 font-medium">কারণ: {staff.suspensionReason || 'উল্লেখ নেই'}</p>
                <div className="flex gap-4 mt-2 text-[11px] font-semibold text-red-700">
                  <span>মেয়াদ: {staff.suspensionDays || '০'} দিন</span>
                  {staff.suspendedBy && <span>দ্বারা: {staff.suspendedBy}</span>}
                </div>
              </div>
            </div>
          )}

          {/* Active Trip Banner if running */}
          {activeRunningTrip && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <Truck size={18} />
                </div>
                <div>
                  <div className="text-xs font-bold text-blue-900 uppercase">বর্তমানে চলমান ট্রিপে আছেন</div>
                  <div className="text-xs text-blue-700 font-medium mt-0.5">
                    গাড়ি: <span className="font-bold text-blue-900">{activeRunningTrip.vehiclePlate}</span> • গন্তব্য: <span className="font-bold">{activeRunningTrip.location}</span>
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider animate-pulse">
                Running
              </span>
            </div>
          )}

          {/* Monthly & Lifetime Performance Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-100">
              <div className="flex items-center justify-between text-blue-600 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">চলতি মাসের ট্রিপ</span>
                <TrendingUp size={16} />
              </div>
              <div className="text-2xl font-black text-blue-950">
                {monthlyCompletedTrips.length}
                <span className="text-xs font-semibold text-blue-700 ml-1">টি</span>
              </div>
              <p className="text-[10px] text-blue-600 mt-1 font-medium">বর্তমান ক্যালেন্ডার মাসে সম্পন্ন</p>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-100">
              <div className="flex items-center justify-between text-emerald-600 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">সর্বমোট ট্রিপ</span>
                <CheckCircle2 size={16} />
              </div>
              <div className="text-2xl font-black text-emerald-950">
                {totalCompletedTrips.length}
                <span className="text-xs font-semibold text-emerald-700 ml-1">টি</span>
              </div>
              <p className="text-[10px] text-emerald-600 mt-1 font-medium">নিবন্ধন থেকে শুরু করে মোট সমাপ্ত</p>
            </div>

            <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200">
              <div className="flex items-center justify-between text-slate-600 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">বর্তমান স্ট্যাটাস</span>
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
              <p className="text-[10px] text-slate-500 mt-1 font-medium">ডিউটি প্রস্তুত অবস্থা</p>
            </div>
          </div>

          {/* Profile Details Form or View */}
          <AnimatePresence mode="wait">
            {isEditingInline ? (
              <motion.form 
                key="edit-form"
                initial={{ opacity: 0, height: 0, y: -8 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.04, 0.62, 0.23, 0.98] }}
                onSubmit={handleSaveInline} 
                className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 overflow-hidden"
              >
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2">
                  প্রোফাইল তথ্য সম্পাদন
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">পূর্ণ নাম</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 outline-none focus:border-blue-500 font-medium"
                      value={editForm.name}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">মোবাইল নম্বর</label>
                    <input 
                      type="tel" 
                      required
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 outline-none focus:border-blue-500 font-medium"
                      value={editForm.phoneNumber}
                      onChange={e => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">ড্রাইভিং লাইসেন্স নং</label>
                    <input 
                      type="text" 
                      placeholder="DL-XXXX-XXXX"
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 outline-none focus:border-blue-500 font-medium"
                      value={editForm.licenseNo}
                      onChange={e => setEditForm({ ...editForm, licenseNo: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">পরিবারের নাম্বার / জরুরী যোগাযোগ</label>
                    <input 
                      type="tel" 
                      placeholder="01XXXXXXXXX"
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 outline-none focus:border-blue-500 font-medium"
                      value={editForm.familyPhone}
                      onChange={e => setEditForm({ ...editForm, familyPhone: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-semibold mb-1">বর্তমান / স্থায়ী ঠিকানা</label>
                    <textarea 
                      rows={2}
                      placeholder="গ্রাম, থানা, জেলা..."
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 outline-none focus:border-blue-500 font-medium"
                      value={editForm.address}
                      onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <Button type="button" variant="secondary" className="text-xs px-3 py-1.5" onClick={() => setIsEditingInline(false)}>
                    বাতিল
                  </Button>
                  <Button type="submit" className="text-xs px-3 py-1.5" disabled={isSaving}>
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
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3 text-xs">
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                    <CreditCard size={16} className="text-blue-600" />
                    <span>ব্যক্তিগত ও লাইসেন্স তথ্য</span>
                  </div>

                  <div className="flex items-start justify-between">
                    <span className="text-slate-500 font-medium">মোবাইল নম্বর:</span>
                    <a 
                      href={`tel:${staff.phoneNumber}`}
                      className="font-bold text-blue-600 hover:underline flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100"
                    >
                      <Phone size={12} />
                      <span>{staff.phoneNumber || 'উল্লেখ নেই'}</span>
                    </a>
                  </div>

                  <div className="flex items-start justify-between">
                    <span className="text-slate-500 font-medium">লাইসেন্স নম্বর:</span>
                    <span className="font-bold text-slate-800 font-mono">
                      {staff.licenseNo || 'দেওয়া হয়নি'}
                    </span>
                  </div>

                  <div className="flex items-start justify-between">
                    <span className="text-slate-500 font-medium">যোগদানের তারিখ:</span>
                    <span className="font-medium text-slate-700">
                      {staff.createdAt?.toDate?.().toLocaleDateString('bn-BD') || 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3 text-xs">
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                    <HeartHandshake size={16} className="text-emerald-600" />
                    <span>পরিবার ও ঠিকানা</span>
                  </div>

                  <div className="flex items-start justify-between">
                    <span className="text-slate-500 font-medium">পরিবারের নাম্বার:</span>
                    {staff.familyPhone ? (
                      <a 
                        href={`tel:${staff.familyPhone}`}
                        className="font-bold text-emerald-600 hover:underline flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100"
                      >
                        <Phone size={12} />
                        <span>{staff.familyPhone}</span>
                      </a>
                    ) : (
                      <span className="text-slate-400 font-medium">দেওয়া হয়নি</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 font-medium">ঠিকানা:</span>
                    <p className="text-slate-800 font-medium bg-white p-2 rounded-xl border border-slate-100 italic">
                      {staff.address || 'কোনো ঠিকানা এন্ট্রি করা হয়নি।'}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Recent Trips Record */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <History size={16} className="text-slate-500" />
                <span>সাম্প্রতিক ট্রিপ হিস্ট্রি (Recent Trips)</span>
              </h4>
              <span className="text-xs text-slate-400 font-semibold">{staffTrips.length} টি ট্রিপ</span>
            </div>

            {staffTrips.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-400">
                এই স্টাফের কোনো ট্রিপ রেকর্ড পাওয়া যায়নি।
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden text-xs max-h-48 overflow-y-auto">
                {staffTrips.slice(0, 6).map((trip, idx) => (
                  <div key={trip.id || idx} className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Truck size={13} className="text-slate-400" />
                        <span>{trip.vehiclePlate}</span>
                        <span className="text-[10px] text-slate-400 font-normal">({trip.location})</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {trip.createdAt?.toDate?.().toLocaleDateString('bn-BD') || 'তারিখ নেই'}
                      </div>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                      trip.status === 'Completed' ? "bg-emerald-100 text-emerald-700" :
                      trip.status === 'Running' ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {trip.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <AuditDetailsDropdown createdBy={staff.createdBy} updatedBy={staff.updatedBy} />
          <Button variant="secondary" className="text-xs px-3 py-1.5" onClick={onClose}>
            বন্ধ করুন (Close)
          </Button>
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

