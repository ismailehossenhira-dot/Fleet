/**
 * License Plate Recognition (ANPR / OCR) Helper for Bangladeshi Vehicles
 * Handles Bangla script recognition, Bangla/English digit conversion,
 * bidirectional English-Bengali plate translations:
 *   - ঢাকা মেট্রো ম = DM-MA (or DM-M)
 *   - ঢাকা মেট্রো উ = DM-U
 *   - ঢাকা মেট্রো ঊ = DM-AU
 *   - ঢাকা মেট্রো ন = DM-N
 *   - ঢাকা মেট্রো ট = DM-TA, etc.
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

// District / Metro Prefix Mappings
export const BANGLA_TO_ENG_DISTRICT_MAP: Record<string, string> = {
  'ঢাকা মেট্রো': 'DM',
  'ঢাকা': 'DHAKA',
  'চট্টগ্রাম মেট্রো': 'CM',
  'চট্ট মেট্রো': 'CM',
  'চট্টগ্রাম': 'CTG',
  'খুলনা মেট্রো': 'KM',
  'খুলনা': 'KHU',
  'রাজশাহী মেট্রো': 'RM',
  'রাজশাহী': 'RAJ',
  'সিলেট মেট্রো': 'SM',
  'সিলেট': 'SYL',
  'বরিশাল মেট্রো': 'BM',
  'বরিশাল': 'BAR',
  'রংপুর মেট্রো': 'RPM',
  'রংপুর': 'RAN',
  'গাজীপুর মেট্রো': 'GZM',
  'গাজীপুর': 'GZ',
  'নারায়ণগঞ্জ': 'NG',
  'কুমিল্লা': 'COM',
  'বগুড়া': 'BOG',
  'ময়মনসিংহ': 'MYM',
  'যশোর': 'JAS',
  'দিনাজপুর': 'DIN',
  'ফরিদপুর': 'FAR',
  'পাবনা': 'PAB',
  'কুষ্টিয়া': 'KUS',
  'টাঙ্গাইল': 'TAN'
};

export const ENG_TO_BANGLA_DISTRICT_MAP: Record<string, string> = {
  'DM': 'ঢাকা মেট্রো',
  'DHAKA METRO': 'ঢাকা মেট্রো',
  'DHAKA': 'ঢাকা',
  'CM': 'চট্টগ্রাম মেট্রো',
  'CHATTOGRAM METRO': 'চট্টগ্রাম মেট্রো',
  'CTG': 'চট্টগ্রাম',
  'KM': 'খুলনা মেট্রো',
  'KHULNA METRO': 'খুলনা মেট্রো',
  'KHU': 'খুলনা',
  'RM': 'রাজশাহী মেট্রো',
  'RAJSHAHI METRO': 'রাজশাহী মেট্রো',
  'RAJ': 'রাজশাহী',
  'SM': 'সিলেট মেট্রো',
  'SYLHET METRO': 'সিলেট মেট্রো',
  'SYL': 'সিলেট',
  'BM': 'বরিশাল মেট্রো',
  'BARISHAL METRO': 'বরিশাল মেট্রো',
  'BAR': 'বরিশাল',
  'RPM': 'রংপুর মেট্রো',
  'RANGPUR METRO': 'রংপুর মেট্রো',
  'RAN': 'রংপুর',
  'GZM': 'গাজীপুর মেট্রো',
  'GZ': 'গাজীপুর',
  'GAZIPUR': 'গাজীপুর',
  'NG': 'নারায়ণগঞ্জ',
  'NARAYANGANJ': 'নারায়ণগঞ্জ',
  'COM': 'কুমিল্লা',
  'CUMILLA': 'কুমিল্লা',
  'BOG': 'বগুড়া',
  'BOGURA': 'বগুড়া',
  'MYM': 'ময়মনসিংহ',
  'MYMENSINGH': 'ময়মনসিংহ',
  'JAS': 'যশোর',
  'JASHORE': 'যশোর',
  'DIN': 'দিনাজপুর',
  'DINAJPUR': 'দিনাজপুর',
  'FAR': 'ফরিদপুর',
  'FARIDPUR': 'ফরিদপুর',
  'PAB': 'পাবনা',
  'PABNA': 'পাবনা',
  'KUS': 'কুষ্টিয়া',
  'KUSHTIA': 'কুষ্টিয়া',
  'TAN': 'টাঙ্গাইল',
  'TANGAIL': 'টাঙ্গাইল'
};

// Vehicle Class Letter Mappings (Bangla <-> English)
// ঢাকা মেট্রো ম = DM-MA
// ঢাকা মেট্রো উ = DM-U
// ঢাকা মেট্রো ঊ = DM-AU
// ঢাকা মেট্রো ন = DM-N
export const BANGLA_TO_ENG_CLASS_MAP: Record<string, string> = {
  'ম': 'MA',
  'উ': 'U',
  'ঊ': 'AU',
  'ন': 'N',
  'ট': 'TA',
  'ড': 'DA',
  'ঢ': 'DHA',
  'চ': 'CHA',
  'ছ': 'CHHA',
  'জ': 'JA',
  'ঝ': 'JHA',
  'ক': 'KA',
  'খ': 'KHA',
  'গ': 'GA',
  'ঘ': 'GHA',
  'ব': 'BA',
  'ভ': 'BHA',
  'প': 'PA',
  'ফ': 'FA',
  'ত': 'TA',
  'থ': 'THA',
  'দ': 'DA',
  'ধ': 'DHA',
  'শ': 'SHA',
  'ষ': 'SHA',
  'স': 'SA',
  'হ': 'HA',
  'ল': 'LA',
  'র': 'RA',
  'য': 'JA',
  'ড়': 'RA',
  'ঢ়': 'RHA',
  'য়': 'YA'
};

export const ENG_TO_BANGLA_CLASS_MAP: Record<string, string> = {
  'MA': 'ম',
  'M': 'ম',
  'U': 'উ',
  'AU': 'ঊ',
  'OO': 'ঊ',
  'N': 'ন',
  'NA': 'ন',
  'TA': 'ট',
  'T': 'ট',
  'DA': 'ড',
  'D': 'ড',
  'DHA': 'ঢ',
  'DH': 'ঢ',
  'CHA': 'চ',
  'CH': 'চ',
  'CHHA': 'ছ',
  'CHH': 'ছ',
  'JA': 'জ',
  'J': 'জ',
  'JHA': 'ঝ',
  'JH': 'ঝ',
  'KA': 'ক',
  'K': 'ক',
  'KHA': 'খ',
  'KH': 'খ',
  'GA': 'গ',
  'G': 'গ',
  'GHA': 'ঘ',
  'GH': 'ঘ',
  'BA': 'ব',
  'B': 'ব',
  'BHA': 'ভ',
  'BH': 'ভ',
  'PA': 'প',
  'P': 'প',
  'FA': 'ফ',
  'F': 'ফ',
  'PHA': 'ফ',
  'SA': 'স',
  'S': 'স',
  'SHA': 'শ',
  'SH': 'শ',
  'HA': 'হ',
  'H': 'হ',
  'LA': 'ল',
  'L': 'ল',
  'RA': 'র',
  'R': 'র',
  'YA': 'য়',
  'Y': 'য়'
};

export const BANGLA_METROS = Object.keys(BANGLA_TO_ENG_DISTRICT_MAP);
export const BANGLA_VEHICLE_CLASSES = Object.keys(BANGLA_TO_ENG_CLASS_MAP);

export interface PlateScanData {
  detected: boolean;
  plateTextBangla: string;
  plateTextStandard?: string;
  plateTextEnglish?: string;
  metroOrDistrict?: string;
  metroOrDistrictEng?: string;
  vehicleClass?: string;
  vehicleClassEng?: string;
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
 * Translates a full Bengali License Plate into standardized English format
 * Example: "ঢাকা মেট্রো-ম ১১-২২৩৩" -> "DM-MA 11-2233"
 * Example: "ঢাকা মেট্রো-উ ১২৩৪৫৬" -> "DM-U 123456"
 * Example: "ঢাকা মেট্রো-ঊ ১১-০০৯৯" -> "DM-AU 11-0099"
 * Example: "ঢাকা মেট্রো-ন ১২-৩৪৫৬" -> "DM-N 12-3456"
 */
