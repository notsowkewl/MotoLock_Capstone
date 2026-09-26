import type { AuditLog } from './types';

const titleCase = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const activities: Record<string, string> = {
  ride_ongoing: 'Ride In Progress', login_success: 'Successful Login',
  login_failed: 'Failed Login', incident_opened: 'Incident Reported',
};
const areas: Record<string, string> = {
  ride: 'Rides', alert: 'Alerts', incident: 'Incidents', profile: 'Profiles',
  login: 'Account Access', device: 'MotoLock Devices', sobriety_test: 'Sobriety Tests',
  identity_verification: 'Identity Verification',
};
export const activityLabel = (value: string) => activities[value.toLowerCase()] || titleCase(value);
export const areaLabel = (value: string) => areas[value.toLowerCase()] || titleCase(value);

export function performerLabel(log: Pick<AuditLog, 'admin_name' | 'module' | 'action'>) {
  // A developer account name alone is not proof that an action was automated.
  const systemEvent = log.module.toLowerCase() === 'system' || log.action.toLowerCase().startsWith('system_');
  return log.admin_name === 'MotoLock Developers' && systemEvent ? 'System' : log.admin_name || 'Not Recorded';
}

export function relatedRecordLabel(value?: string) {
  if (!value) return 'Not Recorded';
  return value.replace(/^([\w ]+):\s*/, '$1 · ')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, uuid => uuid.slice(0, 8) + '...');
}
