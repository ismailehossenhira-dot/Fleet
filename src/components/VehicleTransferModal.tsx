import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowLeftRight, 
  Building2, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  Repeat, 
  Send, 
  Loader2, 
  History,
  Calendar,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWarehouse } from '../WarehouseContext';
import { transferVehicle, subscribeToCollection } from '../db';
import { useAuth } from '../AuthContext';
import { cn } from '../lib/utils';

interface VehicleTransferModalProps {
  vehicle: any | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const VehicleTransferModal: React.FC<VehicleTransferModalProps> = ({
  vehicle,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { warehouses, getWarehouseBadge } = useWarehouse();
  const { profile } = useAuth();

  const [mode, setMode] = useState<'transfer' | 'exchange'>('transfer');
  const [toWarehouse, setToWarehouse] = useState<string>('');
  const [exchangeVehicleId, setExchangeVehicleId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  const [allVehicles, setAllVehicles] = useState<any[]>([]);
  const [allTransfers, setAllTransfers] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const unsubV = subscribeToCollection('vehicles', setAllVehicles);
    const unsubT = subscribeToCollection('transfers', setAllTransfers);
    return () => {
      unsubV();
      unsubT();
    };
  }, [isOpen]);

  const currentWarehouse = vehicle?.warehouse || 'মোহাম্মদপুর';

  // Set default target warehouse (pick the first warehouse that isn't current)
  useEffect(() => {
    if (isOpen && vehicle) {
      const other = warehouses.find(w => w.name !== currentWarehouse);
      setToWarehouse(other ? other.name : 'সাভার');
      setExchangeVehicleId('');
      setReason('');
      setError('');
      setSuccessMsg('');
      setMode('transfer');
    }
  }, [isOpen, vehicle, currentWarehouse, warehouses]);

  // Available vehicles in the target warehouse for exchange
  const availableExchangeVehicles = allVehicles.filter(v => {
    if (v.id === vehicle?.id) return false;
    const vWh = v.warehouse || 'মোহাম্মদপুর';
    return vWh === toWarehouse && v.status === 'Available';
  });

  // Recent transfers for this vehicle
  const vehicleTransfers = allTransfers.filter(
    t => t.targetId === vehicle?.id || t.exchangeVehicleId === vehicle?.id
  ).slice(0, 5);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicle) return;

    if (!toWarehouse) {
      setError('দয়া করে গন্তব্য ওয়ারহাউজ নির্বাচন করুন।');
      return;
    }

    if (toWarehouse === currentWarehouse) {
      setError('বর্তমান ওয়ারহাউজ এবং গন্তব্য ওয়ারহাউজ একই হতে পারে না।');
      return;
    }

    if (mode === 'exchange' && !exchangeVehicleId) {
      setError('এক্সচেঞ্জ করার জন্য গন্তব্য ওয়ারহাউজের একটি গাড়ি নির্বাচন করুন।');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await transferVehicle(
        vehicle.id,
        toWarehouse,
        reason || (mode === 'exchange' ? 'ওয়ারহাউজ গাড়ি এক্সচেঞ্জ' : 'ওয়ারহাউজ ট্রান্সফার'),
        profile,
        mode === 'exchange' ? exchangeVehicleId : undefined
      );

      setSuccessMsg(
        mode === 'exchange'
          ? `সফলভাবে গাড়ি এক্সচেঞ্জ সম্পন্ন হয়েছে! (${vehicle.vehicleNumber} ↔ নির্বাচিত গাড়ি)`
          : `সফলভাবে ${vehicle.vehicleNumber} গাড়িটি ${toWarehouse} ওয়ারহাউজে ট্রান্সফার করা হয়েছে!`
      );

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

  if (!isOpen || !vehicle) return null;

  const currentBadge = getWarehouseBadge(currentWarehouse);
  const targetBadge = getWarehouseBadge(toWarehouse);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden my-6"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-300 shadow-inner">
              <ArrowLeftRight size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">গাড়ি ট্রান্সফার ও এক্সচেঞ্জ</h3>
              <p className="text-xs text-slate-300 mt-0.5">ডিপো থেকে ডিপোতে গাড়ি স্থানান্তর করুন</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Selected Vehicle Info Card */}
        <div className="p-5 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-slate-700 shrink-0">
                <Truck size={22} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-slate-900 truncate">{vehicle.vehicleNumber}</h4>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-bold">
                    {vehicle.type}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  স্ট্যাটাস: <span className="font-bold text-slate-700">{vehicle.status}</span>
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

