import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowLeftRight, 
  Building2, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  History,
  Phone,
  ShieldAlert
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useWarehouse } from '../WarehouseContext';
import { transferStaff, subscribeToCollection } from '../db';
import { useAuth } from '../AuthContext';
import { cn } from '../lib/utils';

interface StaffTransferModalProps {
  staff: any | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const StaffTransferModal: React.FC<StaffTransferModalProps> = ({
  staff,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { warehouses, getWarehouseBadge } = useWarehouse();
  const { profile } = useAuth();

  const [toWarehouse, setToWarehouse] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [allTransfers, setAllTransfers] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeToCollection('transfers', setAllTransfers);
    return () => unsub();
  }, [isOpen]);

  const currentWarehouse = staff?.warehouse || 'মোহাম্মদপুর';

  useEffect(() => {
    if (isOpen && staff) {
      const other = warehouses.find(w => w.name !== currentWarehouse);
      setToWarehouse(other ? other.name : 'সাভার');
      setReason('');
      setError('');
      setSuccessMsg('');
    }
  }, [isOpen, staff, currentWarehouse, warehouses]);

  // Previous staff transfers
  const staffTransfers = allTransfers.filter(
    t => t.targetId === staff?.id || (t.targetName && staff?.name && t.targetName.includes(staff.name))
  ).slice(0, 5);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staff) return;

    if (!toWarehouse) {
      setError('দয়া করে গন্তব্য ওয়ারহাউজ নির্বাচন করুন।');
      return;
    }

    if (toWarehouse === currentWarehouse) {
      setError('বর্তমান ওয়ারহাউজ এবং গন্তব্য ওয়ারহাউজ একই হতে পারে না।');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await transferStaff(
        staff.id,
        toWarehouse,
        reason || 'স্টাফ ওয়ারহাউজ ট্রান্সফার',
        profile
      );

      setSuccessMsg(`সফলভাবে ${staff.name} (${staff.role}) কে ${toWarehouse} ওয়ারহাউজে ট্রান্সফার করা হয়েছে!`);

      setTimeout(() => {
        setIsSubmitting(false);
        if (onSuccess) onSuccess();
        onClose();
      }, 1400);
    } catch (err: any) {
      setError(err.message || 'ট্রান্সফার করতে সমস্যা হয়েছে।');
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !staff) return null;

  const currentBadge = getWarehouseBadge(currentWarehouse);
  const targetBadge = getWarehouseBadge(toWarehouse);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden my-6"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-400/30 flex items-center justify-center text-purple-300 shadow-inner">
              <ArrowLeftRight size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">স্টাফ ট্রান্সফার</h3>
              <p className="text-xs text-slate-300 mt-0.5">ড্রাইভার বা হেলপারকে অন্য ওয়ারহাউজে স্থানান্তর</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Staff Summary */}
        <div className="p-5 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-slate-700 shrink-0">
                <User size={22} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-slate-900 truncate">{staff.name}</h4>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-bold",
                    staff.role === 'Driver' ? "bg-blue-100 text-blue-700" : "bg-teal-100 text-teal-700"
                  )}>
                    {staff.role === 'Driver' ? 'ড্রাইভার' : 'সহকারী (Helper)'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
                  <span>{staff.driverId}</span>
                  {staff.phoneNumber && <span>• {staff.phoneNumber}</span>}
                </p>
              </div>
            </div>

            {/* Current Warehouse Badge */}
            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">বর্তমান ডিপো</span>
              <span className={cn(
                "inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-lg border shadow-2xs",
                currentBadge.bg, currentBadge.border, currentBadge.textCol
              )}>
                <Building2 size={13} />
                <span>{currentWarehouse}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleTransfer} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-start gap-2">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Destination Warehouse */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              নতুন ওয়ারহাউজ নির্বাচন করুন <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={toWarehouse}
                onChange={(e) => setToWarehouse(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-purple-500 focus:bg-white"
                required
              >
                {warehouses.map((wh) => (
                  <option 
                    key={wh.id} 
                    value={wh.name}
                    disabled={wh.name === currentWarehouse}
                  >
                    {wh.name} ({wh.region}) {wh.name === currentWarehouse ? '- বর্তমান' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Route Flow */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2 text-xs">
            <div className="text-center flex-1">
              <span className="text-[10px] text-slate-400 font-bold block">বর্তমান অবস্থান</span>
              <span className="font-extrabold text-slate-800">{currentWarehouse}</span>
            </div>
            <div className="flex flex-col items-center justify-center text-purple-600 px-2 shrink-0">
              <ArrowLeftRight size={18} className="animate-pulse" />
              <span className="text-[9px] font-black uppercase text-purple-500 mt-0.5">Transfer</span>
            </div>
            <div className="text-center flex-1">
              <span className="text-[10px] text-slate-400 font-bold block">নতুন অবস্থান</span>
              <span className="font-extrabold text-purple-700">{toWarehouse || 'নির্বাচন করুন'}</span>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              ট্রান্সফারের কারণ / নোট (ঐচ্ছিক)
            </label>
            <input
              type="text"
              placeholder="যেমন: সাভার ডিপোর স্টাফ ঘাটতি পূরণ, ইত্যাদি"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-purple-500 focus:bg-white"
            />
          </div>

          {/* Previous Transfers */}
          {staffTransfers.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-2">
                <History size={12} />
                <span>পূর্ববর্তী ট্রান্সফার রেকর্ড ({staffTransfers.length})</span>
              </h5>
              <div className="space-y-1.5 max-h-24 overflow-y-auto">
                {staffTransfers.map((t) => (
                  <div key={t.id} className="p-2 bg-slate-50 rounded-lg text-[11px] flex items-center justify-between border border-slate-100">
                    <div>
                      <span className="font-bold text-slate-800">{t.fromWarehouse}</span>
                      <span className="text-slate-400 mx-1">➔</span>
                      <span className="font-bold text-purple-700">{t.toWarehouse}</span>
                      {t.reason && <span className="text-slate-500 ml-1">({t.reason})</span>}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {t.transferredBy || 'Admin'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-purple-600 hover:bg-purple-700 shadow-xs flex items-center gap-2 transition-all active:scale-95 disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>ট্রান্সফার হচ্ছে...</span>
                </>
              ) : (
                <>
                  <ArrowLeftRight size={14} />
                  <span>ট্রান্সফার নিশ্চিত করুন</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
