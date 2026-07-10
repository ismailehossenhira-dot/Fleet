import React, { useState, useEffect, useMemo } from 'react';
import { FileWarning, Plus, Trash2, ShieldAlert, CheckCircle2, History, BarChart3, Edit2 } from 'lucide-react';
import { Card, Button } from './components/Common';
import { addCase, resolveCase, subscribeToCollection, updateCase, deleteCase, findStaffById } from './db';
import { DOCUMENT_TYPES, cn } from './lib/utils';
import { useAuth } from './AuthContext';

const CaseManagement: React.FC = () => {
  const { isAdmin, isSubAdmin, isChecker } = useAuth();
  const canManageItems = isAdmin || isSubAdmin;
  const canSubmit = isAdmin || isSubAdmin || isChecker;
  const [cases, setCases] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'Active' | 'Stats'>('Active');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState({ start: '', end: '' });
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [newCase, setNewCase] = useState({
    vehicleId: '',
    driverId: '',
    driverName: '',
    driverPhone: '',
    caseId: '',
    amount: 0,
    reason: '',
    seizedDocuments: [] as string[]
  });

  useEffect(() => {
    const unsubCases = subscribeToCollection('cases', setCases);
    const unsubVehicles = subscribeToCollection('vehicles', setVehicles);
    return () => {
      unsubCases();
      unsubVehicles();
    };
  }, []);

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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCase.vehicleId || !newCase.caseId) return;
    
    if (editingId) {
      await updateCase(editingId, newCase);
    } else {
      await addCase(newCase);
    }
    
    setShowAdd(false);
    setEditingId(null);
    setNewCase({ vehicleId: '', driverId: '', driverName: '', driverPhone: '', caseId: '', amount: 0, reason: '', seizedDocuments: [] });
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Case (Mamla) Management</h2>
          <p className="text-sm text-slate-500">Track and monitor documents seized under legal cases.</p>
        </div>
        <div className="flex items-center gap-2">
           <div className="flex p-1 bg-slate-100 rounded-xl mr-2">
             {(['Active', 'Stats'] as const).map(tab => (
               <button
                 key={tab}
                 onClick={() => setActiveTab(tab)}
                 className={cn(
                   "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                   activeTab === tab 
                     ? "bg-white text-slate-900 shadow-sm" 
                     : "text-slate-500 hover:text-slate-700"
                 )}
               >
                 {tab === 'Active' ? 'Active Cases' : 'Case Records'}
               </button>
             ))}
           </div>
           {canSubmit && (
             <Button variant="danger" onClick={() => { 
               const nextShow = !showAdd;
               setShowAdd(nextShow); 
               if (nextShow) {
                 setEditingId(null);
                 setVehicleSearch('');
                 setNewCase({ vehicleId: '', driverId: '', driverName: '', driverPhone: '', caseId: '', amount: 0, reason: '', seizedDocuments: [] });
               }
             }} className="shadow-lg shadow-red-100">
               <FileWarning size={20} />
               <span>{editingId ? 'Edit Case Record' : 'Record New Case'}</span>
             </Button>
           )}
        </div>
      </div>

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

      {showAdd && (
        <Card title={editingId ? "Update Case Information" : "Register Documents Under Case"} className="max-w-2xl border-red-100 shadow-xl shadow-red-50">
           <form onSubmit={handleAdd} className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="relative">
                 <label className="block text-sm font-medium text-slate-700 mb-1">Select Vehicle</label>
                 <div className="relative">
                   <input 
                     type="text"
                     placeholder="Search by last 4 digits (e.g. 1234)"
                     className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400"
                     value={vehicleSearch}
                     onFocus={() => setShowVehicleDropdown(true)}
                     onChange={e => {
                       setVehicleSearch(e.target.value);
                       if (newCase.vehicleId) setNewCase({ ...newCase, vehicleId: '' });
                       setShowVehicleDropdown(true);
                     }}
                   />
                   {showVehicleDropdown && (
                     <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                       {filteredVehicles.length > 0 ? (
                         filteredVehicles.map(v => (
                           <button
                             key={v.id}
                             type="button"
                             className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 flex items-center justify-between"
                             onClick={() => {
                               setNewCase({ ...newCase, vehicleId: v.vehicleNumber });
                               setVehicleSearch(v.vehicleNumber);
                               setShowVehicleDropdown(false);
                             }}
                           >
                             <span className="font-bold text-slate-900">{v.vehicleNumber}</span>
                             <span className="text-[10px] font-mono text-slate-400">Last 4: {v.vehicleNumber.slice(-4)}</span>
                           </button>
                         ))
                       ) : (
                         <div className="px-4 py-3 text-sm text-slate-500 italic">No vehicles found</div>
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
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Driver ID (Lookup)</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400"
                    placeholder="e.g. DRV-001"
                    value={newCase.driverId}
                    onChange={e => handleLookupDriver(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Driver Name</label>
                    <input 
                      type="text" 
                      readOnly
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50 outline-none text-slate-500"
                      value={newCase.driverName}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                    <input 
                      type="text" 
                      readOnly
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50 outline-none text-slate-500"
                      value={newCase.driverPhone}
                    />
                  </div>
                </div>
               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Case / GD ID</label>
                 <input 
                   type="text" 
                   required
                   className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400"
                   placeholder="e.g. CS-9942"
                   value={newCase.caseId}
                   onChange={e => setNewCase({ ...newCase, caseId: e.target.value })}
                 />
               </div>
               <div className="md:col-span-2">
                 <label className="block text-sm font-medium text-slate-700 mb-1">Reason (মামলার কারণ)</label>
                 <textarea 
                   className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400"
                   placeholder="মামলার কারণ বিস্তারিত লিখুন..."
                   rows={2}
                   value={newCase.reason}
                   onChange={e => setNewCase({ ...newCase, reason: e.target.value })}
                 />
               </div>
               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Penalty Amount</label>
                 <input 
                   type="number" 
                   className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400"
                   value={newCase.amount}
                   onChange={e => setNewCase({ ...newCase, amount: Number(e.target.value) })}
                 />
               </div>
             </div>

             <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">Seized Documents (Under Case)</label>
                <div className="flex flex-wrap gap-2">
                  {DOCUMENT_TYPES.map(doc => (
                    <button
                      key={doc}
                      type="button"
                      onClick={() => handleToggleDoc(doc)}
                      className={cn(
                        "px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                        newCase.seizedDocuments.includes(doc)
                         ? "bg-red-600 border-red-600 text-white shadow-sm"
                         : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {doc}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-400 italic">Selected documents will be hidden from normal trip checklists.</p>
             </div>

             <div className="flex gap-3">
               <Button type="submit" variant="danger" className="flex-1">{editingId ? 'Update Record' : 'Flag Documents'}</Button>
               <Button type="button" variant="secondary" onClick={() => { setShowAdd(false); setEditingId(null); setVehicleSearch(''); }}>Cancel</Button>
             </div>
           </form>
        </Card>
      )}

      {activeTab === 'Active' ? (
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
                  {cases.filter(c => (c.status || 'Open') === 'Open').map(item => (
                    <tr key={item.id} className="hover:bg-red-50/20 transition-colors">
                      <td className="px-5 py-3 align-top">
                         <div className="font-black text-slate-900 text-sm whitespace-nowrap">{item.vehicleId}</div>
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
                             onClick={() => resolveCase(item.id)}
                           >
                             Resolve
                           </button>
                         )}
                      </td>
                    </tr>
                  ))}
                  {cases.filter(c => (c.status || 'Open') === 'Open').length === 0 && (
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
                          {cases
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
                                  <div className="font-bold text-slate-900">{item.vehicleId}</div>
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