export function translateBanglaPlateToEnglish(banglaText: string = ''): string {
  if (!banglaText) return '';
  let text = banglaText.trim();

  // Find District / Metro
  let districtEng = '';
  for (const [bDist, eDist] of Object.entries(BANGLA_TO_ENG_DISTRICT_MAP)) {
    if (text.includes(bDist)) {
      districtEng = eDist;
      text = text.replace(bDist, '').trim();
      break;
    }
  }

  // Find Vehicle Class Letter
  let classEng = '';
  for (const [bClass, eClass] of Object.entries(BANGLA_TO_ENG_CLASS_MAP)) {
    const classRegex = new RegExp(`[\\s\\-_]?(${bClass})[\\s\\-_]?`);
    if (classRegex.test(text)) {
      classEng = eClass;
      text = text.replace(classRegex, ' ').trim();
      break;
    }
  }

  // Convert remaining digits
  const engDigits = convertBanglaToEngDigits(text).replace(/[^0-9\- ]/g, '').trim();

  if (districtEng && classEng) {
    return `${districtEng}-${classEng} ${engDigits}`.trim();
  } else if (districtEng) {
    return `${districtEng} ${engDigits}`.trim();
  }
  return convertBanglaToEngDigits(banglaText);
}

/**
 * Translates an English License Plate into standardized Bengali format
 * Example: "DM-MA 11-2233" -> "ঢাকা মেট্রো-ম ১১-২২৩৩"
 * Example: "DM-U 123456" -> "ঢাকা মেট্রো-উ ১২৩৪৫৬"
 * Example: "DM-AU 11-0099" -> "ঢাকা মেট্রো-ঊ ১১-০০৯৯"
 * Example: "DM-N 12-3456" -> "ঢাকা মেট্রো-ন ১২-৩৪৫৬"
 */
