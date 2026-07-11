import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Search, 
  Calendar, 
  User as UserIcon, 
  FileText, 
  CheckCircle2, 
  PlusCircle, 
  ArrowRight, 
  Clock, 
  AlertTriangle, 
  Wrench, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Phone, 
  Navigation,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { Card, Button } from './components/Common';
import { 
  subscribeToCollection, 
  findStaffById, 
  createTrip 
} from './db';
import { DOCUMENT_TYPES, cn } from './lib/utils';
import { useAuth } from './AuthContext';

import MapComponent from './components/MapComponent';

const Trips: React.FC = () => {
  const { isAdmin, isSubAdmin, isChecker, isLineSupervisor, profile } = useAuth();
  const canManage = isAdmin || isSubAdmin || isLineSupervisor;
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(() => {
    const saved = localStorage.getItem('trips_showAdd');
    return saved ? JSON.parse(saved) : false;
  });
  const [viewingTripMap, setViewingTripMap] = useState<any | null>(null);
  
  // Trip log & grouping state
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'log'>('pending');
  const [logSearch, setLogSearch] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [expandedDates, setExpandedDates] = useState<{ [key: string]: boolean }>({});

  const getTripDateString = (trip: any) => {
    const timestamp = trip.startTime || trip.createdAt;
    if (!timestamp) return 'Unknown Date';
    
    let date: Date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatGroupDate = (dateStr: string) => {
    if (dateStr === 'Unknown Date') return { bnDate: 'অজানা তারিখ', enDate: 'Unknown Date' };
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    const enOption: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' };
    const enDate = date.toLocaleDateString('en-US', enOption);
    
    const bnOption: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' };
    const bnDate = date.toLocaleDateString('bn-BD', bnOption);
    
    return { bnDate, enDate };
  };

  const getTripDurationString = (startTime: any, endTime: any) => {
    if (!startTime || !endTime) return null;
    const startMs = startTime.seconds ? startTime.seconds * 1000 : new Date(startTime).getTime();
    const endMs = endTime.seconds ? endTime.seconds * 1000 : new Date(endTime).getTime();
    const diffMs = endMs - startMs;
    if (diffMs <= 0) return '১ মিনিট এর কম (Less than 1 min)';
    
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    if (hours > 0) {
      return `${hours} ঘণ্টা ${mins} মিনিট (${hours}h ${mins}m)`;
    }
    return `${mins} মিনিট (${mins}m)`;
  };

  const formatTripTime = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    let date: Date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    return date.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  useEffect(() => {
    if (trips.length > 0) {
      const latestDate = getTripDateString(trips[0]);
      setExpandedDates(prev => ({ [latestDate]: true, ...prev }));
    }
  }, [trips]);
  
  // Form State
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('trips_formData');
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
  const [isSearchingDriver, setIsSearchingDriver] = useState(false);
  const [isSearchingHelper, setIsSearchingHelper] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState(() => {
    const saved = localStorage.getItem('trips_vehicleSearch');
    return saved || '';
  });

  useEffect(() => {
    localStorage.setItem('trips_showAdd', JSON.stringify(showAdd));
  }, [showAdd]);

  useEffect(() => {
    localStorage.setItem('trips_formData', JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    localStorage.setItem('trips_vehicleSearch', vehicleSearch);
  }, [vehicleSearch]);

  useEffect(() => {
    const unsubVehicles = subscribeToCollection('vehicles', setVehicles);
    const unsubTrips = subscribeToCollection('trips', setTrips);
    const unsubCases = subscribeToCollection('cases', setCases);
    return () => {
      unsubVehicles();
      unsubTrips();
      unsubCases();
    };
  }, []);

  const handleVehicleChange = (val: string) => {
    const vehicle = vehicles.find(v => v.id === val);
    setFormData({ 
      ...formData, 
      vehicleId: val, 
      vehiclePlate: vehicle?.vehicleNumber || '' 
    });
  };

  const getSeizedDocs = (vId: string) => {
    const vCases = cases.filter(c => c.vehicleId === vId);
    return vCases.reduce((acc, c) => [...acc, ...(c.seizedDocuments || [])], [] as string[]);
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

  const handleToggleDoc = (doc: string) => {
    setFormData(prev => ({
      ...prev,
      documentsGiven: prev.documentsGiven.includes(doc)
        ? prev.documentsGiven.filter(d => d !== doc)
        : [...prev.documentsGiven, doc]
    }));
  };

  const handleToggleTool = (tool: string) => {
    setFormData(prev => ({
      ...prev,
      toolsGiven: prev.toolsGiven.includes(tool)
        ? prev.toolsGiven.filter(t => t !== tool)
        : [...prev.toolsGiven, tool]
    }));
  };

  const handleCancel = () => {
    setShowAdd(false);
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
    localStorage.removeItem('trips_formData');
    localStorage.removeItem('trips_showAdd');
    localStorage.removeItem('trips_vehicleSearch');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicleId || !formData.driverId || !formData.location) return;
    
    await createTrip(formData, profile);
    setShowAdd(false);
    setVehicleSearch('');
    setActiveTab('pending'); // Automatically switch to pending tab to show created trip!
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
    localStorage.removeItem('trips_formData');
    localStorage.removeItem('trips_showAdd');
    localStorage.removeItem('trips_vehicleSearch');
  };

  const availableVehicles = vehicles.filter(v => v.status === 'Available');
  const seizedForCurrent = formData.vehicleId ? getSeizedDocs(formData.vehiclePlate) : [];
  const availableDocs = DOCUMENT_TYPES.filter(d => !seizedForCurrent.includes(d));
  const TOOL_LIST = ['Jack', 'Spare Wheel', 'Fire Extinguisher', 'First Aid Kit', 'Triangle', 'Tool Box'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Trip Management</h2>
          <p className="text-slate-500">Dispatch vehicles and track ongoing trips.</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowAdd(!showAdd)}>
            <PlusCircle size={20} />
            <span>New Trip Entry</span>
          </Button>
        )}
      </div>

      {showAdd && (
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
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-slate-700">Map Destination & Route (Click to draw)</label>
                    <button 
                      type="button" 
                      onClick={() => setFormData({ ...formData, destinationLatLng: null, routePoints: [] })}
                      className="text-[10px] text-danger font-bold uppercase hover:underline"
                    >
                      Reset Route
                    </button>
                  </div>
                  <MapComponent 
                    className="h-[300px] w-full rounded-xl border border-slate-200"
                    markers={[
                      ...(formData.destinationLatLng ? [{ 
                        position: [formData.destinationLatLng.lat, formData.destinationLatLng.lng] as [number, number], 
                        label: "Destination" 
                      }] : []),
                      ...formData.routePoints.map((p, i) => ({
                        position: [p.lat, p.lng] as [number, number],
                        label: `Point ${i + 1}`
                      }))
                    ]}
                    route={formData.routePoints.map(p => [p.lat, p.lng])}
                    onClick={(latlng) => {
                      const point = { lat: latlng.lat, lng: latlng.lng };
                      setFormData({ 
                        ...formData, 
                        destinationLatLng: point, // Update destination to latest click
                        routePoints: [...formData.routePoints, point] // Add to route
                      });
                    }}
                  />
                  <div className="mt-2 flex items-center justify-between">
                    {formData.destinationLatLng && (
                      <p className="text-[10px] text-text-muted">
                        Target: {formData.destinationLatLng.lat.toFixed(4)}, {formData.destinationLatLng.lng.toFixed(4)}
                      </p>
                    )}
                    <p className="text-[10px] text-accent font-bold uppercase">
                      {formData.routePoints.length} Points Added
                    </p>
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
      )}

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 mt-2 bg-white rounded-t-2xl px-2 pt-2 flex-wrap gap-y-2">
        <button
          onClick={() => setActiveTab('pending')}
          className={cn(
            "px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer",
            activeTab === 'pending'
              ? "border-amber-500 text-amber-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          <AlertCircle size={16} />
          <span>Pending Dispatch (ছাড়পত্র অপেক্ষায় - {trips.filter(t => t.status === 'Pending').length})</span>
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={cn(
            "px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer",
            activeTab === 'active'
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          <Clock size={16} />
          <span>Active Transports (চলমান ট্রিপস - {trips.filter(t => t.status === 'Running').length})</span>
        </button>
        <button
          onClick={() => setActiveTab('log')}
          className={cn(
            "px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer",
            activeTab === 'log'
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          <Calendar size={16} />
          <span>Daily Trip Log (প্রতিদিনের ট্রিপ হিস্ট্রি - {trips.length})</span>
        </button>
      </div>

      {activeTab === 'pending' && (
        <div className="grid grid-cols-1 gap-6">
          <Card title="Pending Dispatch (ছাড়পত্র অপেক্ষায় - গেটে Out QR স্ক্যানের পর চালু হবে)">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-border">
                    <th className="px-5 py-3 font-semibold text-text-muted uppercase tracking-wider">Transport ID</th>
                    <th className="px-5 py-3 font-semibold text-text-muted uppercase tracking-wider">Driver Info</th>
                    <th className="px-5 py-3 font-semibold text-text-muted uppercase tracking-wider">Destination</th>
                    <th className="px-5 py-3 font-semibold text-text-muted uppercase tracking-wider text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {trips.filter(t => t.status === 'Pending').map(trip => (
                    <tr key={trip.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-bold text-text-main">{trip.vehiclePlate || trip.vehicleId}</td>
                      <td className="px-5 py-3 text-text-muted">
                        <div className="font-semibold text-text-main shrink-0">{trip.driverName}</div>
                        <div className="text-[10px] uppercase font-bold">DRV: {trip.driverId}</div>
                        {trip.createdBy && (
                          <div className="text-[9px] text-slate-500 mt-1 bg-slate-100 px-1.5 py-0.5 rounded inline-block font-medium">এন্ট্রি: {trip.createdBy}</div>
                        )}
                        {trip.helperName && (
                          <div className="mt-1 pt-1 border-t border-border border-dashed">
                             <div className="text-[10px] font-semibold text-text-main">{trip.helperName}</div>
                             <div className="text-[9px] uppercase font-bold">HLP: {trip.helperId}</div>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <MapPin size={10} className="text-accent" />
                          <span>{trip.location}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                         <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-50 border border-amber-200 text-amber-700">
                           Pending Out Scan
                         </span>
                      </td>
                    </tr>
                  ))}
                  {trips.filter(t => t.status === 'Pending').length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-text-muted italic">
                        No pending transports waiting for Out QR Scan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'active' && (
        <div className="grid grid-cols-1 gap-6">
          <Card title="Active Transports">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-border">
                    <th className="px-5 py-3 font-semibold text-text-muted uppercase tracking-wider">Transport ID</th>
                    <th className="px-5 py-3 font-semibold text-text-muted uppercase tracking-wider">Driver Info</th>
                    <th className="px-5 py-3 font-semibold text-text-muted uppercase tracking-wider">Destination</th>
                    <th className="px-5 py-3 font-semibold text-text-muted uppercase tracking-wider">Documents</th>
                    <th className="px-5 py-3 font-semibold text-text-muted uppercase tracking-wider text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {trips.filter(t => t.status === 'Running').map(trip => (
                    <tr key={trip.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-bold text-text-main">{trip.vehiclePlate || trip.vehicleId}</td>
                      <td className="px-5 py-3 text-text-muted">
                        <div className="font-semibold text-text-main shrink-0">{trip.driverName}</div>
                        <div className="text-[10px] uppercase font-bold">DRV: {trip.driverId}</div>
                        {trip.startedBy && (
                          <div className="text-[9px] text-slate-500 mt-1 bg-slate-100 px-1.5 py-0.5 rounded inline-block font-medium">রিলিজ: {trip.startedBy}</div>
                        )}
                        {trip.helperName && (
                          <div className="mt-1 pt-1 border-t border-border border-dashed">
                             <div className="text-[10px] font-semibold text-text-main">{trip.helperName}</div>
                             <div className="text-[9px] uppercase font-bold">HLP: {trip.helperId}</div>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <MapPin size={10} className="text-accent" />
                          <span>{trip.location}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                         <div className="flex flex-col gap-1">
                           {trip.documentsGiven?.length > 0 && (
                             <div className="flex flex-wrap gap-1 mb-1">
                               {trip.documentsGiven.map((d: string) => (
                                 <span key={d} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 text-[9px] font-bold uppercase">{d}</span>
                               ))}
                             </div>
                           )}
                           {trip.toolsGiven?.length > 0 && (
                             <div className="flex flex-wrap gap-1">
                               {trip.toolsGiven.map((t: string) => (
                                 <span key={t} className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 border border-purple-100 text-[9px] font-bold uppercase">{t}</span>
                               ))}
                             </div>
                           )}
                           {(!trip.documentsGiven?.length && !trip.toolsGiven?.length) && <span className="text-slate-400 italic">None</span>}
                         </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                         <div className="flex items-center justify-end gap-2">
                           {trip.destinationLatLng && (
                             <button 
                               type="button"
                               onClick={() => setViewingTripMap(trip)}
                               className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-accent hover:text-white transition-colors cursor-pointer"
                               title="View Route Map"
                             >
                               <MapPin size={12} />
                             </button>
                           )}
                           <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-700">
                             In Progress
                           </span>
                         </div>
                      </td>
                    </tr>
                  ))}
                  {trips.filter(t => t.status === 'Running').length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-text-muted italic">
                        No active transport in progress.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'log' && (
        /* Daily Trip Log tab with Date Grouping and Full Details */
        <div className="space-y-6">
          {/* Filters Area */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">গাড়ি বা স্টাফ দিয়ে খুঁজুন (Search Log)</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="গাড়ি প্লেট, স্টাফ আইডি বা নাম..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500"
                  value={logSearch}
                  onChange={e => setLogSearch(e.target.value)}
                />
                <Search size={14} className="absolute left-3 top-3 text-slate-400" />
              </div>
            </div>

            {/* Date filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">নির্দিষ্ট তারিখ সিলেক্ট করুন (Date Filter)</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 cursor-pointer"
                value={selectedDateFilter}
                onChange={e => setSelectedDateFilter(e.target.value)}
              />
            </div>

            {/* Summary counters */}
            <div className="flex items-center justify-around bg-slate-50 border border-slate-100 rounded-xl p-2 text-center">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">মোট ট্রিপ</span>
                <span className="text-sm font-black text-slate-800">{trips.length}টি</span>
              </div>
              <div className="border-l border-slate-200 h-8"></div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">চলমান</span>
                <span className="text-sm font-black text-blue-600">
                  {trips.filter(t => t.status === 'Running').length}টি
                </span>
              </div>
              <div className="border-l border-slate-200 h-8"></div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">সম্পন্ন</span>
                <span className="text-sm font-black text-emerald-600">
                  {trips.filter(t => t.status === 'Completed').length}টি
                </span>
              </div>
            </div>
          </div>

          {/* Grouped lists */}
          <div className="space-y-4">
            {(() => {
              // Get filtered log trips
              const filteredLogTrips = trips.filter(trip => {
                // Date filter
                if (selectedDateFilter) {
                  const tripDate = getTripDateString(trip);
                  if (tripDate !== selectedDateFilter) return false;
                }
                
                // Search filter
                if (logSearch.trim()) {
                  const searchLower = logSearch.toLowerCase();
                  const vehicleMatch = (trip.vehiclePlate || '').toLowerCase().includes(searchLower);
                  const driverIdMatch = (trip.driverId || '').toLowerCase().includes(searchLower);
                  const driverNameMatch = (trip.driverName || '').toLowerCase().includes(searchLower);
                  const helperIdMatch = (trip.helperId || '').toLowerCase().includes(searchLower);
                  const helperNameMatch = (trip.helperName || '').toLowerCase().includes(searchLower);
                  const locationMatch = (trip.location || '').toLowerCase().includes(searchLower);
                  
                  return vehicleMatch || driverIdMatch || driverNameMatch || helperIdMatch || helperNameMatch || locationMatch;
                }
                
                return true;
              });

              // Group filtered trips by date string (YYYY-MM-DD)
              const groupedLogTrips = filteredLogTrips.reduce((groups: { [key: string]: any[] }, trip) => {
                const dateStr = getTripDateString(trip);
                if (!groups[dateStr]) {
                  groups[dateStr] = [];
                }
                groups[dateStr].push(trip);
                return groups;
              }, {});

              // Sort keys in descending order (newest date first)
              const sortedLogDates = Object.keys(groupedLogTrips).sort((a, b) => b.localeCompare(a));

              if (sortedLogDates.length === 0) {
                return (
                  <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 text-slate-400 italic text-sm">
                    ⚠️ ফিল্টার অনুযায়ী কোনো ট্রিপ লগ খুঁজে পাওয়া যায়নি।
                  </div>
                );
              }

              return sortedLogDates.map(dateStr => {
                const { bnDate, enDate } = formatGroupDate(dateStr);
                const isExpanded = expandedDates[dateStr] !== false; // Default to expanded
                const dayTrips = groupedLogTrips[dateStr];

                return (
                  <div key={dateStr} className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                    {/* Collapsible Header */}
                    <button
                      type="button"
                      onClick={() => setExpandedDates(prev => ({ ...prev, [dateStr]: !isExpanded }))}
                      className="w-full px-5 py-4 flex items-center justify-between bg-slate-50 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                          <Calendar size={18} />
                        </div>
                        <div className="text-left">
                          <h4 className="font-bold text-sm text-slate-800">{bnDate}</h4>
                          <p className="text-[10px] text-slate-400 font-mono uppercase">{enDate}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                          {dayTrips.length}টি ট্রিপ
                        </span>
                        {isExpanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                      </div>
                    </button>

                    {/* Group Body */}
                    {isExpanded && (
                      <div className="p-5 space-y-6 bg-white divide-y divide-slate-100">
                        {dayTrips.map((trip, idx) => {
                          const isRunning = trip.status === 'Running';
                          const isCompleted = trip.status === 'Completed';
                          const tripDuration = getTripDurationString(trip.startTime, trip.endTime);

                          return (
                            <div key={trip.id} className={cn("pt-5 first:pt-0", idx > 0 && "pt-6")}>
                              {/* Trip Header Line */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-slate-400">#{idx + 1}</span>
                                  <span className="font-extrabold text-sm text-slate-900 bg-white border px-2.5 py-1 rounded-lg shadow-2xs">
                                    {trip.vehiclePlate || 'N/A'}
                                  </span>
                                  <span className={cn(
                                    "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                    isRunning && "bg-blue-100 text-blue-800",
                                    isCompleted && "bg-emerald-100 text-emerald-800"
                                  )}>
                                    {isRunning ? '● চলমান (Running)' : '✓ সম্পন্ন (Completed)'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {trip.destinationLatLng && (
                                    <button
                                      type="button"
                                      onClick={() => setViewingTripMap(trip)}
                                      className="px-2 py-1 bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                                      title="রুট ম্যাপ দেখুন"
                                    >
                                      <Navigation size={11} />
                                      <span>রুট ম্যাপ</span>
                                    </button>
                                  )}
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    আইডি: {trip.id?.substring(0, 8)}
                                  </span>
                                </div>
                              </div>

                              {/* Detailed Info Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs mb-4">
                                {/* Driver & Helper column */}
                                <div className="space-y-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                  <h5 className="font-bold text-slate-500 uppercase tracking-tight text-[10px] flex items-center gap-1.5 border-b pb-1">
                                    <UserIcon size={12} className="text-slate-400" />
                                    <span>স্টাফ তথ্য (Staff Profiles)</span>
                                  </h5>
                                  <div className="space-y-2">
                                    <div>
                                      <span className="text-slate-400 block mb-0.5">চালক (Driver):</span>
                                      <div className="font-bold text-slate-800 flex items-center gap-1">
                                        <span>{trip.driverName}</span>
                                        <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.2 rounded font-mono">
                                          {trip.driverId}
                                        </span>
                                      </div>
                                      {trip.driverPhone && (
                                        <a href={`tel:${trip.driverPhone}`} className="text-[10px] text-blue-500 hover:underline flex items-center gap-1 mt-0.5 font-medium">
                                          <Phone size={10} />
                                          <span>{trip.driverPhone}</span>
                                        </a>
                                      )}
                                    </div>

                                    {trip.helperId ? (
                                      <div className="border-t pt-2 mt-2">
                                        <span className="text-slate-400 block mb-0.5">সহকারী (Helper):</span>
                                        <div className="font-bold text-slate-700 flex items-center gap-1">
                                          <span>{trip.helperName}</span>
                                          <span className="text-[9px] bg-purple-50 text-purple-600 px-1.5 py-0.2 rounded font-mono">
                                            {trip.helperId}
                                          </span>
                                        </div>
                                        {trip.helperPhone && (
                                          <a href={`tel:${trip.helperPhone}`} className="text-[10px] text-purple-500 hover:underline flex items-center gap-1 mt-0.5 font-medium">
                                            <Phone size={10} />
                                            <span>{trip.helperPhone}</span>
                                          </a>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="border-t pt-2 mt-2">
                                        <span className="text-slate-400 italic block text-[11px]">সহকারী (Helper) নেই</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Destination & Cost column */}
                                <div className="space-y-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                  <h5 className="font-bold text-slate-500 uppercase tracking-tight text-[10px] flex items-center gap-1.5 border-b pb-1">
                                    <MapPin size={12} className="text-slate-400" />
                                    <span>গন্তব্য ও খরচ (Route & Tolls)</span>
                                  </h5>
                                  <div className="space-y-2">
                                    <div>
                                      <span className="text-slate-400 block mb-0.5">গন্তব্য (Destination):</span>
                                      <span className="font-bold text-slate-800 text-sm flex items-center gap-1">
                                        <MapPin size={12} className="text-rose-500 shrink-0" />
                                        <span>{trip.location}</span>
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 border-t pt-2 mt-2">
                                      <div>
                                        <span className="text-slate-400 block mb-0.5">সেতু টোল (Bridge Toll):</span>
                                        <span className="font-extrabold text-slate-800">
                                          ৳ {trip.tollAmount || 0}
                                        </span>
                                      </div>
                                      {tripDuration && (
                                        <div>
                                          <span className="text-slate-400 block mb-0.5">ট্রিপ সময়কাল (Duration):</span>
                                          <span className="font-bold text-slate-800 text-[11px]">
                                            {tripDuration}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Timing & Timeline column */}
                                <div className="space-y-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                  <h5 className="font-bold text-slate-500 uppercase tracking-tight text-[10px] flex items-center gap-1.5 border-b pb-1">
                                    <Clock size={12} className="text-slate-400" />
                                    <span>সময়সূচী (Dispatch Timeline)</span>
                                  </h5>
                                  <div className="space-y-2">
                                    <div>
                                      <span className="text-slate-400 block mb-0.5">প্রস্থান সময় (Out-Time):</span>
                                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                        <ArrowRight size={12} className="text-blue-500" />
                                        <span>{formatTripTime(trip.startTime)}</span>
                                      </span>
                                      {trip.startedBy && (
                                        <span className="text-[10px] text-slate-500 block mt-1 font-medium bg-slate-100/60 px-1.5 py-0.5 rounded w-max">
                                          রিলিজ বাই: {trip.startedBy}
                                        </span>
                                      )}
                                    </div>
                                    <div className="border-t pt-2 mt-2">
                                      <span className="text-slate-400 block mb-0.5">ফেরত সময় (In-Time):</span>
                                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                        {isCompleted ? (
                                          <>
                                            <Check size={12} className="text-emerald-500" />
                                            <span>{formatTripTime(trip.endTime)}</span>
                                          </>
                                        ) : (
                                          <span className="text-blue-600 font-bold animate-pulse text-[11px]">
                                            ● গাড়ি এখনো ট্রিপে রয়েছে
                                          </span>
                                        )}
                                      </span>
                                      {isCompleted && trip.completedBy && (
                                        <span className="text-[10px] text-emerald-700 block mt-1 font-medium bg-emerald-50/60 px-1.5 py-0.5 rounded w-max">
                                          রিসিভ বাই: {trip.completedBy}
                                        </span>
                                      )}
                                    </div>
                                    {trip.createdBy && (
                                      <div className="border-t pt-2 mt-2">
                                        <span className="text-[10px] text-slate-500 block font-medium">
                                          এন্ট্রি বাই: {trip.createdBy}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Issued items checklist bar */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mb-3">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                                  <span className="text-slate-400 block font-bold text-[10px] uppercase">প্রস্থানকালে প্রদত্ত কাগজপত্র (Documents Issued)</span>
                                  {trip.documentsGiven?.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {trip.documentsGiven.map((doc: string) => (
                                        <span key={doc} className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold rounded uppercase">
                                          📄 {doc}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic text-[11px]">কোনো কাগজপত্র দেওয়া হয়নি</span>
                                  )}
                                </div>

                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                                  <span className="text-slate-400 block font-bold text-[10px] uppercase">প্রস্থানকালে প্রদত্ত সরঞ্জাম (Tools Issued)</span>
                                  {trip.toolsGiven?.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {trip.toolsGiven.map((tool: string) => (
                                        <span key={tool} className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold rounded uppercase">
                                          🔧 {tool}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic text-[11px]">কোনো সরঞ্জাম দেওয়া হয়নি</span>
                                  )}
                                </div>
                              </div>

                              {/* Completed Return Verification details */}
                              {isCompleted && trip.inspectionOnReturn && (
                                <div className="p-3 bg-emerald-50/40 border border-emerald-100 rounded-xl text-xs space-y-3">
                                  <div className="flex justify-between items-center border-b border-emerald-100/60 pb-1.5">
                                    <span className="font-bold text-emerald-800 text-[11px] flex items-center gap-1">
                                      <CheckCircle2 size={12} className="text-emerald-600" />
                                      <span>গাড়ি ফেরত যাচাই রিপোর্ট (Return Inspection Details)</span>
                                    </span>
                                    <span className="text-[10px] text-emerald-600 font-medium">
                                      যাচাইকাল: {formatTripTime(trip.inspectionOnReturn.inspectedAt)}
                                    </span>
                                  </div>

                                  {/* Missing verification indicators */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                    <div>
                                      <span className="text-slate-500 block mb-1">কাগজপত্র জমা স্ট্যাটাস:</span>
                                      {trip.inspectionOnReturn.missingDocuments?.length > 0 ? (
                                        <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg space-y-1">
                                          <p className="font-bold text-[10px] flex items-center gap-1 text-rose-800">
                                            <AlertTriangle size={12} />
                                            <span>অনুপস্থিত বা হারানো কাগজপত্র (Missing Docs)!</span>
                                          </p>
                                          <div className="flex flex-wrap gap-1">
                                            {trip.inspectionOnReturn.missingDocuments.map((doc: string) => (
                                              <span key={doc} className="bg-white border border-rose-300 text-rose-700 px-1.5 py-0.2 rounded font-mono font-bold text-[9px] uppercase">
                                                {doc}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded text-[10px]">
                                          <Check size={10} /> সকল কাগজপত্র ফেরত পাওয়া গেছে
                                        </span>
                                      )}
                                    </div>

                                    <div>
                                      <span className="text-slate-500 block mb-1">সরঞ্জাম ও টুলস জমা স্ট্যাটাস:</span>
                                      {trip.inspectionOnReturn.missingTools?.length > 0 ? (
                                        <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg space-y-1">
                                          <p className="font-bold text-[10px] flex items-center gap-1 text-rose-800">
                                            <AlertTriangle size={12} />
                                            <span>অনুপস্থিত বা হারানো সরঞ্জাম (Missing Tools)!</span>
                                          </p>
                                          <div className="flex flex-wrap gap-1">
                                            {trip.inspectionOnReturn.missingTools.map((tool: string) => (
                                              <span key={tool} className="bg-white border border-rose-300 text-rose-700 px-1.5 py-0.2 rounded font-mono font-bold text-[9px] uppercase">
                                                {tool}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded text-[10px]">
                                          <Check size={10} /> সকল টুলস ফেরত পাওয়া গেছে
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Return Inspection Notes */}
                                  <div>
                                    <span className="text-slate-500 block mb-1">রিটার্ন মন্তব্য / নোট (Inspection Notes):</span>
                                    <p className="p-2 bg-white rounded border border-emerald-100 text-slate-700 italic text-[11px]">
                                      {trip.inspectionOnReturn.notes || 'কোন সমস্যা পাওয়া যায়নি। সবকিছু অক্ষত অবস্থায় ফেরত পাওয়া গেছে।'}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {viewingTripMap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <div>
                <h3 className="font-bold text-text-main">Route Visualization</h3>
                <p className="text-[10px] text-text-muted">{viewingTripMap.vehiclePlate || viewingTripMap.vehicleId} • {viewingTripMap.location}</p>
              </div>
              <button onClick={() => setViewingTripMap(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <FileText size={20} className="text-text-muted" />
              </button>
            </div>
            <div className="p-4">
               <MapComponent 
                 className="h-[500px] w-full rounded-xl"
                 center={viewingTripMap.destinationLatLng ? [viewingTripMap.destinationLatLng.lat, viewingTripMap.destinationLatLng.lng] : undefined}
                 markers={[
                   ...(viewingTripMap.destinationLatLng ? [{
                     position: [viewingTripMap.destinationLatLng.lat, viewingTripMap.destinationLatLng.lng] as [number, number],
                     label: "Destination"
                   }] : []),
                   ...(viewingTripMap.routePoints || []).map((p: any, i: number) => ({
                     position: [p.lat, p.lng] as [number, number],
                     label: `Point ${i + 1}`
                   }))
                 ]}
                 route={(viewingTripMap.routePoints || []).map((p: any) => [p.lat, p.lng])}
               />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Trips;
