import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Phone, Fingerprint, Edit2, Trash2 } from 'lucide-react';
import { Card, Button } from './components/Common';
import { addDriver, updateDriver, deleteDriver, subscribeToCollection } from './db';
import { STAFF_ROLES, cn } from './lib/utils';
import { useAuth } from './AuthContext';

const Drivers: React.FC = () => {
  const { isAdmin, isSubAdmin, profile } = useAuth();
  const canManage = isAdmin || isSubAdmin;
  const [drivers, setDrivers] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(() => {
    const saved = localStorage.getItem('drivers_showAdd');
    return saved ? JSON.parse(saved) : false;
  });
  const [editingDriver, setEditingDriver] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newDriver, setNewDriver] = useState(() => {
    const saved = localStorage.getItem('drivers_newDriver');
    return saved ? JSON.parse(saved) : {
      driverId: 'DRV-',
      name: '',
      phoneNumber: '',
      role: 'Driver'
    };
  });

  useEffect(() => {
    localStorage.setItem('drivers_showAdd', JSON.stringify(showAdd));
  }, [showAdd]);

  useEffect(() => {
    localStorage.setItem('drivers_newDriver', JSON.stringify(newDriver));
  }, [newDriver]);

  useEffect(() => {
    return subscribeToCollection('drivers', setDrivers);
  }, []);

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
                  <div>{driver.name}</div>
                  {driver.createdBy && (
                    <div className="text-[9px] text-slate-400 font-normal mt-0.5">এন্ট্রি: {driver.createdBy}</div>
                  )}
                  {driver.updatedBy && (
                    <div className="text-[9px] text-slate-400 font-normal">এডিট: {driver.updatedBy}</div>
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
        {canManage && (
          <Button onClick={() => setShowAdd(!showAdd)} className="shadow-lg shadow-blue-200">
            <Plus size={20} />
            <span>Register New Staff</span>
          </Button>
        )}
      </div>

      {showAdd && (
        <Card title="New Driver Enrollment" className="max-w-xl">
          <form onSubmit={handleAdd} className="space-y-4">
             <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {newDriver.role === 'Driver' ? 'Driver' : 'Helper'} Employee ID
              </label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 font-bold"
                placeholder="e.g. DRV-001"
                value={newDriver.driverId}
                onChange={e => setNewDriver({ ...newDriver, driverId: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400"
                placeholder="e.g. John Doe"
                value={newDriver.name}
                onChange={e => setNewDriver({ ...newDriver, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Staff Role</label>
              <select 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400"
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
              <input 
                type="tel" 
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400"
                placeholder="+880..."
                value={newDriver.phoneNumber}
                onChange={e => setNewDriver({ ...newDriver, phoneNumber: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1">Enroll Driver</Button>
              <Button type="button" variant="secondary" onClick={handleCancel}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {editingDriver && (
        <Card title="Edit Staff Member" className="max-w-xl">
          <form onSubmit={handleUpdate} className="space-y-4">
             <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Staff Employee ID</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 font-bold bg-slate-50"
                value={editingDriver.driverId}
                onChange={e => setEditingDriver({ ...editingDriver, driverId: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400"
                value={editingDriver.name}
                onChange={e => setEditingDriver({ ...editingDriver, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Staff Role</label>
              <select 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400"
                value={editingDriver.role || 'Driver'}
                onChange={e => setEditingDriver({ ...editingDriver, role: e.target.value as any })}
              >
                {STAFF_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
              <input 
                type="tel" 
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400"
                value={editingDriver.phoneNumber}
                onChange={e => setEditingDriver({ ...editingDriver, phoneNumber: e.target.value })}
              />
            </div>
            <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100 mt-4 pt-4">
              {deletingId === editingDriver.id ? (
                <div className="flex-1 flex gap-2">
                  <Button type="button" variant="danger" onClick={() => handleDelete(editingDriver.id)} className="flex-1">Confirm Permanent Delete</Button>
                  <Button type="button" variant="secondary" onClick={() => setDeletingId(null)} className="px-4">Cancel</Button>
                </div>
              ) : (
                <>
                  <Button type="submit" className="flex-1">Update Member</Button>
                  <Button type="button" variant="danger" onClick={() => setDeletingId(editingDriver.id)} className="flex-1 text-[10px]">Delete Member</Button>
                  <Button type="button" variant="secondary" onClick={() => setEditingDriver(null)} className="flex-1">Cancel</Button>
                </>
              )}
            </div>
          </form>
        </Card>
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
              onChange={e => setSearchTerm(e.target.value)}
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