export function translateEnglishPlateToBangla(englishText: string = ''): string {
  if (!englishText) return '';
  let text = englishText.toUpperCase().trim();

  let districtBangla = '';
  for (const [eDist, bDist] of Object.entries(ENG_TO_BANGLA_DISTRICT_MAP)) {
    if (text.startsWith(eDist + '-') || text.startsWith(eDist + ' ') || text.includes(eDist)) {
      districtBangla = bDist;
      text = text.replace(eDist, '').trim();
      break;
    }
  }

  let classBangla = '';
  const sortedEngClasses = Object.keys(ENG_TO_BANGLA_CLASS_MAP).sort((a, b) => b.length - a.length);
  for (const eClass of sortedEngClasses) {
    const classRegex = new RegExp(`[\\s\\-_]?\\b(${eClass})\\b[\\s\\-_]?`);
    if (classRegex.test(text)) {
      classBangla = ENG_TO_BANGLA_CLASS_MAP[eClass];
      text = text.replace(classRegex, ' ').trim();
      break;
    }
  }

  const banglaDigits = convertEngToBanglaDigits(text).replace(/[^০-৯\- ]/g, '').trim();

  if (districtBangla && classBangla) {
    return `${districtBangla}-${classBangla} ${banglaDigits}`.trim();
  } else if (districtBangla) {
    return `${districtBangla} ${banglaDigits}`.trim();
  }
  return convertEngToBanglaDigits(englishText);
}

/**
 * Normalizes text for comparison: removes dashes, spaces, translates digits, and unifies English/Bangla codes
 */
