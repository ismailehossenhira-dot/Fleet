import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  MapPin, 
  Search, 
  CheckCircle2, 
  PlusCircle, 
  Phone, 
  AlertTriangle,
  AlertCircle,
  FileText,
  Wrench,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Info,
  Truck,
  Calendar,
  Check,
  Ban,
  TrendingUp,
  History,
  Clock,
  Sparkles,
  Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Card, 
  Button, 
  StaffProfileButton, 
  VehicleProfileButton,
  AuditDetailsDropdown,
  STANDARD_VEHICLE_TOOLS,
  STANDARD_VEHICLE_DOCS,
  getDefaultVehicleTools,
  getDefaultVehicleDocs
} from './components/Common';
import { 
  subscribeToCollection, 
  findStaffById, 
  createTrip,
  updateVehicle
} from './db';
import { cn, DOCUMENT_TYPES } from './lib/utils';
import { useAuth } from './AuthContext';
import { useWarehouse, SUPPORTED_WAREHOUSES, WarehouseBadge } from './WarehouseContext';
import { 
  DestinationAutocomplete, 
  rememberDestinationLocation 
} from './components/DestinationAutocomplete';

const NewTrip: React.FC = () => {
  const { isAdmin, isSubAdmin, isLineSupervisor, profile } = useAuth();
  const { 
    selectedWarehouse, 
    setSelectedWarehouse, 
    filterByWarehouse, 
    getWarehouseBadge,
    userWarehouse,
    assignedWarehouse,
    isWarehouseLocked 
  } = useWarehouse();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryVehicleId = searchParams.get('vehicleId');
  const canManage = isAdmin || isSubAdmin || isLineSupervisor;

  // Determine user's active/assigned warehouse
  const effectiveUserWarehouse = 
    (profile?.warehouse && profile.warehouse !== 'all' && profile.warehouse !== 'সকল ডিপো')
      ? profile.warehouse
      : (selectedWarehouse !== 'all' && selectedWarehouse !== 'সকল ডিপো' ? selectedWarehouse : (assignedWarehouse || 'মোহাম্মদপুর'));

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [missingReports, setMissingReports] = useState<any[]>([]);
  const [isSearchingDriver, setIsSearchingDriver] = useState(false);
  const [driverStatus, setDriverStatus] = useState<'idle' | 'searching' | 'found' | 'not_found'>('idle');
  const [isSearchingHelper, setIsSearchingHelper] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState(() => {
    return localStorage.getItem('newtrip_vehicleSearch') || '';
  });

  const [isOtherWarehouseConfirmed, setIsOtherWarehouseConfirmed] = useState(false);
  const [showOtherWarehouseConfirmModal, setShowOtherWarehouseConfirmModal] = useState(false);

  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('newtrip_formData');
    return saved ? JSON.parse(saved) : {
      vehicleId: '',
      vehiclePlate: '',
      warehouse: effectiveUserWarehouse,
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

  // All available vehicles (Available status and no active trips)
  const availableVehicles = vehicles.filter(v => {
    if (v.status !== 'Available') return false;
    const hasActiveTrip = trips.some(t => t.vehicleId === v.id && (t.status === 'Pending' || t.status === 'Running'));
    return !hasActiveTrip;
  });

  // Strictly filter to user's warehouse vehicles for manual selection
  const manualAvailableVehicles = availableVehicles.filter(v => {
    const vWh = (v.warehouse || 'মোহাম্মদপুর').trim().toLowerCase();
    return vWh === effectiveUserWarehouse.trim().toLowerCase();
  });

  // Find currently selected vehicle object
  const selectedVehicle = vehicles.find(v => v.id === formData.vehicleId);
  const selectedVehicleWarehouse = selectedVehicle ? (selectedVehicle.warehouse || 'মোহাম্মদপুর').trim() : '';

  // Check if selected vehicle belongs to a different warehouse than user's warehouse
  const isOtherWarehouseVehicle = Boolean(
    selectedVehicle && 
    effectiveUserWarehouse && 
    selectedVehicleWarehouse.toLowerCase() !== effectiveUserWarehouse.toLowerCase()
  );

  const handleVehicleChange = (val: string) => {
    const vehicle = vehicles.find(v => v.id === val);
    setFormData(prev => ({ 
      ...prev, 
      vehicleId: val, 
      vehiclePlate: vehicle?.vehicleNumber || '',
      warehouse: effectiveUserWarehouse
    }));
    setIsOtherWarehouseConfirmed(false);
    setSubmitError(null);
  };

  // Re-verify driver if preloaded from storage
  useEffect(() => {
    if (formData.driverId && formData.driverId !== 'DRV-') {
      const checkPreloaded = async () => {
        try {
          const staff = await findStaffById(formData.driverId) as any;
          if (staff && !staff.isSuspended) {
            setDriverStatus('found');
            if (!formData.driverName) {
              setFormData(prev => ({
                ...prev,
                driverName: staff.name,
                driverPhone: staff.phoneNumber || ''
              }));
            }
          } else {
            setDriverStatus('not_found');
          }
        } catch {
          setDriverStatus('not_found');
        }
      };
      checkPreloaded();
    }
  }, []);

  const driverSuffix = (formData.driverId || '').replace(/^DRV-?/i, '');
  const helperSuffix = (formData.helperId || '').replace(/^HLP-?/i, '');

  const handleDriverSuffixChange = (val: string) => {
    const cleaned = val.replace(/^DRV-?/i, '').trim().toUpperCase();
    const fullId = 'DRV-' + cleaned;
    handleDriverSearch(fullId);
  };

  const handleHelperSuffixChange = (val: string) => {
    const cleaned = val.replace(/^HLP-?/i, '').trim().toUpperCase();
    const fullId = cleaned ? ('HLP-' + cleaned) : 'HLP-';
    handleHelperSearch(fullId);
  };

  const handleDriverSearch = async (val: string) => {
    const id = val.trim().toUpperCase();
    setFormData(prev => ({ ...prev, driverId: id, driverName: '', driverPhone: '' }));
    setSubmitError(null);

    if (!id || id === 'DRV-') {
      setDriverStatus('idle');
      return;
    }

    if (id.length >= 5) {
      setIsSearchingDriver(true);
      setDriverStatus('searching');
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
            setDriverStatus('not_found');
          } else {
            setFormData(prev => ({ 
              ...prev, 
              driverName: staff.name, 
              driverPhone: staff.phoneNumber || '' 
            }));
            setDriverStatus('found');
          }
        } else {
          setFormData(prev => ({ 
            ...prev, 
            driverName: '', 
            driverPhone: '' 
          }));
          setDriverStatus('not_found');
        }
      } catch (err) {
        console.error("Driver fetch error:", err);
        setDriverStatus('not_found');
      } finally {
        setIsSearchingDriver(false);
      }
    } else {
      setDriverStatus('idle');
    }
  };

  const handleHelperSearch = async (val: string) => {
    const id = val.trim().toUpperCase();
    setFormData(prev => ({ ...prev, helperId: id, helperName: '', helperPhone: '' }));
    setSubmitError(null);

    if (!id || id === 'HLP-') {
      return;
    }

    if (id.length >= 5) {
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
    setIsOtherWarehouseConfirmed(false);
    setShowOtherWarehouseConfirmModal(false);
    navigate('/trips');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicleId || !formData.driverId || !formData.location) return;
    
    // Warning check: If selecting a vehicle from another warehouse and not confirmed yet
    if (isOtherWarehouseVehicle && !isOtherWarehouseConfirmed) {
      setShowOtherWarehouseConfirmModal(true);
      return;
    }

    await executeTripCreation();
  };

  const handleConfirmOtherWarehouseTrip = async () => {
    setIsOtherWarehouseConfirmed(true);
    setShowOtherWarehouseConfirmModal(false);
    await executeTripCreation(true);
  };

  const handleCancelOtherWarehouseTrip = () => {
    setShowOtherWarehouseConfirmModal(false);
    setIsOtherWarehouseConfirmed(false);
    setFormData(prev => ({
      ...prev,
      vehicleId: '',
      vehiclePlate: ''
    }));
    setVehicleSearch('');
  };

  const executeTripCreation = async (bypassWarehouseWarning = false) => {
    setIsSubmitting(true);
    setSubmitError(null);

    const drvId = formData.driverId?.trim().toUpperCase();
    if (!drvId || drvId === 'DRV-') {
      setSubmitError('অনুগ্রহ করে চালকের ড্রাইভার আইডি (Driver ID) প্রদান করুন।');
      setDriverStatus('not_found');
      setIsSubmitting(false);
      return;
    }

    // 1. Fetch and verify driver exists in database and check suspension status
    const staff = await findStaffById(drvId) as any;
    if (!staff) {
      setSubmitError(`ড্রাইভার আইডি "${formData.driverId}" ডেটাবেজে খুঁজে পাওয়া যায়নি! ডেটাবেজে চালকের তথ্য না থাকলে ট্রিপ এন্ট্রি করা যাবে না।`);
      setDriverStatus('not_found');
      setIsSubmitting(false);
      return;
    }

    if (staff.isSuspended) {
      setSubmitError(`চালক ${staff.name} (${staff.driverId}) বর্তমানে সাসপেন্ড আছেন! সাসপেন্ড থাকাকালীন ট্রিপে যোগ দেওয়া যাবে না।`);
      setDriverStatus('not_found');
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
      const selectedVeh = vehicles.find(v => v.id === formData.vehicleId);
      const tripData = {
        ...formData,
        warehouse: formData.warehouse || selectedVeh?.warehouse || effectiveUserWarehouse || (selectedWarehouse !== 'all' ? selectedWarehouse : 'মোহাম্মদপুর')
      };
      await createTrip(tripData, profile);
      // Remember destination location for future auto-suggestions
      if (formData.location) {
        rememberDestinationLocation(formData.location);
      }
      setVehicleSearch('');
      setIsOtherWarehouseConfirmed(false);
      setShowOtherWarehouseConfirmModal(false);
      setFormData({
        vehicleId: '',
        vehiclePlate: '',
        warehouse: effectiveUserWarehouse,
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

  // Vehicle Profile tools & docs state
  const vehicleToolsState = getDefaultVehicleTools(selectedVehicle?.tools);
  const vehicleDocsState = getDefaultVehicleDocs(selectedVehicle?.documents);

  // Active & total cases for selected vehicle
  const totalVehicleCases = selectedVehicle ? cases.filter(c => 
    c.vehicleId === selectedVehicle.vehicleNumber || c.vehiclePlate === selectedVehicle.vehicleNumber
  ) : [];

  const activeVehicleCases = totalVehicleCases.filter(c => (c.status || 'Open') === 'Open');
  const totalFineAmount = activeVehicleCases.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  // Trips stats for selected vehicle
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const vehicleTrips = selectedVehicle ? trips.filter(t => 
    (t.vehicleId === selectedVehicle.id || t.vehiclePlate === selectedVehicle.vehicleNumber)
  ) : [];

  const completedThisMonth = vehicleTrips.filter(t => {
    if (t.status !== 'Completed') return false;
    const tripDate = t.endTime?.toDate?.() || t.createdAt?.toDate?.() || (t.createdAt ? new Date(t.createdAt) : null);
    if (!tripDate) return false;
    return tripDate.getMonth() === currentMonth && tripDate.getFullYear() === currentYear;
  }).length;

  const totalCompletedTrips = vehicleTrips.filter(t => t.status === 'Completed').length;
  const runningTrips = vehicleTrips.filter(t => t.status === 'Running').length;

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

  // Toggle tool directly from live info panel
  const [isUpdatingTool, setIsUpdatingTool] = useState(false);
  const handleToggleTool = async (toolKey: string, currentVal: boolean) => {
    if (!selectedVehicle || !canManage || isUpdatingTool) return;
    setIsUpdatingTool(true);
    const updatedTools = {
      ...vehicleToolsState,
      [toolKey]: !currentVal
    };
    try {
      await updateVehicle(selectedVehicle.id, { tools: updatedTools }, profile);
    } catch (err) {
      console.error("Failed to update tool status:", err);
    } finally {
      setIsUpdatingTool(false);
    }
  };

  // Toggle document directly from live info panel
  const [isUpdatingDoc, setIsUpdatingDoc] = useState(false);
  const handleToggleDoc = async (docKey: string, currentVal: boolean) => {
    if (!selectedVehicle || !canManage || isUpdatingDoc) return;
    setIsUpdatingDoc(true);
    const updatedDocs = {
      ...vehicleDocsState,
      [docKey]: !currentVal
    };
    try {
      await updateVehicle(selectedVehicle.id, { documents: updatedDocs }, profile);
    } catch (err) {
      console.error("Failed to update document status:", err);
    } finally {
      setIsUpdatingDoc(false);
    }
  };

  if (!canManage) {
    return null;
  }

  return (
    <div className="space-y-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">নতুন ট্রিপ এন্ট্রি</h2>
            <span className={cn(
              "px-2.5 py-0.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 shadow-2xs",
              getWarehouseBadge(effectiveUserWarehouse).bg,
              getWarehouseBadge(effectiveUserWarehouse).border,
              getWarehouseBadge(effectiveUserWarehouse).textCol
            )}>
              <Building2 size={13} />
              <span>ডিপো: {effectiveUserWarehouse}</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Register and dispatch vehicles for pending trips.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card title="Register New Trip Dispatch" className="border-2 border-slate-200/90 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              {submitError && (
                <div className="p-3 bg-red-50 border-2 border-red-200 text-red-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3.5 bg-blue-50/60 rounded-xl border-2 border-blue-200 shadow-2xs">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Search Vehicle (Last 4 digits)</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        maxLength={4}
                        className="w-full px-3.5 py-2 rounded-lg border-2 border-blue-300/90 bg-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 font-mono tracking-widest text-base font-bold text-slate-800 transition-all placeholder:text-slate-400 placeholder:font-normal"
                        placeholder="Ex: 5821"
                        value={vehicleSearch}
                        onChange={e => {
                          const val = e.target.value;
                          setVehicleSearch(val);
                          if (val.length === 4) {
                            // 1. Search in user's assigned warehouse first
                            const matchInDepot = manualAvailableVehicles.find(v => v.vehicleNumber.endsWith(val));
                            if (matchInDepot) {
                              handleVehicleChange(matchInDepot.id);
                            } else {
                              // 2. Search in other warehouses (will trigger warning)
                              const matchOther = availableVehicles.find(v => v.vehicleNumber.endsWith(val));
                              if (matchOther) {
                                handleVehicleChange(matchOther.id);
                              }
                            }
                          }
                        }}
                      />
                      {formData.vehiclePlate && (
                        <div className="absolute right-3 top-2.5 flex items-center gap-1">
                          <CheckCircle2 size={15} className="text-emerald-500" />
                          <span className="text-[10px] font-bold text-emerald-600 uppercase">Selected</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Selected / Choose Available
                      </label>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded">
                        {effectiveUserWarehouse} ডিপো
                      </span>
                    </div>
                    <select 
                      required
                      className={cn(
                        "w-full px-3.5 py-2 rounded-lg border-2 bg-white outline-none focus:ring-2 font-bold text-slate-900 text-xs sm:text-sm transition-all cursor-pointer",
                        isOtherWarehouseVehicle 
                          ? "border-amber-400 focus:border-amber-500 focus:ring-amber-100 bg-amber-50/30"
                          : "border-blue-300/90 focus:border-blue-600 focus:ring-blue-100"
                      )}
                      value={formData.vehicleId}
                      onChange={e => handleVehicleChange(e.target.value)}
                    >
                      <option value="">
                        {manualAvailableVehicles.length > 0 
                          ? `-- [${effectiveUserWarehouse}] ডিপোর গাড়ি (${manualAvailableVehicles.length}টি উপলব্ধ) --` 
                          : `-- [${effectiveUserWarehouse}] ডিপোতে কোনো গাড়ি উপলব্ধ নেই --`}
                      </option>
                      {manualAvailableVehicles.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.vehicleNumber} ({v.type})
                        </option>
                      ))}
                      {/* If an other-warehouse vehicle was selected via search or link, keep it selectable with warning tag */}
                      {isOtherWarehouseVehicle && selectedVehicle && !manualAvailableVehicles.some(v => v.id === selectedVehicle.id) && (
                        <option key={selectedVehicle.id} value={selectedVehicle.id} className="text-amber-800 bg-amber-50 font-black">
                          ⚠️ [{selectedVehicleWarehouse}] {selectedVehicle.vehicleNumber} ({selectedVehicle.type}) - অন্য ডিপোর গাড়ি
                        </option>
                      )}
                    </select>
                    {formData.vehiclePlate && (
                      <div className="mt-1 flex items-center justify-between px-1">
                        <p className={cn(
                          "text-[10px] font-bold uppercase tracking-tight",
                          isOtherWarehouseVehicle ? "text-amber-700" : "text-blue-600"
                        )}>
                          Active: {formData.vehiclePlate} {isOtherWarehouseVehicle ? `(${selectedVehicleWarehouse})` : ''}
                        </p>
                        {selectedVehicle && (
                          <VehicleProfileButton vehicle={selectedVehicle} />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Warning Alert if selecting vehicle from another warehouse */}
                  {isOtherWarehouseVehicle && selectedVehicle && (
                    <div className="md:col-span-2 p-3.5 bg-amber-50 border-2 border-amber-400 rounded-xl shadow-2xs animate-in fade-in duration-200">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-amber-100 text-amber-700 rounded-lg shrink-0 mt-0.5 border border-amber-300">
                          <AlertTriangle size={20} className="stroke-[2.5]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="px-2.5 py-0.5 rounded-md text-xs font-black bg-amber-500 text-white tracking-wide uppercase">
                              অন্য ডিপোর গাড়ি সতর্কতা!
                            </span>
                            <span className="text-xs font-bold text-amber-950">
                              গাড়ির মূল ডিপো: <span className="underline decoration-amber-500 decoration-2 font-bold">{selectedVehicleWarehouse}</span>
                            </span>
                            <span className="text-xs font-semibold text-slate-600">
                              (আপনার বর্তমান ডিপো: <span className="font-bold text-blue-700">{effectiveUserWarehouse}</span>)
                            </span>
                          </div>
                          <p className="text-xs text-amber-900 font-medium leading-relaxed">
                            <strong className="font-bold">সতর্কবার্তা:</strong> আপনি যে গাড়িটি (<span className="font-mono font-bold text-slate-900">{selectedVehicle.vehicleNumber}</span>) নির্বাচন করেছেন তা আপনার ডিপোর অন্তর্ভুক্ত নয়। এটি <span className="font-bold text-amber-950">{selectedVehicleWarehouse}</span> ডিপোর গাড়ি।
                          </p>
                          <p className="text-[11px] text-amber-800/90 mt-1">
                            💡 গাড়িটি যদি আপনার ডিপোতে ব্যবহৃত হতে থাকে, তবে ইন্টার-ডিপো ট্রান্সফার (Inter-Warehouse Transfer) সম্পন্ন করুন অথবা নিশ্চিত হলে ট্রিপ তৈরি করুন।
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Driver ID Search <span className="text-red-500">*</span>
                    </label>
                    {driverStatus === 'found' && (
                      <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                        <CheckCircle2 size={12} /> যাচাইকৃত
                      </span>
                    )}
                    {driverStatus === 'not_found' && (
                      <span className="text-[10px] font-bold text-red-600 flex items-center gap-0.5">
                        <AlertCircle size={12} /> ডেটাবেজে নেই
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <div className={cn(
                      "flex items-center w-full rounded-lg border-2 bg-white overflow-hidden transition-all shadow-2xs",
                      driverStatus === 'not_found'
                        ? "border-red-400 bg-red-50/20 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-100"
                        : driverStatus === 'found'
                        ? "border-emerald-400 bg-emerald-50/10 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100"
                        : "border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100"
                    )}>
                      {/* Non-deletable, unchangeable fixed prefix badge */}
                      <span 
                        className="bg-slate-100 text-slate-700 font-mono font-black text-xs sm:text-sm px-3 py-2 border-r border-slate-300 select-none shrink-0 tracking-wider flex items-center"
                        title="ফিক্সড প্রেফিক্স (পরিবর্তন অযোগ্য)"
                      >
                        DRV-
                      </span>
                      <input 
                        type="text" 
                        required
                        className="w-full px-3 py-2 bg-transparent outline-none text-slate-800 text-xs sm:text-sm font-semibold tracking-wide"
                        placeholder="আইডির বাকি অংশ (যেমন: 001)"
                        value={driverSuffix}
                        onChange={e => handleDriverSuffixChange(e.target.value)}
                      />
                      <div className="pr-3 flex items-center gap-1.5 shrink-0">
                        {isSearchingDriver ? (
                          <div className="animate-spin text-blue-500"><Search size={15} /></div>
                        ) : driverStatus === 'found' ? (
                          <CheckCircle2 size={16} className="text-emerald-500" />
                        ) : driverStatus === 'not_found' ? (
                          <AlertCircle size={16} className="text-red-500" />
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {driverStatus === 'not_found' && (
                    <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>এই ড্রাইভার আইডিটি ডেটাবেজে নেই। আইডি যাচাই করে পুনরায় লিখুন।</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Helper ID Search (Opt)</label>
                  <div className="relative">
                    <div className="flex items-center w-full rounded-lg border-2 border-slate-300 bg-white overflow-hidden transition-all shadow-2xs focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-100">
                      {/* Non-deletable, unchangeable fixed prefix badge */}
                      <span 
                        className="bg-slate-100 text-slate-700 font-mono font-black text-xs sm:text-sm px-3 py-2 border-r border-slate-300 select-none shrink-0 tracking-wider flex items-center"
                        title="ফিক্সড প্রেফিক্স (পরিবর্তন অযোগ্য)"
                      >
                        HLP-
                      </span>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 bg-transparent outline-none text-slate-800 text-xs sm:text-sm font-semibold tracking-wide"
                        placeholder="আইডির বাকি অংশ (ঐচ্ছিক)"
                        value={helperSuffix}
                        onChange={e => handleHelperSuffixChange(e.target.value)}
                      />
                      <div className="pr-3 flex items-center gap-1.5 shrink-0">
                        {isSearchingHelper && <div className="animate-spin text-purple-500"><Search size={15} /></div>}
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">Driver Name</label>
                    {formData.driverName && (
                      <StaffProfileButton staffId={formData.driverId} staffName={formData.driverName} role="Driver" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <input 
                      type="text" 
                      readOnly
                      className="w-full px-3.5 py-2 rounded-lg border-2 border-slate-200 bg-slate-100/80 text-slate-900 font-semibold text-xs sm:text-sm"
                      placeholder="Auto-fetched..."
                      value={formData.driverName}
                    />
                    {formData.driverPhone && (
                      <p className="text-[10px] text-blue-600 font-bold px-1">📞 {formData.driverPhone}</p>
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">Helper Name</label>
                    {formData.helperName && (
                      <StaffProfileButton staffId={formData.helperId} staffName={formData.helperName} role="Helper" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <input 
                      type="text" 
                      readOnly
                      className="w-full px-3.5 py-2 rounded-lg border-2 border-slate-200 bg-slate-100/80 text-slate-900 font-semibold text-xs sm:text-sm"
                      placeholder="Auto-fetched..."
                      value={formData.helperName}
                    />
                    {formData.helperPhone && (
                      <p className="text-[10px] text-purple-600 font-bold px-1">📞 {formData.helperPhone}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Destination Location (গন্তব্য) <span className="text-red-500">*</span>
                  </label>
                  <DestinationAutocomplete 
                    value={formData.location}
                    onChange={val => setFormData({ ...formData, location: val })}
                    trips={trips}
                    required
                    placeholder="e.g. Ra লিখলে Rajshahi বা পূর্বের নামগুলো দেখাবে..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">আনুমানিক টোল বাজেট (টাকা)</label>
                  <input 
                    type="number" 
                    className="w-full px-3.5 py-2 rounded-lg border-2 border-slate-300 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-800 text-xs sm:text-sm font-mono font-medium transition-all"
                    placeholder="e.g. 1500"
                    value={formData.tollAmount || ''}
                    onChange={e => setFormData({ ...formData, tollAmount: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-200">
                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? "সংরক্ষণ করা হচ্ছে..." : "ট্রিপ এন্ট্রি করুন"}
                </Button>
                <Button type="button" variant="secondary" onClick={handleCancel} disabled={isSubmitting}>Cancel</Button>
              </div>
            </form>
          </Card>

          {/* Live Vehicle Information Section - Directly below Register New Trip Form */}
          {!selectedVehicle ? (
            <Card title="গাড়ির লাইভ তথ্য" className="mt-6 border-slate-200 bg-slate-50/80">
              <div className="flex items-start gap-3 p-4 text-slate-600 text-sm">
                <Info size={20} className="text-blue-500 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-bold text-slate-800">কোনো গাড়ি সিলেক্ট করা হয়নি</p>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    উপরের ফর্ম থেকে একটি গাড়ি নির্বাচন অথবা শেষ ৪ ডিজিট দিয়ে সার্চ করলে এখানে সেই গাড়ির লাইভ স্ট্যাটাস, টুলস, কাগজপত্র, সক্রিয় মামলা এবং ট্রিপ হিস্ট্রি প্রদর্শিত হবে।
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <Card 
              title={
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Truck size={18} className="text-blue-600" />
                    <span className="font-bold text-slate-900 text-sm sm:text-base">গাড়ির লাইভ তথ্য: {selectedVehicle.vehicleNumber}</span>
                  </div>
                  <VehicleProfileButton vehicle={selectedVehicle} />
                </div>
              } 
              className="mt-6 border-blue-200 shadow-md ring-1 ring-blue-500/10"
            >
              <div className="space-y-5 text-xs">
                
                {/* Other Warehouse Alert inside Live Vehicle Card */}
                {isOtherWarehouseVehicle && (
                  <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-xl flex items-center justify-between gap-3 text-amber-900 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={18} className="text-amber-600 shrink-0 stroke-[2.5]" />
                      <span className="font-bold text-xs">
                        সতর্কতা: এই গাড়ির মূল ডিপো "{selectedVehicleWarehouse}" (আপনার বর্তমান ডিপো: "{effectiveUserWarehouse}")
                      </span>
                    </div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-200 text-amber-900 shrink-0">
                      অন্য ডিপোর গাড়ি
                    </span>
                  </div>
                )}
                
                {/* 1. Vehicle Core Profile Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl space-y-0.5">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">গাড়ির ধরণ</span>
                    <span className="font-black text-slate-800 text-sm">{selectedVehicle.type || 'Standard'}</span>
                  </div>
                  <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl space-y-0.5">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">স্ট্যাটাস</span>
                    <span className="font-black text-emerald-700 text-sm flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      {selectedVehicle.status || 'Available'}
                    </span>
                  </div>
                  <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-xl space-y-0.5">
                    <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">চলতি মাসের ট্রিপ</span>
                    <span className="font-black text-purple-800 text-sm">{completedThisMonth} টি সম্পন্ন</span>
                    <span className="text-[10px] text-purple-600 font-medium block">সর্বমোট {totalCompletedTrips} টি ট্রিপ</span>
                  </div>
                  <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl space-y-0.5">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">মামলা সংক্রান্ত</span>
                    <span className="font-black text-amber-800 text-sm">{totalVehicleCases.length} টি মামলা</span>
                    <span className="text-[10px] text-amber-700 font-medium block">
                      সক্রিয়: {activeVehicleCases.length} টি ({totalFineAmount > 0 ? `৳${totalFineAmount.toLocaleString()}` : 'বকেয়া নেই'})
                    </span>
                  </div>
                </div>

                {/* 2. Last Trip Details if any */}
                {vehicleTrips.length > 0 && (() => {
                  const lastTrip = vehicleTrips[0];
                  return (
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <History size={12} className="text-slate-400" />
                          সর্বশেষ ট্রিপের বিবরণ
                        </span>
                        <span className={cn(
                          "text-[9px] font-bold px-2 py-0.5 rounded uppercase",
                          lastTrip.status === 'Completed' ? "bg-emerald-100 text-emerald-700" :
                          lastTrip.status === 'Running' ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                        )}>
                          {lastTrip.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between text-[11px] pt-1">
                        <span className="font-bold text-slate-800">চালক: {lastTrip.driverName || lastTrip.driverId}</span>
                        <span className="text-slate-600 flex items-center gap-1">
                          <MapPin size={11} className="text-blue-500" />
                          {lastTrip.location || 'N/A'}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Maintenance Notes if any */}
                {selectedVehicle.maintenanceNotes && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-0.5">
                    <p className="font-bold flex items-center gap-1.5 text-xs text-amber-800">
                      <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                      মেইনটেনেন্স নোট / গাড়ির সমস্যা:
                    </p>
                    <p className="text-xs text-amber-950 pl-5 font-medium">{selectedVehicle.maintenanceNotes}</p>
                  </div>
                )}

                {/* 4. Vehicle Tools Option from Profile (Read-only view) */}
                <div>
                  <div className="flex items-center justify-between border-b pb-1.5 mb-2.5">
                    <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs sm:text-sm">
                      <Wrench size={16} className="text-blue-600" />
                      <span>টুলস অপশন</span>
                    </h4>
                    <span className="text-[11px] text-slate-500 font-medium">গাড়ির প্রোফাইল অনুযায়ী</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {STANDARD_VEHICLE_TOOLS.map(tool => {
                      const isAvailable = !!vehicleToolsState[tool.key as keyof typeof vehicleToolsState];
                      const isReportedMissing = missingTools.some(t => t.toLowerCase() === tool.key.toLowerCase() || t.toLowerCase() === tool.label.toLowerCase());
                      const ToolIcon = tool.icon || Wrench;

                      return (
                        <div 
                          key={tool.key}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl border transition-all gap-2",
                            !isAvailable || isReportedMissing
                              ? "bg-red-50/80 border-red-200 text-red-950" 
                              : "bg-slate-50/95 border-slate-200/90 text-slate-900"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold",
                              !isAvailable || isReportedMissing
                                ? "bg-red-100 text-red-600 border border-red-200" 
                                : "bg-blue-100 text-blue-700 border border-blue-200"
                            )}>
                              <ToolIcon size={16} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-xs sm:text-sm text-slate-900 leading-snug">
                                {tool.label}
                              </p>
                              <p className="text-[11px] font-medium mt-0.5 text-slate-500">
                                {!isAvailable ? "গাড়িতে অনুপস্থিত" : isReportedMissing ? "রিপোর্টে মিসিং" : "গাড়িতে প্রস্তুত রয়েছে"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center shrink-0">
                            <span className={cn(
                              "text-xs font-bold px-2.5 py-1 rounded-lg uppercase border whitespace-nowrap leading-none text-center shadow-xs",
                              !isAvailable 
                                ? "bg-red-100 border-red-300 text-red-700" 
                                : isReportedMissing
                                ? "bg-amber-100 border-amber-300 text-amber-800"
                                : "bg-emerald-100 border-emerald-300 text-emerald-800"
                            )}>
                              {!isAvailable ? "নেই" : isReportedMissing ? "মিসিং" : "আছে"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 5. Vehicle Documents Option from Profile (Read-only view) */}
                <div>
                  <div className="flex items-center justify-between border-b pb-1.5 mb-2.5">
                    <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs sm:text-sm">
                      <FileText size={16} className="text-emerald-600" />
                      <span>কাগজপত্র স্ট্যাটাস</span>
                    </h4>
                    <span className="text-[11px] text-slate-500 font-medium">বৈধতা ও জব্দ সংক্রান্ত তথ্য</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {STANDARD_VEHICLE_DOCS.map(doc => {
                      const isSeized = seizedDocs.some(d => d.toUpperCase() === doc.code.toUpperCase());
                      const isMissing = missingDocs.some(d => d.toUpperCase() === doc.code.toUpperCase());
                      const isDocAvailable = !!vehicleDocsState[doc.code as keyof typeof vehicleDocsState];

                      // Clean label display without duplicated code
                      const cleanDocName = doc.label.replace(/^[A-Za-z]+\s*\((.*?)\)$/, '$1') || doc.label;

                      return (
                        <div 
                          key={doc.code} 
                          className={cn(
                            "flex items-center justify-between p-3.5 rounded-xl border transition-all gap-3 overflow-hidden",
                            isSeized ? "bg-red-50/90 border-red-200 text-red-950" :
                            isMissing ? "bg-amber-50/90 border-amber-200 text-amber-950" :
                            !isDocAvailable ? "bg-slate-100/90 border-slate-200 text-slate-600" :
                            "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                          )}
                        >
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <span className={cn(
                              "w-3 h-3 rounded-full shrink-0 mt-1",
                              isSeized ? "bg-red-500 animate-pulse" :
                              isMissing ? "bg-amber-500" :
                              !isDocAvailable ? "bg-slate-400" :
                              "bg-emerald-500"
                            )} />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-xs font-mono font-black text-slate-800 shrink-0 shadow-xs">
                                  {doc.code}
                                </span>
                                <span className="font-bold text-xs sm:text-sm text-slate-900 leading-snug">
                                  {cleanDocName}
                                </span>
                              </div>
                              {isSeized && (
                                <p className="text-xs text-red-600 font-bold mt-1">⚠️ পুলিশের মামলায় জব্দ রয়েছে</p>
                              )}
                              {isMissing && (
                                <p className="text-xs text-amber-700 font-bold mt-1">⚠️ ডকুমেন্টটি হারিয়ে গেছে</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center shrink-0">
                            <span className={cn(
                              "text-xs font-bold px-3 py-1.5 rounded-lg uppercase shrink-0 border whitespace-nowrap leading-none text-center shadow-xs",
                              isSeized ? "bg-red-100 border-red-300 text-red-700" :
                              isMissing ? "bg-amber-100 border-amber-300 text-amber-800" :
                              !isDocAvailable ? "bg-slate-200 border-slate-300 text-slate-700" :
                              "bg-emerald-100 border-emerald-300 text-emerald-800"
                            )}>
                              {isSeized ? "মামলায় জব্দ" :
                               isMissing ? "হারিয়ে গেছে" :
                               !isDocAvailable ? "অনুপলব্ধ" :
                               "বৈধ ও আছে"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 6. Legal Cases Section */}
                <div>
                  <div className="flex items-center justify-between border-b pb-1.5 mb-2.5">
                    <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs sm:text-sm">
                      <ShieldAlert size={15} className="text-red-500" />
                      <span>মামলার বিবরণ</span>
                    </h4>
                    <span className="text-[10px] text-slate-400 font-medium">মোট: {totalVehicleCases.length} টি</span>
                  </div>

                  {activeVehicleCases.length === 0 ? (
                    <div className="bg-emerald-50/60 border border-emerald-100 p-3 rounded-xl flex items-center gap-2 text-emerald-800">
                      <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                      <span className="font-semibold text-xs">এই গাড়ির কোনো সক্রিয় বা বকেয়া মামলা নেই</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-start gap-2.5 text-red-900">
                        <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0 animate-bounce" />
                        <div>
                          <p className="font-bold text-xs sm:text-sm">সতর্কতা: গাড়িটি সক্রিয় মামলার আওতায় রয়েছে!</p>
                          <p className="text-[11px] text-red-700 mt-0.5">
                            মোট বকেয়া জরিমানা: <span className="font-black font-mono text-xs">৳{totalFineAmount.toLocaleString()}</span>। গাড়ি ছাড়ার পূর্বে নিশ্চিত করুন যে কোনো আইনি জটিলতা নেই।
                          </p>
                        </div>
                      </div>

                      {activeVehicleCases.map((c, i) => (
                        <div key={c.id || i} className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-slate-700 font-mono text-xs">মামলা নং: {c.caseId}</span>
                            <span className="text-red-600 font-black font-mono text-xs">জরিমানা: ৳{Number(c.amount || 0).toLocaleString()}</span>
                          </div>
                          {c.reason && (
                            <p className="text-slate-600 text-xs"><strong>কারণ:</strong> {c.reason}</p>
                          )}
                          {c.seizedDocuments?.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="text-[10px] text-slate-500 font-bold">জব্দকৃত কাগজ:</span>
                              {c.seizedDocuments.map((doc: string) => (
                                <span key={doc} className="px-1.5 py-0.5 rounded bg-red-100 border border-red-200 text-red-700 font-black text-[10px] uppercase">
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

                {/* 7. Unresolved Missing Reports if any */}
                {activeMissingReports.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between border-b pb-1.5 mb-2.5">
                      <h4 className="font-bold text-amber-800 flex items-center gap-1.5 text-xs sm:text-sm">
                        <AlertTriangle size={15} className="text-amber-500" />
                        <span>মিসিং মালামাল রিপোর্ট</span>
                      </h4>
                      <span className="text-[10px] text-amber-600 font-bold">{activeMissingReports.length} টি অনিষ্পন্ন</span>
                    </div>
                    <div className="space-y-2">
                      {activeMissingReports.map((r, i) => (
                        <div key={r.id || i} className="bg-amber-50/80 border border-amber-200 p-2.5 rounded-xl space-y-1 text-amber-950">
                          <div className="flex items-center justify-between font-bold text-xs">
                            <span>রিপোর্ট আইডি: {r.id?.slice(-6)}</span>
                            <span className="text-[10px] text-amber-700">চালক: {r.driverName || r.driverId}</span>
                          </div>
                          {r.missingTools?.length > 0 && (
                            <p className="text-[11px] text-red-700"><strong>মিসিং টুলস:</strong> {r.missingTools.join(', ')}</p>
                          )}
                          {r.missingDocuments?.length > 0 && (
                            <p className="text-[11px] text-red-700"><strong>মিসিং ডকুমেন্ট:</strong> {r.missingDocuments.join(', ')}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 8. Audit Details */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-medium">অডিট ও এন্ট্রি তথ্য:</span>
                  <AuditDetailsDropdown createdBy={selectedVehicle.createdBy} updatedBy={selectedVehicle.updatedBy} />
                </div>

              </div>
            </Card>
          )}
        </div>
        <div>
          <Card title="নির্দেশনাবলী">
            <ul className="space-y-3.5 text-sm text-slate-600">
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">১</span>
                <span>নতুন ট্রিপ শুরু করার জন্য গাড়িটিকে অবশ্যই <strong>'Available'</strong> স্ট্যাটাসে থাকতে হবে।</span>
              </li>
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">২</span>
                <span>চালকের আইডি সার্চ করলে নাম ও ফোন নম্বর স্বয়ংক্রিয়ভাবে লোড হবে।</span>
              </li>
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">৩</span>
                <span>ট্রিপ এন্ট্রি করার পর গেটে গাড়ি ছাড়ার সময় <strong>OUT QR কোড</strong> স্ক্যান করে ট্রিপ চালু করা হবে।</span>
              </li>
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">৪</span>
                <span>ম্যানুয়াল তালিকায় কেবল <strong>আপনার ডিপোর গাড়ি</strong> প্রদর্শিত হবে। অন্য ডিপোর গাড়ি এন্ট্রি করতে চাইলে সতর্কতা নিশ্চিত করতে হবে।</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>

      {/* Other Warehouse Confirmation Warning Modal */}
      {showOtherWarehouseConfirmModal && selectedVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border-2 border-amber-300 animate-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-amber-100 text-amber-700 border border-amber-300 shrink-0">
                <AlertTriangle size={28} className="stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">অন্য ডিপোর গাড়ি এন্ট্রি সতর্কতা!</h3>
                <p className="text-xs text-slate-500 mt-0.5">গাড়ির নিবন্ধিত ডিপো ও আপনার ডিপো ভিন্ন</p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50/90 rounded-xl border border-amber-200 space-y-2 text-xs text-amber-950">
              <div className="flex justify-between items-center py-1 border-b border-amber-200/60">
                <span className="text-slate-600 font-medium">গাড়ি নম্বর:</span>
                <span className="font-mono font-bold text-slate-900">{selectedVehicle.vehicleNumber}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-amber-200/60">
                <span className="text-slate-600 font-medium">গাড়ির নির্ধারিত ডিপো:</span>
                <span className="font-bold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded">
                  {selectedVehicleWarehouse}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-600 font-medium">আপনার বর্তমান ডিপো:</span>
                <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {effectiveUserWarehouse}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              আপনি আপনার ডিপো (<span className="font-bold text-slate-800">{effectiveUserWarehouse}</span>)-র বাইরে অন্য ডিপো (<span className="font-bold text-slate-800">{selectedVehicleWarehouse}</span>)-র গাড়ির জন্য ট্রিপ তৈরি করতে যাচ্ছেন। আপনি কি নিশ্চিতভাবে এই ট্রিপ এন্ট্রি করতে চান?
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                className="flex-1 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                onClick={handleConfirmOtherWarehouseTrip}
              >
                <Check size={16} />
                <span>হ্যাঁ, অন্য ডিপোর গাড়ি নিশ্চিত করুন</span>
              </button>
              <button
                type="button"
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 font-bold text-xs transition-all border border-slate-200 cursor-pointer"
                onClick={handleCancelOtherWarehouseTrip}
              >
                বাতিল ও গাড়ি পরিবর্তন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewTrip;
