import React, { createContext, useContext, useEffect, useState } from 'react';

export type LanguageMode = 'default' | 'en' | 'bn';

export interface LanguageOption {
  id: LanguageMode;
  name: string;
  englishName: string;
  nativeName: string;
  badge: string;
  tagline: string;
  icon: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    id: 'default',
    name: 'ডিফল্ট ভাষা (Default)',
    englishName: 'Default (Mixed)',
    nativeName: 'ডিফল্ট ভাষা',
    badge: 'ডিফল্ট',
    tagline: 'বর্তমান ভাষা (বাংলা ও ইংরেজির মিশ্রিত রূপ)',
    icon: '🌐',
  },
  {
    id: 'en',
    name: 'সম্পুর্ণ ইংরেজি ভাষা',
    englishName: 'Full English',
    nativeName: 'English (US)',
    badge: 'English',
    tagline: 'Entire interface in pure English language',
    icon: '🇺🇸',
  },
  {
    id: 'bn',
    name: 'সম্পুর্ণ বাংলা ভাষা',
    englishName: 'Full Bengali',
    nativeName: 'বাংলা (বাংলাদেশ)',
    badge: 'বাংলা',
    tagline: 'সম্পূর্ণ ইন্টারফেস পরিষ্কার বাংলা ভাষায়',
    icon: '🇧🇩',
  },
];

