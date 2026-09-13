import React, { useState, useEffect, useMemo } from 'react';
import { FileWarning, Plus, Trash2, ShieldAlert, CheckCircle2, History, BarChart3, Edit2, FileText, Sparkles, X, Check } from 'lucide-react';
import { Card, Button, AuditDetailsDropdown } from './components/Common';
import { addCase, resolveCase, subscribeToCollection, updateCase, deleteCase, findStaffById, VehiclePaperRecord } from './db';
import { DOCUMENT_TYPES, cn } from './lib/utils';
import { useAuth } from './AuthContext';
import { useSearch } from './SearchContext';
import { VehiclePapersManagement, calculateExpiryStatus } from './components/VehiclePapersManagement';

const CaseManagement: React.FC = () => {
  const { isAdmin, isSubAdmin, isChecker, profile } = useAuth();
  const { searchQuery } = useSearch();
  const canManageItems = isAdmin;
  const canSubmit = isAdmin || isSubAdmin || isChecker;
  const [cases, setCases] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [papersList, setPapersList] = useState<VehiclePaperRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'Active' | 'Papers' | 'Stats'>('Active');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const searchFilteredCases = useMemo(() => {
    if (!searchQuery.trim()) return cases;
    const q = searchQuery.toLowerCase();
    return cases.filter(c => {
      return (c.id || '').toLowerCase().includes(q) ||
        (c.caseId || '').toLowerCase().includes(q) ||
        (c.vehicleId || '').toLowerCase().includes(q) ||
        (c.driverName || '').toLowerCase().includes(q) ||
        (c.driverId || '').toLowerCase().includes(q) ||
        (c.reason || '').toLowerCase().includes(q) ||
        (c.documentType || '').toLowerCase().includes(q);
    });
  }, [cases, searchQuery]);
  const [filterDate, setFilterDate] = useState({ start: '', end: '' });
  const [vehicleSearch, setVehicleSearch] = useState(() => {
    const saved = localStorage.getItem('cases_vehicleSearch');
    return saved || '';
  });
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [newCase, setNewCase] = useState(() => {
    const saved = localStorage.getItem('cases_newCase');
    return saved ? JSON.parse(saved) : {
      vehicleId: '',
      driverId: 'DRV-',
      driverName: '',
      driverPhone: '',
      caseId: '',
      amount: 0,
      reason: '',
      seizedDocuments: [] as string[]
    };
  });

  useEffect(() => {
    if (!editingId) {
      localStorage.setItem('cases_vehicleSearch', vehicleSearch);
    }
  }, [vehicleSearch, editingId]);

  useEffect(() => {
    if (!editingId) {
      localStorage.setItem('cases_newCase', JSON.stringify(newCase));
    }
  }, [newCase, editingId]);

  useEffect(() => {
    const unsubCases = subscribeToCollection('cases', setCases);
    const unsubVehicles = subscribeToCollection('vehicles', setVehicles);
    const unsubPapers = subscribeToCollection('vehicle_papers', setPapersList);
    return () => {
      unsubCases();
      unsubVehicles();
      unsubPapers();
    };
  }, []);

  const expiredOrSoonCount = useMemo(() => {
    let count = 0;
    papersList.forEach(p => {
      const dates = [
        p.taxToken?.expiryDate,
        p.fitness?.expiryDate,
        p.routePermit?.expiryDate,
        p.insurance?.expiryDate
      ];
      const hasIssue = dates.some(d => {
        const calc = calculateExpiryStatus(d);
        return calc.status === 'expired' || calc.status === 'expiring_soon';
      });
      if (hasIssue) count++;
    });
    return count;
  }, [papersList]);

  const activeCasesCount = useMemo(() => {
    return cases.filter(c => (c.status || 'Open') === 'Open').length;
  }, [cases]);

  const handleLookupDriver = async (id: string) => {
    const cleanId = id.trim().toUpperCase();
    setNewCase(prev => ({ ...prev, driverId: cleanId }));
    
    if (cleanId.length >= 3) {
      const driver = await findStaffById(cleanId) as any;
      if (driver) {
        setNewCase(prev => ({ 
          ...prev, 
          driverName: driver.name || '', 
          driverPhone: driver.phoneNumber || '' 
        }));
      } else {
        // Fallback for partial IDs or if not found yet
        setNewCase(prev => ({ 
          ...prev, 
          driverName: '', 
          driverPhone: '' 
        }));
      }
    }
  };
  const handleToggleDoc = (doc: string) => {
    setNewCase(prev => ({
      ...prev,
      seizedDocuments: prev.seizedDocuments.includes(doc)
        ? prev.seizedDocuments.filter(d => d !== doc)
        : [...prev.seizedDocuments, doc]
    }));
  };

  const handleCancel = () => {
    setShowAdd(false);
    setEditingId(null);
    setVehicleSearch('');
    setNewCase({ vehicleId: '', driverId: 'DRV-', driverName: '', driverPhone: '', caseId: '', amount: 0, reason: '', seizedDocuments: [] });
    localStorage.removeItem('cases_newCase');
    localStorage.removeItem('cases_showAdd');
    localStorage.removeItem('cases_vehicleSearch');
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCase.vehicleId || !newCase.caseId) return;
    
    if (editingId) {
      await updateCase(editingId, newCase, profile);
    } else {
      await addCase(newCase, profile);
    }
    
    setShowAdd(false);
    setEditingId(null);
    setVehicleSearch('');
    setNewCase({ vehicleId: '', driverId: 'DRV-', driverName: '', driverPhone: '', caseId: '', amount: 0, reason: '', seizedDocuments: [] });
    
    localStorage.removeItem('cases_newCase');
    localStorage.removeItem('cases_showAdd');
    localStorage.removeItem('cases_vehicleSearch');
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setNewCase({
      vehicleId: item.vehicleId,
      driverId: item.driverId || '',
      driverName: item.driverName || '',
      driverPhone: item.driverPhone || '',
      caseId: item.caseId,
      amount: item.amount,
      reason: item.reason || '',
      seizedDocuments: item.seizedDocuments || []
    });
    setVehicleSearch(item.vehicleId);
    setShowAdd(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteCase = async (id: string) => {
    await deleteCase(id);
    setDeletingId(null);
  };

  const statsData = useMemo(() => {
    const carWise: Record<string, { count: number, totalAmount: number, reasons: string[] }> = {};
    
    const filteredCases = cases.filter(c => {
      if (!filterDate.start && !filterDate.end) return true;
      const caseDate = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt || Date.now());
      if (filterDate.start) {
        if (caseDate < new Date(filterDate.start)) return false;
      }
      if (filterDate.end) {
        const end = new Date(filterDate.end);
        end.setHours(23, 59, 59, 999);
        if (caseDate > end) return false;
      }
      return true;
    });

    filteredCases.forEach(c => {
      if (!carWise[c.vehicleId]) {
        carWise[c.vehicleId] = { count: 0, totalAmount: 0, reasons: [] };
      }
      carWise[c.vehicleId].count += 1;
      carWise[c.vehicleId].totalAmount += (c.amount || 0);
      if (c.reason) carWise[c.vehicleId].reasons.push(c.reason);
    });
    return Object.entries(carWise).sort((a, b) => b[1].totalAmount - a[1].totalAmount);
  }, [cases, filterDate]);

  const filteredTotalAmount = useMemo(() => {
    return cases.filter(c => {
      if (!filterDate.start && !filterDate.end) return true;
      const caseDate = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt || Date.now());
      if (filterDate.start) if (caseDate < new Date(filterDate.start)) return false;
      if (filterDate.end) {
        const end = new Date(filterDate.end);
        end.setHours(23, 59, 59, 999);
        if (caseDate > end) return false;
      }
      return true;
    }).reduce((sum, c) => sum + (c.amount || 0), 0);
  }, [cases, filterDate]);

  const filteredCaseCount = useMemo(() => {
    return cases.filter(c => {
      if (!filterDate.start && !filterDate.end) return true;
      const caseDate = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt || Date.now());
      if (filterDate.start) if (caseDate < new Date(filterDate.start)) return false;
      if (filterDate.end) {
        const end = new Date(filterDate.end);
        end.setHours(23, 59, 59, 999);
        if (caseDate > end) return false;
      }
      return true;
    }).length;
  }, [cases, filterDate]);

  const accountSummary = useMemo(() => {
    const pending = cases.filter(c => (c.status || 'Open') === 'Open').reduce((sum, c) => sum + (c.amount || 0), 0);
    const resolved = cases.filter(c => c.status === 'Resolved').reduce((sum, c) => sum + (c.amount || 0), 0);
    return { pending, resolved, total: pending + resolved };
  }, [cases]);

  const filteredVehicles = useMemo(() => {
    if (!vehicleSearch) return vehicles;
    const q = vehicleSearch.toLowerCase();
    return vehicles.filter(v => {
      const plate = v.vehicleNumber.toLowerCase();
      const lastFour = v.vehicleNumber.slice(-4);
      return plate.includes(q) || lastFour.includes(q);
    });
  }, [vehicles, vehicleSearch]);

  return (
    <div className="space-y-6">
      {/* 1. Header Row: Title on Left, Record New Case Button on Right */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Cases & Fleet Documents</h2>
          <p className="text-sm text-slate-500">মামলা, জরিমানার রেকর্ড, গাড়ির কাগজপত্রের মেয়াদ ও ডিজিটাল নাম্বার প্লেট নিয়ন্ত্রণ।</p>
        </div>

        {canSubmit && (
          <Button 
            variant="danger" 
            onClick={() => { 
              if (activeTab === 'Papers') {
                setActiveTab('Active');
              }
              const nextShow = !showAdd;
              setShowAdd(nextShow); 
              if (nextShow) {
                setEditingId(null);
                setVehicleSearch('');
                setNewCase({ vehicleId: '', driverId: 'DRV-', driverName: '', driverPhone: '', caseId: '', amount: 0, reason: '', seizedDocuments: [] });
              }
            }} 
            className="shadow-md shadow-red-200 gap-2 cursor-pointer shrink-0 self-start sm:self-auto"
          >
            <Plus size={18} />
            <span>{editingId ? 'Edit Case Record' : 'Record New Case'}</span>
          </Button>
        )}
      </div>

      {/* 2. Navigation Tabs Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-1.5 shadow-3xs flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 min-w-max">
          <button
            type="button"
            onClick={() => setActiveTab('Active')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer",
              activeTab === 'Active' 
                ? "bg-slate-900 text-white shadow-xs" 
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            )}
          >
            <FileWarning size={15} />
            <span>মামলা ও জব্দ ({activeCasesCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('Papers')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer",
              activeTab === 'Papers' 
                ? "bg-blue-600 text-white shadow-xs" 
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            )}
          >
            <FileText size={15} />
            <span>গাড়ির কাগজ ও ডিজিটাল প্লেট</span>
            {expiredOrSoonCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('Stats')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer",
              activeTab === 'Stats' 
                ? "bg-slate-900 text-white shadow-xs" 
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            )}
          >
            <BarChart3 size={15} />
            <span>মামলা রেকর্ড ও পরিসংখ্যান</span>
          </button>
        </div>
      </div>

      {activeTab !== 'Papers' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">Pending Penalty (Account)</p>
            <h3 className="text-2xl font-black text-red-600 tracking-tight">৳{accountSummary.pending.toLocaleString()}</h3>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1">Total Resolved (Paid)</p>
            <h3 className="text-2xl font-black text-emerald-600 tracking-tight">৳{accountSummary.resolved.toLocaleString()}</h3>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Historical Total</p>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">৳{accountSummary.total.toLocaleString()}</h3>
          </div>
        </div>
      )}

      {/* Record New Case / Update Case Modal Dialog */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="fixed inset-0" 
            onClick={handleCancel} 
          />
          <div className="relative w-full max-w-xl bg-white rounded-2xl md:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
                  <FileWarning size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingId ? 'মামলা তথ্য সংশোধন' : 'নতুন মামলা এন্ট্রি (Record New Case)'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">যানবাহনের বিরুদ্ধে নতুন মামলা ও জব্দকৃত কাগজপত্রের তথ্য</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={handleCancel}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition-colors font-bold text-sm cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAdd} className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Select Vehicle with autocomplete */}
                  <div className="relative">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      গাড়ি নির্বাচন (Select Vehicle) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder="গাড়ির নম্বর বা শেষ ৪ ডিজিট..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                        value={vehicleSearch}
                        onFocus={() => setShowVehicleDropdown(true)}
                        onChange={e => {
                          setVehicleSearch(e.target.value);
                          if (newCase.vehicleId) setNewCase({ ...newCase, vehicleId: '' });
                          setShowVehicleDropdown(true);
                        }}
                      />
                      {showVehicleDropdown && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                          {filteredVehicles.length > 0 ? (
                            filteredVehicles.map(v => (
                              <button
                                key={v.id}
                                type="button"
                                className="w-full px-4 py-2.5 text-left hover:bg-red-50/50 transition-colors border-b border-slate-50 last:border-0 flex items-center justify-between cursor-pointer"
                                onClick={() => {
                                  setNewCase({ ...newCase, vehicleId: v.vehicleNumber });
                                  setVehicleSearch(v.vehicleNumber);
                                  setShowVehicleDropdown(false);
                                }}
                              >
                                <span className="font-bold text-slate-900 text-xs">{v.vehicleNumber}</span>
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">শেষ ৪: {v.vehicleNumber.slice(-4)}</span>
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-xs text-slate-500 italic">কোনো গাড়ি পাওয়া যায়নি</div>
                          )}
                        </div>
                      )}
                    </div>
                    {showVehicleDropdown && (
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setShowVehicleDropdown(false)}
                      />
                    )}
                  </div>

                  {/* Driver ID Lookup */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      ড্রাইভার আইডি (Driver ID)
                    </label>
                    <input 
                      type="text" 
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 font-mono"
                      placeholder="যেমন: DRV-001"
                      value={newCase.driverId}
                      onChange={e => handleLookupDriver(e.target.value)}
                    />
                  </div>

                  {/* Driver Name (Auto-filled) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      ড্রাইভারের নাম
                    </label>
                    <input 
                      type="text" 
                      readOnly
                      placeholder="আইডি দিলে স্বয়ংক্রিয় আসবে"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none text-slate-700 text-sm font-medium"
                      value={newCase.driverName}
                    />
                  </div>

                  {/* Driver Phone (Auto-filled) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      মোবাইল নম্বর
                    </label>
                    <input 
                      type="text" 
                      readOnly
                      placeholder="আইডি দিলে স্বয়ংক্রিয় আসবে"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none text-slate-700 text-sm font-medium"
                      value={newCase.driverPhone}
                    />
                  </div>

                  {/* Case / GD ID */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      মামলা / জিডি নম্বর (Case / GD ID) <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 font-mono"
                      placeholder="যেমন: CS-9942"
                      value={newCase.caseId}
                      onChange={e => setNewCase({ ...newCase, caseId: e.target.value })}
                    />
                  </div>

                  {/* Penalty Amount */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      জরিমানার পরিমাণ (Penalty Amount ৳)
                    </label>
                    <input 
                      type="number" 
                      min="0"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-red-600 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 font-mono"
                      placeholder="0"
                      value={newCase.amount || ''}
                      onChange={e => setNewCase({ ...newCase, amount: Number(e.target.value) })}
                    />
                  </div>

                  {/* Case Reason */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      মামলার কারণ ও বিস্তারিত বিবরণ
                    </label>
                    <textarea 
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                      placeholder="মামলার কারণ বিস্তারিত লিখুন..."
                      rows={2}
                      value={newCase.reason}
                      onChange={e => setNewCase({ ...newCase, reason: e.target.value })}
                    />
                  </div>
                </div>

                {/* Seized Documents */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    জব্দকৃত কাগজপত্র (Seized Documents Under Case):
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DOCUMENT_TYPES.map(doc => {
                      const isSelected = newCase.seizedDocuments.includes(doc);
                      return (
                        <button
                          key={doc}
                          type="button"
                          onClick={() => handleToggleDoc(doc)}
                          className={cn(
                            "px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                            isSelected
                              ? "bg-red-600 border-red-600 text-white shadow-xs"
                              : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                          )}
                        >
                          {doc}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400 italic">
                    নির্বাচিত কাগজপত্র ট্রিপ চেকলিস্টে স্বয়ংক্রিয়ভাবে জব্দ হিসেবে চিহ্নিত থাকবে।
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
                <Button type="button" variant="secondary" onClick={handleCancel}>
                  বাতিল
                </Button>
                <Button type="submit" variant="danger" className="gap-2 shadow-xs">
                  <Check size={16} />
                  <span>{editingId ? 'তথ্য আপডেট করুন' : 'মামলা সংরক্ষণ করুন'}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'Papers' ? (
        <VehiclePapersManagement vehicles={vehicles} papersList={papersList} />
      ) : activeTab === 'Active' ? (
        <div className="grid grid-cols-1 gap-6">
          <Card title="Active Enforcement Cases">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-5 py-3 font-semibold text-slate-500 uppercase tracking-wider">Transport & Driver</th>
                    <th className="px-5 py-3 font-semibold text-slate-500 uppercase tracking-wider">Case Details</th>
                    <th className="px-5 py-3 font-semibold text-slate-500 uppercase tracking-wider">Seized Items</th>
                    <th className="px-5 py-3 font-semibold text-slate-500 uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {searchFilteredCases.filter(c => (c.status || 'Open') === 'Open').map(item => (
                    <tr key={item.id} className="hover:bg-red-50/20 transition-colors">
                      <td className="px-5 py-3 align-top">
                         <div className="flex items-center gap-1.5 flex-wrap">
                           <span className="font-black text-slate-900 text-sm whitespace-nowrap">{item.vehicleId}</span>
                           <AuditDetailsDropdown createdBy={item.createdBy} updatedBy={item.updatedBy} resolvedBy={item.resolvedBy} />
                         </div>
                         {item.driverName && (
                           <div className="mt-1">
                             <div className="text-[10px] font-bold text-slate-700 leading-none">{item.driverName}</div>
                             <div className="text-[9px] text-slate-400 mt-0.5">{item.driverId}</div>
                           </div>
                         )}
                         <div className="text-[10px] font-mono text-slate-500 mt-1">#{item.caseId}</div>
                      </td>
                      <td className="px-5 py-3 align-top max-w-xs">
                         <div className="font-bold text-red-700">৳{item.amount.toLocaleString()}</div>
                         {item.reason && <p className="text-[10px] text-slate-600 mt-1 line-clamp-2 italic">"{item.reason}"</p>}
                      </td>
                      <td className="px-5 py-3 align-top">
                        <div className="flex flex-wrap gap-1">
                          {item.seizedDocuments?.map((d: string) => (
                            <span key={d} className="px-2 py-0.5 rounded bg-red-50 text-red-600 text-[9px] font-black uppercase border border-red-100">{d}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right align-top">
                         {canManageItems && (
                           <button 
                             className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-lg transition-colors" 
                             onClick={() => resolveCase(item.id, profile)}
                           >
                             Resolve
                           </button>
                         )}
                      </td>
                    </tr>
                  ))}
                  {searchFilteredCases.filter(c => (c.status || 'Open') === 'Open').length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-20 text-center text-text-muted italic">
                        <div className="flex flex-col items-center gap-3">
                           <CheckCircle2 size={40} className="text-emerald-300" />
                           <p className="text-sm">No active enforcement cases found.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
           <Card title="Transport-wise Case Analytics">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <History size={18} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Filter by Period:</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-400">FROM</label>
                    <input 
                      type="date" 
                      className="text-xs p-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 bg-white"
                      value={filterDate.start}
                      onChange={e => setFilterDate({...filterDate, start: e.target.value})}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-400">TO</label>
                    <input 
                      type="date" 
                      className="text-xs p-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 bg-white"
                      value={filterDate.end}
                      onChange={e => setFilterDate({...filterDate, end: e.target.value})}
                    />
                  </div>
                  {(filterDate.start || filterDate.end) && (
                    <button 
                      onClick={() => setFilterDate({start: '', end: ''})}
                      className="text-[10px] font-bold text-red-500 hover:text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100 transition-colors"
                    >
                      CLEAR
                    </button>
                  ) }
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                 <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Penalty Amount</p>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">৳{filteredTotalAmount.toLocaleString()}</h3>
                 </div>
                 <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">Total Cases in Period</p>
                    <h3 className="text-3xl font-black text-red-600 tracking-tight">{filteredCaseCount}</h3>
                 </div>
                 <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1">Target Resolution</p>
                    <h3 className="text-3xl font-black text-emerald-600 tracking-tight">100%</h3>
                 </div>
              </div>

              <div className="space-y-8">
                <section>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-4 px-2 flex items-center gap-2">
                    <BarChart3 size={14} className="text-blue-500" />
                    Transport-wise Summary
                  </h3>
                  <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm">
                    <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                              <th className="px-6 py-4 font-black uppercase tracking-widest text-slate-500">Vehicle Plate</th>
                              <th className="px-6 py-4 font-black uppercase tracking-widest text-slate-500">Case Count</th>
                              <th className="px-6 py-4 font-black uppercase tracking-widest text-slate-500">Total Penalty</th>
                              <th className="px-6 py-4 font-black uppercase tracking-widest text-slate-500">Common Reasons</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {statsData.map(([plate, data]) => (
                              <tr key={plate} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-black text-slate-900 text-sm tracking-tight">{plate}</td>
                                <td className="px-6 py-4">
                                    <span className={cn(
                                      "px-2.5 py-1 rounded-full text-[10px] font-bold",
                                      data.count > 2 ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"
                                    )}>{data.count} Cases</span>
                                </td>
                                <td className="px-6 py-4 font-black text-red-600 text-sm">৳{data.totalAmount.toLocaleString()}</td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                      {Array.from(new Set(data.reasons)).slice(0, 3).map((r, i) => (
                                          <span key={i} className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[9px] truncate border border-slate-200">
                                            {r}
                                          </span>
                                      ))}
                                    </div>
                                </td>
                              </tr>
                          ))}
                        </tbody>
                    </table>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-4 px-2 flex items-center gap-2">
                    <History size={14} className="text-accent" />
                    Detailed Case History
                  </h3>
                  <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm">
                    <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                              <th className="px-6 py-4 font-black uppercase tracking-widest text-slate-500">Date</th>
                              <th className="px-6 py-4 font-black uppercase tracking-widest text-slate-500">Transport & Driver</th>
                              <th className="px-6 py-4 font-black uppercase tracking-widest text-slate-500">Penalty</th>
                              <th className="px-6 py-4 font-black uppercase tracking-widest text-slate-500">Status</th>
                              <th className="px-6 py-4 font-black uppercase tracking-widest text-slate-500 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {searchFilteredCases
                            .filter(c => {
                              if (!filterDate.start && !filterDate.end) return true;
                              const caseDate = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt || Date.now());
                              if (filterDate.start && caseDate < new Date(filterDate.start)) return false;
                              if (filterDate.end) {
                                const end = new Date(filterDate.end);
                                end.setHours(23, 59, 59, 999);
                                if (caseDate > end) return false;
                              }
                              return true;
                            })
                            .sort((a, b) => {
                              const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                              const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                              return dateB - dateA;
                            })
                            .map(item => (
                              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 text-slate-500">
                                  {item.createdAt?.toDate?.().toLocaleDateString() || new Date(item.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-slate-900">{item.vehicleId}</span>
                                    <AuditDetailsDropdown createdBy={item.createdBy} updatedBy={item.updatedBy} resolvedBy={item.resolvedBy} />
                                  </div>
                                  {item.driverName && (
                                    <div className="text-[10px] text-slate-500 font-medium">
                                      {item.driverName} ({item.driverId})
                                    </div>
                                  )}
                                  <div className="text-[10px] font-mono text-slate-400 mt-1">#{item.caseId}</div>
                                </td>
                                <td className="px-6 py-4 font-bold text-slate-700">৳{item.amount.toLocaleString()}</td>
                                <td className="px-6 py-4">
                                  {item.status === 'Resolved' ? (
                                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-tighter">PAID</span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-tighter">UNPAID</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                   <div className="flex items-center justify-end gap-2">
                                     {canManageItems && (
                                       deletingId === item.id ? (
                                         <div className="flex items-center gap-1">
                                           <button onClick={() => handleDeleteCase(item.id)} className="px-2 py-1 bg-red-600 text-white text-[9px] font-black rounded-md">CONFIRM</button>
                                           <button onClick={() => setDeletingId(null)} className="px-2 py-1 bg-slate-200 text-slate-600 text-[9px] font-black rounded-md">X</button>
                                         </div>
                                       ) : (
                                         <>
                                           <button 
                                             onClick={() => startEdit(item)}
                                             className="p-1.5 rounded-lg bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                           >
                                             <Edit2 size={12} />
                                           </button>
                                           <button 
                                             onClick={() => setDeletingId(item.id)}
                                             className="p-1.5 rounded-lg bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                           >
                                             <Trash2 size={12} />
                                           </button>
                                         </>
                                       )
                                     )}
                                   </div>
                                </td>
                              </tr>
                          ))}
                        </tbody>
                    </table>
                  </div>
                </section>
              </div>
           </Card>
        </div>
      )}
    </div>
  );
};

export default CaseManagement;
