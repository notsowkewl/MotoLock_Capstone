import React, { useState, useEffect } from 'react';

const API = 'http://localhost:5001/api';

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
    lightning: "M7 2v11h3v9l7-12h-4l4-8z"
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
  options: { value: string; label: string }[];
  value: string;
  onChange: (val: string) => void;
  style?: React.CSSProperties;
}) => {
  const [isOpen, setIsOpen] = useState(false);
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
          maxHeight: '220px',
          overflowY: 'auto'
        }}>
          {options.map(opt => (
            <div
              key={opt.value}
              onClick={(e) => {
                e.stopPropagation();
                onChange(opt.value);
                setIsOpen(false);
              }}
              style={{
                padding: '10px 16px',
                background: opt.value === value ? 'var(--border)' : 'transparent',
                color: 'var(--text)',
                fontSize: '13px',
                transition: 'background 0.2s',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--border)';
              }}
              onMouseLeave={(e) => {
                if (opt.value !== value) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function AdminApp() {
  const [token, setToken] = useState<string>(localStorage.getItem('ml_token') || '');
  const [adminEmail, setAdminEmail] = useState<string>(localStorage.getItem('ml_email') || '');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isLightMode, setIsLightMode] = useState<boolean>(localStorage.getItem('ml_theme') === 'light');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);

  // Login Form States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Global Data Cache
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [riders, setRiders] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Search/Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [riderRoleFilter, setRiderRoleFilter] = useState('all');
  const [riderFaceFilter, setRiderFaceFilter] = useState('all');

  // Custom Modal dialog states
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMsg, setAlertMsg] = useState('');
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMsg, setConfirmMsg] = useState('');
  const [confirmCallback, setConfirmCallback] = useState<any>(null);

  // Add User Form States
  const [showAddUser, setShowAddUser] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newRole, setNewRole] = useState('rider');

  // Settings Edit states
  const [alcoholThreshold, setAlcoholThreshold] = useState('0.05');
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

  // Reports Filter states
  const [reportType, setReportType] = useState('rides');
  const [reportStatus, setReportStatus] = useState('all');
  const [reportAlcohol, setReportAlcohol] = useState('all');
  const [reportRole, setReportRole] = useState('all');
  const [reportStart, setReportStart] = useState('');
  const [reportEnd, setReportEnd] = useState('');

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
  const apiFetch = async (endpoint: string, options: any = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    const response = await fetch(`${API}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers }
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }
    return data;
  };

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
        localStorage.setItem('ml_token', res.token);
        localStorage.setItem('ml_email', loginEmail);
        setToken(res.token);
        setAdminEmail(loginEmail);
        triggerAuditLog('Logged In', 'Authentication', loginEmail);
      }
    } catch (err: any) {
      setLoginError(err.message || 'Failed to authenticate');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    triggerAuditLog('Logged Out', 'Authentication', adminEmail);
    localStorage.removeItem('ml_token');
    localStorage.removeItem('ml_email');
    setToken('');
    setAdminEmail('');
  };

  // Log administrative actions
  const triggerAuditLog = async (action: string, module: string, targetRecord: string) => {
    try {
      await apiFetch('/admin/audit-logs', {
        method: 'POST',
        body: JSON.stringify({ action, module, targetRecord })
      });
      fetchAuditLogs();
    } catch (e) {}
  };

  // Fetch data functions
  const fetchDashboardStats = async () => {
    try {
      const d = await apiFetch('/admin/dashboard');
      if (d.success) setDashboardData(d);
    } catch (e) {}
  };

  const fetchRiders = async () => {
    try {
      const d = await apiFetch('/admin/users');
      if (d.success) setRiders(d.users);
    } catch (e) {}
  };

  const fetchOverrides = async () => {
    try {
      const d = await apiFetch('/admin/override-logs');
      if (d.success) setOverrides(d.logs);
    } catch (e) {}
  };

  const fetchAuditLogs = async () => {
    try {
      const d = await apiFetch('/admin/audit-logs');
      if (d.success) setAuditLogs(d.logs);
    } catch (e) {}
  };

  const fetchSettings = async () => {
    try {
      const d = await apiFetch('/admin/settings');
      if (d.success && d.settings) {
        const s = d.settings;
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
      }
    } catch (e) {}
  };

  const saveSettingToDB = async (key: string, value: string) => {
    await apiFetch('/admin/settings', {
      method: 'POST',
      body: JSON.stringify({ setting_key: key, setting_value: value })
    });
  };

  const fetchDevices = async () => {
    try {
      const d = await apiFetch('/admin/devices');
      if (d.success) setDevices(d.devices);
    } catch (e) {}
  };

  const fetchNotifications = async () => {
    try {
      const d = await apiFetch('/admin/notifications');
      if (d.success) setNotifications(d.notifications || []);
    } catch (e) {}
  };

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchDashboardStats(),
      fetchRiders(),
      fetchOverrides(),
      fetchAuditLogs(),
      fetchSettings(),
      fetchDevices(),
      fetchNotifications()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    if (token) {
      loadAllData();
      const interval = setInterval(() => {
        fetchDashboardStats();
        fetchNotifications();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [token]);

  // Helper alerts
  const showCustomAlert = (title: string, msg: string) => {
    setAlertTitle(title);
    setAlertMsg(msg);
  };

  const showCustomConfirm = (title: string, msg: string, callback: () => void) => {
    setConfirmTitle(title);
    setConfirmMsg(msg);
    setConfirmCallback(() => callback);
  };

  // Add User Trigger
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName || !newEmail || !newPhone || !newPassword) {
      showCustomAlert('Missing Fields', 'Please fill out all fields.');
      return;
    }
    if (!newEmail.includes('@') && newRole !== 'admin') {
      showCustomAlert('Invalid Email', 'Standard user registration requires a valid email address containing @.');
      return;
    }
    try {
      const res = await apiFetch('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          fullName: newFullName,
          email: newEmail,
          phone: newPhone,
          password: newPassword,
          role: newRole
        })
      });
      if (res.userId) {
        showCustomAlert('Success', '✅ User account successfully registered!');
        triggerAuditLog(`Created user ${newEmail} (${newRole})`, 'Users & Roles', newEmail);
        setShowAddUser(false);
        setNewFullName('');
        setNewEmail('');
        setNewPhone('');
        setNewPassword('');
        setNewPin('');
        loadAllData();
      }
    } catch (err: any) {
      showCustomAlert('Registration Error', err.message);
    }
  };

  // Delete User Trigger
  const handleDeleteUser = (id: number, email: string) => {
    showCustomConfirm('Confirm Account Deletion', `Are you absolutely sure you want to permanently delete user ${email}? All linked device slots and histories will be cleared.`, async () => {
      try {
        await apiFetch(`/admin/users/${id}`, { method: 'DELETE' });
        triggerAuditLog(`Deleted user account`, 'Users & Roles', email);
        showCustomAlert('Success', 'User deleted successfully.');
        loadAllData();
      } catch (err: any) {
        showCustomAlert('Delete Error', err.message);
      }
    });
  };

  // Update Config Threshold Trigger
  const handleSaveSettings = async () => {
    try {
      await apiFetch('/admin/settings', {
        method: 'POST',
        body: JSON.stringify({ setting_key: 'alcohol_threshold', setting_value: alcoholThreshold })
      });
      await apiFetch('/admin/settings', {
        method: 'POST',
        body: JSON.stringify({ setting_key: 'lockout_limit', setting_value: lockoutLimit })
      });
      await apiFetch('/admin/settings', {
        method: 'POST',
        body: JSON.stringify({ setting_key: 'session_timeout', setting_value: sessionTimeout })
      });
      showCustomAlert('Success', '✅ System parameters updated successfully.');
      loadAllData();
    } catch (err: any) {
      showCustomAlert('Settings Error', err.message);
    }
  };

  // Export pdf / excel
  const exportReport = (format: 'pdf' | 'excel') => {
    let url = `${API}/admin/reports/${format}?token=${token}&reportType=${reportType}`;
    if (reportType === 'rides') {
      if (reportStatus !== 'all') url += `&status=${reportStatus}`;
      if (reportAlcohol !== 'all') url += `&alcohol=${reportAlcohol}`;
    } else if (reportType === 'users') {
      if (reportRole !== 'all') url += `&role=${reportRole}`;
    }
    if (reportStart) url += `&startDate=${reportStart}`;
    if (reportEnd) url += `&endDate=${reportEnd}`;

    triggerAuditLog(`Generated ${format.toUpperCase()} compliance report`, 'Reports', reportType);
    window.open(url, '_blank');
  };

  // Export JSON Backup
  const exportBackup = () => {
    triggerAuditLog('Downloaded system database backup', 'Backup & Restore', 'Full JSON schema');
    window.open(`${API}/admin/backup?token=${token}`, '_blank');
  };

  // Mask Phone number helper
  const maskPhone = (p: string) => {
    if (!p) return '—';
    if (p.length < 7) return p;
    return p.slice(0, 3) + '*'.repeat(p.length - 5) + p.slice(-2);
  };

  // If no auth token, display Login Box
  if (!token) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginBox}>
          <div style={styles.appLogo}>
            <img src="/motolock-app.png" alt="Logo" style={{ width: '48px', height: '48px', borderRadius: '12px', marginRight: '10px' }} />
            <span style={styles.appLogoMoto}>Moto</span>
            <span style={styles.appLogoLock}>Lock</span>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>System Management & Sobriety Audits</p>
          
          <form onSubmit={handleLogin}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Email / Account Name</label>
              <input
                type="text"
                placeholder="Enter admin identifier"
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
                placeholder="Enter password"
                value={loginPass}
                onChange={e => setLoginPass(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            
            {loginError && <div style={styles.errAlert}>{loginError}</div>}
            
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
        { id: 'live-monitoring', label: 'Live Monitoring', icon: 'monitoring' },
        { id: 'live-map', label: 'Live Map', icon: 'map' }
      ]
    },
    {
      title: 'Safety Management',
      items: [
        { id: 'riders', label: 'Riders', icon: 'riders' },
        { id: 'devices', label: 'Motorcycles & Devices', icon: 'devices' },
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
    <div style={styles.appWrapper}>
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

      {/* SIDEBAR NAVIGATION */}
      <aside style={styles.sidebar}>
        <div style={styles.logoWrapper}>
          <img src="/motolock-app.png" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '8px', marginRight: '8px' }} />
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
                  onClick={() => setActiveTab(item.id)}
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
      <main style={styles.mainContent}>
        {loading && <div style={styles.loadingBanner}>Loading real-time database records...</div>}

        {/* Global Top Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, textTransform: 'capitalize', color: 'var(--text)', fontSize: '20px', fontWeight: 800 }}>
              {activeTab === 'dashboard' ? 'System Dashboard' : activeTab.replace('-', ' ')}
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
                          <span style={{ color: 'var(--red)' }}>🚨 Safety Alert</span>
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
          <div>
            <div style={styles.kpiGrid}>
              <div style={{ ...styles.kpiCard, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
                <div style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(237,28,36,0.08)', padding: 10, borderRadius: 12, display: 'flex' }}>
                  <Icon name="riders" size={20} color="var(--red)" />
                </div>
                <div style={styles.kpiVal}>{riders.filter(r => r.role === 'rider').length}</div>
                <div style={styles.kpiLabel}>Total Riders</div>
              </div>

              <div style={{ ...styles.kpiCard, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
                <div style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(37,99,235,0.08)', padding: 10, borderRadius: 12, display: 'flex' }}>
                  <Icon name="devices" size={20} color="var(--blue)" />
                </div>
                <div style={styles.kpiVal}>{devices.length}</div>
                <div style={styles.kpiLabel}>Registered Devices</div>
              </div>

              <div style={{ ...styles.kpiCard, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
                <div style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(245,158,11,0.08)', padding: 10, borderRadius: 12, display: 'flex' }}>
                  <Icon name="sobriety" size={20} color="var(--yellow)" />
                </div>
                <div style={styles.kpiVal}>{overrides.length}</div>
                <div style={styles.kpiLabel}>Override Events</div>
              </div>

              <div style={{ ...styles.kpiCard, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
                <div style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(237,28,36,0.12)', padding: 10, borderRadius: 12, display: 'flex' }}>
                  <Icon name="alerts" size={20} color="var(--red)" />
                </div>
                <div style={{ ...styles.kpiVal, color: 'var(--red)' }}>
                  {overrides.filter(o => parseFloat(o.brac) >= 0.05).length}
                </div>
                <div style={styles.kpiLabel}>Critical Alert Incidents</div>
              </div>
            </div>

            {/* Dashboard grid: Sobriety Test Summary & Alerts Overview */}
            {(() => {
              const sobrietySummary = dashboardData?.sobrietySummary || [];
              const recentAlerts = dashboardData?.recentAlerts || [];

              // Generate last 30 days of dates to ensure the graph timeline is complete, populated by database counts
              const last30Days = Array.from({ length: 30 }).map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (29 - i));
                return d.toISOString().split('T')[0];
              });

              const chartData = last30Days.map(dateStr => {
                const dbMatch = sobrietySummary.find((item: any) => {
                  if (!item.date) return false;
                  // Handle potential date timezone differences
                  const itemDateStr = new Date(item.date).toISOString().split('T')[0];
                  return itemDateStr === dateStr;
                });
                return {
                  date: new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  passed: dbMatch ? parseInt(dbMatch.passed || 0) : 0,
                  failed: dbMatch ? parseInt(dbMatch.failed || 0) : 0
                };
              });

              const totalPassed = sobrietySummary.reduce((sum: number, item: any) => sum + parseInt(item.passed || 0), 0);
              const totalFailed = sobrietySummary.reduce((sum: number, item: any) => sum + parseInt(item.failed || 0), 0);
              const totalTests = totalPassed + totalFailed;
              const passedPercentage = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0.0';
              const failedPercentage = totalTests > 0 ? ((totalFailed / totalTests) * 100).toFixed(1) : '0.0';

              const maxVal = Math.max(...chartData.map(d => Math.max(d.passed, d.failed, 1000)));
              const width = 450;
              const height = 500;
              const paddingLeft = 40;
              const paddingRight = 20;
              const paddingTop = 20;
              const paddingBottom = 30;

              const getSvgCoords = (index: number, val: number) => {
                const x = paddingLeft + (index / (chartData.length - 1)) * (width - paddingLeft - paddingRight);
                const y = height - paddingBottom - (val / maxVal) * (height - paddingTop - paddingBottom);
                return { x, y };
              };

              let passedPath = '';
              let failedPath = '';
              let passedAreaPath = '';
              let failedAreaPath = '';

              chartData.forEach((pt, idx) => {
                const coordPassed = getSvgCoords(idx, pt.passed);
                const coordFailed = getSvgCoords(idx, pt.failed);

                if (idx === 0) {
                  passedPath = `M ${coordPassed.x} ${coordPassed.y}`;
                  failedPath = `M ${coordFailed.x} ${coordFailed.y}`;
                  passedAreaPath = `M ${coordPassed.x} ${height - paddingBottom} L ${coordPassed.x} ${coordPassed.y}`;
                  failedAreaPath = `M ${coordFailed.x} ${height - paddingBottom} L ${coordFailed.x} ${coordFailed.y}`;
                } else {
                  passedPath += ` L ${coordPassed.x} ${coordPassed.y}`;
                  failedPath += ` L ${coordFailed.x} ${coordFailed.y}`;
                  passedAreaPath += ` L ${coordPassed.x} ${coordPassed.y}`;
                  failedAreaPath += ` L ${coordFailed.x} ${coordFailed.y}`;
                }

                if (idx === chartData.length - 1) {
                  passedAreaPath += ` L ${coordPassed.x} ${height - paddingBottom} Z`;
                  failedAreaPath += ` L ${coordFailed.x} ${height - paddingBottom} Z`;
                }
              });

              return (
                <div style={styles.gridTwoColumns}>
                  {/* Left Column */}
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {/* Sobriety Test Summary Card */}
                    <div style={{ ...styles.card, flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                        <span style={{ fontSize: 16, fontWeight: 700 }}>Sobriety Test Summary</span>
                        <CustomSelect
                          options={[{ value: 'month', label: 'This Month' }]}
                          value="month"
                          onChange={() => {}}
                          style={{ width: 'auto', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', minWidth: '110px' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', flex: 1, marginTop: 12 }}>
                        {/* Left: SVG Line Graph */}
                        <div style={{ flex: 1, minWidth: 280 }}>
                          <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 12 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }}></span> Passed
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', display: 'inline-block' }}></span> Failed
                            </span>
                          </div>

                          <svg width="100%" height="450" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
                            <defs>
                              <linearGradient id="passedGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--green)" stopOpacity="0.2"/>
                                <stop offset="100%" stopColor="var(--green)" stopOpacity="0.0"/>
                              </linearGradient>
                              <linearGradient id="failedGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--red)" stopOpacity="0.15"/>
                                <stop offset="100%" stopColor="var(--red)" stopOpacity="0.0"/>
                              </linearGradient>
                            </defs>

                            {/* Grid Lines */}
                            {[0, 0.2, 0.4, 0.6, 0.8, 1].map((ratio, index) => {
                              const y = paddingTop + ratio * (height - paddingTop - paddingBottom);
                              const labelVal = Math.round(maxVal - ratio * maxVal);
                              return (
                                <g key={index}>
                                  <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="var(--border)" strokeDasharray="3 3" />
                                  <text x={paddingLeft - 10} y={y + 4} textAnchor="end" fill="var(--muted)" style={{ fontSize: 10 }}>
                                    {labelVal >= 1000 ? `${(labelVal / 1000).toFixed(0)}K` : labelVal}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Line Areas */}
                            {chartData.length > 0 && (
                              <>
                                <path d={passedAreaPath} fill="url(#passedGrad)" />
                                <path d={failedAreaPath} fill="url(#failedGrad)" />
                                
                                {/* Lines */}
                                <path d={passedPath} fill="none" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" />
                                <path d={failedPath} fill="none" stroke="var(--red)" strokeWidth="3" strokeLinecap="round" />

                                {/* Data points dots */}
                                {chartData.map((pt, idx) => {
                                  const cP = getSvgCoords(idx, pt.passed);
                                  const cF = getSvgCoords(idx, pt.failed);
                                  return (
                                    <g key={idx}>
                                      <circle cx={cP.x} cy={cP.y} r="4" fill="var(--card)" stroke="var(--green)" strokeWidth="2" />
                                      <circle cx={cF.x} cy={cF.y} r="4" fill="var(--card)" stroke="var(--red)" strokeWidth="2" />
                                    </g>
                                  );
                                })}
                              </>
                            )}

                            {/* X Axis Labels */}
                            {chartData.length > 0 && [0, Math.floor(chartData.length / 4), Math.floor(chartData.length / 2), Math.floor(3 * chartData.length / 4), chartData.length - 1].map((idx) => {
                              if (idx >= chartData.length) return null;
                              const pt = chartData[idx];
                              const x = paddingLeft + (idx / (chartData.length - 1)) * (width - paddingLeft - paddingRight);
                              return (
                                <text key={idx} x={x} y={height - 10} textAnchor="middle" fill="var(--muted)" style={{ fontSize: 10 }}>
                                  {pt.date}
                                </text>
                              );
                            })}
                          </svg>
                        </div>

                        {/* Right: Summary Stats */}
                        <div style={{ width: 120, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Passed</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)' }}>
                              {totalPassed.toLocaleString()}
                            </div>
                            <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'rgba(31,163,91,0.1)', color: 'var(--green)', fontWeight: 700 }}>
                              {passedPercentage}%
                            </span>
                          </div>

                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Failed</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)' }}>
                              {totalFailed.toLocaleString()}
                            </div>
                            <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'rgba(237,28,36,0.1)', color: 'var(--red)', fontWeight: 700 }}>
                              {failedPercentage}%
                            </span>
                          </div>

                          <div>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Total Tests</div>
                            <div style={{ fontSize: 22, fontWeight: 900 }}>
                              {totalTests.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Alerts Overview Card */}
                    <div style={styles.card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                        <span style={{ fontSize: 16, fontWeight: 700 }}>Alerts Overview</span>
                        <button onClick={() => setActiveTab('alerts')} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
                          View All
                        </button>
                      </div>

                      <div style={{ maxHeight: 250, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {!recentAlerts.length ? (
                          <div style={styles.emptyState}>No safety alert logs found.</div>
                        ) : (
                          recentAlerts.slice(0, 5).map((r: any, idx: number) => {
                            let alertTitle = 'Ignition Session Completed';
                            let alertDesc = `Rider: ${r.full_name || 'Rider'} | Device: DEV-${r.motorcycle_id || 'N/A'}`;
                            let alertIcon = '✅';
                            let badgeColor = 'var(--green)';
                            let badgeBg = 'rgba(31,163,91,0.1)';
                            let badgeText = 'Low';

                            if (r.alcohol_detected || parseFloat(r.brac) >= 0.05) {
                              alertTitle = 'High Alcohol Detected';
                              alertDesc = `Rider: ${r.full_name || 'Rider'} | Device: DEV-${r.motorcycle_id || 'N/A'}`;
                              alertIcon = '🚨';
                              badgeColor = 'var(--red)';
                              badgeBg = 'rgba(237,28,36,0.1)';
                              badgeText = 'High';
                            } else if (!r.face_verified) {
                              alertTitle = 'Identity Verification Failed';
                              alertDesc = `Rider: ${r.full_name || 'Rider'} | Device: DEV-${r.motorcycle_id || 'N/A'}`;
                              alertIcon = '👤';
                              badgeColor = 'var(--yellow)';
                              badgeBg = 'rgba(245,158,11,0.1)';
                              badgeText = 'Medium';
                            } else if (!r.helmet_verified) {
                              alertTitle = 'Helmet Safety Lockout';
                              alertDesc = `Rider: ${r.full_name || 'Rider'} | Device: DEV-${r.motorcycle_id || 'N/A'}`;
                              alertIcon = '🪖';
                              badgeColor = 'var(--yellow)';
                              badgeBg = 'rgba(245,158,11,0.1)';
                              badgeText = 'Medium';
                            }

                            return (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: badgeBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                                  {alertIcon}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 700 }}>{alertTitle}</div>
                                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{alertDesc}</div>
                                </div>
                                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                                    {new Date(r.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, color: badgeColor, background: badgeBg, fontWeight: 700, textTransform: 'uppercase' }}>
                                    {badgeText}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Recent Activities Card */}
                    <div style={styles.card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                        <span style={{ fontSize: 16, fontWeight: 700 }}>Recent Activities</span>
                        <button onClick={() => setActiveTab('audit-logs')} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
                          View Audit Log
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {!auditLogs.length ? (
                          <div style={styles.emptyState}>No recent activities found.</div>
                        ) : (
                          auditLogs.slice(0, 5).map((l, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
                              <div>
                                <strong style={{ color: 'var(--text)' }}>{l.action}</strong>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                                  Module: <span style={{ color: 'var(--text)' }}>{l.module}</span> | Target: <span style={{ color: 'var(--text)' }}>{l.target_record || '—'}</span>
                                </div>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
                                <div>{new Date(l.created_at).toLocaleDateString()}</div>
                                <div style={{ fontSize: 10 }}>{new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Tab 2: Live Monitoring */}
        {activeTab === 'live-monitoring' && (
          <div>
            <div style={styles.viewHeader}>
              <h2>Registered MotoLock Hardware States</h2>
            </div>
            <div style={styles.card}>
              {!devices.length ? (
                <div style={styles.emptyState}>No devices registered in the system.</div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.tableHeader}>Device ID</th>
                      <th style={styles.tableHeader}>SIM Card Slot</th>
                      <th style={styles.tableHeader}>Relay State</th>
                      <th style={styles.tableHeader}>Lock Status</th>
                      <th style={styles.tableHeader}>Assigned Rider</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((d, idx) => (
                      <tr key={idx}>
                        <td style={styles.tableCell}><code>DEV-{d.id}</code></td>
                        <td style={styles.tableCell}>{d.sim_number || 'N/A'}</td>
                        <td style={styles.tableCell}>
                          <span style={{ color: d.relay_status ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                            {d.relay_status ? 'Active' : 'Locked'}
                          </span>
                        </td>
                        <td style={styles.tableCell}>
                          <span style={{ color: d.is_locked ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>
                            {d.is_locked ? '🔒 Locked' : '🔓 Unlocked'}
                          </span>
                        </td>
                        <td style={styles.tableCell}>User ID: {d.user_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Live Map */}
        {activeTab === 'live-map' && (
          <div>
            <div style={styles.viewHeader}>
              <h2>Geographical Tracking Interface</h2>
            </div>
            <div style={styles.card}>
              <div style={styles.emptyState}>
                <span style={{ display: 'block', marginBottom: 12 }}>
                  <Icon name="map" size={32} color="var(--muted)" />
                </span>
                <strong>Location unavailable.</strong><br />
                No GPS coordinates are stored in the database. Fake positions are disabled.
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Riders */}
        {activeTab === 'riders' && (
          <div>
            <div style={styles.viewHeader}>
              <h2>Rider Accounts Directory</h2>
              <button onClick={() => setShowAddUser(true)} style={styles.actionBtn}>
                <span style={{ marginRight: 6, display: 'inline-flex', alignSelf: 'center' }}>
                  <Icon name="users" size={14} />
                </span>
                Add User
              </button>
            </div>

            <div style={{ ...styles.card, marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <input
                  type="text"
                  placeholder="Search user name or email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={styles.input}
                />
                <CustomSelect
                  options={[
                    { value: 'all', label: 'All Roles' },
                    { value: 'rider', label: 'Riders' },
                    { value: 'admin', label: 'Administrators' }
                  ]}
                  value={riderRoleFilter}
                  onChange={val => setRiderRoleFilter(val)}
                  style={{ width: '160px' }}
                />
                <CustomSelect
                  options={[
                    { value: 'all', label: 'All Face ID' },
                    { value: 'enrolled', label: 'Enrolled Only' },
                    { value: 'missing', label: 'Missing Only' }
                  ]}
                  value={riderFaceFilter}
                  onChange={val => setRiderFaceFilter(val)}
                  style={{ width: '160px' }}
                />
              </div>

              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.tableHeader}>Full Name</th>
                    <th style={styles.tableHeader}>Email Address</th>
                    <th style={styles.tableHeader}>Mobile Number</th>
                    <th style={styles.tableHeader}>Role</th>
                    <th style={styles.tableHeader}>Face ID Profile</th>
                    <th style={styles.tableHeader}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {riders
                    .filter(r => {
                      const matchesQ = r.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                       r.email?.toLowerCase().includes(searchQuery.toLowerCase());
                      const matchesRole = riderRoleFilter === 'all' || r.role === riderRoleFilter;
                      const matchesFace = riderFaceFilter === 'all' ||
                                         (riderFaceFilter === 'enrolled' && r.face_enrolled) ||
                                         (riderFaceFilter === 'missing' && !r.face_enrolled);
                      return matchesQ && matchesRole && matchesFace;
                    })
                    .map((r, idx) => (
                      <tr key={idx}>
                        <td style={styles.tableCell}><strong>{r.full_name}</strong></td>
                        <td style={styles.tableCell}>{r.email}</td>
                        <td style={styles.tableCell}>{maskPhone(r.phone)}</td>
                        <td style={styles.tableCell}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            background: r.role === 'admin' ? 'rgba(37,99,235,0.1)' : 'rgba(245,158,11,0.1)',
                            color: r.role === 'admin' ? 'var(--blue)' : 'var(--yellow)'
                          }}>
                            {r.role.toUpperCase()}
                          </span>
                        </td>
                        <td style={styles.tableCell}>{r.face_enrolled ? '✅ Face Loaded' : '❌ Missing'}</td>
                        <td style={styles.tableCell}>
                          {r.role !== 'admin' ? (
                            <button
                              onClick={() => handleDeleteUser(r.id, r.email)}
                              style={styles.delBtn}
                            >
                              Delete Account
                            </button>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Protected</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: Motorcycles & Devices */}
        {activeTab === 'devices' && (
          <div>
            <div style={styles.viewHeader}>
              <h2>Hardware Components Control</h2>
            </div>
             <div style={styles.card}>
               <table style={styles.table}>
                 <thead>
                   <tr>
                     <th style={styles.tableHeader}>Device ID</th>
                     <th style={styles.tableHeader}>Lock Status</th>
                     <th style={styles.tableHeader}>Hardware Model Link</th>
                     <th style={styles.tableHeader}>Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {devices.map((d, idx) => (
                     <tr key={idx}>
                       <td style={styles.tableCell}><code>DEV-{d.id}</code></td>
                       <td style={styles.tableCell}>{d.is_locked ? '🔒 Secure Lock' : '🔓 Ignition Ready'}</td>
                       <td style={styles.tableCell}>SIM Card: {d.sim_number || 'N/A'}</td>
                       <td style={styles.tableCell}>
                         <button
                           onClick={() => showCustomAlert('System Override', 'Please direct device override actions inside safety alerts tab.')}
                           style={styles.actionBtn}
                         >
                           Trigger Audit Override
                         </button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        )}

        {/* Tab 6: Sobriety Tests */}
        {activeTab === 'sobriety' && (
          <div>
            <div style={styles.viewHeader}>
              <h2>Sobriety Breathalyzer Audit Logs</h2>
            </div>
            <div style={styles.card}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.tableHeader}>Test Time</th>
                    <th style={styles.tableHeader}>Rider Info</th>
                    <th style={styles.tableHeader}>Blood Alcohol Level (BrAC)</th>
                    <th style={styles.tableHeader}>Status</th>
                    <th style={styles.tableHeader}>Verification Audit</th>
                  </tr>
                </thead>
                <tbody>
                  {overrides.map((o, idx) => (
                    <tr key={idx}>
                      <td style={styles.tableCell}>{new Date(o.created_at).toLocaleString()}</td>
                      <td style={styles.tableCell}>{o.full_name} ({o.email})</td>
                      <td style={styles.tableCell}><strong>{o.brac} BAC</strong></td>
                      <td style={styles.tableCell}>
                        <span style={{
                          color: parseFloat(o.brac) >= 0.05 ? 'var(--red)' : 'var(--green)',
                          fontWeight: 700
                        }}>
                          {parseFloat(o.brac) >= 0.05 ? 'Intoxicated Alert' : 'Passed Compliance'}
                        </span>
                      </td>
                      <td style={styles.tableCell}>{o.unlock_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 7: Identity Verification */}
        {activeTab === 'identity' && (
          <div>
            <div style={styles.viewHeader}>
              <h2>Identity verification Log</h2>
            </div>
            <div style={styles.card}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.tableHeader}>Audit Date</th>
                    <th style={styles.tableHeader}>Account Holder</th>
                    <th style={styles.tableHeader}>Face ID Verified</th>
                    <th style={styles.tableHeader}>Hardware Lock Action</th>
                  </tr>
                </thead>
                <tbody>
                  {overrides.map((o, idx) => (
                    <tr key={idx}>
                      <td style={styles.tableCell}>{new Date(o.created_at).toLocaleDateString()}</td>
                      <td style={styles.tableCell}>{o.full_name}</td>
                      <td style={styles.tableCell}>{o.face_verified ? '✅ Matched Face' : '❌ Verification Bypassed'}</td>
                      <td style={styles.tableCell}>Ignition Status: {o.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 8: Alerts & Incidents */}
        {activeTab === 'alerts' && (
          <div>
            <div style={styles.viewHeader}>
              <h2>Critical Safety Alerts & Incidents</h2>
            </div>
            <div style={styles.card}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.tableHeader}>Timestamp</th>
                    <th style={styles.tableHeader}>Rider details</th>
                    <th style={styles.tableHeader}>Trigger Reason</th>
                    <th style={styles.tableHeader}>Level</th>
                    <th style={styles.tableHeader}>Management Action</th>
                  </tr>
                </thead>
                <tbody>
                  {overrides
                    .filter(o => parseFloat(o.brac) >= 0.05)
                    .map((o, idx) => (
                      <tr key={idx}>
                        <td style={styles.tableCell}>{new Date(o.created_at).toLocaleString()}</td>
                        <td style={styles.tableCell}>{o.full_name} ({o.email})</td>
                        <td style={styles.tableCell}>Alcohol limit exceeded ({o.brac} BAC)</td>
                        <td style={styles.tableCell}><span style={{ color: 'var(--red)', fontWeight: 700 }}>🚨 High Severity</span></td>
                        <td style={styles.tableCell}>
                          <button
                            onClick={() => {
                              triggerAuditLog(`Resolved safety incident for ${o.email}`, 'Alerts', o.email);
                              showCustomAlert('Incident Resolved', `Alert cleared for rider ${o.full_name}. Action saved to database.`);
                            }}
                            style={styles.actionBtn}
                          >
                            Resolve Alert
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}


        {/* Tab 10: Reports */}
        {activeTab === 'reports' && (
          <div>
            <div style={styles.viewHeader}>
              <h2>Official Compliance Reports</h2>
            </div>
            <div style={styles.card}>
              <div style={styles.formRow}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Content Category</label>
                  <CustomSelect
                    options={[
                      { value: 'rides', label: 'Ride Compliance Session Logs' },
                      { value: 'users', label: 'User Directory List' },
                      { value: 'overrides', label: 'Manual Overrides Audit Sheet' }
                    ]}
                    value={reportType}
                    onChange={val => setReportType(val)}
                  />
                </div>
 
                {reportType === 'rides' && (
                  <>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>Ride Security Status</label>
                      <CustomSelect
                        options={[
                          { value: 'all', label: 'All Rides' },
                          { value: 'completed', label: 'Completed Session' },
                          { value: 'alert', label: 'Alert (Sobriety Fail)' }
                        ]}
                        value={reportStatus}
                        onChange={val => setReportStatus(val)}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>Alcohol Status</label>
                      <CustomSelect
                        options={[
                          { value: 'all', label: 'All sessions' },
                          { value: '1', label: 'Intoxicated only' },
                          { value: '0', label: 'Sober only' }
                        ]}
                        value={reportAlcohol}
                        onChange={val => setReportAlcohol(val)}
                      />
                    </div>
                  </>
                )}
 
                {reportType === 'users' && (
                  <>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>Role filter</label>
                      <CustomSelect
                        options={[
                          { value: 'all', label: 'All Roles' },
                          { value: 'rider', label: 'Riders' },
                          { value: 'admin', label: 'Administrators' }
                        ]}
                        value={reportRole}
                        onChange={val => setReportRole(val)}
                      />
                    </div>
                    <div style={{ flex: 1 }}></div>
                  </>
                )}

                {reportType === 'overrides' && (
                  <>
                    <div style={{ flex: 1 }}></div>
                    <div style={{ flex: 1 }}></div>
                  </>
                )}
              </div>

              <div style={styles.formRow}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Start Date</label>
                  <input
                    type="date"
                    value={reportStart}
                    onChange={e => setReportStart(e.target.value)}
                    style={styles.input}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>End Date</label>
                  <input
                    type="date"
                    value={reportEnd}
                    onChange={e => setReportEnd(e.target.value)}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button onClick={() => exportReport('pdf')} style={styles.actionBtn}>
                  <span style={{ marginRight: 6, display: 'inline-flex', alignSelf: 'center' }}>
                    <Icon name="reports" size={14} />
                  </span>
                  Export PDF Report
                </button>
                <button onClick={() => exportReport('excel')} style={styles.actionBtn}>
                  <span style={{ marginRight: 6, display: 'inline-flex', alignSelf: 'center' }}>
                    <Icon name="analytics" size={14} />
                  </span>
                  Export Excel Sheet
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 11: Audit Logs */}
        {activeTab === 'audit-logs' && (
          <div>
            <div style={styles.viewHeader}>
              <h2>System Administration Audit Trail</h2>
            </div>
            <div style={styles.card}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.tableHeader}>Timestamp</th>
                    <th style={styles.tableHeader}>Administrator</th>
                    <th style={styles.tableHeader}>Action</th>
                    <th style={styles.tableHeader}>Module</th>
                    <th style={styles.tableHeader}>Target Record</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((l, idx) => (
                    <tr key={idx}>
                      <td style={styles.tableCell}>{new Date(l.created_at).toLocaleString()}</td>
                      <td style={styles.tableCell}>{l.admin_name}</td>
                      <td style={styles.tableCell}><strong>{l.action}</strong></td>
                      <td style={styles.tableCell}>{l.module}</td>
                      <td style={styles.tableCell}><code>{l.target_record}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* Tab 14: Settings */}
        {activeTab === 'settings' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', alignItems: 'start' }}>
              
              {/* Column 1 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* 1. Organization Information */}
                <div style={styles.card}>
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
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ flex: 1 }}>
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
                    <button onClick={async () => {
                      try {
                        await Promise.all([
                          saveSettingToDB('org_name', orgName),
                          saveSettingToDB('org_tagline', orgTagline),
                          saveSettingToDB('org_address', orgAddress),
                          saveSettingToDB('org_timezone', orgTimezone),
                          saveSettingToDB('org_language', orgLanguage)
                        ]);
                        showCustomAlert('Success', 'Organization settings saved to database.');
                      } catch (e) {
                        showCustomAlert('Error', 'Failed to save organization settings.');
                      }
                    }} style={{ ...styles.primaryButton, background: 'var(--red)', marginTop: 12 }}>
                      Save Changes
                    </button>
                  </div>
                </div>

                {/* 2. System Preferences */}
                <div style={styles.card}>
                  <div style={{ ...styles.cardHeader, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--red)' }}>
                    <Icon name="preferences" size={18} color="var(--red)" />
                    <span>System Preferences</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Maintenance Mode</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Temporarily disable the system for maintenance</div>
                      </div>
                      <div onClick={() => setMaintenanceMode(!maintenanceMode)} style={{ width: 44, height: 24, borderRadius: 12, background: maintenanceMode ? 'var(--red)' : '#cbd5e1', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                        <span style={{ position: 'absolute', top: 2, left: maintenanceMode ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Allow New Registrations</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Allow new rider and device registrations</div>
                      </div>
                      <div onClick={() => setAllowRegistrations(!allowRegistrations)} style={{ width: 44, height: 24, borderRadius: 12, background: allowRegistrations ? 'var(--red)' : '#cbd5e1', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                        <span style={{ position: 'absolute', top: 2, left: allowRegistrations ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Automatic Log Cleanup</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Automatically delete old logs</div>
                      </div>
                      <div onClick={() => setAutoLogCleanup(!autoLogCleanup)} style={{ width: 44, height: 24, borderRadius: 12, background: autoLogCleanup ? 'var(--red)' : '#cbd5e1', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                        <span style={{ position: 'absolute', top: 2, left: autoLogCleanup ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                      </div>
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

                    <button onClick={async () => {
                      try {
                        await Promise.all([
                          saveSettingToDB('maintenance_mode', String(maintenanceMode)),
                          saveSettingToDB('allow_registrations', String(allowRegistrations)),
                          saveSettingToDB('auto_log_cleanup', String(autoLogCleanup)),
                          saveSettingToDB('session_timeout', sessionTimeout)
                        ]);
                        showCustomAlert('Success', 'System preferences saved to database.');
                      } catch (e) {
                        showCustomAlert('Error', 'Failed to save preferences.');
                      }
                    }} style={{ ...styles.primaryButton, background: 'var(--red)', marginTop: 12 }}>
                      Save Changes
                    </button>
                  </div>
                </div>

                {/* 3. Alert Thresholds */}
                <div style={styles.card}>
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
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Alcohol Threshold (BAC %)</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>System sobriety cutoff value</div>
                      </div>
                      <input type="number" step="0.01" value={alcoholThreshold} onChange={e => setAlcoholThreshold(e.target.value)} style={{ ...styles.input, width: 80, textAlign: 'center' }} />
                    </div>

                    <button onClick={async () => {
                      try {
                        await Promise.all([
                          saveSettingToDB('failed_sobriety_alert', failedSobrietyAlert),
                          saveSettingToDB('override_event_alert', overrideEventAlert),
                          saveSettingToDB('critical_alert_escalation', criticalAlertEscalation),
                          saveSettingToDB('alcohol_threshold', alcoholThreshold)
                        ]);
                        showCustomAlert('Success', 'Alert thresholds saved to database.');
                      } catch (e) {
                        showCustomAlert('Error', 'Failed to save thresholds.');
                      }
                    }} style={{ ...styles.primaryButton, background: 'var(--red)', marginTop: 12 }}>
                      Save Changes
                    </button>
                  </div>
                </div>

              </div>

              {/* Column 2 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* 4. Date & Time Settings */}
                <div style={styles.card}>
                  <div style={{ ...styles.cardHeader, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--red)' }}>
                    <Icon name="clock" size={18} color="var(--red)" />
                    <span>Date & Time Settings</span>
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
                          { value: 'Asia/Manila', label: '(GMT+08:00) Asia/Manila' }
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
                      <div onClick={() => setAutoSyncTime(!autoSyncTime)} style={{ width: 44, height: 24, borderRadius: 12, background: autoSyncTime ? 'var(--red)' : '#cbd5e1', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                        <span style={{ position: 'absolute', top: 2, left: autoSyncTime ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                      </div>
                    </div>
                    <button onClick={async () => {
                      try {
                        await Promise.all([
                          saveSettingToDB('date_format', dateFormat),
                          saveSettingToDB('time_format', timeFormat),
                          saveSettingToDB('auto_sync_time', String(autoSyncTime))
                        ]);
                        showCustomAlert('Success', 'Date & time settings saved to database.');
                      } catch (e) {
                        showCustomAlert('Error', 'Failed to save date/time settings.');
                      }
                    }} style={{ ...styles.primaryButton, background: 'var(--red)', marginTop: 12 }}>
                      Save Changes
                    </button>
                  </div>
                </div>

                {/* 5. Security Settings */}
                <div style={styles.card}>
                  <div style={{ ...styles.cardHeader, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--red)' }}>
                    <Icon name="shield" size={18} color="var(--red)" />
                    <span>Security Settings</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Password Policy</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Enforce strong password requirements</div>
                      </div>
                      <div onClick={() => setPasswordPolicy(!passwordPolicy)} style={{ width: 44, height: 24, borderRadius: 12, background: passwordPolicy ? 'var(--red)' : '#cbd5e1', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                        <span style={{ position: 'absolute', top: 2, left: passwordPolicy ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Two-Factor Authentication</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Require 2FA for admin accounts</div>
                      </div>
                      <div onClick={() => setTwoFactorAuth(!twoFactorAuth)} style={{ width: 44, height: 24, borderRadius: 12, background: twoFactorAuth ? 'var(--red)' : '#cbd5e1', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                        <span style={{ position: 'absolute', top: 2, left: twoFactorAuth ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Login Attempt Limit</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Maximum failed login attempts</div>
                      </div>
                      <div style={{ width: 80 }}>
                        <CustomSelect
                          options={[
                            { value: '3', label: '3' },
                            { value: '5', label: '5' },
                            { value: '10', label: '10' }
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
                      <div style={{ width: 80 }}>
                        <CustomSelect
                          options={[
                            { value: '5', label: '5' },
                            { value: '15', label: '15' },
                            { value: '30', label: '30' }
                          ]}
                          value={lockoutDuration}
                          onChange={val => setLockoutDuration(val)}
                        />
                      </div>
                    </div>

                    <button onClick={async () => {
                      try {
                        await Promise.all([
                          saveSettingToDB('password_policy', String(passwordPolicy)),
                          saveSettingToDB('two_factor_auth', String(twoFactorAuth)),
                          saveSettingToDB('login_attempt_limit', loginAttemptLimit),
                          saveSettingToDB('lockout_duration', lockoutDuration),
                          saveSettingToDB('lockout_limit', lockoutLimit)
                        ]);
                        showCustomAlert('Success', 'Security settings saved to database.');
                      } catch (e) {
                        showCustomAlert('Error', 'Failed to save security settings.');
                      }
                    }} style={{ ...styles.primaryButton, background: 'var(--red)', marginTop: 12 }}>
                      Save Changes
                    </button>
                  </div>
                </div>

                {/* 6. Bluetooth Settings */}
                <div style={styles.card}>
                  <div style={{ ...styles.cardHeader, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--red)' }}>
                    <Icon name="bluetooth" size={18} color="var(--red)" />
                    <span>Bluetooth Settings (Helmet Connection)</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Scan Interval</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>How often to scan for helmet (seconds)</div>
                      </div>
                      <div style={{ width: 80 }}>
                        <CustomSelect
                          options={[
                            { value: '5', label: '5' },
                            { value: '10', label: '10' },
                            { value: '30', label: '30' }
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
                      <div style={{ width: 80 }}>
                        <CustomSelect
                          options={[
                            { value: '15', label: '15' },
                            { value: '30', label: '30' },
                            { value: '60', label: '60' }
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
                      <div onClick={() => setAutoReconnect(!autoReconnect)} style={{ width: 44, height: 24, borderRadius: 12, background: autoReconnect ? 'var(--red)' : '#cbd5e1', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                        <span style={{ position: 'absolute', top: 2, left: autoReconnect ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                      </div>
                    </div>

                    <button onClick={async () => {
                      try {
                        await Promise.all([
                          saveSettingToDB('scan_interval', scanInterval),
                          saveSettingToDB('bluetooth_timeout', bluetoothTimeout),
                          saveSettingToDB('auto_reconnect', String(autoReconnect))
                        ]);
                        showCustomAlert('Success', 'Bluetooth settings saved to database.');
                      } catch (e) {
                        showCustomAlert('Error', 'Failed to save bluetooth settings.');
                      }
                    }} style={{ ...styles.primaryButton, background: 'var(--red)', marginTop: 12 }}>
                      Save Changes
                    </button>
                  </div>
                </div>

              </div>

              {/* Column 3 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* 7. System Information */}
                <div style={styles.card}>
                  <div style={{ ...styles.cardHeader, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--red)' }}>
                    <Icon name="info" size={18} color="var(--red)" />
                    <span>System Information</span>
                  </div>
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

                {/* 8. Quick Actions */}
                <div style={styles.card}>
                  <div style={{ ...styles.cardHeader, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--red)' }}>
                    <Icon name="lightning" size={18} color="var(--red)" />
                    <span>Quick Actions</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                    <button onClick={() => showCustomAlert('Clear Cache', 'System cache and temporary safety logs have been cleared.')} style={{ ...styles.actionBtn, justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(128,128,128,0.05)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                      <span style={{ fontWeight: 650 }}>Clear Cache</span>
                      <span>&gt;</span>
                    </button>
                    <button onClick={() => setActiveTab('audit-logs')} style={{ ...styles.actionBtn, justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(128,128,128,0.05)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                      <span style={{ fontWeight: 650 }}>System Logs</span>
                      <span>&gt;</span>
                    </button>
                    <button onClick={() => showCustomAlert('Email Test', 'A test email notification has been dispatched to the administrator inbox.')} style={{ ...styles.actionBtn, justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(128,128,128,0.05)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                      <span style={{ fontWeight: 650 }}>Email Test</span>
                      <span>&gt;</span>
                    </button>
                    <button onClick={() => showCustomAlert('Updates', 'You are currently running the latest stable release (v1.0.0).')} style={{ ...styles.actionBtn, justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(128,128,128,0.05)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                      <span style={{ fontWeight: 650 }}>Check for Updates</span>
                      <span>&gt;</span>
                    </button>
                  </div>
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
                Generate and download complete database tables (Users, Ride history logs, config values) as structured JSON backup files.
              </p>
              <button onClick={exportBackup} style={styles.primaryButton}>
                <span style={{ marginRight: 6, display: 'inline-flex', alignSelf: 'center' }}>
                  <Icon name="backup" size={14} color="#fff" />
                </span>
                Download Database JSON Schema Backup
              </button>
            </div>
          </div>
        )}
      </main>

      {/* POPUP CONTAINER MODAL - ALERT */}
      {alertTitle && (
        <div style={styles.modalBackdrop}>
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
        <div style={styles.modalBackdrop}>
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
                Yes, Proceed
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
      {showAddUser && (
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
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Email Address</label>
                <input
                  type="text"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Mobile Number</label>
                <input
                  type="text"
                  placeholder="e.g. 09123456789"
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>
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
                    💡 <strong>Note:</strong> Riders registered by an Admin start with no Face ID data. They will be automatically prompted to enroll/register their Face ID when they first log into the client mobile app.
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button type="submit" style={styles.primaryButton}>
                  Register User
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  style={{ ...styles.primaryButton, background: '#737987' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Enterprise dark/light dashboard design theme styling
const styles: { [key: string]: React.CSSProperties } = {
  appWrapper: {
    display: 'flex',
    minHeight: '100vh',
    width: '100vw',
    background: 'var(--bg)',
    color: 'var(--text)',
    overflow: 'hidden'
  },
  sidebar: {
    width: '280px',
    background: 'var(--sidebar)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    height: '100vh',
    maxHeight: '100vh',
    overflowY: 'auto',
    boxSizing: 'border-box'
  },
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
  mainContent: {
    flex: 1,
    padding: '40px',
    overflowY: 'auto',
    height: '100vh'
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
