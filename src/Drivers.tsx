import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Phone, Fingerprint, Edit2, Trash2, ChevronDown, ChevronUp, AlertTriangle, Download, Printer } from 'lucide-react';
import { Card, Button, AuditDetailsDropdown } from './components/Common';
import { addDriver, updateDriver, deleteDriver, subscribeToCollection } from './db';
import { STAFF_ROLES, cn } from './lib/utils';
import { useAuth } from './AuthContext';
import { useSearch } from './SearchContext';
import { downloadCSV, exportPDFWindow } from './utils/exportUtils';

const SuspensionBadgeAndDetails: React.FC<{ driver: any }> = ({ driver }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-1 flex flex-col items-start gap-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-2 py-0.5 text-[9px] bg-red-100 border border-red-200 text-red-700 font-black rounded-md flex items-center gap-1 animate-pulse">
          সাসপেন্ডেড (Suspended)
        </span>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-[10px] text-blue-600 hover:text-blue-800 font-bold hover:underline inline-flex items-center gap-0.5 cursor-pointer"
        >
          <span>{isOpen ? 'Hide Details' : 'View Details'}</span>
          {isOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>
      </div>

      {isOpen && (
        <div className="mt-1 bg-red-50/40 border border-red-100/60 p-2.5 rounded-lg space-y-1 text-[10px] font-normal text-red-800 max-w-sm animate-in slide-in-from-top-1 duration-200">
          <p>
            <strong className="text-red-900 font-bold">কারণ (Reason):</strong>{' '}
            <span className="bg-white/60 px-1 py-0.5 rounded">{driver.suspensionReason || 'উল্লেখ নেই'}</span>
          </p>
          <p>
            <strong className="text-red-900 font-bold">মেয়াদ (Period):</strong>{' '}
            <span className="bg-white/60 px-1 py-0.5 rounded">{driver.suspensionDays || '0'} দিন</span>
          </p>
          <p>
            <strong className="text-red-900 font-bold">কে করেছে (Suspended By):</strong>{' '}
            <span className="bg-white/60 px-1 py-0.5 rounded">{driver.suspendedBy || 'Admin'}</span>
          </p>
        </div>
      )}
    </div>
  );
};

