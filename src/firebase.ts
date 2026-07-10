import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration. Support environment variables for production (Vercel) 
// and fallback to AI Studio defaults for development.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDa7RK3sIjmUYtgYpm5vTAnqgzigZ4hLoA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "project-8debfc28-129a-4c6b-b7c.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "project-8debfc28-129a-4c6b-b7c",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "project-8debfc28-129a-4c6b-b7c.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "709369574428",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:709369574428:web:a58c75e875ebb7b62c9bd9",
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "ai-studio-16af0950-58ce-43a7-9571-c5b2b65c5091"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signOut = () => auth.signOut();

