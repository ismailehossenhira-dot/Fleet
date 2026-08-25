import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { auth } from '../firebase';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Restricts phone number input to digits only and maximum 11 digits.
 * Converts Bengali digits (০-৯) to English (0-9) automatically.
 */
export function sanitizePhoneNumber(value: string, maxLength: number = 11): string {
  if (!value) return '';
  const bengaliToEnglish: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  const normalized = String(value).replace(/[০-৯]/g, d => bengaliToEnglish[d] || d);
  const digitsOnly = normalized.replace(/\D/g, '');
  return digitsOnly.slice(0, maxLength);
}

export const DOCUMENT_TYPES = ['RP', 'FC', 'TT', 'RC', 'ADS'] as const;
export type DocumentType = typeof DOCUMENT_TYPES[number];

export const STAFF_ROLES = ['Driver', 'Helper'] as const;
export type StaffRole = typeof STAFF_ROLES[number];

export const FAMILY_RELATIONS = [
  { value: 'Father', label: 'বাবা (Father)' },
  { value: 'Mother', label: 'মা (Mother)' },
  { value: 'Wife', label: 'স্ত্রী (Wife)' },
  { value: 'Husband', label: 'স্বামী (Husband)' },
  { value: 'Brother', label: 'ভাই (Brother)' },
  { value: 'Sister', label: 'বোন (Sister)' },
  { value: 'Son', label: 'ছেলে (Son)' },
  { value: 'Daughter', label: 'মেয়ে (Daughter)' },
  { value: 'Guardian', label: 'অভিভাবক (Guardian)' },
  { value: 'Uncle', label: 'চাচা / মামা (Uncle)' },
  { value: 'Relative', label: 'আত্মীয় / স্বজন (Relative)' },
  { value: 'Other', label: 'অন্যান্য (Other)' }
] as const;

export type FamilyRelation = typeof FAMILY_RELATIONS[number]['value'];

export const VEHICLE_TYPES = [
  'Dost Plus',
  'Leo',
  'Partner 1.5T',
  'Partner 3T',
  'AL 12-14',
  'Tata 407',
  'Tata XL',
  'V 20'
] as const;
export type VehicleType = typeof VEHICLE_TYPES[number] | string;

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
  const errMessage = error instanceof Error ? error.message : String(error);
  
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
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
