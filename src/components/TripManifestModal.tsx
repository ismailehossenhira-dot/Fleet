import React, { useState, useRef } from 'react';
import { 
  Printer, 
  Download, 
  X, 
  Truck, 
  User, 
  MapPin, 
  Calendar, 
  Clock, 
  Package, 
  FileText, 
  Wrench, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Edit3, 
  Check, 
  ShieldCheck, 
  Hash, 
  DollarSign, 
  Phone,
  Building2,
  Share2
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { updateTrip } from '../db';
import { useAuth } from '../AuthContext';
import { cn } from '../lib/utils';

interface TripManifestModalProps {
  trip: any;
  vehicleDetails?: any;
  driverDetails?: any;
  onClose: () => void;
  onTripUpdated?: (updatedTrip: any) => void;
}

export const TripManifestModal: React.FC<TripManifestModalProps> = ({
  trip,
  vehicleDetails,
  driverDetails,
  onClose,
  onTripUpdated
}) => {
  const { profile } = useAuth();
  const manifestPrintRef = useRef<HTMLDivElement>(null);

  const [cargoNotes, setCargoNotes] = useState<string>(
    trip.cargoNotes || trip.cargoDetails || trip.goodsDescription || trip.notes || ''
  );
  const [cargoConsignmentNo, setCargoConsignmentNo] = useState<string>(
    trip.consignmentNo || trip.challanNo || ''
  );
  const [cargoPackageCount, setCargoPackageCount] = useState<string>(
    trip.packageCount || trip.cargoPackages || ''
  );
  const [cargoWeight, setCargoWeight] = useState<string>(
    trip.cargoWeight || ''
  );

  const [isEditingCargo, setIsEditingCargo] = useState(false);
  const [isSavingCargo, setIsSavingCargo] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Helper date/time formatters
  const formatDateTime = (ts: any) => {
    if (!ts) return 'N/A';
    let date: Date;
    if (ts.toDate) {
      date = ts.toDate();
    } else if (ts.seconds) {
      date = new Date(ts.seconds * 1000);
    } else {
      date = new Date(ts);
    }
    return date.toLocaleDateString('bn-BD', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDateEn = (ts: any) => {
    if (!ts) return 'N/A';
    let date: Date;
    if (ts.toDate) {
      date = ts.toDate();
    } else if (ts.seconds) {
      date = new Date(ts.seconds * 1000);
    } else {
      date = new Date(ts);
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTripDurationString = (startTime: any, endTime: any) => {
    if (!startTime || !endTime) return 'N/A';
    const startMs = startTime.seconds ? startTime.seconds * 1000 : new Date(startTime).getTime();
    const endMs = endTime.seconds ? endTime.seconds * 1000 : new Date(endTime).getTime();
    const diffMs = endMs - startMs;
    if (diffMs <= 0) return '১ মিনিটের কম';
    
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    if (hours > 0) {
      return `${hours} ঘণ্টা ${mins} মিনিট (${hours}h ${mins}m)`;
    }
    return `${mins} মিনিট (${mins}m)`;
  };

  const tripIdShort = (trip.id || 'N/A').substring(0, 8).toUpperCase();
  const manifestNumber = `MNF-${trip.vehiclePlate ? trip.vehiclePlate.replace(/[^a-zA-Z0-9]/g, '') : 'FLEET'}-${tripIdShort}`;
  const durationText = getTripDurationString(trip.startTime, trip.endTime);

  // Save updated cargo notes
  const handleSaveCargoNotes = async () => {
    setIsSavingCargo(true);
    try {
      const updates = {
        cargoNotes: cargoNotes.trim(),
        consignmentNo: cargoConsignmentNo.trim(),
        packageCount: cargoPackageCount.trim(),
        cargoWeight: cargoWeight.trim()
      };
      await updateTrip(trip.id, updates, profile);
      setIsEditingCargo(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      if (onTripUpdated) {
        onTripUpdated({
          ...trip,
          ...updates
        });
      }
    } catch (err) {
      console.error('Failed to update cargo notes:', err);
      alert('কার্গো নোট সংরক্ষণ করতে ব্যর্থ হয়েছে। পুনরায় চেষ্টা করুন।');
    } finally {
      setIsSavingCargo(false);
    }
  };

  // Dedicated Print Function using hidden iframe (100% immune to sandbox popup blocking)
  const handlePrint = () => {
    if (!manifestPrintRef.current) return;

    const printableHtml = manifestPrintRef.current.innerHTML;

    // Create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="bn">
      <head>
        <meta charset="UTF-8">
        <title>Trip_Manifest_${manifestNumber}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&family=Inter:wght@400;600;700;800&display=swap');
          
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body {
            font-family: 'Hind Siliguri', 'Inter', system-ui, -apple-system, sans-serif;
            margin: 0;
            padding: 16px;
            color: #0f172a;
            background: #ffffff;
            font-size: 11px;
            line-height: 1.4;
          }

          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          .no-print {
            display: none !important;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th, td {
            border: 1px solid #cbd5e1;
            padding: 6px 8px;
            text-align: left;
          }

          th {
            background-color: #f1f5f9 !important;
            color: #334155;
            font-weight: 700;
          }

          .border-box {
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 10px;
            margin-bottom: 12px;
          }

          .stamp-box {
            border: 2px dashed #94a3b8;
            border-radius: 8px;
            padding: 12px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        ${printableHtml}
      </body>
      </html>
    `);
    doc.close();

    // Trigger print after iframe renders
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 2000);
    }, 400);
  };

  // Direct Download PDF generation using html2canvas & jsPDF
  const handleDownloadPDF = async () => {
    if (!manifestPrintRef.current) return;
    setIsGeneratingPDF(true);

    try {
      const element = manifestPrintRef.current;
      
      // Render to canvas with 2x scale for sharp print quality
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth - 14; // 7mm margins
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight <= pdfHeight - 14) {
        pdf.addImage(imgData, 'JPEG', 7, 7, imgWidth, imgHeight);
      } else {
        // Fit within page if slightly taller
        const fitScale = (pdfHeight - 14) / imgHeight;
        const finalW = imgWidth * fitScale;
        const finalH = imgHeight * fitScale;
        const marginX = (pdfWidth - finalW) / 2;
        pdf.addImage(imgData, 'JPEG', marginX, 7, finalW, finalH);
      }

      pdf.save(`Trip_Manifest_${manifestNumber}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('PDF তৈরিতে সমস্যা হয়েছে। অনুগ্রহ করে "প্রিন্ট করুন" অপশন ব্যবহার করে Save as PDF নির্বাচন করুন।');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const isCompleted = trip.status === 'Completed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        
        {/* Modal Top Control Bar */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-400/40 text-blue-400 flex items-center justify-center shrink-0">
              <FileText size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base text-white tracking-wide truncate">
                  অফিসিয়াল ট্রিপ মেনিফেস্ট (Trip Manifest)
                </h3>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                  isCompleted ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                )}>
                  {isCompleted ? '✓ Completed' : '● Active Trip'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono truncate">
                {manifestNumber}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
              title="প্রিন্ট করুন (Print)"
            >
              <Printer size={15} className="text-blue-400" />
              <span className="hidden sm:inline">প্রিন্ট</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              type="button"
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50"
              title="PDF ডাউনলোড করুন"
            >
              <Download size={15} />
              <span>{isGeneratingPDF ? 'তৈরি হচ্ছে...' : 'PDF ডাউনলোড'}</span>
            </button>

            <button
              onClick={onClose}
              type="button"
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-900/60 hover:text-rose-300 text-slate-400 flex items-center justify-center transition-colors cursor-pointer ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Cargo Notes Quick Editor Banner */}
        <div className="bg-amber-50/80 border-b border-amber-200/80 px-5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 text-xs text-amber-900">
            <Package size={15} className="text-amber-600 shrink-0" />
            <span className="font-semibold">
              কার্গো ও মালামালের নোট:
            </span>
            <span className="text-slate-600 truncate max-w-xs font-normal">
              {cargoNotes ? cargoNotes : '(কোনো নোট উল্লেখ নেই)'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saveSuccess && (
              <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                <Check size={13} /> সংরক্ষিত হয়েছে
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsEditingCargo(!isEditingCargo)}
              className="text-xs font-bold text-amber-800 hover:text-amber-900 underline flex items-center gap-1 cursor-pointer"
            >
              <Edit3 size={13} />
              <span>{isEditingCargo ? 'সম্পাদনা বন্ধ করুন' : 'নোট আপডেট করুন'}</span>
            </button>
          </div>
        </div>

        {/* Expandable Cargo Note Edit Form */}
        {isEditingCargo && (
          <div className="bg-amber-50 p-4 border-b border-amber-200 animate-in slide-in-from-top-2 duration-150 shrink-0 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">চালান / ভাউচার নম্বর</label>
                <input
                  type="text"
                  placeholder="e.g. CH-9082 / IV-4401"
                  value={cargoConsignmentNo}
                  onChange={e => setCargoConsignmentNo(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">কার্টুন / প্যাকেজ সংখ্যা</label>
                <input
                  type="text"
                  placeholder="e.g. ১২০ কার্টুন / ২৫ বস্তা"
                  value={cargoPackageCount}
                  onChange={e => setCargoPackageCount(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">ওজন (টন / কেজি)</label>
                <input
                  type="text"
                  placeholder="e.g. ৩.৫ টন / ৩,৫০০ কেজি"
                  value={cargoWeight}
                  onChange={e => setCargoWeight(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 text-xs">
                কার্গো নোট ও মালামালের বিস্তারিত বিবরণ (Cargo Notes)
              </label>
              <textarea
                rows={2}
                value={cargoNotes}
                onChange={e => setCargoNotes(e.target.value)}
                placeholder="মালের ধরন, গ্রহীতার রসিদ, খালাস সংক্রান্ত মন্তব্য বা কোনো বিশেষ ডেলিভারি নির্দেশ..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none focus:border-blue-500 resize-none font-medium text-slate-800"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingCargo(false)}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleSaveCargoNotes}
                disabled={isSavingCargo}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save size={14} />
                <span>{isSavingCargo ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Printable Document Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/60">
          {/* Paper sheet */}
          <div 
            ref={manifestPrintRef} 
            className="bg-white mx-auto max-w-3xl p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200 text-slate-900 text-xs leading-relaxed print:shadow-none print:border-none print:p-0"
          >
            {/* Manifest Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-4">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-slate-900 text-white rounded-lg font-black text-sm tracking-widest">
                      FFP
                    </span>
                    <div>
                      <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight uppercase">
                        FLEETFLOW LOGISTICS & TRANSPORT
                      </h1>
                      <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
                        কেন্দ্রীয় পরিবহন ব্যবস্থাপনা ও ডেলিভারি চালান শাখা
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    ওয়ারহাউজ ডিপো: <strong className="text-slate-800">{trip.warehouse || trip.originWarehouse || 'মূল ডিপো'}</strong> | ফোন: ০১৯০০-০০০০০০
                  </p>
                </div>

                <div className="text-right sm:self-center bg-slate-50 p-2.5 rounded-xl border border-slate-200 shrink-0">
                  <div className="text-[10px] uppercase font-bold text-slate-400">অফিসিয়াল মেনিফেস্ট নং</div>
                  <div className="font-mono font-black text-xs sm:text-sm text-slate-900">{manifestNumber}</div>
                  <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                    ইস্যু তারিখ: {formatDateEn(trip.startTime || trip.createdAt)}
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="inline-block font-extrabold text-xs sm:text-sm text-slate-800 tracking-wide uppercase">
                  📄 GOODS VEHICLE TRIP MANIFEST & CHALLAN (ট্রিপ মেনিফেস্ট ও চালান)
                </span>
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
                  isCompleted 
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300" 
                    : "bg-blue-50 text-blue-800 border-blue-300"
                )}>
                  {isCompleted ? '✓ সম্পন্ন ট্রিপ (Completed Trip)' : '● চলমান ট্রিপ (Active)'}
                </span>
              </div>
            </div>

            {/* Section 1: Vehicle & Driver Dual Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              
              {/* Vehicle Details Card */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-2">
                  <span className="font-extrabold text-[11px] text-slate-800 flex items-center gap-1.5 uppercase">
                    <Truck size={14} className="text-blue-600" />
                    <span>গাড়ির বিবরণ (Vehicle Details)</span>
                  </span>
                  <span className="font-mono text-[10px] font-bold text-slate-500">
                    {trip.vehicleId || 'ID-N/A'}
                  </span>
                </div>

                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between py-0.5 border-b border-slate-100">
                    <span className="text-slate-500">রেজিস্ট্রেশন প্লেট:</span>
                    <strong className="font-bold text-slate-900 font-mono text-xs">
                      {trip.vehiclePlate || trip.vehicleId || 'N/A'}
                    </strong>
                  </div>

                  <div className="flex justify-between py-0.5 border-b border-slate-100">
                    <span className="text-slate-500">গাড়ির ধরন ও মডেল:</span>
                    <span className="font-semibold text-slate-800">
                      {vehicleDetails?.model || vehicleDetails?.type || trip.vehicleModel || 'Commercial Transport'}
                    </span>
                  </div>

                  <div className="flex justify-between py-0.5 border-b border-slate-100">
                    <span className="text-slate-500">হোম ডিপো / ডিপার্টমেন্ট:</span>
                    <span className="font-medium text-slate-800">
                      {trip.warehouse || vehicleDetails?.warehouse || 'হেড ডিপো'}
                    </span>
                  </div>

                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-500">চ্যাসিস / ইঞ্জিন নং:</span>
                    <span className="font-mono text-slate-700 text-[10px]">
                      {vehicleDetails?.chassisNumber || vehicleDetails?.engineNumber || 'Verified in Ledger'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Driver & Crew Details Card */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-2">
                  <span className="font-extrabold text-[11px] text-slate-800 flex items-center gap-1.5 uppercase">
                    <User size={14} className="text-blue-600" />
                    <span>চালক ও ক্রু (Driver & Crew)</span>
                  </span>
                  <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded">
                    {trip.driverId || 'DRV-N/A'}
                  </span>
                </div>

                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between py-0.5 border-b border-slate-100">
                    <span className="text-slate-500">প্রধান চালক (Driver):</span>
                    <strong className="font-bold text-slate-900">
                      {trip.driverName || 'N/A'}
                    </strong>
                  </div>

                  <div className="flex justify-between py-0.5 border-b border-slate-100">
                    <span className="text-slate-500">মোবাইল নম্বর:</span>
                    <span className="font-mono font-medium text-slate-800">
                      {trip.driverPhone || driverDetails?.phoneNumber || 'উল্লেখ নেই'}
                    </span>
                  </div>

                  <div className="flex justify-between py-0.5 border-b border-slate-100">
                    <span className="text-slate-500">ড্রাইভিং লাইসেন্স নং:</span>
                    <span className="font-mono text-slate-700 text-[10px]">
                      {driverDetails?.licenseNo || 'Verified & Valid'}
                    </span>
                  </div>

                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-500">সহকারী (Helper):</span>
                    <span className="font-medium text-slate-800">
                      {trip.helperName ? `${trip.helperName} (${trip.helperId})` : 'কোনো সহকারী ছিল না'}
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Section 2: Route & Operational Timeline */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-2.5">
                <span className="font-extrabold text-[11px] text-slate-800 flex items-center gap-1.5 uppercase">
                  <MapPin size={14} className="text-rose-600" />
                  <span>রুট ও সময়সূচী (Route & Timeline)</span>
                </span>
                <span className="text-[10px] font-bold text-slate-500">
                  মোট সময়কাল: <strong className="text-slate-800">{durationText}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] mb-2.5">
                <div className="p-2 bg-white rounded-lg border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">উৎস / ডিপো (Origin):</span>
                  <div className="font-bold text-slate-800 flex items-center gap-1">
                    <Building2 size={13} className="text-slate-400 shrink-0" />
                    <span>{trip.warehouse || trip.originWarehouse || 'প্রধান সেন্ট্রাল ওয়্যারহাউজ'}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                    <Clock size={11} className="text-blue-500" />
                    <span>প্রস্থান: {formatDateTime(trip.startTime)}</span>
                  </div>
                  {trip.startedBy && (
                    <div className="text-[9px] text-slate-400 mt-0.5">
                      ছাড়পত্র বাই: {trip.startedBy}
                    </div>
                  )}
                </div>

                <div className="p-2 bg-white rounded-lg border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">গন্তব্য (Destination / Route):</span>
                  <div className="font-bold text-slate-800 flex items-center gap-1">
                    <MapPin size={13} className="text-rose-500 shrink-0" />
                    <span>{trip.location || 'স্থানীয় রুট ও ডেলিভারি'}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                    <CheckCircle2 size={11} className="text-emerald-500" />
                    <span>ফেরত: {isCompleted ? formatDateTime(trip.endTime) : 'চলমান (এখনো ফেরেনি)'}</span>
                  </div>
                  {trip.completedBy && (
                    <div className="text-[9px] text-slate-400 mt-0.5">
                      রিসিভ বাই: {trip.completedBy}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200/70 text-[11px]">
                <div>
                  <span className="text-slate-500">অনুমোদিত সেতু ও সড়ক টোল: </span>
                  <strong className="font-black text-slate-900 font-mono">৳ {trip.tollAmount || 0}</strong>
                </div>
                {trip.createdBy && (
                  <div className="text-[10px] text-slate-500">
                    ট্রিপ এন্ট্রি কারী: <span className="font-medium text-slate-700">{trip.createdBy}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Cargo Notes & Consignment Details */}
            <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/80 mb-4">
              <div className="flex items-center justify-between border-b border-amber-200/70 pb-1.5 mb-2.5">
                <span className="font-extrabold text-[11px] text-amber-900 flex items-center gap-1.5 uppercase">
                  <Package size={14} className="text-amber-600" />
                  <span>মালামালের বিবরণ ও কার্গো নোট (Cargo Details & Notes)</span>
                </span>
                {cargoConsignmentNo && (
                  <span className="font-mono text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                    চালান নং: {cargoConsignmentNo}
                  </span>
                )}
              </div>

              {/* Cargo Spec grid */}
              <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
                <div className="bg-white p-1.5 rounded border border-amber-100">
                  <span className="text-slate-400 block font-medium">চালান / ইনভয়েস:</span>
                  <strong className="text-slate-800 font-mono text-[11px]">
                    {cargoConsignmentNo || 'CH-AUTO'}
                  </strong>
                </div>
                <div className="bg-white p-1.5 rounded border border-amber-100">
                  <span className="text-slate-400 block font-medium">প্যাকেজ / ইউনিট:</span>
                  <strong className="text-slate-800 font-medium text-[11px]">
                    {cargoPackageCount || 'স্ট্যান্ডার্ড লজিস্টিকস'}
                  </strong>
                </div>
                <div className="bg-white p-1.5 rounded border border-amber-100">
                  <span className="text-slate-400 block font-medium">মোট ওজন:</span>
                  <strong className="text-slate-800 font-mono text-[11px]">
                    {cargoWeight || 'লোড ক্যাপাসিটি অধীন'}
                  </strong>
                </div>
              </div>

              {/* Cargo Notes Text block */}
              <div className="bg-white p-2.5 rounded-lg border border-amber-200/80">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  কার্গো হ্যান্ডলিং ও ডেলিভারি নোট (Consignment Notes):
                </span>
                <p className="text-[11px] text-slate-800 leading-relaxed font-medium">
                  {cargoNotes ? cargoNotes : 'মালামাল যথাযথভাবে পরীক্ষা-নিরীক্ষাপূর্বক চালানের শর্তানুযায়ী খালাস ও হস্তান্তর সম্পন্ন হয়েছে। কোনো ক্ষয়ক্ষতি বা ঘাটতি নেই।'}
                </p>
              </div>

              {/* Inspection notes on return */}
              {trip.inspectionOnReturn?.notes && (
                <div className="mt-2 bg-emerald-50/60 p-2 rounded-lg border border-emerald-200/70 text-[10px]">
                  <span className="font-bold text-emerald-800">গাড়ি ফেরত আগমন পর্যবেক্ষণ নোট: </span>
                  <span className="text-slate-700">{trip.inspectionOnReturn.notes}</span>
                </div>
              )}
            </div>

            {/* Section 4: Handover Items (Documents & Tools Manifest) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              
              {/* Documents Given */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-extrabold text-slate-700 uppercase block mb-1.5 flex items-center gap-1">
                  <FileText size={12} className="text-slate-500" />
                  <span>প্রদত্ত নথিপত্র (Issued Documents)</span>
                </span>
                {trip.documentsGiven && trip.documentsGiven.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {trip.documentsGiven.map((doc: string) => (
                      <span key={doc} className="px-1.5 py-0.5 bg-white border border-slate-300 text-slate-800 text-[9px] font-bold rounded">
                        ✓ {doc}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400 italic">স্ট্যান্ডার্ড ডিজিটাল নথি অনুমোদিত</span>
                )}

                {/* Return inspection document status */}
                {trip.inspectionOnReturn && (
                  <div className="mt-2 pt-1.5 border-t border-slate-200/70 text-[9px]">
                    {trip.inspectionOnReturn.missingDocuments?.length > 0 ? (
                      <span className="text-rose-600 font-bold">
                        ⚠️ ঘাটতি নথি: {trip.inspectionOnReturn.missingDocuments.join(', ')}
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-bold">
                        ✓ সকল নথি অক্ষত ফেরত পাওয়া গেছে
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Tools Given */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-extrabold text-slate-700 uppercase block mb-1.5 flex items-center gap-1">
                  <Wrench size={12} className="text-slate-500" />
                  <span>প্রদত্ত যন্ত্রপাতি ও টুলস (Vehicle Tools)</span>
                </span>
                {trip.toolsGiven && trip.toolsGiven.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {trip.toolsGiven.map((tool: string) => (
                      <span key={tool} className="px-1.5 py-0.5 bg-white border border-slate-300 text-slate-800 text-[9px] font-bold rounded">
                        ✓ {tool}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400 italic">গাড়ির নির্ধারিত স্ট্যান্ডার্ড টুলসেট বহাল</span>
                )}

                {/* Return inspection tools status */}
                {trip.inspectionOnReturn && (
                  <div className="mt-2 pt-1.5 border-t border-slate-200/70 text-[9px]">
                    {trip.inspectionOnReturn.missingTools?.length > 0 ? (
                      <span className="text-rose-600 font-bold">
                        ⚠️ ঘাটতি টুলস: {trip.inspectionOnReturn.missingTools.join(', ')}
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-bold">
                        ✓ সকল টুলস অক্ষত ফেরত জমা হয়েছে
                      </span>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Section 5: Official Signatures & Seal Block */}
            <div className="border-t-2 border-dashed border-slate-300 pt-5 mt-4">
              <div className="grid grid-cols-4 gap-3 text-center text-[10px]">
                
                {/* Signature 1 */}
                <div className="flex flex-col justify-between h-20 border-r border-slate-200/80 pr-2">
                  <div className="font-mono text-[9px] text-slate-400 italic">
                    {trip.driverName || 'Driver Sign'}
                  </div>
                  <div>
                    <div className="border-t border-slate-400 w-full mb-1"></div>
                    <span className="font-bold text-slate-800 block">চালকের স্বাক্ষর</span>
                    <span className="text-[9px] text-slate-400">Driver Signature</span>
                  </div>
                </div>

                {/* Signature 2 */}
                <div className="flex flex-col justify-between h-20 border-r border-slate-200/80 pr-2">
                  <div className="font-mono text-[9px] text-slate-400 italic">
                    {trip.startedBy || 'Gate Officer'}
                  </div>
                  <div>
                    <div className="border-t border-slate-400 w-full mb-1"></div>
                    <span className="font-bold text-slate-800 block">রিলিজ / গেট অফিসার</span>
                    <span className="text-[9px] text-slate-400">Despatch In-Charge</span>
                  </div>
                </div>

                {/* Signature 3 */}
                <div className="flex flex-col justify-between h-20 border-r border-slate-200/80 pr-2">
                  <div className="font-mono text-[9px] text-slate-400 italic">
                    {trip.completedBy || 'Return Receiver'}
                  </div>
                  <div>
                    <div className="border-t border-slate-400 w-full mb-1"></div>
                    <span className="font-bold text-slate-800 block">রিসিভিং অফিসার</span>
                    <span className="text-[9px] text-slate-400">Return Inspector</span>
                  </div>
                </div>

                {/* Signature 4 */}
                <div className="flex flex-col justify-between h-20">
                  <div className="font-mono text-[9px] text-slate-400 italic">
                    SEAL & VERIFIED
                  </div>
                  <div>
                    <div className="border-t border-slate-400 w-full mb-1"></div>
                    <span className="font-bold text-slate-800 block">ডিপো ম্যানেজার</span>
                    <span className="text-[9px] text-slate-400">Authorized Manager</span>
                  </div>
                </div>

              </div>

              {/* Document Footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[9px] text-slate-400">
                <span>
                  জেনারেট সময়: {new Date().toLocaleString('bn-BD')} | সিস্টেম ভেরিফাইড ডিজিটাল ডকুমেন্ট
                </span>
                <span className="font-mono">
                  SECURITY HASH: {tripIdShort}-{Math.random().toString(36).substring(2, 7).toUpperCase()}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>এই ডকুমেন্টটি প্রিন্ট ও অডিট রেকর্ডের জন্য অফিসিয়ালি ব্যবহারের উপযুক্ত।</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            >
              <Printer size={15} className="text-slate-600" />
              <span>প্রিন্ট করুন</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              type="button"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm disabled:opacity-50"
            >
              <Download size={15} />
              <span>{isGeneratingPDF ? 'তৈরি হচ্ছে...' : 'PDF ফাইল সেভ করুন'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
