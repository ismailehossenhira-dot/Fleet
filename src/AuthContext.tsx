import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';
import { auth, db } from './firebase';
import { syncUserProfile } from './db';

export type UserRole = 'Admin' | 'Sub Admin' | 'Checker' | 'Line Supervisor';

interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  isSuspended?: boolean;
  username?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isSubAdmin: boolean;
  isChecker: boolean;
  isLineSupervisor: boolean;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  loading: true,
  isAdmin: false,
  isSubAdmin: false,
  isChecker: false,
  isLineSupervisor: false,
  isSuperAdmin: false
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
          // Test connection as per guidelines
          try {
            await getDocFromServer(doc(db, 'system', 'connection_test'));
          } catch (error) {
            if(error instanceof Error && error.message.includes('the client is offline')) {
              console.error("Please check your Firebase configuration.");
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
  const isChecker = profile?.role === 'Checker';
  const isLineSupervisor = profile?.role === 'Line Supervisor';

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      isAdmin, 
      isSubAdmin, 
      isChecker, 
      isLineSupervisor,
      isSuperAdmin
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