export function normalizePlateText(str: string = ''): string {
  if (!str) return '';
  
  // First, convert digits
  let normalized = convertBanglaToEngDigits(str.toLowerCase())
    .replace(/[\s\-_,\.\/]/g, '')
    .trim();

  // Replace Bangla district words with normalized English code
  for (const [bDist, eDist] of Object.entries(BANGLA_TO_ENG_DISTRICT_MAP)) {
    const normBDist = bDist.toLowerCase().replace(/[\s\-_,\.\/]/g, '');
    if (normalized.includes(normBDist)) {
      normalized = normalized.replace(normBDist, eDist.toLowerCase());
    }
  }

  // Replace Bangla class letters with standard English class
  for (const [bClass, eClass] of Object.entries(BANGLA_TO_ENG_CLASS_MAP)) {
    if (normalized.includes(bClass)) {
      normalized = normalized.replace(new RegExp(bClass, 'g'), eClass.toLowerCase());
    }
  }

  return normalized;
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
  const rawScannedEnglish = plateData.plateTextEnglish || translateBanglaPlateToEnglish(rawScannedBangla);
  
  const normalizedScanned = normalizePlateText(rawScannedBangla || rawScannedStandard || rawScannedEnglish);
  const scannedDigits = plateData.rawSixDigits || extractDigits(plateData.digitsEnglish || plateData.digitsBangla || rawScannedBangla);

  // 2. Exact or normalized full match
  for (const v of vehicles) {
    const normV = normalizePlateText(v.vehicleNumber);
    if (normV && normalizedScanned && (normV === normalizedScanned || normalizedScanned.includes(normV) || normV.includes(normalizedScanned))) {
      return v;
    }
  }

  // 3. Match by 6 digits or 4 digits + vehicle class letter (Bangla or English code)
  if (scannedDigits && scannedDigits.length >= 4) {
    const classLetterBangla = plateData.vehicleClass || '';
    const classLetterEng = plateData.vehicleClassEng || (classLetterBangla ? BANGLA_TO_ENG_CLASS_MAP[classLetterBangla] : '');

    // Try: Digits match AND Class Letter match (Bangla letter or English translation like MA, U, AU, N)
    if (classLetterBangla || classLetterEng) {
      const classMatch = vehicles.find(v => {
        const vDigits = extractDigits(v.vehicleNumber);
        const normV = normalizePlateText(v.vehicleNumber);
        const hasBanglaClass = classLetterBangla && v.vehicleNumber.includes(classLetterBangla);
        const hasEngClass = classLetterEng && (normV.includes(classLetterEng.toLowerCase()) || v.vehicleNumber.toUpperCase().includes(classLetterEng));
        const digitsMatch = vDigits === scannedDigits || vDigits.includes(scannedDigits) || scannedDigits.includes(vDigits) || 
          (scannedDigits.length >= 4 && vDigits.endsWith(scannedDigits.slice(-4)));
        return digitsMatch && (hasBanglaClass || hasEngClass);
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
  if (rawScannedBangla.length >= 4 || rawScannedEnglish.length >= 4) {
    const partialMatch = vehicles.find(v => {
      const vBangla = convertEngToBanglaDigits(v.vehicleNumber);
      const vEngTranslated = translateBanglaPlateToEnglish(v.vehicleNumber);
      return rawScannedBangla.includes(v.vehicleNumber) || 
             rawScannedBangla.includes(vBangla) ||
             (rawScannedEnglish && rawScannedEnglish.includes(v.vehicleNumber)) ||
             (rawScannedEnglish && vEngTranslated && rawScannedEnglish.includes(vEngTranslated));
    });
    if (partialMatch) return partialMatch;
  }

  return null;
}

/**
 * Format any vehicle plate nicely in Bengali and English standard formats
 */
export function formatBanglaPlateDisplay(vehicleNumber: string): { 
  bangla: string; 
  english: string; 
  englishTranslated: string;
  banglaTranslated: string;
} {
  if (!vehicleNumber) return { bangla: '', english: '', englishTranslated: '', banglaTranslated: '' };

  const englishDigits = convertBanglaToEngDigits(vehicleNumber);
  const banglaDigits = convertEngToBanglaDigits(vehicleNumber);
  const englishTranslated = translateBanglaPlateToEnglish(vehicleNumber);
  const banglaTranslated = translateEnglishPlateToBangla(vehicleNumber);

  return {
    bangla: banglaDigits,
    english: englishDigits,
    englishTranslated,
    banglaTranslated
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
