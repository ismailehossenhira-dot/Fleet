import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Camera, 
  Sparkles, 
  Scan, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Truck, 
  Zap, 
  Volume2, 
  VolumeX, 
  Upload, 
  ArrowRightCircle, 
  ShieldCheck,
  RotateCw,
  LogOut,
  LogIn,
  Eye,
  Flashlight,
  Activity,
  Gauge,
  ZoomIn,
  Search,
  X
} from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  PlateScanData, 
  matchVehicleFromDatabase, 
  playScanSuccessSound,
  convertBanglaToEngDigits,
  convertEngToBanglaDigits,
  translateBanglaPlateToEnglish,
  BANGLA_TO_ENG_CLASS_MAP
} from '../lib/anpr';
import { cn } from '../lib/utils';
import { useTheme } from '../ThemeContext';

interface LivePlateCameraScannerProps {
  vehicles: any[];
  trips?: any[];
  onVehicleMatched: (vehicle: any, action: 'IN' | 'OUT', plateData?: PlateScanData) => void;
  onDirectGateIn?: (vehicle: any) => Promise<void>;
  onDirectGateOut?: (vehicle: any) => Promise<void>;
  canManage?: boolean;
}

export const LivePlateCameraScanner: React.FC<LivePlateCameraScannerProps> = ({
  vehicles = [],
  trips = [],
  onVehicleMatched,
  onDirectGateIn,
  onDirectGateOut,
  canManage = true
}) => {
  const { isEmerald, isCrimson, isAmber } = useTheme();
  
  // Camera stream & video refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Scanner State Flags
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isContinuousAutoScan, setIsContinuousAutoScan] = useState<boolean>(true);
  const [motionSpeedMode, setMotionSpeedMode] = useState<'fast' | 'normal'>('fast');
  const [torchActive, setTorchActive] = useState<boolean>(false);
  const [hasTorchSupport, setHasTorchSupport] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [autoGateCountdown, setAutoGateCountdown] = useState<number | null>(null);
  const [autoGateEnabled, setAutoGateEnabled] = useState<boolean>(false);

  // Detection Results
  const [lastDetectedPlate, setLastDetectedPlate] = useState<PlateScanData | null>(null);
  const [matchedVehicle, setMatchedVehicle] = useState<any | null>(null);
  const [detectionTimestamp, setDetectionTimestamp] = useState<string | null>(null);
  const [directActionExecuting, setDirectActionExecuting] = useState<boolean>(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [scanFeedbackMsg, setScanFeedbackMsg] = useState<string | null>(null);
  const [scanAttemptsCount, setScanAttemptsCount] = useState<number>(0);

  // Quick manual vehicle number search query
  const [quickQuery, setQuickQuery] = useState<string>('');

  // Refs for robust continuous auto-scan loop
  const isProcessingRef = useRef<boolean>(false);
  const autoScanTimerRef = useRef<any>(null);
  const vehiclesRef = useRef<any[]>(vehicles);
  const isContinuousAutoScanRef = useRef<boolean>(isContinuousAutoScan);
  const motionSpeedModeRef = useRef<'fast' | 'normal'>(motionSpeedMode);
  const cameraActiveRef = useRef<boolean>(cameraActive);
  const autoGateCountdownRef = useRef<number | null>(autoGateCountdown);

  // Keep refs synchronized
  useEffect(() => {
    vehiclesRef.current = vehicles;
  }, [vehicles]);

  useEffect(() => {
    isContinuousAutoScanRef.current = isContinuousAutoScan;
  }, [isContinuousAutoScan]);

  useEffect(() => {
    motionSpeedModeRef.current = motionSpeedMode;
  }, [motionSpeedMode]);

  useEffect(() => {
    cameraActiveRef.current = cameraActive;
  }, [cameraActive]);

  useEffect(() => {
    autoGateCountdownRef.current = autoGateCountdown;
  }, [autoGateCountdown]);

  // Stop camera stream cleanly
  const stopCamera = useCallback(() => {
    if (autoScanTimerRef.current) {
      clearTimeout(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchActive(false);
    setHasTorchSupport(false);
    setCameraActive(false);
    cameraActiveRef.current = false;
  }, [stream]);

  // Toggle Torch/Flashlight for night & low-light gate scanning
  const toggleTorch = async () => {
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;
    try {
      const nextState = !torchActive;
      await (videoTrack as any).applyConstraints({
        advanced: [{ torch: nextState }]
      });
      setTorchActive(nextState);
    } catch (e) {
      console.warn("Torch constraint not supported on this device:", e);
    }
  };

  // Adjust Zoom
  const cycleZoom = async () => {
    const nextZoom = zoomLevel === 1 ? 1.5 : zoomLevel === 1.5 ? 2 : zoomLevel === 2 ? 2.5 : 1;
    setZoomLevel(nextZoom);
    if (stream) {
      const track = stream.getVideoTracks()[0];
      if (track && (track.getCapabilities as any)?.()?.zoom) {
        try {
          await (track as any).applyConstraints({
            advanced: [{ zoom: nextZoom }]
          });
        } catch (e) {
          console.warn("Hardware zoom not supported:", e);
        }
      }
    }
  };

  // Start camera stream (Always-on capability with multi-tier fallback)
  const startCamera = useCallback(async () => {
    setCameraLoading(true);
    setCameraError(null);
    setScanFeedbackMsg(null);

    // Stop any existing tracks first
    if (stream) {
      stream.getTracks().forEach(t => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
    }

    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('NOT_SUPPORTED');
      }

      let newStream: MediaStream | null = null;

      // Tier 1: Try with ideal facingMode and desired resolution
      try {
        const idealConstraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        };
        newStream = await navigator.mediaDevices.getUserMedia(idealConstraints);
      } catch (tier1Err) {
        console.warn("Primary camera constraints unavailable, attempting fallback to default video device...", tier1Err);
        try {
          // Tier 2: Try basic video without facingMode constraint (essential for desktop/laptop/single webcams)
          newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (tier2Err) {
          // Tier 3: Enumerate devices and select first available video input
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter(d => d.kind === 'videoinput');
          if (videoInputs.length > 0) {
            newStream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: videoInputs[0].deviceId } },
              audio: false
            });
          } else {
            throw tier2Err;
          }
        }
      }

      if (newStream) {
        setStream(newStream);
        const track = newStream.getVideoTracks()[0];
        const capabilities: any = track?.getCapabilities?.() || {};
        if (capabilities.torch) {
          setHasTorchSupport(true);
        }

        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.warn("Video play notice:", e));
          };
        }
        setCameraActive(true);
        cameraActiveRef.current = true;
      }
    } catch (err: any) {
      console.warn("Camera device initialization note:", err?.name || err?.message || err);
      let msg = "ক্যামেরা চালু করা সম্ভব হয়নি।";
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        msg = "ক্যামেরা ব্যবহারের অনুমতি দেওয়া হয়নি (Permission Denied)। অনুগ্রহ করে ব্রাউজারে ক্যামেরা পারমিশন এলাউ করুন অথবা ছবি আপলোড করুন।";
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError' || String(err?.message || '').toLowerCase().includes('not found')) {
        msg = "কোনো সংযুক্ত ক্যামেরা ডিভাইস পাওয়া যায়নি (Camera not found)। আপনি নিচের 'ছবি আপলোড' বা 'দ্রুত গাড়ি নির্বাচন' অপশন ব্যবহার করতে পারেন।";
      } else if (err?.message === 'NOT_SUPPORTED') {
        msg = "আপনার বর্তমান ব্রাউজারে ক্যামেরা অ্যাক্সেস সাপোর্ট করে না। অনুগ্রহ করে ছবি আপলোড অথবা ম্যানুয়াল সার্চ ব্যবহার করুন।";
      } else {
        msg = "ক্যামেরা সংযোগে সমস্যা হচ্ছে। অনুগ্রহ করে নিচে ছবি আপলোড করুন অথবা দ্রুত গাড়ি নির্বাচন ব্যবহার করুন।";
      }
      setCameraError(msg);
      setCameraActive(false);
      cameraActiveRef.current = false;
    } finally {
      setCameraLoading(false);
    }
  }, [facingMode, stream]);

  // Initial camera startup
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  // Flip camera between front and back
  const toggleFacingMode = () => {
    stopCamera();
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture current frame from video with motion optimization & dynamic scaling
  const captureFrameBase64 = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return null;

    // Scale to max dimension 1024 for fast and high-clarity OCR
    const maxDim = Math.max(video.videoWidth, video.videoHeight);
    const scale = maxDim > 1024 ? 1024 / maxDim : 1;
    const targetW = Math.round(video.videoWidth * scale);
    const targetH = Math.round(video.videoHeight * scale);

    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, targetW, targetH);
    return canvas.toDataURL('image/jpeg', 0.85);
  }, []);

  // Perform AI Plate Scan API Call
  const performPlateScan = useCallback(async (imageSrc?: string, isManualTrigger = false) => {
    if (isProcessingRef.current) return;
    const base64Img = imageSrc || captureFrameBase64();
    if (!base64Img) {
      if (isManualTrigger) {
        setScanFeedbackMsg("ক্যামেরা থেকে ফ্রেম ক্যাপচার করা যায়নি। ক্যামেরা চালু রাখুন অথবা ছবি আপলোড করুন।");
      }
      return;
    }

    isProcessingRef.current = true;
    setIsProcessing(true);
    setCameraError(null);
    setScanAttemptsCount(prev => prev + 1);

    try {
      const payload = {
        image: base64Img,
        registeredVehicles: vehiclesRef.current.map(v => ({
          vehicleNumber: v.vehicleNumber,
          type: v.type || v.model || 'Commercial'
        }))
      };

      const res = await fetch('/api/anpr/scan-plate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || 'নাম্বার প্লেট স্ক্যান সম্পন্ন হয়নি।');
      }

      const plateData: PlateScanData = resData.data;

      if (plateData && plateData.detected) {
        setLastDetectedPlate(plateData);
        setDetectionTimestamp(new Date().toLocaleTimeString('bn-BD'));
        setScanFeedbackMsg(null);

        // Match with fleet vehicles
        const matched = matchVehicleFromDatabase(plateData, vehiclesRef.current);
        if (matched) {
          setMatchedVehicle(matched);
          if (soundEnabled) {
            playScanSuccessSound();
          }

          // Determine appropriate action (IN vs OUT)
          const targetAction: 'IN' | 'OUT' = matched.status === 'On Trip' ? 'IN' : 'OUT';

          // Trigger matched callback
          onVehicleMatched(matched, targetAction, plateData);

          // Handle auto-gate countdown if enabled
          if (autoGateEnabled) {
            setAutoGateCountdown(3);
          }
        } else {
          setMatchedVehicle(null);
        }
      } else {
        if (isManualTrigger || imageSrc) {
          setScanFeedbackMsg("⚠️ ছবিতে গাড়ির নম্বর প্লেট বা বনেট সনাক্ত হয়নি। গাড়িটির সামনের হুড বা প্লেট ফ্রেমের মাঝে সোজা রেখে আবার চেষ্টা করুন।");
        }
      }
    } catch (err: any) {
      console.warn("ANPR scan error:", err.message);
      if (isManualTrigger || imageSrc) {
        setScanFeedbackMsg("স্ক্যানিং ব্যর্থ: " + (err.message || 'সার্ভার যোগাযোগে সমস্যা'));
      }
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  }, [captureFrameBase64, onVehicleMatched, soundEnabled, autoGateEnabled]);

  // Robust Auto-Scan Loop using recursive setTimeout to prevent race conditions
  useEffect(() => {
    let isActive = true;

    const runAutoScanStep = async () => {
      if (!isActive) return;

      if (
        cameraActiveRef.current && 
        isContinuousAutoScanRef.current && 
        !isProcessingRef.current && 
        autoGateCountdownRef.current === null
      ) {
        if (videoRef.current && videoRef.current.readyState >= 2) {
          await performPlateScan();
        }
      }

      if (!isActive) return;

      const delay = motionSpeedModeRef.current === 'fast' ? 700 : 1400;
      autoScanTimerRef.current = setTimeout(runAutoScanStep, delay);
    };

    // Kick off loop after 800ms initial video mount
    autoScanTimerRef.current = setTimeout(runAutoScanStep, 800);

    return () => {
      isActive = false;
      if (autoScanTimerRef.current) {
        clearTimeout(autoScanTimerRef.current);
        autoScanTimerRef.current = null;
      }
    };
  }, [performPlateScan]);

  // Auto gate countdown timer
  useEffect(() => {
    let timer: any = null;
    if (autoGateCountdown !== null && autoGateCountdown > 0) {
      timer = setTimeout(() => {
        setAutoGateCountdown(autoGateCountdown - 1);
      }, 1000);
    } else if (autoGateCountdown === 0 && matchedVehicle) {
      handleExecuteDirectGateAction();
      setAutoGateCountdown(null);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [autoGateCountdown, matchedVehicle]);

  // Execute direct Gate In or Out
  const handleExecuteDirectGateAction = async (actionType?: 'IN' | 'OUT') => {
    if (!matchedVehicle || directActionExecuting) return;
    const type = actionType || (matchedVehicle.status === 'On Trip' ? 'IN' : 'OUT');
    setDirectActionExecuting(true);
    setActionSuccessMsg(null);

    try {
      if (type === 'IN' && onDirectGateIn) {
        await onDirectGateIn(matchedVehicle);
        setActionSuccessMsg(`✓ গাড়ি ${matchedVehicle.vehicleNumber} সফলভাবে গেট ইন (Return) হয়েছে!`);
      } else if (type === 'OUT' && onDirectGateOut) {
        await onDirectGateOut(matchedVehicle);
        setActionSuccessMsg(`✓ গাড়ি ${matchedVehicle.vehicleNumber} সফলভাবে গেট আউট (Dispatch) হয়েছে!`);
      } else {
        onVehicleMatched(matchedVehicle, type, lastDetectedPlate || undefined);
      }
    } catch (err: any) {
      console.error("Direct gate action error:", err);
      alert("অ্যাকশন সম্পন্ন করতে সমস্যা হয়েছে: " + (err.message || 'ত্রুটি'));
    } finally {
      setDirectActionExecuting(false);
      setTimeout(() => {
        setActionSuccessMsg(null);
      }, 3500);
    }
  };

  // Handle manual quick selection of vehicle
  const handleSelectQuickVehicle = (vehicle: any) => {
    setMatchedVehicle(vehicle);
    setLastDetectedPlate({
      detected: true,
      plateTextBangla: vehicle.vehicleNumber,
      plateTextEnglish: translateBanglaPlateToEnglish(vehicle.vehicleNumber),
      plateTextStandard: vehicle.vehicleNumber,
      metroOrDistrict: 'ঢাকা মেট্রো',
      vehicleClass: 'ম',
      digitsBangla: convertEngToBanglaDigits(vehicle.vehicleNumber.replace(/[^0-9]/g, '')),
      digitsEnglish: vehicle.vehicleNumber.replace(/[^0-9]/g, ''),
      confidence: 1.0
    });
    setDetectionTimestamp(new Date().toLocaleTimeString('bn-BD'));
    const targetAction: 'IN' | 'OUT' = vehicle.status === 'On Trip' ? 'IN' : 'OUT';
    onVehicleMatched(vehicle, targetAction);
  };

  // Filtered vehicles for quick search
  const filteredQuickVehicles = quickQuery.trim() === ''
    ? vehicles.slice(0, 10)
    : vehicles.filter(v => {
        const q = quickQuery.toLowerCase().trim();
        const num = (v.vehicleNumber || '').toLowerCase();
        const numDigits = num.replace(/[^0-9]/g, '');
        const qDigits = convertBanglaToEngDigits(q).replace(/[^0-9]/g, '');
        return num.includes(q) || (qDigits && numDigits.includes(qDigits)) || (v.type || '').toLowerCase().includes(q);
      });

  // Handle image upload from gallery/device
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        performPlateScan(base64, true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Hidden processing canvas & file input */}
      <canvas ref={canvasRef} className="hidden" />
      <input 
        ref={fileInputRef} 
        type="file" 
        accept="image/*" 
        className="hidden" 
        onChange={handleFileUpload} 
      />

      {/* Main Camera Viewport Frame */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-slate-800 bg-slate-950 shadow-xl min-h-[380px] flex flex-col justify-between">
        
        {/* Top Floating Control Bar */}
        <div className="absolute top-0 left-0 right-0 z-20 p-3 bg-gradient-to-b from-black/85 via-black/50 to-transparent flex items-center justify-between text-white flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                cameraActive ? "bg-emerald-400" : "bg-amber-400"
              )}></span>
              <span className={cn(
                "relative inline-flex rounded-full h-2.5 w-2.5",
                cameraActive ? "bg-emerald-500" : "bg-amber-500"
              )}></span>
            </span>
            <span className="text-xs font-bold font-mono tracking-wide">
              {cameraActive ? 'AI CAMERA LIVE' : 'CAMERA OFF'}
            </span>
            {isProcessing && (
              <span className="text-[10px] bg-blue-600/90 text-white font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm animate-pulse">
                <Sparkles size={11} /> এআই ডিটেকশন চলছে...
              </span>
            )}
          </div>

          {/* Quick Action Buttons on Top Bar */}
          <div className="flex items-center gap-1.5">
            {/* Motion Speed Toggle (Fast Motion ANPR) */}
            <button
              type="button"
              onClick={() => setMotionSpeedMode(prev => prev === 'fast' ? 'normal' : 'fast')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 border",
                motionSpeedMode === 'fast'
                  ? "bg-amber-500/30 text-amber-300 border-amber-400/50 shadow-xs"
                  : "bg-black/40 text-slate-400 border-white/10"
              )}
              title="চলন্ত গাড়ির স্পিড মোড পরিবর্তন"
            >
              <Gauge size={13} className={motionSpeedMode === 'fast' ? "text-amber-400 animate-pulse" : ""} />
              <span>{motionSpeedMode === 'fast' ? 'অটো স্পিড (0.7s)' : 'স্বাভাবিক (1.4s)'}</span>
            </button>

            {/* Digital Zoom Button */}
            {cameraActive && (
              <button
                type="button"
                onClick={cycleZoom}
                className="px-2 py-1 rounded-lg bg-black/50 hover:bg-black/70 text-emerald-300 border border-white/10 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                title="ক্যামেরা জুম করুন"
              >
                <ZoomIn size={13} />
                <span>{zoomLevel}x</span>
              </button>
            )}

            {/* Flashlight / Torch Toggle */}
            {hasTorchSupport && (
              <button
                type="button"
                onClick={toggleTorch}
                className={cn(
                  "p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border",
                  torchActive ? "bg-amber-400 text-slate-950 border-amber-300 shadow-md" : "bg-black/40 text-slate-300 border-white/10"
                )}
                title={torchActive ? "ফ্ল্যাশলাইট বন্ধ করুন" : "ফ্ল্যাশলাইট চালু করুন (Night Mode)"}
              >
                <Flashlight size={15} />
              </button>
            )}

            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={cn(
                "p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                soundEnabled ? "bg-white/20 text-white hover:bg-white/30" : "bg-black/40 text-slate-400"
              )}
              title={soundEnabled ? "সাউন্ড চালু আছে" : "সাউন্ড বন্ধ"}
            >
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>

            <button
              type="button"
              onClick={toggleFacingMode}
              className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-all cursor-pointer"
              title="ক্যামেরা পরিবর্তন (Front / Back)"
            >
              <RotateCw size={15} />
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-all cursor-pointer"
              title="গাড়ির ছবি আপলোড করুন"
            >
              <Upload size={15} />
            </button>
          </div>
        </div>

        {/* Video Screen & Scanning Reticle */}
        <div className="relative flex-1 flex items-center justify-center min-h-[320px] overflow-hidden bg-black">
          {cameraActive ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ transform: `scale(${zoomLevel})` }}
                className="w-full h-full object-cover min-h-[320px] transition-transform duration-200 origin-center"
              />

              {/* High-tech Targeting Overlay for Bangladeshi Front-Facing License Plates & Hood Stickers */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                
                {/* Front Fascia & Plate Bounding Target Box */}
                <div className={cn(
                  "relative w-full max-w-[390px] h-[170px] rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col justify-between p-3",
                  matchedVehicle 
                    ? "border-emerald-400 bg-emerald-500/20 shadow-[0_0_35px_rgba(52,211,153,0.5)]" 
                    : lastDetectedPlate?.detected
                    ? "border-blue-400 bg-blue-500/15 shadow-[0_0_25px_rgba(96,165,250,0.4)]"
                    : "border-emerald-400/80 bg-emerald-500/10 shadow-[0_0_20px_rgba(52,211,153,0.25)]"
                )}>
                  
                  {/* Corner Target Markers */}
                  <div className="absolute -top-1.5 -left-1.5 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg"></div>
                  <div className="absolute -top-1.5 -right-1.5 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg"></div>
                  <div className="absolute -bottom-1.5 -left-1.5 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg"></div>
                  <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg"></div>

                  {/* Animated Laser Scanning Line */}
                  <motion.div
                    className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-300 to-transparent shadow-[0_0_15px_#34d399]"
                    animate={{ top: ['6%', '90%', '6%'] }}
                    transition={{ duration: motionSpeedMode === 'fast' ? 1.2 : 2.0, repeat: Infinity, ease: 'easeInOut' }}
                  />

                  {/* Guide text inside box */}
                  <div className="flex justify-between items-center text-[10px] text-emerald-300 font-mono font-bold tracking-wider">
                    <span className="flex items-center gap-1">
                      <Activity size={12} className="animate-pulse text-emerald-400" />
                      FRONT VEHICLE OCR
                    </span>
                    <span className="bg-emerald-950/90 px-2 py-0.5 rounded border border-emerald-500/50">
                      BRTA BD PLATE
                    </span>
                  </div>

                  <div className="text-center">
                    <div className="font-black text-sm text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                      {matchedVehicle 
                        ? `✓ গাড়ি ডিটেক্ট হয়েছে: ${matchedVehicle.vehicleNumber}` 
                        : lastDetectedPlate?.plateTextBangla 
                        ? `প্লেট: ${lastDetectedPlate.plateTextBangla}`
                        : "গাড়ির সামনের অংশ (হুড / বনেট / বাম্পার / প্লেট) সোজা রাখুন"}
                    </div>
                    <div className="text-[11px] text-emerald-200 font-medium drop-shadow-md mt-0.5">
                      {matchedVehicle 
                        ? `স্ট্যাটাস: ${matchedVehicle.status}` 
                        : "যেমন: ঢাকা মেট্রো-ম ১১-৮৭৫৭ / উ, ঊ, ন, ট, ড, ১২৩৪৫৬"}
                    </div>
                  </div>

                  {/* Bottom Sub-tag inside viewfinder */}
                  <div className="flex justify-between items-center text-[9px] text-emerald-300/90 font-mono">
                    <span>চলন্ত গাড়ি অটো রিড</span>
                    <span>AI AUTO-DETECT LIVE</span>
                  </div>
                </div>

                {/* Subtitle / Mode Indicator */}
                <div className="mt-3 px-3.5 py-1 rounded-full bg-black/75 backdrop-blur-xs text-[11px] text-slate-200 flex items-center gap-2 border border-white/10 shadow-lg">
                  <Scan size={13} className="text-emerald-400 animate-spin" style={{ animationDuration: '3s' }} />
                  <span>
                    {isProcessing 
                      ? 'এআই ফ্রেম বিশ্লেষণ করছে...' 
                      : isContinuousAutoScan 
                      ? 'ক্যামেরার সামনে গাড়ি আসলেই স্বয়ংক্রিয়ভাবে ডিটেক্ট হবে'
                      : 'ম্যানুয়াল স্ক্যান মোড সক্রিয়'}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-slate-400 space-y-3">
              <Camera size={44} className="mx-auto text-slate-600 animate-pulse" />
              <div>
                <p className="text-sm font-bold text-slate-200">ক্যামেরা বর্তমানে বন্ধ রয়েছে</p>
                <p className="text-xs text-slate-500 mt-0.5">সব সময় ক্যামেরা খোলা রেখে লাইভ গাড়ি স্ক্যান করতে নিচের বাটনে চাপুন</p>
              </div>
              <button
                type="button"
                onClick={startCamera}
                disabled={cameraLoading}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all cursor-pointer flex items-center gap-2 mx-auto"
              >
                <Camera size={16} />
                <span>ক্যামেরা চালু করুন (Start Live Camera)</span>
              </button>
            </div>
          )}
        </div>

        {/* Error message banner */}
        {cameraError && (
          <div className="p-3 bg-red-950/90 border-t border-red-800 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="text-red-400 shrink-0" />
            <span>{cameraError}</span>
          </div>
        )}

        {/* Feedback message banner if scan didn't detect plate */}
        {scanFeedbackMsg && (
          <div className="p-3 bg-amber-950/95 border-t border-amber-700 text-amber-200 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="text-amber-400 shrink-0" />
              <span>{scanFeedbackMsg}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setScanFeedbackMsg(null)}
              className="text-amber-400 hover:text-amber-200 p-1 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Bottom Control Actions */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
          {/* Continuous auto-scan toggle */}
          <button
            type="button"
            onClick={() => setIsContinuousAutoScan(!isContinuousAutoScan)}
            className={cn(
              "px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border",
              isContinuousAutoScan 
                ? "bg-emerald-950/70 border-emerald-500/60 text-emerald-300 shadow-xs" 
                : "bg-slate-800 border-slate-700 text-slate-400"
            )}
          >
            <Zap size={14} className={isContinuousAutoScan ? "text-emerald-400 fill-emerald-400" : "text-slate-400"} />
            <span>অটো-ডিটেক্ট: {isContinuousAutoScan ? 'চালু (Active)' : 'বন্ধ'}</span>
          </button>

          {/* Manual Snapshot Scan Button */}
          <button
            type="button"
            disabled={!cameraActive || isProcessing}
            onClick={() => performPlateScan(undefined, true)}
            className={cn(
              "flex-1 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer",
              isProcessing
                ? "bg-slate-700 cursor-not-allowed opacity-80"
                : (isEmerald ? "bg-[#2ea884] hover:bg-[#258b6d]" : isCrimson ? "bg-[#ea2340] hover:bg-[#c91832]" : isAmber ? "bg-[#f59e0b] hover:bg-[#d97706] text-slate-950" : "bg-blue-600 hover:bg-blue-500")
            )}
          >
            <Sparkles size={15} className={isProcessing ? "animate-spin" : ""} />
            <span>{isProcessing ? 'নাম্বার প্লেট স্ক্যান হচ্ছে...' : 'এখনই স্ক্যান করুন (Capture Now)'}</span>
          </button>

          {/* Camera Restart/Stop Button */}
          <button
            type="button"
            onClick={cameraActive ? stopCamera : startCamera}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer border border-slate-700"
            title={cameraActive ? "ক্যামেরা পজ/বন্ধ করুন" : "ক্যামেরা চালু করুন"}
          >
            <RefreshCw size={15} className={cameraLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Success Notification Bar */}
      {actionSuccessMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs"
        >
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </motion.div>
      )}

      {/* Detected Plate Recognition & Matched Vehicle Dashboard Card */}
      {lastDetectedPlate && lastDetectedPlate.detected && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl border-2 border-emerald-500/40 shadow-lg p-4 space-y-3.5"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <ShieldCheck size={16} />
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-800">
                  সনাক্তকৃত নাম্বার প্লেট (Detected License Plate)
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">
                  সময়: {detectionTimestamp}
                </span>
              </div>
            </div>

            {matchedVehicle ? (
              <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 size={12} />
                <span>ফ্লিট ডেটাবেসে ম্যাচ হয়েছে</span>
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                অনিবন্ধিত প্লেট
              </span>
            )}
          </div>

          {/* Bangladeshi License Plate Styled Visual Box */}
          <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-700 shadow-inner flex flex-col items-center justify-center space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-400 tracking-wider">
              <span>{lastDetectedPlate.metroOrDistrict || 'ঢাকা মেট্রো'}</span>
              {lastDetectedPlate.vehicleClass && (
                <span className="bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/40 text-emerald-300">
                  {lastDetectedPlate.vehicleClass} = {BANGLA_TO_ENG_CLASS_MAP[lastDetectedPlate.vehicleClass] || lastDetectedPlate.vehicleClassEng || lastDetectedPlate.vehicleClass}
                </span>
              )}
            </div>
            
            <div className="text-xl sm:text-2xl font-black text-white font-mono tracking-widest bg-slate-800/80 px-4 py-1 rounded-lg border border-slate-600">
              {lastDetectedPlate.plateTextBangla || lastDetectedPlate.plateTextStandard || 'প্লেট নম্বর'}
            </div>

            {/* Translated English Plate Code Badge */}
            <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-mono">
              <span className="bg-blue-950/70 border border-blue-500/40 text-blue-300 font-bold px-2.5 py-0.5 rounded-md">
                ENG: {lastDetectedPlate.plateTextEnglish || translateBanglaPlateToEnglish(lastDetectedPlate.plateTextBangla || '')}
              </span>
              {lastDetectedPlate.rawSixDigits && (
                <span className="text-slate-400 text-[10px]">
                  • 6-Digits: {lastDetectedPlate.rawSixDigits}
                </span>
              )}
            </div>

            {/* ANPR Intelligence Metadata Pills */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1 text-[10px]">
              {lastDetectedPlate.vehicle_type && (
                <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 font-semibold uppercase">
                  ধরন: {lastDetectedPlate.vehicle_type}
                </span>
              )}
              <span className="px-2 py-0.5 rounded border font-semibold bg-emerald-950/80 text-emerald-400 border-emerald-500/40">
                কনফিডেন্স: {lastDetectedPlate.confidence_level ? lastDetectedPlate.confidence_level.toUpperCase() : `${Math.round((lastDetectedPlate.confidence || 0.9) * 100)}%`}
              </span>
            </div>

            {/* Notes if any */}
            {lastDetectedPlate.notes && (
              <p className="text-[10px] text-amber-300/90 text-center italic pt-0.5">
                পর্যবেক্ষণ: {lastDetectedPlate.notes}
              </p>
            )}
          </div>

          {/* Matched Vehicle Card & Direct In/Out Actions */}
          {matchedVehicle ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    "p-2.5 rounded-xl",
                    matchedVehicle.status === 'Available' ? "bg-emerald-100 text-emerald-700" :
                    matchedVehicle.status === 'On Trip' ? "bg-blue-100 text-blue-700" :
                    matchedVehicle.status === 'Pending Out Scan' ? "bg-amber-100 text-amber-700" :
                    "bg-slate-200 text-slate-700"
                  )}>
                    <Truck size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 font-mono">
                      {matchedVehicle.vehicleNumber}
                    </h3>
                    <p className="text-xs text-slate-500">
                      মডেল: <strong className="text-slate-700">{matchedVehicle.type || matchedVehicle.model || 'Commercial'}</strong> • ড্রাইভার: <span className="text-slate-600">{matchedVehicle.driverName || 'অনির্ধারিত'}</span>
                    </p>
                  </div>
                </div>

                <span className={cn(
                  "text-[10px] font-black px-2.5 py-1 rounded-full uppercase border shrink-0",
                  matchedVehicle.status === 'Available' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  matchedVehicle.status === 'On Trip' ? "bg-blue-50 text-blue-700 border-blue-200" :
                  matchedVehicle.status === 'Pending Out Scan' ? "bg-amber-50 text-amber-700 border-amber-200" :
                  "bg-rose-50 text-rose-700 border-rose-200"
                )}>
                  {matchedVehicle.status}
                </span>
              </div>

              {/* Direct Instant Gate IN / OUT Action Buttons */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="font-bold">সরাসরি গেট অপারেশন (Direct Gate Action):</span>
                  {autoGateCountdown !== null && (
                    <span className="text-emerald-700 font-mono font-bold animate-pulse text-[11px]">
                      অটো অ্যাকশন: {autoGateCountdown}s ...
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Gate OUT Button */}
                  <button
                    type="button"
                    disabled={directActionExecuting}
                    onClick={() => handleExecuteDirectGateAction('OUT')}
                    className={cn(
                      "py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer",
                      matchedVehicle.status === 'On Trip'
                        ? "bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200"
                    )}
                  >
                    <LogOut size={16} />
                    <span>গেট আউট (Gate Out)</span>
                  </button>

                  {/* Gate IN Button */}
                  <button
                    type="button"
                    disabled={directActionExecuting}
                    onClick={() => handleExecuteDirectGateAction('IN')}
                    className={cn(
                      "py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer",
                      matchedVehicle.status === 'On Trip'
                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200"
                        : "bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200"
                    )}
                  >
                    <LogIn size={16} />
                    <span>গেট ইন (Gate In)</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs space-y-1">
              <p className="font-bold">
                ⚠️ এই প্লেটের গাড়িটি সিস্টেমে এখনো নিবন্ধিত নয় ({lastDetectedPlate.plateTextBangla})।
              </p>
              <p className="text-[11px] text-amber-700">
                আপনি Vehicle Management মেনু থেকে এই গাড়িটি নিবন্ধন করতে পারেন অথবা নিচে সরাসরি গাড়ি সিলেক্ট করুন।
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Quick Search & Select Vehicle Fallback Bar */}
      <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 text-white space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-300 flex items-center gap-1.5">
            <Search size={14} className="text-emerald-400" />
            দ্রুত গাড়ি নির্বাচন (নাম্বার বা শেষ ৪ সংখ্যা লিখে খুঁজুন):
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            মোট গাড়ি: {vehicles.length}
          </span>
        </div>

        {/* Input */}
        <div className="relative">
          <input
            type="text"
            value={quickQuery}
            onChange={(e) => setQuickQuery(e.target.value)}
            placeholder="যেমন: 8757 বা ঢাকা মেট্রো-ম..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
          />
          {quickQuery && (
            <button
              type="button"
              onClick={() => setQuickQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Quick vehicle chips */}
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-1">
          {filteredQuickVehicles.map(v => (
            <button
              key={v.id}
              type="button"
              onClick={() => handleSelectQuickVehicle(v)}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer flex items-center gap-1.5",
                matchedVehicle?.id === v.id
                  ? "bg-emerald-600 border-emerald-400 text-white shadow-sm"
                  : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
              )}
            >
              <Truck size={12} className={v.status === 'On Trip' ? "text-blue-400" : "text-emerald-400"} />
              <span>{v.vehicleNumber}</span>
              <span className={cn(
                "text-[9px] px-1 py-0.2 rounded font-sans",
                v.status === 'On Trip' ? "bg-blue-900 text-blue-200" : "bg-emerald-900 text-emerald-200"
              )}>
                {v.status === 'On Trip' ? 'On Trip' : 'Avail'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
