import React, { useState, useEffect, useRef } from 'react';
import { 
  QrCode, Camera, Truck, User as UserIcon, Users, 
  CheckCircle, XCircle, AlertTriangle, ClipboardCheck, 
  Calendar, MapPin, RotateCcw, FileText, CheckCircle2, Wrench, Search,
  ChevronDown, ChevronUp, ShieldAlert, Scale, Info
} from 'lucide-react';
import { 
  Card, Button, StaffProfileButton, VehicleProfileButton,
  STANDARD_VEHICLE_TOOLS, STANDARD_VEHICLE_DOCS,
  getDefaultVehicleTools, getDefaultVehicleDocs,
  AuditDetailsDropdown
} from './components/Common';
import { 
  subscribeToCollection, 
  findStaffById, 
  createTrip, 
  completeTrip, 
  createMissingReport,
  updateVehicleStatus,
  updateVehicle,
  startPendingTrip
} from './db';
import { DOCUMENT_TYPES, cn } from './lib/utils';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from './AuthContext';

const QRScanner: React.FC = () => {
  const { profile, isAdmin, isSubAdmin, isLineSupervisor } = useAuth();
  const canManage = isAdmin || isSubAdmin || isLineSupervisor;
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [missingReports, setMissingReports] = useState<any[]>([]);

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
  
  // Selection/Simulation fallback & Manual Vehicle Search
  const [selectedSimVehicleId, setSelectedSimVehicleId] = useState('');
  const [selectedSimAction, setSelectedSimAction] = useState<'IN' | 'OUT'>('OUT');
  const [manualVehicleSearch, setManualVehicleSearch] = useState('');
  const [activeScanMode, setActiveScanMode] = useState<'camera' | 'manual'>('manual');

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
  const [isSeizedWarningExpanded, setIsSeizedWarningExpanded] = useState(false);
  const [isQuickActionsExpanded, setIsQuickActionsExpanded] = useState(false);
  const [isLiveInfoExpanded, setIsLiveInfoExpanded] = useState(false);

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

  const [isUpdatingTool, setIsUpdatingTool] = useState(false);
  const [isUpdatingDoc, setIsUpdatingDoc] = useState(false);

  const handleToggleScannedTool = async (vehicleId: string, toolKey: string, currentVal: boolean) => {
    if (!canManage || isUpdatingTool) return;
    const targetVehicle = vehicles.find(v => v.id === vehicleId);
    if (!targetVehicle) return;
    setIsUpdatingTool(true);
    const currentTools = getDefaultVehicleTools(targetVehicle.tools);
    const updatedTools = {
      ...currentTools,
      [toolKey]: !currentVal
    };
    try {
      await updateVehicle(vehicleId, { tools: updatedTools }, profile);
    } catch (err) {
      console.error("Failed to update tool status:", err);
    } finally {
      setIsUpdatingTool(false);
    }
  };

  const handleToggleScannedDoc = async (vehicleId: string, docKey: string, currentVal: boolean) => {
    if (!canManage || isUpdatingDoc) return;
    const targetVehicle = vehicles.find(v => v.id === vehicleId);
    if (!targetVehicle) return;
    setIsUpdatingDoc(true);
    const currentDocs = getDefaultVehicleDocs(targetVehicle.documents);
    const updatedDocs = {
      ...currentDocs,
      [docKey]: !currentVal
    };
    try {
      await updateVehicle(vehicleId, { documents: updatedDocs }, profile);
    } catch (err) {
      console.error("Failed to update document status:", err);
    } finally {
      setIsUpdatingDoc(false);
    }
  };

  useEffect(() => {
    const unsubVehicles = subscribeToCollection('vehicles', setVehicles);
    const unsubTrips = subscribeToCollection('trips', setTrips);
    const unsubCases = subscribeToCollection('cases', setCases);
    const unsubMissing = subscribeToCollection('missing_reports', setMissingReports);

    return () => {
      unsubVehicles();
      unsubTrips();
      unsubCases();
      unsubMissing();
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
    const matchingVehicle = computedVehicles.find(v => v.id === vehicleId || v.vehicleNumber.toUpperCase() === vehicleId.toUpperCase());
    if (!matchingVehicle) {
      alert(`Vehicle with ID "${vehicleId}" not found in database!`);
      return;
    }

    // Set scan result
    triggerScanResult(type, matchingVehicle.id);
  };

  const triggerScanResult = (type: 'IN' | 'OUT', vehicleDbId: string) => {
    const vehicle = computedVehicles.find(v => v.id === vehicleDbId);
    if (!vehicle) return;

    setScanResult({ type, vehicleId: vehicleDbId });
    setDispatchStatus('idle');
    setReturnStatus('idle');

    // Pre-populate forms based on action
    if (type === 'OUT') {
      // Find active cases for this vehicle
      const activeVehicleCases = cases.filter(c => 
        c.vehicleId === vehicle.vehicleNumber && 
        (c.status || 'Open') === 'Open'
      );
      // Collect all seized documents across those active cases
      const seizedDocs = activeVehicleCases.reduce((acc, c) => {
        if (c.seizedDocuments && Array.isArray(c.seizedDocuments)) {
          c.seizedDocuments.forEach((doc: string) => {
            if (!acc.includes(doc)) {
              acc.push(doc);
            }
          });
        }
        return acc;
      }, [] as string[]);

      // Default documents are standard ones EXCEPT any that are currently seized/confiscated
      const defaultDocs = DOCUMENT_TYPES.filter(doc => !seizedDocs.includes(doc));

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
        documentsGiven: defaultDocs, // default to non-seized documents
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
    const vehicle = computedVehicles.find(v => v.id === scanResult.vehicleId);
    if (!vehicle) return;

    const pendingTrip = trips.find(t => t.vehicleId === vehicle.id && t.status === 'Pending');
    if (!pendingTrip) {
      alert("No pending trip found for this vehicle!");
      return;
    }

    try {
      const vToolsState = getDefaultVehicleTools(vehicle.tools);
      const vDocsState = getDefaultVehicleDocs(vehicle.documents);

      const activeVehicleCases = cases.filter(c => 
        (c.vehicleId === vehicle.vehicleNumber || c.vehicleId === vehicle.id) && 
        (c.status || 'Open') === 'Open'
      );
      const sDocs = activeVehicleCases.reduce((acc, c) => {
        if (c.seizedDocuments && Array.isArray(c.seizedDocuments)) {
          c.seizedDocuments.forEach((doc: string) => {
            if (!acc.includes(doc)) acc.push(doc);
          });
        }
        return acc;
      }, [] as string[]);

      const vMissingReports = missingReports.filter(r => (r.vehicleId === vehicle.id || r.vehicleId === vehicle.vehicleNumber) && r.status === 'Pending');
      const mTools = vMissingReports.flatMap(r => r.missingTools || []);

      // Documents given from profile (excluding seized ones)
      const profileDocsGiven = STANDARD_VEHICLE_DOCS
        .filter(d => !!vDocsState[d.code as keyof typeof vDocsState] && !sDocs.includes(d.code))
        .map(d => d.code);

      // Tools given from profile (excluding missing ones)
      const profileToolsGiven = STANDARD_VEHICLE_TOOLS
        .filter(t => !!vToolsState[t.key as keyof typeof vToolsState] && !mTools.includes(t.key))
        .map(t => t.label);

      const updates = {
        documentsGiven: profileDocsGiven.length > 0 ? profileDocsGiven : (pendingTrip.documentsGiven || []),
        toolsGiven: profileToolsGiven.length > 0 ? profileToolsGiven : (pendingTrip.toolsGiven || []),
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
    const vehicle = computedVehicles.find(v => v.id === scanResult.vehicleId);
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

    const vehicle = computedVehicles.find(v => v.id === scanResult.vehicleId);
    if (!vehicle) return <p className="text-red-500">Vehicle not found!</p>;

    const activeTrip = trips.find(t => t.vehicleId === vehicle.id && t.status === 'Running');

    // Vehicle Tools & Docs state
    const vehicleToolsState = getDefaultVehicleTools(vehicle.tools);
    const vehicleDocsState = getDefaultVehicleDocs(vehicle.documents);

    // Find cases for this vehicle
    const totalVehicleCases = cases.filter(c => c.vehicleId === vehicle.vehicleNumber || c.vehicleId === vehicle.id);
    const activeVehicleCases = totalVehicleCases.filter(c => (c.status || 'Open') === 'Open');
    const totalFineAmount = activeVehicleCases.reduce((sum, c) => sum + (Number(c.fineAmount) || 0), 0);

    // Collect all seized documents across those active cases
    const seizedDocs = activeVehicleCases.reduce((acc, c) => {
      if (c.seizedDocuments && Array.isArray(c.seizedDocuments)) {
        c.seizedDocuments.forEach((doc: string) => {
          if (!acc.includes(doc)) {
            acc.push(doc);
          }
        });
      }
      return acc;
    }, [] as string[]);

    // Missing reports
    const vehicleMissingReports = missingReports.filter(r => (r.vehicleId === vehicle.id || r.vehicleId === vehicle.vehicleNumber) && r.status === 'Pending');
    const missingDocs = vehicleMissingReports.flatMap(r => r.missingDocuments || []);
    const missingTools = vehicleMissingReports.flatMap(r => r.missingTools || []);

    // Monthly trips calculation
    const currentMonthStr = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const vehicleTrips = trips.filter(t => t.vehicleId === vehicle.id);
    const completedThisMonth = vehicleTrips.filter(t => {
      if (t.status !== 'Completed') return false;
      const tripDate = t.endTime?.seconds ? new Date(t.endTime.seconds * 1000).toISOString().slice(0, 7) : t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toISOString().slice(0, 7) : '';
      return tripDate === currentMonthStr;
    }).length;
    const totalCompletedTrips = vehicleTrips.filter(t => t.status === 'Completed').length;

    const vehicleSummaryHeader = (
      <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden">
        {/* Header containing the toggle button */}
        <button
          type="button"
          onClick={() => setIsLiveInfoExpanded(!isLiveInfoExpanded)}
          className="w-full flex items-center justify-between px-5 py-4 bg-[#f8fafc] border-b border-border hover:bg-slate-100/60 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5 text-text-main font-bold text-sm">
            <Info size={16} className="text-blue-600 shrink-0" />
            <span>স্ক্যানকৃত গাড়ির লাইভ তথ্য (Live Vehicle Info): {vehicle.vehicleNumber}</span>
            <span className={cn(
              "text-[10px] font-black px-2 py-0.5 rounded-full uppercase border ml-1",
              vehicle.status === 'Available' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
              vehicle.status === 'On Trip' ? "bg-blue-50 text-blue-700 border-blue-200" :
              vehicle.status === 'Maintenance' ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-700 border-slate-200"
            )}>
              {vehicle.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div onClick={e => e.stopPropagation()}>
              <VehicleProfileButton vehicle={vehicle} />
            </div>
            {isLiveInfoExpanded ? (
              <ChevronUp size={16} className="text-slate-500 shrink-0" />
            ) : (
              <ChevronDown size={16} className="text-slate-500 shrink-0" />
            )}
          </div>
        </button>

        {isLiveInfoExpanded && (
          <div className="p-5 space-y-6 text-xs border-t border-slate-100">
            
            {/* 1. Vehicle Core Profile Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">গাড়ির ধরণ (Type)</span>
                <span className="font-black text-slate-800 text-sm">{vehicle.type || 'Standard'}</span>
              </div>
              <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">স্ট্যাটাস (Status)</span>
                <span className={cn(
                  "font-black text-sm flex items-center gap-1",
                  vehicle.status === 'Available' ? "text-emerald-700" :
                  vehicle.status === 'On Trip' ? "text-blue-700" :
                  vehicle.status === 'Maintenance' ? "text-amber-700" : "text-slate-700"
                )}>
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    vehicle.status === 'Available' ? "bg-emerald-500 animate-pulse" :
                    vehicle.status === 'On Trip' ? "bg-blue-500 animate-pulse" :
                    vehicle.status === 'Maintenance' ? "bg-amber-500" : "bg-slate-400"
                  )} />
                  {vehicle.status === 'Available' ? 'Available (স্টকে)' : 
                   vehicle.status === 'On Trip' ? 'On Trip (ট্রিপে)' : 
                   vehicle.status === 'Maintenance' ? 'Maintenance (মেরামত)' : vehicle.status}
                </span>
              </div>
              <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">চলতি মাসের ট্রিপ</span>
                <span className="font-black text-purple-800 text-sm">{completedThisMonth} টি সম্পন্ন</span>
                <span className="text-[9px] text-purple-600 font-medium block">সর্বমোট {totalCompletedTrips} টি ট্রিপ</span>
              </div>
              <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">মামলা সংক্রান্ত</span>
                <span className="font-black text-amber-800 text-sm">{totalVehicleCases.length} টি মামলা</span>
                <span className="text-[9px] text-amber-700 font-medium block">সক্রিয়: {activeVehicleCases.length} টি ({totalFineAmount > 0 ? `৳${totalFineAmount.toLocaleString()}` : 'বকেয়া নেই'})</span>
              </div>
            </div>

            {/* 2. Maintenance Notes if any */}
            {vehicle.maintenanceNotes && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 space-y-0.5">
                <p className="font-bold flex items-center gap-1.5 text-xs text-amber-800">
                  <AlertTriangle size={13} className="text-amber-600" />
                  মেইনটেনেন্স নোট / গাড়ির সমস্যা:
                </p>
                <p className="text-[11px] text-amber-900 pl-4 whitespace-pre-wrap">{vehicle.maintenanceNotes}</p>
              </div>
            )}

            {/* 3. Vehicle Tools Option from Profile */}
            <div>
              <div className="flex items-center justify-between border-b pb-1.5 mb-2.5">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <Wrench size={14} className="text-blue-600" />
                  <span>টুলস অপশন (Vehicle Tools)</span>
                </h4>
                <span className="text-[10px] text-slate-400 font-medium">প্রোফাইল থেকে লাইভ সিঙ্ক</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STANDARD_VEHICLE_TOOLS.map(tool => {
                  const isAvailable = !!vehicleToolsState[tool.key as keyof typeof vehicleToolsState];
                  const isReportedMissing = missingTools.some(t => t.toLowerCase() === tool.key.toLowerCase() || t.toLowerCase() === tool.label.toLowerCase());
                  const ToolIcon = tool.icon || Wrench;

                  return (
                    <div 
                      key={tool.key}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-xl border transition-all",
                        !isAvailable || isReportedMissing
                          ? "bg-red-50/60 border-red-200/80 text-red-900" 
                          : "bg-slate-50/80 border-slate-200/70 text-slate-800"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-bold",
                          !isAvailable || isReportedMissing
                            ? "bg-red-100 text-red-600" 
                            : "bg-blue-100 text-blue-600"
                        )}>
                          <ToolIcon size={14} />
                        </div>
                        <div>
                          <p className="font-bold text-[11px] text-slate-800 leading-tight">{tool.label}</p>
                          <p className="text-[9px] text-slate-500 font-medium">
                            {!isAvailable ? "গাড়িতে অনুপস্থিত" : isReportedMissing ? "রিপোর্টে মিসিং" : "গাড়িতে প্রস্তুত রয়েছে"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "text-[9px] font-black px-2 py-0.5 rounded-md uppercase border",
                          !isAvailable 
                            ? "bg-red-100 border-red-200 text-red-700" 
                            : isReportedMissing
                            ? "bg-amber-100 border-amber-200 text-amber-800"
                            : "bg-emerald-100 border-emerald-200 text-emerald-800"
                        )}>
                          {!isAvailable ? "নেই" : isReportedMissing ? "মিসিং" : "আছে"}
                        </span>

                        {canManage && (
                          <button
                            type="button"
                            onClick={() => handleToggleScannedTool(vehicle.id, tool.key, isAvailable)}
                            disabled={isUpdatingTool}
                            className={cn(
                              "px-1.5 py-0.5 text-[9px] font-bold rounded border cursor-pointer transition-colors",
                              isAvailable 
                                ? "bg-white border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200" 
                                : "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
                            )}
                            title="টুলস স্ট্যাটাস পরিবর্তন করুন"
                          >
                            {isAvailable ? "বাদ দিন" : "যুক্ত করুন"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. Vehicle Documents Option from Profile */}
            <div>
              <div className="flex items-center justify-between border-b pb-1.5 mb-2.5">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <FileText size={14} className="text-emerald-600" />
                  <span>কাগজপত্র স্ট্যাটাস (Documents Status)</span>
                </h4>
                <span className="text-[10px] text-slate-400 font-medium">বৈধতা ও জব্দ সংক্রান্ত তথ্য</span>
              </div>
              <div className="space-y-2">
                {STANDARD_VEHICLE_DOCS.map(doc => {
                  const isSeized = seizedDocs.some(d => d.toUpperCase() === doc.code.toUpperCase());
                  const isMissing = missingDocs.some(d => d.toUpperCase() === doc.code.toUpperCase());
                  const isDocAvailable = !!vehicleDocsState[doc.code as keyof typeof vehicleDocsState];

                  return (
                    <div 
                      key={doc.code} 
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-xl border transition-all",
                        isSeized ? "bg-red-50 border-red-200 text-red-900" :
                        isMissing ? "bg-amber-50 border-amber-200 text-amber-900" :
                        !isDocAvailable ? "bg-slate-100/80 border-slate-200 text-slate-500" :
                        "bg-emerald-50/40 border-emerald-100 text-emerald-900"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          isSeized ? "bg-red-500 animate-pulse" :
                          isMissing ? "bg-amber-500" :
                          !isDocAvailable ? "bg-slate-400" :
                          "bg-emerald-500"
                        )} />
                        <div>
                          <div className="font-bold text-[11px] flex items-center gap-1.5">
                            <span className="px-1.5 py-0.2 bg-white/80 border rounded text-[10px] font-mono font-bold text-slate-700">{doc.code}</span>
                            <span>{doc.label}</span>
                          </div>
                          {isSeized && (
                            <p className="text-[9px] text-red-600 font-medium mt-0.5">⚠️ পুলিশের মামলায় ডকুমেন্ট জব্দ রয়েছে</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-md uppercase shrink-0 border whitespace-nowrap leading-none text-center",
                          isSeized ? "bg-red-100 border-red-200 text-red-700" :
                          isMissing ? "bg-amber-100 border-amber-200 text-amber-700" :
                          !isDocAvailable ? "bg-slate-200 border-slate-300 text-slate-600" :
                          "bg-emerald-100 border-emerald-200 text-emerald-700"
                        )}>
                          {isSeized ? "মামলায় জব্দ" :
                           isMissing ? "হারিয়ে গেছে" :
                           !isDocAvailable ? "অনুপলব্ধ" :
                           "বৈধ ও আছে"}
                        </span>

                        {canManage && !isSeized && !isMissing && (
                          <button
                            type="button"
                            onClick={() => handleToggleScannedDoc(vehicle.id, doc.code, isDocAvailable)}
                            disabled={isUpdatingDoc}
                            className={cn(
                              "px-1.5 py-0.5 text-[9px] font-bold rounded border cursor-pointer transition-colors whitespace-nowrap",
                              isDocAvailable 
                                ? "bg-white border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200" 
                                : "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
                            )}
                            title="ডকুমেন্ট স্ট্যাটাস পরিবর্তন করুন"
                          >
                            {isDocAvailable ? "বাদ দিন" : "যুক্ত করুন"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 5. Legal Cases Section */}
            <div>
              <div className="flex items-center justify-between border-b pb-1.5 mb-2.5">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <ShieldAlert size={14} className="text-red-500" />
                  <span>মামলার বিবরণ (Legal Cases)</span>
                </h4>
                <span className="text-[10px] text-slate-400 font-medium">মোট: {totalVehicleCases.length} টি মামলা</span>
              </div>

              {activeVehicleCases.length === 0 ? (
                <div className="bg-emerald-50/40 border border-emerald-100 p-3 rounded-xl flex items-center gap-2 text-emerald-800">
                  <CheckCircle size={15} className="text-emerald-500 shrink-0" />
                  <span className="font-semibold text-[11px]">এই গাড়ির কোনো সক্রিয় বা বকেয়া মামলা নেই (No Active Cases)</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-start gap-2.5 text-red-900">
                    <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0 animate-bounce" />
                    <div>
                      <p className="font-bold text-xs">সতর্কতা: গাড়িটি সক্রিয় মামলার আওতায় রয়েছে!</p>
                      <p className="text-[11px] text-red-700 mt-0.5">
                        মোট সক্রিয় মামলা: <strong>{activeVehicleCases.length} টি</strong> | মোট বকেয়া জরিমানা: <strong>৳{totalFineAmount.toLocaleString()}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {activeVehicleCases.map((c: any) => (
                      <div key={c.id} className="p-3 bg-red-50/40 border border-red-100 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-xs">মামলা নম্বর: {c.caseNumber || c.id}</span>
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 font-black rounded text-[10px]">
                            জরিমানা: ৳{Number(c.fineAmount || 0).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          <strong>মামলার কারণ:</strong> {c.caseReason || 'অনুল্লেখিত'}
                        </p>
                        {c.seizedDocuments && c.seizedDocuments.length > 0 && (
                          <div className="flex items-center gap-1 text-[10px] text-red-700 font-medium">
                            <span>জব্দকৃত কাগজপত্র:</span>
                            <span className="font-bold">{c.seizedDocuments.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 6. Audit details */}
            <div className="pt-2 border-t flex justify-end">
              <AuditDetailsDropdown createdBy={vehicle.createdBy} updatedBy={vehicle.updatedBy} />
            </div>

          </div>
        )}
      </div>
    );

    const quickActionsCard = (
      <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden">
        {/* Header containing the toggle button */}
        <button
          type="button"
          onClick={() => setIsQuickActionsExpanded(!isQuickActionsExpanded)}
          className="w-full flex items-center justify-between px-5 py-4 bg-[#f8fafc] border-b border-border hover:bg-slate-100/60 transition-colors"
        >
          <div className="flex items-center gap-2 text-text-main font-bold text-sm">
            <Wrench size={16} className="text-amber-500" />
            <span>তাৎক্ষণিক স্ট্যাটাস পরিবর্তন (Quick Status Actions)</span>
          </div>
          {isQuickActionsExpanded ? (
            <ChevronUp size={16} className="text-slate-500" />
          ) : (
            <ChevronDown size={16} className="text-slate-500" />
          )}
        </button>

        {isQuickActionsExpanded && (
          <div className="p-5 space-y-4">
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
        )}
      </div>
    );

    if (scanResult.type === 'OUT') {
      // OUT SCAN: Start Trip/Dispatch (requires vehicle to be Available or Pending Out Scan)
      if (vehicle.status !== 'Available' && vehicle.status !== 'Pending Out Scan') {
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
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="text-slate-500 font-medium">ড্রাইভারের নাম:</span>
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <span>{activeTrip.driverName}</span>
                        <StaffProfileButton staffId={activeTrip.driverId} staffName={activeTrip.driverName} role="Driver" />
                      </div>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-slate-500 font-medium">ফোন নাম্বার:</span>
                      <span className="font-bold text-slate-800">{activeTrip.driverPhone || 'N/A'}</span>
                    </div>
                    {activeTrip.helperId && (
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-slate-500 font-medium">হেলপার:</span>
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <span>{activeTrip.helperName} ({activeTrip.helperId})</span>
                          <StaffProfileButton staffId={activeTrip.helperId} staffName={activeTrip.helperName} role="Helper" />
                        </div>
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

                  {seizedDocs.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden text-xs">
                      {/* Header containing the toggle button */}
                      <button
                        type="button"
                        onClick={() => setIsSeizedWarningExpanded(!isSeizedWarningExpanded)}
                        className="w-full flex items-center justify-between p-3.5 bg-red-100/60 hover:bg-red-100/80 transition-colors text-red-800 font-bold"
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={16} className="text-red-500 animate-pulse" />
                          <span className="text-left">সতর্কতা: এই গাড়ির কাগজ জব্দ রয়েছে ({seizedDocs.join(', ')})!</span>
                        </div>
                        {isSeizedWarningExpanded ? <ChevronUp size={16} className="flex-shrink-0" /> : <ChevronDown size={16} className="flex-shrink-0" />}
                      </button>

                      {/* Expandable/collapsible content */}
                      {isSeizedWarningExpanded && (
                        <div className="p-4 border-t border-red-200 bg-red-50/50 text-red-700 space-y-2">
                          <p className="font-semibold text-red-800">
                            গাড়িটির বিরুদ্ধে সক্রিয় মামলা থাকায় নিম্নোক্ত কাগজপত্রসমূহ বর্তমানে জব্দ রয়েছে (Seized Documents):
                          </p>
                          <div className="flex flex-wrap gap-1.5 my-1">
                            {seizedDocs.map((doc: string) => (
                              <span key={doc} className="font-bold text-slate-900 bg-red-100 border border-red-200 px-2 py-0.5 rounded text-xs">
                                {doc}
                              </span>
                            ))}
                          </div>
                          <p className="leading-relaxed text-[11px] text-red-600">
                            এই কাগজগুলো ছাড়া গাড়ি চালানো আইনত দণ্ডনীয় হতে পারে। দয়া করে নিশ্চিত হয়ে ছাড়ুন।
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Trip details */}
                  <div className="bg-slate-50 border p-4 rounded-xl space-y-3 text-xs">
                    <h5 className="font-bold text-slate-700 border-b pb-1.5 flex items-center gap-1.5">
                      <ClipboardCheck size={14} className="text-slate-500" />
                      এন্ট্রি করা ট্রিপের বিবরণ (Registered Trip Details)
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                      <div className="flex justify-between items-center border-b pb-1">
                        <span className="text-slate-500">👨‍✈️ ড্রাইভার:</span>
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <span>{pendingTrip.driverName} ({pendingTrip.driverId})</span>
                          <StaffProfileButton staffId={pendingTrip.driverId} staffName={pendingTrip.driverName} role="Driver" />
                        </div>
                      </div>
                      <div className="flex justify-between border-b pb-1">
                        <span className="text-slate-500">📞 ড্রাইভার ফোন:</span>
                        <span className="font-bold text-slate-800">{pendingTrip.driverPhone || 'নেই'}</span>
                      </div>
                      {pendingTrip.helperId && (
                        <>
                          <div className="flex justify-between items-center border-b pb-1">
                            <span className="text-slate-500">🧑 হেলপার:</span>
                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
                              <span>{pendingTrip.helperName} ({pendingTrip.helperId})</span>
                              <StaffProfileButton staffId={pendingTrip.helperId} staffName={pendingTrip.helperName} role="Helper" />
                            </div>
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

                  {/* 1. Vehicle Tools from Profile */}
                  <div className="space-y-2 border-t pt-4">
                    <div className="flex items-center justify-between border-b pb-1.5 mb-2.5">
                      <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs sm:text-sm">
                        <Wrench size={15} className="text-blue-600" />
                        <span>১. গাড়ির টুলস অপশন (Vehicle Tools from Profile)</span>
                      </h4>
                      <span className="text-[11px] text-slate-500 font-medium">প্রোফাইল থেকে সরাসরি সিঙ্ককৃত</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {STANDARD_VEHICLE_TOOLS.map(tool => {
                        const isAvailable = !!vehicleToolsState[tool.key as keyof typeof vehicleToolsState];
                        const isReportedMissing = missingTools.some(t => t.toLowerCase() === tool.key.toLowerCase() || t.toLowerCase() === tool.label.toLowerCase());
                        const ToolIcon = tool.icon || Wrench;

                        return (
                          <div 
                            key={tool.key}
                            className={cn(
                              "flex items-center justify-between p-2.5 rounded-xl border transition-all gap-2",
                              !isAvailable || isReportedMissing
                                ? "bg-red-50/80 border-red-200 text-red-950" 
                                : "bg-slate-50/90 border-slate-200 text-slate-900"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className={cn(
                                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-bold",
                                !isAvailable || isReportedMissing
                                  ? "bg-red-100 text-red-600 border border-red-200" 
                                  : "bg-blue-100 text-blue-700 border border-blue-200"
                              )}>
                                <ToolIcon size={14} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-xs text-slate-900 leading-tight truncate" title={tool.label}>
                                  {tool.label}
                                </p>
                                <p className="text-[10px] font-medium text-slate-500 truncate">
                                  {!isAvailable ? "গাড়িতে নেই" : isReportedMissing ? "মিসিং" : "প্রস্তুত রয়েছে"}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center shrink-0">
                              <span className={cn(
                                "text-[11px] font-bold px-2 py-0.5 rounded-md uppercase border whitespace-nowrap leading-none text-center shadow-xs",
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

                  {/* 2. Vehicle Documents from Profile */}
                  <div className="space-y-2 border-t pt-4">
                    <div className="flex items-center justify-between border-b pb-1.5 mb-2.5">
                      <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs sm:text-sm">
                        <FileText size={15} className="text-emerald-600" />
                        <span>২. গাড়ির কাগজপত্র স্ট্যাটাস (Documents Status from Profile)</span>
                      </h4>
                      <span className="text-[11px] text-slate-500 font-medium">বৈধতা ও জব্দ সংক্রান্ত তথ্য</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {STANDARD_VEHICLE_DOCS.map(doc => {
                        const isSeized = seizedDocs.some(d => d.toUpperCase() === doc.code.toUpperCase());
                        const isMissing = missingDocs.some(d => d.toUpperCase() === doc.code.toUpperCase());
                        const isDocAvailable = !!vehicleDocsState[doc.code as keyof typeof vehicleDocsState];
                        const cleanDocName = doc.label.replace(/^[A-Za-z]+\s*\((.*?)\)$/, '$1') || doc.label;

                        return (
                          <div 
                            key={doc.code} 
                            className={cn(
                              "flex items-center justify-between p-3 rounded-xl border transition-all gap-2.5 overflow-hidden",
                              isSeized ? "bg-red-50/90 border-red-200 text-red-950" :
                              isMissing ? "bg-amber-50/90 border-amber-200 text-amber-950" :
                              !isDocAvailable ? "bg-slate-100/90 border-slate-200 text-slate-600" :
                              "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                            )}
                          >
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <span className={cn(
                                "w-2.5 h-2.5 rounded-full shrink-0 mt-1",
                                isSeized ? "bg-red-500 animate-pulse" :
                                isMissing ? "bg-amber-500" :
                                !isDocAvailable ? "bg-slate-400" :
                                "bg-emerald-500"
                              )} />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono font-black text-slate-800 shrink-0 shadow-xs">
                                    {doc.code}
                                  </span>
                                  <span className="font-bold text-xs text-slate-900 leading-snug">
                                    {cleanDocName}
                                  </span>
                                </div>
                                {isSeized && (
                                  <p className="text-[11px] text-red-600 font-bold mt-0.5">⚠️ পুলিশের মামলায় জব্দ</p>
                                )}
                                {isMissing && (
                                  <p className="text-[11px] text-amber-700 font-bold mt-0.5">⚠️ ডকুমেন্টটি হারিয়ে গেছে</p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center shrink-0">
                              <span className={cn(
                                "text-[11px] font-bold px-2.5 py-1 rounded-md uppercase shrink-0 border whitespace-nowrap leading-none text-center shadow-xs",
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

          {/* Scanned Vehicle Live Info Dropdown & Quick Actions below Vehicle Release Card */}
          {vehicleSummaryHeader}
          {quickActionsCard}
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
                  <div className="flex items-center gap-1">
                    <span>• ড্রাইভার: </span>
                    <strong className="text-blue-900">{activeTrip.driverName} ({activeTrip.driverId})</strong>
                    <StaffProfileButton staffId={activeTrip.driverId} staffName={activeTrip.driverName} role="Driver" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span>• হেলপার: </span>
                    <strong>{activeTrip.helperName || 'নেই'}</strong>
                    {activeTrip.helperId && (
                      <StaffProfileButton staffId={activeTrip.helperId} staffName={activeTrip.helperName} role="Helper" />
                    )}
                  </div>
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

        {/* Scanned Vehicle Live Info Dropdown & Quick Actions below Return Card */}
        {vehicleSummaryHeader}
        {quickActionsCard}
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
          {/* Mode Switcher Tabs */}
          <div className="flex bg-slate-200/80 p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setActiveScanMode('manual')}
              className={cn(
                "flex-1 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer",
                activeScanMode === 'manual'
                  ? "bg-white text-blue-700 shadow-xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Search size={14} className={activeScanMode === 'manual' ? "text-blue-600" : "text-slate-400"} />
              <span>নম্বর দিয়ে সার্চ (Manual)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveScanMode('camera')}
              className={cn(
                "flex-1 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer",
                activeScanMode === 'camera'
                  ? "bg-white text-blue-700 shadow-xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Camera size={14} className={activeScanMode === 'camera' ? "text-blue-600" : "text-slate-400"} />
              <span>ক্যামেরা স্ক্যান (Live)</span>
            </button>
          </div>

          {activeScanMode === 'camera' ? (
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
          ) : (
            /* Manual Vehicle Search & Select Card */
            <Card title="গাড়ির নম্বর লিখে সিলেক্ট করুন (Manual Entry)" className="border-2 border-blue-100 shadow-sm">
              <div className="space-y-4 text-xs">
                {/* Search Box */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-600 block text-[11px]">
                    গাড়ির নম্বর বা ডিজিট দিয়ে খুঁজুন (Search Plate / Last 4 Digits)
                  </label>
                  <div className="relative">
                    <input 
                      type="text" 
                      className="w-full pl-9 pr-8 py-2.5 rounded-xl border-2 border-blue-300/90 bg-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 font-mono text-sm font-bold text-slate-800 transition-all placeholder:text-slate-400 placeholder:font-normal"
                      placeholder="যেমন: 5821 বা ঢাকা মেট্রো..."
                      value={manualVehicleSearch}
                      onChange={e => {
                        const val = e.target.value;
                        setManualVehicleSearch(val);
                        // Auto-match if exact match found
                        const trimmed = val.trim().toLowerCase();
                        if (trimmed) {
                          const exact = computedVehicles.find(v => 
                            v.vehicleNumber.toLowerCase() === trimmed || 
                            v.vehicleNumber.toLowerCase().endsWith(trimmed)
                          );
                          if (exact) {
                            setSelectedSimVehicleId(exact.id);
                            if (exact.status === 'Pending Out Scan') {
                              setSelectedSimAction('OUT');
                            } else if (exact.status === 'On Trip') {
                              setSelectedSimAction('IN');
                            }
                          }
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const trimmed = manualVehicleSearch.trim().toLowerCase();
                          const matched = computedVehicles.filter(v => 
                            v.vehicleNumber.toLowerCase().includes(trimmed) || 
                            v.type?.toLowerCase().includes(trimmed) ||
                            v.model?.toLowerCase().includes(trimmed)
                          );
                          if (matched.length > 0) {
                            const target = matched[0];
                            setSelectedSimVehicleId(target.id);
                            const action = target.status === 'Pending Out Scan' ? 'OUT' : target.status === 'On Trip' ? 'IN' : selectedSimAction;
                            triggerScanResult(action, target.id);
                          }
                        }
                      }}
                    />
                    <Search size={16} className="absolute left-3 top-3 text-blue-500" />
                    {manualVehicleSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setManualVehicleSearch('');
                        }}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 font-bold px-1.5 py-0.5 rounded-full text-xs"
                        title="ক্লিয়ার করুন"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Filtered Vehicles List (if search query entered) */}
                {manualVehicleSearch.trim() && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[11px] text-slate-500 px-1">
                      <span>ম্যাচ হওয়া গাড়ি তালিকা:</span>
                      <span className="font-semibold">
                        {computedVehicles.filter(v => 
                          v.vehicleNumber.toLowerCase().includes(manualVehicleSearch.toLowerCase()) ||
                          v.type?.toLowerCase().includes(manualVehicleSearch.toLowerCase()) ||
                          v.model?.toLowerCase().includes(manualVehicleSearch.toLowerCase())
                        ).length} টি পাওয়া গেছে
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                      {computedVehicles
                        .filter(v => 
                          v.vehicleNumber.toLowerCase().includes(manualVehicleSearch.toLowerCase()) ||
                          v.type?.toLowerCase().includes(manualVehicleSearch.toLowerCase()) ||
                          v.model?.toLowerCase().includes(manualVehicleSearch.toLowerCase())
                        )
                        .map(v => {
                          const isSelected = selectedSimVehicleId === v.id;
                          return (
                            <div
                              key={v.id}
                              onClick={() => {
                                setSelectedSimVehicleId(v.id);
                                if (v.status === 'Pending Out Scan') {
                                  setSelectedSimAction('OUT');
                                } else if (v.status === 'On Trip') {
                                  setSelectedSimAction('IN');
                                }
                              }}
                              className={cn(
                                "p-2.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-2",
                                isSelected
                                  ? "bg-blue-50 border-blue-500 shadow-xs"
                                  : "bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/80"
                              )}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <Truck size={14} className={isSelected ? "text-blue-600" : "text-slate-400"} />
                                  <span className="font-bold text-slate-900 font-mono text-xs truncate">
                                    {v.vehicleNumber}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-500 truncate mt-0.5">
                                  {v.type || v.model || 'Commercial Fleet'}
                                </div>
                              </div>
                              <span className={cn(
                                "text-[9px] font-black px-2 py-0.5 rounded-full uppercase border shrink-0",
                                v.status === 'Available' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                v.status === 'On Trip' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                v.status === 'Pending Out Scan' ? "bg-amber-50 text-amber-700 border-amber-200" :
                                v.status === 'Maintenance' ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-slate-100 text-slate-700 border-slate-200"
                              )}>
                                {v.status}
                              </span>
                            </div>
                          );
                        })}
                      {computedVehicles.filter(v => 
                        v.vehicleNumber.toLowerCase().includes(manualVehicleSearch.toLowerCase()) ||
                        v.type?.toLowerCase().includes(manualVehicleSearch.toLowerCase()) ||
                        v.model?.toLowerCase().includes(manualVehicleSearch.toLowerCase())
                      ).length === 0 && (
                        <div className="p-3 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-[11px]">
                          কোনো গাড়ি খুঁজে পাওয়া যায়নি।
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Dropdown Select option as fallback */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-600 block text-[11px]">
                    অথবা ড্রপডাউন থেকে নির্বাচন করুন (Or Select from List)
                  </label>
                  <select 
                    className="w-full px-3 py-2.5 text-xs rounded-xl border-2 border-slate-300 outline-none bg-white font-semibold focus:border-blue-500 cursor-pointer"
                    value={selectedSimVehicleId}
                    onChange={e => {
                      const vId = e.target.value;
                      setSelectedSimVehicleId(vId);
                      const target = computedVehicles.find(v => v.id === vId);
                      if (target) {
                        if (target.status === 'Pending Out Scan') {
                          setSelectedSimAction('OUT');
                        } else if (target.status === 'On Trip') {
                          setSelectedSimAction('IN');
                        }
                      }
                    }}
                  >
                    <option value="">-- গাড়ি সিলেক্ট করুন ({computedVehicles.length} টি গাড়ি) --</option>
                    {computedVehicles.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.vehicleNumber} — {v.status}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Action Type Selection (OUT vs IN) */}
                <div className="space-y-1.5 pt-1">
                  <label className="font-bold text-slate-700 block text-xs">
                    অ্যাকশন সিলেক্ট করুন (Action Mode)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSimAction('OUT')}
                      className={cn(
                        "py-2.5 px-3 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs",
                        selectedSimAction === 'OUT' 
                          ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-100" 
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      <span>OUT (ছাড়পত্র স্ক্যান)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSimAction('IN')}
                      className={cn(
                        "py-2.5 px-3 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs",
                        selectedSimAction === 'IN' 
                          ? "bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-100" 
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                      <span>IN (ফেরত এন্ট্রি স্ক্যান)</span>
                    </button>
                  </div>
                </div>

                {/* Trigger Action Button */}
                <Button 
                  type="button"
                  onClick={() => {
                    if (!selectedSimVehicleId) {
                      alert("দয়া করে একটি গাড়ির নম্বর লিখুন বা সিলেক্ট করুন।");
                      return;
                    }
                    triggerScanResult(selectedSimAction, selectedSimVehicleId);
                  }} 
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  <span>গাড়ি লোড ও প্রসেস করুন</span>
                </Button>
              </div>
            </Card>
          )}
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
