import React, { useState, useEffect, useRef } from 'react';
import { 
  History, 
  Download, 
  Filter, 
  Search, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  Edit3, 
  X, 
  Save, 
  Printer, 
  CheckSquare, 
  Square, 
  AlertCircle, 
  Layers, 
  Check 
} from 'lucide-react';
import { Card, Button } from './components/Common';
import { 
  subscribeToCollection, 
  resolveMissingReport, 
  deleteMissingReport, 
  deleteTrip, 
  deleteMultipleTrips, 
  deleteMissingReportHistory,
  deleteMultipleMissingReportHistory,
  updateTrip 
} from './db';
import { cn } from './lib/utils';
import { useAuth } from './AuthContext';
import { useSearch } from './SearchContext';
import { downloadCSV, exportPDFWindow } from './utils/exportUtils';

const Reports: React.FC = () => {
  const { isAdmin, isSubAdmin, isChecker, profile } = useAuth();
  const { searchQuery, setSearchQuery } = useSearch();
  const canManageReports = isAdmin;
  const canResolveReports = isAdmin || isSubAdmin || isChecker;
  const [trips, setTrips] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [missingReports, setMissingReports] = useState<any[]>([]);
  const [missingHistory, setMissingHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'Archive' | 'Missing' | 'History'>('Archive');
  const [filter, setFilter] = useState('All');
  const [historyFilter, setHistoryFilter] = useState('All');

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setSearchTerm(searchQuery);
  }, [searchQuery]);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);

  // Selection & Bulk Deletion States for Transport Archive
  const [selectedTripIds, setSelectedTripIds] = useState<string[]>([]);
  
  // Selection & Bulk Deletion States for Report History
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);

  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'trips' | 'history';
    target: 'single' | 'selected' | 'filtered' | 'all';
    singleId?: string;
    singleTitle?: string;
    count: number;
  }>({
    isOpen: false,
    type: 'trips',
    target: 'selected',
    count: 0
  });

  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const historySelectAllRef = useRef<HTMLInputElement | null>(null);

  const handleResolve = async (id: string) => {
    try {
      setResolvingId(id);
      await resolveMissingReport(id, profile);
      alert('সফলভাবে সমাধান করা হয়েছে এবং রেকর্ডটি ইতিহাসে সংরক্ষিত হয়েছে।');
    } catch (e: any) {
      console.error("Resolve failed:", e);
      alert("সমাধান করা সম্ভব হয়নি। দয়া করে পুনরায় চেষ্টা করুন।");
    } finally {
      setResolvingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      await deleteMissingReport(id);
    } catch (e: any) {
      console.error("Delete failed:", e);
      alert("মুছে ফেলা সম্ভব হয়নি। দয়া করে পুনরায় চেষ্টা করুন।");
    } finally {
      setDeletingId(null);
    }
  };

  // --- Transport Archive Delete Triggers ---
  const handleTriggerSingleTripDelete = (trip: any) => {
    setDeleteModal({
      isOpen: true,
      type: 'trips',
      target: 'single',
      singleId: trip.id,
      singleTitle: trip.vehiclePlate || trip.vehicleId || 'Unknown',
      count: 1
    });
  };

  const handleTriggerSelectedDelete = () => {
    if (selectedTripIds.length === 0) {
      alert('দয়া করে প্রথমে মুছে ফেলার জন্য ট্রিপ রেকর্ড নির্বাচন করুন।');
      return;
    }
    setDeleteModal({
      isOpen: true,
      type: 'trips',
      target: 'selected',
      count: selectedTripIds.length
    });
  };

  const handleTriggerFilteredDelete = () => {
    if (filteredTrips.length === 0) {
      alert('বর্তমান ফিল্টারে মুছে ফেলার মতো কোনো ট্রিপ রেকর্ড নেই।');
      return;
    }
    setDeleteModal({
      isOpen: true,
      type: 'trips',
      target: 'filtered',
      count: filteredTrips.length
    });
  };

  const handleTriggerAllDelete = () => {
    if (trips.length === 0) {
      alert('আর্কাইভে কোনো ট্রিপ রেকর্ড নেই।');
      return;
    }
    setDeleteModal({
      isOpen: true,
      type: 'trips',
      target: 'all',
      count: trips.length
    });
  };

  // --- Report History Delete Triggers ---
  const handleTriggerSingleHistoryDelete = (report: any) => {
    setDeleteModal({
      isOpen: true,
      type: 'history',
      target: 'single',
      singleId: report.id,
      singleTitle: `${report.vehiclePlate || 'Unknown'} (${report.driverName || 'Unknown'})`,
      count: 1
    });
  };

  const handleTriggerSelectedHistoryDelete = () => {
    if (selectedHistoryIds.length === 0) {
      alert('দয়া করে প্রথমে মুছে ফেলার জন্য রিপোর্ট হিস্ট্রি রেকর্ড নির্বাচন করুন।');
      return;
    }
    setDeleteModal({
      isOpen: true,
      type: 'history',
      target: 'selected',
      count: selectedHistoryIds.length
    });
  };

  const handleTriggerFilteredHistoryDelete = () => {
    if (filteredHistory.length === 0) {
      alert('বর্তমান ফিল্টারে মুছে ফেলার মতো কোনো হিস্ট্রি রেকর্ড নেই।');
      return;
    }
    setDeleteModal({
      isOpen: true,
      type: 'history',
      target: 'filtered',
      count: filteredHistory.length
    });
  };

  const handleTriggerAllHistoryDelete = () => {
    if (missingHistory.length === 0) {
      alert('রিপোর্ট হিস্ট্রিতে কোনো রেকর্ড নেই।');
      return;
    }
    setDeleteModal({
      isOpen: true,
      type: 'history',
      target: 'all',
      count: missingHistory.length
    });
  };

  const handleConfirmExecuteDelete = async () => {
    setIsDeletingBulk(true);
    try {
      if (deleteModal.type === 'trips') {
        if (deleteModal.target === 'single' && deleteModal.singleId) {
          await deleteTrip(deleteModal.singleId);
          setSelectedTripIds(prev => prev.filter(id => id !== deleteModal.singleId));
        } else if (deleteModal.target === 'selected') {
          await deleteMultipleTrips(selectedTripIds);
          setSelectedTripIds([]);
        } else if (deleteModal.target === 'filtered') {
          const ids = filteredTrips.map(t => t.id);
          await deleteMultipleTrips(ids);
          setSelectedTripIds(prev => prev.filter(id => !ids.includes(id)));
        } else if (deleteModal.target === 'all') {
          const ids = trips.map(t => t.id);
          await deleteMultipleTrips(ids);
          setSelectedTripIds([]);
        }
      } else if (deleteModal.type === 'history') {
        if (deleteModal.target === 'single' && deleteModal.singleId) {
          await deleteMissingReportHistory(deleteModal.singleId);
          setSelectedHistoryIds(prev => prev.filter(id => id !== deleteModal.singleId));
        } else if (deleteModal.target === 'selected') {
          await deleteMultipleMissingReportHistory(selectedHistoryIds);
          setSelectedHistoryIds([]);
        } else if (deleteModal.target === 'filtered') {
          const ids = filteredHistory.map(h => h.id);
          await deleteMultipleMissingReportHistory(ids);
          setSelectedHistoryIds(prev => prev.filter(id => !ids.includes(id)));
        } else if (deleteModal.target === 'all') {
          const ids = missingHistory.map(h => h.id);
          await deleteMultipleMissingReportHistory(ids);
          setSelectedHistoryIds([]);
        }
      }
      setDeleteModal({ isOpen: false, type: 'trips', target: 'selected', count: 0 });
    } catch (err) {
      console.error("Error executing delete:", err);
      alert("রেকর্ড মুছে ফেলতে সমস্যা হয়েছে। দয়া করে পুনরায় চেষ্টা করুন।");
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const handleTripEdit = (trip: any) => {
    setEditingTripId(trip.id);
    setEditForm({ ...trip });
  };

  const handleTripUpdate = async () => {
    if (!editingTripId) return;
    try {
      await updateTrip(editingTripId, editForm);
      setEditingTripId(null);
      setEditForm(null);
    } catch (e) {
      alert('আপডেট করা সম্ভব হয়নি।');
    }
  };

  useEffect(() => {
    const unsubTrips = subscribeToCollection('trips', setTrips);
    const unsubVehicles = subscribeToCollection('vehicles', setVehicles);
    const unsubDrivers = subscribeToCollection('drivers', setDrivers);
    const unsubMissing = subscribeToCollection('missing_reports', setMissingReports);
    const unsubHistory = subscribeToCollection('missing_reports_history', setMissingHistory);
    return () => {
      unsubTrips();
      unsubVehicles();
      unsubDrivers();
      unsubMissing();
      unsubHistory();
    };
  }, []);

  const filteredTrips = trips.filter(t => {
    const matchesStatus = filter === 'All' || t.status === filter;
    const matchesSearch = 
      (t.vehicleId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.vehiclePlate || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.driverName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.driverId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.helperName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.helperId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.location || '').toLowerCase().includes(searchTerm.toLowerCase());
      
    return matchesStatus && matchesSearch;
  });

  const filteredHistory = missingHistory.filter(r => {
    const matchesStatus = historyFilter === 'All' || r.status === historyFilter;
    const matchesSearch = 
      (r.vehiclePlate || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.driverName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.driverId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.createdBy || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.resolvedBy || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.missingDocuments || []).some((d: string) => d.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.missingTools || []).some((t: string) => t.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesStatus && matchesSearch;
  });

  const allFilteredIds = filteredTrips.map(t => t.id);
  const isAllFilteredSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedTripIds.includes(id));
  const isSomeFilteredSelected = allFilteredIds.some(id => selectedTripIds.includes(id)) && !isAllFilteredSelected;

  const allFilteredHistoryIds = filteredHistory.map(h => h.id);
  const isAllFilteredHistorySelected = allFilteredHistoryIds.length > 0 && allFilteredHistoryIds.every(id => selectedHistoryIds.includes(id));
  const isSomeFilteredHistorySelected = allFilteredHistoryIds.some(id => selectedHistoryIds.includes(id)) && !isAllFilteredHistorySelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isSomeFilteredSelected;
    }
  }, [isSomeFilteredSelected]);

  useEffect(() => {
    if (historySelectAllRef.current) {
      historySelectAllRef.current.indeterminate = isSomeFilteredHistorySelected;
    }
  }, [isSomeFilteredHistorySelected]);

  const toggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      setSelectedTripIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      setSelectedTripIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const toggleSelectAllFilteredHistory = () => {
    if (isAllFilteredHistorySelected) {
      setSelectedHistoryIds(prev => prev.filter(id => !allFilteredHistoryIds.includes(id)));
    } else {
      setSelectedHistoryIds(prev => Array.from(new Set([...prev, ...allFilteredHistoryIds])));
    }
  };

  const toggleSelectTrip = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedTripIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectHistory = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedHistoryIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const formatDate = (ts: any) => {
    if (!ts) return 'N/A';
    if (ts.toDate) return ts.toDate().toLocaleDateString();
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleDateString();
    return new Date(ts).toLocaleDateString();
  };

  const handleExportCSV = () => {
    if (activeTab === 'Archive') {
      const headers = [
        'Date',
        'Vehicle Plate',
        'Vehicle ID',
        'Driver ID',
        'Driver Name',
        'Driver Phone',
        'Helper ID',
        'Helper Name',
        'Helper Phone',
        'Destination',
        'Status',
        'Started By',
        'Completed By'
      ];
      const rows = filteredTrips.map(t => [
        formatDate(t.startTime || t.createdAt),
        t.vehiclePlate || '',
        t.vehicleId || '',
        t.driverId || '',
        t.driverName || '',
        t.driverPhone || '',
        t.helperId || '',
        t.helperName || '',
        t.helperPhone || '',
        t.location || '',
        t.status || '',
        t.startedBy || '',
        t.completedBy || ''
      ]);
      downloadCSV(headers, rows, `Transport_Archive_${new Date().toISOString().split('T')[0]}`);
    } else if (activeTab === 'Missing') {
      const headers = [
        'Date Detected',
        'Vehicle Plate',
        'Driver ID',
        'Driver Name',
        'Missing Documents',
        'Missing Tools',
        'Status',
        'Created By',
        'Notes'
      ];
      const rows = missingReports.map(r => [
        formatDate(r.date),
        r.vehiclePlate || '',
        r.driverId || '',
        r.driverName || '',
        (r.missingDocuments || []).join('; '),
        (r.missingTools || []).join('; '),
        r.status || '',
        r.createdBy || '',
        r.notes || ''
      ]);
      downloadCSV(headers, rows, `Pending_Missing_Reports_${new Date().toISOString().split('T')[0]}`);
    } else if (activeTab === 'History') {
      const headers = [
        'Date Solved/Deleted',
        'Vehicle Plate',
        'Driver ID',
        'Driver Name',
        'Missing Documents',
        'Missing Tools',
        'Status',
        'Created By',
        'Resolved By'
      ];
      const rows = missingHistory.map(r => [
        formatDate(r.resolvedAt || r.deletedAt),
        r.vehiclePlate || '',
        r.driverId || '',
        r.driverName || '',
        (r.missingDocuments || []).join('; '),
        (r.missingTools || []).join('; '),
        r.status || '',
        r.createdBy || '',
        r.resolvedBy || ''
      ]);
      downloadCSV(headers, rows, `Resolved_Reports_History_${new Date().toISOString().split('T')[0]}`);
    }
  };

  const handleExportPDF = () => {
    if (activeTab === 'Archive') {
      const title = 'যানবাহন ট্রিপ ইতিহাস রিপোর্ট (Vehicle Trip History Report)';
      const subtitle = 'লজিস্টিক ট্রান্সপোর্ট আর্কাইভের ট্রিপ রেকর্ড ও চলমান ট্রিপ সমূহের তালিকা।';
      const metadata = [
        { label: 'মোট রেকর্ড (Total Records)', value: `${filteredTrips.length} টি` },
        { label: 'চলমান ট্রিপ (Running Trips)', value: `${filteredTrips.filter(t => t.status === 'Running').length} টি` },
        { label: 'সম্পন্ন ট্রিপ (Completed Trips)', value: `${filteredTrips.filter(t => t.status === 'Completed').length} টি` }
      ];
      const headers = ['তারিখ (Date)', 'গাড়ির নাম্বার (Plate)', 'ড্রাইভার ও হেলপার (Crew Details)', 'গন্তব্য (Destination)', 'অবস্থা (Status)'];
      const rows = filteredTrips.map(t => [
        formatDate(t.startTime || t.createdAt),
        t.vehiclePlate || t.vehicleId,
        `ড্রাইভার: ${t.driverName} (${t.driverId})${t.helperName ? `<br/>হেলপার: ${t.helperName} (${t.helperId})` : ''}`,
        t.location || '-',
        t.status === 'Completed' 
          ? '<span class="badge badge-completed">Completed</span>' 
          : '<span class="badge badge-running">Running</span>'
      ]);
      exportPDFWindow(title, subtitle, metadata, headers, rows);
    } else if (activeTab === 'Missing') {
      const title = 'অনুপস্থিত সরঞ্জামের পেন্ডিং রিপোর্ট (Pending Missing Items Report)';
      const subtitle = 'গাড়ি ফেরত আসার সময় অনুপস্থিত থাকা বিভিন্ন কাগজপত্র ও টুলের তালিকা।';
      const metadata = [
        { label: 'মোট পেন্ডিং কেস (Total Issues)', value: `${missingReports.length} টি` }
      ];
      const headers = ['তারিখ (Date)', 'গাড়ি ও ড্রাইভার (Vehicle & Driver)', 'অনুপস্থিত সরঞ্জাম (Missing Items)', 'নোট ও মন্তব্য (Notes)'];
      const rows = missingReports.map(r => [
        formatDate(r.date),
        `<strong>${r.vehiclePlate}</strong><br/>ড্রাইভার: ${r.driverName} (${r.driverId})`,
        `
          ${r.missingDocuments?.length ? `<div><strong>কাগজপত্র:</strong> ${r.missingDocuments.map((d: string) => `<span class="badge badge-suspended" style="margin-right:2px">${d}</span>`).join('')}</div>` : ''}
          ${r.missingTools?.length ? `<div style="margin-top:4px"><strong>সরঞ্জাম:</strong> ${r.missingTools.map((t: string) => `<span class="badge badge-suspended" style="margin-right:2px">${t}</span>`).join('')}</div>` : ''}
        `,
        r.notes || '-'
      ]);
      exportPDFWindow(title, subtitle, metadata, headers, rows);
    } else if (activeTab === 'History') {
      const title = 'সমাধানকৃত মিসিং রিপোর্টের ইতিহাস (Resolved Reports History)';
      const subtitle = 'ইতিপূর্বে সমাধান করা হওয়া মিসিং ও ড্যামেজ রিপোর্টের সম্পূর্ণ বিবরণী।';
      const metadata = [
        { label: 'মোট সমাধানকৃত কেস', value: `${missingHistory.length} টি` }
      ];
      const headers = ['তারিখ (Date)', 'গাড়ি ও ড্রাইভার (Vehicle & Driver)', 'অনুপস্থিত সরঞ্জাম (Missing Items)', 'অবস্থা (Status)'];
      const rows = missingHistory.map(r => [
        formatDate(r.resolvedAt || r.deletedAt),
        `<strong>${r.vehiclePlate}</strong><br/>ড্রাইভার: ${r.driverName} (${r.driverId})`,
        `
          ${r.missingDocuments?.length ? `<div><strong>কাগজপত্র:</strong> ${r.missingDocuments.join(', ')}</div>` : ''}
          ${r.missingTools?.length ? `<div style="margin-top:4px"><strong>সরঞ্জাম:</strong> ${r.missingTools.join(', ')}</div>` : ''}
        `,
        `<span class="badge badge-active">${r.status || 'Resolved'}</span>`
      ]);
      exportPDFWindow(title, subtitle, metadata, headers, rows);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Reports & Analytics</h2>
          <p className="text-slate-500">Historical data and logistical insights.</p>
        </div>
        <div className="flex gap-2">
          {canManageReports && (
            <>
              <Button variant="secondary" onClick={handleExportCSV}>
                <Download size={18} />
                <span>Export CSV</span>
              </Button>
              <Button variant="secondary" onClick={handleExportPDF}>
                <Printer size={18} />
                <span>Export PDF</span>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="flex border-b border-border mb-6">
          <button 
            onClick={() => setActiveTab('Archive')}
            className={cn(
              "px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all",
              activeTab === 'Archive' ? "border-accent text-accent" : "border-transparent text-text-muted hover:text-text-main"
            )}
          >
            Transport Archive
          </button>
          <button 
            onClick={() => setActiveTab('Missing')}
            className={cn(
              "px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-2",
              activeTab === 'Missing' ? "border-danger text-danger" : "border-transparent text-text-muted hover:text-text-main"
            )}
          >
            Missing Items
            {missingReports.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-danger text-white text-[9px]">{missingReports.length}</span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('History')}
            className={cn(
              "px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-2",
              activeTab === 'History' ? "border-slate-800 text-slate-800" : "border-transparent text-text-muted hover:text-text-main"
            )}
          >
            Report History
            <History size={14} />
          </button>
        </div>

        {activeTab === 'Archive' ? (
          <Card title="Transport Archive">
            {/* Search, Filter & Bulk Management Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
               <div className="flex-1 relative">
                 <Search size={16} className="absolute left-3 top-2.5 text-text-muted" />
                 <input 
                   type="text"
                   placeholder="Search by vehicle, driver, helper or location..."
                   className="w-full pl-9 pr-4 py-2 rounded-lg border border-border outline-none focus:border-accent text-xs bg-slate-50"
                   value={searchTerm}
                   onChange={e => { setSearchTerm(e.target.value); setSearchQuery(e.target.value); }}
                 />
               </div>
               <div className="flex items-center gap-2">
                 <Filter size={16} className="text-text-muted shrink-0" />
                 <select 
                   className="px-3 py-2 rounded-lg border border-border outline-none focus:border-accent text-xs bg-slate-50 font-medium"
                   value={filter}
                   onChange={e => setFilter(e.target.value)}
                 >
                   <option value="All">All Statuses ({trips.length})</option>
                   <option value="Running">Running Only ({trips.filter(t => t.status === 'Running').length})</option>
                   <option value="Completed">Completed Only ({trips.filter(t => t.status === 'Completed').length})</option>
                 </select>

                 {canManageReports && (
                   <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                     {filter !== 'All' || searchTerm ? (
                       <button
                         onClick={handleTriggerFilteredDelete}
                         disabled={filteredTrips.length === 0}
                         className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors whitespace-nowrap"
                         title="বর্তমান ফিল্টার করা সব রেকর্ড মুছুন"
                       >
                         <Trash2 size={13} />
                         <span>ফিল্টারকৃত মুছুন ({filteredTrips.length})</span>
                       </button>
                     ) : (
                       <button
                         onClick={handleTriggerAllDelete}
                         disabled={trips.length === 0}
                         className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors whitespace-nowrap"
                         title="সকল ট্রিপ রেকর্ড সম্পূর্ণ খালি করুন"
                       >
                         <Trash2 size={13} />
                         <span>সব মুছুন ({trips.length})</span>
                       </button>
                     )}
                   </div>
                 )}
               </div>
            </div>

            {/* Selection Banner / Floating Action Bar */}
            {selectedTripIds.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center shadow-xs">
                    {selectedTripIds.length}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-blue-950">
                      {selectedTripIds.length} টি রেকর্ড নির্বাচিত হয়েছে
                    </div>
                    <div className="text-[10px] text-blue-700">
                      দেখে দেখে নির্দিষ্ট রেকর্ড বা একসাথে মুছে ফেলতে নিচের বাটন ব্যবহার করুন
                    </div>
                  </div>
                </div>
                <div className="flex items-center flex-wrap gap-2">
                  <button
                    onClick={toggleSelectAllFiltered}
                    className="px-2.5 py-1.5 bg-white border border-blue-200 hover:bg-blue-100/50 text-blue-700 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors"
                  >
                    {isAllFilteredSelected ? "বর্তমান ফিল্টারের সব আনসিলেক্ট" : `সব সিলেক্ট (${filteredTrips.length})`}
                  </button>
                  <button
                    onClick={() => setSelectedTripIds([])}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors"
                  >
                    নির্বাচন বাতিল
                  </button>
                  {canManageReports && (
                    <button
                      onClick={handleTriggerSelectedDelete}
                      className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                    >
                      <Trash2 size={13} />
                      <span>নির্বাচিত {selectedTripIds.length}টি মুছুন</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
             <table className="w-full text-xs text-left">
               <thead>
                 <tr className="bg-[#f8fafc] border-b border-border">
                   {canManageReports && (
                     <th className="w-10 px-4 py-3 text-center">
                       <input 
                         type="checkbox"
                         ref={selectAllRef}
                         checked={isAllFilteredSelected}
                         onChange={toggleSelectAllFiltered}
                         className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                         title="সকল দৃশ্যমান রেকর্ড নির্বাচন করুন"
                       />
                     </th>
                   )}
                   <th className="px-4 py-3 font-semibold text-text-muted uppercase tracking-wider">Date</th>
                   <th className="px-4 py-3 font-semibold text-text-muted uppercase tracking-wider">Vehicle ID / Plate</th>
                   <th className="px-4 py-3 font-semibold text-text-muted uppercase tracking-wider">Crew Details</th>
                   <th className="px-4 py-3 font-semibold text-text-muted uppercase tracking-wider text-right">Status & Actions</th>
                 </tr>
               </thead>
                <tbody className="divide-y divide-border">
                  {filteredTrips.map(trip => {
                    const isSelected = selectedTripIds.includes(trip.id);
                    return (
                      <tr 
                        key={trip.id} 
                        className={cn(
                          "transition-colors",
                          isSelected ? "bg-blue-50/60 hover:bg-blue-50/80" : "hover:bg-slate-50"
                        )}
                      >
                        {canManageReports && (
                          <td className="w-10 px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => toggleSelectTrip(trip.id, e as any)}
                              className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                           {trip.startTime?.toDate?.().toLocaleDateString() || 
                            (trip.startTime ? new Date(trip.startTime).toLocaleDateString() : '') ||
                            (trip.createdAt?.toDate?.().toLocaleDateString() || 'N/A')}
                        </td>
                        <td className="px-4 py-3 font-bold text-text-main">
                          {editingTripId === trip.id ? (
                            <input 
                              className="p-1 border rounded w-28 text-[10px]"
                              value={editForm.vehiclePlate}
                              onChange={e => setEditForm({...editForm, vehiclePlate: e.target.value})}
                            />
                          ) : (
                            <div>
                              <div className="text-slate-900 font-bold">{trip.vehiclePlate || trip.vehicleId}</div>
                              {trip.location && (
                                <div className="text-[10px] text-slate-400 font-normal mt-0.5">📍 {trip.location}</div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingTripId === trip.id ? (
                            <div className="flex flex-col gap-1">
                              <input 
                                className="p-1 border rounded text-[10px]"
                                value={editForm.driverName}
                                onChange={e => setEditForm({...editForm, driverName: e.target.value})}
                                placeholder="Driver Name"
                              />
                              <input 
                                className="p-1 border rounded text-[10px]"
                                value={editForm.driverId}
                                onChange={e => setEditForm({...editForm, driverId: e.target.value})}
                                placeholder="Driver ID"
                              />
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 min-w-[140px]">
                               <div className="bg-blue-50/50 p-1.5 rounded-lg border border-blue-100/50">
                                  <div className="flex items-center justify-between gap-2">
                                     <span className="font-bold text-text-main text-[11px] truncate">{trip.driverName}</span>
                                     <span className="text-[10px] px-1.5 bg-blue-100 text-blue-700 rounded font-black uppercase shrink-0">Driver</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] mt-0.5">
                                     <span className="text-blue-600 font-bold">{trip.driverId}</span>
                                     {trip.driverPhone && <span className="text-text-muted">📞 {trip.driverPhone}</span>}
                                  </div>
                               </div>

                               {trip.helperId && (
                                 <div className="bg-purple-50/50 p-1.5 rounded-lg border border-purple-100/50">
                                    <div className="flex items-center justify-between gap-2">
                                       <span className="font-bold text-text-main text-[11px] truncate">{trip.helperName}</span>
                                       <span className="text-[10px] px-1.5 bg-purple-100 text-purple-700 rounded font-black uppercase shrink-0">Helper</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] mt-0.5">
                                       <span className="text-purple-600 font-bold">{trip.helperId}</span>
                                       {trip.helperPhone && <span className="text-text-muted">📞 {trip.helperPhone}</span>}
                                    </div>
                                 </div>
                               )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {editingTripId === trip.id ? (
                              <>
                                <button onClick={handleTripUpdate} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded" title="Save">
                                  <Save size={14} />
                                </button>
                                <button onClick={() => setEditingTripId(null)} className="p-1.5 text-slate-400 hover:bg-slate-50 rounded" title="Cancel">
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                {canManageReports && (
                                  <>
                                    <button 
                                      onClick={() => handleTripEdit(trip)} 
                                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded cursor-pointer transition-colors" 
                                      title="সম্পাদনা (Edit)"
                                    >
                                      <Edit3 size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleTriggerSingleTripDelete(trip)} 
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer transition-colors" 
                                      title="এই রেকর্ডটি মুছুন (Delete)"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                )}
                                <span className={cn(
                                  "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ml-2",
                                  trip.status === 'Completed' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                                )}>
                                  {trip.status}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTrips.length === 0 && (
                    <tr>
                      <td colSpan={canManageReports ? 5 : 4} className="px-5 py-16 text-center text-slate-400 italic">
                        <div className="flex flex-col items-center gap-2">
                          <AlertCircle size={28} className="text-slate-300" />
                          <p className="font-semibold text-xs">কোনো ট্রিপ রেকর্ড পাওয়া যায়নি।</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
             </table>
            </div>
          </Card>
        ) : activeTab === 'Missing' ? (
          <Card title="Pending Missing Reports">
            <div className="overflow-x-auto">
              {/* ... Missing Reports Table ... */}

            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-red-50/50 border-b border-red-100">
                  <th className="px-5 py-3 font-semibold text-danger uppercase tracking-wider">Detection Date</th>
                  <th className="px-5 py-3 font-semibold text-danger uppercase tracking-wider">Vehicle & Driver</th>
                  <th className="px-5 py-3 font-semibold text-danger uppercase tracking-wider">Missing Content</th>
                  <th className="px-5 py-3 font-semibold text-danger uppercase tracking-wider text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {missingReports.map(report => (
                  <tr 
                    key={report.id} 
                    className={cn(
                      "transition-colors",
                      report.status === 'Resolved' 
                        ? "bg-emerald-50/20 hover:bg-emerald-50/30" 
                        : "hover:bg-red-50/10 bg-white"
                    )}
                  >
                    <td className="px-5 py-3 text-text-muted">
                      {report.date?.toDate?.().toLocaleDateString() || new Date(report.date).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                       <div className="font-black text-text-main text-[11px] uppercase tracking-tight">{report.vehiclePlate}</div>
                        {report.createdBy && (
                          <div className="text-[9px] text-slate-400 font-normal mt-1">শনাক্তকারী: {report.createdBy}</div>
                        )}
                        {report.resolvedBy && (
                          <div className="text-[9px] text-emerald-600 font-semibold">সমাধানকারী: {report.resolvedBy}</div>
                        )}
                       <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-text-muted">{report.driverName}</span>
                          <span className={cn(
                            "text-[9px] font-black py-0.5 px-1 rounded uppercase",
                            report.status === 'Resolved' ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"
                          )}>{report.driverId}</span>
                       </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-1.5">
                         {report.status === 'Resolved' && (
                           <div className="flex items-center gap-1.5 text-emerald-700 font-extrabold text-xs mb-1.5 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 w-fit">
                             <CheckCircle2 size={12} className="text-emerald-600 animate-bounce" />
                             <span>✓ সমাধান সম্পন্ন (Issue Solved)</span>
                           </div>
                         )}
                         {report.missingDocuments?.length > 0 && (
                           <div className="flex flex-wrap gap-1">
                             {report.missingDocuments.map((d: string) => (
                               <span key={d} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-black uppercase">
                                 <AlertTriangle size={8} /> {d}
                               </span>
                             ))}
                           </div>
                         )}
                         {report.missingTools?.length > 0 && (
                           <div className="flex flex-wrap gap-1">
                             {report.missingTools.map((t: string) => (
                               <span key={t} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 text-[9px] font-black uppercase">
                                 <AlertTriangle size={8} /> {t}
                               </span>
                             ))}
                           </div>
                         )}
                         {report.notes && (
                           <p className="text-[9px] text-text-muted italic bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                             Note: {report.notes}
                           </p>
                         )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                       <div className="flex items-center justify-end gap-2">
                          {canResolveReports && (
                            deletingId === report.id ? (
                               <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-2 duration-300">
                                  <button 
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await handleDelete(report.id);
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-[10px] font-bold shadow-sm hover:bg-red-700 transition-colors"
                                  >
                                    Confirm?
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeletingId(null);
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200 hover:bg-slate-200 transition-colors"
                                  >
                                    No
                                  </button>
                               </div>
                            ) : (
                               <>
                                  {report.status === 'Pending' && (
                                    <Button 
                                      variant="secondary"
                                      disabled={resolvingId === report.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm('আপনি কি নিশ্চিত যে এটি সমাধান করা হয়েছে?')) {
                                          handleResolve(report.id);
                                        }
                                      }}
                                      className="p-2 h-9 w-9 bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100 flex items-center justify-center"
                                      title="Mark as Resolved"
                                    >
                                       {resolvingId === report.id ? (
                                         <div className="w-4 h-4 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
                                       ) : (
                                         <CheckCircle2 size={16} />
                                       )}
                                    </Button>
                                  )}
                                  {canManageReports && (
                                    <Button 
                                      variant="danger"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeletingId(report.id);
                                      }}
                                      className={cn("p-2 h-9 w-9", report.status === 'Resolved' && "opacity-50")}
                                      title="ডিলেট রিপোর্ট"
                                    >
                                       <Trash2 size={16} />
                                    </Button>
                                  )}
                               </>
                            )
                          )}
                          <span className={cn(
                            "px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase shadow-sm border",
                            report.status === 'Resolved' 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                              : "bg-red-50 text-red-700 border-red-200"
                          )}>
                            {report.status}
                          </span>
                       </div>
                    </td>
                  </tr>
                ))}
                {missingReports.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-20 text-center text-text-muted italic">
                       <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
                             <AlertTriangle size={24} className="text-slate-300" />
                          </div>
                          <p className="font-bold text-sm">No items missing recorded.</p>
                          <p className="text-[10px] max-w-xs uppercase tracking-widest opacity-60">All documents and tools accounted for in recent vehicle returns.</p>
                       </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        ) : activeTab === 'History' ? (
          <Card title="Missing Reports History">
            {/* Search, Filter & Bulk Management Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
               <div className="flex-1 relative">
                 <Search size={16} className="absolute left-3 top-2.5 text-text-muted" />
                 <input 
                   type="text"
                   placeholder="হিস্ট্রি খুঁজুন (গাড়ি নম্বর, ড্রাইভার, শনাক্তকারী, সমাধানকারী, সামগ্রী...)"
                   className="w-full pl-9 pr-4 py-2 rounded-lg border border-border outline-none focus:border-accent text-xs bg-slate-50"
                   value={searchTerm}
                   onChange={e => {
                     setSearchTerm(e.target.value);
                     setSearchQuery(e.target.value);
                   }}
                 />
               </div>
               <div className="flex items-center gap-2">
                 <Filter size={16} className="text-text-muted shrink-0" />
                 <select 
                   className="px-3 py-2 rounded-lg border border-border outline-none focus:border-accent text-xs bg-slate-50 font-medium"
                   value={historyFilter}
                   onChange={e => setHistoryFilter(e.target.value)}
                 >
                   <option value="All">All Statuses ({missingHistory.length})</option>
                   <option value="Resolved">Resolved Only ({missingHistory.filter(h => h.status === 'Resolved').length})</option>
                   <option value="Deleted">Deleted / Pending ({missingHistory.filter(h => h.status !== 'Resolved').length})</option>
                 </select>

                 {canManageReports && (
                   <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                     {historyFilter !== 'All' || searchTerm ? (
                       <button
                         onClick={handleTriggerFilteredHistoryDelete}
                         disabled={filteredHistory.length === 0}
                         className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors whitespace-nowrap"
                         title="বর্তমান ফিল্টার করা সব রিপোর্ট হিস্ট্রি রেকর্ড মুছুন"
                       >
                         <Trash2 size={13} />
                         <span>ফিল্টারকৃত মুছুন ({filteredHistory.length})</span>
                       </button>
                     ) : (
                       <button
                         onClick={handleTriggerAllHistoryDelete}
                         disabled={missingHistory.length === 0}
                         className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors whitespace-nowrap"
                         title="সকল রিপোর্ট হিস্ট্রি সম্পূর্ণ খালি করুন"
                       >
                         <Trash2 size={13} />
                         <span>সব মুছুন ({missingHistory.length})</span>
                       </button>
                     )}
                   </div>
                 )}
               </div>
            </div>

            {/* Selection Banner / Floating Action Bar for History */}
            {selectedHistoryIds.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center shadow-xs">
                    {selectedHistoryIds.length}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-blue-950">
                      {selectedHistoryIds.length} টি রিপোর্ট হিস্ট্রি রেকর্ড নির্বাচিত হয়েছে
                    </div>
                    <div className="text-[10px] text-blue-700">
                      দেখে দেখে নির্দিষ্ট রেকর্ড বা একসাথে মুছে ফেলতে নিচের বাটন ব্যবহার করুন
                    </div>
                  </div>
                </div>
                <div className="flex items-center flex-wrap gap-2">
                  <button
                    onClick={toggleSelectAllFilteredHistory}
                    className="px-2.5 py-1.5 bg-white border border-blue-200 hover:bg-blue-100/50 text-blue-700 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors"
                  >
                    {isAllFilteredHistorySelected ? "বর্তমান ফিল্টারের সব আনসিলেক্ট" : `সব সিলেক্ট (${filteredHistory.length})`}
                  </button>
                  <button
                    onClick={() => setSelectedHistoryIds([])}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors"
                  >
                    নির্বাচন বাতিল
                  </button>
                  {canManageReports && (
                    <button
                      onClick={handleTriggerSelectedHistoryDelete}
                      className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                    >
                      <Trash2 size={13} />
                      <span>নির্বাচিত {selectedHistoryIds.length}টি মুছুন</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {canManageReports && (
                      <th className="w-10 px-4 py-3 text-center">
                        <input 
                          type="checkbox"
                          ref={historySelectAllRef}
                          checked={isAllFilteredHistorySelected}
                          onChange={toggleSelectAllFilteredHistory}
                          className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                          title="সকল দৃশ্যমান হিস্ট্রি রেকর্ড নির্বাচন করুন"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider">Date Solved / Deleted</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider">Vehicle & Driver</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider">Missing Content</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider text-right">Status & Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredHistory.map(report => {
                    const isSelected = selectedHistoryIds.includes(report.id);
                    return (
                      <tr 
                        key={report.id} 
                        className={cn(
                          "transition-colors",
                          isSelected ? "bg-blue-50/60 hover:bg-blue-50/80" : "hover:bg-slate-50/50"
                        )}
                      >
                        {canManageReports && (
                          <td className="w-10 px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => toggleSelectHistory(report.id, e as any)}
                              className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                          {report.resolvedAt?.toDate?.().toLocaleDateString() || 
                           report.deletedAt?.toDate?.().toLocaleDateString() || 
                           (report.resolvedAt ? new Date(report.resolvedAt).toLocaleDateString() : '') ||
                           (report.deletedAt ? new Date(report.deletedAt).toLocaleDateString() : '') ||
                           'N/A'}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                           <div className="font-bold text-slate-900 text-[11px] uppercase tracking-tight">{report.vehiclePlate}</div>
                           {report.createdBy && (
                             <div className="text-[9px] text-slate-400 font-normal mt-0.5">শনাক্তকারী: {report.createdBy}</div>
                           )}
                           {report.resolvedBy && (
                             <div className="text-[9px] text-emerald-600 font-semibold mt-0.5">সমাধানকারী: {report.resolvedBy}</div>
                           )}
                           <div className="flex items-center gap-1.5 mt-1">
                              <span className="font-medium text-slate-700">{report.driverName}</span>
                              <span className="text-[9px] font-bold py-0.5 px-1 bg-slate-100 text-slate-600 rounded uppercase">{report.driverId}</span>
                           </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1.5">
                             {report.missingDocuments?.length > 0 && (
                               <div className="flex flex-wrap gap-1">
                                 {report.missingDocuments.map((d: string) => (
                                   <span key={d} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200 text-[9px] font-bold uppercase">
                                     {d}
                                   </span>
                                 ))}
                               </div>
                             )}
                             {report.missingTools?.length > 0 && (
                               <div className="flex flex-wrap gap-1">
                                 {report.missingTools.map((t: string) => (
                                   <span key={t} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200 text-[9px] font-bold uppercase">
                                     {t}
                                   </span>
                                 ))}
                               </div>
                             )}
                             {report.notes && (
                               <p className="text-[9px] text-text-muted italic bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                                 Note: {report.notes}
                               </p>
                             )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                           <div className="flex items-center justify-end gap-2">
                             {canManageReports && (
                               <button 
                                 onClick={() => handleTriggerSingleHistoryDelete(report)} 
                                 className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer transition-colors" 
                                 title="এই হিস্ট্রি রেকর্ডটি মুছুন (Delete)"
                               >
                                 <Trash2 size={14} />
                               </button>
                             )}
                             <span className={cn(
                               "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase shadow-xs border",
                               report.status === 'Resolved' 
                                 ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                 : "bg-red-50 text-red-700 border-red-200"
                             )}>
                               {report.status || 'Resolved'}
                             </span>
                           </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredHistory.length === 0 && (
                    <tr>
                      <td colSpan={canManageReports ? 5 : 4} className="px-5 py-16 text-center text-text-muted italic">
                        <div className="flex flex-col items-center gap-2">
                          <AlertCircle size={28} className="text-slate-300" />
                          <p className="font-semibold text-xs">কোনো রিপোর্ট হিস্ট্রি রেকর্ড পাওয়া যায়নি।</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}
      </div>

      {/* Delete Confirmation Modal (Common for Trips Archive & Report History) */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">
                  {deleteModal.type === 'trips' ? 'ট্রিপ রেকর্ড মুছে ফেলার নিশ্চিতকরণ' : 'রিপোর্ট হিস্ট্রি মুছে ফেলার নিশ্চিতকরণ'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {deleteModal.type === 'trips' ? (
                    deleteModal.target === 'single' ? (
                      <>আপনি কি নিশ্চিত যে গাড়ি নম্বর <strong className="text-slate-900 font-bold">{deleteModal.singleTitle}</strong> এর এই ট্রিপ রেকর্ডটি মুছে ফেলতে চান?</>
                    ) : deleteModal.target === 'selected' ? (
                      <>আপনি কি নিশ্চিত যে আপনার নির্বাচিত <strong className="text-red-600 font-bold">{deleteModal.count}টি</strong> ট্রিপ রেকর্ড স্থায়ীভাবে মুছে ফেলতে চান?</>
                    ) : deleteModal.target === 'filtered' ? (
                      <>আপনি কি নিশ্চিত যে বর্তমান ফিল্টারকৃত <strong className="text-red-600 font-bold">{deleteModal.count}টি</strong> ট্রিপ রেকর্ড মুছে ফেলতে চান?</>
                    ) : (
                      <>আপনি কি নিশ্চিত যে সম্পূর্ণ আর্কাইভের সর্বমোট <strong className="text-red-600 font-bold">{deleteModal.count}টি</strong> ট্রিপ রেকর্ড মুছে ফেলতে চান?</>
                    )
                  ) : (
                    deleteModal.target === 'single' ? (
                      <>আপনি কি নিশ্চিত যে <strong className="text-slate-900 font-bold">{deleteModal.singleTitle}</strong> এর এই রিপোর্ট হিস্ট্রি রেকর্ডটি মুছে ফেলতে চান?</>
                    ) : deleteModal.target === 'selected' ? (
                      <>আপনি কি নিশ্চিত যে আপনার নির্বাচিত <strong className="text-red-600 font-bold">{deleteModal.count}টি</strong> রিপোর্ট হিস্ট্রি রেকর্ড স্থায়ীভাবে মুছে ফেলতে চান?</>
                    ) : deleteModal.target === 'filtered' ? (
                      <>আপনি কি নিশ্চিত যে বর্তমান ফিল্টারকৃত <strong className="text-red-600 font-bold">{deleteModal.count}টি</strong> রিপোর্ট হিস্ট্রি রেকর্ড মুছে ফেলতে চান?</>
                    ) : (
                      <>আপনি কি নিশ্চিত যে সম্পূর্ণ রিপোর্ট হিস্ট্রির সর্বমোট <strong className="text-red-600 font-bold">{deleteModal.count}টি</strong> রেকর্ড মুছে ফেলতে চান?</>
                    )
                  )}
                </p>

                <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-[11px] text-amber-800 font-medium">
                  <AlertCircle size={14} className="shrink-0 text-amber-600" />
                  <span>সতর্কতা: মুছে ফেলা রেকর্ড আর পুনরুদ্ধার করা যাবে না।</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeletingBulk}
                onClick={() => setDeleteModal({ isOpen: false, type: 'trips', target: 'selected', count: 0 })}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                disabled={isDeletingBulk}
                onClick={handleConfirmExecuteDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 transition-colors"
              >
                {isDeletingBulk ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>মুছে ফেলা হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>হ্যাঁ, মুছে ফেলুন ({deleteModal.count})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
