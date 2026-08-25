import React, { useState, useEffect, useMemo } from 'react';
import { 
  Radio, 
  Camera, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search, 
  Plus, 
  Filter, 
  Trash2, 
  Edit2, 
  Printer, 
  Download, 
  ExternalLink, 
  RefreshCw, 
  MapPin, 
  FileText, 
  ShieldAlert, 
  Sparkles, 
  Eye, 
  SlidersHorizontal,
  Layers,
  PhoneCall,
  Check
} from 'lucide-react';
import { Card, Button } from './Common';
import { 
  subscribeToCollection, 
  addGPSDevice, 
  updateGPSDevice, 
  deleteGPSDevice,
  GPSDeviceRecord 
} from '../db';
import { cn, sanitizePhoneNumber } from '../lib/utils';
import { useAuth } from '../AuthContext';
import { useSearch } from '../SearchContext';
import { useTheme } from '../ThemeContext';

export const GPSDeviceManagement: React.FC = () => {
  const { isAdmin, isSubAdmin, isChecker, isLineSupervisor, profile, user } = useAuth();
  const { searchQuery } = useSearch();
  const { isEmerald, isCrimson, isAmber, currentThemeOption } = useTheme();
  const canManage = isAdmin || isSubAdmin || isLineSupervisor;

  const [devices, setDevices] = useState<GPSDeviceRecord[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  
  // Filters
  const [activeTab, setActiveTab] = useState<'All' | 'Issues' | 'Offline' | 'Camera' | 'Both' | 'Online'>('Issues');
  const [providerFilter, setProviderFilter] = useState<'All' | 'ADL' | 'BD Tracking'>('All');
  const [durationFilter, setDurationFilter] = useState<'All' | 'critical' | 'medium' | 'short'>('All');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<GPSDeviceRecord | null>(null);
  const [viewingDevice, setViewingDevice] = useState<GPSDeviceRecord | null>(null);
  const [showVendorPrintModal, setShowVendorPrintModal] = useState(false);
  const [selectedVendorForReport, setSelectedVendorForReport] = useState<'ADL' | 'BD Tracking' | 'All'>('All');

  // Form State
  const [formData, setFormData] = useState({
    vehiclePlate: '',
    provider: 'ADL' as 'ADL' | 'BD Tracking',
    deviceId: '',
    simNumber: '',
    gpsStatus: 'Offline' as GPSDeviceRecord['gpsStatus'],
    cameraStatus: 'Damaged' as GPSDeviceRecord['cameraStatus'],
    issueType: 'GPS Offline & Camera Damaged',
    offlineSince: new Date().toISOString().split('T')[0],
    lastKnownLocation: '',
    notes: '',
    vendorNotifyCount: 0,
    actionStatus: 'Active Issue' as GPSDeviceRecord['actionStatus']
  });

  // Calculate Days Offline / Problem Duration
  const calculateDays = (dateStr?: string): number => {
    if (!dateStr) return 0;
    try {
      const start = new Date(dateStr);
      const now = new Date();
      const diffTime = now.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    } catch {
      return 0;
    }
  };

  useEffect(() => {
    const unsubGps = subscribeToCollection('gps_devices', (data: any[]) => {
      setDevices(data as GPSDeviceRecord[]);
    });
    const unsubVehicles = subscribeToCollection('vehicles', setVehicles);

    return () => {
      unsubGps();
      unsubVehicles();
    };
  }, []);

  // Stats calculation
  const stats = useMemo(() => {
    const total = devices.length;
    const adlTotal = devices.filter(d => d.provider === 'ADL').length;
    const bdTrackingTotal = devices.filter(d => d.provider === 'BD Tracking').length;
    
    const offlineGPS = devices.filter(d => d.gpsStatus === 'Offline' || d.gpsStatus === 'No Signal' || d.gpsStatus === 'Power Cut').length;
    const damagedCamera = devices.filter(d => d.cameraStatus === 'Damaged' || d.cameraStatus === 'Offline' || d.cameraStatus === 'No Video' || d.cameraStatus === 'Cable Issue').length;
    const bothIssues = devices.filter(d => 
      (d.gpsStatus === 'Offline' || d.gpsStatus === 'No Signal' || d.gpsStatus === 'Power Cut') && 
      (d.cameraStatus === 'Damaged' || d.cameraStatus === 'Offline' || d.cameraStatus === 'No Video' || d.cameraStatus === 'Cable Issue')
    ).length;
    const activeIssues = devices.filter(d => 
      d.actionStatus === 'Active Issue' || 
      d.actionStatus === 'Complain Lodged' || 
      d.actionStatus === 'Technician Scheduled' ||
      d.gpsStatus === 'Offline' || 
      d.cameraStatus === 'Damaged'
    ).length;
    const criticalOver7Days = devices.filter(d => {
      const isIssue = d.gpsStatus === 'Offline' || d.cameraStatus === 'Damaged' || d.actionStatus !== 'Resolved';
      return isIssue && calculateDays(d.offlineSince) >= 7;
    }).length;
    const onlineAllGood = devices.filter(d => d.gpsStatus === 'Online' && d.cameraStatus === 'OK').length;

    return {
      total,
      adlTotal,
      bdTrackingTotal,
      offlineGPS,
      damagedCamera,
      bothIssues,
      activeIssues,
      criticalOver7Days,
      onlineAllGood
    };
  }, [devices]);

  // Filtered devices
  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      const isGPSOffline = d.gpsStatus === 'Offline' || d.gpsStatus === 'No Signal' || d.gpsStatus === 'Power Cut';
      const isCameraDamaged = d.cameraStatus === 'Damaged' || d.cameraStatus === 'Offline' || d.cameraStatus === 'No Video' || d.cameraStatus === 'Cable Issue';
      const isResolved = d.gpsStatus === 'Online' && d.cameraStatus === 'OK';
      const days = calculateDays(d.offlineSince);

      // Tab Match
      let matchesTab = true;
      if (activeTab === 'Issues') {
        matchesTab = isGPSOffline || isCameraDamaged || d.actionStatus !== 'Resolved';
      } else if (activeTab === 'Offline') {
        matchesTab = isGPSOffline;
      } else if (activeTab === 'Camera') {
        matchesTab = isCameraDamaged;
      } else if (activeTab === 'Both') {
        matchesTab = isGPSOffline && isCameraDamaged;
      } else if (activeTab === 'Online') {
        matchesTab = isResolved;
      }

      // Provider Match
      const matchesProvider = providerFilter === 'All' ? true : d.provider === providerFilter;

      // Duration Match
      let matchesDuration = true;
      if (durationFilter === 'critical') {
        matchesDuration = days >= 7;
      } else if (durationFilter === 'medium') {
        matchesDuration = days >= 3 && days < 7;
      } else if (durationFilter === 'short') {
        matchesDuration = days < 3;
      }

      // Search Query
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        (d.vehiclePlate || '').toLowerCase().includes(q) ||
        (d.provider || '').toLowerCase().includes(q) ||
        (d.deviceId || '').toLowerCase().includes(q) ||
        (d.simNumber || '').toLowerCase().includes(q) ||
        (d.notes || '').toLowerCase().includes(q) ||
        (d.lastKnownLocation || '').toLowerCase().includes(q) ||
        (d.ticketNumber || '').toLowerCase().includes(q) ||
        String(d.vendorNotifyCount || '').includes(q)
      );

      return matchesTab && matchesProvider && matchesDuration && matchesSearch;
    });
  }, [devices, activeTab, providerFilter, durationFilter, searchQuery]);

  const handleOpenAdd = () => {
    setEditingDevice(null);
    setFormData({
      vehiclePlate: vehicles.length > 0 ? vehicles[0].vehicleNumber : '',
      provider: 'ADL',
      deviceId: '',
      simNumber: '',
      gpsStatus: 'Offline',
      cameraStatus: 'Damaged',
      issueType: 'GPS অফলাইন ও ক্যামেরা নষ্ট',
      offlineSince: new Date().toISOString().split('T')[0],
      lastKnownLocation: '',
      notes: '',
      vendorNotifyCount: 0,
      actionStatus: 'Active Issue'
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (dev: GPSDeviceRecord) => {
    setEditingDevice(dev);
    setFormData({
      vehiclePlate: dev.vehiclePlate || '',
      provider: dev.provider || 'ADL',
      deviceId: dev.deviceId || '',
      simNumber: dev.simNumber || '',
      gpsStatus: dev.gpsStatus || 'Offline',
      cameraStatus: dev.cameraStatus || 'Damaged',
      issueType: dev.issueType || 'GPS অফলাইন',
      offlineSince: dev.offlineSince || new Date().toISOString().split('T')[0],
      lastKnownLocation: dev.lastKnownLocation || '',
      notes: dev.notes || '',
      vendorNotifyCount: dev.vendorNotifyCount !== undefined ? dev.vendorNotifyCount : 0,
      actionStatus: dev.actionStatus || 'Active Issue'
    });
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehiclePlate.trim()) {
      alert('অনুগ্রহ করে গাড়ির নম্বর প্রদান করুন।');
      return;
    }

    const matchedVeh = vehicles.find(v => v.vehicleNumber.toUpperCase() === formData.vehiclePlate.trim().toUpperCase());
    const vehicleId = matchedVeh ? matchedVeh.id : formData.vehiclePlate.trim().toUpperCase();

    const payload: GPSDeviceRecord = {
      vehicleId,
      vehiclePlate: formData.vehiclePlate.trim().toUpperCase(),
      provider: formData.provider,
      deviceId: formData.deviceId.trim(),
      simNumber: formData.simNumber.trim(),
      gpsStatus: formData.gpsStatus,
      cameraStatus: formData.cameraStatus,
      issueType: formData.issueType.trim(),
      offlineSince: formData.offlineSince,
      lastKnownLocation: formData.lastKnownLocation.trim(),
      notes: formData.notes.trim(),
      vendorNotifyCount: Math.max(0, Number(formData.vendorNotifyCount) || 0),
      actionStatus: formData.actionStatus
    };

    if (formData.actionStatus === 'Resolved' || (formData.gpsStatus === 'Online' && formData.cameraStatus === 'OK')) {
      payload.resolvedDate = new Date().toISOString().split('T')[0];
    }

    if (editingDevice && editingDevice.id) {
      await updateGPSDevice(editingDevice.id, payload, profile);
    } else {
      await addGPSDevice(payload, profile);
    }

    setShowAddModal(false);
    setEditingDevice(null);
  };

  const handleQuickResolve = async (dev: GPSDeviceRecord) => {
    if (!dev.id) return;
    const confirm = window.confirm(`গাড়ি ${dev.vehiclePlate}-এর GPS ও ক্যামেরা কি সচল (Online & OK) হয়েছে?`);
    if (!confirm) return;

    await updateGPSDevice(dev.id, {
      gpsStatus: 'Online',
      cameraStatus: 'OK',
      actionStatus: 'Resolved',
      resolvedDate: new Date().toISOString().split('T')[0],
      notes: (dev.notes ? dev.notes + ' | ' : '') + `সমাধান হয়েছে: ${new Date().toLocaleDateString('bn-BD')}`
    }, profile);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('আপনি কি নিশ্চিত যে এই GPS ডিভাইস রেকর্ডটি ডিলিট করতে চান?')) return;
    await deleteGPSDevice(id);
    if (viewingDevice?.id === id) setViewingDevice(null);
  };

  // Printable report for ADL / BD Tracking vendor support
  const handlePrintVendorReport = (vendor: 'ADL' | 'BD Tracking' | 'All') => {
    const listToPrint = devices.filter(d => {
      const isVendorMatch = vendor === 'All' ? true : d.provider === vendor;
      const isIssue = d.gpsStatus === 'Offline' || d.cameraStatus === 'Damaged' || d.actionStatus !== 'Resolved';
      return isVendorMatch && isIssue;
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const vendorName = vendor === 'All' ? 'ADL & BD Tracking' : vendor;

    printWindow.document.write(`
      <html>
        <head>
          <title>GPS ও ক্যামেরা সার্ভিস রিকুইজিশন - ${vendorName}</title>
          <style>
            body { font-family: 'Hind Siliguri', 'Segoe UI', Arial, sans-serif; padding: 25px; color: #0f172a; font-size: 12px; line-height: 1.4; }
            .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
            .header h1 { font-size: 19px; margin: 0; }
            .header p { margin: 3px 0 0; color: #64748b; font-size: 11px; }
            .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; display: flex; justify-content: space-between; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
            th { background: #f1f5f9; font-weight: 700; font-size: 11px; text-transform: uppercase; color: #334155; }
            .badge-crit { background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px; }
            .badge-warn { background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px; }
            .badge-prov { background: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px; }
            .footer { margin-top: 50px; display: flex; justify-content: space-between; font-size: 11px; }
            .sig { border-top: 1px dashed #94a3b8; width: 150px; text-align: center; padding-top: 6px; }
            @media print { .no-print { display: none !important; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>GPS ট্র্যাকার ও ড্যাশক্যাম ক্যামেরা মেরামত রিকুইজিশন</h1>
            <p>FleetFlow Pro • সার্ভিস পার্টনার: <strong>${vendorName}</strong> • তারিখ: ${new Date().toLocaleDateString('bn-BD')}</p>
          </div>

          <div class="meta-box">
            <div>
              <strong>কোম্পানি / সার্ভিস পার্টনার:</strong> ${vendorName}<br/>
              <strong>মোট সমস্যাযুক্ত গাড়ি:</strong> ${listToPrint.length} টি
            </div>
            <div style="text-align: right;">
              <strong>প্রিন্ট সময়:</strong> ${new Date().toLocaleTimeString('bn-BD')}<br/>
              <strong>রিপোর্ট প্রস্তুতকারী:</strong> ${profile?.displayName || user?.displayName || 'ফ্লিট ইনচার্জ'}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th>গাড়ির নম্বর</th>
                <th>প্রোভাইডার</th>
                <th>ডিভাইস আইডি / সিম</th>
                <th>জিপিএস স্ট্যাটাস</th>
                <th>ক্যামেরা স্ট্যাটাস</th>
                <th>কতোদিন অফলাইন</th>
                <th>ভেন্ডারকে জানানো</th>
                <th>সমস্যার ধরন ও মন্তব্য</th>
              </tr>
            </thead>
            <tbody>
              ${listToPrint.map((item, idx) => {
                const days = calculateDays(item.offlineSince);
                const notified = item.vendorNotifyCount || 0;
                return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td style="font-weight: bold; font-size: 13px;">${item.vehiclePlate}</td>
                    <td><span class="badge-prov">${item.provider}</span></td>
                    <td>${item.deviceId || 'N/A'}<br/><small style="color: #64748b;">${item.simNumber || ''}</small></td>
                    <td>${item.gpsStatus === 'Offline' ? '<span class="badge-crit">অফলাইন</span>' : item.gpsStatus}</td>
                    <td>${item.cameraStatus === 'Damaged' ? '<span class="badge-crit">নষ্ট / Faulty</span>' : item.cameraStatus}</td>
                    <td>
                      <span class="${days >= 7 ? 'badge-crit' : 'badge-warn'}">
                        ${days} দিন (${item.offlineSince || 'N/A'})
                      </span>
                    </td>
                    <td>
                      <span class="${notified >= 3 ? 'badge-crit' : notified >= 1 ? 'badge-warn' : ''}">
                        ${notified === 0 ? '০ বার' : `${notified} বার`}
                      </span>
                    </td>
                    <td>
                      <strong>${item.issueType || 'ইস্যু'}</strong><br/>
                      <small style="color: #475569;">${item.notes || item.lastKnownLocation || 'দ্রুত মেরামত প্রয়োজন'}</small>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="footer">
            <div class="sig">ফ্লিট ইনভেস্টিগেটর / অফিসার</div>
            <div class="sig">${vendorName} টেকনিশিয়ান স্বাক্ষর</div>
            <div class="sig">কর্তৃপক্ষের চূড়ান্ত অনুমোদন</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className={cn(
        "p-4 sm:p-5 rounded-2xl border shadow-xs flex items-center justify-between gap-4 flex-wrap",
        isEmerald 
          ? "bg-gradient-to-r from-[#e8f7f2] via-[#d3f1e7] to-white border-[#b5e7d8]"
          : isCrimson
          ? "bg-gradient-to-r from-[#fff1f2] via-[#ffe4e6] to-white border-[#fecdd3]"
          : isAmber
          ? "bg-gradient-to-r from-[#fffbeb] via-[#fef3c7] to-white border-[#fde68a]"
          : "bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-white border-blue-100"
      )}>
        <div className="flex items-center gap-3.5">
          <div className={cn(
            "w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-md font-bold shrink-0 bg-gradient-to-br",
            currentThemeOption.previewGradient
          )}>
            <Radio size={24} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                GPS Device ও ক্যামেরা মনিটরিং
              </h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-600 text-white shadow-2xs">
                <span>ADL & BD Tracking</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              কোন গাড়ির GPS ক্যামেরা নষ্ট বা অফলাইন এবং কতোদিন থেকে রয়েছে তার লাইভ ট্র্যাকিং ও ভেন্ডর রিপোর্ট
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="secondary"
            onClick={() => handlePrintVendorReport(providerFilter)}
            className="flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            <Printer size={15} />
            <span>ভেন্ডর রিপোর্ট প্রিন্ট</span>
          </Button>

          {canManage && (
            <Button 
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold shadow-sm"
            >
              <Plus size={16} />
              <span>নতুন GPS / সমস্যা এন্ট্রি</span>
            </Button>
          )}
        </div>
      </div>

      {/* Analytics KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Devices */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">মোট জিপিএস</span>
            <Radio size={16} className="text-slate-400" />
          </div>
          <p className="text-xl font-black text-slate-900 mt-1 font-mono">{stats.total}</p>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400">
            <span>ADL: {stats.adlTotal}</span> • <span>BDT: {stats.bdTrackingTotal}</span>
          </div>
        </div>

        {/* Offline GPS */}
        <div className="bg-white p-3.5 rounded-2xl border border-rose-200/80 bg-rose-50/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">GPS অফলাইন</span>
            <ShieldAlert size={16} className="text-rose-500 animate-bounce" />
          </div>
          <p className="text-xl font-black text-rose-600 mt-1 font-mono">{stats.offlineGPS}</p>
          <span className="text-[10px] font-semibold text-rose-600/80">সিগন্যাল বিহীন / অফলাইন</span>
        </div>

        {/* Damaged Camera */}
        <div className="bg-white p-3.5 rounded-2xl border border-amber-200/80 bg-amber-50/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">ক্যামেরা নষ্ট</span>
            <Camera size={16} className="text-amber-600" />
          </div>
          <p className="text-xl font-black text-amber-600 mt-1 font-mono">{stats.damagedCamera}</p>
          <span className="text-[10px] font-semibold text-amber-700/80">ভিডিও নষ্ট বা লেন্স সমস্যা</span>
        </div>

        {/* Both Broken */}
        <div className="bg-white p-3.5 rounded-2xl border border-purple-200/80 bg-purple-50/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">উভয় সমস্যা</span>
            <Layers size={16} className="text-purple-600" />
          </div>
          <p className="text-xl font-black text-purple-700 mt-1 font-mono">{stats.bothIssues}</p>
          <span className="text-[10px] font-semibold text-purple-600/80">GPS ও ক্যামেরা উভয়ই নষ্ট</span>
        </div>

        {/* Critical Duration >7 Days */}
        <div className="bg-white p-3.5 rounded-2xl border border-red-300 bg-red-50/40 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-red-700 uppercase tracking-wider">&gt; ৭ দিন অফলাইন</span>
            <Clock size={16} className="text-red-600 animate-pulse" />
          </div>
          <p className="text-xl font-black text-red-700 mt-1 font-mono">{stats.criticalOver7Days}</p>
          <span className="text-[10px] font-bold text-red-600">জরুরি ভেন্ডর সার্ভিস প্রয়োজন</span>
        </div>

        {/* Online All Good */}
        <div className="bg-white p-3.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">সচল (Online)</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <p className="text-xl font-black text-emerald-600 mt-1 font-mono">{stats.onlineAllGood}</p>
          <span className="text-[10px] font-semibold text-emerald-700/80">সম্পূর্ণ চালু ও সুস্থ</span>
        </div>
      </div>

      {/* Two Company Badges Quick Action & Info Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* ADL Company Box */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all flex items-center justify-between",
          providerFilter === 'ADL' 
            ? "border-blue-500 bg-blue-50/60 shadow-sm" 
            : "border-slate-200 bg-white hover:border-slate-300"
        )}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
              ADL
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">ADL Tracking System</h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                  {stats.adlTotal} টি গাড়ি
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                অফলাইন: <strong className="text-rose-600">{devices.filter(d => d.provider === 'ADL' && (d.gpsStatus === 'Offline' || d.cameraStatus === 'Damaged')).length} টি</strong> • 
                ক্যামেরা নষ্ট: <strong className="text-amber-600">{devices.filter(d => d.provider === 'ADL' && d.cameraStatus === 'Damaged').length} টি</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setProviderFilter(providerFilter === 'ADL' ? 'All' : 'ADL')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                providerFilter === 'ADL' ? "bg-blue-600 text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              {providerFilter === 'ADL' ? 'ফিল্টার সক্রিয়' : 'ADL দেখুন'}
            </button>
          </div>
        </div>

        {/* BD Tracking Company Box */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all flex items-center justify-between",
          providerFilter === 'BD Tracking' 
            ? "border-indigo-500 bg-indigo-50/60 shadow-sm" 
            : "border-slate-200 bg-white hover:border-slate-300"
        )}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
              BDT
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">BD Tracking (বিডি ট্র্যাকিং)</h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                  {stats.bdTrackingTotal} টি গাড়ি
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                অফলাইন: <strong className="text-rose-600">{devices.filter(d => d.provider === 'BD Tracking' && (d.gpsStatus === 'Offline' || d.cameraStatus === 'Damaged')).length} টি</strong> • 
                ক্যামেরা নষ্ট: <strong className="text-amber-600">{devices.filter(d => d.provider === 'BD Tracking' && d.cameraStatus === 'Damaged').length} টি</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setProviderFilter(providerFilter === 'BD Tracking' ? 'All' : 'BD Tracking')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                providerFilter === 'BD Tracking' ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              {providerFilter === 'BD Tracking' ? 'ফিল্টার সক্রিয়' : 'BD Tracking দেখুন'}
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Tab Section */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-100">
          {[
            { id: 'Issues', label: 'সমস্যাযুক্ত গাড়ি (Active Issues)', count: stats.activeIssues, alert: true },
            { id: 'Offline', label: 'GPS অফলাইন', count: stats.offlineGPS },
            { id: 'Camera', label: 'ক্যামেরা নষ্ট (Camera Damaged)', count: stats.damagedCamera },
            { id: 'Both', label: 'উভয় নষ্ট (GPS & Camera)', count: stats.bothIssues },
            { id: 'Online', label: 'সকল সচল (Online & OK)', count: stats.onlineAllGood },
            { id: 'All', label: 'সবগুলো ডিভাইস (All)', count: stats.total }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5",
                activeTab === tab.id 
                  ? "bg-slate-900 text-white shadow-xs" 
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <span>{tab.label}</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black",
                activeTab === tab.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Secondary Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Provider Filter */}
          <div className="w-48">
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value as any)}
              className="w-full text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-slate-800"
            >
              <option value="All">সকল প্রোভাইডার (ADL & BD Tracking)</option>
              <option value="ADL">ADL Tracking</option>
              <option value="BD Tracking">BD Tracking</option>
            </select>
          </div>

          {/* Duration Filter */}
          <div className="w-52">
            <select
              value={durationFilter}
              onChange={(e) => setDurationFilter(e.target.value as any)}
              className="w-full text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-slate-800"
            >
              <option value="All">সকল সময়কাল (All Durations)</option>
              <option value="critical">🚨 ৭ দিনের বেশি অফলাইন (&gt; 7 Days)</option>
              <option value="medium">⚠️ ৩ থেকে ৭ দিন (3 - 7 Days)</option>
              <option value="short">ℹ️ ১ থেকে ২ দিন (1 - 2 Days)</option>
            </select>
          </div>

          {/* Quick Active Issues Count Pill */}
          <div className="ml-auto text-xs font-medium text-slate-500">
            দেখানো হচ্ছে: <strong className="text-slate-800 font-mono">{filteredDevices.length}</strong> টি গাড়ি
          </div>
        </div>
      </div>

      {/* GPS Devices List / Table View */}
      {filteredDevices.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 shadow-2xs">
          <Radio size={42} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-base font-bold text-slate-700">কোন GPS ডিভাইস রেকর্ড পাওয়া যায়নি</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            উপরে 'নতুন GPS / সমস্যা এন্ট্রি' বাটনে ক্লিক করে গাড়ির GPS ও ক্যামেরা স্ট্যাটাস যুক্ত করুন।
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map((dev) => {
            const isGPSOffline = dev.gpsStatus === 'Offline' || dev.gpsStatus === 'No Signal' || dev.gpsStatus === 'Power Cut';
            const isCameraDamaged = dev.cameraStatus === 'Damaged' || dev.cameraStatus === 'Offline' || dev.cameraStatus === 'No Video' || dev.cameraStatus === 'Cable Issue';
            const isResolved = dev.gpsStatus === 'Online' && dev.cameraStatus === 'OK';
            const days = calculateDays(dev.offlineSince);
            const isCritical = (isGPSOffline || isCameraDamaged) && days >= 7;

            return (
              <div 
                key={dev.id || dev.vehiclePlate}
                className={cn(
                  "bg-white rounded-2xl border transition-all p-4 flex flex-col justify-between shadow-2xs hover:shadow-xs relative overflow-hidden",
                  isCritical 
                    ? "border-red-300 bg-red-50/10" 
                    : isGPSOffline || isCameraDamaged 
                    ? "border-amber-300/80 bg-amber-50/10" 
                    : "border-slate-200/90"
                )}
              >
                {/* Critical badge indicator stripe */}
                {isCritical && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 animate-pulse" />
                )}

                <div>
                  {/* Top Bar: Plate, Provider & Duration */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-slate-900 text-white font-black font-mono text-xs rounded-lg shadow-2xs">
                        {dev.vehiclePlate}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider",
                        dev.provider === 'ADL' ? "bg-blue-100 text-blue-800 border border-blue-200" : "bg-indigo-100 text-indigo-800 border border-indigo-200"
                      )}>
                        {dev.provider}
                      </span>
                    </div>

                    {/* Offline Duration Badge ("কতোদিন থেকে রয়েছে") */}
                    {(isGPSOffline || isCameraDamaged) ? (
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1 border shadow-2xs",
                        days >= 7 
                          ? "bg-red-100 text-red-700 border-red-300 animate-pulse" 
                          : days >= 3 
                          ? "bg-amber-100 text-amber-800 border-amber-300" 
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      )}>
                        <Clock size={11} />
                        <span>{days === 0 ? 'আজকে থেকে' : `${days} দিন যাবত`}</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                        সচল (Online)
                      </span>
                    )}
                  </div>

                  {/* Status Grid: GPS Status & Camera Status */}
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {/* GPS Status Box */}
                    <div className={cn(
                      "p-2.5 rounded-xl border flex flex-col justify-between",
                      isGPSOffline ? "bg-rose-50/80 border-rose-200 text-rose-900" : "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                    )}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">GPS ট্র্যাকার</span>
                        <Radio size={13} className={isGPSOffline ? "text-rose-600 animate-pulse" : "text-emerald-600"} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          isGPSOffline ? "bg-rose-600 animate-ping" : "bg-emerald-500"
                        )} />
                        <span className="text-xs font-black">
                          {dev.gpsStatus === 'Offline' ? 'অফলাইন (Offline)' : dev.gpsStatus === 'No Signal' ? 'সিগন্যাল নেই' : dev.gpsStatus === 'Power Cut' ? 'পাওয়ার কাটা' : 'অনলাইন (Online)'}
                        </span>
                      </div>
                    </div>

                    {/* Camera Status Box */}
                    <div className={cn(
                      "p-2.5 rounded-xl border flex flex-col justify-between",
                      isCameraDamaged ? "bg-amber-50/80 border-amber-200 text-amber-900" : "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                    )}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">ড্যাশক্যাম ক্যামেরা</span>
                        <Camera size={13} className={isCameraDamaged ? "text-amber-600" : "text-emerald-600"} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          isCameraDamaged ? "bg-amber-600" : "bg-emerald-500"
                        )} />
                        <span className="text-xs font-black">
                          {dev.cameraStatus === 'Damaged' ? 'ক্যামেরা নষ্ট (Damaged)' : dev.cameraStatus === 'No Video' ? 'ভিডিও নেই' : dev.cameraStatus === 'Cable Issue' ? 'ক্যাবল সমস্যা' : dev.cameraStatus === 'Not Installed' ? 'সংযুক্ত নয়' : 'সচল (Working OK)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Device Specs & Location Details */}
                  <div className="mt-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1 text-xs">
                    {dev.deviceId && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[11px]">ডিভাইস আইডি:</span>
                        <span className="font-mono font-bold text-slate-800">{dev.deviceId}</span>
                      </div>
                    )}
                    {dev.simNumber && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[11px]">সিম নম্বর:</span>
                        <span className="font-mono font-medium text-slate-700">{dev.simNumber}</span>
                      </div>
                    )}
                    {dev.offlineSince && (isGPSOffline || isCameraDamaged) && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[11px]">শুরুর তারিখ:</span>
                        <span className="font-medium text-slate-700 font-mono">{dev.offlineSince} ({days} দিন)</span>
                      </div>
                    )}
                    {dev.lastKnownLocation && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[11px]">সর্বশেষ লোকেশন:</span>
                        <span className="font-medium text-slate-800 truncate max-w-[140px]">{dev.lastKnownLocation}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-slate-200/60 pt-1.5 mt-1">
                      <span className="text-slate-600 text-[11px] font-semibold flex items-center gap-1.5">
                        <PhoneCall size={12} className="text-slate-400" />
                        <span>ভেন্ডারকে জানানো হয়েছে:</span>
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-[11px] font-bold font-mono",
                        (dev.vendorNotifyCount || 0) >= 3 
                          ? "bg-rose-100 text-rose-800 border border-rose-200" 
                          : (dev.vendorNotifyCount || 0) >= 1 
                          ? "bg-amber-100 text-amber-800 border border-amber-200" 
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      )}>
                        {(dev.vendorNotifyCount || 0) === 0 ? '০ বার (জানানো হয়নি)' : `${dev.vendorNotifyCount} বার`}
                      </span>
                    </div>
                  </div>

                  {/* Notes / Remarks */}
                  {dev.notes && (
                    <div className="mt-2 text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-100 line-clamp-2">
                      <span className="font-bold text-slate-700">মন্তব্য: </span>
                      {dev.notes}
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    {canManage && (
                      <button
                        onClick={() => handleOpenEdit(dev)}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        title="এডিট করুন"
                      >
                        <Edit2 size={15} />
                      </button>
                    )}
                    {canManage && dev.id && (
                      <button
                        onClick={() => handleDelete(dev.id!)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                        title="ডিলিট করুন"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  {canManage && (isGPSOffline || isCameraDamaged) && (
                    <button
                      onClick={() => handleQuickResolve(dev)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1 active:scale-95"
                    >
                      <Check size={13} />
                      <span>সচল চিহ্নিত করুন (Resolve)</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit GPS Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full my-auto overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <Radio size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingDevice ? 'GPS ডিভাইস ও সমস্যা এডিট করুন' : 'নতুন GPS ও ক্যামেরা এন্ট্রি'}
                  </h3>
                  <p className="text-[11px] text-slate-500">ADL বা BD Tracking ডিভাইসের স্ট্যাটাস সংরক্ষণ করুন</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Vehicle Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">গাড়ির নম্বর *</label>
                  <select
                    value={formData.vehiclePlate}
                    onChange={(e) => setFormData({ ...formData, vehiclePlate: e.target.value })}
                    required
                    className="w-full text-xs font-semibold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                  >
                    <option value="">গাড়ি নির্বাচন করুন</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.vehicleNumber}>
                        {v.vehicleNumber} ({v.type || 'Vehicle'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Provider Company */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">GPS কোম্পানি / ভেন্ডর *</label>
                  <select
                    value={formData.provider}
                    onChange={(e) => setFormData({ ...formData, provider: e.target.value as any })}
                    required
                    className="w-full text-xs font-bold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-blue-700"
                  >
                    <option value="ADL">ADL (ADL Tracking)</option>
                    <option value="BD Tracking">BD Tracking (বিডি ট্র্যাকিং)</option>
                  </select>
                </div>
              </div>

              {/* Device ID and SIM */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ডিভাইস আইডি / IMEI</label>
                  <input
                    type="text"
                    placeholder="যেমন: ADL-88239 / BDT-109"
                    value={formData.deviceId}
                    onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                    className="w-full text-xs font-mono font-medium px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">সিম কার্ড নম্বর (সর্বোচ্চ ১১ ডিজিট)</label>
                  <input
                    type="tel"
                    maxLength={11}
                    placeholder="যেমন: 01712345678"
                    value={formData.simNumber}
                    onChange={(e) => setFormData({ ...formData, simNumber: sanitizePhoneNumber(e.target.value) })}
                    className="w-full text-xs font-mono font-medium px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Status Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                {/* GPS Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">GPS ট্র্যাকার স্ট্যাটাস *</label>
                  <select
                    value={formData.gpsStatus}
                    onChange={(e) => setFormData({ ...formData, gpsStatus: e.target.value as any })}
                    required
                    className="w-full text-xs font-bold px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                  >
                    <option value="Offline">🚨 অফলাইন (Offline)</option>
                    <option value="Online">🟢 সচল / অনলাইন (Online)</option>
                    <option value="No Signal">⚠️ সিগন্যাল নেই (No Signal)</option>
                    <option value="Power Cut">🔌 পাওয়ার বিচ্ছিন্ন (Power Cut)</option>
                  </select>
                </div>

                {/* Camera Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ড্যাশক্যাম ক্যামেরা স্ট্যাটাস *</label>
                  <select
                    value={formData.cameraStatus}
                    onChange={(e) => setFormData({ ...formData, cameraStatus: e.target.value as any })}
                    required
                    className="w-full text-xs font-bold px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                  >
                    <option value="Damaged">🚨 ক্যামেরা নষ্ট (Damaged)</option>
                    <option value="OK">🟢 সচল (Working OK)</option>
                    <option value="Offline">⚠️ ক্যামেরা অফলাইন (Offline)</option>
                    <option value="No Video">📹 ভিডিও শো করছে না (No Video)</option>
                    <option value="Cable Issue">🔌 ক্যাবল / লেন্স ত্রুটি</option>
                    <option value="Not Installed">সংযুক্ত নেই (Not Installed)</option>
                  </select>
                </div>
              </div>

              {/* Offline Since Date ("কতোদিন থেকে রয়েছে") */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    অফলাইন / সমস্যা শুরুর তারিখ *
                  </label>
                  <input
                    type="date"
                    value={formData.offlineSince}
                    onChange={(e) => setFormData({ ...formData, offlineSince: e.target.value })}
                    required
                    className="w-full text-xs font-medium px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    বর্তমান দিন গণনা: <strong>{calculateDays(formData.offlineSince)} দিন</strong>
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">সর্বশেষ জ্ঞাত লোকেশন</label>
                  <input
                    type="text"
                    placeholder="যেমন: তেজগাঁও ডিপো / গাজীপুর"
                    value={formData.lastKnownLocation}
                    onChange={(e) => setFormData({ ...formData, lastKnownLocation: e.target.value })}
                    className="w-full text-xs font-medium px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Action & Vendor Notification Count */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">পদক্ষেপ / অ্যাকশন স্ট্যাটাস</label>
                  <select
                    value={formData.actionStatus}
                    onChange={(e) => setFormData({ ...formData, actionStatus: e.target.value as any })}
                    className="w-full text-xs font-semibold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                  >
                    <option value="Active Issue">🚨 অ্যাক্টিভ সমস্যা (Active Issue)</option>
                    <option value="Complain Lodged">📞 ভেন্ডরকে জানানো হয়েছে (Complain Lodged)</option>
                    <option value="Technician Scheduled">🔧 টেকনিশিয়ান শিডিউল হয়েছে</option>
                    <option value="Resolved">🟢 সমাধান হয়েছে (Resolved)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <PhoneCall size={13} className="text-blue-600" />
                      <span>ভেন্ডারকে কতোবার জানানো হয়েছে</span>
                    </label>
                    <span className="text-[10px] font-bold text-slate-500 font-mono">
                      {formData.vendorNotifyCount || 0} বার
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, vendorNotifyCount: Math.max(0, (Number(prev.vendorNotifyCount) || 0) - 1) }))}
                      className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center border border-slate-200 text-base active:scale-95 transition-all"
                      title="১ কমান"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={formData.vendorNotifyCount}
                      onChange={(e) => setFormData({ ...formData, vendorNotifyCount: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="flex-1 text-center font-mono font-black text-sm py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, vendorNotifyCount: (Number(prev.vendorNotifyCount) || 0) + 1 }))}
                      className="w-9 h-9 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold flex items-center justify-center border border-blue-200 text-base active:scale-95 transition-all"
                      title="১ বাড়ান"
                    >
                      +
                    </button>
                  </div>
                  {/* Quick Select Preset Buttons */}
                  <div className="flex items-center gap-1.5 mt-1.5 overflow-x-auto pb-0.5">
                    {[0, 1, 2, 3, 5].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setFormData({ ...formData, vendorNotifyCount: cnt })}
                        className={cn(
                          "px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all shrink-0",
                          (Number(formData.vendorNotifyCount) || 0) === cnt
                            ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        {cnt === 0 ? '০ বার' : `${cnt} বার`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notes & Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">বিস্তারিত সমস্যা ও মন্তব্য</label>
                <textarea
                  rows={2}
                  placeholder="যেমন: ক্যামেরা লেন্স ভেঙে গেছে, জিপিএস ৩ দিন ধরে পাওয়ার পাচ্ছে না..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={() => setShowAddModal(false)}
                  className="text-xs"
                >
                  বাতিল
                </Button>
                <Button 
                  type="submit" 
                  className="text-xs font-bold px-5"
                >
                  {editingDevice ? 'আপডেট করুন' : 'সংরক্ষণ করুন'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
