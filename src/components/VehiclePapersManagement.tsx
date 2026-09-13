import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileText, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  Upload, 
  Eye, 
  Edit3, 
  X, 
  ChevronRight, 
  ShieldCheck, 
  ShieldAlert, 
  Download, 
  Sparkles, 
  Check, 
  Trash2, 
  ZoomIn, 
  Camera, 
  Building2, 
  Truck, 
  Info,
  Radio,
  FileCheck,
  Hash,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Common';
import { 
  VehiclePaperRecord, 
  saveVehiclePapers, 
  VehiclePaperDocDetail, 
  VehicleDigitalPlateInfo 
} from '../db';
import { cn } from '../lib/utils';
import { useAuth } from '../AuthContext';
import { useWarehouse } from '../WarehouseContext';

// Helper: Strict size-capped image compression (target max 80KB) to comfortably fit Firestore limits
const compressImageFile = (file: File, maxWidth = 750, maxHeight = 900, targetMaxBytes = 85000): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio scale
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.65;
        let compressed = canvas.toDataURL('image/jpeg', quality);

        // Iteratively reduce quality if compressed data URL exceeds target bytes
        while (compressed.length * 0.75 > targetMaxBytes && quality > 0.25) {
          quality -= 0.1;
          compressed = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(compressed);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

// Calculate status and remaining days
export const calculateExpiryStatus = (expiryDateStr?: string) => {
  if (!expiryDateStr || !expiryDateStr.trim()) {
    return { status: 'not_set' as const, daysLeft: null, labelBn: 'তারিখ নেই', badgeClass: 'bg-slate-100 text-slate-600 border-slate-200' };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDateStr);
  expiry.setHours(0, 0, 0, 0);

  if (isNaN(expiry.getTime())) {
    return { status: 'not_set' as const, daysLeft: null, labelBn: 'তারিখ ভুল', badgeClass: 'bg-slate-100 text-slate-600 border-slate-200' };
  }

  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'expired' as const,
      daysLeft: diffDays,
      labelBn: `মেয়াদ উত্তীর্ণ (${Math.abs(diffDays)} দিন আগে)`,
      shortLabel: `${Math.abs(diffDays)} দিন পার`,
      badgeClass: 'bg-red-500/10 text-red-700 border-red-200 font-bold'
    };
  } else if (diffDays <= 30) {
    return {
      status: 'expiring_soon' as const,
      daysLeft: diffDays,
      labelBn: diffDays === 0 ? 'আজকেই মেয়াদ শেষ!' : `মেয়াদ শেষ হতে বাকি ${diffDays} দিন`,
      shortLabel: `${diffDays} দিন বাকি`,
      badgeClass: diffDays <= 7 
        ? 'bg-amber-500/20 text-amber-950 border-amber-300 font-black animate-pulse' 
        : 'bg-amber-500/10 text-amber-800 border-amber-200 font-bold'
    };
  } else {
    return {
      status: 'valid' as const,
      daysLeft: diffDays,
      labelBn: `বৈধ (${diffDays} দিন)`,
      shortLabel: `${diffDays} দিন`,
      badgeClass: 'bg-emerald-500/10 text-emerald-700 border-emerald-200 font-medium'
    };
  }
};

interface VehiclePapersManagementProps {
  vehicles: any[];
  papersList: VehiclePaperRecord[];
}

