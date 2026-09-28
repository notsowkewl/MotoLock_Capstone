import type { IdentityMetadata } from './identity-status';

export interface Motorcycle {
  id: number;
  plate_number: string;
  model: string;
  year?: string | number;
  color?: string;
}
export interface Contact {
  id: number;
  name: string;
  phone?: string;
  phone_number?: string;
  role?: string;
}
export interface Rider {
  id: string;
  name?: string;
  full_name: string;
  email: string;
  phone?: string;
  role: string;
  created_at?: string;
  updated_at?: string;
  face_enrolled?: boolean;
  motorcycles?: Motorcycle[];
  contacts?: Contact[];
}
export interface Device {
  helmet_device_id?: string | null;
  helmet_visual_id?: string | null;
  id: string | number;
  user_id: string;
  rider_name?: string;
  status?: string;
  relay_status?: boolean;
  is_locked?: boolean;
  recorded_status?: { lock?: import('./monitoring-records').RecordedState; relay?: import('./monitoring-records').RecordedState };
  model?: string;
}
export interface SafetyLog extends IdentityMetadata {
  device_id?: string | number | null;
  severity?: string;
  severity_level?: string;
  identity_display?: { verification: import('./identity-status').IdentityVerification; lockAction: import('./identity-status').IdentityLockAction };
  id: string | number;
  created_at: string;
  full_name: string;
  email: string;
  brac: string;
  status: string;
  unlock_status?: string;
  motorcycle_id?: string | number;
  alcohol_detected?: boolean;
  face_verified?: boolean;
  helmet_verified?: boolean;
  failure_reason?: string;
  reason?: string;
  current_stage?: string;
}
export interface AuditLog {
  id: number;
  created_at: string;
  action: string;
  module: string;
  target_record?: string;
  admin_name?: string;
}
export interface DashboardData {
  totalRiders: number;
  totalMotorcycles: number;
  activeDevices: number;
  recentOverrides: number;
  todaysRides: number;
  failedTests: number;
  sobrietySummary?: { date: string; passed: string | number; failed: string | number }[];
  recentAlerts?: SafetyLog[];
}
// Report categories share a preview table but expose different columns.
export interface ReportRow {
  failure_reason?: string;
  id: string | number;
  created_at?: string;
  full_name?: string;
  email?: string;
  brac?: string;
  status?: string;
  phone?: string;
  role?: string;
  face_enrolled?: boolean;
  action?: string;
  model?: string;
  unlock_status?: string;
}
export interface Ride {
  id: number;
  status: string;
  start_time?: string;
  brac_level?: number;
  users?: { name: string } | null;
}
type Success = { success: boolean };
export type ApiResponses = {
  '/auth/login': Success & { token: string; user: Rider };
  '/admin/dashboard': Success & DashboardData;
  '/admin/users': Success & { users: Rider[] };
  '/admin/override-logs': Success & { logs: SafetyLog[] };
  '/admin/audit-logs': Success & { logs: AuditLog[] };
  '/admin/settings': Success & { settings: Record<string, string> };
  '/admin/devices': Success & { devices: Device[] };
  '/admin/notifications': Success & { notifications: SafetyLog[] };
  '/admin/motorcycles': Success & { motorcycle: Motorcycle };
  '/admin/contacts': Success & { contact: Contact };
} & {
  [endpoint: `/admin/users/${string}` | `/admin/motorcycles/${number}` | `/admin/contacts/${number}`]: Success;
};
