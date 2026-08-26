/**
 * License Plate Recognition (ANPR / OCR) Helper for Bangladeshi Vehicles
 * Handles Bangla script recognition, Bangla/English digit conversion,
 * fuzzy matching with registered fleet vehicles, and audio feedback.
 */

export const BANGLA_TO_ENG_DIGITS: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
};

export const ENG_TO_BANGLA_DIGITS: Record<string, string> = {
  '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
  '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
};

export const BANGLA_METROS = [
  'ঢাকা মেট্রো', 'চট্টগ্রাম মেট্রো', 'চট্ট মেট্রো', 'খুলনা মেট্রো', 
  'রাজশাহী মেট্রো', 'সিলেট মেট্রো', 'বরিশাল মেট্রো', 'রংপুর মেট্রো', 
  'গাজীপুর মেট্রো', 'গাজীপুর', 'নারায়ণগঞ্জ', 'কুমিল্লা', 'বগুড়া', 
  'ফরিদপুর', 'যশোর', 'ময়মনসিংহ', 'দিনাজপুর', 'পাবনা', 'কুষ্টিয়া', 'টাঙ্গাইল'
];

export const BANGLA_VEHICLE_CLASSES = [
  'ম', 'উ', 'ঊ', 'ন', 'ট', 'ড', 'ঢ', 'চ', 'ছ', 'জ', 'ঝ', 
  'ক', 'খ', 'গ', 'ঘ', 'ঙ', 'ব', 'ভ', 'প', 'ফ', 'ত', 'থ', 
  'দ', 'ধ', 'শ', 'ষ', 'স', 'হ', 'ল', 'র', 'য', 'ড়', 'ঢ়', 'য়'
];

export interface PlateScanData {
  detected: boolean;
  plateTextBangla: string;
  plateTextStandard?: string;
  metroOrDistrict?: string;
  vehicleClass?: string;
  digitsBangla?: string;
  digitsEnglish?: string;
  rawSixDigits?: string;
  matchedVehicleNumber?: string;
  confidence?: number;
}

export function convertBanglaToEngDigits(str: string = ''): string {
  return str.replace(/[০-৯]/g, d => BANGLA_TO_ENG_DIGITS[d] || d);
}

export function convertEngToBanglaDigits(str: string = ''): string {
  return str.replace(/[0-9]/g, d => ENG_TO_BANGLA_DIGITS[d] || d);
}

/**
 * Normalizes text for comparison: removes dashes, spaces, and translates digits
 */
export function normalizePlateText(str: string = ''): string {
  if (!str) return '';
  return convertBanglaToEngDigits(str.toLowerCase())
    .replace(/[\s\-_,\.\/]/g, '')
    .trim();
}

/**
 * Extracts digit sequences from text
 */
export function extractDigits(str: string = ''): string {
  return convertBanglaToEngDigits(str).replace(/[^0-9]/g, '');
}

/**
 * Matches a scanned plate against the fleet vehicle database
 */
export function matchVehicleFromDatabase(
  plateData: PlateScanData,
  vehicles: any[]
): any | null {
  if (!vehicles || vehicles.length === 0) return null;

  // 1. Check if backend already found a matched vehicle
  if (plateData.matchedVehicleNumber) {
    const exact = vehicles.find(v => 
      normalizePlateText(v.vehicleNumber) === normalizePlateText(plateData.matchedVehicleNumber) ||
      v.vehicleNumber.toLowerCase() === plateData.matchedVehicleNumber?.toLowerCase()
    );
    if (exact) return exact;
  }

  const rawScannedBangla = plateData.plateTextBangla || '';
  const rawScannedStandard = plateData.plateTextStandard || '';
  const normalizedScanned = normalizePlateText(rawScannedBangla || rawScannedStandard);
  const scannedDigits = plateData.rawSixDigits || extractDigits(plateData.digitsEnglish || plateData.digitsBangla || rawScannedBangla);

  // 2. Exact or normalized full match
  for (const v of vehicles) {
    const normV = normalizePlateText(v.vehicleNumber);
    if (normV && normalizedScanned && (normV === normalizedScanned || normalizedScanned.includes(normV) || normV.includes(normalizedScanned))) {
      return v;
    }
  }

  // 3. Match by 6 digits or 4 digits + vehicle class letter
  if (scannedDigits && scannedDigits.length >= 4) {
    const classLetter = plateData.vehicleClass || '';

    // First try: Digits match AND Class Letter match
    if (classLetter) {
      const classMatch = vehicles.find(v => {
        const vDigits = extractDigits(v.vehicleNumber);
        const vHasClass = v.vehicleNumber.includes(classLetter);
        const digitsMatch = vDigits.includes(scannedDigits) || scannedDigits.includes(vDigits) || 
          (scannedDigits.length >= 4 && vDigits.endsWith(scannedDigits.slice(-4)));
        return digitsMatch && vHasClass;
      });
      if (classMatch) return classMatch;
    }

    // Second try: Full digits match (e.g. 6 digits or 4 digits)
    const exactDigitsMatch = vehicles.find(v => {
      const vDigits = extractDigits(v.vehicleNumber);
      return vDigits === scannedDigits || (scannedDigits.length >= 4 && vDigits.endsWith(scannedDigits.slice(-4)));
    });
    if (exactDigitsMatch) return exactDigitsMatch;
  }

  // 4. Substring / partial text search
  if (rawScannedBangla.length >= 4) {
    const partialMatch = vehicles.find(v => {
      const vBangla = convertEngToBanglaDigits(v.vehicleNumber);
      return rawScannedBangla.includes(v.vehicleNumber) || rawScannedBangla.includes(vBangla);
    });
    if (partialMatch) return partialMatch;
  }

  return null;
}

/**
 * Format any vehicle plate nicely in Bengali standard format
 */
export function formatBanglaPlateDisplay(vehicleNumber: string): { bangla: string; english: string } {
  if (!vehicleNumber) return { bangla: '', english: '' };

  const englishDigits = convertBanglaToEngDigits(vehicleNumber);
  const banglaDigits = convertEngToBanglaDigits(vehicleNumber);

  return {
    bangla: banglaDigits,
    english: englishDigits
  };
}

/**
 * Plays a synthesized high-tech beep when a license plate is recognized
 */
export function playScanSuccessSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15); // A6 note

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    // Audio autoplay or permissions ignored
  }
}
