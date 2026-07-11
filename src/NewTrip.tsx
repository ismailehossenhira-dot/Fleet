import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, 
  Search, 
  CheckCircle2, 
  PlusCircle, 
  Phone, 
  AlertTriangle 
} from 'lucide-react';
import { Card, Button } from './components/Common';
import { 
  subscribeToCollection, 
  findStaffById, 
  createTrip 
} from './db';
import { cn } from './lib/utils';
import { useAuth } from './AuthContext';

const NewTrip: React.FC = () => {
  const { isAdmin, isSubAdmin, isLineSupervisor, profile } = useAuth();
  const navigate = useNavigate();
  const canManage = isAdmin || isSubAdmin || isLineSupervisor;

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [isSearchingDriver, setIsSearchingDriver] = useState(false);
  const [isSearchingHelper, setIsSearchingHelper] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState(() => {
    return localStorage.getItem('newtrip_vehicleSearch') || '';
  });

  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('newtrip_formData');
    return saved ? JSON.parse(saved) : {
      vehicleId: '',
      vehiclePlate: '',
      driverId: 'DRV-',
      driverName: '',
      driverPhone: '',
      helperId: 'HLP-',
      helperName: '',
      helperPhone: '',
      location: '',
      destinationLatLng: null as { lat: number, lng: number } | null,
      routePoints: [] as Array<{ lat: number, lng: number }>,
      tollAmount: 0,
      documentsGiven: [] as string[],
      toolsGiven: [] as string[]
    };
  });

  useEffect(() => {
    localStorage.setItem('newtrip_formData', JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    localStorage.setItem('newtrip_vehicleSearch', vehicleSearch);
  }, [vehicleSearch]);

  useEffect(() => {
    const unsubVehicles = subscribeToCollection('vehicles', setVehicles);
    const unsubCases = subscribeToCollection('cases', setCases);
    return () => {
      unsubVehicles();
      unsubCases();
    };
  }, []);

  // Redirect if not allowed
  useEffect(() => {
    if (!canManage) {
      navigate('/trips');
    }
  }, [canManage, navigate]);

  const handleVehicleChange = (val: string) => {
    const vehicle = vehicles.find(v => v.id === val);
    setFormData({ 
      ...formData, 
      vehicleId: val, 
      vehiclePlate: vehicle?.vehicleNumber || '' 
    });
  };

  const handleDriverSearch = async (val: string) => {
    const id = val.trim().toUpperCase();
    setFormData(prev => ({ ...prev, driverId: id, driverName: '', driverPhone: '' }));
    if (id.length >= 3) {
      setIsSearchingDriver(true);
      try {
        const staff = await findStaffById(id) as any;
        if (staff) {
          setFormData(prev => ({ 
            ...prev, 
            driverName: staff.name, 
            driverPhone: staff.phoneNumber || '' 
          }));
        }
      } catch (err) {
        console.error("Driver fetch error:", err);
      } finally {
        setIsSearchingDriver(false);
      }
    }
  };

  const handleHelperSearch = async (val: string) => {
    const id = val.trim().toUpperCase();
    setFormData(prev => ({ ...prev, helperId: id, helperName: '', helperPhone: '' }));
    if (id.length >= 3) {
      setIsSearchingHelper(true);
      try {
        const staff = await findStaffById(id) as any;
        if (staff) {
          setFormData(prev => ({ 
            ...prev, 
            helperName: staff.name,
            helperPhone: staff.phoneNumber || ''
          }));
        }
      } catch (err) {
        console.error("Helper fetch error:", err);
      } finally {
        setIsSearchingHelper(false);
      }
    }
  };

  const handleCancel = () => {
    setVehicleSearch('');
    setFormData({
      vehicleId: '',
      vehiclePlate: '',
      driverId: 'DRV-',
      driverName: '',
      driverPhone: '',
      helperId: 'HLP-',
      helperName: '',
      helperPhone: '',
      location: '',
      destinationLatLng: null,
      routePoints: [],
      tollAmount: 0,
      documentsGiven: [],
      toolsGiven: []
    });
    localStorage.removeItem('newtrip_formData');
    localStorage.removeItem('newtrip_vehicleSearch');
    navigate('/trips');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicleId || !formData.driverId || !formData.location) return;
    
    await createTrip(formData, profile);
    setVehicleSearch('');
    setFormData({
      vehicleId: '',
      vehiclePlate: '',
      driverId: 'DRV-',
      driverName: '',
      driverPhone: '',
      helperId: 'HLP-',
      helperName: '',
      helperPhone: '',
      location: '',
      destinationLatLng: null,
      routePoints: [],
      tollAmount: 0,
      documentsGiven: [],
      toolsGiven: []
    });
    localStorage.removeItem('newtrip_formData');
    localStorage.removeItem('newtrip_vehicleSearch');
    
    // Switch or redirect back to Trips page
    navigate('/trips');
  };

  const availableVehicles = vehicles.filter(v => v.status === 'Available');

  if (!canManage) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">New Trip Dispatch (নতুন ট্রিপ এন্ট্রি)</h2>
          <p className="text-slate-500">Register and dispatch vehicles for pending trips.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card title="Register New Trip Dispatch">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Search Vehicle (Last 4 digits)</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        maxLength={4}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 font-mono tracking-widest text-lg"
                        placeholder="Ex: 5821"
                        value={vehicleSearch}
                        onChange={e => {
                          const val = e.target.value;
                          setVehicleSearch(val);
                          if (val.length === 4) {
                            const match = availableVehicles.find(v => v.vehicleNumber.endsWith(val));
                            if (match) {
                              handleVehicleChange(match.id);
                            }
                          }
                        }}
                      />
                      {formData.vehiclePlate && (
                        <div className="absolute right-3 top-3.5 flex items-center gap-1">
                          <CheckCircle2 size={16} className="text-emerald-500" />
                          <span className="text-[10px] font-bold text-emerald-600 uppercase">Selected</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Selected / Choose Available</label>
                    <select 
                      required
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400 font-bold text-slate-900"
                      value={formData.vehicleId}
                      onChange={e => handleVehicleChange(e.target.value)}
                    >
                      <option value="">-- Manual Selection --</option>
                      {availableVehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.vehicleNumber} ({v.type})</option>
                      ))}
                    </select>
                    {formData.vehiclePlate && (
                      <p className="mt-1 text-[10px] text-blue-600 font-bold px-1 uppercase tracking-tight">Active: {formData.vehiclePlate}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Driver ID Search</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400"
                      placeholder="DRV-XXX"
                      value={formData.driverId}
                      onChange={e => handleDriverSearch(e.target.value)}
                    />
                    {isSearchingDriver && <div className="absolute right-3 top-3 animate-spin text-blue-500"><Search size={16} /></div>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Helper ID Search (Opt)</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400"
                      placeholder="HLP-XXX"
                      value={formData.helperId}
                      onChange={e => handleHelperSearch(e.target.value)}
                    />
                    {isSearchingHelper && <div className="absolute right-3 top-3 animate-spin text-purple-500"><Search size={16} /></div>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Driver Name</label>
                  <div className="space-y-1">
                    <input 
                      type="text" 
                      readOnly
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium"
                      placeholder="Auto-fetched..."
                      value={formData.driverName}
                    />
                    {formData.driverPhone && (
                      <p className="text-[10px] text-blue-600 font-bold px-1">📞 {formData.driverPhone}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Helper Name</label>
                  <div className="space-y-1">
                    <input 
                      type="text" 
                      readOnly
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium"
                      placeholder="Auto-fetched..."
                      value={formData.helperName}
                    />
                    {formData.helperPhone && (
                      <p className="text-[10px] text-purple-600 font-bold px-1">📞 {formData.helperPhone}</p>
                    )}
                  </div>
                </div>
                 <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Destination Location</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400"
                    placeholder="e.g. Chittagong Port"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">টোল বাজেট (Estimated Toll Amount)</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 font-mono"
                    placeholder="e.g. 1500"
                    value={formData.tollAmount || ''}
                    onChange={e => setFormData({ ...formData, tollAmount: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-100">
                <Button type="submit" className="flex-1">Create Pending Trip (ট্রিপ এন্ট্রি করুন)</Button>
                <Button type="button" variant="secondary" onClick={handleCancel}>Cancel</Button>
              </div>
            </form>
          </Card>
        </div>
        <div>
          <Card title="Guidelines">
            <ul className="space-y-4 text-sm text-slate-600">
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                <span>Vehicle must be in 'Available' status to start a new trip.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                <span>Driver details are auto-synced based on their unique ID.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                <span>Registered trip will remain pending until OUT QR code is scanned to start the trip.</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default NewTrip;
