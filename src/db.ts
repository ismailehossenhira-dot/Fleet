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
const getUserString = (profile?: any) => {
  if (!profile) return 'System';
  const name = profile.displayName || profile.username || 'System User';
  const role = profile.role ? ` (${profile.role})` : '';
  return `${name}${role}`;
};

export const addVehicle = async (vehicle: any, profile?: any) => {
  try {
    const docRef = await addDoc(collection(db, 'vehicles'), {
      ...vehicle,
      createdBy: getUserString(profile),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Log initial status
    await addDoc(collection(db, 'vehicle_status_logs'), {
      vehicleId: docRef.id,
      vehiclePlate: vehicle.vehicleNumber,
      oldStatus: 'None',
      newStatus: vehicle.status || 'Available',
      notes: vehicle.maintenanceNotes || 'Initial registration',
      createdBy: getUserString(profile),
      createdAt: serverTimestamp()
    });

    return docRef;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'vehicles');
  }
};

export const updateVehicleStatus = async (vehicleId: string, status: string, maintenanceNotes?: string, profile?: any) => {
  try {
    const docRef = doc(db, 'vehicles', vehicleId);
    
    // Fetch current status to check transition
    const docSnap = await getDoc(docRef);
    const vehicleData = docSnap.exists() ? docSnap.data() : null;
    const oldStatus = vehicleData ? vehicleData.status : 'None';
    const vehiclePlate = vehicleData ? vehicleData.vehicleNumber : 'Unknown';

    const updates: any = { 
      status, 
      updatedAt: serverTimestamp(),
      updatedBy: getUserString(profile)
    };
    if (status === 'Maintenance') {
      if (maintenanceNotes !== undefined) {
        updates.maintenanceNotes = maintenanceNotes;
      }
      
      // Auto-complete or cancel any Running or Pending trips for this vehicle!
      try {
        const q = query(
          collection(db, 'trips'),
          where('vehicleId', '==', vehicleId)
        );
        const tripsSnap = await getDocs(q);
        for (const docObj of tripsSnap.docs) {
          const tripData = docObj.data();
          if (tripData.status === 'Running' || tripData.status === 'Pending') {
            await updateDoc(doc(db, 'trips', docObj.id), {
              status: 'Completed',
              endTime: serverTimestamp(),
              completedBy: getUserString(profile) || 'System (Maintenance Auto)',
              updatedAt: serverTimestamp(),
              inspectionOnReturn: {
                notes: maintenanceNotes || 'Auto-completed on entering Maintenance',
                inspectedAt: serverTimestamp()
              }
            });
          }
        }
      } catch (err) {
        console.error("Error auto-completing active trips on maintenance transition:", err);
      }
    } else if (status === 'Available') {
      // Clear notes if not in maintenance
      updates.maintenanceNotes = '';
      
      // If manually set to Available, complete any Running trip
      try {
        const q = query(
          collection(db, 'trips'),
          where('vehicleId', '==', vehicleId),
          where('status', '==', 'Running')
        );
        const tripsSnap = await getDocs(q);
        for (const docObj of tripsSnap.docs) {
          await updateDoc(doc(db, 'trips', docObj.id), {
            status: 'Completed',
            endTime: serverTimestamp(),
            completedBy: getUserString(profile) || 'System (Manual Available)',
            updatedAt: serverTimestamp()
          });
        }

        // Also delete any Pending trips for this vehicle (since they never left the garage)
        const qPending = query(
          collection(db, 'trips'),
          where('vehicleId', '==', vehicleId),
          where('status', '==', 'Pending')
        );
        const pendingSnap = await getDocs(qPending);
        for (const docObj of pendingSnap.docs) {
          try {
            await deleteDoc(doc(db, 'trips', docObj.id));
          } catch (deleteErr) {
            console.log("Not authorized to delete trip document. Falling back to marking as Cancelled:", deleteErr);
            await updateDoc(doc(db, 'trips', docObj.id), {
              status: 'Cancelled',
              updatedAt: serverTimestamp()
            });
          }
        }
      } catch (err) {
        console.error("Error clearing running/pending trips on available transition:", err);
      }
    } else {
      updates.maintenanceNotes = '';
    }
    await updateDoc(docRef, updates);

    // Log the status transition if status changed
    if (oldStatus !== status) {
      await addDoc(collection(db, 'vehicle_status_logs'), {
        vehicleId,
        vehiclePlate,
        oldStatus,
        newStatus: status,
        notes: maintenanceNotes || '',
        createdBy: getUserString(profile),
        createdAt: serverTimestamp()
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `vehicles/${vehicleId}`);
  }
};

export const updateVehicle = async (id: string, vehicle: any, profile?: any) => {
  try {
    const docRef = doc(db, 'vehicles', id);
    
    // Fetch current status to check transition
    const docSnap = await getDoc(docRef);
    const vehicleData = docSnap.exists() ? docSnap.data() : null;
    const oldStatus = vehicleData ? vehicleData.status : 'None';
    const vehiclePlate = vehicleData ? vehicleData.vehicleNumber : vehicle.vehicleNumber || 'Unknown';

    await updateDoc(docRef, { 
      ...vehicle, 
      updatedBy: getUserString(profile),
      updatedAt: serverTimestamp() 
    });

    // Log transition if status changed
    if (vehicle.status && vehicle.status !== oldStatus) {
      await addDoc(collection(db, 'vehicle_status_logs'), {
        vehicleId: id,
        vehiclePlate,
        oldStatus,
        newStatus: vehicle.status,
        notes: vehicle.maintenanceNotes || '',
        createdBy: getUserString(profile),
        createdAt: serverTimestamp()
      });
    }

    // Auto-complete trips on update transitions if needed
    if (vehicle.status === 'Maintenance') {
      try {
        const q = query(
          collection(db, 'trips'),
          where('vehicleId', '==', id)
        );
        const tripsSnap = await getDocs(q);
        for (const docObj of tripsSnap.docs) {
          const tripData = docObj.data();
          if (tripData.status === 'Running' || tripData.status === 'Pending') {
            await updateDoc(doc(db, 'trips', docObj.id), {
              status: 'Completed',
              endTime: serverTimestamp(),
              completedBy: getUserString(profile) || 'System (Maintenance Auto)',
              updatedAt: serverTimestamp(),
              inspectionOnReturn: {
                notes: vehicle.maintenanceNotes || 'Auto-completed on entering Maintenance',
                inspectedAt: serverTimestamp()
              }
            });
          }
        }
      } catch (err) {
        console.error("Error auto-completing active trips on maintenance transition:", err);
      }
    } else if (vehicle.status === 'Available') {
      try {
        const q = query(
          collection(db, 'trips'),
          where('vehicleId', '==', id),
          where('status', '==', 'Running')
        );
        const tripsSnap = await getDocs(q);
        for (const docObj of tripsSnap.docs) {
          await updateDoc(doc(db, 'trips', docObj.id), {
            status: 'Completed',
            endTime: serverTimestamp(),
            completedBy: getUserString(profile) || 'System (Manual Available)',
            updatedAt: serverTimestamp()
          });
        }

        // Also delete any Pending trips for this vehicle (since they never left the garage)
        const qPending = query(
          collection(db, 'trips'),
          where('vehicleId', '==', id),
          where('status', '==', 'Pending')
        );
        const pendingSnap = await getDocs(qPending);
        for (const docObj of pendingSnap.docs) {
          try {
            await deleteDoc(doc(db, 'trips', docObj.id));
          } catch (deleteErr) {
            console.log("Not authorized to delete trip document. Falling back to marking as Cancelled:", deleteErr);
            await updateDoc(doc(db, 'trips', docObj.id), {
              status: 'Cancelled',
              updatedAt: serverTimestamp()
            });
          }
        }
      } catch (err) {
        console.error("Error clearing running/pending trips on available transition:", err);
      }
    }
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
export const addDriver = async (driver: any, profile?: any) => {
  try {
    return await addDoc(collection(db, 'drivers'), {
      ...driver,
      createdBy: getUserString(profile),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'drivers');
  }
};

export const updateDriver = async (id: string, driver: any, profile?: any) => {
  try {
    const docRef = doc(db, 'drivers', id);
    await updateDoc(docRef, {
      ...driver,
      updatedBy: getUserString(profile),
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
export const createTrip = async (trip: any, profile?: any) => {
  try {
    // 1. Verify that the vehicle is currently available
    const vehicleSnap = await getDoc(doc(db, 'vehicles', trip.vehicleId));
    if (!vehicleSnap.exists()) {
      throw new Error("গাড়িটি ডাটাবেজে খুঁজে পাওয়া যায়নি। (Vehicle not found in database.)");
    }
    const vehicleData = vehicleSnap.data();
    if (vehicleData.status !== 'Available') {
      throw new Error(`গাড়িটি এখন উপলব্ধ (Available) নেই। বর্তমান স্ট্যাটাস: ${vehicleData.status}`);
    }

    // 2. Double-check if there is already an active (Pending or Running) trip for this vehicle
    const q = query(
      collection(db, 'trips'),
      where('vehicleId', '==', trip.vehicleId)
    );
    const tripsSnap = await getDocs(q);
    const hasActiveTrip = tripsSnap.docs.some(docObj => {
      const t = docObj.data();
      return t.status === 'Pending' || t.status === 'Running';
    });

    if (hasActiveTrip) {
      throw new Error("এই গাড়ির জন্য ইতিমধ্যেই একটি ট্রিপ নিবন্ধিত (Pending) বা চলমান (Running) রয়েছে। প্রথমে সেটি শেষ বা বাতিল করুন।");
    }

    // 2.5. Double-check if the selected driver is suspended
    const drvId = trip.driverId?.trim().toUpperCase();
    if (drvId && drvId !== 'DRV-') {
      const driverObj = await findStaffById(drvId);
      if (driverObj && (driverObj as any).isSuspended) {
        throw new Error(`চালক ${(driverObj as any).name || drvId} বর্তমানে সাসপেন্ড আছেন! কারণ: ${(driverObj as any).suspensionReason || 'উল্লেখ নেই'} (${(driverObj as any).suspensionDays || '0'} দিন)`);
      }
    }

    // 2.6. Double-check if the selected helper is suspended
    const hlpId = trip.helperId?.trim().toUpperCase();
    if (hlpId && hlpId !== 'HLP-' && hlpId !== '') {
      const helperObj = await findStaffById(hlpId);
      if (helperObj && (helperObj as any).isSuspended) {
        throw new Error(`হেলপার ${(helperObj as any).name || hlpId} বর্তমানে সাসপেন্ড আছেন! কারণ: ${(helperObj as any).suspensionReason || 'উল্লেখ নেই'} (${(helperObj as any).suspensionDays || '0'} দিন)`);
      }
    }

    // 3. Double-check if driver is already on an active trip
    if (drvId && drvId !== 'DRV-') {
      const qDrv = query(
        collection(db, 'trips'),
        where('driverId', '==', drvId)
      );
      const drvTripsSnap = await getDocs(qDrv);
      const isDriverBusy = drvTripsSnap.docs.some(docObj => {
        const t = docObj.data();
        return t.status === 'Pending' || t.status === 'Running';
      });
      if (isDriverBusy) {
        throw new Error("এই চালক (Driver) ইতিমধ্যে অন্য একটি পেন্ডিং বা রানিং ট্রিপে কাজ করছেন।");
      }
    }

    // 4. Double-check if helper is already on an active trip
    if (hlpId && hlpId !== 'HLP-' && hlpId !== '') {
      const qHlp = query(
        collection(db, 'trips'),
        where('helperId', '==', hlpId)
      );
      const hlpTripsSnap = await getDocs(qHlp);
      const isHelperBusy = hlpTripsSnap.docs.some(docObj => {
        const t = docObj.data();
        return t.status === 'Pending' || t.status === 'Running';
      });
      if (isHelperBusy) {
        throw new Error("এই হেলপার (Helper) ইতিমধ্যে অন্য একটি পেন্ডিং বা রানিং ট্রিপে কাজ করছেন।");
      }
    }

    // 5. Create trip record
    const tripRef = await addDoc(collection(db, 'trips'), {
      ...trip,
      status: 'Pending',
      createdBy: getUserString(profile),
      createdAt: serverTimestamp(),
    });
    
    return tripRef;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'trips');
  }
};

export const startPendingTrip = async (tripId: string, vehicleId: string, updates: any, profile?: any) => {
  try {
    const tripRef = doc(db, 'trips', tripId);
    await updateDoc(tripRef, {
      ...updates,
      status: 'Running',
      startTime: serverTimestamp(),
      updatedAt: serverTimestamp(),
      startedBy: getUserString(profile)
    });

    // Update vehicle status to 'On Trip' now that OUT QR is scanned
    await updateVehicleStatus(vehicleId, 'On Trip', undefined, profile);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `trips/${tripId}`);
  }
};

export const updateTrip = async (tripId: string, updates: any, profile?: any) => {
  try {
    const tripRef = doc(db, 'trips', tripId);
    await updateDoc(tripRef, {
      ...updates,
      updatedBy: getUserString(profile),
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

export const cancelPendingTrip = async (tripId: string, vehicleId: string, profile?: any) => {
  try {
    const tripRef = doc(db, 'trips', tripId);
    
    // 1. Attempt to delete or fallback to marking as Cancelled
    try {
      await deleteDoc(tripRef);
    } catch (deleteErr) {
      console.log("Not authorized to delete trip document. Falling back to marking as Cancelled:", deleteErr);
      await updateDoc(tripRef, {
        status: 'Cancelled',
        updatedBy: getUserString(profile),
        updatedAt: serverTimestamp()
      });
    }

    // 2. Explicitly update the vehicle status back to 'Available'
    const vehicleRef = doc(db, 'vehicles', vehicleId);
    await updateDoc(vehicleRef, {
      status: 'Available',
      maintenanceNotes: '',
      updatedAt: serverTimestamp(),
      updatedBy: getUserString(profile)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `trips/${tripId}`);
  }
};

export const createMissingReport = async (report: any, profile?: any) => {
  try {
    return await addDoc(collection(db, 'missing_reports'), {
      ...report,
      createdBy: getUserString(profile),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'missing_reports');
  }
};

export const resolveMissingReport = async (reportId: string, profile?: any) => {
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
        resolvedBy: getUserString(profile),
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

export const completeTrip = async (tripId: string, vehicleId: string, inspection: any, profile?: any) => {
  try {
    const tripRef = doc(db, 'trips', tripId);
    await updateDoc(tripRef, {
      status: 'Completed',
      endTime: serverTimestamp(),
      completedBy: getUserString(profile),
      inspectionOnReturn: {
        ...inspection,
        inspectedAt: serverTimestamp()
      }
    });

    // Reset vehicle status
    await updateVehicleStatus(vehicleId, 'Available', undefined, profile);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `trips/${tripId}`);
  }
};

// Cases (Mamla)
export const addCase = async (caseData: any, profile?: any) => {
  try {
    return await addDoc(collection(db, 'cases'), {
      ...caseData,
      status: 'Open',
      createdBy: getUserString(profile),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'cases');
  }
};

export const resolveCase = async (caseId: string, profile?: any) => {
  try {
    const caseRef = doc(db, 'cases', caseId);
    await updateDoc(caseRef, {
      status: 'Resolved',
      resolvedBy: getUserString(profile),
      resolvedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `cases/${caseId}`);
  }
};

export const updateCase = async (id: string, caseData: any, profile?: any) => {
  try {
    const docRef = doc(db, 'cases', id);
    await updateDoc(docRef, {
      ...caseData,
      updatedBy: getUserString(profile),
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

// --- Requests Collection ---
export const addRequest = async (requestData: any, profile?: any) => {
  try {
    return await addDoc(collection(db, 'requests'), {
      ...requestData,
      allocatedCount: 0,
      allocatedVehicles: [],
      status: 'Pending',
      createdBy: getUserString(profile),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'requests');
  }
};

export const updateRequest = async (requestId: string, updates: any, profile?: any) => {
  try {
    const docRef = doc(db, 'requests', requestId);
    await updateDoc(docRef, {
      ...updates,
      updatedBy: getUserString(profile),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `requests/${requestId}`);
  }
};

export const deleteRequest = async (requestId: string) => {
  try {
    await deleteDoc(doc(db, 'requests', requestId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `requests/${requestId}`);
  }
};

// --- Morning Preps Collection ---
export const addMorningPrep = async (prepData: any, profile?: any) => {
  try {
    return await addDoc(collection(db, 'morning_preps'), {
      ...prepData,
      createdBy: getUserString(profile),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'morning_preps');
  }
};

export const deleteMorningPrep = async (prepId: string) => {
  try {
    await deleteDoc(doc(db, 'morning_preps', prepId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `morning_preps/${prepId}`);
  }
};


