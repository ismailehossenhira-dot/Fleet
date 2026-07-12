import React, { useState, useEffect } from 'react';
import { Truck, Plus, Search, Trash2, Settings2, Edit2, QrCode, Download, Printer } from 'lucide-react';
import { Card, Button } from './components/Common';
import { addVehicle, updateVehicle, deleteVehicle, subscribeToCollection, updateVehicleStatus } from './db';
import { VEHICLE_TYPES, VEHICLE_STATUSES, cn } from './lib/utils';
import { useAuth } from './AuthContext';
import { useSearch } from './SearchContext';
import { QRCodeCanvas } from 'qrcode.react';

const Vehicles: React.FC = () => {
  const { isAdmin, isSubAdmin, profile } = useAuth();
  const { searchQuery, setSearchQuery } = useSearch();
  const canManage = isAdmin || isSubAdmin;
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(() => {
    const saved = localStorage.getItem('vehicles_showAdd');
    return saved ? JSON.parse(saved) : false;
  });
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setSearchTerm(searchQuery);
  }, [searchQuery]);
  const [newVehicle, setNewVehicle] = useState(() => {
    const saved = localStorage.getItem('vehicles_newVehicle');
    return saved ? JSON.parse(saved) : {
      vehicleNumber: '',
      type: 'Medium',
      status: 'Available',
      maintenanceNotes: ''
    };
  });

  useEffect(() => {
    localStorage.setItem('vehicles_showAdd', JSON.stringify(showAdd));
  }, [showAdd]);

  useEffect(() => {
    localStorage.setItem('vehicles_newVehicle', JSON.stringify(newVehicle));
  }, [newVehicle]);

  const [selectedQRVehicle, setSelectedQRVehicle] = useState<any | null>(null);

  const downloadQR = (canvasId: string, filename: string) => {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = filename;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const printQR = (canvasId: string, vehiclePlate: string, type: 'IN' | 'OUT') => {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL("image/png");
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Print QR - ${vehiclePlate}</title>
              <style>
                body {
                  font-family: 'Inter', sans-serif;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                  background-color: white;
                }
                .card {
                  border: 3px solid ${type === 'OUT' ? '#10b981' : '#6366f1'};
                  border-radius: 20px;
                  padding: 40px;
                  text-align: center;
                  max-width: 400px;
                  box-shadow: 0 10px 25px rgba(0,0,0,0.05);
                }
                .plate {
                  font-size: 24px;
                  font-weight: 800;
                  color: #1e293b;
                  margin-bottom: 20px;
                  letter-spacing: -0.025em;
                }
                .qr-image {
                  width: 250px;
                  height: 250px;
                  margin: 20px 0;
                }
                .label {
                  font-size: 18px;
                  font-weight: 700;
                  color: ${type === 'OUT' ? '#059669' : '#4f46e5'};
                  text-transform: uppercase;
                  letter-spacing: 0.1em;
                }
                .instructions {
                  font-size: 14px;
                  color: #64748b;
                  margin-top: 15px;
                  line-height: 1.5;
                }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="label">${type === 'OUT' ? 'OUT QR - DISPATCH' : 'IN QR - RETURN'}</div>
                <img class="qr-image" src="${url}" />
                <div class="plate">${vehiclePlate}</div>
                <div class="instructions">
                  ${type === 'OUT' 
                    ? 'Scan to register vehicle dispatch (Start Trip)' 
                    : 'Scan to register vehicle return (Complete Trip)'}
                </div>
              </div>
              <script>
                window.onload = function() {
                  window.print();
                  setTimeout(function() { window.close(); }, 500);
                };
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    }
  };

  const [typeFilter, setTypeFilter] = useState('All');

  useEffect(() => {
    const unsubVehicles = subscribeToCollection('vehicles', setVehicles);
    const unsubTrips = subscribeToCollection('trips', setTrips);
    return () => {
      unsubVehicles();
      unsubTrips();
    };
  }, []);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCancel = () => {
    setShowAdd(false);
    setNewVehicle({ vehicleNumber: '', type: 'Medium', status: 'Available', maintenanceNotes: '' });
    localStorage.removeItem('vehicles_newVehicle');
    localStorage.removeItem('vehicles_showAdd');
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicle.vehicleNumber) return;
    const normalizedVehicle = {
      ...newVehicle,
      vehicleNumber: newVehicle.vehicleNumber.trim().toUpperCase()
    };
    if (normalizedVehicle.status !== 'Maintenance') {
      normalizedVehicle.maintenanceNotes = '';
    }
    await addVehicle(normalizedVehicle, profile);
    setNewVehicle({ vehicleNumber: '', type: 'Medium', status: 'Available', maintenanceNotes: '' });
    setShowAdd(false);
    localStorage.removeItem('vehicles_newVehicle');
    localStorage.removeItem('vehicles_showAdd');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle || !editingVehicle.vehicleNumber) return;
    const normalized = {
      ...editingVehicle,
      vehicleNumber: editingVehicle.vehicleNumber.trim().toUpperCase()
    };
    if (normalized.status !== 'Maintenance') {
      normalized.maintenanceNotes = '';
    }
    // Exclude id from the object sent to updateVehicle
    const { id, createdAt, updatedAt, ...updateData } = normalized;
    await updateVehicle(id, updateData, profile);
    setEditingVehicle(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteVehicle(id);
      if (editingVehicle && editingVehicle.id === id) {
        setEditingVehicle(null);
      }
      setDeletingId(null);
    } catch (error: any) {
      console.error('Delete error:', error);
      alert('Failed to delete: ' + (error.message || 'Unknown error'));
    }
  };

  const computedVehicles = vehicles.map(v => {
    if (v.status === 'Maintenance') {
      return v;
    }
    const hasRunningTrip = trips.some(t => t.vehicleId === v.id && t.status === 'Running');
    if (hasRunningTrip) {
      return { ...v, status: 'On Trip' };
    }
    const hasPendingTrip = trips.some(t => t.vehicleId === v.id && t.status === 'Pending');
    if (hasPendingTrip) {
      return { ...v, status: 'Pending Out Scan' };
    }
    return { ...v, status: 'Available' };
  });

  const filtered = computedVehicles.filter(v => 
    (v.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (typeFilter === 'All' || v.type === typeFilter)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Vehicle Management</h2>
          <p className="text-slate-500">Register and manage your fleet inventory.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setTypeFilter(typeFilter === 'All' ? 'Small' : typeFilter === 'Small' ? 'Medium' : typeFilter === 'Medium' ? 'Large' : 'All')}>
            Filter: {typeFilter}
          </Button>
          {canManage && (
            <Button onClick={() => setShowAdd(!showAdd)}>
              <Plus size={20} />
              <span>Add New Vehicle</span>
            </Button>
          )}
        </div>
      </div>

      {showAdd && (
        <Card title="Register New Vehicle" className="max-w-xl">
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle Number (Plate)</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all outline-none"
                placeholder="e.g. DHAKA-METRO-KA-12-3456"
                value={newVehicle.vehicleNumber}
                onChange={e => setNewVehicle({ ...newVehicle, vehicleNumber: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle Type</label>
                <select 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400"
                  value={newVehicle.type}
                  onChange={e => setNewVehicle({ ...newVehicle, type: e.target.value as any })}
                >
                  {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400"
                  value={newVehicle.status}
                  onChange={e => setNewVehicle({ ...newVehicle, status: e.target.value as any })}
                >
                  {VEHICLE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            {newVehicle.status === 'Maintenance' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">গাড়ির সমস্যা / মেইনটেনেন্স নোট (Maintenance Notes / Problems)</label>
                <textarea 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all outline-none text-xs"
                  placeholder="আসলে গাড়ির কি কি সমস্যা রয়েছে লিখুন..."
                  value={newVehicle.maintenanceNotes || ''}
                  onChange={e => setNewVehicle({ ...newVehicle, maintenanceNotes: e.target.value })}
                  rows={3}
                />
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1">Save Vehicle</Button>
              <Button type="button" variant="secondary" onClick={handleCancel}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {editingVehicle && (
        <Card title={`Edit Vehicle: ${editingVehicle.vehicleNumber}`} className="max-w-xl">
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle Number (Plate)</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all outline-none"
                value={editingVehicle.vehicleNumber}
                onChange={e => setEditingVehicle({ ...editingVehicle, vehicleNumber: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle Type</label>
                <select 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400"
                  value={editingVehicle.type}
                  onChange={e => setEditingVehicle({ ...editingVehicle, type: e.target.value as any })}
                >
                  {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400"
                  value={editingVehicle.status}
                  onChange={e => setEditingVehicle({ ...editingVehicle, status: e.target.value as any })}
                >
                  {VEHICLE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            {editingVehicle.status === 'Maintenance' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">গাড়ির সমস্যা / মেইনটেনেন্স নোট (Maintenance Notes / Problems)</label>
                <textarea 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all outline-none text-xs"
                  placeholder="আসলে গাড়ির কি কি সমস্যা রয়েছে লিখুন..."
                  value={editingVehicle.maintenanceNotes || ''}
                  onChange={e => setEditingVehicle({ ...editingVehicle, maintenanceNotes: e.target.value })}
                  rows={3}
                />
              </div>
            )}
            <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100 mt-4 pt-4">
              {deletingId === editingVehicle.id ? (
                <div className="flex-1 flex gap-2">
                  <Button type="button" variant="danger" onClick={() => handleDelete(editingVehicle.id)} className="flex-1">Confirm Permanent Delete</Button>
                  <Button type="button" variant="secondary" onClick={() => setDeletingId(null)} className="px-4">Cancel</Button>
                </div>
              ) : (
                <>
                  <Button type="submit" className="flex-1">Update Vehicle</Button>
                  <Button type="button" variant="danger" onClick={() => setDeletingId(editingVehicle.id)} className="flex-1 text-[10px]">Delete Vehicle</Button>
                  <Button type="button" variant="secondary" onClick={() => setEditingVehicle(null)} className="flex-1">Cancel</Button>
                </>
              )}
            </div>
          </form>
        </Card>
      )}

      <Card>
        <div className="flex items-center gap-3 mb-6 bg-[#f8fafc] p-2 px-4 rounded-lg border border-border">
          <Search size={16} className="text-text-muted" />
          <input 
            type="text"
            placeholder="Search by vehicle number..."
            className="bg-transparent border-none outline-none w-full text-xs py-1"
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setSearchQuery(e.target.value);
            }}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-border">
                <th className="px-5 py-3 font-semibold text-text-muted uppercase tracking-wider">Vehicle ID</th>
                <th className="px-5 py-3 font-semibold text-text-muted uppercase tracking-wider">Type</th>
                <th className="px-5 py-3 font-semibold text-text-muted uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 font-semibold text-text-muted uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(vehicle => (
                <tr key={vehicle.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-bold text-text-main">
                    <div>{vehicle.vehicleNumber}</div>
                    {vehicle.createdBy && (
                      <div className="text-[9px] text-slate-400 font-normal mt-0.5">এন্ট্রি: {vehicle.createdBy}</div>
                    )}
                    {vehicle.updatedBy && (
                      <div className="text-[9px] text-slate-400 font-normal">এডিট: {vehicle.updatedBy}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-text-muted">{vehicle.type}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase w-fit",
                        vehicle.status === 'Available' ? "bg-emerald-100 text-emerald-700" :
                        vehicle.status === 'On Trip' ? "bg-blue-100 text-blue-700" :
                        vehicle.status === 'Pending Out Scan' ? "bg-amber-100 text-amber-700" :
                        "bg-orange-100 text-orange-700"
                      )}>
                        {vehicle.status}
                      </span>
                      {vehicle.status === 'Maintenance' && vehicle.maintenanceNotes && (
                        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100/50 px-2 py-1 rounded font-medium italic block max-w-xs whitespace-pre-wrap break-words mt-1" title={vehicle.maintenanceNotes}>
                          সমস্যা: {vehicle.maintenanceNotes}
                        </span>
                      )}
                    </div>
                  </td>
                   <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setSelectedQRVehicle(vehicle)}
                        className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-indigo-500 hover:text-white transition-colors"
                        title="View & Print QR Codes"
                      >
                        <QrCode size={12} />
                      </button>
                      {canManage && (
                        deletingId === vehicle.id ? (
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleDelete(vehicle.id)}
                              className="px-2 py-1 rounded bg-red-500 text-white text-[9px] font-bold"
                            >
                              Delete?
                            </button>
                            <button 
                              onClick={() => setDeletingId(null)}
                              className="px-2 py-1 rounded bg-slate-200 text-slate-600 text-[9px]"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <>
                            <button 
                              onClick={() => { setEditingVehicle(vehicle); setDeletingId(null); }}
                              className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-blue-500 hover:text-white transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button 
                              onClick={() => setDeletingId(vehicle.id)}
                              className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-red-500 hover:text-white transition-colors"
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
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-text-muted italic">
                    No vehicles found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* QR Codes Modal */}
      {selectedQRVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                  <QrCode className="text-indigo-600" />
                  <span>গাড়ির কিউআর কোড (QR Codes): {selectedQRVehicle.vehicleNumber}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">গাড়ি ছাড়ার এবং ফেরত রিসিভ করার জন্য আলাদা কিউআর কোড ডাউনলোড বা প্রিন্ট করুন।</p>
              </div>
              <button 
                onClick={() => setSelectedQRVehicle(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Content (Scrollable if needed) */}
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. OUT QR Card */}
                <div className="border-2 border-emerald-100 rounded-2xl p-5 bg-emerald-50/20 text-center flex flex-col justify-between items-center space-y-4">
                  <div>
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px] uppercase tracking-wider">
                      OUT QR (গাড়ি ছাড়পত্র)
                    </span>
                    <p className="text-[11px] text-slate-500 mt-2">স্টক ছাড় দিয়ে ট্রিপ শুরু করার জন্য স্ক্যান করুন।</p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm inline-block">
                    <QRCodeCanvas 
                      id={`qr-out-${selectedQRVehicle.id}`}
                      value={`fleetflow://vehicle/OUT/${selectedQRVehicle.id}`}
                      size={180}
                      level="H"
                      includeMargin={true}
                    />
                  </div>

                  <div className="w-full space-y-2">
                    <Button 
                      onClick={() => downloadQR(`qr-out-${selectedQRVehicle.id}`, `OUT_QR_${selectedQRVehicle.vehicleNumber}.png`)}
                      variant="secondary" 
                      className="w-full text-xs font-bold text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                    >
                      <Download size={14} /> ডাউনলোড করুন (Download)
                    </Button>
                    <Button 
                      onClick={() => printQR(`qr-out-${selectedQRVehicle.id}`, selectedQRVehicle.vehicleNumber, 'OUT')}
                      className="w-full text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 border-none"
                    >
                      <Printer size={14} /> প্রিন্ট করুন (Print Card)
                    </Button>
                  </div>
                </div>

                {/* 2. IN QR Card */}
                <div className="border-2 border-indigo-100 rounded-2xl p-5 bg-indigo-50/20 text-center flex flex-col justify-between items-center space-y-4">
                  <div>
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full font-bold text-[10px] uppercase tracking-wider">
                      IN QR (গাড়ি ফেরত)
                    </span>
                    <p className="text-[11px] text-slate-500 mt-2">গাড়ি গ্যারেজে ফেরত ও স্টক এন্ট্রি করার জন্য স্ক্যান করুন।</p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm inline-block">
                    <QRCodeCanvas 
                      id={`qr-in-${selectedQRVehicle.id}`}
                      value={`fleetflow://vehicle/IN/${selectedQRVehicle.id}`}
                      size={180}
                      level="H"
                      includeMargin={true}
                    />
                  </div>

                  <div className="w-full space-y-2">
                    <Button 
                      onClick={() => downloadQR(`qr-in-${selectedQRVehicle.id}`, `IN_QR_${selectedQRVehicle.vehicleNumber}.png`)}
                      variant="secondary" 
                      className="w-full text-xs font-bold text-indigo-700 hover:bg-indigo-50 border-indigo-200"
                    >
                      <Download size={14} /> ডাউনলোড করুন (Download)
                    </Button>
                    <Button 
                      onClick={() => printQR(`qr-in-${selectedQRVehicle.id}`, selectedQRVehicle.vehicleNumber, 'IN')}
                      className="w-full text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 border-none"
                    >
                      <Printer size={14} /> প্রিন্ট করুন (Print Card)
                    </Button>
                  </div>
                </div>

              </div>

              {/* Informative notice */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-[11px] text-slate-600 leading-relaxed text-left">
                <strong>ব্যবহারের নির্দেশিকা (How to Use):</strong>
                <ul className="list-disc pl-4 mt-1 space-y-1">
                  <li>উপরে থাকা কিউআর কার্ডগুলো প্রিন্ট করে গাড়ির উইন্ডশিল্ড বা উপযুক্ত স্থানে স্টিকার হিসেবে ব্যবহার করুন।</li>
                  <li>গাড়ি গ্যারেজ থেকে ছাড়ার সময় চেকপোস্টে <strong>OUT QR</strong> কোডটি স্ক্যান করে ট্রিপ চালু করবেন।</li>
                  <li>গাড়ি আবার ট্রিপ সম্পন্ন করে ফেরত আসলে <strong>IN QR</strong> কোডটি স্ক্যান করে সরঞ্জাম যাচাই ও রিটার্ন এন্ট্রি করবেন।</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <Button onClick={() => setSelectedQRVehicle(null)} variant="secondary" className="px-6">
                বন্ধ করুন (Close)
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vehicles;
