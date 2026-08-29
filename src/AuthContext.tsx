import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';
import { auth, db } from './firebase';
import { syncUserProfile } from './db';

export type UserRole = 'Admin' | 'Sub Admin' | 'OCC' | 'Line Supervisor' | 'Checker';

export type ModuleKey = 
  | 'dashboard'
  | 'qr_scanner'
  | 'warehouses'
  | 'vehicles'
  | 'requests'
  | 'drivers'
  | 'new_trip'
  | 'trips'
  | 'morning_prep'
  | 'maintenance'
  | 'cases'
  | 'reports'
  | 'users';

export interface ModuleDefinition {
  key: ModuleKey;
  labelBn: string;
  labelEn: string;
  descriptionBn: string;
  defaultRoles: UserRole[];
}

export const SYSTEM_MODULES: ModuleDefinition[] = [
  { key: 'dashboard', labelBn: 'ড্যাশবোর্ড', labelEn: 'Dashboard', descriptionBn: 'ফ্লিট ওভারভিউ ও পরিসংখ্যান পর্যবেক্ষণ', defaultRoles: ['Admin', 'Sub Admin', 'OCC', 'Line Supervisor', 'Checker'] },
  { key: 'qr_scanner', labelBn: 'কিউআর স্ক্যানার ও প্লেট সার্চ', labelEn: 'QR & Plate Search', descriptionBn: 'দ্রুত গাড়ি ও ট্রিপ সন্ধান', defaultRoles: ['Admin', 'Sub Admin', 'OCC', 'Line Supervisor', 'Checker'] },
  { key: 'warehouses', labelBn: 'ওয়ারহাউজ ও ট্রান্সফার', labelEn: 'Warehouses & Hubs', descriptionBn: '১০টি আঞ্চলিক ডিপোর ফ্লিট ও স্টাফ বদলি ব্যবস্থাপনা', defaultRoles: ['Admin', 'Sub Admin', 'OCC', 'Line Supervisor'] },
  { key: 'vehicles', labelBn: 'যানবাহন তালিকা ও মনিটরিং', labelEn: 'Vehicles', descriptionBn: 'গাড়ির বর্তমান অবস্থা ও তথ্য দেখা', defaultRoles: ['Admin', 'Sub Admin', 'OCC', 'Line Supervisor', 'Checker'] },
  { key: 'requests', labelBn: 'রিকুইজিশন ও চাহিদা', labelEn: 'Trip Requests', descriptionBn: 'চাহিদা তৈরি ও অনুমোদন', defaultRoles: ['Admin', 'Sub Admin', 'OCC', 'Line Supervisor'] },
  { key: 'drivers', labelBn: 'চালক ও সহকারী স্টাফ', labelEn: 'Drivers & Helpers', descriptionBn: 'স্টাফ তালিকা ও তথ্য পর্যবেক্ষণ', defaultRoles: ['Admin', 'Sub Admin', 'OCC'] },
  { key: 'new_trip', labelBn: 'নতুন ট্রিপ নিবন্ধন', labelEn: 'New Trip Dispatch', descriptionBn: 'গাড়ি ট্রিপে পাঠানোর ছাড়পত্র', defaultRoles: ['Admin', 'Sub Admin', 'OCC', 'Line Supervisor'] },
  { key: 'trips', labelBn: 'ট্রিপস মনিটরিং ও রিটার্ন', labelEn: 'Trips & Returns', descriptionBn: 'চলমান ট্রিপ ও গাড়ি ফেরত যাচাই', defaultRoles: ['Admin', 'Sub Admin', 'OCC', 'Line Supervisor', 'Checker'] },
  { key: 'morning_prep', labelBn: 'মর্নিং প্রিপারেশন', labelEn: 'Morning Prep', descriptionBn: 'ভোরকালীন চেকলিস্ট ও গাড়ি পরিদর্শন', defaultRoles: ['Admin', 'Sub Admin', 'OCC', 'Line Supervisor', 'Checker'] },
  { key: 'maintenance', labelBn: 'রক্ষণাবেক্ষণ ও জিপিএস', labelEn: 'Maintenance & GPS', descriptionBn: 'মেরামত ও জিপিএস ট্র্যাকার ট্র্যাকিং', defaultRoles: ['Admin', 'Sub Admin', 'OCC', 'Line Supervisor'] },
  { key: 'cases', labelBn: 'মামলা ও জরিমানা', labelEn: 'Cases & Mamla', descriptionBn: 'ট্রাফিক কেস ও জরিমানা নিস্পত্তি', defaultRoles: ['Admin', 'Sub Admin', 'OCC'] },
  { key: 'reports', labelBn: 'রিপোর্ট ও অ্যানালিটিক্স', labelEn: 'Reports & Logs', descriptionBn: 'ট্রিপ ও ফ্লিটের বিস্তারিত হিস্ট্রি ও প্রিন্ট', defaultRoles: ['Admin', 'Sub Admin', 'OCC', 'Line Supervisor'] },
  { key: 'users', labelBn: 'ইউজার প্রোফাইল', labelEn: 'User Profile', descriptionBn: 'নিজের তথ্য ও পাসওয়ার্ড দেখা/পরিবর্তন', defaultRoles: ['Admin', 'Sub Admin', 'OCC', 'Line Supervisor', 'Checker'] },
];

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  isSuspended?: boolean;
  username?: string;
  warehouse?: string;
  permissions?: string[];
  allPermissions?: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isSubAdmin: boolean;
  isOCC: boolean;
  isChecker: boolean;
  isLineSupervisor: boolean;
  isSuperAdmin: boolean;
  canAccessModule: (moduleKey: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  loading: true,
  isAdmin: false,
  isSubAdmin: false,
  isOCC: false,
  isChecker: false,
  isLineSupervisor: false,
  isSuperAdmin: false,
  canAccessModule: () => false
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      setUser(u);
      
      try {
        if (u) {
          // Test connection as per guidelines (gracefully handle offline / reconnecting state)
          try {
            await getDocFromServer(doc(db, 'system', 'connection_test'));
          } catch (error: any) {
            const errMsg = error?.message || String(error);
            if (errMsg.includes('the client is offline') || error?.code === 'unavailable' || errMsg.includes('unavailable')) {
              console.warn("Firestore: Client is operating in offline cache mode or reconnecting to backend.");
            } else {
              console.info("Firestore connection check info:", errMsg);
            }
          }

          // Sync and fetch profile
          try {
            const userProfile = await syncUserProfile(u);
            if (userProfile) {
              if (userProfile.isSuspended) {
                await signOut(auth);
                setUser(null);
                setProfile(null);
                setLoading(false);
                return;
              }
              setProfile(userProfile as UserProfile);
            } else {
              setProfile({
                uid: u.uid,
                email: u.email,
                displayName: u.displayName || 'System Admin',
                role: u.email === 'ismailehossenhira@gmail.com' ? 'Admin' : 'Checker'
              });
            }
          } catch (syncError) {
            console.error("Error syncing user profile:", syncError);
            setProfile({
              uid: u.uid,
              email: u.email,
              displayName: u.displayName || 'System Admin',
              role: u.email === 'ismailehossenhira@gmail.com' ? 'Admin' : 'Checker'
            });
          }
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Auth state transition error:", err);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const isSuperAdmin = user?.email === 'ismailehossenhira@gmail.com' || 
                       profile?.email === 'ismailehossenhira@gmail.com' || 
                       profile?.role === 'Admin' || 
                       profile?.username === 'admin';
  const isAdmin = profile?.role === 'Admin' || isSuperAdmin;
  const isSubAdmin = profile?.role === 'Sub Admin';
  const isOCC = profile?.role === 'OCC';
  const isChecker = profile?.role === 'Checker';
  const isLineSupervisor = profile?.role === 'Line Supervisor';

  const canAccessModule = (moduleKey: string): boolean => {
    // SuperAdmin & Admin can operate every module without restriction
    if (isAdmin || isSuperAdmin) return true;

    // If Admin explicitly enabled "All Modules" for this user
    if (profile?.allPermissions === true) return true;

    // If Admin assigned a specific set of granular module permissions
    if (Array.isArray(profile?.permissions) && profile.permissions.length > 0) {
      return profile.permissions.includes(moduleKey);
    }

    // Default module access by role if no custom permissions have been assigned yet
    const mod = SYSTEM_MODULES.find(m => m.key === moduleKey);
    if (!mod || !profile?.role) return false;
    return mod.defaultRoles.includes(profile.role);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      isAdmin, 
      isSubAdmin, 
      isOCC,
      isChecker, 
      isLineSupervisor,
      isSuperAdmin,
      canAccessModule
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
