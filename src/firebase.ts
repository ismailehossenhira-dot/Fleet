import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import appletConfig from '../firebase-applet-config.json';

// Firebase configuration. Support environment variables for production (Vercel) 
// and fallback to AI Studio defaults for development.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey || "AIzaSyDa7RK3sIjmUYtgYpm5vTAnqgzigZ4hLoA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || "project-8debfc28-129a-4c6b-b7c.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId || "project-8debfc28-129a-4c6b-b7c",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || "project-8debfc28-129a-4c6b-b7c.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId || "709369574428",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId || "1:709369574428:web:a58c75e875ebb7b62c9bd9",
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || appletConfig.firestoreDatabaseId || "ai-studio-fleetflowpro-16af0950-58ce-43a7-9571-c5b2b65c5091"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with force long polling to bypass WebChannel stream drops
// and network proxy buffering issues in browser/iframe environments
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId);
} catch {
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreInstance;
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signOut = () => auth.signOut();


