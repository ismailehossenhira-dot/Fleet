import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  MapPin, 
  Search, 
  CheckCircle2, 
  PlusCircle, 
  Phone, 
  AlertTriangle,
  FileText,
  Wrench,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import { Card, Button } from './components/Common';
import { 
  subscribeToCollection, 
  findStaffById, 
  createTrip 
} from './db';
import { cn, DOCUMENT_TYPES } from './lib/utils';
import { useAuth } from './AuthContext';

const NewTrip: React.FC = () => {
  const { isAdmin, isSubAdmin, isLineSupervisor, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryVehicleId = searchParams.get('vehicleId');
  const canManage = isAdmin || isSubAdmin || isLineSupervisor;

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [missingReports, setMissingReports] = useState<any[]>([]);
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
    const unsubTrips = subscribeToCollection('trips', setTrips);
    const unsubMissing = subscribeToCollection('missing_reports', setMissingReports);
    return () => {
      unsubVehicles();
      unsubCases();
      unsubTrips();
      unsubMissing();
    };
  }, []);

  // Redirect if not allowed
  useEffect(() => {
    if (!canManage) {
      navigate('/trips');
    }
  }, [canManage, navigate]);

  // Pre-select vehicle if vehicleId query param is present
  useEffect(() => {
    if (queryVehicleId && vehicles.length > 0) {
      const match = vehicles.find(v => v.id === queryVehicleId);
      if (match) {
        setFormData(prev => ({ 
          ...prev, 
          vehicleId: match.id, 
          vehiclePlate: match.vehicleNumber || '' 
        }));
        if (match.vehicleNumber) {
          const last4 = match.vehicleNumber.slice(-4);
          setVehicleSearch(last4);
        }
      }
    }
  }, [queryVehicleId, vehicles]);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleVehicleChange = (val: string) => {
    const vehicle = vehicles.find(v => v.id === val);
    setFormData({ 
      ...formData, 
      vehicleId: val, 
      vehiclePlate: vehicle?.vehicleNumber || '' 
    });
    setSubmitError(null);
  };

  const handleDriverSearch = async (val: string) => {
    const id = val.trim().toUpperCase();
    setFormData(prev => ({ ...prev, driverId: id, driverName: '', driverPhone: '' }));
    setSubmitError(null);
    if (id.length >= 3) {
      setIsSearchingDriver(true);
      try {
        const staff = await findStaffById(id) as any;
        if (staff) {
          if (staff.isSuspended) {
            setSubmitError(`চালক ${staff.name} (${staff.driverId}) বর্তমানে সাসপেন্ড আছেন! কারণ: ${staff.suspensionReason || 'উল্লেখ নেই'}, মেয়াদ: ${staff.suspensionDays || '0'} দিন (দ্বারা: ${staff.suspendedBy || 'Admin'})।`);
            setFormData(prev => ({ 
              ...prev, 
              driverName: '', 
              driverPhone: '' 
            }));
          } else {
            setFormData(prev => ({ 
              ...prev, 
              driverName: staff.name, 
              driverPhone: staff.phoneNumber || '' 
            }));
          }
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
    setSubmitError(null);
    if (id.length >= 3) {
      setIsSearchingHelper(true);
      try {
        const staff = await findStaffById(id) as any;
        if (staff) {
          if (staff.isSuspended) {
            setSubmitError(`হেলপার ${staff.name} (${staff.driverId}) বর্তমানে সাসপেন্ড আছেন! কারণ: ${staff.suspensionReason || 'উল্লেখ নেই'}, মেয়াদ: ${staff.suspensionDays || '0'} দিন (দ্বারা: ${staff.suspendedBy || 'Admin'})।`);
            setFormData(prev => ({ 
              ...prev, 
              helperName: '', 
              helperPhone: '' 
            }));
          } else {
            setFormData(prev => ({ 
              ...prev, 
              helperName: staff.name,
              helperPhone: staff.phoneNumber || ''
            }));
          }
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
    
    setIsSubmitting(true);
    setSubmitError(null);

    const drvId = formData.driverId?.trim().toUpperCase();
    if (drvId && drvId !== 'DRV-') {
      // 1. Fetch and double check driver's suspension status
      const staff = await findStaffById(drvId) as any;
      if (staff && staff.isSuspended) {
        setSubmitError(`চালক ${staff.name} (${staff.driverId}) বর্তমানে সাসপেন্ড আছেন! সাসপেন্ড থাকাকালীন ট্রিপে যোগ দেওয়া যাবে না।`);
        setIsSubmitting(false);
        return;
      }

      const activeDriverTrip = trips.find(t => 
        t.driverId?.trim().toUpperCase() === drvId && 
        (t.status === 'Pending' || t.status === 'Running')
      );
      if (activeDriverTrip) {
        const activeVehicleNum = activeDriverTrip.vehiclePlate || activeDriverTrip.vehicleId;
        setSubmitError(`এই চালক (Driver ID: ${formData.driverId}) ইতিমধ্যে অন্য একটি পেন্ডিং বা রানিং ট্রিপে কাজ করছেন (গাড়ি: ${activeVehicleNum})।`);
        setIsSubmitting(false);
        return;
      }
    }

    const hlpId = formData.helperId?.trim().toUpperCase();
    if (hlpId && hlpId !== 'HLP-' && hlpId !== '') {
      // 2. Fetch and double check helper's suspension status
      const staff = await findStaffById(hlpId) as any;
      if (staff && staff.isSuspended) {
        setSubmitError(`হেলপার ${staff.name} (${staff.driverId}) বর্তমানে সাসপেন্ড আছেন! সাসপেন্ড থাকাকালীন ট্রিপে যোগ দেওয়া যাবে না।`);
        setIsSubmitting(false);
        return;
      }

      const activeHelperTrip = trips.find(t => 
        t.helperId?.trim().toUpperCase() === hlpId && 
        (t.status === 'Pending' || t.status === 'Running')
      );
      if (activeHelperTrip) {
        const activeVehicleNum = activeHelperTrip.vehiclePlate || activeHelperTrip.vehicleId;
        setSubmitError(`এই হেলপার (Helper ID: ${formData.helperId}) ইতিমধ্যে অন্য একটি পেন্ডিং বা রানিং ট্রিপে কাজ করছেন (গাড়ি: ${activeVehicleNum})।`);
        setIsSubmitting(false);
        return;
      }
    }

    try {
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
    } catch (err: any) {
      console.error("Trip creation failed:", err);
      let msg = "ট্রিপ এন্ট্রি করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।";
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error) {
          msg = parsed.error;
        }
      } catch (e) {
        if (err.message) {
          msg = err.message;
        }
      }
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableVehicles = vehicles.filter(v => {
    if (v.status !== 'Available') return false;
    // Exclude vehicles that already have an active (Pending or Running) trip
    const hasActiveTrip = trips.some(t => t.vehicleId === v.id && (t.status === 'Pending' || t.status === 'Running'));
    return !hasActiveTrip;
  });

  // Find selected vehicle object
  const selectedVehicle = vehicles.find(v => v.id === formData.vehicleId);

  // Active cases for selected vehicle
  const activeVehicleCases = selectedVehicle ? cases.filter(c => 
    c.vehicleId === selectedVehicle.vehicleNumber && 
    (c.status || 'Open') === 'Open'
  ) : [];

  // Seized documents (under open cases)
  const seizedDocs = activeVehicleCases.reduce<string[]>((acc, c) => {
    if (c.seizedDocuments) {
      return [...acc, ...c.seizedDocuments];
    }
    return acc;
  }, []);

  // Missing documents and missing tools for this vehicle (under unresolved missing reports)
  const activeMissingReports = selectedVehicle ? missingReports.filter(r => 
    r.vehiclePlate === selectedVehicle.vehicleNumber && 
    r.status !== 'Resolved'
  ) : [];

  const missingDocs = activeMissingReports.reduce<string[]>((acc, r) => {
    if (r.missingDocuments) {
      return [...acc, ...r.missingDocuments];
    }
    return acc;
  }, []);

  const missingTools = activeMissingReports.reduce<string[]>((acc, r) => {
    if (r.missingTools) {
      return [...acc, ...r.missingTools];
    }
    return acc;
  }, []);

  // Map of document types to their Bengali name
  const documentLabelMap: Record<string, string> = {
    'RP': 'রুট পারমিট (Route Permit)',
    'FC': 'ফিটনেস সার্টিফিকেট (Fitness Certificate)',
    'TT': 'ট্যাক্স টোকেন (Tax Token)',
    'RC': 'রেজিস্ট্রেশন সার্টিফিকেট / ব্লু বুক',
    'ADS': 'অনুমোদিত ড্রাইভার লাইসেন্স (ADS)'
  };

  // Standard tool list
  const standardTools = ['Jack', 'Spare Wheel', 'Fire Extinguisher', 'First Aid Kit', 'Triangle', 'Tool Box'];
  const toolLabelMap: Record<string, string> = {
    'Jack': 'জ্যাক (Jack)',
    'Spare Wheel': 'স্পেয়ার চাকা (Spare Wheel)',
    'Fire Extinguisher': 'অগ্নি নির্বাপক সিলিন্ডার (Fire Extinguisher)',
    'First Aid Kit': 'প্রাথমিক চিকিৎসা বক্স (First Aid Kit)',
    'Triangle': 'নিরাপত্তা ট্রায়াঙ্গেল (Triangle)',
    'Tool Box': 'টুল বক্স (Tool Box)'
  };

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
              {submitError && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}
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
                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? "সংরক্ষণ করা হচ্ছে (Saving...)" : "Create Pending Trip (ট্রিপ এন্ট্রি করুন)"}
                </Button>
                <Button type="button" variant="secondary" onClick={handleCancel} disabled={isSubmitting}>Cancel</Button>
              </div>
            </form>
          </Card>
        </div>
        <div>
          <Card title="নির্দেশনাবলী (Guidelines)">
            <ul className="space-y-4 text-sm text-slate-600">
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">১</span>
                <span>নতুন ট্রিপ শুরু করার জন্য গাড়িটিকে অবশ্যই 'Available' (উপলব্ধ) স্ট্যাটাসে থাকতে হবে।</span>
              </li>
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">২</span>
                <span>চালকের ইউনিক আইডি (Driver ID) অনুযায়ী চালকের তথ্য স্বয়ংক্রিয়ভাবে সিঙ্ক বা যুক্ত হবে।</span>
              </li>
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">৩</span>
                <span>নিবন্ধিত ট্রিপটি পেন্ডিং বা অপেক্ষমান থাকবে যতক্ষণ না গাড়ি ছাড়ার জন্য OUT QR কোড স্ক্যান করা হচ্ছে।</span>
              </li>
            </ul>
          </Card>

          {!selectedVehicle ? (
            <Card title="গাড়ির লাইভ তথ্য (Live Vehicle Status)" className="mt-6 border-slate-100 bg-slate-50/50">
              <div className="flex items-start gap-3 p-4 text-slate-500 text-xs">
                <Info size={16} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-slate-700">কোনো গাড়ি সিলেক্ট করা হয়নি</p>
                  <p className="text-slate-500 mt-1">বাম পাশে একটি উপলব্ধ গাড়ি সিলেক্ট বা অনুসন্ধান করলে গাড়ির কাগজপত্র, মামলা ও টুলস এর লাইভ আপডেট এখানে দেখতে পাবেন।</p>
                </div>
              </div>
            </Card>
          ) : (
            <Card title={`গাড়ির লাইভ তথ্য: ${selectedVehicle.vehicleNumber}`} className="mt-6 border-slate-100 shadow-lg">
              <div className="space-y-6 text-xs">
                
                {/* 1. Vehicle Documents */}
                <div>
                  <h4 className="font-bold text-slate-700 border-b pb-1.5 flex items-center gap-1.5 mb-3">
                    <FileText size={14} className="text-blue-500" />
                    গাড়ির কাগজপত্র (Documents Status)
                  </h4>
                  <div className="space-y-2">
                    {DOCUMENT_TYPES.map(docCode => {
                      const isSeized = seizedDocs.includes(docCode);
                      const isMissing = missingDocs.includes(docCode);
                      const label = documentLabelMap[docCode] || docCode;

                      return (
                        <div 
                          key={docCode} 
                          className={cn(
                            "flex items-center justify-between p-2.5 rounded-xl border transition-all",
                            isSeized ? "bg-red-50 border-red-200 text-red-800" :
                            isMissing ? "bg-amber-50 border-amber-200 text-amber-800" :
                            "bg-emerald-50/40 border-emerald-100 text-emerald-800"
                          )}
                        >
                          <div className="font-semibold flex items-center gap-2">
                            <span className={cn(
                              "w-1.5 h-1.5 rounded-full shrink-0",
                              isSeized ? "bg-red-500 animate-pulse" :
                              isMissing ? "bg-amber-500" :
                              "bg-emerald-500"
                            )} />
                            <span>{label}</span>
                          </div>
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 border",
                            isSeized ? "bg-red-100 border-red-200 text-red-700" :
                            isMissing ? "bg-amber-100 border-amber-200 text-amber-700" :
                            "bg-emerald-100 border-emerald-200 text-emerald-700"
                          )}>
                            {isSeized ? "মামলায় জব্দ (Seized)" :
                             isMissing ? "হারিয়ে গেছে (Missing)" :
                             "গাড়িতে আছে (OK)"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Active Case Warning / Info */}
                <div>
                  <h4 className="font-bold text-slate-700 border-b pb-1.5 flex items-center gap-1.5 mb-3">
                    <ShieldAlert size={14} className="text-red-500" />
                    মামলার বিবরণ (Legal Cases)
                  </h4>
                  {activeVehicleCases.length === 0 ? (
                    <div className="bg-emerald-50/40 border border-emerald-100 p-3 rounded-xl flex items-center gap-2 text-emerald-800">
                      <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                      <span className="font-semibold">এই গাড়ির কোনো সক্রিয় মামলা নেই (No Active Cases)</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-start gap-2.5 text-red-800">
                        <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0 animate-bounce" />
                        <div>
                          <p className="font-bold text-[13px]">সতর্কতা: গাড়িটি মামলার আওতায় রয়েছে!</p>
                          <p className="text-[10px] text-red-600 mt-0.5">গাড়ি রিলিজ করার পূর্বে অবশ্যই নিশ্চিত করুন যে মামলার কারণে কোনো গুরুত্বপূর্ণ আইনগত বাধা নেই।</p>
                        </div>
                      </div>
                      {activeVehicleCases.map((c, i) => (
                        <div key={c.id || i} className="bg-slate-50 border border-slate-100 p-3 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-slate-700 font-mono text-[11px]">মামলা আইডি: {c.caseId}</span>
                            <span className="text-red-600">জরিমানা: ৳{c.amount?.toLocaleString()}</span>
                          </div>
                          {c.reason && (
                            <p className="text-slate-500 text-[11px] italic">"কারণ: {c.reason}"</p>
                          )}
                          {c.seizedDocuments?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              <span className="text-[10px] text-slate-500 mr-1 font-semibold self-center">জব্দকৃত কাগজ:</span>
                              {c.seizedDocuments.map((doc: string) => (
                                <span key={doc} className="px-1.5 py-0.5 rounded bg-red-100 border border-red-200 text-red-700 font-black text-[9px] uppercase">
                                  {doc}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Vehicle Tools */}
                <div>
                  <h4 className="font-bold text-slate-700 border-b pb-1.5 flex items-center gap-1.5 mb-3">
                    <Wrench size={14} className="text-emerald-600" />
                    গাড়ির সরঞ্জাম ও টুলস (Tools Checklist)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {standardTools.map(tool => {
                      const isMissing = missingTools.includes(tool);
                      const label = toolLabelMap[tool] || tool;

                      return (
                        <div 
                          key={tool} 
                          className={cn(
                            "flex items-center justify-between p-2.5 rounded-xl border transition-all",
                            isMissing ? "bg-red-50/60 border-red-100 text-red-800" : "bg-slate-50/50 border-slate-100 text-slate-700"
                          )}
                        >
                          <div className="font-semibold flex items-center gap-1.5">
                            <span>🔧</span>
                            <span className={cn(isMissing && "line-through text-slate-400")}>{label}</span>
                          </div>
                          <span className={cn(
                            "text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase shrink-0 border",
                            isMissing ? "bg-red-100 border-red-100 text-red-700" : "bg-emerald-50 border-emerald-100 text-emerald-700"
                          )}>
                            {isMissing ? "অনুপস্থিত" : "আছে"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {missingTools.length > 0 && (
                    <p className="mt-2 text-[10px] text-amber-600 bg-amber-50 border border-amber-100/40 p-2 rounded-lg italic">
                      ⚠️ গ্যারেজে গাড়িটি রিটার্ন করার সময় <strong>{missingTools.join(', ')}</strong> অনুপস্থিত ছিল। অনুগ্রহ করে রিলিজের সময় চালককে এই বিষয়ে অবহিত করুন।
                    </p>
                  )}
                </div>

              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewTrip;
