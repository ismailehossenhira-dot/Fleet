import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { auth } from '../firebase';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const DOCUMENT_TYPES = ['RP', 'FC', 'TT', 'RC', 'ADS'] as const;
export type DocumentType = typeof DOCUMENT_TYPES[number];

export const STAFF_ROLES = ['Driver', 'Helper'] as const;
export type StaffRole = typeof STAFF_ROLES[number];

export const VEHICLE_TYPES = ['Small', 'Medium', 'Large'] as const;
export type VehicleType = typeof VEHICLE_TYPES[number];

export const VEHICLE_STATUSES = ['Available', 'On Trip', 'Maintenance'] as const;
export type VehicleStatus = typeof VEHICLE_STATUSES[number];

export const INSPECTION_ITEMS = [
  { id: 'jackLever', label: 'Jack Lever' },
  { id: 'wrench', label: 'Wrench' },
  { id: 'spareTire', label: 'Spare Tire' },
] as const;

export type InspectionStatus = 'OK' | 'Missing';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
