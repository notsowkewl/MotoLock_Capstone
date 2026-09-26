import type { AuditLog } from './types';

const value = (input: unknown): string => typeof input === 'string' ? input.trim() : typeof input === 'number' ? String(input) : '';

export function normalizeAuditLog(log: Record<string, unknown>, actor?: string): AuditLog {
  let details: Record<string, unknown> = {};
  try {
    const parsed = typeof log.action_details === 'string' ? JSON.parse(log.action_details) : log.action_details;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) details = parsed;
  } catch { /* Older malformed details must not hide the remaining logs. */ }
  let target = value(details.target_record) || value(log.target_record);
  if (!target || target === 'N/A') {
    target = '';
    for (const [field, label] of [['ride_id', 'Ride'], ['motorcycle_id', 'Motorcycle'], ['device_id', 'Device'], ['contact_id', 'Contact'], ['user_id', 'User']]) {
      if (value(details[field])) { target = `${label}: ${value(details[field])}`; break; }
    }
  }
  return {
    id: log.id as number,
    created_at: value(log.created_at),
    action: value(log.action_type) || value(log.action) || 'event',
    module: value(details.module) || value(log.module) || (value(log.action_type).split('_')[0] || 'system'),
    target_record: target || 'Not Recorded',
    admin_name: actor || value(log.admin_name) || value(details.actor) || 'System',
  };
}

export function sortAuditLogs(logs: AuditLog[], oldest = false) {
  return [...logs].sort((a, b) => {
    const aTime = Date.parse(a.created_at), bTime = Date.parse(b.created_at);
    if (!Number.isFinite(aTime)) return Number.isFinite(bTime) ? 1 : String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
    if (!Number.isFinite(bTime)) return -1;
    return (oldest ? 1 : -1) * (aTime - bTime || String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
  });
}