          {/* Mode Switcher: Transfer vs Exchange */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              ট্রান্সফার মোড নির্বাচন করুন
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('transfer')}
                className={cn(
                  "flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all",
                  mode === 'transfer'
                    ? "bg-blue-50 border-blue-500 text-blue-800 shadow-xs ring-1 ring-blue-500"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                <Send size={15} />
                <span>একক ট্রান্সফার (Direct)</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('exchange')}
                className={cn(
                  "flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all",
                  mode === 'exchange'
                    ? "bg-indigo-50 border-indigo-500 text-indigo-800 shadow-xs ring-1 ring-indigo-500"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                <Repeat size={15} />
                <span>গাড়ি এক্সচেঞ্জ (Swap)</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {mode === 'transfer' 
                ? 'শুধুমাত্র এই গাড়িটি অন্য ওয়ারহাউজে পাঠিয়ে দেওয়া হবে।' 
                : 'অন্য ওয়ারহাউজের আরেকটি গাড়ির সাথে এই গাড়িটি অদলবদল (Exchange) করা হবে।'}
            </p>
          </div>

          {/* Destination Warehouse */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              গন্তব্য ওয়ারহাউজ (To Warehouse) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={toWarehouse}
                onChange={(e) => {
                  setToWarehouse(e.target.value);
                  setExchangeVehicleId('');
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
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

          {/* Visual Route Flow Indicator */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2 text-xs">
            <div className="text-center flex-1">
              <span className="text-[10px] text-slate-400 font-bold block">উৎস ডিপো</span>
              <span className="font-extrabold text-slate-800">{currentWarehouse}</span>
            </div>
            <div className="flex flex-col items-center justify-center text-blue-600 px-2 shrink-0">
              <ArrowLeftRight size={18} className="animate-pulse" />
              <span className="text-[9px] font-black uppercase text-blue-500 mt-0.5">
                {mode === 'exchange' ? 'Exchange' : 'Transfer'}
              </span>
            </div>
            <div className="text-center flex-1">
              <span className="text-[10px] text-slate-400 font-bold block">গন্তব্য ডিপো</span>
              <span className="font-extrabold text-blue-700">{toWarehouse || 'নির্বাচন করুন'}</span>
            </div>
          </div>

          {/* If Mode is Exchange: Select Exchange Vehicle */}
          {mode === 'exchange' && (
            <div className="animate-in fade-in">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {toWarehouse} ওয়ারহাউজের কোন গাড়ির সাথে এক্সচেঞ্জ করবেন? <span className="text-red-500">*</span>
              </label>
              {availableExchangeVehicles.length > 0 ? (
                <div className="relative">
                  <Truck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={exchangeVehicleId}
                    onChange={(e) => setExchangeVehicleId(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                    required
                  >
                    <option value="">গাড়ি নির্বাচন করুন...</option>
                    {availableExchangeVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vehicleNumber} ({v.type}) - Available
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  ⚠️ <strong>{toWarehouse}</strong> ওয়ারহাউজে এক্সচেঞ্জ করার মতো কোনো Available গাড়ি পাওয়া যায়নি। আপনি চাইলে <strong>একক ট্রান্সফার</strong> মোড ব্যবহার করতে পারেন।
                </div>
              )}
            </div>
          )}

          {/* Reason / Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              ট্রান্সফারের কারণ / নোট (ঐচ্ছিক)
            </label>
            <input
              type="text"
              placeholder="যেমন: সাভার জোনে অতিরিক্ত ডেলিভারি চাহিদা, ইত্যাদি"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          {/* Recent Transfer History for this Vehicle */}
          {vehicleTransfers.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-2">
                <History size={12} />
                <span>পূর্ববর্তী ট্রান্সফার রেকর্ড ({vehicleTransfers.length})</span>
              </h5>
              <div className="space-y-1.5 max-h-28 overflow-y-auto">
                {vehicleTransfers.map((t) => (
                  <div key={t.id} className="p-2 bg-slate-50 rounded-lg text-[11px] flex items-center justify-between border border-slate-100">
                    <div>
                      <span className="font-bold text-slate-800">{t.fromWarehouse}</span>
                      <span className="text-slate-400 mx-1">➔</span>
                      <span className="font-bold text-blue-700">{t.toWarehouse}</span>
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

          {/* Modal Footer */}
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
              disabled={isSubmitting || (mode === 'exchange' && !exchangeVehicleId)}
              className={cn(
                "px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-xs flex items-center gap-2 transition-all active:scale-95",
                mode === 'exchange' ? "bg-indigo-600 hover:bg-indigo-700" : "bg-blue-600 hover:bg-blue-700",
                (isSubmitting || (mode === 'exchange' && !exchangeVehicleId)) && "opacity-60 cursor-not-allowed"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>ট্রান্সফার হচ্ছে...</span>
                </>
              ) : (
                <>
                  <ArrowLeftRight size={14} />
                  <span>{mode === 'exchange' ? 'গাড়ি এক্সচেঞ্জ কনফার্ম করুন' : 'ট্রান্সফার সম্পন্ন করুন'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
