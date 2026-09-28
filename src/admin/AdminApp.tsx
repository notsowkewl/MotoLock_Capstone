import OrganizedReports from './OrganizedReports';
import { emptyReportSources } from './organized-report-data';
import type { ReportSources } from './organized-report-data';
import DashboardPanels from './DashboardPanels';
import DashboardSearch from './DashboardSearch';
import { createBackup } from './backup-export';
import './ReportsPage.css';
import './AdminLayout.css';
import type { ReportSnapshot } from './report-snapshot';
import React, { useState, useEffect, useCallback } from 'react';
import type { Rider, Device, SafetyLog, AuditLog, DashboardData, ApiResponses } from './types';
import './browser-libraries';
import AlertsPage from './AlertsPage';
import DevicesPage from './DevicesPage';
import LiveMonitoringPage from './LiveMonitoringPage';
import { attachMonitoringRecords } from './monitoring-records';
import RidersPage from './RidersPage';
import SettingsSave from './SettingsSave';
import './SettingsPage.css';
import TablePagination, { useTablePagination } from './TablePagination';
import AuditLogsPage from './AuditLogsPage';
import { normalizeAuditLog, sortAuditLogs } from './audit-records';
import type { AlertStore } from './alert-records';
import { getIdentityDisplay, getIdentityLockAction, formatVerificationTime, getVerificationMethod, getIdentityDetails, filterIdentityRecords } from './identity-status';
import { alcoholResults, overallStatuses, getSobrietyOutcome, getSobrietyDetails } from './sobriety-status';

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
const describeEdgeFunctionError = (error: { message: string; context?: unknown }) => {
  const context = error.context;
  if (context instanceof Response) {
    return `Account service returned HTTP ${context.status}. Check that the Supabase Edge Function is deployed and try again.`;
  }
  if (error.message.toLowerCase().includes('failed to send a request')) {
    return 'Cannot reach the Supabase account service. Check your internet connection and confirm the admin-create-user/admin-update-user Edge Functions are deployed to this Supabase project.';
  }
  return error.message;
};

const SUPABASE_URL = 'https://bafziqymbvhrytziteuo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhZnppcXltYnZocnl0eml0ZXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjAzMzUsImV4cCI6MjEwMzk5NjMzNX0.F1KVSKnN_x-8O2gKlh0d8XPydlBWTcsS0GPbCS6CP_c';
const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const clearPersistedAdminSession = () => {
  localStorage.removeItem('ml_token');
  localStorage.removeItem('ml_email');
  localStorage.removeItem('ml_role');
  sessionStorage.removeItem('ml_token');
  sessionStorage.removeItem('ml_email');
  sessionStorage.removeItem('ml_role');
};

interface SupabaseRecord extends Record<string, unknown> {
  id?: string | number;
  created_at?: string;
  updated_at?: string;
  start_time?: string;
  user_id?: string;
  device_id?: string | number | null;
  motorcycle_id?: string | number | null;
  status?: string;
  initial_brac_level?: string | number | null;
  face_verified?: boolean;
  helmet_verified?: boolean;
  name?: string;
  full_name?: string;
  email?: string;
  role?: string;
  face_descriptor?: unknown;
  face_enrolled?: boolean;
  phone_number?: string;
  relationship?: string;
  unlock_status?: string;
  model?: string;
  firmware_version?: string;
  action_type?: string;
  action_details?: unknown;
  setting_key?: string;
  setting_value?: string;
}

const SUPABASE_PAGE_SIZE = 1000;
const sampleContactNames: Record<string, string> = {
  '4139d5f7-def8-5e0a-bb9c-e133268350f0': 'Maria Lourdes Basilio',
  'f02ba8e0-e1ad-5e17-8b20-6e5358489bfe': 'Ramon Basilio',
  '017066c1-6571-560b-80e0-e5ac9246ae77': 'Angela Baculi',
  '6607c980-3ee0-54ff-9d23-7244fc6f5e73': 'Mark Baculi',
  'ae8f5e97-7011-50d8-bafe-45aca600aa38': 'Catherine Roxas',
  '23bc5655-991b-5410-9267-dca26aebe46e': 'Paolo Roxas',
  '36a25b4e-5f8a-5202-bb29-a4f6103365d9': 'Rochelle Diaz',
  '6cbfce8d-97e1-5428-a9c6-edbcaaf0d579': 'Miguel Diaz',
  '9701544d-3481-55eb-82bf-84c34a5e13de': 'Grace Atractibo',
  'a601a2a6-497c-53ee-b0da-2061e444eb6d': 'Daniel Atractibo',
  'c9260b32-22c8-5e4b-bd9d-228cd368a946': 'Liza Rotoni',
  '3e926011-c9c4-5526-8372-125b182e24a5': 'Carlo Rotoni',
  'ff923600-daed-5312-ba00-0ba7c55c4787': 'Teresa Olaybal',
  '8c6c544b-f8b6-5118-8990-3942ed956b3b': 'Noel Olaybal',
};

const displayContactName = (contact: { id?: string | number; name?: string }) => {
  const name = contact.name || '';
  if (!/^sample contact\s/i.test(name)) return name;
  return sampleContactNames[String(contact.id)] || 'Emergency Contact';
};

const invokeAdminData = async <T extends Record<string, unknown>>(body: Record<string, unknown>): Promise<T> => {
  if (!supabaseClient) throw new Error('Supabase client is not available.');
  const { data, error } = await supabaseClient.functions.invoke('admin-data', { body });
  if (error) {
    const response = error.context;
    const errorBody = response instanceof Response ? await response.clone().json().catch(() => null) : null;
    throw new Error(data?.error || errorBody?.error || describeEdgeFunctionError(error));
  }
  if (!data || typeof data !== 'object') throw new Error('The admin data service returned an invalid response.');
  if (typeof data.error === 'string') throw new Error(data.error);
  return data as T;
};

const fetchAllSupabaseRows = async (table: string, orderBy = 'id', _columns = '*'): Promise<SupabaseRecord[]> => {
  const rows: SupabaseRecord[] = [];
  for (let offset = 0; ; offset += SUPABASE_PAGE_SIZE) {
    const page = await invokeAdminData<{ rows: SupabaseRecord[]; hasMore: boolean }>({
      action: 'select', table, orderBy, offset,
    });
    rows.push(...(page.rows || []));
    if (!page.hasMore) return rows;
  }
};

const alertStore: AlertStore = {
  read: fetchAllSupabaseRows,
  getActor: async () => {
    const { profile } = await invokeAdminData<{ profile: Rider }>({ action: 'profile' });
    return profile;
  },
  insert: async event => {
    const result = await invokeAdminData<{ row: Record<string, unknown> }>({
      action: 'insert-audit',
      action_type: event.action_type,
      action_details: event.action_details,
    });
    if (!result.row) throw new Error('Supabase did not confirm the resolution. Refresh alerts before retrying.');
    return result.row;
  },
};



const API = 'http://192.168.1.24:5001/api';

// Professional SVG Vector Icon component to replace all emojis
const Icon = ({ name, size = 18, color = 'currentColor' }: { name: string, size?: number, color?: string }) => {
  const paths: Record<string, string> = {
    dashboard: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
    monitoring: "M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7l-2 3v1h8v-1l-2-3h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z",
    map: "M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.27-.36.5v15.14c0 .3.24.54.54.54l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.27.36-.5V3.54c0-.3-.24-.54-.54-.54zM15 19l-6-2.11V5l6 2.11V19z",
    riders: "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm8 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm-8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19H2v-2.5c0-2.33 4.67-3.5 7-3.5z",
    devices: "M19 13c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm-14 0c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm12.5-6c-.77 0-1.47.4-1.85 1.05l-3.32 5.56H9.08L6.4 8.7c-.37-.65-1.07-1.05-1.85-1.05H2v2h2.55c.26 0 .49.13.62.35l2.79 4.83c.37.65 1.07 1.05 1.85 1.05h5.83c.78 0 1.48-.4 1.85-1.05l3.52-5.88V7h-2.5z",
    sobriety: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2z",
    identity: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z",
    alerts: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z",
    warning: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2V9h2v5z",
    check: "M9 16.17 4.83 12 3.41 13.41 9 19l12-12-1.41-1.41z",
    close: "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
    person: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
    helmet: "M12 3a9 9 0 0 0-9 9v3h18v-3a9 9 0 0 0-9-9zm-7 10v-1a7 7 0 0 1 14 0v1H5zm-2 4h12v2H3z",
    lock: "M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9zm3 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4z",
    unlock: "M18 8h-8V6a3 3 0 0 1 5.83-.99l1.94-.5A5 5 0 0 0 8 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4z",
    refresh: "M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.93 9h-2.02A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z",
    analytics: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z",
    reports: "M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z",
    audit: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z",
    users: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
    health: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
    settings: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z",
    backup: "M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z",
    logout: "M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z",
    notification: "M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z",
    light: "M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.01c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z",
    dark: "M9.37 5.51A7.35 7.35 0 0 0 9.1 7.5c0 4.08 3.32 7.4 7.4 7.4.68 0 1.35-.09 1.99-.27A7.4 7.4 0 1 1 9.37 5.51z",
    org: "M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm10 12h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm6 12h-2v-2h2v2zm0-4h-2v-2h2v2z",
    clock: "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z",
    preferences: "M3 17v2h6v-2H3zm0-10v2h10V7H3zm10 12v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h-2V5h-2v6h2V9z",
    shield: "M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm-2 14.5l-3.5-3.5 1.41-1.41L10 13.67l5.09-5.09 1.41 1.41L10 16.5z",
    bell: "M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z",
    bluetooth: "M17.71 7.71L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm0 12.34v-3.76l1.88 1.88L13 18.17z",
    info: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
    lightning: "M7 2v11h3v9l7-12h-4l4-8z",
    eye: "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z",
    eyeOff: "M11.83 9L15 12.16V12a3 3 0 0 0-3-3h-.17zm-4.3.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.3-3.1c3.08 0 5.86 1.87 7.16 4.3-.59 1.12-1.37 2.11-2.27 2.9l-1.46-1.46a5.55 5.55 0 0 0 1.25-1.44c-1.12-2.11-3.35-3.5-5.83-3.5-.47 0-.94.06-1.39.17l-1.5-1.5c.92-.25 1.89-.37 2.89-.37zm-7.6 1.2L2.78 4.2 1.5 5.5l2.42 2.42C2.46 9.07 1.54 10.45 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l3.12 3.12 1.28-1.28-16.55-16.55zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2z",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d={paths[name] || ""} />
    </svg>
  );
};