export const VehiclePapersManagement: React.FC<VehiclePapersManagementProps> = ({
  vehicles,
  papersList
}) => {
  const { isAdmin, isSubAdmin, isChecker, profile } = useAuth();
  const canEdit = isAdmin || isSubAdmin || isChecker;

  // Warehouse Context
  const { 
    selectedWarehouse, 
    setSelectedWarehouse, 
    warehouses: globalWarehouses,
    isWarehouseLocked
  } = useWarehouse();

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'alert' | 'expired' | 'expiring_soon' | 'valid' | 'digital_active' | 'digital_missing'>('all');
  const [typeFilter, setTypeFilter] = useState('All');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Edit modal state
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<VehiclePaperRecord>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingDocKey, setUploadingDocKey] = useState<string | null>(null);

  // Lightbox / Photo preview modal
  const [previewPhoto, setPreviewPhoto] = useState<{
    url: string;
    title: string;
    vehiclePlate: string;
    docNumber?: string;
    expiryDate?: string;
    statusInfo?: any;
  } | null>(null);

  // Urgent warning alert banner auto slide-out
  const [showAlertBanner, setShowAlertBanner] = useState(true);

  useEffect(() => {
    setShowAlertBanner(true);
    const timer = setTimeout(() => {
      setShowAlertBanner(false);
    }, 6500); // 6.5 seconds auto slide out
    return () => clearTimeout(timer);
  }, [selectedWarehouse]);

  // Quick vehicle paper lookup map with multi-index keying
  const papersMap = useMemo(() => {
    const map: Record<string, VehiclePaperRecord> = {};
    papersList.forEach(p => {
      if (p.id) {
        map[p.id] = p;
        map[String(p.id).replace(/[\/\s]/g, '_')] = p;
      }
      if (p.vehicleId) {
        map[p.vehicleId] = p;
        map[String(p.vehicleId).replace(/[\/\s]/g, '_')] = p;
      }
      if (p.vehiclePlate) {
        map[p.vehiclePlate] = p;
        map[String(p.vehiclePlate).replace(/[\/\s]/g, '_')] = p;
      }
    });
    return map;
  }, [papersList]);

  // Determine active warehouse list of vehicles based on selected warehouse
  const warehouseScopedVehicles = useMemo(() => {
    if (!selectedWarehouse || selectedWarehouse === 'all' || selectedWarehouse === 'সকল ডিপো') {
      return vehicles;
    }
    const cleanSelected = selectedWarehouse.trim().toLowerCase();
    return vehicles.filter(v => {
      const vWh = (v.warehouse || '').trim().toLowerCase();
      return vWh === cleanSelected;
    });
  }, [vehicles, selectedWarehouse]);

  // Merge warehouse-scoped vehicles with their paper records
  const enrichedVehicles = useMemo(() => {
    return warehouseScopedVehicles.map(v => {
      const cleanId = String(v.id || '').replace(/[\/\s]/g, '_');
      const cleanPlate = String(v.vehicleNumber || '').replace(/[\/\s]/g, '_');

      // First check Firestore live papersMap, then check fallback localStorage cache
      let paper: Partial<VehiclePaperRecord> = 
        papersMap[v.id] || 
        papersMap[v.vehicleNumber] || 
        (cleanId ? papersMap[cleanId] : null) || 
        (cleanPlate ? papersMap[cleanPlate] : null) || {};

      if (!paper.vehicleId) {
        try {
          const cached = localStorage.getItem(`fleetflow_paper_saved_${cleanId || cleanPlate}`);
          if (cached) {
            paper = JSON.parse(cached);
          }
        } catch (e) {
          // ignore cache error
        }
      }
      
      const ttStatus = calculateExpiryStatus(paper.taxToken?.expiryDate);
      const fcStatus = calculateExpiryStatus(paper.fitness?.expiryDate);
      const rpStatus = calculateExpiryStatus(paper.routePermit?.expiryDate);
      const insStatus = calculateExpiryStatus(paper.insurance?.expiryDate);

      const docsList = [
        { key: 'taxToken', nameBn: 'ট্যাক্স টোকেন', short: 'TT', detail: paper.taxToken, calc: ttStatus },
        { key: 'fitness', nameBn: 'ফিটনেস সনদ', short: 'FC', detail: paper.fitness, calc: fcStatus },
        { key: 'routePermit', nameBn: 'রুট পারমিট', short: 'RP', detail: paper.routePermit, calc: rpStatus },
        { key: 'insurance', nameBn: 'বীমা / ইন্স্যুরেন্স', short: 'INS', detail: paper.insurance, calc: insStatus },
        { key: 'registration', nameBn: 'রেজিস্ট্রেশন (RC)', short: 'RC', detail: paper.registration, calc: calculateExpiryStatus(paper.registration?.expiryDate) }
      ];

      const hasExpired = docsList.some(d => d.calc.status === 'expired');
      const hasExpiringSoon = docsList.some(d => d.calc.status === 'expiring_soon');
      const allValid = docsList.every(d => d.calc.status === 'valid');
      const isDigitalPlateActive = paper.digitalPlate?.status === 'Active';

      return {
        vehicle: v,
        paper,
        docsList,
        hasExpired,
        hasExpiringSoon,
        allValid,
        isDigitalPlateActive,
        overallStatus: hasExpired ? 'expired' : (hasExpiringSoon ? 'expiring_soon' : (allValid ? 'valid' : 'incomplete'))
      };
    });
  }, [warehouseScopedVehicles, papersMap]);

  // Fleet counts scoped to selected warehouse
  const stats = useMemo(() => {
    let totalExpired = 0;
    let totalExpiringSoon = 0;
    let totalValid = 0;
    let totalDigitalPlateActive = 0;

    enrichedVehicles.forEach(item => {
      if (item.hasExpired) totalExpired++;
      else if (item.hasExpiringSoon) totalExpiringSoon++;
      else if (item.allValid) totalValid++;

      if (item.isDigitalPlateActive) totalDigitalPlateActive++;
    });

    return {
      totalExpired,
      totalExpiringSoon,
      totalValid,
      totalDigitalPlateActive,
      totalVehicles: enrichedVehicles.length
    };
  }, [enrichedVehicles]);

  // Unique Warehouses from total vehicles for quick navigation
  const availableWarehouses = useMemo(() => {
    const list = new Set<string>();
    vehicles.forEach(v => {
      if (v.warehouse) list.add(v.warehouse.trim());
    });
    globalWarehouses.forEach(w => {
      if (w.name) list.add(w.name.trim());
    });
    return Array.from(list);
  }, [vehicles, globalWarehouses]);

  const vehicleTypes = useMemo(() => {
    const list = new Set<string>();
    warehouseScopedVehicles.forEach(v => {
      if (v.type) list.add(v.type);
    });
    return Array.from(list);
  }, [warehouseScopedVehicles]);

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    return enrichedVehicles.filter(item => {
      const v = item.vehicle;
      const paper = item.paper;
      const q = searchTerm.toLowerCase().trim();

      // Search matching
      if (q) {
        const matchesPlate = (v.vehicleNumber || '').toLowerCase().includes(q);
        const matchesType = (v.type || '').toLowerCase().includes(q);
        const matchesWarehouse = (v.warehouse || '').toLowerCase().includes(q);
        const matchesRfid = (paper.digitalPlate?.rfidTag || '').toLowerCase().includes(q);
        const matchesPlateSerial = (paper.digitalPlate?.smartPlateSerial || '').toLowerCase().includes(q);
        const matchesDocNum = (paper.taxToken?.docNumber || '').toLowerCase().includes(q) ||
                              (paper.fitness?.docNumber || '').toLowerCase().includes(q) ||
                              (paper.routePermit?.docNumber || '').toLowerCase().includes(q);

        if (!matchesPlate && !matchesType && !matchesWarehouse && !matchesRfid && !matchesPlateSerial && !matchesDocNum) {
          return false;
        }
      }

      // Type filter
      if (typeFilter !== 'All' && v.type !== typeFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === 'alert') {
        return item.hasExpired || item.hasExpiringSoon;
      } else if (statusFilter === 'expired') {
        return item.hasExpired;
      } else if (statusFilter === 'expiring_soon') {
        return item.hasExpiringSoon;
      } else if (statusFilter === 'valid') {
        return item.allValid;
      } else if (statusFilter === 'digital_active') {
        return item.isDigitalPlateActive;
      } else if (statusFilter === 'digital_missing') {
        return !item.isDigitalPlateActive;
      }

      return true;
    });
  }, [enrichedVehicles, searchTerm, typeFilter, statusFilter]);

  // Handle open edit modal
  const handleOpenEdit = (v: any) => {
    const cleanId = String(v.id || '').replace(/[\/\s]/g, '_');
    const cleanPlate = String(v.vehicleNumber || '').replace(/[\/\s]/g, '_');

    let existing = papersMap[v.id] || papersMap[v.vehicleNumber] || (cleanId ? papersMap[cleanId] : null) || (cleanPlate ? papersMap[cleanPlate] : null);

    if (!existing) {
      try {
        const cached = localStorage.getItem(`fleetflow_paper_saved_${cleanId || cleanPlate}`);
        if (cached) existing = JSON.parse(cached);
      } catch (e) {
        // ignore
      }
    }

    const initialData: Partial<VehiclePaperRecord> = existing ? JSON.parse(JSON.stringify(existing)) : {
      vehicleId: v.id || v.vehicleNumber,
      vehiclePlate: v.vehicleNumber,
      warehouse: v.warehouse,
      vehicleType: v.type,
      taxToken: {},
      fitness: {},
      routePermit: {},
      registration: {},
      insurance: {},
      digitalPlate: { status: 'Not Installed' }
    };

    setEditingVehicle(v);
    setEditFormData(initialData);
    setSaveSuccess(false);
    setSaveError(null);
  };

  // Handle image upload with auto compression
  const handleImageUpload = async (docTypeKey: string, file: File) => {
    try {
      setUploadingDocKey(docTypeKey);
      const compressedDataUrl = await compressImageFile(file, 750, 900, 85000);
      setEditFormData(prev => {
        const next = { ...prev };
        if (docTypeKey.startsWith('digitalPlate.')) {
          const field = docTypeKey.split('.')[1];
          next.digitalPlate = {
            ...(next.digitalPlate || { status: 'Not Installed' }),
            [field]: compressedDataUrl
          };
        } else {
          (next as any)[docTypeKey] = {
            ...((next as any)[docTypeKey] || {}),
            photoUrl: compressedDataUrl
          };
        }
        return next;
      });
    } catch (err: any) {
      console.error('Image upload failed:', err);
      alert('ছবি আপলোড বা প্রসেসিং ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setUploadingDocKey(null);
    }
  };

  // Handle Remove Image
  const handleRemoveImage = (docTypeKey: string) => {
    setEditFormData(prev => {
      const next = { ...prev };
      if (docTypeKey.startsWith('digitalPlate.')) {
        const field = docTypeKey.split('.')[1];
        if (next.digitalPlate) {
          next.digitalPlate = { ...next.digitalPlate, [field]: '' };
        }
      } else if ((next as any)[docTypeKey]) {
        (next as any)[docTypeKey] = {
          ...(next as any)[docTypeKey],
          photoUrl: ''
        };
      }
      return next;
    });
  };

  // Save changes
  const handleSave = async () => {
    if (!editingVehicle) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const rawId = editingVehicle.id || editingVehicle.vehicleNumber || 'veh_' + Date.now();
      const targetVehicleId = String(rawId).trim().replace(/[\/\s]/g, '_');

      const payload: Partial<VehiclePaperRecord> = {
        ...editFormData,
        id: targetVehicleId,
        vehicleId: targetVehicleId,
        vehiclePlate: editingVehicle.vehicleNumber || '',
        warehouse: editingVehicle.warehouse || selectedWarehouse || '',
        vehicleType: editingVehicle.type || ''
      };

      await saveVehiclePapers(targetVehicleId, payload, profile);

      // Local backup in case of temporary offline/reconnect
      try {
        localStorage.setItem(`fleetflow_paper_saved_${targetVehicleId}`, JSON.stringify(payload));
      } catch (cacheErr) {
        console.warn('Local storage cache skipped:', cacheErr);
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setIsSaving(false);
        setEditingVehicle(null);
      }, 700);
    } catch (err: any) {
      console.error('Error saving vehicle papers:', err);
      const msg = err?.message || 'সংরক্ষণ ব্যর্থ হয়েছে। ফায়ারবেস কানেকশন যাচাই করুন।';
      setSaveError(msg);
      alert(`সংরক্ষণ ব্যর্থ হয়েছে: ${msg}`);
      setIsSaving(false);
    }
  };

  // Active tab in edit modal
  const [modalTab, setModalTab] = useState<'docs' | 'plate'>('docs');

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top Warehouse Selection & Indicator Bar ("ওয়্যারহাউস এর ভিত্তিতে দেখাবে") */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
            <Building2 size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ডিপো ফিল্টার:</span>
              <span className="text-xs font-black px-2 py-0.5 rounded-md bg-blue-600 text-white">
                {selectedWarehouse === 'all' || !selectedWarehouse ? 'সকল ডিপো (All Warehouses)' : selectedWarehouse}
              </span>
            </div>
          </div>
        </div>

        {/* Warehouse Selector Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            disabled={isWarehouseLocked}
            onClick={() => setSelectedWarehouse('all')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
              selectedWarehouse === 'all' || !selectedWarehouse
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            সকল ডিপো
          </button>
          {availableWarehouses.map(whName => {
            const count = vehicles.filter(v => (v.warehouse || '').trim() === whName).length;
            const isSelected = selectedWarehouse === whName;
            return (
              <button
                key={whName}
                type="button"
                disabled={isWarehouseLocked && selectedWarehouse !== whName}
                onClick={() => setSelectedWarehouse(whName)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5",
                  isSelected
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-blue-50/80 text-blue-800 hover:bg-blue-100 border border-blue-200/60 disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <span>{whName}</span>
                <span className={cn(
                  "px-1.5 py-0.2 text-[10px] rounded-full font-black",
                  isSelected ? "bg-white/20 text-white" : "bg-blue-200/60 text-blue-900"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. Stat Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div 
          onClick={() => setStatusFilter(statusFilter === 'expired' ? 'all' : 'expired')}
          className={cn(
            "p-3.5 rounded-2xl border transition-all cursor-pointer shadow-3xs flex items-center justify-between",
            stats.totalExpired > 0 
              ? "bg-red-500/5 border-red-200 hover:border-red-400" 
              : "bg-white border-slate-200",
            statusFilter === 'expired' && "ring-2 ring-red-500 bg-red-50/70"
          )}
        >
          <div>
            <div className="text-[11px] font-bold text-red-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              <span>মেয়াদ উত্তীর্ণ কাগজ</span>
            </div>
            <div className="text-2xl font-black text-red-950 mt-1">
              {stats.totalExpired} <span className="text-xs font-medium text-red-700">টি গাড়ি</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-100/80 text-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} />
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === 'expiring_soon' ? 'all' : 'expiring_soon')}
          className={cn(
            "p-3.5 rounded-2xl border transition-all cursor-pointer shadow-3xs flex items-center justify-between",
            stats.totalExpiringSoon > 0 
              ? "bg-amber-500/5 border-amber-200 hover:border-amber-400" 
              : "bg-white border-slate-200",
            statusFilter === 'expiring_soon' && "ring-2 ring-amber-500 bg-amber-50/70"
          )}
        >
          <div>
            <div className="text-[11px] font-bold text-amber-700 flex items-center gap-1.5">
              <Clock size={12} className="text-amber-600" />
              <span>শীঘ্রই মেয়াদ শেষ (&le; ৩০ দিন)</span>
            </div>
            <div className="text-2xl font-black text-amber-950 mt-1">
              {stats.totalExpiringSoon} <span className="text-xs font-medium text-amber-700">টি গাড়ি</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100/80 text-amber-600 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === 'valid' ? 'all' : 'valid')}
          className={cn(
            "p-3.5 rounded-2xl border transition-all cursor-pointer shadow-3xs flex items-center justify-between bg-white border-slate-200 hover:border-emerald-300",
            statusFilter === 'valid' && "ring-2 ring-emerald-500 bg-emerald-50/70"
          )}
        >
          <div>
            <div className="text-[11px] font-bold text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-emerald-600" />
              <span>সম্পূর্ণ বৈধ কাগজ</span>
            </div>
            <div className="text-2xl font-black text-emerald-950 mt-1">
              {stats.totalValid} <span className="text-xs font-medium text-emerald-700">টি গাড়ি</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-600 flex items-center justify-center shrink-0">
            <FileCheck size={20} />
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === 'digital_active' ? 'all' : 'digital_active')}
          className={cn(
            "p-3.5 rounded-2xl border transition-all cursor-pointer shadow-3xs flex items-center justify-between bg-white border-slate-200 hover:border-blue-300",
            statusFilter === 'digital_active' && "ring-2 ring-blue-500 bg-blue-50/70"
          )}
        >
          <div>
            <div className="text-[11px] font-bold text-blue-700 flex items-center gap-1.5">
              <Radio size={12} className="text-blue-600" />
              <span>স্মার্ট ডিজিটাল প্লেট</span>
            </div>
            <div className="text-2xl font-black text-blue-950 mt-1">
              {stats.totalDigitalPlateActive} <span className="text-xs font-medium text-blue-700">/{stats.totalVehicles}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-100/80 text-blue-600 flex items-center justify-center shrink-0">
            <Sparkles size={20} />
          </div>
        </div>
      </div>

      {/* 2. Urgent Expiry Warning Alert Banner with Auto Slide-Out */}
      <AnimatePresence>
        {showAlertBanner && (stats.totalExpired > 0 || stats.totalExpiringSoon > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -16, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ 
              opacity: 0, 
              y: -24, 
              height: 0, 
              transition: { duration: 0.5, ease: 'easeInOut' } 
            }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-linear-to-r from-red-500/10 via-amber-500/10 to-red-500/10 border border-red-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-3xs">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-red-950 flex items-center gap-2">
                    <span>কাগজপত্রের মেয়াদ সংক্রান্ত সতর্কতা</span>
                    <span className="bg-red-200 text-red-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-red-300">
                      জরুরি নোটিশ
                    </span>
                  </h4>
                  <p className="text-xs text-red-900/90 mt-0.5 leading-relaxed">
                    ফ্লিটের <strong>{stats.totalExpired} টি গাড়ির</strong> এক বা একাধিক কাগজপত্র মেয়াদ উত্তীর্ণ এবং <strong>{stats.totalExpiringSoon} টি গাড়ির</strong> মেয়াদ আগামী ৩০ দিনের মধ্যে শেষ হতে চলেছে। বিআরটিএ জরিমানা এড়াতে অবিলম্বে নবায়ন করুন।
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => setStatusFilter('alert')}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-3xs",
                    statusFilter === 'alert' 
                      ? "bg-red-700 text-white shadow-xs" 
                      : "bg-white text-red-700 border border-red-300 hover:bg-red-50"
                  )}
                >
                  সতর্কতাপ্রাপ্ত গাড়িগুলো দেখুন
                </button>
                <button
                  type="button"
                  onClick={() => setShowAlertBanner(false)}
                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                  title="নোটিশ বন্ধ করুন"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Compact Filter Bar ("ছোট একটা ফিল্টার রাখিও") */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-3xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="গাড়ির নম্বর, টাইপ, আরএফআইডি বা কাগজের নম্বর দিয়ে খুঁজুন..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all placeholder:text-slate-400"
            />
            {searchTerm && (
              <button 
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick Filter Pill Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
                statusFilter === 'all' 
                  ? "bg-slate-900 text-white shadow-xs" 
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              সকল গাড়ি ({enrichedVehicles.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('expired')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5",
                statusFilter === 'expired' 
                  ? "bg-red-600 text-white shadow-xs" 
                  : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/60"
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span>মেয়াদ উত্তীর্ণ ({stats.totalExpired})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('expiring_soon')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5",
                statusFilter === 'expiring_soon' 
                  ? "bg-amber-600 text-white shadow-xs" 
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60"
              )}
            >
              <Clock size={12} />
              <span>আসন্ন মেয়াদ (&le;৩০ দিন)</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('valid')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5",
                statusFilter === 'valid' 
                  ? "bg-emerald-600 text-white shadow-xs" 
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60"
              )}
            >
              <CheckCircle2 size={12} />
              <span>বৈধ ({stats.totalValid})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('digital_active')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5",
                statusFilter === 'digital_active' 
                  ? "bg-blue-600 text-white shadow-xs" 
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60"
              )}
            >
              <Sparkles size={12} />
              <span>ডিজিটাল প্লেট ({stats.totalDigitalPlateActive})</span>
            </button>

            {/* Vehicle Model / Category Filter Toggle */}
            <button
              type="button"
              onClick={() => setShowFilterDrawer(!showFilterDrawer)}
              className={cn(
                "px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 shrink-0",
                showFilterDrawer || typeFilter !== 'All'
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              )}
              title="মডেল / ক্যাটাগরি ফিল্টার"
            >
              <Filter size={13} />
              <span className="hidden sm:inline">অন্যান্য ফিল্টার</span>
              {typeFilter !== 'All' && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>
          </div>
        </div>

        {/* Compact Expandable Filter Drawer (Vehicle Model / Category Only) */}
        {showFilterDrawer && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600 whitespace-nowrap">
                মডেল / ক্যাটাগরি:
              </label>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none cursor-pointer"
              >
                <option value="All">সকল মডেল ({vehicleTypes.length}টি)</option>
                {vehicleTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {(typeFilter !== 'All' || statusFilter !== 'all' || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setTypeFilter('All');
                  setStatusFilter('all');
                  setSearchTerm('');
                }}
                className="py-1 px-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer flex items-center gap-1"
              >
                <X size={12} />
                <span>ফিল্টার মুছুন</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. Vehicles Documents & Plates List */}
      <div className="space-y-3.5">
        {filteredVehicles.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
              <FileText size={28} />
            </div>
            <h4 className="font-bold text-slate-800 text-base">কোনো গাড়ি পাওয়া যায়নি</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {selectedWarehouse && selectedWarehouse !== 'all' 
                ? `"${selectedWarehouse}" ডিপোতে বর্তমান ফিল্টারের সাথে মিলে এমন কোনো গাড়ি পাওয়া যায়নি।` 
                : 'আপনার নির্বাচিত ফিল্টার বা সার্চের সাথে মিলে এমন কোনো গাড়ি পাওয়া যায়নি। ফিল্টার পরিবর্তন করে পুনরায় চেষ্টা করুন।'}
            </p>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setSearchTerm('');
                if (!isWarehouseLocked) setSelectedWarehouse('all');
                setTypeFilter('All');
              }}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-slate-800 cursor-pointer"
            >
              সকল গাড়ি প্রদর্শন করুন
            </button>
          </div>
        ) : (
          filteredVehicles.map(({ vehicle, paper, docsList, hasExpired, hasExpiringSoon, isDigitalPlateActive }) => {
            const digital = paper.digitalPlate || { status: 'Not Installed' };

            return (
              <div 
                key={vehicle.id}
                className={cn(
                  "bg-white border rounded-3xl p-4 sm:p-5 transition-all shadow-3xs hover:shadow-md",
                  hasExpired 
                    ? "border-red-300/80 bg-linear-to-r from-red-50/20 via-white to-white" 
                    : hasExpiringSoon 
                    ? "border-amber-300/80 bg-linear-to-r from-amber-50/20 via-white to-white" 
                    : "border-slate-200/90"
                )}
              >
                {/* Vehicle Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-inner",
                      hasExpired 
                        ? "bg-red-500 text-white" 
                        : hasExpiringSoon 
                        ? "bg-amber-500 text-white" 
                        : "bg-slate-900 text-white"
                    )}>
                      <Truck size={20} />
                    </div>
                    <div>
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-mono font-black text-base sm:text-lg text-slate-950 tracking-tight">
                          {vehicle.vehicleNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                          {vehicle.type || 'Vehicle'}
                        </span>
                        {vehicle.warehouse && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 text-[10px] font-bold flex items-center gap-1">
                            <Building2 size={10} />
                            <span>{vehicle.warehouse}</span>
                          </span>
                        )}
                      </div>

                      {/* Overal Expiry Status Note */}
                      <div className="flex items-center gap-2 mt-1">
                        {hasExpired ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 text-red-800 text-[11px] font-extrabold border border-red-200">
                            <AlertTriangle size={12} className="text-red-600" />
                            <span>মেয়াদ উত্তীর্ণ কাগজপত্র রয়েছে</span>
                          </span>
                        ) : hasExpiringSoon ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-extrabold border border-amber-300">
                            <Clock size={12} className="text-amber-700" />
                            <span>শীঘ্রই মেয়াদ শেষ হবে</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                            <CheckCircle2 size={12} className="text-emerald-600" />
                            <span>কাগজপত্র নিয়মিত</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(vehicle)}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-3xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <Edit3 size={14} />
                        <span>কাগজ ও প্লেট আপডেট</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Digital Number Plate Sub-Section */}
                <div className="my-3.5 p-3 rounded-2xl bg-linear-to-r from-slate-50 via-blue-50/20 to-slate-50 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">ডিজিটাল স্মার্ট নাম্বার প্লেট</span>
                        {digital.status === 'Active' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-300 flex items-center gap-1">
                            <Check size={10} strokeWidth={3} />
                            <span>সক্রিয় (Active)</span>
                          </span>
                        ) : digital.status === 'Pending' ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300">
                            অপেক্ষমাণ (Pending)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200">
                            সংযুক্ত নেই (Not Installed)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-1 text-[11px] text-slate-600">
                        {digital.rfidTag ? (
                          <span>
                            <strong>RFID ট্যাগ:</strong> <span className="font-mono text-slate-900 font-bold">{digital.rfidTag}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">RFID: নির্ধারিত নেই</span>
                        )}

                        {digital.smartPlateSerial && (
                          <span>
                            <strong>সিরিয়াল:</strong> <span className="font-mono text-slate-900 font-bold">{digital.smartPlateSerial}</span>
                          </span>
                        )}

                        {digital.issueDate && (
                          <span>
                            <strong>ইস্যু তারিখ:</strong> {digital.issueDate}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Digital Plate Photos (Front & Rear) */}
                  <div className="flex items-center gap-2 shrink-0">
                    {digital.frontPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewPhoto({
                          url: digital.frontPhotoUrl!,
                          title: 'ডিজিটাল নাম্বার প্লেট (সামনে)',
                          vehiclePlate: vehicle.vehicleNumber,
                          docNumber: digital.smartPlateSerial || digital.rfidTag
                        })}
                        className="px-2.5 py-1.5 rounded-xl border border-blue-200 bg-white hover:bg-blue-50 text-blue-700 text-[11px] font-bold flex items-center gap-1.5 shadow-3xs cursor-pointer"
                        title="সামনের প্লেটের ছবি দেখুন"
                      >
                        <Camera size={13} />
                        <span>সামনের প্লেট</span>
                      </button>
                    )}

                    {digital.rearPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewPhoto({
                          url: digital.rearPhotoUrl!,
                          title: 'ডিজিটাল নাম্বার প্লেট (পেছনে)',
                          vehiclePlate: vehicle.vehicleNumber,
                          docNumber: digital.smartPlateSerial || digital.rfidTag
                        })}
                        className="px-2.5 py-1.5 rounded-xl border border-blue-200 bg-white hover:bg-blue-50 text-blue-700 text-[11px] font-bold flex items-center gap-1.5 shadow-3xs cursor-pointer"
                        title="পেছনের প্লেটের ছবি দেখুন"
                      >
                        <Camera size={13} />
                        <span>পেছনের প্লেট</span>
                      </button>
                    )}

                    {!digital.frontPhotoUrl && !digital.rearPhotoUrl && (
                      <span className="text-[11px] text-slate-400 italic">প্লেটের ছবি নেই</span>
                    )}
                  </div>
                </div>

                {/* Documents Expiry Grid */}
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    কাগজপত্রের মেয়াদ ও ছবি:
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {docsList.map(doc => {
                      const detail: VehiclePaperDocDetail | undefined = doc.detail;
                      const calc = doc.calc;
                      const hasPhoto = Boolean(detail?.photoUrl);

                      return (
                        <div
                          key={doc.key}
                          className={cn(
                            "p-3 rounded-2xl border transition-all flex flex-col justify-between gap-2",
                            calc.status === 'expired' 
                              ? "bg-red-50/50 border-red-200" 
                              : calc.status === 'expiring_soon' 
                              ? "bg-amber-50/50 border-amber-200" 
                              : "bg-slate-50/60 border-slate-200/80 hover:bg-white"
                          )}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">
                                {doc.nameBn}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                {doc.short}
                              </span>
                            </div>

                            {/* Expiry Date */}
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                                <Calendar size={12} className="text-slate-400 shrink-0" />
                                <span>{detail?.expiryDate || 'মেয়াদ নির্ধারিত নেই'}</span>
                              </div>

                              {detail?.docNumber && (
                                <div className="text-[10px] text-slate-500 truncate" title={detail.docNumber}>
                                  নং: <span className="font-mono font-semibold text-slate-700">{detail.docNumber}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Status Badge & Photo Preview Button */}
                          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-1.5">
                            <span className={cn("px-2 py-0.5 rounded-lg text-[10px] border", calc.badgeClass)}>
                              {calc.shortLabel || calc.labelBn}
                            </span>

                            {hasPhoto ? (
                              <button
                                type="button"
                                onClick={() => setPreviewPhoto({
                                  url: detail!.photoUrl!,
                                  title: doc.nameBn,
                                  vehiclePlate: vehicle.vehicleNumber,
                                  docNumber: detail?.docNumber,
                                  expiryDate: detail?.expiryDate,
                                  statusInfo: calc
                                })}
                                className="p-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 shadow-3xs transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                                title="ডকুমেন্টের ছবি দেখুন"
                              >
                                <Eye size={12} />
                                <span>ছবি</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">ছবি নেই</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. EDIT & UPLOAD MODAL */}
      <AnimatePresence>
        {editingVehicle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-blue-400 font-black">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white flex items-center gap-2">
                      <span>কাগজ ও ডিজিটাল প্লেট এন্ট্রি</span>
                      <span className="font-mono px-2 py-0.5 bg-white/10 rounded-md text-xs text-blue-200 font-bold">
                        {editingVehicle.vehicleNumber}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300">
                      কাগজপত্রের মেয়াদ, নম্বর এবং মূল কাগজের ছবি আপলোড করুন
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingVehicle(null)}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Tab Controls */}
              <div className="px-5 pt-3 border-b border-slate-100 flex items-center gap-3 bg-slate-50 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalTab('docs')}
                  className={cn(
                    "pb-2 px-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5",
                    modalTab === 'docs' 
                      ? "border-slate-900 text-slate-900" 
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  )}
                >
                  <FileText size={14} />
                  <span>কাগজপত্রের মেয়াদ ও ছবি</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalTab('plate')}
                  className={cn(
                    "pb-2 px-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5",
                    modalTab === 'plate' 
                      ? "border-blue-600 text-blue-700" 
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  )}
                >
                  <Sparkles size={14} />
                  <span>ডিজিটাল নাম্বার প্লেট ও আরএফআইডি</span>
                </button>
              </div>

              {/* Modal Content Form Body */}
              <div className="p-5 overflow-y-auto space-y-5 flex-1">
                {modalTab === 'docs' ? (
                  <div className="space-y-4">
                    {[
                      { key: 'taxToken', titleBn: 'ট্যাক্স টোকেন (Tax Token - TT)', color: 'blue' },
                      { key: 'fitness', titleBn: 'ফিটনেস সার্টিফিকেট (Fitness - FC)', color: 'emerald' },
                      { key: 'routePermit', titleBn: 'রুট পারমিট (Route Permit - RP)', color: 'amber' },
                      { key: 'registration', titleBn: 'রেজিস্ট্রেশন সনদ (Registration - RC)', color: 'indigo' },
                      { key: 'insurance', titleBn: 'বীমা / ইন্স্যুরেন্স (Insurance Policy)', color: 'purple' }
                    ].map(field => {
                      const docData: VehiclePaperDocDetail = (editFormData as any)[field.key] || {};
                      const calc = calculateExpiryStatus(docData.expiryDate);

                      return (
                        <div 
                          key={field.key}
                          className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-2">
                              <span>{field.titleBn}</span>
                            </h4>
                            {docData.expiryDate && (
                              <span className={cn("px-2 py-0.5 rounded-md text-[10px] border", calc.badgeClass)}>
                                {calc.labelBn}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Expiry Date */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                মেয়াদ উত্তীর্ণের তারিখ (Expiry Date):
                              </label>
                              <input
                                type="date"
                                value={docData.expiryDate || ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  setEditFormData(prev => ({
                                    ...prev,
                                    [field.key]: {
                                      ...((prev as any)[field.key] || {}),
                                      expiryDate: val
                                    }
                                  }));
                                }}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                              />
                            </div>

                            {/* Document / Certificate No */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                ডকুমেন্ট / সনদ নম্বর (Doc/Serial No):
                              </label>
                              <input
                                type="text"
                                placeholder="যেমন: TT-2024-9842"
                                value={docData.docNumber || ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  setEditFormData(prev => ({
                                    ...prev,
                                    [field.key]: {
                                      ...((prev as any)[field.key] || {}),
                                      docNumber: val
                                    }
                                  }));
                                }}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                              />
                            </div>
                          </div>

                          {/* Image Upload for Document */}
                          <div className="pt-2 border-t border-slate-200/60">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                              কাগজের স্পষ্ট ছবি (ছবি আপলোড করে রাখুন):
                            </label>

                            {uploadingDocKey === field.key ? (
                              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-blue-700 animate-pulse">
                                <Clock size={16} className="animate-spin" />
                                <span>ছবি অপ্টিমাইজ ও কম্প্রেস হচ্ছে...</span>
                              </div>
                            ) : docData.photoUrl ? (
                              <div className="flex items-center gap-3 p-2 bg-white border border-slate-200 rounded-xl">
                                <img
                                  src={docData.photoUrl}
                                  alt={field.titleBn}
                                  referrerPolicy="no-referrer"
                                  className="w-14 h-14 object-cover rounded-lg border border-slate-200"
                                />
                                <div className="flex-1 min-w-0 text-xs">
                                  <div className="font-bold text-slate-800 truncate">ছবি সংরক্ষিত আছে</div>
                                  <span className="text-[10px] text-emerald-600 font-semibold block">কাগজের ছবি সংযুক্ত রয়েছে</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewPhoto({
                                      url: docData.photoUrl!,
                                      title: field.titleBn,
                                      vehiclePlate: editingVehicle.vehicleNumber,
                                      docNumber: docData.docNumber,
                                      expiryDate: docData.expiryDate,
                                      statusInfo: calc
                                    })}
                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                                    title="ছবি বড় করে দেখুন"
                                  >
                                    <Eye size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveImage(field.key)}
                                    className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold cursor-pointer"
                                    title="ছবি মুছে ফেলুন"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="relative">
                                <label className="flex items-center justify-center gap-2 p-3 bg-white border border-dashed border-slate-300 hover:border-slate-400 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer">
                                  <Upload size={16} className="text-slate-400" />
                                  <span>কাগজের ছবি সিলেক্ট বা ড্রপ করুন (Camera / Gallery)</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={e => {
                                      const file = e.target.files?.[0];
                                      if (file) handleImageUpload(field.key, file);
                                    }}
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Digital Number Plate Form Tab */
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-2.5 text-xs text-blue-900">
                      <Sparkles size={18} className="text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>স্মার্ট ডিজিটাল প্লেট ও আরএফআইডি ট্র্যাকিং</strong>
                        <p className="mt-0.5 text-blue-800">
                          গাড়ির বিআরটিএ ডিজিটাল নাম্বার প্লেট, স্মার্ট আরএফআইডি চিপ নম্বর এবং সামনে-পেছনের প্লেটের ছবি এখানে সংরক্ষণ করে রাখুন।
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          ডিজিটাল প্লেটের বর্তমান অবস্থা (Status):
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { value: 'Active', label: 'সক্রিয় (Active)', icon: Check },
                            { value: 'Pending', label: 'অপেক্ষমাণ (Pending)', icon: Clock },
                            { value: 'Not Installed', label: 'নেই (Not Installed)', icon: X }
                          ].map(opt => {
                            const isSelected = (editFormData.digitalPlate?.status || 'Not Installed') === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  setEditFormData(prev => ({
                                    ...prev,
                                    digitalPlate: {
                                      ...(prev.digitalPlate || { status: 'Not Installed' }),
                                      status: opt.value as any
                                    }
                                  }));
                                }}
                                className={cn(
                                  "py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer",
                                  isSelected 
                                    ? "bg-slate-900 text-white border-slate-900 shadow-xs" 
                                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                                )}
                              >
                                <opt.icon size={13} />
                                <span>{opt.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            আরএফআইডি ট্যাগ নম্বর (RFID Chip Tag ID):
                          </label>
                          <input
                            type="text"
                            placeholder="যেমন: RFID-BD-9042"
                            value={editFormData.digitalPlate?.rfidTag || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setEditFormData(prev => ({
                                ...prev,
                                digitalPlate: {
                                  ...(prev.digitalPlate || { status: 'Not Installed' }),
                                  rfidTag: val
                                }
                              }));
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            বিআরটিএ প্লেট সিরিয়াল নম্বর (Smart Plate Serial):
                          </label>
                          <input
                            type="text"
                            placeholder="যেমন: BRTA-PLT-88410"
                            value={editFormData.digitalPlate?.smartPlateSerial || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setEditFormData(prev => ({
                                ...prev,
                                digitalPlate: {
                                  ...(prev.digitalPlate || { status: 'Not Installed' }),
                                  smartPlateSerial: val
                                }
                              }));
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          প্লেট ইনস্টলেশন / ইস্যুর তারিখ:
                        </label>
                        <input
                          type="date"
                          value={editFormData.digitalPlate?.issueDate || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setEditFormData(prev => ({
                              ...prev,
                              digitalPlate: {
                                ...(prev.digitalPlate || { status: 'Not Installed' }),
                                issueDate: val
                              }
                            }));
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>

                      {/* Front and Rear Plate Photos */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                        {/* Front Plate Photo */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            সামনের প্লেটের ছবি (Front Plate):
                          </label>
                          {editFormData.digitalPlate?.frontPhotoUrl ? (
                            <div className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-xl">
                              <img
                                src={editFormData.digitalPlate.frontPhotoUrl}
                                alt="Front Plate"
                                referrerPolicy="no-referrer"
                                className="w-12 h-12 object-cover rounded-lg border"
                              />
                              <div className="flex-1 text-[11px] font-bold text-slate-800">
                                সামনের ছবি আপলোড সম্পন্ন
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveImage('digitalPlate.frontPhotoUrl')}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ) : (
                            <label className="flex items-center justify-center gap-2 p-3 bg-white border border-dashed border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer">
                              <Camera size={16} />
                              <span>সামনের প্লেট ছবি</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageUpload('digitalPlate.frontPhotoUrl', file);
                                }}
                              />
                            </label>
                          )}
                        </div>

                        {/* Rear Plate Photo */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            পেছনের প্লেটের ছবি (Rear Plate):
                          </label>
                          {editFormData.digitalPlate?.rearPhotoUrl ? (
                            <div className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-xl">
                              <img
                                src={editFormData.digitalPlate.rearPhotoUrl}
                                alt="Rear Plate"
                                referrerPolicy="no-referrer"
                                className="w-12 h-12 object-cover rounded-lg border"
                              />
                              <div className="flex-1 text-[11px] font-bold text-slate-800">
                                পেছনের ছবি আপলোড সম্পন্ন
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveImage('digitalPlate.rearPhotoUrl')}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ) : (
                            <label className="flex items-center justify-center gap-2 p-3 bg-white border border-dashed border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer">
                              <Camera size={16} />
                              <span>পেছনের প্লেট ছবি</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageUpload('digitalPlate.rearPhotoUrl', file);
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
                <div className="text-xs text-slate-500">
                  {saveSuccess && (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 size={15} />
                      <span>সফলভাবে সংরক্ষিত হয়েছে!</span>
                    </span>
                  )}
                  {saveError && (
                    <span className="text-red-600 font-bold flex items-center gap-1">
                      <AlertTriangle size={15} />
                      <span>{saveError}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingVehicle(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                  >
                    বাতিল
                  </button>
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="gap-2 shadow-xs"
                  >
                    {isSaving ? (
                      <span>সংরক্ষণ হচ্ছে...</span>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>সংরক্ষণ করুন</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. FULL RESOLUTION PHOTO LIGHTBOX / VIEWER MODAL ("পরবর্তিতে তা দেখা যায়") */}
      <AnimatePresence>
        {previewPhoto && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl text-white"
            >
              {/* Lightbox Header */}
              <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{previewPhoto.title}</span>
                    <span className="font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/30">
                      {previewPhoto.vehiclePlate}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                    {previewPhoto.docNumber && (
                      <span>নম্বর: <span className="font-mono text-slate-200">{previewPhoto.docNumber}</span></span>
                    )}
                    {previewPhoto.expiryDate && (
                      <span>মেয়াদ: <span className="text-slate-200">{previewPhoto.expiryDate}</span></span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={previewPhoto.url}
                    download={`doc_${previewPhoto.vehiclePlate}_${previewPhoto.title}.jpg`}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    title="ডাউনলোড করুন"
                  >
                    <Download size={16} />
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewPhoto(null)}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Lightbox Photo Display */}
              <div className="flex-1 p-4 flex items-center justify-center overflow-auto bg-black/60 min-h-[300px]">
                <img
                  src={previewPhoto.url}
                  alt={previewPhoto.title}
                  referrerPolicy="no-referrer"
                  className="max-h-[65vh] max-w-full object-contain rounded-xl shadow-lg border border-white/10"
                />
              </div>

              {/* Lightbox Footer */}
              <div className="px-5 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>কাগজের মূল ডিজিটাল কপি</span>
                <button
                  type="button"
                  onClick={() => setPreviewPhoto(null)}
                  className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer transition-colors"
                >
                  বন্ধ করুন
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
