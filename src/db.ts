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
  onSnapshot,
  writeBatch
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
  } catch (error: any) {
    const msg = error?.message || String(error);
    if (error?.code === 'unavailable' || msg.includes('unavailable') || msg.includes('offline')) {
      console.warn(`Firestore getCollectionData for ${collName}: offline or reconnecting.`);
      return [];
    }
    handleFirestoreError(error, OperationType.LIST, collName);
  }
};

export const getDocDataById = async (collName: string, id: string) => {
  try {
    const docRef = doc(db, collName, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (error: any) {
    const msg = error?.message || String(error);
    if (error?.code === 'unavailable' || msg.includes('unavailable') || msg.includes('offline')) {
      console.warn(`Firestore getDocDataById for ${collName}/${id}: offline or reconnecting.`);
      return null;
    }
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
    const msg = error?.message || String(error);
    if (
      msg.includes('aborted') || 
      msg.includes('cancelled') || 
      error?.code === 'cancelled' ||
      error?.code === 'unavailable' ||
      msg.includes('unavailable') ||
      msg.includes('offline')
    ) {
      console.warn(`Firestore subscription for ${collName} is operating in offline/cached mode.`);
      return;
    }
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
    const assignedWarehouse = vehicle.warehouse || (profile?.warehouse && profile.warehouse !== 'all' ? profile.warehouse : 'মোহাম্মদপুর');
    const docRef = await addDoc(collection(db, 'vehicles'), {
      ...vehicle,
      warehouse: assignedWarehouse,
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
      notes: vehicle.maintenanceNotes || `Initial registration (Warehouse: ${assignedWarehouse})`,
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
    if (!vehicleId) return;
    let docRef = doc(db, 'vehicles', vehicleId);
    let docSnap = await getDoc(docRef);
    let realVehicleId = vehicleId;

    if (!docSnap.exists()) {
      // Try finding vehicle document by vehicleNumber
      const q = query(
        collection(db, 'vehicles'),
        where('vehicleNumber', '==', vehicleId.trim().toUpperCase())
      );
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        docRef = querySnap.docs[0].ref;
        docSnap = querySnap.docs[0];
        realVehicleId = docSnap.id;
      } else {
        // Fallback: try case-insensitive or trimmed search across all vehicles
        const allVehSnap = await getDocs(collection(db, 'vehicles'));
        const matched = allVehSnap.docs.find(d => 
          (d.data().vehicleNumber || '').replace(/\s+/g, '').toUpperCase() === vehicleId.replace(/\s+/g, '').toUpperCase()
        );
        if (matched) {
          docRef = matched.ref;
          docSnap = matched;
          realVehicleId = matched.id;
        } else {
          console.warn(`Vehicle with ID/Plate "${vehicleId}" not found in vehicles collection.`);
          return;
        }
      }
    }

    const vehicleData = docSnap.data();
    const oldStatus = vehicleData ? (vehicleData.status || 'None') : 'None';
    const vehiclePlate = vehicleData ? (vehicleData.vehicleNumber || vehicleId) : vehicleId;

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
          where('vehicleId', '==', realVehicleId)
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
          where('vehicleId', '==', realVehicleId),
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
          where('vehicleId', '==', realVehicleId),
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
      try {
        await addDoc(collection(db, 'vehicle_status_logs'), {
          vehicleId: realVehicleId,
          vehiclePlate,
          oldStatus,
          newStatus: status,
          notes: maintenanceNotes || '',
          createdBy: getUserString(profile),
          createdAt: serverTimestamp()
        });
      } catch (logErr) {
        console.warn("Could not write vehicle_status_logs:", logErr);
      }
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
    const assignedWarehouse = driver.warehouse || (profile?.warehouse && profile.warehouse !== 'all' ? profile.warehouse : 'মোহাম্মদপুর');
    return await addDoc(collection(db, 'drivers'), {
      ...driver,
      warehouse: assignedWarehouse,
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
      throw new Error("গাড়িটি ডাটাবেজে খুঁজে পাওয়া যায়নি।");
    }
    const vehicleData = vehicleSnap.data();
    if (vehicleData.status !== 'Available') {
      throw new Error(`গাড়িটি এখন উপলব্ধ নেই। বর্তমান স্ট্যাটাস: ${vehicleData.status}`);
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
      throw new Error("এই গাড়ির জন্য ইতিমধ্যেই একটি ট্রিপ নিবন্ধিত বা চলমান রয়েছে। প্রথমে সেটি শেষ বা বাতিল করুন।");
    }

    // 2.5. Verify that the selected driver exists in the database and is not suspended
    const drvId = trip.driverId?.trim().toUpperCase();
    if (!drvId || drvId === 'DRV-') {
      throw new Error("ড্রাইভার আইডি প্রদান করা আবশ্যক।");
    }
    const driverObj = await findStaffById(drvId);
    if (!driverObj) {
      throw new Error(`ড্রাইভার আইডি (${trip.driverId}) ডেটাবেজে খুঁজে পাওয়া যায়নি! ডেটাবেজে চালকের তথ্য না থাকলে ট্রিপ এন্ট্রি করা যাবে না।`);
    }
    if ((driverObj as any).isSuspended) {
      throw new Error(`চালক ${(driverObj as any).name || drvId} বর্তমানে সাসপেন্ড আছেন! কারণ: ${(driverObj as any).suspensionReason || 'উল্লেখ নেই'} (${(driverObj as any).suspensionDays || '0'} দিন)`);
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
        throw new Error("এই চালক ইতিমধ্যে অন্য একটি পেন্ডিং বা রানিং ট্রিপে কাজ করছেন।");
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
        throw new Error("এই হেলপার ইতিমধ্যে অন্য একটি পেন্ডিং বা রানিং ট্রিপে কাজ করছেন।");
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

export const deleteMultipleTrips = async (tripIds: string[]) => {
  if (!tripIds || tripIds.length === 0) return;
  try {
    const batchSize = 400;
    for (let i = 0; i < tripIds.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = tripIds.slice(i, i + batchSize);
      chunk.forEach(id => {
        batch.delete(doc(db, 'trips', id));
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'trips (batch)');
  }
};

export const cancelPendingTrip = async (tripId: string, vehicleId?: string, profile?: any) => {
  try {
    const tripRef = doc(db, 'trips', tripId);
    let targetVehicleId = vehicleId;
    let targetVehiclePlate = '';

    // Fetch trip details to ensure we have vehicleId and vehiclePlate
    try {
      const tripSnap = await getDoc(tripRef);
      if (tripSnap.exists()) {
        const tripData = tripSnap.data();
        if (!targetVehicleId) targetVehicleId = tripData.vehicleId;
        targetVehiclePlate = tripData.vehiclePlate || '';
      }
    } catch (e) {
      console.warn("Could not read trip before cancelling:", e);
    }

    // 1. Attempt to delete or fallback to marking as Cancelled
    try {
      await deleteDoc(tripRef);
    } catch (deleteErr) {
      console.log("Could not delete trip document. Falling back to marking as Cancelled:", deleteErr);
      await updateDoc(tripRef, {
        status: 'Cancelled',
        updatedBy: getUserString(profile),
        updatedAt: serverTimestamp()
      });
    }

    // 2. Explicitly update the vehicle status back to 'Available'
    let vehicleUpdated = false;
    if (targetVehicleId) {
      try {
        const vehicleRef = doc(db, 'vehicles', targetVehicleId);
        const vehicleSnap = await getDoc(vehicleRef);
        if (vehicleSnap.exists()) {
          await updateDoc(vehicleRef, {
            status: 'Available',
            maintenanceNotes: '',
            updatedAt: serverTimestamp(),
            updatedBy: getUserString(profile)
          });
          vehicleUpdated = true;
        }
      } catch (err) {
        console.warn("Vehicle ID update warning:", err);
      }
    }

    // If not updated by document ID, or if plate is known, query by vehicleNumber
    const plateToSearch = targetVehiclePlate || targetVehicleId;
    if (plateToSearch) {
      try {
        const qVeh = query(
          collection(db, 'vehicles'),
          where('vehicleNumber', '==', plateToSearch)
        );
        const vQuerySnap = await getDocs(qVeh);
        for (const docObj of vQuerySnap.docs) {
          await updateDoc(doc(db, 'vehicles', docObj.id), {
            status: 'Available',
            maintenanceNotes: '',
            updatedAt: serverTimestamp(),
            updatedBy: getUserString(profile)
          });
          vehicleUpdated = true;
        }
      } catch (err) {
        console.warn("Vehicle query update warning:", err);
      }
    }

    // 3. Log status transition in vehicle_status_logs
    try {
      await addDoc(collection(db, 'vehicle_status_logs'), {
        vehicleId: targetVehicleId || 'N/A',
        vehiclePlate: targetVehiclePlate || targetVehicleId || 'N/A',
        oldStatus: 'Pending Out Scan',
        newStatus: 'Available',
        notes: 'পেন্ডিং ট্রিপ বাতিল করে গাড়ি Available করা হয়েছে',
        createdBy: getUserString(profile),
        createdAt: serverTimestamp()
      });
    } catch (logErr) {
      console.warn("Could not log status transition:", logErr);
    }

    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `trips/${tripId}`);
    throw error;
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

export const deleteMissingReportHistory = async (historyId: string) => {
  try {
    await deleteDoc(doc(db, 'missing_reports_history', historyId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `missing_reports_history/${historyId}`);
  }
};

export const deleteMultipleMissingReportHistory = async (historyIds: string[]) => {
  if (!historyIds || historyIds.length === 0) return;
  try {
    const batchSize = 400;
    for (let i = 0; i < historyIds.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = historyIds.slice(i, i + batchSize);
      chunk.forEach(id => {
        batch.delete(doc(db, 'missing_reports_history', id));
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'missing_reports_history (batch)');
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
  } catch (error: any) {
    const msg = error?.message || String(error);
    if (error?.code === 'unavailable' || msg.includes('unavailable') || msg.includes('offline')) {
      console.warn("Firestore syncUserProfile operating in offline/cached mode for user:", user?.email);
      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'System User',
        role: user.email === 'ismailehossenhira@gmail.com' ? 'Admin' : 'Checker'
      };
    }
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
};

export const loginWithUsernameAndPassword = async (usernameInput: string, passwordInput: string) => {
  const username = usernameInput.toLowerCase().trim();
  const password = passwordInput.trim();

  const usersColl = collection(db, 'users');

  try {
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
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (err?.code === 'unavailable' || msg.includes('unavailable') || msg.includes('offline') || msg.includes('Could not reach Cloud Firestore')) {
      throw new Error('সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি। অনুগ্রহ করে আপনার ইন্টারনেট সংযোগ পরীক্ষা করে পুনরায় চেষ্টা করুন।');
    }
    throw err;
  }
};

export const createUserAccount = async (
  displayName: string, 
  usernameInput: string, 
  passwordInput: string, 
  role: UserRole,
  warehouse: string = 'মোহাম্মদপুর',
  permissions: string[] = [],
  allPermissions: boolean = false,
  creatorProfile?: any
) => {
  const username = usernameInput.toLowerCase().trim();
  const password = passwordInput.trim();

  // If creator is not global Super Admin and has an assigned warehouse, new user automatically inherits creator's warehouse
  const isCreatorGlobal = !creatorProfile?.warehouse || creatorProfile?.warehouse === 'all' || creatorProfile?.role === 'Admin' && creatorProfile?.email === 'ismailehossenhira@gmail.com';
  const assignedWarehouse = (!isCreatorGlobal && creatorProfile?.warehouse)
    ? creatorProfile.warehouse
    : (warehouse || 'মোহাম্মদপুর');

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
      warehouse: assignedWarehouse,
      permissions,
      allPermissions,
      createdBy: getUserString(creatorProfile),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.CREATE, `users/${uid}`);
  }
};

export const updateUserAccount = async (
  uid: string, 
  data: { 
    displayName: string; 
    password?: string; 
    role: UserRole;
    warehouse?: string;
    permissions?: string[];
    allPermissions?: boolean;
  },
  profile?: any
) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      ...data,
      updatedBy: getUserString(profile),
      updatedAt: serverTimestamp()
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
};

export const updateUserPermissions = async (
  uid: string, 
  permissions: string[], 
  allPermissions: boolean
) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      permissions,
      allPermissions,
      updatedAt: serverTimestamp()
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
};

export const cleanupLegacyRoles = async (fallbackRole: UserRole = 'Checker') => {
  const validRoles: UserRole[] = ['Admin', 'Sub Admin', 'OCC', 'Line Supervisor', 'Checker'];
  try {
    const snap = await getDocs(collection(db, 'users'));
    let migratedCount = 0;
    const batch = writeBatch(db);
    
    snap.docs.forEach((d) => {
      const data = d.data();
      const currentRole = data.role;
      // Do not touch Admin
      if (currentRole === 'Admin' || d.id === 'ismailehossenhira@gmail.com' || data.email === 'ismailehossenhira@gmail.com') {
        return;
      }
      if (!validRoles.includes(currentRole)) {
        // Normalize outdated/unknown roles to fallbackRole
        batch.update(doc(db, 'users', d.id), {
          role: fallbackRole,
          updatedAt: serverTimestamp()
        });
        migratedCount++;
      }
    });

    if (migratedCount > 0) {
      await batch.commit();
    }
    return migratedCount;
  } catch (err) {
    console.error("Error running cleanupLegacyRoles:", err);
    return 0;
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

// --- Staff Notes & Rating History Collection (Immutable) ---
export const addStaffNote = async (noteData: {
  staffId: string;
  staffName: string;
  staffRole?: 'Driver' | 'Helper';
  authorName?: string;
  authorRole?: string;
  authorUid?: string;
  vehiclePlate?: string;
  rating?: number;
  category?: string;
  noteText: string;
  dayOfWeek?: string;
  dateString?: string;
  timeString?: string;
}, profile?: any) => {
  try {
    const now = new Date();
    const daysBn = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
    const currentDay = daysBn[now.getDay()];
    const currentDate = now.toLocaleDateString('bn-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const currentTime = now.toLocaleTimeString('bn-BD', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const authorName = noteData.authorName || profile?.displayName || profile?.name || 'অ্যাডমিন / ম্যানেজার';
    const authorRole = noteData.authorRole || profile?.role || 'Admin';

    return await addDoc(collection(db, 'staff_notes'), {
      staffId: noteData.staffId.trim().toUpperCase(),
      staffName: noteData.staffName || 'স্টাফ',
      staffRole: noteData.staffRole || 'Driver',
      authorName,
      authorRole,
      authorUid: noteData.authorUid || profile?.uid || 'system',
      vehiclePlate: (noteData.vehiclePlate || 'N/A').trim(),
      rating: Number(noteData.rating || 5),
      category: noteData.category || 'সাধারণ মন্তব্য',
      noteText: noteData.noteText.trim(),
      dayOfWeek: noteData.dayOfWeek || currentDay,
      dateString: noteData.dateString || currentDate,
      timeString: noteData.timeString || currentTime,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'staff_notes');
  }
};

// --- Maintenance Collection ---
export const addMaintenanceRecord = async (data: any, setVehicleStatus: boolean = true, profile?: any) => {
  try {
    const docRef = await addDoc(collection(db, 'maintenance'), {
      ...data,
      createdBy: getUserString(profile),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (setVehicleStatus && data.status !== 'Completed') {
      try {
        if (data.vehicleId) {
          await updateVehicleStatus(data.vehicleId, 'Maintenance', `${data.title} (${data.category || 'Maintenance'})`, profile);
        }
      } catch (vehErr) {
        console.warn("Could not auto-update vehicle status on maintenance:", vehErr);
      }
    }

    return docRef;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'maintenance');
  }
};

export const updateMaintenanceRecord = async (id: string, updates: any, profile?: any) => {
  try {
    const docRef = doc(db, 'maintenance', id);
    await updateDoc(docRef, {
      ...updates,
      updatedBy: getUserString(profile),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `maintenance/${id}`);
  }
};

export const completeMaintenanceRecord = async (id: string, vehicleId?: string, vehiclePlate?: string, profile?: any) => {
  try {
    const docRef = doc(db, 'maintenance', id);
    await updateDoc(docRef, {
      status: 'Completed',
      completedDate: new Date().toISOString().split('T')[0],
      updatedBy: getUserString(profile),
      updatedAt: serverTimestamp(),
    });

    // Make vehicle Available again
    const targetVeh = vehicleId || vehiclePlate;
    if (targetVeh) {
      try {
        await updateVehicleStatus(targetVeh, 'Available', '', profile);
      } catch (vehErr) {
        console.warn("Could not set vehicle back to Available:", vehErr);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `maintenance/${id}`);
  }
};

export const deleteMaintenanceRecord = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'maintenance', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `maintenance/${id}`);
  }
};

export const deleteMultipleMaintenanceRecords = async (ids: string[]) => {
  if (!ids || ids.length === 0) return;
  try {
    const batchSize = 400;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = ids.slice(i, i + batchSize);
      chunk.forEach(id => {
        batch.delete(doc(db, 'maintenance', id));
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'maintenance (batch)');
  }
};

// --- GPS & Camera Devices (ADL & BD Tracking) Collection ---
export interface GPSDeviceRecord {
  id?: string;
  vehicleId?: string;
  vehiclePlate: string;
  provider: 'ADL' | 'BD Tracking';
  deviceId?: string;
  simNumber?: string;
  gpsStatus: 'Online' | 'Offline' | 'No Signal' | 'Power Cut';
  cameraStatus: 'OK' | 'Damaged' | 'Offline' | 'No Video' | 'Cable Issue' | 'Not Installed';
  issueType?: string;
  offlineSince?: string; // YYYY-MM-DD
  lastKnownLocation?: string;
  notes?: string;
  ticketNumber?: string;
  vendorNotifyCount?: number;
  actionStatus?: 'Active Issue' | 'Complain Lodged' | 'Technician Scheduled' | 'Resolved';
  resolvedDate?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export const addGPSDevice = async (data: GPSDeviceRecord, profile?: any) => {
  try {
    return await addDoc(collection(db, 'gps_devices'), {
      ...data,
      vehiclePlate: data.vehiclePlate.trim().toUpperCase(),
      provider: data.provider || 'ADL',
      gpsStatus: data.gpsStatus || 'Online',
      cameraStatus: data.cameraStatus || 'OK',
      actionStatus: data.actionStatus || (data.gpsStatus === 'Offline' || data.cameraStatus === 'Damaged' ? 'Active Issue' : 'Resolved'),
      createdBy: getUserString(profile),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'gps_devices');
  }
};

export const updateGPSDevice = async (id: string, updates: Partial<GPSDeviceRecord>, profile?: any) => {
  try {
    const docRef = doc(db, 'gps_devices', id);
    const payload: any = {
      ...updates,
      updatedBy: getUserString(profile),
      updatedAt: serverTimestamp(),
    };
    if (updates.vehiclePlate) {
      payload.vehiclePlate = updates.vehiclePlate.trim().toUpperCase();
    }
    await updateDoc(docRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `gps_devices/${id}`);
  }
};

export const deleteGPSDevice = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'gps_devices', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `gps_devices/${id}`);
  }
};

// --- Dynamic Vehicle Models Collection (Managed by Admins) ---
export interface VehicleModelRecord {
  id?: string;
  name: string; // e.g. "Dost Plus", "Leo", "Ashok Leyland 1616", "Tata 407", etc.
  category?: string; // e.g. "Pickup", "Mini Truck", "Medium Truck", "Heavy Truck", "Covered Van"
  capacity?: string; // e.g. "1.5 Ton", "3 Ton", "7.5 Ton", "15 Ton"
  description?: string;
  isDefault?: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export const addVehicleModel = async (model: { name: string; category?: string; capacity?: string; description?: string }, profile?: any) => {
  try {
    const trimmedName = model.name.trim();
    if (!trimmedName) throw new Error('Vehicle model name is required');

    return await addDoc(collection(db, 'vehicle_models'), {
      name: trimmedName,
      category: model.category?.trim() || 'General Truck',
      capacity: model.capacity?.trim() || '',
      description: model.description?.trim() || '',
      isDefault: false,
      createdBy: getUserString(profile),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'vehicle_models');
  }
};

export const updateVehicleModel = async (id: string, updates: Partial<VehicleModelRecord>, profile?: any) => {
  try {
    const docRef = doc(db, 'vehicle_models', id);
    const payload: any = {
      ...updates,
      updatedBy: getUserString(profile),
      updatedAt: serverTimestamp(),
    };
    if (updates.name) {
      payload.name = updates.name.trim();
    }
    if (updates.category) {
      payload.category = updates.category.trim();
    }
    if (updates.capacity) {
      payload.capacity = updates.capacity.trim();
    }
    await updateDoc(docRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `vehicle_models/${id}`);
  }
};

export const deleteVehicleModel = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'vehicle_models', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `vehicle_models/${id}`);
  }
};

// Warehouse Transfers & Exchanges
export interface WarehouseTransferRecord {
  id?: string;
  type: 'vehicle' | 'staff' | 'exchange';
  targetId: string;
  targetName: string;
  targetRole?: string;
  fromWarehouse: string;
  toWarehouse: string;
  exchangeVehicleId?: string;
  exchangeVehiclePlate?: string;
  reason?: string;
  transferredBy?: string;
  createdAt?: any;
}

export const transferVehicle = async (
  vehicleId: string, 
  toWarehouse: string, 
  reason: string = '', 
  profile?: any,
  exchangeVehicleId?: string
) => {
  try {
    const vRef = doc(db, 'vehicles', vehicleId);
    const vSnap = await getDoc(vRef);
    if (!vSnap.exists()) {
      throw new Error(`Vehicle ${vehicleId} not found`);
    }
    const vData = vSnap.data();
    const fromWarehouse = vData.warehouse || 'অনির্ধারিত';
    const vehiclePlate = vData.vehicleNumber || 'Unknown';

    // Check if exchange vehicle is selected
    let exchangePlate = '';
    let exchangeFromWarehouse = '';
    if (exchangeVehicleId) {
      const exRef = doc(db, 'vehicles', exchangeVehicleId);
      const exSnap = await getDoc(exRef);
      if (exSnap.exists()) {
        const exData = exSnap.data();
        exchangePlate = exData.vehicleNumber || 'Unknown';
        exchangeFromWarehouse = exData.warehouse || toWarehouse;

        // Update exchange vehicle to move to fromWarehouse
        await updateDoc(exRef, {
          warehouse: fromWarehouse,
          previousWarehouse: exchangeFromWarehouse,
          transferredAt: serverTimestamp(),
          updatedBy: getUserString(profile),
          updatedAt: serverTimestamp()
        });
      }
    }

    // Update main vehicle to target warehouse
    await updateDoc(vRef, {
      warehouse: toWarehouse,
      previousWarehouse: fromWarehouse,
      transferredAt: serverTimestamp(),
      updatedBy: getUserString(profile),
      updatedAt: serverTimestamp()
    });

    // Log to transfers collection
    const transferPayload: any = {
      type: exchangeVehicleId ? 'exchange' : 'vehicle',
      targetId: vehicleId,
      targetName: vehiclePlate,
      targetRole: 'Vehicle',
      fromWarehouse,
      toWarehouse,
      reason: reason.trim(),
      transferredBy: getUserString(profile),
      createdAt: serverTimestamp()
    };

    if (exchangeVehicleId) {
      transferPayload.exchangeVehicleId = exchangeVehicleId;
      transferPayload.exchangeVehiclePlate = exchangePlate;
    }

    const transferDoc = await addDoc(collection(db, 'transfers'), transferPayload);

    // Also add to vehicle status log for record keeping
    await addDoc(collection(db, 'vehicle_status_logs'), {
      vehicleId,
      vehiclePlate,
      oldStatus: vData.status || 'Available',
      newStatus: vData.status || 'Available',
      notes: `Warehouse Transfer: ${fromWarehouse} ➔ ${toWarehouse}. Reason: ${reason || 'N/A'}`,
      createdBy: getUserString(profile),
      createdAt: serverTimestamp()
    });

    return transferDoc;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `vehicles/${vehicleId}/transfer`);
    throw error;
  }
};

export const transferStaff = async (
  staffDocId: string, 
  toWarehouse: string, 
  reason: string = '', 
  profile?: any
) => {
  try {
    const sRef = doc(db, 'drivers', staffDocId);
    const sSnap = await getDoc(sRef);
    if (!sSnap.exists()) {
      throw new Error(`Staff ${staffDocId} not found`);
    }
    const sData = sSnap.data();
    const fromWarehouse = sData.warehouse || 'অনির্ধারিত';
    const staffName = sData.name || 'Unknown Staff';
    const staffRole = sData.role || 'Driver';
    const staffId = sData.driverId || '';

    // Update driver/helper doc
    await updateDoc(sRef, {
      warehouse: toWarehouse,
      previousWarehouse: fromWarehouse,
      transferredAt: serverTimestamp(),
      updatedBy: getUserString(profile),
      updatedAt: serverTimestamp()
    });

    // Log to transfers collection
    const transferDoc = await addDoc(collection(db, 'transfers'), {
      type: 'staff',
      targetId: staffDocId,
      targetName: `${staffName} (${staffId})`,
      targetRole: staffRole,
      fromWarehouse,
      toWarehouse,
      reason: reason.trim(),
      transferredBy: getUserString(profile),
      createdAt: serverTimestamp()
    });

    return transferDoc;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `drivers/${staffDocId}/transfer`);
    throw error;
  }
};

export const batchAssignWarehouse = async (
  collectionName: 'vehicles' | 'drivers', 
  itemIds: string[], 
  warehouse: string, 
  profile?: any
) => {
  try {
    const batch = writeBatch(db);
    const timestamp = serverTimestamp();
    const userStr = getUserString(profile);

    itemIds.forEach(id => {
      const ref = doc(db, collectionName, id);
      batch.update(ref, {
        warehouse,
        updatedBy: userStr,
        updatedAt: timestamp
      });
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${collectionName}/batchAssign`);
    throw error;
  }
};