// Custom styled Dropdown component
const CustomSelect = ({
  options,
  value,
  onChange,
  style
}: {
  options: { value: string; label: string; disabled?: boolean }[];
  value: string;
  onChange: (val: string) => void;
  style?: React.CSSProperties;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Reset filter when closed
  useEffect(() => {
    if (!isOpen) {
      setFilterText('');
    }
  }, [isOpen]);

  const filteredOptions = options.filter((opt, idx) => {
    if (!filterText) return true;
    if (opt.disabled) {
      let hasMatch = false;
      for (let i = idx + 1; i < options.length; i++) {
        if (options[i].disabled) break;
        if (options[i].label.toLowerCase().includes(filterText.toLowerCase())) {
          hasMatch = true;
          break;
        }
      }
      return hasMatch;
    }
    return opt.label.toLowerCase().includes(filterText.toLowerCase());
  });

  return (
    <div
      ref={containerRef}
      onClick={() => setIsOpen(!isOpen)}
      style={{
        padding: '12px 16px',
        background: 'var(--input-bg)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        color: 'var(--text)',
        fontSize: '14px',
        outline: 'none',
        width: '100%',
        position: 'relative',
        cursor: 'pointer',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingRight: '36px',
        boxSizing: 'border-box',
        ...style
      }}
    >
      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        {selectedOption ? selectedOption.label : ''}
      </span>
      <span style={{
        position: 'absolute',
        right: '16px',
        top: '50%',
        transform: 'translateY(-50%)',
        fontSize: '10px',
        color: 'var(--muted)',
        pointerEvents: 'none',
        transition: 'transform 0.2s',
        ...(isOpen ? { transform: 'translateY(-50%) rotate(180deg)' } : {})
      }}>
        ▼
      </span>
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '108%',
          left: 0,
          right: 0,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          zIndex: 9999,
          overflow: 'hidden',
          maxHeight: '340px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {options.length > 5 && (
            <div style={{ padding: '8px', borderBottom: '1px solid var(--border)', background: 'var(--card)' }} onClick={e => e.stopPropagation()}>
              <input
                type="text"
                placeholder="Type to filter..."
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text)',
                  fontSize: '12px',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>
          )}
          <div style={{ overflowY: 'auto', flex: 1, maxHeight: '260px' }}>
            {filteredOptions.map(opt => (
              <div
                key={opt.value}
                onClick={(e) => {
                  e.stopPropagation();
                  if (opt.disabled) return;
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                style={{
                  padding: opt.disabled ? '8px 16px' : '10px 16px',
                  background: opt.disabled ? 'rgba(128,128,128,0.03)' : (opt.value === value ? 'var(--border)' : 'transparent'),
                  color: opt.disabled ? 'var(--red)' : 'var(--text)',
                  fontSize: opt.disabled ? '11px' : '13px',
                  fontWeight: opt.disabled ? 700 : 'normal',
                  transition: opt.disabled ? 'none' : 'background 0.2s',
                  textAlign: 'left',
                  cursor: opt.disabled ? 'default' : 'pointer'
                }}
                onMouseEnter={(e) => {
                  if (!opt.disabled) {
                    e.currentTarget.style.background = 'var(--border)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!opt.disabled && opt.value !== value) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function AdminApp() {
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarHoverOpen, setSidebarHoverOpen] = useState(false);
  const [token, setToken] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminRole, setAdminRole] = useState('admin');
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState<string>(() => localStorage.getItem('ml_tab') || 'dashboard');
  useEffect(() => { localStorage.setItem('ml_tab', activeTab); }, [activeTab]);
  const [isLightMode, setIsLightMode] = useState<boolean>(localStorage.getItem('ml_theme') === 'light');
  const [notifications, setNotifications] = useState<SafetyLog[]>([]);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);

  useEffect(() => {
    const closeSidebarOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarPinned(false);
        setSidebarHoverOpen(false);
      }
    };
    window.addEventListener('keydown', closeSidebarOnEscape);
    return () => window.removeEventListener('keydown', closeSidebarOnEscape);
  }, []);

  useEffect(() => {
    let active = true;
    const authSubscription = supabaseClient?.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT') {
        clearPersistedAdminSession();
        setToken('');
        setAdminEmail('');
        setAdminRole('admin');
      } else if (event === 'TOKEN_REFRESHED' && session) {
        setToken(session.access_token);
      }
    }).data.subscription;

    void (async () => {
      try {
        if (!supabaseClient) throw new Error('Supabase client is not available.');
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        if (session) {
          const { profile } = await invokeAdminData<{ profile: Rider }>({ action: 'profile' });
          if (!['admin', 'superadmin'].includes(profile.role)) {
            await supabaseClient.auth.signOut({ scope: 'local' });
            clearPersistedAdminSession();
          } else if (active) {
            setToken(session.access_token);
            setAdminEmail(profile.email || session.user.email || '');
            setAdminRole(profile.role);
          }
        }
      } catch (error) {
        const message = errorMessage(error);
        const invalidSession = /invalid|expired|only administrators|sign in as an administrator/i.test(message);
        if (invalidSession) {
          clearPersistedAdminSession();
          await supabaseClient?.auth.signOut({ scope: 'local' }).catch(() => undefined);
        } else if (active) {
          setAuthError('Could not verify the saved admin session. Check your connection and reload to try again.');
        }
      } finally {
        if (active) setAuthReady(true);
      }
    })();

    return () => {
      active = false;
      authSubscription?.unsubscribe();
    };
  }, []);

  // Login Form States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Global Data Cache
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardUpdatedAt, setDashboardUpdatedAt] = useState<string | null>(null);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('ml_last_backup_generated');
      return saved && Number.isFinite(Date.parse(saved)) ? saved : null;
    } catch { return null; }
  });
  const [riders, setRiders] = useState<Rider[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [overrides, setOverrides] = useState<SafetyLog[]>([]);
  const [sobrietyResultFilter, setSobrietyResultFilter] = useState('all');
  const [sobrietyStatusFilter, setSobrietyStatusFilter] = useState('all');
  const [sobrietySearch, setSobrietySearch] = useState('');
  const [identityResultFilter, setIdentityResultFilter] = useState('all');
  const [identitySearch, setIdentitySearch] = useState('');
  const [identityDetails, setIdentityDetails] = useState<{ title: string; text: string } | null>(null);
  const [identityActionFilter, setIdentityActionFilter] = useState('all');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Search/Filter states

  // Custom Modal dialog states
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMsg, setAlertMsg] = useState('');
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMsg, setConfirmMsg] = useState('');
  const [confirmCallback, setConfirmCallback] = useState<(() => void) | null>(null);

  // Add User Form States
  const [showAddUser, setShowAddUser] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('rider');
  const [addUserErrors, setAddUserErrors] = useState<Record<string, string>>({});

  // Manage Rider Form States
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [manageTab, setManageTab] = useState<'profile' | 'motorcycles' | 'contacts'>('profile');

  // Profile edit states
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('rider');

  // Contact add states
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRole, setNewContactRole] = useState('Primary Contact');

  // Motorcycle add states
  const [newPlateNumber, setNewPlateNumber] = useState('');
  const [newMotorcycleModel, setNewMotorcycleModel] = useState('');
  const [newMotorcycleYear, setNewMotorcycleYear] = useState('');
  const [newMotorcycleColor, setNewMotorcycleColor] = useState('');


  // Settings Edit states
  const [alcoholThreshold, setAlcoholThreshold] = useState('0.05');
  const sobrietyTests = overrides.map(log => ({ log, ...getSobrietyOutcome(log, alcoholThreshold) }));
  const filteredIdentityRecords = filterIdentityRecords(sobrietyTests.map(({ log, alcoholResult }) => ({
    ...log,
    identity_display: log.identity_display ? {
      ...log.identity_display,
      lockAction: getIdentityLockAction(log.identity_display, alcoholResult),
    } : undefined,
  })), identitySearch, identityResultFilter, identityActionFilter);
  const filteredSobrietyTests = sobrietyTests.filter(test =>
    test.log.full_name.toLocaleLowerCase().includes(sobrietySearch.trim().toLocaleLowerCase())
    && (sobrietyResultFilter === 'all' || test.alcoholResult === sobrietyResultFilter)
    && (sobrietyStatusFilter === 'all' || test.overallStatus === sobrietyStatusFilter)
  ).sort((a, b) => {
    const aTime = Date.parse(a.log.created_at);
    const bTime = Date.parse(b.log.created_at);
    // Sort the saved Supabase timestamps; records without a valid time go last.
    return (Number.isFinite(bTime) ? bTime : -Infinity)
      - (Number.isFinite(aTime) ? aTime : -Infinity);
  });
  const sobrietyPagination = useTablePagination(filteredSobrietyTests, JSON.stringify([sobrietySearch, sobrietyResultFilter, sobrietyStatusFilter, alcoholThreshold]));
  const identityPagination = useTablePagination(filteredIdentityRecords, JSON.stringify([identitySearch, identityResultFilter, identityActionFilter, alcoholThreshold]));
  const [lockoutLimit, setLockoutLimit] = useState('3');
  const [sessionTimeout, setSessionTimeout] = useState('30');

  // Settings layout states matching mock-up screenshot
  const [orgName, setOrgName] = useState(localStorage.getItem('set_orgName') || 'MotoLock IoT Safety System');
  const [orgTagline, setOrgTagline] = useState(localStorage.getItem('set_orgTagline') || 'Smart Safety. Secure Ride.');
  const [orgAddress, setOrgAddress] = useState(localStorage.getItem('set_orgAddress') || '123 Safety Street, Tech City, Philippines');
  const [orgTimezone, setOrgTimezone] = useState(localStorage.getItem('set_orgTimezone') || 'Asia/Manila');
  const [orgLanguage, setOrgLanguage] = useState(localStorage.getItem('set_orgLanguage') || 'English');
  const [dateFormat, setDateFormat] = useState(localStorage.getItem('set_dateFormat') || 'MM/DD/YYYY');
  const [timeFormat, setTimeFormat] = useState(localStorage.getItem('set_timeFormat') || '12-Hour (AM/PM)');
  const [autoSyncTime, setAutoSyncTime] = useState(localStorage.getItem('set_autoSyncTime') !== 'false');
  const [maintenanceMode, setMaintenanceMode] = useState(localStorage.getItem('set_maintenanceMode') === 'true');
  const [allowRegistrations, setAllowRegistrations] = useState(localStorage.getItem('set_allowRegistrations') !== 'false');
  const [autoLogCleanup, setAutoLogCleanup] = useState(localStorage.getItem('set_autoLogCleanup') !== 'false');
  const [passwordPolicy, setPasswordPolicy] = useState(localStorage.getItem('set_passwordPolicy') !== 'false');
  const [twoFactorAuth, setTwoFactorAuth] = useState(localStorage.getItem('set_twoFactorAuth') === 'true');
  const [loginAttemptLimit, setLoginAttemptLimit] = useState(localStorage.getItem('set_loginAttemptLimit') || '5');
  const [lockoutDuration, setLockoutDuration] = useState(localStorage.getItem('set_lockoutDuration') || '15');
  const [failedSobrietyAlert, setFailedSobrietyAlert] = useState(localStorage.getItem('set_failedSobrietyAlert') || '1');
  const [overrideEventAlert, setOverrideEventAlert] = useState(localStorage.getItem('set_overrideEventAlert') || '1');
  const [criticalAlertEscalation, setCriticalAlertEscalation] = useState(localStorage.getItem('set_criticalAlertEscalation') || '5');
  const [scanInterval, setScanInterval] = useState(localStorage.getItem('set_scanInterval') || '10');
  const [bluetoothTimeout, setBluetoothTimeout] = useState(localStorage.getItem('set_bluetoothTimeout') || '30');
  const [autoReconnect, setAutoReconnect] = useState(localStorage.getItem('set_autoReconnect') !== 'false');

  const [savedSettings, setSavedSettings] = useState<Record<string, string>>(() => ({
    org_name: orgName,
    org_tagline: orgTagline,
    org_address: orgAddress,
    org_timezone: orgTimezone,
    org_language: orgLanguage,
    maintenance_mode: String(maintenanceMode),
    allow_registrations: String(allowRegistrations),
    auto_log_cleanup: String(autoLogCleanup),
    session_timeout: sessionTimeout,
    failed_sobriety_alert: failedSobrietyAlert,
    override_event_alert: overrideEventAlert,
    critical_alert_escalation: criticalAlertEscalation,
    alcohol_threshold: alcoholThreshold,
    date_format: dateFormat,
    time_format: timeFormat,
    auto_sync_time: String(autoSyncTime),
    password_policy: String(passwordPolicy),
    two_factor_auth: String(twoFactorAuth),
    login_attempt_limit: loginAttemptLimit,
    lockout_duration: lockoutDuration,
    lockout_limit: lockoutLimit,
    scan_interval: scanInterval,
    bluetooth_timeout: bluetoothTimeout,
    auto_reconnect: String(autoReconnect)
  }));
  const settingsDirty = (values: Record<string, string>) => Object.entries(values).some(([key, value]) => savedSettings[key] !== value);

  const [reportSources, setReportSources] = useState<ReportSources>(emptyReportSources);

  // Apply visual theme class on change
  useEffect(() => {
    if (isLightMode) {
      document.body.classList.add('light-mode');
      localStorage.setItem('ml_theme', 'light');
    } else {
      document.body.classList.remove('light-mode');
      localStorage.setItem('ml_theme', 'dark');
    }
  }, [isLightMode]);

  // Auth fetch wrapper
  const apiFetch = useCallback(async <K extends keyof ApiResponses>(endpoint: K, options: RequestInit = {}): Promise<ApiResponses[K]> => {
    try {
      if (endpoint === '/auth/login') {
        const body = JSON.parse(typeof options.body === 'string' ? options.body : '{}');
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
          email: body.email,
          password: body.password,
        });
        if (authError || !authData.user || !authData.session) throw new Error(authError?.message || 'Invalid email or password');

        try {
          const { profile } = await invokeAdminData<{ profile: Rider }>({ action: 'profile' });
          return { success: true, token: authData.session.access_token, user: profile } as ApiResponses[K];
        } catch (error) {
          await supabaseClient.auth.signOut({ scope: 'local' });
          throw error;
        }
      }
      if (endpoint === '/admin/dashboard') {
        const [users, motorcycles, rides, devices] = await Promise.all([
          fetchAllSupabaseRows('users'), fetchAllSupabaseRows('motorcycles'),
          fetchAllSupabaseRows('ride_history'), fetchAllSupabaseRows('devices'),
        ]);
        return {
          success: true,
          totalRiders: users.length,
          totalMotorcycles: motorcycles.length,
          activeDevices: devices.filter((d) => d.status === 'online').length,
          recentOverrides: 0,
          todaysRides: rides.length,
          failedTests: rides.filter((r) => r.status === 'failed_brac').length
        } as ApiResponses[K];
      }
      if (endpoint === '/admin/users' && (!options.method || options.method === 'GET')) {
        const data = await fetchAllSupabaseRows('users');
        const mappedUsers = data.map((u) => ({
          ...u,
          full_name: u.name || u.full_name // Map name column for UI backwards compatibility
        }));
        return { success: true, users: mappedUsers } as ApiResponses[K];
      }
      if (endpoint.startsWith('/admin/motorcycles')) {
        return { success: true, motorcycle: { id: 999, ...JSON.parse(typeof options.body === 'string' ? options.body : '{}') } } as ApiResponses[K];
      }

      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      const response = await fetch(`${API}${endpoint}`, {
        ...options,
        headers: { ...headers, ...options.headers }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'API request failed');
      return data;
    } catch (err) {
      throw new Error(errorMessage(err));
    }
  }, [token]);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPass })
      });
      if (res.token) {
        setToken(res.token);
        setAdminEmail(loginEmail);
        setAdminRole(res.user.role);
        setAuthError('');
        setActiveTab('dashboard');
        triggerAuditLog('Logged In', 'Authentication', loginEmail);
      }
    } catch (err) {
      setLoginError(errorMessage(err) || 'Failed to authenticate');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    triggerAuditLog('Logged Out', 'Authentication', adminEmail);
    void supabaseClient.auth.signOut({ scope: 'local' });
    clearPersistedAdminSession();
    setToken('');
    setAdminEmail('');
    setAdminRole('admin');
  };

  // Log administrative actions
  const triggerAuditLog = async (action: string, module: string, targetRecord: string) => {
    try {
      if (!supabaseClient) throw new Error('Supabase client is not available.');
      await invokeAdminData({
        action: 'insert-audit',
        action_type: action,
        action_details: { module, target_record: targetRecord },
      });
      void fetchAuditLogs();
    } catch (error) { console.error(error); }
  };

  // Fetch data functions
  const fetchDashboardStats = useCallback(async () => {
    try {
      const [users, motorcycles, rides, deviceRows] = await Promise.all([
        fetchAllSupabaseRows('users'),
        fetchAllSupabaseRows('motorcycles'),
        fetchAllSupabaseRows('ride_history'),
        fetchAllSupabaseRows('devices'),
      ]);
      const dayKey = (value: string | Date) => {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      const sobrietyByDay = new Map<string, { date: string; passed: number; failed: number }>();
      for (const ride of rides) {
        const rideDate = new Date(ride.start_time || '');
        if (!ride.start_time || Number.isNaN(rideDate.getTime())) continue;
        const date = dayKey(rideDate);
        const summary = sobrietyByDay.get(date) || { date, passed: 0, failed: 0 };
        if (['completed', 'passed'].includes(String(ride.status).toLowerCase())) summary.passed += 1;
        if (['failed_brac', 'failed_face'].includes(String(ride.status).toLowerCase())) summary.failed += 1;
        sobrietyByDay.set(date, summary);
      }
      const usersById = new Map(users.map((user) => [user.id, user]));
      const devicesById = new Map(deviceRows.map((device) => [device.id, device]));
      const recentAlerts = rides
        .filter((ride) => ['failed_brac', 'failed_face', 'failed_helmet'].includes(String(ride.status).toLowerCase()))
        .sort((a, b) => new Date(b.start_time || '').getTime() - new Date(a.start_time || '').getTime())
        .slice(0, 10)
        .map((ride) => {
          const user = usersById.get(String(ride.user_id));
          return {
            ...ride,
            id: ride.id ?? '',
            created_at: ride.start_time || ride.created_at || '',
            status: ride.status || 'unknown',
            full_name: user?.name || user?.full_name || user?.email || 'Unknown rider',
            email: user?.email || '',
            motorcycle_id: devicesById.get(String(ride.device_id))?.motorcycle_id || '',
            brac: String(ride.initial_brac_level ?? 0),
            alcohol_detected: ride.status === 'failed_brac',
            face_verified: ride.status !== 'failed_face',
            helmet_verified: ride.status !== 'failed_helmet',
          };
        });
      setDashboardData({
        totalRiders: users.filter((user) => user.role === 'rider').length,
        totalMotorcycles: motorcycles.length,
        activeDevices: deviceRows.filter((device) => device.status === 'online').length,
        recentOverrides: rides.filter((ride) => String(ride.status || '').includes('override')).length,
        todaysRides: rides.filter((ride) => ride.start_time && dayKey(ride.start_time) === dayKey(new Date())).length,
        failedTests: rides.filter((ride) => ['failed_brac', 'failed_face'].includes(String(ride.status))).length,
        sobrietySummary: Array.from(sobrietyByDay.values()),
        recentAlerts,
      });
      setDashboardUpdatedAt(new Date().toISOString());
    } catch (error) { console.error(error); }
  }, []);

  const fetchRiders = useCallback(async () => {
    try {
      const [users, motorcycles, contacts] = await Promise.all([
        fetchAllSupabaseRows('users'),
        fetchAllSupabaseRows('motorcycles'),
        fetchAllSupabaseRows('emergency_contacts'),
      ]);
      setReportSources(previous => ({ ...previous, users, motorcycles, contacts }));
      const motorcyclesByUser = new Map<string, SupabaseRecord[]>();
      for (const motorcycle of motorcycles) {
        const userId = motorcycle.user_id || '';
        const current = motorcyclesByUser.get(userId) || [];
        current.push(motorcycle);
        motorcyclesByUser.set(userId, current);
      }
      const contactsByUser = new Map<string, SupabaseRecord[]>();
      for (const contact of contacts) {
        const userId = contact.user_id || '';
        const current = contactsByUser.get(userId) || [];
        current.push({ ...contact, name: displayContactName(contact), phone: contact.phone_number, role: contact.relationship });
        contactsByUser.set(userId, current);
      }
      setRiders(users.map((user) => ({
        ...user,
        id: String(user.id ?? ''),
        full_name: user.name || user.full_name || user.email || 'Unknown rider',
        email: user.email || '',
        role: user.role || 'rider',
        face_enrolled: Boolean(user.face_descriptor || user.face_enrolled),
        motorcycles: (motorcyclesByUser.get(String(user.id)) || []) as unknown as Rider['motorcycles'],
        contacts: (contactsByUser.get(String(user.id)) || []) as unknown as Rider['contacts'],
      })).sort((a, b) => {
        const aUpdated = Date.parse(a.updated_at || a.created_at || '') || 0;
        const bUpdated = Date.parse(b.updated_at || b.created_at || '') || 0;
        return bUpdated - aUpdated;
      }));
    } catch (error) { console.error(error); }
  }, []);

  const fetchOverrides = useCallback(async () => {
    try {
      const [rides, users] = await Promise.all([
        fetchAllSupabaseRows('ride_history'),
        fetchAllSupabaseRows('users'),
      ]);
      const usersById = new Map(users.map((user) => [String(user.id), user]));
      setReportSources(previous => ({ ...previous, rides }));
      setOverrides(rides.map((ride) => {
        const user = usersById.get(String(ride.user_id));
        return {
          ...ride,
          created_at: ride.start_time || ride.created_at || '',
          id: ride.id ?? '',
          motorcycle_id: ride.motorcycle_id ?? undefined,
          full_name: user?.name || user?.full_name || 'Unknown rider',
          email: user?.email || '',
          brac: String(ride.initial_brac_level ?? ''),
          status: ride.status || 'unknown',
          identity_display: getIdentityDisplay(ride),
          alcohol_detected: ['failed_brac'].includes(String(ride.status)),
          face_verified: ride.face_verified ?? (ride.status !== 'failed_face'),
          helmet_verified: ride.helmet_verified ?? (ride.status !== 'failed_helmet'),
        };
      }));
    } catch (error) { console.error(error); }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const [logs, users] = await Promise.all([
        fetchAllSupabaseRows('audit_logs'),
        fetchAllSupabaseRows('users'),
      ]);
      const usersById = new Map(users.map((user) => [String(user.id), user]));
      setReportSources(previous => ({ ...previous, events: logs }));
      setAuditLogs(sortAuditLogs(logs.map(log => normalizeAuditLog(log, usersById.get(String(log.user_id))?.name))));
    } catch (error) { console.error(error); }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const settings = await fetchAllSupabaseRows('system_settings', 'setting_key');
      if (settings.length) {
        const s = Object.fromEntries(settings.filter(row => row.setting_key).map((row) => [row.setting_key!, row.setting_value || '']));
        if (s.alcohol_threshold) setAlcoholThreshold(s.alcohol_threshold);
        if (s.lockout_limit) setLockoutLimit(s.lockout_limit);
        if (s.session_timeout) setSessionTimeout(s.session_timeout);
        if (s.org_name) setOrgName(s.org_name);
        if (s.org_tagline) setOrgTagline(s.org_tagline);
        if (s.org_address) setOrgAddress(s.org_address);
        if (s.org_timezone) setOrgTimezone(s.org_timezone);
        if (s.org_language) setOrgLanguage(s.org_language);
        if (s.date_format) setDateFormat(s.date_format);
        if (s.time_format) setTimeFormat(s.time_format);
        if (s.auto_sync_time !== undefined) setAutoSyncTime(s.auto_sync_time === 'true');
        if (s.maintenance_mode !== undefined) setMaintenanceMode(s.maintenance_mode === 'true');
        if (s.allow_registrations !== undefined) setAllowRegistrations(s.allow_registrations === 'true');
        if (s.auto_log_cleanup !== undefined) setAutoLogCleanup(s.auto_log_cleanup === 'true');
        if (s.password_policy !== undefined) setPasswordPolicy(s.password_policy === 'true');
        if (s.two_factor_auth !== undefined) setTwoFactorAuth(s.two_factor_auth === 'true');
        if (s.login_attempt_limit) setLoginAttemptLimit(s.login_attempt_limit);
        if (s.lockout_duration) setLockoutDuration(s.lockout_duration);
        if (s.failed_sobriety_alert) setFailedSobrietyAlert(s.failed_sobriety_alert);
        if (s.override_event_alert) setOverrideEventAlert(s.override_event_alert);
        if (s.critical_alert_escalation) setCriticalAlertEscalation(s.critical_alert_escalation);
        if (s.scan_interval) setScanInterval(s.scan_interval);
        if (s.bluetooth_timeout) setBluetoothTimeout(s.bluetooth_timeout);
        if (s.auto_reconnect !== undefined) setAutoReconnect(s.auto_reconnect === 'true');
        setSavedSettings(previous => ({ ...previous, ...Object.fromEntries(Object.entries(s).filter(([, value]) => value !== '')) }));
      }
    } catch (error) { console.error(error); }
  }, []);

  const saveSettingToDB = async (key: string, value: string) => {
    if (!supabaseClient) throw new Error('Supabase client is not available.');
    await invokeAdminData({ action: 'save-setting', setting_key: key, setting_value: value });
    setSavedSettings(previous => ({ ...previous, [key]: value }));
  };

  const fetchDevices = useCallback(async () => {
    try {
      const [deviceRows, users, motorcycles, rides, events] = await Promise.all([
        fetchAllSupabaseRows('devices'),
        fetchAllSupabaseRows('users'),
        fetchAllSupabaseRows('motorcycles'),
        fetchAllSupabaseRows('ride_history'),
        fetchAllSupabaseRows('audit_logs'),
      ]);
      const usersById = new Map(users.map((user) => [String(user.id), user]));
      const motorcyclesById = new Map(motorcycles.map((motorcycle) => [String(motorcycle.id), motorcycle]));
      setReportSources(previous => ({ ...previous, devices: deviceRows }));
      setDevices(attachMonitoringRecords(deviceRows.map((device) => ({
        ...device,
        id: device.id ?? '',
        user_id: device.user_id || '',
        model: motorcyclesById.get(String(device.motorcycle_id))?.model || device.firmware_version || 'MotoLock device',
        rider_name: usersById.get(String(device.user_id))?.name || 'Unassigned',
      })), rides, events));
    } catch (error) { console.error(error); }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const [rides, users] = await Promise.all([
        fetchAllSupabaseRows('ride_history'),
        fetchAllSupabaseRows('users'),
      ]);
      const usersById = new Map(users.map((user) => [String(user.id), user]));
      setNotifications(rides
        .filter((ride) => ['failed_brac', 'failed_face'].includes(String(ride.status)))
        .map((ride) => ({
          ...ride,
          id: ride.id ?? '',
          created_at: ride.start_time || ride.created_at || '',
          motorcycle_id: ride.motorcycle_id ?? undefined,
          status: ride.status || 'unknown',
          full_name: usersById.get(String(ride.user_id))?.name || 'Unknown rider',
          email: usersById.get(String(ride.user_id))?.email || '',
          brac: String(ride.initial_brac_level ?? 0),
          alcohol_detected: ride.status === 'failed_brac',
        })));
    } catch (error) { console.error(error); }
  }, []);

  const loadAllData = useCallback(async () => {
    await Promise.all([
      fetchDashboardStats(),
      fetchRiders(),
      fetchOverrides(),
      fetchAuditLogs(),
      fetchSettings(),
      fetchDevices(),
      fetchNotifications()
    ]);
  }, [fetchDashboardStats, fetchRiders, fetchOverrides, fetchAuditLogs, fetchSettings, fetchDevices, fetchNotifications]);

  useEffect(() => {
    if (token) {
      loadAllData();
      const interval = setInterval(() => {
        fetchDashboardStats();
        fetchNotifications();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [token, loadAllData, fetchDashboardStats, fetchNotifications]);

  // Helper alerts
  const showCustomAlert = (title: string, msg: string) => {
    setConfirmTitle('');
    setConfirmMsg('');
    setConfirmCallback(null);
    setAlertTitle(title);
    setAlertMsg(msg);
  };

  const showCustomConfirm = (title: string, msg: string, callback: () => void) => {
    setAlertTitle('');
    setAlertMsg('');
    setShowAddUser(false);
    setSelectedRider(null);
    setConfirmTitle(title);
    setConfirmMsg(msg);
    setConfirmCallback(() => callback);
  };

  const showAddUserModal = () => {
    setAlertTitle('');
    setAlertMsg('');
    setConfirmTitle('');
    setConfirmMsg('');
    setConfirmCallback(null);
    setSelectedRider(null);
    setNewRole('rider');
    setAddUserErrors({});
    setShowAddUser(true);
  };

  // Add User Trigger
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddUserErrors({});
    let hasError = false;
    const errors: Record<string, string> = {};

    const normalizedName = newFullName.trim();
    const normalizedEmail = newEmail.trim().toLowerCase();
    if (!normalizedName) {
      errors.fullName = 'Full Name is required';
      hasError = true;
    }

    if (!normalizedEmail) {
      errors.email = 'Email is required';
      hasError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      errors.email = 'Please enter a valid email address.';
      hasError = true;
    }

    if (!newPassword) {
      errors.password = 'Password is required';
      hasError = true;
    } else if (newPassword.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
      hasError = true;
    }

    if (hasError) {
      setAddUserErrors(errors);
      return;
    }

    try {
      // Do not rely on an old ml_token saved by a previous version of the Admin
      // page. The Edge Function must receive a current Supabase Auth session.
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        throw new Error('Your administrator session has expired. Please log out, then log in again.');
      }

      const { data, error } = await supabaseClient.functions.invoke('admin-create-user', {
        body: {
          fullName: normalizedName,
          email: normalizedEmail,
          password: newPassword,
          role: newRole,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        // Supabase wraps non-2xx Edge Function responses in a generic error.
        // Read the response body so the Admin sees the actual server-side reason
        // (for example, an invalid admin session or a database constraint).
        let functionMessage = data?.error;
        const response = error.context;
        if (!functionMessage && response instanceof Response) {
          const errorBody = await response.clone().json().catch(() => null);
          functionMessage = errorBody?.error;
        }
        throw new Error(functionMessage || describeEdgeFunctionError(error));
      }

      if (!data?.user?.id) throw new Error('The account was created without a matching profile. Please refresh the user list.');
      showCustomAlert('Success', `${newRole === 'admin' ? 'Administrator' : 'Rider'} account created successfully.`);
      triggerAuditLog(`Created user ${normalizedEmail} (${newRole})`, 'Users & Roles', normalizedEmail);
      setShowAddUser(false);
      setNewFullName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('rider');
      setAddUserErrors({});
      loadAllData();
    } catch (err) {
      setAddUserErrors({ general: errorMessage(err) });
    }
  };

  // Delete User Trigger
  const handleDeleteUser = (id: string, email: string, name: string) => {
    showCustomConfirm('Delete Rider?', `Are you sure you want to delete ${name}? This action cannot be undone.`, async () => {
      try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const session = sessionData.session;
        if (!session) throw new Error('Your administrator session has expired. Please log out, then log in again.');

        const { data, error } = await supabaseClient.functions.invoke('admin-delete-user', {
          body: { userId: id },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (error) {
          const response = error.context;
          const errorBody = response instanceof Response
            ? await response.clone().json().catch(() => null)
            : null;
          throw new Error(data?.error || errorBody?.error || describeEdgeFunctionError(error));
        }

        triggerAuditLog(`Deleted user account`, 'Users & Roles', email);
        showCustomAlert('Success', 'User deleted successfully.');
        loadAllData();
      } catch (err) {
        showCustomAlert('Delete Error', errorMessage(err));
      }
    });
  };

  // Manage Rider actions
  const handleManageRider = (rider: Rider) => {
    setAlertTitle('');
    setAlertMsg('');
    setConfirmTitle('');
    setConfirmMsg('');
    setConfirmCallback(null);
    setShowAddUser(false);
    setSelectedRider(rider);
    setEditFullName(rider.full_name || '');
    setEditEmail(rider.email || '');

    setEditRole(rider.role || 'rider');
    setManageTab('profile');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    if (!selectedRider) return;
    e.preventDefault();
    const normalizedName = editFullName.trim();
    const normalizedEmail = editEmail.trim().toLowerCase();
    if (!normalizedName || !normalizedEmail) {
      showCustomAlert('Missing Fields', 'Please complete all profile fields.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      showCustomAlert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    try {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const session = sessionData.session;
      if (!session) throw new Error('Your administrator session has expired. Please log out, then log in again.');

      const { data, error } = await supabaseClient.functions.invoke('admin-update-user', {
        body: {
          userId: selectedRider.id,
          fullName: normalizedName,
          email: normalizedEmail,
          role: editRole,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) {
        const response = error.context;
        const errorBody = response instanceof Response ? await response.clone().json().catch(() => null) : null;
        throw new Error(data?.error || errorBody?.error || describeEdgeFunctionError(error));
      }
      if (!data?.user?.id) throw new Error('The account update did not return a saved profile.');
      showCustomAlert('Success', 'Profile updated successfully.');
      triggerAuditLog(`Updated rider profile for ${normalizedEmail}`, 'Riders Directory', normalizedEmail);

      const updatedAt = new Date().toISOString();
      const updated = riders.map(r => r.id === selectedRider.id ? {
        ...r,
        name: normalizedName,
        full_name: normalizedName,
        email: normalizedEmail,
        role: editRole,
        updated_at: updatedAt,
      } : r).sort((a, b) => {
        const aUpdated = Date.parse(a.updated_at || a.created_at || '') || 0;
        const bUpdated = Date.parse(b.updated_at || b.created_at || '') || 0;
        return bUpdated - aUpdated;
      });
      setRiders(updated);
      setSelectedRider(null);
      loadAllData();
    } catch (err) {
      showCustomAlert('Update Error', errorMessage(err));
    }
  };

  const handleAddMotorcycle = async () => {
    if (!selectedRider) return;
    if (!newPlateNumber || !newMotorcycleModel || !newMotorcycleYear || !newMotorcycleColor) {
      showCustomAlert('Missing Fields', 'Please enter all motorcycle details.');
      return;
    }
    try {
      const res = await apiFetch('/admin/motorcycles', {
        method: 'POST',
        body: JSON.stringify({
          userId: selectedRider.id,
          plateNumber: newPlateNumber,
          model: newMotorcycleModel,
          year: newMotorcycleYear,
          color: newMotorcycleColor
        })
      });
      if (res.success) {
        showCustomAlert('Success', 'Motorcycle registered successfully.');
        setNewPlateNumber('');
        setNewMotorcycleModel('');
        setNewMotorcycleYear('');
        setNewMotorcycleColor('');

        const updatedMotorcycles = [...(selectedRider.motorcycles || []), res.motorcycle];
        const newSelected = { ...selectedRider, motorcycles: updatedMotorcycles };
        setSelectedRider(newSelected);
        setRiders(riders.map(r => r.id === selectedRider.id ? newSelected : r));
        loadAllData();
      }
    } catch (err) {
      showCustomAlert('Registry Error', errorMessage(err));
    }
  };

  const handleDeleteMotorcycle = async (id: number) => {
    if (!selectedRider) return;
    try {
      await apiFetch(`/admin/motorcycles/${id}`, { method: 'DELETE' });

      const updatedMotorcycles = (selectedRider.motorcycles || []).filter((m) => m.id !== id);
      const newSelected = { ...selectedRider, motorcycles: updatedMotorcycles };
      setSelectedRider(newSelected);
      setRiders(riders.map(r => r.id === selectedRider.id ? newSelected : r));
      loadAllData();
    } catch (err) {
      showCustomAlert('Delete Error', errorMessage(err));
    }
  };

  const handleAddContact = async () => {
    if (!selectedRider) return;
    if (!newContactName || !newContactPhone) {
      showCustomAlert('Missing Fields', 'Please enter contact name and phone number.');
      return;
    }
    try {
      const res = await apiFetch('/admin/contacts', {
        method: 'POST',
        body: JSON.stringify({
          userId: selectedRider.id,
          name: newContactName,
          phone: newContactPhone,
          role: newContactRole
        })
      });
      if (res.success) {
        showCustomAlert('Success', 'Contact added successfully.');
        setNewContactName('');
        setNewContactPhone('');

        const updatedContacts = [...(selectedRider.contacts || []), res.contact];
        const newSelected = { ...selectedRider, contacts: updatedContacts };
        setSelectedRider(newSelected);
        setRiders(riders.map(r => r.id === selectedRider.id ? newSelected : r));
        loadAllData();
      }
    } catch (err) {
      showCustomAlert('Add Error', errorMessage(err));
    }
  };

  const handleDeleteContact = async (id: number) => {
    if (!selectedRider) return;
    try {
      await apiFetch(`/admin/contacts/${id}`, { method: 'DELETE' });

      const updatedContacts = (selectedRider.contacts || []).filter((c) => c.id !== id);
      const newSelected = { ...selectedRider, contacts: updatedContacts };
      setSelectedRider(newSelected);
      setRiders(riders.map(r => r.id === selectedRider.id ? newSelected : r));
      loadAllData();
    } catch (err) {
      showCustomAlert('Delete Error', errorMessage(err));
    }
  };


  const exportReport = async (snapshot: ReportSnapshot, format: 'pdf' | 'excel') => {
    const { downloadReport } = await import('./report-export');
    await downloadReport(snapshot, format);
    triggerAuditLog(`Generated ${format.toUpperCase()} report`, 'Reports', snapshot.type + (snapshot.view ? ':' + snapshot.view : ''));
  };
  // Export JSON Backup
  const exportBackup = async () => {
    if (exportingBackup) return;
    setExportingBackup(true);
    try {
      const { backup, filename } = await createBackup((table, columns) => fetchAllSupabaseRows(table, 'id', columns));
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      try { a.click(); } finally { a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setLastBackupAt(backup.exported_at);
      try { localStorage.setItem('ml_last_backup_generated', backup.exported_at); } catch { /* Keep the current-session timestamp if storage is unavailable. */ }
      triggerAuditLog('Downloaded system database backup', 'Backup & Restore', filename);
    } catch (error) {
      showCustomAlert('Backup Failed', errorMessage(error));
    } finally { setExportingBackup(false); }
  };

  // Mask Phone number helper
  const maskPhone = (p?: string) => {
    if (!p) return '—';
    if (p.length < 7) return p;
    return p.slice(0, 3) + '*'.repeat(p.length - 5) + p.slice(-2);
  };

  if (!authReady) {
    return <div style={styles.loginContainer}><div style={styles.loginBox}>Checking admin session…</div></div>;
  }

  // If no auth token, display Login Box
  if (!token) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginBox}>
          <div style={styles.appLogo}>
            <img src="/logo.png" alt="Logo" style={{ width: '48px', height: '48px', borderRadius: '12px', marginRight: '10px' }} />
            <span style={styles.appLogoMoto}>Moto</span>
            <span style={styles.appLogoLock}>Lock</span>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>System Management & Sobriety Audits</p>

          <form onSubmit={handleLogin}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Email / Account Name</label>
              <input
                type="text"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                value={loginPass}
                onChange={e => setLoginPass(e.target.value)}
                style={styles.input}
                required
              />
            </div>

            {loginError && <div style={styles.errAlert}>{loginError}</div>}
            {authError && <div style={styles.errAlert}>{authError}</div>}

            <button type="submit" disabled={isLoggingIn} style={styles.primaryButton}>
              {isLoggingIn ? 'Verifying Credentials...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Sidebar link items structure
  const sidebarSections = [
    {
      title: 'Main',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
        { id: 'live-monitoring', label: 'Live Monitoring', icon: 'monitoring' }
      ]
    },
    {
      title: 'Safety Management',
      items: [
        { id: 'riders', label: 'Riders', icon: 'riders' },
        { id: 'devices', label: 'MotoLock Devices', icon: 'devices' },
        { id: 'sobriety', label: 'Sobriety Tests', icon: 'sobriety' },
        { id: 'identity', label: 'Identity Verification', icon: 'identity' },
        { id: 'alerts', label: 'Alerts & Incidents', icon: 'alerts' }
      ]
    },
    {
      title: 'Analytics & Reports',
      items: [
        { id: 'audit-logs', label: 'Audit Logs', icon: 'audit' },
        { id: 'reports', label: 'Reports', icon: 'reports' }
      ]
    },
    {
      title: 'System',
      items: [
        { id: 'settings', label: 'Settings', icon: 'settings' },
        { id: 'backup', label: 'Backup & Restore', icon: 'backup' }
      ]
    }
  ];

  return (
    <div className="admin-shell" onMouseMove={event => {
      if (!sidebarPinned && sidebarHoverOpen && window.matchMedia('(min-width: 761px)').matches && event.clientX >= 280) {
        setSidebarHoverOpen(false);
      }
    }}>
      <style>{`
        /* Hide scrollbars visually but retain scrolling functionality */
        aside::-webkit-scrollbar {
          display: none !important;
        }
        aside {
          -ms-overflow-style: none !important; /* IE and Edge */
          scrollbar-width: none !important; /* Firefox */
        }
      `}</style>

      <button
        type="button"
        className="admin-menu-toggle"
        onClick={() => {
          setSidebarPinned(open => !open);
          setSidebarHoverOpen(false);
        }}
        aria-label={sidebarPinned ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={sidebarPinned || sidebarHoverOpen}
        aria-controls="admin-sidebar"
        title={sidebarPinned ? 'Close navigation menu' : 'Open navigation menu'}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          {sidebarPinned ? <path d="m6 6 12 12M18 6 6 18" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
        </svg>
      </button>
      {!sidebarPinned && <button
        type="button"
        className="admin-sidebar-edge"
        aria-label="Open navigation menu"
        tabIndex={-1}
        onMouseEnter={() => setSidebarHoverOpen(true)}
        onFocus={() => setSidebarHoverOpen(true)}
        onClick={() => setSidebarPinned(true)}
      />}
      {sidebarPinned && <button type="button" className="admin-sidebar-backdrop" aria-label="Close navigation menu" onClick={() => setSidebarPinned(false)} />}

      {/* SIDEBAR NAVIGATION */}
      <aside
        id="admin-sidebar"
        className={`admin-sidebar${sidebarPinned ? ' admin-sidebar--pinned' : sidebarHoverOpen ? ' admin-sidebar--hover' : ''}`}
        onMouseEnter={() => setSidebarHoverOpen(true)}
        onMouseLeave={() => { if (!sidebarPinned) setSidebarHoverOpen(false); }}
      >
        <div style={styles.logoWrapper}>
          <img src="/logo.png" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '8px', marginRight: '8px' }} />
          <span style={styles.logoMoto}>Moto</span>
          <span style={styles.logoLock}>Lock</span>
        </div>

        <nav style={styles.navMenu}>
          {sidebarSections.map(sec => (
            <div key={sec.title} style={{ marginBottom: 16 }}>
              <div style={styles.menuHeader}>{sec.title}</div>
              {sec.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (window.matchMedia('(max-width: 760px)').matches) {
                      setSidebarPinned(false);
                      setSidebarHoverOpen(false);
                    }
                  }}
                  style={{
                    ...styles.menuItem,
                    ...(activeTab === item.id ? styles.menuItemActive : {})
                  }}
                >
                  <span style={{ marginRight: 10, display: 'inline-flex', alignItems: 'center' }}>
                    <Icon name={item.icon} color={activeTab === item.id ? '#ed1c24' : 'currentColor'} />
                  </span>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* SIDEBAR FOOTER */}
        <div style={styles.sidebarFooter}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={styles.adminAvatar}>
              <Icon name="users" size={16} color="#fff" />
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{adminEmail}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>System Administrator</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={handleLogout} style={{ ...styles.footerMinBtn, color: 'var(--red)', width: '100%', gap: '6px' }}>
              <Icon name="logout" size={14} color="var(--red)" /> Log Out
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT VIEW */}
      <main className="admin-main">

        {/* Global Top Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, textTransform: 'capitalize', color: 'var(--text)', fontSize: '20px', fontWeight: 800 }}>
              {
                {
                  dashboard: 'Dashboard',
                  'live-monitoring': 'Live Monitoring',
                  'live-map': 'Live Map',
                  riders: 'Riders',
                  devices: 'MotoLock Devices',
                  sobriety: 'Sobriety Tests',
                  identity: 'Identity Verification',
                  alerts: 'Alerts & Incidents',
                  'audit-logs': 'Audit Logs',
                  reports: 'Reports',
                  backup: 'Backup & Restore',
                  settings: 'Settings'
                }[activeTab] || activeTab.replace('-', ' ')
              }
            </h2>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', position: 'relative' }}>
            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                style={{ ...styles.actionBtn, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Notifications"
              >
                <Icon name="notification" size={16} color="var(--text)" />
                {notifications.length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    background: 'var(--red)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    fontSize: '10px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {notifications.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div style={{
                  position: 'absolute',
                  top: '110%',
                  right: 0,
                  width: '320px',
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                  zIndex: 99999,
                  maxHeight: '360px',
                  overflowY: 'auto',
                  padding: '12px'
                }}>
                  <div style={{ fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 8, fontSize: '14px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Notification</span>
                    <button
                      onClick={() => { setShowNotifications(false); setActiveTab('alerts'); }}
                      style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}
                    >
                      View All
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                      No critical safety alerts.
                    </div>
                  ) : (
                    notifications.map((n, idx) => (
                      <div key={idx} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                          <span style={{ color: 'var(--red)' }}><Icon name="warning" size={14} color="var(--red)" /> Safety Alert</span>
                          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ color: 'var(--text)', marginTop: 2 }}>
                          Rider <strong>{n.full_name}</strong> - {n.alcohol_detected ? `BAC level: ${n.brac}%` : 'Verification Bypassed'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Dark/Light Toggle */}
            <button
              onClick={() => setIsLightMode(!isLightMode)}
              style={{ ...styles.actionBtn, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title={isLightMode ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              <Icon name={isLightMode ? 'dark' : 'light'} size={16} color="var(--text)" />
            </button>
          </div>
        </div>

        {/* Tab 1: Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="dashboard-page">
            <DashboardSearch riders={riders} devices={devices} rides={overrides} logs={auditLogs} onNavigate={setActiveTab} />
            <div className="dashboard-kpis">
              <div style={{ ...styles.kpiCard, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
                <div style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(237,28,36,0.08)', padding: 10, borderRadius: 12, display: 'flex' }}>
                  <Icon name="riders" size={20} color="var(--red)" />
                </div>
                <div style={styles.kpiVal}>{riders.filter(r => r.role === 'rider').length}</div>
                <div style={styles.kpiLabel}>Total Riders</div>
                <div className="dashboard-kpi-context">Registered rider accounts</div>
              </div>

              <div style={{ ...styles.kpiCard, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
                <div style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(37,99,235,0.08)', padding: 10, borderRadius: 12, display: 'flex' }}>
                  <Icon name="devices" size={20} color="var(--blue)" />
                </div>
                <div style={styles.kpiVal}>{devices.length}</div>
                <div style={styles.kpiLabel}>Registered Devices</div>
                <div className="dashboard-kpi-context">Devices in the system</div>
              </div>

              <div style={{ ...styles.kpiCard, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
                <div style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(245,158,11,0.08)', padding: 10, borderRadius: 12, display: 'flex' }}>
                  <Icon name="sobriety" size={20} color="var(--yellow)" />
                </div>
                <div style={styles.kpiVal}>{overrides.length}</div>
                <div style={styles.kpiLabel}>Override Events</div>
                <div className="dashboard-kpi-context">Recorded events</div>
              </div>

              <div style={{ ...styles.kpiCard, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
                <div style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(237,28,36,0.12)', padding: 10, borderRadius: 12, display: 'flex' }}>
                  <Icon name="alerts" size={20} color="var(--red)" />
                </div>
                <div style={{ ...styles.kpiVal, color: 'var(--red)' }}>
                  {overrides.filter(o => parseFloat(o.brac) >= 0.05).length}
                </div>
                <div style={styles.kpiLabel}>Critical Alert Incidents</div>
                <div className="dashboard-kpi-context">Recorded critical incidents</div>
              </div>
            </div>

            <DashboardPanels data={dashboardData} logs={auditLogs} updatedAt={dashboardUpdatedAt} styles={styles} onNavigate={setActiveTab} />
          </div>
        )}

        {/* Tab 2: Live Monitoring */}
        {activeTab === 'live-monitoring' && <LiveMonitoringPage devices={devices} styles={styles} onRefresh={fetchDevices} lockIcon={locked => <Icon name={locked ? 'lock' : 'unlock'} size={14} color="currentColor" />} />}

        {/* Tab 4: Riders */}
        {activeTab === 'riders' && <RidersPage riders={riders} styles={styles} maskPhone={maskPhone} onAdd={showAddUserModal} onEdit={handleManageRider} onDelete={rider => handleDeleteUser(rider.id, rider.email, rider.full_name)} />}

        {/* Tab 5: MotoLock Devices */}
        {activeTab === 'devices' && <DevicesPage devices={devices} styles={styles} onOpenAlerts={() => setActiveTab('alerts')} />}

        {/* Tab 6: Sobriety Tests */}
        {activeTab === 'sobriety' && (
          <div>
            <div style={{ ...styles.card, display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: 16, marginBottom: 20 }}>
              <label style={{ display: 'grid', gap: 8, minWidth: 200 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Rider Name</span>
                <input type="search" value={sobrietySearch} onChange={e => setSobrietySearch(e.target.value)} placeholder="Search by rider name" style={styles.input} />
              </label>
              <label style={{ display: 'grid', gap: 8, minWidth: 200 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Alcohol Result</span>
                <select value={sobrietyResultFilter} onChange={e => setSobrietyResultFilter(e.target.value)} style={styles.input}>
                  <option value="all">All Results</option>
                  {alcoholResults.map(result => <option key={result} value={result}>{result}</option>)}

                </select>
              </label>
              <label style={{ display: 'grid', gap: 8, minWidth: 220 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Overall Status</span>
                <select value={sobrietyStatusFilter} onChange={e => setSobrietyStatusFilter(e.target.value)} style={styles.input}>
                  <option value="all">All Status</option>
                  {overallStatuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => { setSobrietySearch(''); setSobrietyResultFilter('all'); setSobrietyStatusFilter('all'); }} style={{ ...styles.actionBtn, minHeight: 42, flexShrink: 0, whiteSpace: 'nowrap' }}>
                Clear Filters
              </button>
              <span role="status" style={{ fontSize: 13, color: 'var(--muted)' }}>
                Showing {filteredSobrietyTests.length} of {overrides.length} tests
              </span>
            </div>
            <div style={styles.card}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.tableHeader}>Test Time</th>
                    <th style={styles.tableHeader}>Rider Info</th>
                    <th style={styles.tableHeader}>Blood Alcohol Level (BrAC)</th>
                    <th style={styles.tableHeader}>Alcohol Result</th>
                    <th style={styles.tableHeader}>Overall Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sobrietyPagination.rows.map(({ log: o, brac, alcoholResult, overallStatus, alcoholColor, overallColor }, idx) => (
                    <tr key={idx}>
                      <td style={styles.tableCell}>{new Date(o.created_at).toLocaleString()}</td>
                      <td style={styles.tableCell}>{o.full_name} ({o.email})</td>
                      <td style={styles.tableCell}><strong>{brac === null ? 'N/A' : brac + ' BAC'}</strong></td>
                      <td style={styles.tableCell}>
                        <span style={{
                          color: alcoholColor,
                          fontWeight: 700
                        }}>
                          {alcoholResult}
                        </span>
                      </td>
                      <td style={styles.tableCell}>
                        {getSobrietyDetails(o, overallStatus) ? (
                          <button type="button" aria-haspopup="dialog" aria-label={overallStatus + ': view details'}
                            onClick={() => showCustomAlert(overallStatus, getSobrietyDetails(o, overallStatus)!)}
                            style={{ color: overallColor, fontWeight: 700, background: 'none', border: 0, padding: 0, fontFamily: 'inherit', fontSize: 'inherit', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4 }}>
                            {overallStatus}
                          </button>
                        ) : <span style={{ color: overallColor, fontWeight: 700 }}>{overallStatus}</span>}
                      </td>
                    </tr>
                  ))}
                  {filteredSobrietyTests.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ ...styles.tableCell, textAlign: 'center', color: 'var(--muted)' }}>
                        {overrides.length === 0 ? 'No sobriety tests available.' : 'No sobriety tests match the selected filters.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <TablePagination pagination={sobrietyPagination} label="Sobriety tests" styles={styles} />
            </div>
          </div>
        )}

        {/* Tab 7: Identity Verification */}
        {activeTab === 'identity' && (
          <div>
            <div style={{ ...styles.card, display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: 16, marginBottom: 20 }}>
              <label style={{ display: 'grid', gap: 8, minWidth: 200 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Rider Name</span>
                <input type="search" value={identitySearch} onChange={e => setIdentitySearch(e.target.value)} placeholder="Search by rider name" style={styles.input} />
              </label>
              <label style={{ display: 'grid', gap: 8, minWidth: 200 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Verification Result</span>
                <select value={identityResultFilter} onChange={e => setIdentityResultFilter(e.target.value)} style={styles.input}>
                  <option value="all">All Results</option>
                  {['Verified', 'Failed', 'Bypassed', 'Not Recorded'].map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 8, minWidth: 200 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Hardware Lock Action</span>
                <select value={identityActionFilter} onChange={e => setIdentityActionFilter(e.target.value)} style={styles.input}>
                  <option value="all">All Actions</option>
                  {['Locked', 'Unlocked', 'Awaiting Alcohol Test', 'Pending'].map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => { setIdentityResultFilter('all'); setIdentityActionFilter('all'); }} style={{ ...styles.actionBtn, minHeight: 42, flexShrink: 0, whiteSpace: 'nowrap' }}>Clear Filters</button>
              <span role="status" style={{ fontSize: 13, color: 'var(--muted)' }}>Showing {filteredIdentityRecords.length} of {overrides.length} records</span>
            </div>
            <div style={styles.card}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.tableHeader}>Verification Time</th>
                    <th style={styles.tableHeader}>Rider Name</th>
                    <th style={styles.tableHeader}>Verification Method</th>
                    <th style={styles.tableHeader}>Verification Result</th>
                    <th style={styles.tableHeader}>Hardware Lock Action</th>
                  </tr>
                </thead>
                <tbody>
                  {identityPagination.rows.map(o => {
                    const result = o.identity_display?.verification ?? 'Not Recorded';
                    const details = getIdentityDetails(o, result);
                    const color = result === 'Verified' ? 'var(--green)' : result === 'Failed' ? 'var(--red)' : 'var(--muted)';
                    return <tr key={o.id}>
                      <td style={styles.tableCell}>{formatVerificationTime(o.created_at)}</td>
                      <td style={styles.tableCell}>{o.full_name}</td>
                      <td style={styles.tableCell}>{getVerificationMethod(o)}</td>
                      <td style={styles.tableCell}>
                        {details ? <button type="button" aria-haspopup="dialog" aria-label={result + ': view details for ' + o.full_name}
                          onClick={() => setIdentityDetails({ title: result, text: details })}
                          style={{ color, fontWeight: 700, background: 'none', border: 0, padding: 0, fontFamily: 'inherit', fontSize: 'inherit', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4 }}>
                          {result}
                        </button> : <span style={{ fontWeight: 700, color }}>{result}</span>}
                      </td>
                      <td style={styles.tableCell}><span style={{ fontWeight: 700, color: o.identity_display?.lockAction === 'Unlocked' ? 'var(--green)' : o.identity_display?.lockAction === 'Locked' ? 'var(--red)' : 'var(--muted)' }}>{o.identity_display?.lockAction ?? 'Pending'}</span></td>
                    </tr>;
                  })}
                  {filteredIdentityRecords.length === 0 && (
                    <tr><td colSpan={5} style={{ ...styles.tableCell, textAlign: 'center', color: 'var(--muted)' }}>
                      {overrides.length === 0 ? 'No identity verification records available.' : 'No records match the selected filters.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
              <TablePagination pagination={identityPagination} label="Identity verification" styles={styles} />
            </div>
          </div>
        )}

        {/* Tab 8: Alerts & Incidents */}
        {activeTab === 'alerts' && (
          <AlertsPage store={alertStore} threshold={alcoholThreshold} styles={styles} />
        )}


        {/* Tab 10: Reports */}
        {activeTab === 'reports' && <OrganizedReports data={reportSources} threshold={alcoholThreshold} styles={styles} onExport={exportReport} />}
        {/* Tab 11: Audit Logs */}
        {activeTab === 'audit-logs' && <AuditLogsPage logs={auditLogs} styles={styles} />}
        {/* Tab 14: Settings */}
        {activeTab === 'settings' && (
          <div className="settings-page">
            <div className="settings-grid">
              <div className="settings-card" style={styles.card}>
                <div style={{ ...styles.cardHeader, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--red)' }}>
                  <Icon name="org" size={18} color="var(--red)" />
                  <span>Organization Information</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 12 }}>
                  <div>
                    <label style={styles.label}>Organization Name</label>
                    <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)} style={styles.input} />
                  </div>
                  <div>
                    <label style={styles.label}>Organization Tagline</label>
                    <input type="text" value={orgTagline} onChange={e => setOrgTagline(e.target.value)} style={styles.input} />
                  </div>
                  <div>
                    <label style={styles.label}>Address</label>
                    <input type="text" value={orgAddress} onChange={e => setOrgAddress(e.target.value)} style={styles.input} />
                  </div>
                  <div>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>Language</label>
                      <CustomSelect
                        options={[
                          { value: 'English', label: 'English' },
                          { value: 'Tagalog', label: 'Filipino' }
                        ]}
                        value={orgLanguage}
                        onChange={val => setOrgLanguage(val)}
                      />
                    </div>
                  </div>
                  <SettingsSave dirty={settingsDirty({ org_name: orgName, org_tagline: orgTagline, org_address: orgAddress, org_language: orgLanguage })} onSave={async () => {
                    try {
                      await Promise.all([
                        saveSettingToDB('org_name', orgName),
                        saveSettingToDB('org_tagline', orgTagline),
                        saveSettingToDB('org_address', orgAddress),
                        saveSettingToDB('org_language', orgLanguage)
                      ]);
                      showCustomAlert('Success', 'Organization settings saved to database.');
                    } catch {
                      showCustomAlert('Error', 'Failed to save organization settings.');
                    }
                  }} />
                </div>
              </div>

              <div className="settings-card" style={styles.card}>
                <div style={{ ...styles.cardHeader, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--red)' }}>
                  <Icon name="clock" size={18} color="var(--red)" />
                  <span>Regional & Time Settings</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                  <div>
                    <label style={styles.label}>Date Format</label>
                    <CustomSelect
                      options={[
                        { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                        { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                        { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' }
                      ]}
                      value={dateFormat}
                      onChange={val => setDateFormat(val)}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Time Format</label>
                    <CustomSelect
                      options={[
                        { value: '12-Hour (AM/PM)', label: '12-Hour (AM/PM)' },
                        { value: '24-Hour', label: '24-Hour' }
                      ]}
                      value={timeFormat}
                      onChange={val => setTimeFormat(val)}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Timezone</label>
                    <CustomSelect
                      options={[
                        { value: 'Asia/Manila', label: '(GMT+08:00) Asia/Manila' },
                        { value: 'UTC', label: 'Coordinated Universal Time' }
                      ]}
                      value={orgTimezone}
                      onChange={val => setOrgTimezone(val)}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Auto Sync</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Automatically sync date and time with server</div>
                    </div>
                    <button type="button" role="switch" aria-checked={autoSyncTime} aria-label="Auto Sync" onClick={() => setAutoSyncTime(!autoSyncTime)} style={{ width: 44, height: 24, borderRadius: 12, background: autoSyncTime ? 'var(--red)' : '#cbd5e1', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                      <span style={{ position: 'absolute', top: 2, left: autoSyncTime ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                    </button>
                  </div>
                  <SettingsSave dirty={settingsDirty({ org_timezone: orgTimezone, date_format: dateFormat, time_format: timeFormat, auto_sync_time: String(autoSyncTime) })} onSave={async () => {
                    try {
                      await Promise.all([
                        saveSettingToDB('org_timezone', orgTimezone),
                        saveSettingToDB('date_format', dateFormat),
                        saveSettingToDB('time_format', timeFormat),
                        saveSettingToDB('auto_sync_time', String(autoSyncTime))
                      ]);
                      showCustomAlert('Success', 'Date & time settings saved to database.');
                    } catch {
                      showCustomAlert('Error', 'Failed to save date/time settings.');
                    }
                  }} />
                </div>
              </div>

              <div className="settings-card" style={styles.card}>
                <div style={{ ...styles.cardHeader, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--red)' }}>
                  <Icon name="info" size={18} color="var(--red)" />
                  <span>System Information</span>
                </div>
                <p className="settings-readonly">Read-only system information</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13, marginTop: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>System Name</div>
                    <div style={{ color: 'var(--muted)', marginTop: 2 }}>{orgName}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>Version</div>
                    <div style={{ color: 'var(--muted)', marginTop: 2 }}>1.0.0</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>Environment</div>
                    <div style={{ color: 'var(--muted)', marginTop: 2 }}>Production</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>Database Status</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green)', fontWeight: 700, marginTop: 2 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} /> Connected
                    </div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>Last Updated</div>
                    <div style={{ color: 'var(--muted)', marginTop: 2 }}>{new Date().toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>System Uptime</div>
                    <div style={{ color: 'var(--muted)', marginTop: 2 }}>5 days, 14 hours, 32 minutes</div>
                  </div>
                </div>
              </div>

              <div className="settings-card" style={styles.card}>
                <div style={{ ...styles.cardHeader, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--red)' }}>
                  <Icon name="preferences" size={18} color="var(--red)" />
                  <span>System Preferences</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Maintenance Mode</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Temporarily disable rider access while maintenance is in progress.</div>
                    </div>
                    <button type="button" role="switch" aria-checked={maintenanceMode} aria-label="Maintenance Mode" onClick={() => maintenanceMode ? setMaintenanceMode(false) : showCustomConfirm('Enable Maintenance Mode?', 'Riders will be unable to use the system while maintenance mode is active.', () => setMaintenanceMode(true))} style={{ width: 44, height: 24, borderRadius: 12, background: maintenanceMode ? 'var(--red)' : '#cbd5e1', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                      <span style={{ position: 'absolute', top: 2, left: maintenanceMode ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Allow New Registrations</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Allow new rider and device registrations</div>
                    </div>
                    <button type="button" role="switch" aria-checked={allowRegistrations} aria-label="Allow New Registrations" onClick={() => setAllowRegistrations(!allowRegistrations)} style={{ width: 44, height: 24, borderRadius: 12, background: allowRegistrations ? 'var(--red)' : '#cbd5e1', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                      <span style={{ position: 'absolute', top: 2, left: allowRegistrations ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Automatic Log Cleanup</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Automatically remove logs older than the configured retention period.</div>
                    </div>
                    <button type="button" role="switch" aria-checked={autoLogCleanup} aria-label="Automatic Log Cleanup" onClick={() => setAutoLogCleanup(!autoLogCleanup)} style={{ width: 44, height: 24, borderRadius: 12, background: autoLogCleanup ? 'var(--red)' : '#cbd5e1', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                      <span style={{ position: 'absolute', top: 2, left: autoLogCleanup ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                    </button>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Session Timeout</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Auto logout after inactivity (minutes)</div>
                      </div>
                      <div style={{ width: 120 }}>
                        <CustomSelect
                          options={[
                            { value: '15', label: '15 Min' },
                            { value: '30', label: '30 Min' },
                            { value: '60', label: '60 Min' }
                          ]}
                          value={sessionTimeout}
                          onChange={val => setSessionTimeout(val)}
                        />
                      </div>
                    </div>
                  </div>

                  <SettingsSave dirty={settingsDirty({ maintenance_mode: String(maintenanceMode), allow_registrations: String(allowRegistrations), auto_log_cleanup: String(autoLogCleanup), session_timeout: sessionTimeout })} onSave={async () => {
                    try {
                      await Promise.all([
                        saveSettingToDB('maintenance_mode', String(maintenanceMode)),
                        saveSettingToDB('allow_registrations', String(allowRegistrations)),
                        saveSettingToDB('auto_log_cleanup', String(autoLogCleanup)),
                        saveSettingToDB('session_timeout', sessionTimeout)
                      ]);
                      showCustomAlert('Success', 'System preferences saved to database.');
                    } catch {
                      showCustomAlert('Error', 'Failed to save preferences.');
                    }
                  }} />
                </div>
              </div>

              <div className="settings-card" style={styles.card}>
                <div style={{ ...styles.cardHeader, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--red)' }}>
                  <Icon name="shield" size={18} color="var(--red)" />
                  <span>Security Settings</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Require Strong Passwords</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Enforce stronger password requirements for admin accounts.</div>
                    </div>
                    <button type="button" role="switch" aria-checked={passwordPolicy} aria-label="Require Strong Passwords" onClick={() => setPasswordPolicy(!passwordPolicy)} style={{ width: 44, height: 24, borderRadius: 12, background: passwordPolicy ? 'var(--red)' : '#cbd5e1', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                      <span style={{ position: 'absolute', top: 2, left: passwordPolicy ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Two-Factor Authentication</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Require 2FA for admin accounts.</div>
                    </div>
                    <button type="button" role="switch" aria-checked={twoFactorAuth} aria-label="Two-Factor Authentication" onClick={() => setTwoFactorAuth(!twoFactorAuth)} style={{ width: 44, height: 24, borderRadius: 12, background: twoFactorAuth ? 'var(--red)' : '#cbd5e1', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                      <span style={{ position: 'absolute', top: 2, left: twoFactorAuth ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Login Attempt Limit</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Maximum failed login attempts</div>
                    </div>
                    <div style={{ width: 132 }}>
                      <CustomSelect
                        options={[
                          { value: '3', label: '3 attempts' },
                          { value: '5', label: '5 attempts' },
                          { value: '10', label: '10 attempts' }
                        ]}
                        value={loginAttemptLimit}
                        onChange={val => setLoginAttemptLimit(val)}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Account Lockout Duration</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Lock account after failed attempts (minutes)</div>
                    </div>
                    <div style={{ width: 132 }}>
                      <CustomSelect
                        options={[
                          { value: '5', label: '5 minutes' },
                          { value: '15', label: '15 minutes' },
                          { value: '30', label: '30 minutes' }
                        ]}
                        value={lockoutDuration}
                        onChange={val => setLockoutDuration(val)}
                      />
                    </div>
                  </div>

                  <SettingsSave dirty={settingsDirty({ password_policy: String(passwordPolicy), two_factor_auth: String(twoFactorAuth), login_attempt_limit: loginAttemptLimit, lockout_duration: lockoutDuration, lockout_limit: lockoutLimit })} onSave={async () => {
                    try {
                      await Promise.all([
                        saveSettingToDB('password_policy', String(passwordPolicy)),
                        saveSettingToDB('two_factor_auth', String(twoFactorAuth)),
                        saveSettingToDB('login_attempt_limit', loginAttemptLimit),
                        saveSettingToDB('lockout_duration', lockoutDuration),
                        saveSettingToDB('lockout_limit', lockoutLimit)
                      ]);
                      showCustomAlert('Success', 'Security settings saved to database.');
                    } catch {
                      showCustomAlert('Error', 'Failed to save security settings.');
                    }
                  }} />
                </div>
              </div>

              <div className="settings-card" style={styles.card}>
                <div style={{ ...styles.cardHeader, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--red)' }}>
                  <Icon name="lightning" size={18} color="var(--red)" />
                  <span>System Tools</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                  <button onClick={() => showCustomConfirm('Clear System Cache?', 'This will clear cached system data. Your saved settings and records will not be affected.', () => showCustomAlert('Clear Cache', 'System cache and temporary safety logs have been cleared.'))} style={{ ...styles.actionBtn, justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(128,128,128,0.05)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                    <span style={{ fontWeight: 650 }}>Clear Cache</span>
                    <span>&gt;</span>
                  </button>
                  <button onClick={() => setActiveTab('audit-logs')} style={{ ...styles.actionBtn, justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(128,128,128,0.05)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                    <span style={{ fontWeight: 650 }}>View System Logs</span>
                    <span>&gt;</span>
                  </button>
                  <button onClick={() => showCustomAlert('Email Test', 'A test email notification has been dispatched to the administrator inbox.')} style={{ ...styles.actionBtn, justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(128,128,128,0.05)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                    <span style={{ fontWeight: 650 }}>Test Email Configuration</span>
                    <span>&gt;</span>
                  </button>
                  <button onClick={() => showCustomAlert('Updates', 'You are currently running the latest stable release (v1.0.0).')} style={{ ...styles.actionBtn, justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(128,128,128,0.05)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                    <span style={{ fontWeight: 650 }}>Check for Updates</span>
                    <span>&gt;</span>
                  </button>
                </div>
              </div>

              <div className="settings-card" style={styles.card}>
                <div style={{ ...styles.cardHeader, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--red)' }}>
                  <Icon name="bell" size={18} color="var(--red)" />
                  <span>Alert Thresholds</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Failed Sobriety Test Alert</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Trigger alert after failed test</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="number" value={failedSobrietyAlert} onChange={e => setFailedSobrietyAlert(e.target.value)} style={{ ...styles.input, width: 60, textAlign: 'center', padding: '6px' }} />
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>time(s)</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Override Event Alert</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Trigger alert after override</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="number" value={overrideEventAlert} onChange={e => setOverrideEventAlert(e.target.value)} style={{ ...styles.input, width: 60, textAlign: 'center', padding: '6px' }} />
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>time(s)</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Critical Alert Escalation</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Escalate critical alerts after (minutes)</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="number" value={criticalAlertEscalation} onChange={e => setCriticalAlertEscalation(e.target.value)} style={{ ...styles.input, width: 60, textAlign: 'center', padding: '6px' }} />
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>minutes</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>BAC Threshold (%)</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>System sobriety cutoff value</div>
                    </div>
                    <input type="number" step="0.01" value={alcoholThreshold} onChange={e => setAlcoholThreshold(e.target.value)} style={{ ...styles.input, width: 80, textAlign: 'center' }} />
                  </div>

                  <SettingsSave dirty={settingsDirty({ failed_sobriety_alert: failedSobrietyAlert, override_event_alert: overrideEventAlert, critical_alert_escalation: criticalAlertEscalation, alcohol_threshold: alcoholThreshold })} onSave={async () => {
                    try {
                      await Promise.all([
                        saveSettingToDB('failed_sobriety_alert', failedSobrietyAlert),
                        saveSettingToDB('override_event_alert', overrideEventAlert),
                        saveSettingToDB('critical_alert_escalation', criticalAlertEscalation),
                        saveSettingToDB('alcohol_threshold', alcoholThreshold)
                      ]);
                      showCustomAlert('Success', 'Alert thresholds saved to database.');
                    } catch {
                      showCustomAlert('Error', 'Failed to save thresholds.');
                    }
                  }} />
                </div>
              </div>

              <div className="settings-card" style={styles.card}>
                <div style={{ ...styles.cardHeader, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--red)' }}>
                  <Icon name="bluetooth" size={18} color="var(--red)" />
                  <span>Helmet Connection</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Bluetooth Scan Interval</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>How often to scan for helmet (seconds)</div>
                    </div>
                    <div style={{ width: 132 }}>
                      <CustomSelect
                        options={[
                          { value: '5', label: '5 seconds' },
                          { value: '10', label: '10 seconds' },
                          { value: '30', label: '30 seconds' }
                        ]}
                        value={scanInterval}
                        onChange={val => setScanInterval(val)}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Connection Timeout</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Bluetooth connection timeout (seconds)</div>
                    </div>
                    <div style={{ width: 132 }}>
                      <CustomSelect
                        options={[
                          { value: '15', label: '15 seconds' },
                          { value: '30', label: '30 seconds' },
                          { value: '60', label: '60 seconds' }
                        ]}
                        value={bluetoothTimeout}
                        onChange={val => setBluetoothTimeout(val)}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Auto Reconnect</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Automatically reconnect lost connections</div>
                    </div>
                    <button type="button" role="switch" aria-checked={autoReconnect} aria-label="Auto Reconnect" onClick={() => setAutoReconnect(!autoReconnect)} style={{ width: 44, height: 24, borderRadius: 12, background: autoReconnect ? 'var(--red)' : '#cbd5e1', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                      <span style={{ position: 'absolute', top: 2, left: autoReconnect ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                    </button>
                  </div>

                  <SettingsSave dirty={settingsDirty({ scan_interval: scanInterval, bluetooth_timeout: bluetoothTimeout, auto_reconnect: String(autoReconnect) })} onSave={async () => {
                    try {
                      await Promise.all([
                        saveSettingToDB('scan_interval', scanInterval),
                        saveSettingToDB('bluetooth_timeout', bluetoothTimeout),
                        saveSettingToDB('auto_reconnect', String(autoReconnect))
                      ]);
                      showCustomAlert('Success', 'Bluetooth settings saved to database.');
                    } catch {
                      showCustomAlert('Error', 'Failed to save bluetooth settings.');
                    }
                  }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 15: Backup & Restore */}
        {activeTab === 'backup' && (
          <div>
            <div style={styles.viewHeader}>
              <h2>System Backup & Restore</h2>
            </div>
            <div style={styles.card}>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
                Generate a fresh JSON export of users, ride history, and emergency contacts. Each download fetches the latest available data and includes its generation date and time in the file name. Contact phone numbers remain masked.
              </p>
              <div role="status" style={{ marginBottom: 20, fontSize: 13 }}>
                <strong>Last backup generated: </strong>
                {lastBackupAt ? <time dateTime={lastBackupAt}>{new Date(lastBackupAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'long' })}</time> : 'No backup recorded in this browser.'}
                <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>Recorded in this browser when the download starts. Previously downloaded files do not update automatically.</p>
              </div>
              <button onClick={exportBackup} disabled={exportingBackup} style={{ ...styles.primaryButton, opacity: exportingBackup ? 0.65 : 1 }}>
                <span style={{ marginRight: 6, display: 'inline-flex', alignSelf: 'center' }}>
                  <Icon name="backup" size={14} color="#fff" />
                </span>
                {exportingBackup ? 'Generating latest backup…' : 'Download Latest Backup'}
              </button>
            </div>
          </div>
        )}
      </main>

      {activeTab === 'identity' && identityDetails && (
        <div style={{ ...styles.modalBackdrop, zIndex: 100001 }}>
          <div role="dialog" aria-modal="true" aria-labelledby="identity-details-title" style={styles.modalContent}
            onKeyDown={e => { if (e.key === 'Escape') setIdentityDetails(null); }}>
            <h3 id="identity-details-title">{identityDetails.title}</h3>
            <p style={{ margin: '14px 0', fontSize: 14, whiteSpace: 'pre-wrap' }}>{identityDetails.text}</p>
            <button autoFocus onClick={() => setIdentityDetails(null)} style={styles.primaryButton}>OK</button>
          </div>
        </div>
      )}

      {/* POPUP CONTAINER MODAL - ALERT */}
      {alertTitle && (
        <div style={{ ...styles.modalBackdrop, zIndex: 100001 }}>
          <div style={styles.modalContent}>
            <h3>{alertTitle}</h3>
            <p style={{ margin: '14px 0', fontSize: 14 }}>{alertMsg}</p>
            <button onClick={() => { setAlertTitle(''); setAlertMsg(''); }} style={styles.primaryButton}>
              OK
            </button>
          </div>
        </div>
      )}

      {/* POPUP CONTAINER MODAL - CONFIRM */}
      {confirmTitle && (
        <div style={{ ...styles.modalBackdrop, zIndex: 100001 }}>
          <div style={styles.modalContent}>
            <h3>{confirmTitle}</h3>
            <p style={{ margin: '14px 0', fontSize: 14 }}>{confirmMsg}</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => {
                  if (confirmCallback) confirmCallback();
                  setConfirmTitle('');
                  setConfirmMsg('');
                }}
                style={styles.primaryButton}
              >
                {confirmTitle === 'Delete Rider?' ? 'Delete Rider' : confirmTitle === 'Clear System Cache?' ? 'Clear Cache' : confirmTitle === 'Enable Maintenance Mode?' ? 'Enable Maintenance Mode' : 'Yes, Proceed'}
              </button>
              <button
                onClick={() => {
                  setConfirmTitle('');
                  setConfirmMsg('');
                }}
                style={{ ...styles.primaryButton, background: '#737987' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP CONTAINER MODAL - ADD USER */}
      {showAddUser && !alertTitle && !confirmTitle && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalContent}>
            <h3>Register New User Account</h3>
            <form onSubmit={handleAddUser} style={{ marginTop: 14 }}>

              <div style={styles.formGroup}>
                <label style={styles.label}>Full Name</label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={e => setNewFullName(e.target.value)}
                  style={{ ...styles.input, ...(addUserErrors.fullName ? { border: '1px solid var(--red)' } : {}) }}
                  required
                />
                {addUserErrors.fullName && <div style={{ color: 'var(--red)', fontSize: '12px', marginTop: '4px' }}>{addUserErrors.fullName}</div>}
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Email Address</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  style={{ ...styles.input, ...(addUserErrors.email ? { border: '1px solid var(--red)' } : {}) }}
                  required
                />
                {addUserErrors.email && <div style={{ color: 'var(--red)', fontSize: '12px', marginTop: '4px' }}>{addUserErrors.email}</div>}
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={{ ...styles.input, ...(addUserErrors.password ? { border: '1px solid var(--red)' } : {}) }}
                  required
                />
                {addUserErrors.password && <div style={{ color: 'var(--red)', fontSize: '12px', marginTop: '4px' }}>{addUserErrors.password}</div>}
              </div>
              {adminRole === 'superadmin' && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>System Role</label>
                  <CustomSelect
                    options={[
                      { value: 'rider', label: 'Rider' },
                      { value: 'admin', label: 'Administrator' }
                    ]}
                    value={newRole}
                    onChange={val => setNewRole(val)}
                  />
                  {newRole === 'rider' && (
                    <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, lineHeight: '14px' }}>
                      <Icon name="info" size={14} /> <strong>Note:</strong> Riders registered by an Admin start with no Face ID data. They will be automatically prompted to enroll/register their Face ID when they first log into the client mobile app.
                    </p>
                  )}
                </div>
              )}

              {addUserErrors.general && (
                <div style={{ color: 'var(--red)', fontSize: '13px', marginBottom: '12px', fontWeight: 600 }}>
                  {addUserErrors.general}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button type="submit" style={styles.primaryButton}>
                  Register
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddUser(false);
                    setNewFullName('');
                    setNewEmail('');

                    setNewPassword('');
                    setNewRole('rider');
                    setAddUserErrors({});
                  }}
                  style={{ ...styles.primaryButton, background: '#737987' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedRider && !alertTitle && !confirmTitle && !showAddUser && (
        <div style={styles.modalBackdrop}>
          <div style={{ ...styles.modalContent, width: '600px', maxWidth: '95%' }}>
            <h3 style={styles.modalTitle}>Manage Rider: {selectedRider.full_name}</h3>

            {/* Tab Headers */}
            <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
              <button
                onClick={() => setManageTab('profile')}
                style={{
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  color: manageTab === 'profile' ? 'var(--red)' : 'var(--muted)',
                  borderBottom: manageTab === 'profile' ? '2px solid var(--red)' : 'none',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Profile Info
              </button>
              <button
                onClick={() => setManageTab('motorcycles')}
                style={{
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  color: manageTab === 'motorcycles' ? 'var(--red)' : 'var(--muted)',
                  borderBottom: manageTab === 'motorcycles' ? '2px solid var(--red)' : 'none',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Motorcycles ({selectedRider.motorcycles?.length || 0})
              </button>
              <button
                onClick={() => setManageTab('contacts')}
                style={{
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  color: manageTab === 'contacts' ? 'var(--red)' : 'var(--muted)',
                  borderBottom: manageTab === 'contacts' ? '2px solid var(--red)' : 'none',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Emergency Contacts ({selectedRider.contacts?.length || 0})
              </button>
            </div>

            {/* PROFILE TAB */}
            {manageTab === 'profile' && (
              <form onSubmit={handleSaveProfile}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Full Name</label>
                  <input type="text" value={editFullName} onChange={e => setEditFullName(e.target.value)} style={styles.input} required />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Email Address</label>
                  <input type="email" autoComplete="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} style={styles.input} required />
                </div>
                {adminRole === 'superadmin' && <div style={styles.formGroup}>
                  <label style={styles.label}>Role</label>
                  <CustomSelect
                    options={[
                      { value: 'rider', label: 'Rider' },
                      { value: 'admin', label: 'Administrator' }
                    ]}
                    value={editRole}
                    onChange={val => setEditRole(val)}
                  />
                </div>}
                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button type="submit" style={styles.primaryButton}>Save Profile</button>
                  <button type="button" onClick={() => setSelectedRider(null)} style={{ ...styles.primaryButton, background: '#737987' }}>Close</button>
                </div>
              </form>
            )}

            {/* MOTORCYCLES TAB */}
            {manageTab === 'motorcycles' && (
              <div>
                <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: 20, border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
                  {(!selectedRider.motorcycles || selectedRider.motorcycles.length === 0) ? (
                    <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>No motorcycles registered.</div>
                  ) : (
                    selectedRider.motorcycles.map((m, mIdx: number) => (
                      <div key={mIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: mIdx < (selectedRider.motorcycles?.length || 0) - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div>
                          <strong>{m.model}</strong> (<code style={{ color: 'var(--red)' }}>{m.plate_number}</code>)
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Year: {m.year} · Color: {m.color}</div>
                        </div>
                        <button onClick={() => handleDeleteMotorcycle(m.id)} style={{ ...styles.delBtn, padding: '4px 8px' }}>Remove</button>
                      </div>
                    ))
                  )}
                </div>

                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>Add Registered Motorcycle</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={styles.label}>Plate Number</label>
                    <input type="text" placeholder="e.g. ABC1234" value={newPlateNumber} onChange={e => setNewPlateNumber(e.target.value)} style={styles.input} />
                  </div>
                  <div>
                    <label style={styles.label}>Model</label>
                    <input type="text" placeholder="e.g. Yamaha NMAX" value={newMotorcycleModel} onChange={e => setNewMotorcycleModel(e.target.value)} style={styles.input} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={styles.label}>Year</label>
                    <input type="text" placeholder="e.g. 2024" value={newMotorcycleYear} onChange={e => setNewMotorcycleYear(e.target.value)} style={styles.input} />
                  </div>
                  <div>
                    <label style={styles.label}>Color</label>
                    <input type="text" placeholder="e.g. Black" value={newMotorcycleColor} onChange={e => setNewMotorcycleColor(e.target.value)} style={styles.input} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button onClick={handleAddMotorcycle} style={styles.primaryButton}>Add Motorcycle</button>
                  <button type="button" onClick={() => setSelectedRider(null)} style={{ ...styles.primaryButton, background: '#737987' }}>Close</button>
                </div>
              </div>
            )}

            {/* EMERGENCY CONTACTS TAB */}
            {manageTab === 'contacts' && (
              <div>
                <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: 20, border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
                  {(!selectedRider.contacts || selectedRider.contacts.length === 0) ? (
                    <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>No emergency contacts registered.</div>
                  ) : (
                    selectedRider.contacts.map((c, cIdx: number) => (
                      <div key={cIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: cIdx < (selectedRider.contacts?.length || 0) - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div>
                          <strong>{c.name}</strong> ({maskPhone(c.phone)})
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Role: {c.role}</div>
                        </div>
                        <button onClick={() => handleDeleteContact(c.id)} style={{ ...styles.delBtn, padding: '4px 8px' }}>Remove</button>
                      </div>
                    ))
                  )}
                </div>

                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>Add Trusted Contact</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={styles.label}>Contact Name</label>
                    <input type="text" placeholder="Full Name" value={newContactName} onChange={e => setNewContactName(e.target.value)} style={styles.input} />
                  </div>
                  <div>
                    <label style={styles.label}>Phone Number</label>
                    <input type="text" placeholder="e.g. 09123456789" value={newContactPhone} onChange={e => setNewContactPhone(e.target.value)} style={styles.input} />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={styles.label}>Contact Role</label>
                  <CustomSelect
                    options={[
                      { value: 'Primary Contact', label: 'Primary Contact' },
                      { value: 'Secondary Contact', label: 'Secondary Contact' }
                    ]}
                    value={newContactRole}
                    onChange={val => setNewContactRole(val)}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button onClick={handleAddContact} style={styles.primaryButton}>Add Contact</button>
                  <button type="button" onClick={() => setSelectedRider(null)} style={{ ...styles.primaryButton, background: '#737987' }}>Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Enterprise dark/light dashboard design theme styling
const styles: { [key: string]: React.CSSProperties } = {
  logoWrapper: {
    fontSize: '24px',
    fontWeight: 800,
    marginBottom: '28px',
    display: 'flex',
    alignItems: 'center',
    gap: '2px'
  },
  logoMoto: {
    color: 'var(--text)'
  },
  logoLock: {
    color: '#ed1c24'
  },
  navMenu: {
    flex: 1
  },
  menuHeader: {
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--muted)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '8px',
    marginTop: '12px'
  },
  menuItem: {
    width: '100%',
    textAlign: 'left',
    background: 'none',
    border: 'none',
    padding: '10px 12px',
    borderRadius: '8px',
    color: 'var(--text)',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'background 0.2s'
  },
  menuItemActive: {
    background: 'rgba(237, 28, 36, 0.12)',
    color: '#ed1c24',
    fontWeight: 700
  },
  sidebarFooter: {
    borderTop: '1px solid var(--border)',
    paddingTop: '16px',
    marginTop: '16px'
  },
  adminAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: '#ed1c24',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700
  },
  footerMinBtn: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '12px',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    background: 'rgba(128,128,128,0.05)',
    color: 'var(--text)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingBanner: {
    background: '#ed1c24',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '20px',
    textAlign: 'center',
    fontWeight: 600
  },
  viewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '28px'
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px',
    marginBottom: '28px'
  },
  kpiCard: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '24px',
    textAlign: 'center',
    boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
  },
  kpiVal: {
    fontSize: '32px',
    fontWeight: 800,
    marginBottom: '4px'
  },
  kpiLabel: {
    fontSize: '12px',
    color: 'var(--muted)',
    textTransform: 'uppercase',
    fontWeight: 700
  },
  gridTwoColumns: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px'
  },
  card: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.08)'
  },
  cardHeader: {
    fontSize: '16px',
    fontWeight: 700,
    marginBottom: '16px',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '10px'
  },
  logRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid var(--border)',
    fontSize: '13px'
  },
  emptyState: {
    padding: '40px',
    textAlign: 'center',
    color: 'var(--muted)',
    fontSize: '13px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '13px'
  },
  tableHeader: {
    padding: '14px 18px',
    background: 'rgba(128,128,128,0.04)',
    color: 'var(--muted)',
    fontWeight: 700,
    textTransform: 'uppercase',
    fontSize: '11px',
    letterSpacing: '0.8px',
    borderBottom: '2px solid var(--border)'
  },
  tableCell: {
    padding: '14px 18px',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
    color: 'var(--text)'
  },
  delBtn: {
    background: 'rgba(237, 28, 36, 0.08)',
    border: '1px solid rgba(237, 28, 36, 0.2)',
    color: 'var(--red)',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '11px',
    padding: '6px 12px',
    borderRadius: '6px',
    transition: 'all 0.2s',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    outline: 'none'
  },
  barChartContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: '200px',
    paddingTop: '20px',
    borderBottom: '2px solid var(--border)'
  },
  barCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
    position: 'relative'
  },
  barFill: {
    width: '32px',
    background: 'linear-gradient(to top, var(--red), #c9151c)',
    borderRadius: '4px 4px 0 0',
    transition: 'height 0.3s'
  },
  barLabel: {
    fontSize: '11px',
    color: 'var(--muted)',
    marginTop: '8px'
  },
  barTooltip: {
    position: 'absolute',
    bottom: '100%',
    background: '#101217',
    color: '#fff',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    whiteSpace: 'nowrap',
    marginBottom: '4px'
  },
  actionBtn: {
    padding: '10px 16px',
    background: 'rgba(128,128,128,0.1)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center'
  },
  primaryButton: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, var(--red), #c9151c)',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontWeight: 700,
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '16px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  loginContainer: {
    display: 'flex',
    width: '100vw',
    height: '100vh',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f3f5f9',
    color: '#1f2937'
  },
  loginBox: {
    background: '#ffffff',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '24px',
    padding: '48px',
    width: '440px',
    textAlign: 'center',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.06)'
  },
  appLogo: {
    fontSize: '28px',
    fontWeight: 800,
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px'
  },
  appLogoMoto: {
    color: '#101217'
  },
  appLogoLock: {
    color: '#ed1c24'
  },
  formGroup: {
    marginBottom: '16px',
    textAlign: 'left'
  },
  label: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    color: '#6b7280',
    marginBottom: '8px',
    textTransform: 'uppercase'
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    background: '#f9fafb',
    border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: '12px',
    color: '#1f2937',
    fontSize: '14px',
    outline: 'none'
  },
  select: {
    padding: '12px 16px',
    background: 'var(--input-bg)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    color: 'var(--text)',
    fontSize: '14px',
    outline: 'none',
    width: '100%'
  },
  errAlert: {
    color: 'var(--red)',
    fontSize: '13px',
    background: 'rgba(239, 68, 68, 0.1)',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    marginTop: '12px'
  },
  modalBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999
  },
  modalContent: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    padding: '32px',
    width: '460px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
  },
  formRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '16px'
  }
};
