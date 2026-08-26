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
  Sliders, 
  ShieldCheck,
  RotateCw,
  LogOut,
  LogIn,
  Wrench,
  Clock,
  Eye,
  Flashlight,
  Activity,
  Gauge
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlateScanData, 
  matchVehicleFromDatabase, 
  formatBanglaPlateDisplay, 
  playScanSuccessSound,
  convertBanglaToEngDigits,
  convertEngToBanglaDigits,
  translateBanglaPlateToEnglish,
  translateEnglishPlateToBangla,
  BANGLA_TO_ENG_CLASS_MAP
} from '../lib/anpr';
import { cn } from '../lib/utils';
import { useTheme } from '../ThemeContext';

interface LivePlateCameraScannerProps {
  vehicles: any[];
  trips: any[];
  onVehicleMatched: (vehicle: any, action: 'IN' | 'OUT', plateData?: PlateScanData) => void;
  onDirectGateIn?: (vehicle: any) => Promise<void>;
  onDirectGateOut?: (vehicle: any) => Promise<void>;
  canManage: boolean;
}

export const LivePlateCameraScanner: React.FC<LivePlateCameraScannerProps> = ({
  vehicles,
  trips,
  onVehicleMatched,
  onDirectGateIn,
  onDirectGateOut,
  canManage
}) => {
  const { isEmerald, isCrimson, isAmber } = useTheme();
  
  // Camera stream & video refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Scanner States
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isContinuousAutoScan, setIsContinuousAutoScan] = useState<boolean>(true);
  const [motionSpeedMode, setMotionSpeedMode] = useState<'fast' | 'normal'>('fast');
  const [torchActive, setTorchActive] = useState<boolean>(false);
  const [hasTorchSupport, setHasTorchSupport] = useState<boolean>(false);
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

  // Stop camera stream cleanly
  const stopCamera = useCallback(() => {
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

  // Start camera stream (Always-on capability with multi-tier fallback)
  const startCamera = useCallback(async () => {
    setCameraLoading(true);
    setCameraError(null);

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
        // Tier 2: Try basic video without facingMode constraint (essential for desktop/laptop/single webcams)
        console.warn("Primary camera constraints unavailable, attempting fallback to default video device...", tier1Err);
        try {
          newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (tier2Err) {
          throw tier2Err;
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
          videoRef.current.play().catch(e => console.warn("Video play notice:", e));
        }
        setCameraActive(true);
      }
    } catch (err: any) {
      console.warn("Camera device initialization note:", err?.name || err?.message || err);
      let msg = "ক্যামেরা চালু করা সম্ভব হয়নি।";
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        msg = "ক্যামেরা ব্যবহারের অনুমতি দেওয়া হয়নি (Permission Denied)। অনুগ্রহ করে ব্রাউজারে ক্যামেরা পারমিশন এলাউ করুন অথবা ছবি আপলোড করুন।";
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError' || String(err?.message || '').toLowerCase().includes('not found')) {
        msg = "কোনো সংযুক্ত ক্যামেরা ডিভাইস পাওয়া যায়নি (Camera not found)। আপনি নিচের 'ছবি আপলোড' বা 'ম্যানুয়াল সার্চ' অপশন ব্যবহার করতে পারেন।";
      } else if (err?.message === 'NOT_SUPPORTED') {
        msg = "আপনার বর্তমান ব্রাউজারে ক্যামেরা অ্যাক্সেস সাপোর্ট করে না। অনুগ্রহ করে ছবি আপলোড অথবা ম্যানুয়াল সার্চ ব্যবহার করুন।";
      } else {
        msg = "ক্যামেরা সংযোগে সমস্যা হচ্ছে। অনুগ্রহ করে নিচে ছবি আপলোড করুন অথবা ম্যানুয়াল সার্চ ব্যবহার করুন।";
      }
      setCameraError(msg);
      setCameraActive(false);
    } finally {
      setCameraLoading(false);
    }
  }, [facingMode, stream]);

  // Auto-start camera on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []); // Run on mount

  // Flip camera between front and back
  const toggleFacingMode = () => {
    stopCamera();
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  useEffect(() => {
    if (!cameraActive && !cameraLoading && !cameraError) {
      startCamera();
    }
  }, [facingMode]);

  // Capture current frame from video with motion optimization & dynamic scaling
  const captureFrameBase64 = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    // Scale to max width/height 1024 for lightning-fast recognition
    const maxDim = Math.max(video.videoWidth, video.videoHeight);
    const scale = maxDim > 1024 ? 1024 / maxDim : 1;
    const targetW = Math.round(video.videoWidth * scale);
    const targetH = Math.round(video.videoHeight * scale);

    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, targetW, targetH);
    return canvas.toDataURL('image/jpeg', 0.84);
  };

  // Perform AI Plate Scan API Call
  const performPlateScan = async (imageSrc?: string) => {
    if (isProcessing) return;
    const base64Img = imageSrc || captureFrameBase64();
    if (!base64Img) return;

    setIsProcessing(true);
    setCameraError(null);

    try {
      const payload = {
        image: base64Img,
        registeredVehicles: vehicles.map(v => ({
          vehicleNumber: v.vehicleNumber,
          type: v.type || v.model || ''
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

        // Match with fleet vehicles
        const matched = matchVehicleFromDatabase(plateData, vehicles);
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
      }
    } catch (err: any) {
      console.warn("ANPR scan error:", err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Auto-scan timer interval for continuous recognition (Fast Motion: 1.4s, Standard: 2.6s)
  useEffect(() => {
    let intervalId: any = null;
    if (cameraActive && isContinuousAutoScan && !isProcessing && !autoGateCountdown) {
      const intervalMs = motionSpeedMode === 'fast' ? 1400 : 2600;
      intervalId = setInterval(() => {
        performPlateScan();
      }, intervalMs);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [cameraActive, isContinuousAutoScan, isProcessing, autoGateCountdown, motionSpeedMode, vehicles]);

  // Auto gate countdown timer
  useEffect(() => {
    let timer: any = null;
    if (autoGateCountdown !== null && autoGateCountdown > 0) {
      timer = setTimeout(() => {
        setAutoGateCountdown(autoGateCountdown - 1);
      }, 1000);
    } else if (autoGateCountdown === 0 && matchedVehicle) {
      // Execute automatic gate action!
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

  // Handle image upload from gallery/device
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        performPlateScan(base64);
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
        <div className="absolute top-0 left-0 right-0 z-20 p-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between text-white">
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
              <span className="text-[10px] bg-blue-500/80 text-white font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                <Sparkles size={10} /> এআই বিশ্লেষণ হচ্ছে...
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
                "px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 border",
                motionSpeedMode === 'fast'
                  ? "bg-amber-500/30 text-amber-300 border-amber-400/50 shadow-xs"
                  : "bg-black/40 text-slate-400 border-white/10"
              )}
              title="চলন্ত গাড়ির স্পিড মোড পরিবর্তন"
            >
              <Gauge size={13} className={motionSpeedMode === 'fast' ? "text-amber-400 animate-pulse" : ""} />
              <span>{motionSpeedMode === 'fast' ? 'চলন্ত গাড়ি মোড (Fast 1.4s)' : 'স্ট্যান্ডার্ড (2.6s)'}</span>
            </button>

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
              title="ছবি আপলোড করুন"
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
                className="w-full h-full object-cover min-h-[320px]"
              />

              {/* High-tech Targeting Overlay for Bangladeshi Front-Facing License Plates & Hood Stickers */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                
                {/* Front Fascia & Plate Bounding Target Box */}
                <div className="relative w-full max-w-[380px] h-[160px] rounded-2xl border-2 border-dashed border-emerald-400/90 bg-emerald-500/10 shadow-[0_0_25px_rgba(52,211,153,0.3)] flex flex-col justify-between p-3">
                  
                  {/* Corner Target Markers */}
                  <div className="absolute -top-1.5 -left-1.5 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg"></div>
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg"></div>
                  <div className="absolute -bottom-1.5 -left-1.5 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg"></div>
                  <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg"></div>

                  {/* Animated Laser Scanning Line */}
                  <motion.div
                    className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-300 to-transparent shadow-[0_0_15px_#34d399]"
                    animate={{ top: ['8%', '88%', '8%'] }}
                    transition={{ duration: motionSpeedMode === 'fast' ? 1.4 : 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  />

                  {/* Guide text inside box */}
                  <div className="flex justify-between items-center text-[10px] text-emerald-300 font-mono font-bold tracking-wider">
                    <span className="flex items-center gap-1">
                      <Activity size={12} className="animate-pulse text-emerald-400" />
                      FRONT VEHICLE OCR
                    </span>
                    <span className="bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                      BRTA BD PLATE
                    </span>
                  </div>

                  <div className="text-center">
                    <div className="font-black text-sm text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                      গাড়ির সামনের অংশ (হুড / বনেট / বাম্পার / প্লেট) ফ্রেমের ভিতরে রাখুন
                    </div>
                    <div className="text-[11px] text-emerald-200 font-medium drop-shadow-md mt-0.5">
                      যেমন: ঢাকা মেট্রো-ম ১১-৮৭৫৭ / উ, ঊ, ন, ট, ড, ১২৩৪৫৬
                    </div>
                  </div>

                  {/* Bottom Sub-tag inside viewfinder */}
                  <div className="flex justify-between items-center text-[9px] text-emerald-300/80 font-mono">
                    <span>চলন্ত গাড়ি অটো রিড</span>
                    <span>AI FAST DETECT</span>
                  </div>
                </div>

                {/* Subtitle / Mode Indicator */}
                <div className="mt-3 px-3 py-1 rounded-full bg-black/70 backdrop-blur-xs text-[11px] text-slate-200 flex items-center gap-2 border border-white/10 shadow-lg">
                  <Scan size={13} className="text-emerald-400 animate-spin" style={{ animationDuration: '4s' }} />
                  <span>চলন্ত গাড়ির সামনের বাংলা ও ইংরেজি নাম্বার স্বয়ংক্রিয়ভাবে শনাক্ত হচ্ছে</span>
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
          <div className="p-3 bg-red-950/80 border-t border-red-800 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="text-red-400 shrink-0" />
            <span>{cameraError}</span>
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
                ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-400 shadow-xs" 
                : "bg-slate-800 border-slate-700 text-slate-400"
            )}
          >
            <Zap size={14} className={isContinuousAutoScan ? "text-emerald-400 fill-emerald-400" : "text-slate-400"} />
            <span>অটো-স্ক্যান: {isContinuousAutoScan ? 'চালু (Always On)' : 'বন্ধ'}</span>
          </button>

          {/* Manual Snapshot Scan Button */}
          <button
            type="button"
            disabled={!cameraActive || isProcessing}
            onClick={() => performPlateScan()}
            className={cn(
              "flex-1 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer",
              isProcessing
                ? "bg-slate-700 cursor-not-allowed opacity-80"
                : (isEmerald ? "bg-[#2ea884] hover:bg-[#258b6d]" : isCrimson ? "bg-[#ea2340] hover:bg-[#c91832]" : isAmber ? "bg-[#f59e0b] hover:bg-[#d97706] text-slate-950" : "bg-blue-600 hover:bg-blue-500")
            )}
          >
            <Sparkles size={15} className={isProcessing ? "animate-spin" : ""} />
            <span>{isProcessing ? 'নাম্বার প্লেট স্ক্যান হচ্ছে...' : 'এখনই স্ক্যান করুন (Capture Plate)'}</span>
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
          className="bg-white rounded-2xl border-2 border-blue-500/30 shadow-lg p-4 space-y-3.5"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
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
                <span>ডাটাবেসে ম্যাচ হয়েছে</span>
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

            {/* Translated English Plate Code Badge (e.g. DM-MA 11-2233, DM-U 123456, DM-AU 11-0099, DM-N 12-3456) */}
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
                ⚠️ এই প্লেটের গাড়িটি সিস্টেমে এখনো নিবন্ধিত নয়।
              </p>
              <p className="text-[11px] text-amber-700">
                আপনি Vehicle Management সেকশন থেকে গাড়িটি নতুন হিসেবে নিবন্ধন করতে পারেন।
              </p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};
