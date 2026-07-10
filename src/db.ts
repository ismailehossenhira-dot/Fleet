import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  serverTimestamp,
  orderBy,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { getAuth as getSecondaryAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { handleFirestoreError, OperationType } from './lib/utils';
import { UserRole } from './AuthContext';

// Generic CRUD helpers
export const getCollectionData = async (collName: string) => {
  try {
    const q = query(collection(db, collName), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, collName);
  }
};

export const getDocDataById = async (collName: string, id: string) => {
  try {
    const docRef = doc(db, collName, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${collName}/${id}`);
  }
};

// Real-time listener helper
export const subscribeToCollection = (collName: string, callback: (data: any[]) => void) => {
  const q = query(collection(db, collName), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, collName);
  });
};

// Vehicles
export const addVehicle = async (vehicle: any) => {
  try {
    return await addDoc(collection(db, 'vehicles'), {
      ...vehicle,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'vehicles');
  }
};

export const updateVehicleStatus = async (vehicleId: string, status: string) => {
  try {
    const docRef = doc(db, 'vehicles', vehicleId);
    await updateDoc(docRef, { 
      status, 
      updatedAt: serverTimestamp() 
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `vehicles/${vehicleId}`);
  }
};

export const updateVehicle = async (id: string, vehicle: any) => {
  try {
    const docRef = doc(db, 'vehicles', id);
    await updateDoc(docRef, { 
      ...vehicle, 
      updatedAt: serverTimestamp() 
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `vehicles/${id}`);
  }
};

export const deleteVehicle = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'vehicles', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `vehicles/${id}`);
  }
};

// Drivers
export const addDriver = async (driver: any) => {
  try {
    return await addDoc(collection(db, 'drivers'), {
      ...driver,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'drivers');
  }
};

export const updateDriver = async (id: string, driver: any) => {
  try {
    const docRef = doc(db, 'drivers', id);
    await updateDoc(docRef, {
      ...driver,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `drivers/${id}`);
  }
};

export const deleteDriver = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'drivers', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `drivers/${id}`);
  }
};

export const findStaffById = async (staffId: string) => {
  try {
    const id = staffId.trim().toUpperCase();
    if (!id) return null;

    // Build a unique array of search keys to query
    const searchKeysSet = new Set<string>([id, id.toLowerCase(), staffId.trim()]);
    
    if (!id.startsWith('DRV-') && !id.startsWith('HLP-')) {
      searchKeysSet.add('DRV-' + id);
      searchKeysSet.add('HLP-' + id);
    } else {
      const stripped = id.replace('DRV-', '').replace('HLP-', '');
      if (stripped) {
        searchKeysSet.add(stripped);
        searchKeysSet.add(stripped.toLowerCase());
      }
    }

    const searchKeys = Array.from(searchKeysSet);
    const q = query(
      collection(db, 'drivers'), 
      where('driverId', 'in', searchKeys), 
      limit(1)
    );
    const snapshot = await getDocs(q);
    return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `staff?id=${staffId}`);
  }
};

// Trips
export const createTrip = async (trip: any) => {
  try {
    // 1. Create trip record
    const tripRef = await addDoc(collection(db, 'trips'), {
      ...trip,
      status: 'Pending',
      createdAt: serverTimestamp(),
    });
    
    // 2. We DO NOT update vehicle status to 'On Trip' here anymore!
    // The vehicle status remains 'Available' until OUT QR is scanned.
    
    return tripRef;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'trips');
  }
};

export const startPendingTrip = async (tripId: string, vehicleId: string, updates: any) => {
  try {
    const tripRef = doc(db, 'trips', tripId);
    await updateDoc(tripRef, {
      ...updates,
      status: 'Running',
      startTime: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Update vehicle status to 'On Trip' now that OUT QR is scanned
    await updateVehicleStatus(vehicleId, 'On Trip');
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `trips/${tripId}`);
  }
};

export const updateTrip = async (tripId: string, updates: any) => {
  try {
    const tripRef = doc(db, 'trips', tripId);
    await updateDoc(tripRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `trips/${tripId}`);
  }
};

export const deleteTrip = async (tripId: string) => {
  try {
    await deleteDoc(doc(db, 'trips', tripId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `trips/${tripId}`);
  }
};

export const createMissingReport = async (report: any) => {
  try {
    return await addDoc(collection(db, 'missing_reports'), {
      ...report,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'missing_reports');
  }
};

export const resolveMissingReport = async (reportId: string) => {
  try {
    const reportRef = doc(db, 'missing_reports', reportId);
    const reportSnap = await getDoc(reportRef);
    if (reportSnap.exists()) {
      const data = reportSnap.data();
      
      // 1. Save a copy to history with resolved status
      await addDoc(collection(db, 'missing_reports_history'), {
        ...data,
        status: 'Resolved',
        originalId: reportId,
        resolvedAt: serverTimestamp(),
        deletedAt: serverTimestamp(), // fallback for display in History
      });

      // 2. Delete the active pending document
      await deleteDoc(reportRef);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `missing_reports/${reportId}`);
  }
};

export const deleteMissingReport = async (reportId: string) => {
  try {
    const reportRef = doc(db, 'missing_reports', reportId);
    const reportSnap = await getDoc(reportRef);
    
    if (reportSnap.exists()) {
      const data = reportSnap.data();
      
      // If the report is not resolved, move it to history.
      // If it was already resolved, a history entry was created during resolution, so we just delete it from active.
      if (data.status !== 'Resolved') {
        await addDoc(collection(db, 'missing_reports_history'), {
          ...data,
          originalId: reportId,
          deletedAt: serverTimestamp(),
        });
      }
      
      // Then delete from active
      console.log(`Deleting report from active: ${reportId}`);
      return await deleteDoc(reportRef);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `missing_reports/${reportId}`);
  }
};

export const completeTrip = async (tripId: string, vehicleId: string, inspection: any) => {
  try {
    const tripRef = doc(db, 'trips', tripId);
    await updateDoc(tripRef, {
      status: 'Completed',
      endTime: serverTimestamp(),
      inspectionOnReturn: {
        ...inspection,
        inspectedAt: serverTimestamp()
      }
    });

    // Reset vehicle status
    await updateVehicleStatus(vehicleId, 'Available');
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `trips/${tripId}`);
  }
};

// Cases (Mamla)
export const addCase = async (caseData: any) => {
  try {
    return await addDoc(collection(db, 'cases'), {
      ...caseData,
      status: 'Open',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'cases');
  }
};

export const resolveCase = async (caseId: string) => {
  try {
    const caseRef = doc(db, 'cases', caseId);
    await updateDoc(caseRef, {
      status: 'Resolved',
      resolvedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `cases/${caseId}`);
  }
};

export const updateCase = async (id: string, caseData: any) => {
  try {
    const docRef = doc(db, 'cases', id);
    await updateDoc(docRef, {
      ...caseData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `cases/${id}`);
  }
};

export const deleteCase = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'cases', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `cases/${id}`);
  }
};

// Users
export const syncUserProfile = async (user: any) => {
  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      // Default first user to Admin, others to Checker or similar
      const role = 'Admin'; 
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'System Admin',
        role: role,
        username: 'admin',
        password: 'adminpassword',
        createdAt: serverTimestamp(),
      });
      return { uid: user.uid, email: user.email, role };
    }
    const data = userSnap.data() as any;
    if (user.email === 'ismailehossenhira@gmail.com' && data.role !== 'Admin') {
      await updateDoc(userRef, { role: 'Admin' });
      data.role = 'Admin';
    }
    return { id: userSnap.id, ...data };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
};

export const loginWithUsernameAndPassword = async (usernameInput: string, passwordInput: string) => {
  const username = usernameInput.toLowerCase().trim();
  const password = passwordInput.trim();

  const usersColl = collection(db, 'users');

  // 1. Check if users are completely empty or if default admin isn't registered
  const qAdmin = query(usersColl, where('username', '==', 'admin'));
  const adminSnap = await getDocs(qAdmin);

  if (adminSnap.empty && username === 'admin' && password === '123456') {
    // Seed default admin in Firebase Auth and Firestore
    let uid = '';
    try {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, 'admin@fleetflow.local', 'fleetflow_secret_auth_key');
        uid = userCredential.user.uid;
      } catch (signInErr: any) {
        if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential') {
          const secondaryApp = initializeApp(firebaseConfig, 'SecondaryAdmin');
          const secondaryAuth = getSecondaryAuth(secondaryApp);
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, 'admin@fleetflow.local', 'fleetflow_secret_auth_key');
          uid = userCredential.user.uid;
          await deleteApp(secondaryApp);
          
          // Sign in on main auth instance to establish authenticated request context
          await signInWithEmailAndPassword(auth, 'admin@fleetflow.local', 'fleetflow_secret_auth_key');
        } else {
          throw signInErr;
        }
      }

      await setDoc(doc(db, 'users', uid), {
        uid,
        username: 'admin',
        displayName: 'System Admin',
        password: '123456',
        role: 'Admin' as UserRole,
        createdAt: serverTimestamp()
      });
    } catch (err: any) {
      throw new Error(`Failed to seed default admin: ${err.message}`);
    }
    return;
  }

  // 2. Regular Login lookup
  const q = query(usersColl, where('username', '==', username));
  const snap = await getDocs(q);

  if (snap.empty) {
    throw new Error('User not found. Please check your username.');
  }

  const userDoc = snap.docs[0];
  const userData = userDoc.data();

  if (userData.isSuspended) {
    throw new Error('আপনার অ্যাকাউন্টটি সাসপেন্ড করা হয়েছে। দয়া করে এডমিনের সাথে যোগাযোগ করুন।');
  }

  if (userData.password !== password) {
    throw new Error('Incorrect password. Please try again.');
  }

  // Password matches, sign into Firebase Auth
  try {
    await signInWithEmailAndPassword(auth, `${username}@fleetflow.local`, 'fleetflow_secret_auth_key');
  } catch (err: any) {
    // If auth user doesn't exist but Firestore doc does (out of sync), recreate auth user
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      try {
        const secondaryApp = initializeApp(firebaseConfig, 'SecondarySync');
        const secondaryAuth = getSecondaryAuth(secondaryApp);
        await createUserWithEmailAndPassword(secondaryAuth, `${username}@fleetflow.local`, 'fleetflow_secret_auth_key');
        await deleteApp(secondaryApp);
      } catch (e) {}
      
      // Retry login
      await signInWithEmailAndPassword(auth, `${username}@fleetflow.local`, 'fleetflow_secret_auth_key');
    } else {
      throw err;
    }
  }
};

export const createUserAccount = async (displayName: string, usernameInput: string, passwordInput: string, role: UserRole) => {
  const username = usernameInput.toLowerCase().trim();
  const password = passwordInput.trim();

  // 1. Verify username is unique
  const q = query(collection(db, 'users'), where('username', '==', username));
  const snap = await getDocs(q);
  if (!snap.empty) {
    throw new Error('Username already exists. Please choose a different username.');
  }

  // 2. Create Auth user via secondary app
  let uid = '';
  try {
    const secondaryApp = initializeApp(firebaseConfig, `SecondaryAdd_${Date.now()}`);
    const secondaryAuth = getSecondaryAuth(secondaryApp);
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, `${username}@fleetflow.local`, 'fleetflow_secret_auth_key');
    uid = userCredential.user.uid;
    await deleteApp(secondaryApp);
  } catch (err: any) {
    throw new Error(`Failed to register authentication account: ${err.message}`);
  }

  // 3. Create user document in Firestore
  try {
    await setDoc(doc(db, 'users', uid), {
      uid,
      username,
      displayName,
      password,
      role,
      createdAt: serverTimestamp()
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.CREATE, `users/${uid}`);
  }
};

export const updateUserAccount = async (uid: string, data: { displayName: string; password?: string; role: UserRole }) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
};

export const deleteUserAccount = async (uid: string) => {
  try {
    const userRef = doc(db, 'users', uid);
    await deleteDoc(userRef);
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
  }
};

export const toggleUserSuspension = async (uid: string, isSuspended: boolean) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      isSuspended,
      updatedAt: serverTimestamp()
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
};