export const TRANSLATIONS: Record<string, Record<LanguageMode, string>> = {
  // Navigation
  nav_dashboard: { default: 'Dashboard', en: 'Dashboard', bn: 'ড্যাশবোর্ড' },
  nav_warehouses: { default: 'Warehouses', en: 'Warehouses', bn: 'ওয়্যারহাউস' },
  nav_qr_scanner: { default: 'QR Scanner', en: 'QR Scanner', bn: 'কিউআর স্ক্যানার' },
  nav_vehicles: { default: 'Vehicles', en: 'Vehicles', bn: 'যানবাহন' },
  nav_requests: { default: 'Requests', en: 'Requests', bn: 'রিকোয়েস্ট' },
  nav_drivers: { default: 'Drivers', en: 'Drivers', bn: 'ড্রাইভার' },
  nav_new_trip: { default: 'New Trip', en: 'New Trip', bn: 'নতুন ট্রিপ' },
  nav_trips: { default: 'Trips', en: 'Trips', bn: 'ট্রিপস তালিকা' },
  nav_morning_prep: { default: 'Morning Prep', en: 'Morning Prep', bn: 'মর্নিং প্রেপ' },
  nav_maintenance: { default: 'Maintenance', en: 'Maintenance', bn: 'রক্ষণাবেক্ষণ' },
  nav_maintenance_service: { default: 'সার্ভিস ও মেরামত', en: 'Service & Repair', bn: 'সার্ভিস ও মেরামত' },
  nav_maintenance_gps: { default: 'GPS Device (ADL / BDT)', en: 'GPS Device (ADL / BDT)', bn: 'জিপিএস ডিভাইস (ADL / BDT)' },
  nav_cases: { default: 'Cases', en: 'Cases & Mamla', bn: 'মামলা ও জরিমানা' },
  nav_reports: { default: 'Reports', en: 'Reports & Logs', bn: 'রিপোর্টস' },
  nav_users: { default: 'Users', en: 'Users & Access', bn: 'ব্যবহারকারী' },

  // Header & Profile
  search_placeholder: { default: 'গাড়ি, ড্রাইভার অথবা ট্রিপ খুঁজুন...', en: 'Search vehicle, driver or trip...', bn: 'যানবাহন, চালক বা ট্রিপ খুঁজুন...' },
  logistics_management: { default: 'লজিস্টিকস ম্যানেজমেন্ট', en: 'Logistics Management', bn: 'লজিস্টিকস ব্যবস্থাপনা' },
  mobile_portal: { default: 'মোবাইল লজিস্টিকস পোর্টাল', en: 'Mobile Logistics Portal', bn: 'মোবাইল লজিস্টিকস পোর্টাল' },
  all_options: { default: 'সবগুলো অপশন', en: 'All Modules', bn: 'সকল মডিউল' },
  theme_change: { default: 'থিম পরিবর্তন', en: 'Change Theme', bn: 'থিম পরিবর্তন' },
  language_settings: { default: 'ভাষা সেটিং', en: 'Language Settings', bn: 'ভাষা সেটিং' },
  sign_out: { default: 'সাইন আউট', en: 'Sign Out', bn: 'সাইন আউট' },
  select: { default: 'নির্বাচন করুন', en: 'Select', bn: 'নির্বাচন করুন' },
  verified: { default: 'যাচাইকৃত', en: 'Verified', bn: 'যাচাইকৃত' },
  active_user: { default: 'অ্যাক্টিভ ইউজার', en: 'Active User', bn: 'সক্রিয় ব্যবহারকারী' },

  // Common UI actions
  save: { default: 'সংরক্ষণ করুন', en: 'Save', bn: 'সংরক্ষণ করুন' },
  cancel: { default: 'বাতিল', en: 'Cancel', bn: 'বাতিল' },
  edit: { default: 'সম্পাদনা', en: 'Edit', bn: 'সম্পাদনা' },
  delete: { default: 'মুছে ফেলুন', en: 'Delete', bn: 'মুছে ফেলুন' },
  update: { default: 'আপডেট করুন', en: 'Update', bn: 'আপডেট করুন' },
  search: { default: 'অনুসন্ধান', en: 'Search', bn: 'অনুসন্ধান' },
  filter: { default: 'ফিল্টার', en: 'Filter', bn: 'ফিল্টার' },
  all: { default: 'সকল', en: 'All', bn: 'সকল' },
  loading: { default: 'লোড হচ্ছে...', en: 'Loading...', bn: 'লোড হচ্ছে...' },
  print: { default: 'প্রিন্ট করুন', en: 'Print', bn: 'প্রিন্ট করুন' },
  export: { default: 'এক্সপোর্ট', en: 'Export', bn: 'রপ্তানি' },
  add_new: { default: 'নতুন যোগ করুন', en: 'Add New', bn: 'নতুন যোগ করুন' },
  details: { default: 'বিস্তারিত', en: 'Details', bn: 'বিস্তারিত' },
  view: { default: 'দেখুন', en: 'View', bn: 'দেখুন' },
  confirm: { default: 'নিশ্চিত করুন', en: 'Confirm', bn: 'নিশ্চিত করুন' },
  back: { default: 'ফিরে যান', en: 'Back', bn: 'ফিরে যান' },
  close: { default: 'বন্ধ করুন', en: 'Close', bn: 'বন্ধ করুন' },
  refresh: { default: 'রিফ্রেশ', en: 'Refresh', bn: 'রিফ্রেশ' },
  submit: { default: 'জমা দিন', en: 'Submit', bn: 'জমা দিন' },
  actions: { default: 'অ্যাকশন', en: 'Actions', bn: 'কার্যক্রম' },
  status: { default: 'স্ট্যাটাস', en: 'Status', bn: 'অবস্থা' },
  date: { default: 'তারিখ', en: 'Date', bn: 'তারিখ' },
  total: { default: 'মোট', en: 'Total', bn: 'মোট' },

  // Roles
  role_admin: { default: 'অ্যাডমিন', en: 'Admin', bn: 'অ্যাডমিন' },
  role_sub_admin: { default: 'সাব অ্যাডমিন', en: 'Sub Admin', bn: 'সাব অ্যাডমিন' },
  role_occ: { default: 'ওসিসি', en: 'OCC', bn: 'ওসিসি' },
  role_line_supervisor: { default: 'লাইন সুপারভাইজার', en: 'Line Supervisor', bn: 'লাইন সুপারভাইজার' },
  role_checker: { default: 'চেকার', en: 'Checker', bn: 'চেকার' },
  role_user: { default: 'ইউজার', en: 'User', bn: 'ব্যবহারকারী' },

  // Statuses
  status_available: { default: 'Available', en: 'Available', bn: 'উপলব্ধ' },
  status_maintenance: { default: 'Maintenance', en: 'Maintenance', bn: 'মেরামতে' },
  status_on_trip: { default: 'On Trip', en: 'On Trip', bn: 'ট্রিপে' },
  status_pending: { default: 'Pending', en: 'Pending', bn: 'অপেক্ষমাণ' },
  status_running: { default: 'Running', en: 'Running', bn: 'চলমান' },
  status_completed: { default: 'Completed', en: 'Completed', bn: 'সম্পন্ন' },
  status_cancelled: { default: 'Cancelled', en: 'Cancelled', bn: 'বাতিলকৃত' },
  status_resolved: { default: 'Resolved', en: 'Resolved', bn: 'নিষ্পত্তিকৃত' },
  status_under_review: { default: 'Under Review', en: 'Under Review', bn: 'পর্যালোচনাধীন' },
  status_closed: { default: 'Closed', en: 'Closed', bn: 'বন্ধ' },

  // Entities
  vehicle: { default: 'গাড়ি', en: 'Vehicle', bn: 'যানবাহন' },
  driver: { default: 'ড্রাইভার', en: 'Driver', bn: 'চালক' },
  helper: { default: 'হেলপার', en: 'Helper', bn: 'সহকারী' },
  trip: { default: 'ট্রিপ', en: 'Trip', bn: 'ট্রিপ' },
  warehouse: { default: 'ওয়্যারহাউস', en: 'Warehouse', bn: 'ডিপো / ওয়্যারহাউস' },
  location: { default: 'লোকেশন / গন্তব্য', en: 'Location / Destination', bn: 'গন্তব্য স্থান' },

  // Language section descriptions
  language_active_notice: {
    default: 'বর্তমানে ডিফল্ট ভাষা সক্রিয় রয়েছে। এটি বাংলা ও ইংরেজি শব্দের সমন্বয়ে তৈরি।',
    en: 'English language is now fully active across the application.',
    bn: 'বর্তমানে সম্পূর্ণ বাংলা ভাষা সক্রিয় রয়েছে। সম্পূর্ণ অ্যাপ বাংলায় রূপান্তরিত হয়েছে।'
  }
};

