import React, { useState, useEffect, useRef } from 'react';
import { 
  QrCode, Camera, Truck, User as UserIcon, Users, 
  CheckCircle, XCircle, AlertTriangle, ClipboardCheck, 
  Calendar, MapPin, RotateCcw, FileText, CheckCircle2, Wrench, Search
} from 'lucide-react';
import { Card, Button } from './components/Common';
import { 
  subscribeToCollection, 
  findStaffById, 
  createTrip, 
  completeTrip, 
  createMissingReport,
  updateVehicleStatus,
  startPendingTrip
} from './db';
import { DOCUMENT_TYPES, cn } from './lib/utils';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from './AuthContext';

const QRScanner: React.FC = () => {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  
  // Scanner state
  const [scanResult, setScanResult] = useState<{ type: 'IN' | 'OUT'; vehicleId: string } | null>(null);
  const [instantUpdateStatus, setInstantUpdateStatus] = useState<'idle' | 'success_available' | 'success_maintenance' | 'error'>('idle');

  const handleInstantStatusUpdate = async (vehicleId: string, status: 'Available' | 'Maintenance', notes?: string) => {
    try {
      await updateVehicleStatus(vehicleId, status, notes, profile);
      setInstantUpdateStatus(status === 'Available' ? 'success_available' : 'success_maintenance');
      setTimeout(() => {
        setInstantUpdateStatus('idle');
        setScanResult(null);
      }, 2500);
    } catch (err) {
      console.error("Instant update error:", err);
      setInstantUpdateStatus('error');
    }
  };
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  
  // Selection/Simulation fallback
  const [selectedSimVehicleId, setSelectedSimVehicleId] = useState('');
  const [selectedSimAction, setSelectedSimAction] = useState<'IN' | 'OUT'>('OUT');

  // Dispatch Form State (for IN Scan when Available)
  const [dispatchForm, setDispatchForm] = useState({
    driverId: '',
    driverName: '',
    driverPhone: '',
    helperId: '',
    helperName: '',
    helperPhone: '',
    location: '',
    tollAmount: 0,
    documentsGiven: [] as string[],
    toolsGiven: [] as string[]
  });
  const [isSearchingDriver, setIsSearchingDriver] = useState(false);
  const [isSearchingHelper, setIsSearchingHelper] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Return Form State (for OUT Scan when On Trip)
  const [returnForm, setReturnForm] = useState({
    missingDocuments: [] as string[],
    missingTools: [] as string[],
    notes: ''
  });
  const [returnStatus, setReturnStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [quickMaintenanceNotes, setQuickMaintenanceNotes] = useState('');

  const [userStoppedScanner, setUserStoppedScanner] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);

  // Constants
  const TOOL_LIST = ['Jack', 'Spare Wheel', 'Fire Extinguisher', 'First Aid Kit', 'Triangle', 'Tool Box'];

  useEffect(() => {
    const unsubVehicles = subscribeToCollection('vehicles', setVehicles);
    const unsubTrips = subscribeToCollection('trips', setTrips);
    const unsubCases = subscribeToCollection('cases', setCases);

    return () => {
      unsubVehicles();
      unsubTrips();
      unsubCases();
      if (scannerRef.current) {
        try {
          scannerRef.current.stop()
            .then(() => {
              const container = document.getElementById("qr-reader-container");
              if (container) container.innerHTML = "";
            })
            .catch(err => console.error("Error stopping scanner on unmount:", err));
        } catch (e) {
          console.error("Scanner stop error on unmount:", e);
        }
      }
    };
  }, []);

  // Auto-start camera when no result is scanned and scanner isn't explicitly stopped by user
  useEffect(() => {
    if (!scanResult && !scannerActive && !userStoppedScanner) {
      startCameraScanner();
    }
  }, [scanResult, scannerActive, userStoppedScanner]);

  // Initialize html5-qrcode scanner
  const startCameraScanner = () => {
    if (isStartingRef.current || scannerRef.current) {
      console.log("Scanner already starting or active, ignoring duplicate start request.");
      return;
    }
    isStartingRef.current = true;
    setUserStoppedScanner(false);
    setScannerError(null);
    setScannerActive(true);
    
    // Defer initialization to let the div mount in the DOM
    setTimeout(() => {
      const container = document.getElementById("qr-reader-container");
      if (container) {
        container.innerHTML = ""; // Clear any duplicate or corrupted leftover elements!
      }

      try {
        const scanner = new Html5Qrcode("qr-reader-container");
        
        scanner.start(
          { facingMode: "environment" },
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 }
          },
          (decodedText) => {
            handleDecodedText(decodedText);
            isStartingRef.current = false;
            scanner.stop()
              .then(() => {
                setScannerActive(false);
                scannerRef.current = null;
                if (container) container.innerHTML = "";
              })
              .catch(err => {
                console.error("Error stopping scanner on decode:", err);
                setScannerActive(false);
                scannerRef.current = null;
                if (container) container.innerHTML = "";
              });
          },
          (error) => {
            // Subtle debug log, not spamming UI
          }
        ).then(() => {
          scannerRef.current = scanner;
          isStartingRef.current = false;
        }).catch((err: any) => {
          console.warn("Scanner startup error inside start promise:", err);
          let errMsg = "ক্যামেরা চালু করা যায়নি। অনুগ্রহ করে ক্যামেরা ব্যবহারের অনুমতি দিন এবং নিশ্চিত করুন অন্য কোনো অ্যাপে ক্যামেরা চালু নেই।";
          const errStr = String(err);
          if (errStr.includes("NotFoundError") || errStr.includes("device not found") || (err && err.name === "NotFoundError")) {
            errMsg = "ক্যামেরা ডিভাইসটি খুঁজে পাওয়া যায়নি (NotFoundError)। আপনি যদি ডেভেলপমেন্ট বা স্যান্ডবক্স আইফ্রেম মুডে থাকেন, অনুগ্রহ করে নিচের স্মার্ট সিমুলেটর (Simulator Fallback) ব্যবহার করে টেস্ট করুন।";
          } else if (errStr.includes("NotAllowedError") || errStr.includes("permission") || (err && err.name === "NotAllowedError")) {
            errMsg = "ক্যামেরা ব্যবহারের অনুমতি দেওয়া হয়নি (Permission Denied)। অনুগ্রহ করে ব্রাউজার সেটিংসে ক্যামেরা অ্যাক্সেস দিন অথবা নিচের স্মার্ট সিমুলেটর ব্যবহার করুন।";
          }
          setScannerError(errMsg);
          setScannerActive(false);
          isStartingRef.current = false;
          if (container) container.innerHTML = "";
        });
        
      } catch (err: any) {
        console.warn("Scanner startup error:", err);
        let errMsg = "ক্যামেরা চালু করা যায়নি। অনুগ্রহ করে ক্যামেরা ব্যবহারের অনুমতি দিন এবং নিশ্চিত করুন অন্য কোনো অ্যাপে ক্যামেরা চালু নেই।";
        const errStr = String(err);
        if (errStr.includes("NotFoundError") || errStr.includes("device not found") || (err && err.name === "NotFoundError")) {
          errMsg = "ক্যামেরা ডিভাইসটি খুঁজে পাওয়া যায়নি (NotFoundError)। অনুগ্রহ করে নিচের স্মার্ট সিমুলেটর (Simulator Fallback) ব্যবহার করে সহজেই টেস্ট করুন।";
        }
        setScannerError(errMsg);
        setScannerActive(false);
        isStartingRef.current = false;
        if (container) container.innerHTML = "";
      }
    }, 150);
  };

  const stopCameraScanner = () => {
    setUserStoppedScanner(true);
    isStartingRef.current = false;
    if (scannerRef.current) {
      const currentScanner = scannerRef.current;
      scannerRef.current = null;
      currentScanner.stop()
        .then(() => {
          setScannerActive(false);
          const container = document.getElementById("qr-reader-container");
          if (container) {
            container.innerHTML = "";
          }
        })
        .catch(err => {
          console.error("Error stopping scanner:", err);
          setScannerActive(false);
          const container = document.getElementById("qr-reader-container");
          if (container) {
            container.innerHTML = "";
          }
        });
    } else {
      setScannerActive(false);
      const container = document.getElementById("qr-reader-container");
      if (container) {
        container.innerHTML = "";
      }
    }
  };

  // Decode the scanned text
  // Expected formats:
  // - fleetflow://vehicle/IN/{vehicleId}
  // - fleetflow://vehicle/OUT/{vehicleId}
  // - Or plain text representation containing "IN" or "OUT" and vehicleId
  const handleDecodedText = (text: string) => {
    let type: 'IN' | 'OUT' = 'IN';
    let vehicleId = '';

    if (text.startsWith('fleetflow://vehicle/')) {
      const parts = text.replace('fleetflow://vehicle/', '').split('/');
      if (parts.length >= 2) {
        type = parts[0].toUpperCase() as 'IN' | 'OUT';
        vehicleId = parts[1];
      }
    } else {
      // Direct text scan or generic QR codes
      // Try to parse JSON or fallback
      try {
        const parsed = JSON.parse(text);
        if (parsed.type && parsed.vehicleId) {
          type = parsed.type.toUpperCase() as 'IN' | 'OUT';
          vehicleId = parsed.vehicleId;
        }
      } catch {
        // Fallback: search for IN or OUT in string
        if (text.toUpperCase().includes('OUT')) {
          type = 'OUT';
        }
        // Match standard alphanumeric/hyphen string for ID
        const match = text.match(/[A-Z0-9]{3,24}/i);
        if (match) {
          vehicleId = match[0];
        }
      }
    }

    if (!vehicleId) {
      alert("Invalid QR format scanned! Please try again or use the simulator.");
      return;
    }

    // Check if vehicle exists
    const matchingVehicle = vehicles.find(v => v.id === vehicleId || v.vehicleNumber.toUpperCase() === vehicleId.toUpperCase());
    if (!matchingVehicle) {
      alert(`Vehicle with ID "${vehicleId}" not found in database!`);
      return;
    }

    // Set scan result
    triggerScanResult(type, matchingVehicle.id);
  };

  const triggerScanResult = (type: 'IN' | 'OUT', vehicleDbId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleDbId);
    if (!vehicle) return;

    setScanResult({ type, vehicleId: vehicleDbId });
    setDispatchStatus('idle');
    setReturnStatus('idle');

    // Pre-populate forms based on action
    if (type === 'OUT') {
      // Default dispatch form values
      setDispatchForm({
        driverId: 'DRV-',
        driverName: '',
        driverPhone: '',
        helperId: 'HLP-',
        helperName: '',
        helperPhone: '',
        location: '',
        tollAmount: 0,
        documentsGiven: ['RP', 'FC', 'TT', 'RC'], // default to all documents
        toolsGiven: [...TOOL_LIST] // default to all tools
      });
    } else {
      // Default return form: find the running trip
      const activeTrip = trips.find(t => t.vehicleId === vehicleDbId && t.status === 'Running');
      setReturnForm({
        missingDocuments: [],
        missingTools: [],
        notes: ''
      });
    }
  };

  // Driver search by ID
  const handleDriverSearch = async (val: string) => {
    const id = val.trim().toUpperCase();
    setDispatchForm(prev => ({ ...prev, driverId: id, driverName: '', driverPhone: '' }));
    if (id.length >= 3) {
      setIsSearchingDriver(true);
      try {
        const staff: any = await findStaffById(id);
        if (staff) {
          setDispatchForm(prev => ({ 
            ...prev, 
            driverName: staff.name, 
            driverPhone: staff.phoneNumber || '' 
          }));
        }
      } catch (err) {
        console.error("Driver search error:", err);
      } finally {
        setIsSearchingDriver(false);
      }
    }
  };

  // Helper search by ID
  const handleHelperSearch = async (val: string) => {
    const id = val.trim().toUpperCase();
    setDispatchForm(prev => ({ ...prev, helperId: id, helperName: '', helperPhone: '' }));
    if (id.length >= 3) {
      setIsSearchingHelper(true);
      try {
        const staff: any = await findStaffById(id);
        if (staff) {
          setDispatchForm(prev => ({ 
            ...prev, 
            helperName: staff.name, 
            helperPhone: staff.phoneNumber || '' 
          }));
        }
      } catch (err) {
        console.error("Helper search error:", err);
      } finally {
        setIsSearchingHelper(false);
      }
    }
  };

  // Toggle given document
  const handleToggleDoc = (docCode: string) => {
    setDispatchForm(prev => ({
      ...prev,
      documentsGiven: prev.documentsGiven.includes(docCode)
        ? prev.documentsGiven.filter(d => d !== docCode)
        : [...prev.documentsGiven, docCode]
    }));
  };

  // Toggle given tool
  const handleToggleTool = (tool: string) => {
    setDispatchForm(prev => ({
      ...prev,
      toolsGiven: prev.toolsGiven.includes(tool)
        ? prev.toolsGiven.filter(t => t !== tool)
        : [...prev.toolsGiven, tool]
    }));
  };

  // Save Trip (OUT QR action to start a pending trip)
  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanResult) return;
    const vehicle = vehicles.find(v => v.id === scanResult.vehicleId);
    if (!vehicle) return;

    const pendingTrip = trips.find(t => t.vehicleId === vehicle.id && t.status === 'Pending');
    if (!pendingTrip) {
      alert("No pending trip found for this vehicle!");
      return;
    }

    try {
      const updates = {
        documentsGiven: dispatchForm.documentsGiven,
        toolsGiven: dispatchForm.toolsGiven,
      };

      await startPendingTrip(pendingTrip.id, vehicle.id, updates, profile);
      setDispatchStatus('success');
      setTimeout(() => setScanResult(null), 2500);
    } catch (err) {
      console.error("Dispatch Error:", err);
      setDispatchStatus('error');
    }
  };

  // Toggle missing return doc
  const handleToggleReturnDoc = (docCode: string) => {
    setReturnForm(prev => ({
      ...prev,
      missingDocuments: prev.missingDocuments.includes(docCode)
        ? prev.missingDocuments.filter(d => d !== docCode)
        : [...prev.missingDocuments, docCode]
    }));
  };

  // Toggle missing return tool
  const handleToggleReturnTool = (tool: string) => {
    setReturnForm(prev => ({
      ...prev,
      missingTools: prev.missingTools.includes(tool)
        ? prev.missingTools.filter(t => t !== tool)
        : [...prev.missingTools, tool]
    }));
  };

  // Complete Trip (OUT QR action)
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanResult) return;
    const vehicle = vehicles.find(v => v.id === scanResult.vehicleId);
    const activeTrip = trips.find(t => t.vehicleId === scanResult.vehicleId && t.status === 'Running');
    if (!vehicle || !activeTrip) return;

    try {
      // 1. Mark trip as completed
      await completeTrip(activeTrip.id, vehicle.id, returnForm, profile);

      // 2. If items are missing, generate missing report automatically
      if (returnForm.missingDocuments.length > 0 || returnForm.missingTools.length > 0) {
        await createMissingReport({
          tripId: activeTrip.id,
          vehiclePlate: vehicle.vehicleNumber,
          driverId: activeTrip.driverId,
          driverName: activeTrip.driverName,
          driverPhone: activeTrip.driverPhone || '',
          missingDocuments: returnForm.missingDocuments,
          missingTools: returnForm.missingTools,
          notes: returnForm.notes,
          status: 'Pending',
          date: new Date()
        }, profile);
      }

      setReturnStatus('success');
      setTimeout(() => setScanResult(null), 2500);
    } catch (err) {
      console.error("Return error:", err);
      setReturnStatus('error');
    }
  };

  // Render scan details
  const renderScanResultDetails = () => {
    if (!scanResult) return null;

    const vehicle = vehicles.find(v => v.id === scanResult.vehicleId);
    if (!vehicle) return <p className="text-red-500">Vehicle not found!</p>;

    const activeTrip = trips.find(t => t.vehicleId === vehicle.id && t.status === 'Running');

    const vehicleSummaryHeader = (
      <Card title={`স্ক্যানকৃত গাড়ির তথ্য: ${vehicle.vehicleNumber}`}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5">প্লেট নাম্বার:</span>
            <span className="font-bold text-slate-800 text-sm">{vehicle.vehicleNumber}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">গাড়ির ধরন:</span>
            <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] uppercase">
              {vehicle.type || 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">বর্তমান স্ট্যাটাস:</span>
            <span className={cn(
              "font-bold text-[11px] px-2.5 py-1 rounded-full inline-flex items-center gap-1",
              vehicle.status === 'Available' && "bg-emerald-100 text-emerald-800",
              vehicle.status === 'On Trip' && "bg-blue-100 text-blue-800",
              vehicle.status === 'Maintenance' && "bg-amber-100 text-amber-800"
            )}>
              {vehicle.status === 'Available' ? 'Available (স্টকে প্রস্তুত)' : 
               vehicle.status === 'On Trip' ? 'On Trip (চলমান ট্রিপ)' : 
               vehicle.status === 'Maintenance' ? 'Maintenance (মেরামতধীন)' : vehicle.status}
            </span>
          </div>
        </div>
        {vehicle.maintenanceNotes && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs">
            <span className="font-bold text-amber-800 block mb-1">🔧 গাড়ির বর্তমান সমস্যা / মেইনটেনেন্স নোট:</span>
            <p className="text-amber-700 whitespace-pre-wrap break-words italic font-medium">{vehicle.maintenanceNotes}</p>
          </div>
        )}
      </Card>
    );

    const quickActionsCard = (
      <Card title="তাৎক্ষণিক স্ট্যাটাস পরিবর্তন (Quick Status Actions)">
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            এই গাড়ির রানিং স্ট্যাটাস সরাসরি আপডেট করতে বাটন চাপুন (কোনো ফর্ম ফিলাপ ছাড়াই অটোমেটিক স্ট্যাটাস আপডেট হবে):
          </p>
          
          {instantUpdateStatus === 'success_available' && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-semibold animate-pulse flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>✓ সফলভাবে গ্যারেজে 'Available' করা হয়েছে!</span>
            </div>
          )}

          {instantUpdateStatus === 'success_maintenance' && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs font-semibold animate-pulse flex items-center gap-2">
              <Wrench size={16} className="text-amber-600 animate-spin" />
              <span>🔧 সফলভাবে 'Maintenance' এ পাঠানো হয়েছে!</span>
            </div>
          )}

          {instantUpdateStatus === 'error' && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl text-xs font-semibold">
              ⚠️ স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে। দয়া করে পুনরায় চেষ্টা করুন।
            </div>
          )}

          {vehicle.status !== 'Maintenance' && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 block">গাড়ির সমস্যা/মেইনটেনেন্স নোট (ঐচ্ছিক - Maintenance Note):</label>
              <input 
                type="text"
                placeholder="আসলে গাড়ির কি কি সমস্যা রয়েছে লিখুন..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white outline-none focus:border-amber-400"
                value={quickMaintenanceNotes}
                onChange={e => setQuickMaintenanceNotes(e.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={vehicle.status === 'Available' || instantUpdateStatus !== 'idle'}
              onClick={() => handleInstantStatusUpdate(vehicle.id, 'Available')}
              className={cn(
                "px-3 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                vehicle.status === 'Available'
                  ? "bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed"
                  : "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 shadow-sm"
              )}
            >
              <CheckCircle2 size={14} className={vehicle.status === 'Available' ? "text-slate-300" : "text-emerald-600"} />
              <span>Available করুন</span>
            </button>

            <button
              type="button"
              disabled={vehicle.status === 'Maintenance' || instantUpdateStatus !== 'idle'}
              onClick={() => {
                handleInstantStatusUpdate(vehicle.id, 'Maintenance', quickMaintenanceNotes);
                setQuickMaintenanceNotes('');
              }}
              className={cn(
                "px-3 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                vehicle.status === 'Maintenance'
                  ? "bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed"
                  : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 shadow-sm"
              )}
            >
              <Wrench size={14} className={vehicle.status === 'Maintenance' ? "text-slate-300" : "text-amber-600"} />
              <span>Maintenance করুন</span>
            </button>
          </div>
        </div>
      </Card>
    );

    if (scanResult.type === 'OUT') {
      // OUT SCAN: Start Trip/Dispatch (requires vehicle to be Available)
      if (vehicle.status !== 'Available') {
        if (vehicle.status === 'Maintenance') {
          return (
            <div className="space-y-6">
              {vehicleSummaryHeader}
              {quickActionsCard}
              <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex items-start gap-4">
                <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
                  <Wrench size={24} />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-amber-800 text-sm">গাড়িটি বর্তমানে মেরামত/মেইনটেনেন্সে রয়েছে (Vehicle in Maintenance)</h4>
                  <p className="text-xs text-amber-600 mt-1">
                    গাড়িটি বর্তমানে মেরামত বা রক্ষণাবেক্ষণের জন্য মেইনটেনেন্স অবস্থায় রয়েছে। ট্রিপ শুরু করার পূর্বে গাড়িটিকে এভেলেবেল করুন।
                  </p>
                </div>
              </div>
              <div className="flex justify-center">
                <Button variant="secondary" onClick={() => setScanResult(null)} className="w-48">
                  <RotateCcw size={14} /> পুনরায় স্ক্যান করুন
                </Button>
              </div>
            </div>
          );
        }

        // Already on trip, show current trip details
        return (
          <div className="space-y-6">
            {vehicleSummaryHeader}
            {quickActionsCard}
            <div className="bg-orange-50 border border-orange-200 p-5 rounded-2xl flex items-start gap-4">
              <div className="p-3 bg-orange-100 text-orange-600 rounded-xl">
                <AlertTriangle size={24} />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-orange-800 text-sm">গাড়িটি বর্তমানে ট্রিপে রয়েছে (Vehicle On Trip)</h4>
                <p className="text-xs text-orange-600 mt-1">
                  গাড়িটি বর্তমানে ট্রিপে নিযুক্ত আছে। পুনরায় ট্রিপ শুরু করার পূর্বে গাড়িটিকে গ্যারেজে ইন (Return Scan) করতে হবে।
                </p>
              </div>
            </div>

            {activeTrip ? (
              <Card title="চলমান ট্রিপের বিবরণ (Active Trip Details)">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                  <div className="space-y-3">
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-slate-500 font-medium">গাড়ির নাম্বার:</span>
                      <span className="font-bold text-slate-800">{vehicle.vehicleNumber}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-slate-500 font-medium">ড্রাইভার আইডি:</span>
                      <span className="font-bold text-slate-800">{activeTrip.driverId}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-slate-500 font-medium">ড্রাইভারের নাম:</span>
                      <span className="font-bold text-slate-800">{activeTrip.driverName}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-slate-500 font-medium">ফোন নাম্বার:</span>
                      <span className="font-bold text-slate-800">{activeTrip.driverPhone || 'N/A'}</span>
                    </div>
                    {activeTrip.helperId && (
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-slate-500 font-medium">হেলপার:</span>
                        <span className="font-bold text-slate-800">{activeTrip.helperName} ({activeTrip.helperId})</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-slate-500 font-medium">গন্তব্যস্থান:</span>
                      <span className="font-bold text-slate-800 flex items-center gap-1"><MapPin size={12} className="text-red-500" /> {activeTrip.location}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-slate-500 font-medium">ছাড়ার সময়:</span>
                      <span className="font-bold text-slate-800">
                        {activeTrip.startTime?.seconds 
                          ? new Date(activeTrip.startTime.seconds * 1000).toLocaleString('bn-BD')
                          : new Date().toLocaleString('bn-BD')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium block mb-1">প্রদত্ত ডকুমেন্টস:</span>
                      <div className="flex flex-wrap gap-1">
                        {activeTrip.documentsGiven?.map((d: string) => (
                          <span key={d} className="px-2 py-0.5 bg-blue-50 border border-blue-100 rounded text-blue-700 font-bold text-[10px] uppercase">{d}</span>
                        )) || <span className="text-slate-400 italic">কোন ডকুমেন্ট দেওয়া হয়নি</span>}
                      </div>
                    </div>
                    <div className="pt-2">
                      <span className="text-slate-500 font-medium block mb-1">গাড়ির টুলস:</span>
                      <div className="flex flex-wrap gap-1">
                        {activeTrip.toolsGiven?.map((t: string) => (
                          <span key={t} className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded text-emerald-700 font-bold text-[10px] uppercase">{t}</span>
                        )) || <span className="text-slate-400 italic">কোন টুলস দেওয়া হয়নি</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ) : (
              <p className="text-slate-400 text-center py-6">ত্রুটি: গাড়ির স্ট্যাটাস 'On Trip' হলেও কোনো সক্রিয় ট্রিপ পাওয়া যায়নি।</p>
            )}

            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => setScanResult(null)} className="w-48">
                <RotateCcw size={14} /> পুনরায় স্ক্যান করুন
              </Button>
            </div>
          </div>
        );
      }

      // AVAILABLE -> Show Dispatch / Trip Release Form
      const pendingTrip = trips.find(t => t.vehicleId === vehicle.id && t.status === 'Pending');

      return (
        <div className="space-y-6">
          {vehicleSummaryHeader}
          {quickActionsCard}
          
          {!pendingTrip ? (
            <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
              <div className="p-3 bg-amber-100 text-amber-600 rounded-full">
                <AlertTriangle size={24} />
              </div>
              <h4 className="font-bold text-amber-800 text-sm">কোনো পেন্ডিং ট্রিপ খুঁজে পাওয়া যায়নি (No Pending Trip)</h4>
              <p className="text-xs text-slate-500 max-w-md">
                এই গাড়িটি বর্তমানে স্টকে Available রয়েছে, কিন্তু ম্যানেজার প্যানেল থেকে কোনো পেন্ডিং ট্রিপ এন্ট্রি করা হয়নি। দয়া করে প্রথমে <strong>Trips (ট্রিপস)</strong> স্ক্রিন থেকে গাড়িটির জন্য ড্রাইভার, হেলপার ও গন্তব্য সেট করে একটি নতুন ট্রিপ এন্ট্রি করুন।
              </p>
              <Button variant="secondary" onClick={() => setScanResult(null)} className="w-48 text-xs">
                পুনরায় স্ক্যান করুন
              </Button>
            </div>
          ) : (
            <Card title={`গাড়ি রিলিজ ও ছাড়পত্র: ${vehicle.vehicleNumber}`}>
              {dispatchStatus === 'success' ? (
                <div className="text-center py-8 space-y-3">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md">
                    <CheckCircle size={36} />
                  </div>
                  <h3 className="text-lg font-bold text-emerald-800">গাড়িটি সফলভাবে স্টক থেকে ছাড় দেওয়া হয়েছে!</h3>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto">
                    গাড়ির ট্রিপটি শুরু হয়েছে এবং স্ট্যাটাস সফলভাবে 'On Trip' এ আপডেট করা হয়েছে।
                  </p>
                </div>
              ) : dispatchStatus === 'error' ? (
                <div className="text-center py-8 space-y-3">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                    <XCircle size={36} />
                  </div>
                  <h3 className="text-lg font-bold text-red-800">সাবমিট করতে ত্রুটি হয়েছে</h3>
                  <p className="text-sm text-slate-500">আবার চেষ্টা করুন বা ডেটাবেস কানেকশন চেক করুন।</p>
                  <Button onClick={() => setDispatchStatus('idle')}>আবার চেষ্টা করুন</Button>
                </div>
              ) : (
                <form onSubmit={handleDispatchSubmit} className="space-y-6">
                  {/* Alert */}
                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                    <span><strong>স্টক ছাড় ও কাগজ-টুলস যাচাই:</strong> গাড়ি ছাড়ার জন্য পেন্ডিং ট্রিপ পাওয়া গেছে। নিচে ডকুমেন্টস ও সরঞ্জামাদি চেক করে নিশ্চিত করুন।</span>
                  </div>

                  {/* Trip details */}
                  <div className="bg-slate-50 border p-4 rounded-xl space-y-3 text-xs">
                    <h5 className="font-bold text-slate-700 border-b pb-1.5 flex items-center gap-1.5">
                      <ClipboardCheck size={14} className="text-slate-500" />
                      এন্ট্রি করা ট্রিপের বিবরণ (Registered Trip Details)
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                      <div className="flex justify-between border-b pb-1">
                        <span className="text-slate-500">👨‍✈️ ড্রাইভার:</span>
                        <span className="font-bold text-slate-800">{pendingTrip.driverName} ({pendingTrip.driverId})</span>
                      </div>
                      <div className="flex justify-between border-b pb-1">
                        <span className="text-slate-500">📞 ড্রাইভার ফোন:</span>
                        <span className="font-bold text-slate-800">{pendingTrip.driverPhone || 'নেই'}</span>
                      </div>
                      {pendingTrip.helperId && (
                        <>
                          <div className="flex justify-between border-b pb-1">
                            <span className="text-slate-500">🧑 হেলপার:</span>
                            <span className="font-bold text-slate-800">{pendingTrip.helperName} ({pendingTrip.helperId})</span>
                          </div>
                          <div className="flex justify-between border-b pb-1">
                            <span className="text-slate-500">📞 হেলপার ফোন:</span>
                            <span className="font-bold text-slate-800">{pendingTrip.helperPhone || 'নেই'}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between border-b pb-1">
                        <span className="text-slate-500">📍 গন্তব্যস্থান:</span>
                        <span className="font-bold text-slate-800">{pendingTrip.location}</span>
                      </div>
                      <div className="flex justify-between border-b pb-1">
                        <span className="text-slate-500">⏰ এন্ট্রি সময়:</span>
                        <span className="font-bold text-slate-800">
                          {pendingTrip.createdAt?.seconds 
                            ? new Date(pendingTrip.createdAt.seconds * 1000).toLocaleString('bn-BD')
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Documents Handed Over */}
                  <div className="space-y-2 border-t pt-4">
                    <label className="text-xs font-bold text-slate-700 block">
                      ১. কাগজপত্র চেক করুন (Verify & Issue Documents)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DOCUMENT_TYPES.map((docCode) => {
                        const isSelected = dispatchForm.documentsGiven.includes(docCode);
                        return (
                          <button
                            key={docCode}
                            type="button"
                            onClick={() => handleToggleDoc(docCode)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg border text-xs font-bold transition-all",
                              isSelected 
                                ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                            )}
                          >
                            {docCode} {isSelected ? '✓' : '+'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tools Handed Over */}
                  <div className="space-y-2 border-t pt-4">
                    <label className="text-xs font-bold text-slate-700 block">
                      ২. সরঞ্জাম ও টুলস চেক করুন (Verify & Issue Tools Checklist)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {TOOL_LIST.map((tool) => {
                        const isSelected = dispatchForm.toolsGiven.includes(tool);
                        return (
                          <button
                            key={tool}
                            type="button"
                            onClick={() => handleToggleTool(tool)}
                            className={cn(
                              "px-3 py-2 rounded-lg border text-left text-[11px] font-semibold transition-all flex items-center justify-between",
                              isSelected 
                                ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                                : "bg-slate-50 border-slate-200 text-slate-400 line-through"
                            )}
                          >
                            <span>🔧 {tool}</span>
                            <span className="text-[9px] font-bold uppercase">
                              {isSelected ? 'রয়েছে' : 'নেই'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Form Buttons */}
                  <div className="flex gap-3 pt-4 border-t">
                    <Button type="submit" className="flex-1 py-3 text-sm">
                      🚚 ট্রিপ শুরু ও গাড়ি রিলিজ করুন
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setScanResult(null)}>
                      বাতিল করুন
                    </Button>
                  </div>
                </form>
              )}
            </Card>
          )}
        </div>
      );
    } else {
      // IN SCAN: Return / Complete Trip (requires active running trip)
      if (!activeTrip) {
        // Vehicle is already available, show history of last completed trip
        const lastTrip = trips.filter(t => t.vehicleId === vehicle.id && t.status === 'Completed')[0];
        
        return (
          <div className="space-y-6">
            {vehicleSummaryHeader}
            {quickActionsCard}
            <div className="bg-slate-100 border border-slate-200 p-5 rounded-2xl flex items-start gap-4">
              <div className="p-3 bg-white text-slate-600 rounded-xl shadow-xs">
                <CheckCircle2 size={24} className="text-emerald-500" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-800 text-sm">গাড়িটি বর্তমানে এভেলেবেল আছে (Vehicle is in Garage)</h4>
                <p className="text-xs text-slate-500 mt-1">
                  গাড়িটি বর্তমানে গ্যারেজে স্টকে আছে। এটি ট্রিপে যাওয়ার জন্য সম্পূর্ণ প্রস্তুত।
                </p>
              </div>
            </div>

            {lastTrip && (
              <Card title="সর্বশেষ সম্পন্ন ট্রিপের ইতিহাস (Last Completed Trip History)">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2">
                    <p className="flex justify-between border-b pb-1">
                      <span className="text-slate-500">গাড়ি নাম্বার:</span>
                      <span className="font-bold">{vehicle.vehicleNumber}</span>
                    </p>
                    <p className="flex justify-between border-b pb-1">
                      <span className="text-slate-500">ড্রাইভার:</span>
                      <span className="font-bold">{lastTrip.driverName}</span>
                    </p>
                    <p className="flex justify-between border-b pb-1">
                      <span className="text-slate-500">গন্তব্য:</span>
                      <span className="font-bold">{lastTrip.location}</span>
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="flex justify-between border-b pb-1">
                      <span className="text-slate-500">রিটার্ন সময়:</span>
                      <span className="font-bold">
                        {lastTrip.endTime?.seconds 
                          ? new Date(lastTrip.endTime.seconds * 1000).toLocaleString('bn-BD')
                          : 'সদ্য সম্পন্ন'}
                      </span>
                    </p>
                    {lastTrip.inspectionOnReturn && (
                      <div>
                        <span className="text-slate-500 block">রিটার্ন নোট:</span>
                        <p className="font-medium text-slate-800 italic bg-slate-50 p-2 rounded border mt-1">
                          {lastTrip.inspectionOnReturn.notes || 'কোন সমস্যা পাওয়া যায়নি।'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => setScanResult(null)} className="w-48">
                <RotateCcw size={14} /> পুনরায় স্ক্যান করুন
              </Button>
            </div>
          </div>
        );
      }

      // ACTIVE RUNNING TRIP FOUND -> Show Return Inspection checklist
      // User says: "গাড়িটি আউট করার সময় যে সকল ডকুমেন্ট টুলস নিয়ে গেছে তা শো করবে"
      const documentsTaken = activeTrip.documentsGiven || [];
      const toolsTaken = activeTrip.toolsGiven || [];

      return (
        <div className="space-y-6">
          {vehicleSummaryHeader}
          {quickActionsCard}
          <Card title={`গাড়ি ফেরত (In-Garage Scan): ${vehicle.vehicleNumber}`}>
          {returnStatus === 'success' ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md">
                <CheckCircle size={36} />
              </div>
              <h3 className="text-lg font-bold text-emerald-800">গাড়িটি সফলভাবে রিসিভ করা হয়েছে!</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                গাড়িটি সফলভাবে গ্যারেজে স্টকে এন্ট্রি হয়ে গেছে এবং পুনরায় ব্যবহারের জন্য এভেলেবেল করা হয়েছে।
              </p>
            </div>
          ) : returnStatus === 'error' ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <XCircle size={36} />
              </div>
              <h3 className="text-lg font-bold text-red-800">রিটার্ন এন্ট্রি করতে ত্রুটি হয়েছে</h3>
              <p className="text-sm text-slate-500">আবার চেষ্টা করুন বা ডেটাবেস চেক করুন।</p>
              <Button onClick={() => setReturnStatus('idle')}>আবার চেষ্টা করুন</Button>
            </div>
          ) : (
            <form onSubmit={handleReturnSubmit} className="space-y-6">
              {/* Alert info about trip */}
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-xs text-blue-900 space-y-1">
                <p><strong>চলমান ট্রিপের সারাংশ (Active Trip Info):</strong></p>
                <div className="grid grid-cols-2 gap-3 mt-2 text-slate-700">
                  <p>• ড্রাইভার: <strong className="text-blue-900">{activeTrip.driverName} ({activeTrip.driverId})</strong></p>
                  <p>• হেলপার: <strong>{activeTrip.helperName || 'নেই'}</strong></p>
                  <p>• গন্তব্য: <strong>{activeTrip.location}</strong></p>
                  <p>• সময়কাল: <strong>
                    {activeTrip.startTime?.seconds 
                      ? new Date(activeTrip.startTime.seconds * 1000).toLocaleString('bn-BD')
                      : 'চলমান'}
                  </strong></p>
                </div>
              </div>

              {/* Documents Returned / Missing */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700 block">
                    কাগজপত্র জমা ও সত্যতা যাচাই (Documents Return Check)
                  </label>
                  <span className="text-[10px] text-slate-500">আউট করার সময় যে সকল ডকুমেন্ট নিয়ে গেছিল নিচে তা লাল বাটনে চাপ দিয়ে missing চিহ্নিত করুন</span>
                </div>

                {documentsTaken.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">গাড়িটি ট্রিপে যাওয়ার সময় কোনো কাগজপত্র দেওয়া হয়নি।</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {documentsTaken.map((docCode: string) => {
                      const isMissing = returnForm.missingDocuments.includes(docCode);
                      return (
                        <button
                          key={docCode}
                          type="button"
                          onClick={() => handleToggleReturnDoc(docCode)}
                          className={cn(
                            "px-3 py-2.5 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between",
                            isMissing 
                              ? "bg-red-50 border-red-200 text-red-600" 
                              : "bg-emerald-50 border-emerald-200 text-emerald-700"
                          )}
                        >
                          <span>📄 {docCode}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase bg-white border">
                            {isMissing ? 'Missing' : 'Received'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tools Checklist */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700 block">
                    গাড়ির সরঞ্জাম ও টুলস ফেরত যাচাই (Tools Return Verification)
                  </label>
                  <span className="text-[10px] text-slate-500">গাড়ি রিলিজের সময় নিয়ে যাওয়া টুলসগুলো চেক করে Missing থাকলে সিলেক্ট করুন</span>
                </div>

                {toolsTaken.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">গাড়িটি ট্রিপে যাওয়ার সময় কোনো সরঞ্জাম বা টুলস দেওয়া হয়নি।</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {toolsTaken.map((tool: string) => {
                      const isMissing = returnForm.missingTools.includes(tool);
                      return (
                        <button
                          key={tool}
                          type="button"
                          onClick={() => handleToggleReturnTool(tool)}
                          className={cn(
                            "px-3 py-2.5 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between",
                            isMissing 
                              ? "bg-red-50 border-red-200 text-red-600" 
                              : "bg-emerald-50 border-emerald-200 text-emerald-700"
                          )}
                        >
                          <span>🔧 {tool}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase bg-white border">
                            {isMissing ? 'Missing' : 'Received'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Show warning if any item is missing */}
                {(returnForm.missingDocuments.length > 0 || returnForm.missingTools.length > 0) && (
                  <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-xs text-red-800 flex items-start gap-2.5">
                    <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-bold">সতর্কতা: কিছু আইটেম অনুপস্থিত (Missing Items Found)</p>
                      <p className="text-[11px] text-red-600 mt-0.5">
                        রিটার্ন সাবমিট করার পর অনুপস্থিত আইটেমগুলোর জন্য একটি পেন্ডিং ড্যামেজ/মিসিং রিপোর্ট অটো তৈরি হবে।
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Inspection Notes */}
              <div className="space-y-1 border-t pt-4">
                <label className="text-xs font-bold text-slate-700 block">শারীরিক পরীক্ষা ও অতিরিক্ত মন্তব্য (Inspection & Return Notes)</label>
                <textarea 
                  placeholder="যেমন: গাড়ির কোনো নতুন স্ক্র্যাচ নেই, টায়ার প্রেসার ঠিক আছে..."
                  className="w-full px-3 py-2 text-xs rounded-xl border outline-none focus:border-blue-500 h-20 resize-none"
                  value={returnForm.notes}
                  onChange={e => setReturnForm({ ...returnForm, notes: e.target.value })}
                />
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <Button type="submit" className="flex-1 py-3 text-sm">
                  ✓ গাড়ি রিসিভ ও এভেলেবেল করুন
                </Button>
                <Button type="button" variant="secondary" onClick={() => setScanResult(null)}>
                  বাতিল করুন
                </Button>
              </div>
            </form>
          )}
        </Card>
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <QrCode className="text-accent" />
          <span>QR Code Smart Scanner (কিউআর কোড স্ক্যানার)</span>
        </h2>
        <p className="text-sm text-slate-500">
          মোবাইল বা ল্যাপটপের ক্যামেরা ব্যবহার করে গাড়ির IN বা OUT কিউআর কোড স্ক্যান করুন।
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 1 Column: Scanner Area */}
        <div className="lg:col-span-1 space-y-6">
          <Card title="ক্যামেরা স্ক্যানার (Live Camera Stream)">
            <div className="space-y-4">
              {!scannerActive ? (
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto text-blue-600">
                    <Camera size={32} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">ক্যামেরা চালু করুন</p>
                    <p className="text-[10px] text-slate-500 mt-1">গাড়ির কিউআর কোড সরাসরি স্ক্যান করার জন্য ক্যামেরা অ্যাক্সেস চালু করুন।</p>
                  </div>
                  <Button onClick={startCameraScanner} className="w-full">
                    <Camera size={14} /> স্ক্যান শুরু করুন
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div id="qr-reader-container" className="overflow-hidden rounded-2xl border border-slate-200 bg-black min-h-[300px]"></div>
                  <Button variant="secondary" onClick={stopCameraScanner} className="w-full">
                    স্ক্যানার বন্ধ করুন
                  </Button>
                </div>
              )}

              {scannerError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[10px] text-red-600">
                  ⚠️ {scannerError}
                </div>
              )}
            </div>
          </Card>

          {/* Quick Simulation Fallback - PERFECT for user trust & testing inside iframe! */}
          <Card title="স্মার্ট সিমুলেটর (Simulator Fallback)">
            <div className="space-y-4 text-xs">
              <p className="text-[10px] text-slate-500">
                ইফ্রেমে ক্যামেরা পারমিশন না পেলে বা প্রিন্ট করার আগে দ্রুত স্ক্যান টেস্ট করতে নিচের অপশন ব্যবহার করুন।
              </p>
              
              <div className="space-y-2">
                <label className="font-bold text-slate-700 block">১. গাড়ি সিলেক্ট করুন (Select Fleet)</label>
                <select 
                  className="w-full px-3 py-2 text-xs rounded-xl border outline-none bg-white font-semibold"
                  value={selectedSimVehicleId}
                  onChange={e => setSelectedSimVehicleId(e.target.value)}
                >
                  <option value="">-- গাড়ি সিলেক্ট করুন --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.vehicleNumber} ({v.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-slate-700 block">২. কোন কোড স্ক্যান করছেন? (Select Code)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSimAction('OUT')}
                    className={cn(
                      "py-2 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all",
                      selectedSimAction === 'OUT' 
                        ? "bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-100" 
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    OUT QR (ছাড়পত্র)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSimAction('IN')}
                    className={cn(
                      "py-2 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all",
                      selectedSimAction === 'IN' 
                        ? "bg-blue-50 border-blue-300 text-blue-800 ring-2 ring-blue-100" 
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    IN QR (ফেরত এন্ট্রি)
                  </button>
                </div>
              </div>

              <Button 
                onClick={() => {
                  if (!selectedSimVehicleId) {
                    alert("দয়া করে একটি গাড়ি সিলেক্ট করুন।");
                    return;
                  }
                  triggerScanResult(selectedSimAction, selectedSimVehicleId);
                }} 
                className="w-full py-2.5 bg-slate-900 text-white hover:bg-slate-800 text-xs"
              >
                ⚡ তাৎক্ষণিক স্ক্যান সিমুলেশন করুন
              </Button>
            </div>
          </Card>
        </div>

        {/* Right 2 Columns: Output Form/Result Area */}
        <div className="lg:col-span-2 space-y-6">
          {scanResult ? (
            renderScanResultDetails()
          ) : (
            <div className="h-full min-h-[350px] border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-8 bg-white text-center text-slate-400">
              <QrCode size={48} className="text-slate-300 animate-pulse mb-4" />
              <h4 className="font-bold text-slate-700 text-sm">কোনো কিউআর স্ক্যান বা এন্ট্রি করা হয়নি</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                বাম পাশের ক্যামেরা দিয়ে সরাসরি কিউআর কোড স্ক্যান করুন অথবা সিমুলেটর থেকে দ্রুত টেস্ট এন্ট্রি করুন।
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
