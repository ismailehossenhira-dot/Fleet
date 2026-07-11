import React, { useState, useEffect } from 'react';
import { History, Download, Filter, Search, FileText, AlertTriangle, CheckCircle2, Trash2, Edit3, X, Save } from 'lucide-react';
import { Card, Button } from './components/Common';
import { subscribeToCollection, resolveMissingReport, deleteMissingReport, deleteTrip, updateTrip } from './db';
import { cn } from './lib/utils';
import { useAuth } from './AuthContext';
import { useSearch } from './SearchContext';

const Reports: React.FC = () => {
  const { isAdmin, isSubAdmin, isChecker, profile } = useAuth();
  const { searchQuery, setSearchQuery } = useSearch();
  const canManageReports = isAdmin || isSubAdmin;
  const canResolveReports = isAdmin || isSubAdmin || isChecker;
  const [trips, setTrips] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [missingReports, setMissingReports] = useState<any[]>([]);
  const [missingHistory, setMissingHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'Archive' | 'Missing' | 'History'>('Archive');
  const [filter, setFilter] = useState('All');

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setSearchTerm(searchQuery);
  }, [searchQuery]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);

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

  const handleTripDelete = async (id: string) => {
    const trip = trips.find(t => t.id === id);
    if (!trip) return;

    if (trip.status === 'Running') {
      alert('চলমান ট্রিপ (Active Transport) মুছে ফেলা সম্ভব নয়।');
      return;
    }

    const timestamp = trip.startTime || trip.createdAt;
    if (timestamp) {
      let tripTimeMs = 0;
      if (timestamp.toDate) {
        tripTimeMs = timestamp.toDate().getTime();
      } else if (timestamp.seconds) {
        tripTimeMs = timestamp.seconds * 1000;
      } else {
        tripTimeMs = new Date(timestamp).getTime();
      }
      
      const oneDayInMs = 24 * 60 * 60 * 1000;
      if (Date.now() - tripTimeMs < oneDayInMs) {
        alert('১ দিনের কম সময়ের ট্রিপ রেকর্ড মুছে ফেলা সম্ভব নয়।');
        return;
      }
    }

    if (window.confirm('আপনি কি নিশ্চিত যে এই ট্রিপ রেকর্ডটি মুছে ফেলতে চান?')) {
      try {
        await deleteTrip(id);
      } catch (e) {
        alert('মুছে ফেলা সম্ভব হয়নি।');
      }
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Reports & Analytics</h2>
          <p className="text-slate-500">Historical data and logistical insights.</p>
        </div>
        <div className="flex gap-2">
          {canManageReports && (
            <Button variant="secondary">
              <Download size={18} />
              <span>Export CSV</span>
            </Button>
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
            {/* ... transport archive table ... */}
            <div className="flex items-center gap-4 mb-6">
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
                 <Filter size={16} className="text-text-muted" />
                 <select 
                   className="px-4 py-2 rounded-lg border border-border outline-none focus:border-accent text-xs bg-slate-50"
                   value={filter}
                   onChange={e => setFilter(e.target.value)}
                 >
                   <option value="All">All Statuses</option>
                   <option value="Running">Running Only</option>
                   <option value="Completed">Completed Only</option>
                 </select>
               </div>
            </div>

            <div className="overflow-x-auto">
             <table className="w-full text-xs text-left">
               <thead>
                 <tr className="bg-[#f8fafc] border-b border-border">
                   <th className="px-5 py-3 font-semibold text-text-muted uppercase tracking-wider">Date</th>
                   <th className="px-5 py-3 font-semibold text-text-muted uppercase tracking-wider">Vehicle ID</th>
                   <th className="px-5 py-3 font-semibold text-text-muted uppercase tracking-wider">Crew Details</th>
                   <th className="px-5 py-3 font-semibold text-text-muted uppercase tracking-wider text-right">Status</th>
                 </tr>
               </thead>
                <tbody className="divide-y divide-border">
                  {filteredTrips.map(trip => (
                    <tr key={trip.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 text-text-muted whitespace-nowrap">
                         {trip.startTime?.toDate?.().toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 font-bold text-text-main">
                        {editingTripId === trip.id ? (
                          <input 
                            className="p-1 border rounded w-24 text-[10px]"
                            value={editForm.vehiclePlate}
                            onChange={e => setEditForm({...editForm, vehiclePlate: e.target.value})}
                          />
                        ) : (
                          trip.vehiclePlate || trip.vehicleId
                        )}
                      </td>
                      <td className="px-5 py-3">
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
                      <td className="px-5 py-3 text-right">
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
                                  <button onClick={() => handleTripEdit(trip)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                                    <Edit3 size={14} />
                                  </button>
                                  <button onClick={() => handleTripDelete(trip.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete">
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
                  ))}
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
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-5 py-3 font-semibold text-slate-600 uppercase tracking-wider">Date Solved / Deleted</th>
                    <th className="px-5 py-3 font-semibold text-slate-600 uppercase tracking-wider">Vehicle & Driver</th>
                    <th className="px-5 py-3 font-semibold text-slate-600 uppercase tracking-wider">Missing Content</th>
                    <th className="px-5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {missingHistory.map(report => (
                    <tr key={report.id} className="hover:bg-slate-50/50 transition-colors opacity-75">
                      <td className="px-5 py-3 text-text-muted">
                        {report.resolvedAt?.toDate?.().toLocaleDateString() || 
                         report.deletedAt?.toDate?.().toLocaleDateString() || 
                         (report.resolvedAt ? new Date(report.resolvedAt).toLocaleDateString() : '') ||
                         (report.deletedAt ? new Date(report.deletedAt).toLocaleDateString() : '') ||
                         'N/A'}
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                         <div className="font-bold text-[11px] uppercase tracking-tight">{report.vehiclePlate}</div>
                         {report.createdBy && (
                           <div className="text-[9px] text-slate-400 font-normal mt-1">শনাক্তকারী: {report.createdBy}</div>
                         )}
                         {report.resolvedBy && (
                           <div className="text-[9px] text-emerald-600 font-semibold">সমাধানকারী: {report.resolvedBy}</div>
                         )}
                         <div className="flex items-center gap-1.5 mt-0.5">
                            <span>{report.driverName}</span>
                            <span className="text-[9px] font-bold py-0.5 px-1 bg-slate-100 text-slate-500 rounded uppercase">{report.driverId}</span>
                         </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col gap-1.5">
                           {report.missingDocuments?.length > 0 && (
                             <div className="flex flex-wrap gap-1">
                               {report.missingDocuments.map((d: string) => (
                                 <span key={d} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200 text-[9px] font-bold uppercase">
                                   {d}
                                 </span>
                               ))}
                             </div>
                           )}
                           {report.missingTools?.length > 0 && (
                             <div className="flex flex-wrap gap-1">
                               {report.missingTools.map((t: string) => (
                                 <span key={t} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200 text-[9px] font-bold uppercase">
                                   {t}
                                 </span>
                               ))}
                             </div>
                           )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                         <span className={cn(
                           "px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase shadow-sm border",
                           report.status === 'Resolved' 
                             ? "bg-emerald-50/50 text-emerald-600 border-emerald-100" 
                             : "bg-red-50/50 text-red-600 border-red-100"
                         )}>
                           {report.status}
                         </span>
                      </td>
                    </tr>
                  ))}
                  {missingHistory.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-20 text-center text-text-muted italic">
                        <p className="text-sm">No historical records found.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
};

export default Reports;