interface LanguageContextType {
  language: LanguageMode;
  setLanguage: (lang: LanguageMode) => void;
  t: (key: string, fallback?: string) => string;
  currentLanguageOption: LanguageOption;
  isEn: boolean;
  isBn: boolean;
  isDefault: boolean;
  getRoleName: (role?: string) => string;
  getStatusName: (status?: string) => string;
  getNavLabel: (moduleKey: string, defaultLabel: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'fleet_flow_app_language';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'default' || saved === 'en' || saved === 'bn') {
        return saved;
      }
    } catch {
      // fallback
    }
    return 'default';
  });

  const setLanguage = (newLang: LanguageMode) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
    } catch (e) {
      console.warn('LocalStorage error while saving language:', e);
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-lang', language);
  }, [language]);

  const t = (key: string, fallback?: string): string => {
    const entry = TRANSLATIONS[key];
    if (entry && entry[language]) {
      return entry[language];
    }
    return fallback || key;
  };

  const getRoleName = (role?: string): string => {
    if (!role) return language === 'en' ? 'User' : 'ইউজার';
    switch (role) {
      case 'Admin':
        return language === 'en' ? 'Admin' : 'অ্যাডমিন';
      case 'Sub Admin':
        return language === 'en' ? 'Sub Admin' : 'সাব অ্যাডমিন';
      case 'OCC':
        return language === 'en' ? 'OCC' : 'ওসিসি';
      case 'Line Supervisor':
        return language === 'en' ? 'Line Supervisor' : 'লাইন সুপারভাইজার';
      case 'Checker':
        return language === 'en' ? 'Checker' : 'চেকার';
      default:
        return language === 'en' ? role : (role === 'User' ? 'ইউজার' : role);
    }
  };

  const getStatusName = (status?: string): string => {
    if (!status) return '';
    const key = `status_${status.toLowerCase().replace(/\s+/g, '_')}`;
    return t(key, status);
  };

  const getNavLabel = (moduleKey: string, defaultLabel: string): string => {
    const key = `nav_${moduleKey}`;
    return t(key, defaultLabel);
  };

  const currentLanguageOption = LANGUAGE_OPTIONS.find((l) => l.id === language) || LANGUAGE_OPTIONS[0];

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        currentLanguageOption,
        isEn: language === 'en',
        isBn: language === 'bn',
        isDefault: language === 'default',
        getRoleName,
        getStatusName,
        getNavLabel,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
