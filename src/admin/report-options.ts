export const reportOptions = [
  { value: 'cat-safety', label: 'SAFETY & SOBRIETY', disabled: true },
  { value: 'safety-sobriety', label: 'Safety & Sobriety Report' },
  { value: 'cat-riders', label: 'RIDERS', disabled: true },
  { value: 'rider-master', label: 'Rider Master List' },
  { value: 'rider-activity', label: 'Rider Activity Report' },
  { value: 'rider-safety', label: 'Rider Safety Summary' },
  { value: 'rider-incident-hist', label: 'Rider Incident History' },
  { value: 'rider-reg', label: 'Rider Registration Report' },
  { value: 'cat-admin', label: 'ADMINISTRATION & ACCESS', disabled: true },
  { value: 'admin-accounts', label: 'Admin Accounts Report' },
  { value: 'admin-activity', label: 'Admin Activity & Audit Report' },
  { value: 'cat-motorcycles', label: 'MOTORCYCLES & DEVICES', disabled: true },
  { value: 'motorcycle-reg', label: 'Motorcycle Registry Report' },
  { value: 'device-inventory', label: 'MotoLock Device Inventory' },
  { value: 'helmet-unit', label: 'Helmet Unit Report' },
  { value: 'motorcycle-unit', label: 'Motorcycle Unit Report' },
  { value: 'device-pairing', label: 'Device Pairing Report' },
  { value: 'device-connection', label: 'Device Connection Status Report' },
  { value: 'device-fault', label: 'Device Fault & Failure Report' },
];
export const safetyViews = [
  { value: 'details', label: 'Detailed Records' },
  { value: 'failures', label: 'Failed Tests & Lockouts' },
  { value: 'trends', label: 'Trends' },
];
// Selection groups map to existing reports; data builders and export IDs stay intact.
export const reportAreas = [
  { value: 'safety-sobriety', label: 'Safety & Sobriety Report', views: safetyViews.map(view => ({ ...view, reportType: 'safety-sobriety' })) },
  { value: 'rider', label: 'Rider Report', views: [
    { value: 'rider-master', label: 'Master List', reportType: 'rider-master' },
    { value: 'rider-activity', label: 'Activity', reportType: 'rider-activity' },
    { value: 'rider-safety', label: 'Safety Summary', reportType: 'rider-safety' },
    { value: 'rider-incident-hist', label: 'Incident History', reportType: 'rider-incident-hist' },
    { value: 'rider-reg', label: 'Registration History', reportType: 'rider-reg' },
  ] },
  { value: 'admin', label: 'Admin Report', views: [
    { value: 'admin-accounts', label: 'Admin Accounts', reportType: 'admin-accounts' },
    { value: 'admin-activity', label: 'Activity & Audit History', reportType: 'admin-activity' },
  ] },
  { value: 'motorcycle', label: 'Motorcycle Report', views: [
    { value: 'motorcycle-reg', label: 'Registry', reportType: 'motorcycle-reg' },
    { value: 'motorcycle-unit', label: 'Unit Details', reportType: 'motorcycle-unit' },
  ] },
  { value: 'device', label: 'Device Report', views: [
    { value: 'device-inventory', label: 'Device Inventory', reportType: 'device-inventory' },
    { value: 'helmet-unit', label: 'Helmet Units', reportType: 'helmet-unit' },
    { value: 'device-pairing', label: 'Device Pairing', reportType: 'device-pairing' },
    { value: 'device-connection', label: 'Connection Status', reportType: 'device-connection' },
    { value: 'device-fault', label: 'Faults & Failures', reportType: 'device-fault' },
  ] },
];
export const reportGroups = reportOptions.filter(option => option.disabled).map((group, index, groups) => ({
  label: group.label,
  options: reportOptions.slice(reportOptions.indexOf(group) + 1, groups[index + 1] ? reportOptions.indexOf(groups[index + 1]) : undefined),
}));