const Drivers: React.FC = () => {
  const { isAdmin, isSubAdmin, profile } = useAuth();
  const { searchQuery, setSearchQuery } = useSearch();
  const canManage = isAdmin || isSubAdmin;
  const [drivers, setDrivers] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setSearchTerm(searchQuery);
  }, [searchQuery]);

  const [newDriver, setNewDriver] = useState({
    driverId: 'DRV-',
    name: '',
    phoneNumber: '',
    role: 'Driver' as 'Driver' | 'Helper'
  });

  useEffect(() => {
    const unsubDrivers = subscribeToCollection('drivers', setDrivers);
    const unsubTrips = subscribeToCollection('trips', setTrips);
    return () => {
      unsubDrivers();
      unsubTrips();
    };
  }, []);

  const handleExportCSV = () => {
    const headers = [
      'Employee ID',
      'Full Name',
      'Role',
      'Contact Number',
      'Status',
      'Suspension Reason',
      'Suspension Days',
      'Suspended By',
      'Total Trips',
      'Active Trips',
      'Completed Trips'
    ];
    const rows = filtered.map(d => {
      const staffTrips = trips.filter(t => t.driverId === d.driverId || t.helperId === d.driverId);
      return [
        d.driverId,
        d.name,
        d.role || 'Driver',
        d.phoneNumber || '',
        d.isSuspended ? 'Suspended' : 'Active',
        d.suspensionReason || '',
        d.suspensionDays || '',
        d.suspendedBy || '',
        staffTrips.length.toString(),
        staffTrips.filter(t => t.status === 'Running').length.toString(),
        staffTrips.filter(t => t.status === 'Completed').length.toString()
      ];
    });
    downloadCSV(headers, rows, `Staff_Directory_Report_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportPDF = () => {
    const title = 'স্টাফ ডিরেক্টরি ও পারফরম্যান্স রিপোর্ট (Staff Directory & Performance Report)';
    const subtitle = 'নিবন্ধিত ড্রাইভার ও হেলপারদের বিবরণ, ট্রিপ পরিসংখ্যান এবং বর্তমান সাসপেনশন স্ট্যাটাস।';
    const metadata = [
      { label: 'মোট স্টাফ (Total Staff)', value: `${filtered.length} জন` },
      { label: 'মোট ড্রাইভার (Drivers)', value: `${filtered.filter(d => (d.role || 'Driver') === 'Driver').length} জন` },
      { label: 'মোট হেলপার (Helpers)', value: `${filtered.filter(d => d.role === 'Helper').length} জন` },
      { label: 'সাসপেন্ডেড স্টাফ (Suspended)', value: `${filtered.filter(d => d.isSuspended).length} জন` }
    ];
    const headers = ['আইডি (Employee ID)', 'নাম ও পদবি (Name & Role)', 'মোবাইল (Contact)', 'ট্রিপ পরিসংখ্যান (Trip Stats)', 'অবস্থা (Status)'];
    const rows = filtered.map(d => {
      const staffTrips = trips.filter(t => t.driverId === d.driverId || t.helperId === d.driverId);
      const tRun = staffTrips.filter(t => t.status === 'Running').length;
      const tComp = staffTrips.filter(t => t.status === 'Completed').length;
      const tTotal = staffTrips.length;
      
      const statusBadge = d.isSuspended 
        ? `<span class="badge badge-suspended">Suspended</span><br/><span style="font-size:9px;color:#ef4444">কারণ: ${d.suspensionReason || 'উল্লেখ নেই'} (${d.suspensionDays || 0} দিন)</span>`
        : '<span class="badge badge-active">Active</span>';

      return [
        `<strong>${d.driverId}</strong>`,
        `<strong>${d.name}</strong><br/><span style="color:#64748b;font-size:10px">${d.role || 'Driver'}</span>`,
        d.phoneNumber || '-',
        `মোট: ${tTotal} | চলমান: ${tRun} | সম্পন্ন: ${tComp}`,
        statusBadge
      ];
    });
    exportPDFWindow(title, subtitle, metadata, headers, rows);
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCancel = () => {
    setShowAdd(false);
    setNewDriver({ driverId: 'DRV-', name: '', phoneNumber: '', role: 'Driver' });
    localStorage.removeItem('drivers_newDriver');
    localStorage.removeItem('drivers_showAdd');
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriver.driverId || !newDriver.name) return;
    const normalizedDriver = {
      ...newDriver,
      driverId: newDriver.driverId.trim().toUpperCase()
    };
    await addDriver(normalizedDriver, profile);
    setNewDriver({ driverId: 'DRV-', name: '', phoneNumber: '', role: 'Driver' });
    setShowAdd(false);
    localStorage.removeItem('drivers_newDriver');
    localStorage.removeItem('drivers_showAdd');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver || !editingDriver.driverId || !editingDriver.name) return;
    
    const { id, createdAt, ...updateData } = editingDriver;
    const normalized = {
      ...updateData,
      driverId: updateData.driverId.trim().toUpperCase()
    };
    
    await updateDriver(id, normalized, profile);
    setEditingDriver(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDriver(id);
      if (editingDriver && editingDriver.id === id) {
        setEditingDriver(null);
      }
      setDeletingId(null);
    } catch (error: any) {
      console.error('Delete error:', error);
      alert('Failed to delete staff: ' + (error.message || 'Unknown error. Check console.'));
    }
  };

  const [activeTab, setActiveTab] = useState<'All' | 'Driver' | 'Helper'>('All');

  const filtered = drivers.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.driverId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const driversList = filtered.filter(d => (d.role || 'Driver') === 'Driver');
  const helpersList = filtered.filter(d => d.role === 'Helper');

  const StaffTable = ({ data, title }: { data: any[], title: string }) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
          <span className={cn("w-1.5 h-4 rounded-full", title === 'Drivers' ? "bg-blue-500" : "bg-purple-500")} />
          {title}
          <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">{data.length}</span>
        </h3>
      </div>
      <div className="overflow-x-auto border border-slate-100 rounded-xl">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-5 py-3 font-semibold text-slate-500 uppercase tracking-wider">Employee ID</th>
              <th className="px-5 py-3 font-semibold text-slate-500 uppercase tracking-wider">Full Name</th>
              <th className="px-5 py-3 font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
              <th className="px-5 py-3 font-semibold text-slate-500 uppercase tracking-wider">Join Date</th>
              <th className="px-5 py-3 font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map(driver => (
              <tr key={driver.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-5 py-3">
                   <span className="font-bold text-accent uppercase tracking-tight">{driver.driverId}</span>
                </td>
                <td className="px-5 py-3 font-bold text-slate-800">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>{driver.name}</span>
                    <AuditDetailsDropdown createdBy={driver.createdBy} updatedBy={driver.updatedBy} />
                  </div>
                  {driver.isSuspended && (
                    <SuspensionBadgeAndDetails driver={driver} />
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Phone size={14} className="opacity-50" />
                    <span className="font-medium tracking-tight">{driver.phoneNumber}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-slate-400">
                  {driver.createdAt?.toDate?.().toLocaleDateString() || 'N/A'}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {canManage && (
                      deletingId === driver.id ? (
                        <div className="flex items-center gap-1 animate-in slide-in-from-right-1 duration-300">
                          <button 
                            onClick={() => handleDelete(driver.id)}
                            className="px-2 py-1 rounded-lg bg-red-600 text-white text-[9px] font-bold shadow-sm"
                          >
                            Confirm?
                          </button>
                          <button 
                            onClick={() => setDeletingId(null)}
                            className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[9px] border border-slate-200"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <>
                          <button 
                            onClick={() => { setEditingDriver(driver); setDeletingId(null); }}
                            className="p-1.5 rounded-lg bg-white border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-100 hover:bg-blue-50 transition-all"
                            title="Edit"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button 
                            onClick={() => setDeletingId(driver.id)}
                            className="p-1.5 rounded-lg bg-white border border-slate-100 text-slate-400 hover:text-red-600 hover:border-red-100 hover:bg-red-50 transition-all"
                            title="Delete"
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
            {data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-slate-400 italic bg-slate-50/30">
                  No {title.toLowerCase()} found matching criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Staff Directory</h2>
          <p className="text-sm text-slate-500">Manage all registered drivers and helpers.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canManage && (
            <>
              <Button variant="secondary" onClick={handleExportCSV}>
                <Download size={18} />
                <span>Export CSV</span>
              </Button>
              <Button variant="secondary" onClick={handleExportPDF}>
                <Printer size={18} />
                <span>Export PDF</span>
              </Button>
              <Button onClick={() => setShowAdd(!showAdd)} className="shadow-lg shadow-blue-200">
                <Plus size={20} />
                <span>Register New Staff</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Add Staff Modal (Hidden by default, shown on demand) */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-2xl md:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base md:text-lg">
                    নতুন স্টাফ এন্ট্রি (Register New Staff)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">ড্রাইভার বা হেলপার যোগ করার ফর্ম</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={handleCancel}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition-colors font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Form */}
            <div className="overflow-y-auto p-6">
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    স্টাফ পদবি (Staff Role)
                  </label>
                  <select 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 font-medium"
                    value={newDriver.role}
                    onChange={e => {
                      const role = e.target.value;
                      let defaultId = newDriver.driverId;
                      if (role === 'Driver') {
                        if (!defaultId || defaultId === 'HLP-' || defaultId === 'DRV-' || defaultId.trim() === '') {
                          defaultId = 'DRV-';
                        } else if (defaultId.startsWith('HLP-')) {
                          defaultId = 'DRV-' + defaultId.slice(4);
                        } else if (!defaultId.startsWith('DRV-')) {
                          defaultId = 'DRV-' + defaultId;
                        }
                      } else if (role === 'Helper') {
                        if (!defaultId || defaultId === 'DRV-' || defaultId === 'HLP-' || defaultId.trim() === '') {
                          defaultId = 'HLP-';
                        } else if (defaultId.startsWith('DRV-')) {
                          defaultId = 'HLP-' + defaultId.slice(4);
                        } else if (!defaultId.startsWith('HLP-')) {
                          defaultId = 'HLP-' + defaultId;
                        }
                      }
                      setNewDriver({ ...newDriver, role: role as any, driverId: defaultId });
                    }}
                  >
                    {STAFF_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {newDriver.role === 'Driver' ? 'Driver' : 'Helper'} Employee ID
                  </label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 font-bold tracking-wide"
                    placeholder="e.g. DRV-001"
                    value={newDriver.driverId}
                    onChange={e => setNewDriver({ ...newDriver, driverId: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">পূর্ণ নাম (Full Name)</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400"
                    placeholder="e.g. মোঃ করিম উদ্দিন"
                    value={newDriver.name}
                    onChange={e => setNewDriver({ ...newDriver, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">মোবাইল নম্বর (Phone Number)</label>
                  <input 
                    type="tel" 
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400"
                    placeholder="017XXXXXXXX"
                    value={newDriver.phoneNumber}
                    onChange={e => setNewDriver({ ...newDriver, phoneNumber: e.target.value })}
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <Button type="submit" className="flex-1 shadow-md shadow-blue-200">
                    <Plus size={18} />
                    <span>নতুন স্টাফ সংরক্ষণ করুন</span>
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleCancel}>
                    বাতিল (Cancel)
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Staff Modal (Hidden by default, shown on demand) */}
      {editingDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-white rounded-2xl md:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <Edit2 size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base md:text-lg">
                    স্টাফ তথ্য এডিট (Edit Staff)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {editingDriver.name} — <span className="font-bold text-blue-600">{editingDriver.driverId}</span>
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setEditingDriver(null)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition-colors font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Form */}
            <div className="overflow-y-auto p-6">
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">স্টাফ পদবি (Staff Role)</label>
                    <select 
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 font-medium"
                      value={editingDriver.role || 'Driver'}
                      onChange={e => setEditingDriver({ ...editingDriver, role: e.target.value as any })}
                    >
                      {STAFF_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">স্টাফ Employee ID</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 font-bold bg-slate-50"
                      value={editingDriver.driverId}
                      onChange={e => setEditingDriver({ ...editingDriver, driverId: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">পূর্ণ নাম (Full Name)</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400"
                    value={editingDriver.name}
                    onChange={e => setEditingDriver({ ...editingDriver, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">মোবাইল নম্বর (Phone Number)</label>
                  <input 
                    type="tel" 
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400"
                    value={editingDriver.phoneNumber}
                    onChange={e => setEditingDriver({ ...editingDriver, phoneNumber: e.target.value })}
                  />
                </div>

                {/* Suspension Control Section */}
                <div className="p-4 rounded-xl border border-slate-150 bg-slate-50/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        সাসপেনশন কন্ট্রোল (Suspension Control)
                      </h4>
                      <p className="text-[10px] text-slate-500">স্টাফ সাময়িকভাবে বরখাস্ত বা সাসপেন্ড করার জন্য</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={!!editingDriver.isSuspended}
                        onChange={e => {
                          const suspended = e.target.checked;
                          setEditingDriver({
                            ...editingDriver,
                            isSuspended: suspended,
                            suspensionDays: suspended ? (editingDriver.suspensionDays || 7) : null,
                            suspensionReason: suspended ? (editingDriver.suspensionReason || '') : null,
                            suspendedBy: suspended ? (editingDriver.suspendedBy || profile?.email || 'Admin') : null,
                          });
                        }}
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
                    </label>
                  </div>

                  {editingDriver.isSuspended && (
                    <div className="space-y-3 pt-2 border-t border-slate-200/60 animate-in fade-in duration-200">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">সাসপেনশন মেয়াদ (দিন)</label>
                          <input 
                            type="number" 
                            min={1}
                            required
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:border-red-400"
                            placeholder="e.g. 7"
                            value={editingDriver.suspensionDays || ''}
                            onChange={e => {
                              const days = parseInt(e.target.value) || 0;
                              setEditingDriver({ ...editingDriver, suspensionDays: days });
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">সাসপেন্ডকারী</label>
                          <input 
                            type="text" 
                            disabled
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-100 outline-none text-slate-500 font-medium"
                            value={editingDriver.suspendedBy || profile?.email || 'Admin'}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">সাসপেন্ডের কারণ / Reason</label>
                        <textarea 
                          required
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:border-red-400 bg-white"
                          placeholder="e.g. ডিউটি অবহেলা বা নিয়ম ভঙ্গ করা"
                          rows={2}
                          value={editingDriver.suspensionReason || ''}
                          onChange={e => setEditingDriver({ ...editingDriver, suspensionReason: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-100">
                  {deletingId === editingDriver.id ? (
                    <div className="flex-1 flex gap-2">
                      <Button type="button" variant="danger" onClick={() => handleDelete(editingDriver.id)} className="flex-1">
                        নিশ্চিত মুছুন (Confirm Delete)
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => setDeletingId(null)} className="px-4">
                        বাতিল
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Button type="submit" className="flex-1 shadow-md shadow-blue-200">
                        আপডেট করুন (Update)
                      </Button>
                      <Button type="button" variant="danger" onClick={() => setDeletingId(editingDriver.id)} className="px-4 text-xs">
                        মুছুন (Delete)
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => setEditingDriver(null)}>
                        বাতিল
                      </Button>
                    </>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 bg-[#f8fafc] p-2 px-4 rounded-xl border border-border flex-1">
            <Search size={16} className="text-text-muted" />
            <input 
              type="text"
              placeholder="Search staff by ID or name..."
              className="bg-transparent border-none outline-none w-full text-xs py-1"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setSearchQuery(e.target.value);
              }}
            />
          </div>
          
          <div className="flex p-1 bg-slate-100 rounded-xl">
             {(['All', 'Driver', 'Helper'] as const).map(tab => (
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
                 {tab}
               </button>
             ))}
          </div>
        </div>

        <div className="space-y-8">
          {(activeTab === 'All' || activeTab === 'Driver') && (
            <StaffTable data={driversList} title="Drivers" />
          )}
          
          {(activeTab === 'All' || activeTab === 'Helper') && (
            <StaffTable data={helpersList} title="Helpers" />
          )}
        </div>
      </Card>
    </div>
  );
};

export default Drivers;
