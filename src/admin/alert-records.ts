export type AlertRow = Record<string, unknown>;
export type AlertStatus = 'Active' | 'Resolved';
export interface Incident {
  id: string;
  timestamp: string;
  rider: string;
  email: string;
  trigger: string;
  brac: string;
  severity: string;
  systemAction: string;
  originalStatus: string;
  details: string;
  status: AlertStatus;
  resolvedAt?: string;
  resolvedBy?: string;
  note?: string;
}
export const ALERT_RESOLVED = 'alert_resolved';
export const ALERT_DELETED = 'alert_deleted';
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const key = (value: unknown) => value == null ? '' : String(value);
const normalize = (value: unknown) => text(value).toLowerCase().replace(/[\s-]+/g, '_');
const time = (value: string) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : -Infinity;
export const alertTime = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : 'Not Recorded';

function incidentSeverity(recorded: unknown, status: string, trigger: string, reading: number, limit: number): string {
  if (text(recorded)) return text(recorded);
  if (trigger === 'Alcohol Above Limit' || status === 'failed_brac' || (Number.isFinite(reading) && reading > limit)) return 'High';
  if (trigger === 'Identity Verification Failed' || ['failed_face', 'failed_identity', 'verification_failed'].includes(status)) return 'Medium';
  return '';
}

function object(value: unknown): AlertRow {
  if (typeof value === 'string') {
    try { return object(JSON.parse(value)); } catch { return {}; }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AlertRow : {};
}

export function buildIncidents(rides: AlertRow[], users: AlertRow[], events: AlertRow[], threshold: string): Incident[] {
  const userMap = new Map(users.map(user => [key(user.id), user]));
  const resolutions = new Map<string, { event: AlertRow; details: AlertRow }>();
  // First saved resolution wins, including when two administrators confirm concurrently.
  for (const event of [...events].sort((a, b) => time(text(a.created_at)) - time(text(b.created_at)))) {
    const details = object(event.action_details);
    if (event.action_type === ALERT_RESOLVED && details.status === 'Resolved' && key(details.ride_id) && !resolutions.has(key(details.ride_id))) {
      resolutions.set(key(details.ride_id), { event, details });
    }
  }
  const configured = threshold.trim() ? Number(threshold) : NaN;
  const limit = Number.isFinite(configured) && configured >= 0 ? configured : 0.05;
  const incidents = new Map<string, Incident>();
  for (const ride of rides) {
    const id = key(ride.id);
    if (!id) continue;
    const status = normalize(ride.status);
    const brac = ride.initial_brac_level == null ? '' : String(ride.initial_brac_level);
    const reading = brac.trim() ? Number(brac) : NaN;
    let trigger = text(ride.trigger_reason);
    if (!trigger) {
      if (status === 'failed_brac' || (Number.isFinite(reading) && reading > limit)) trigger = 'Alcohol Above Limit';
      else if (['failed_face', 'failed_identity', 'verification_failed'].includes(status)) trigger = 'Identity Verification Failed';
      else if (status === 'failed_helmet') trigger = 'Helmet Verification Failed';
    }
    if (!trigger && !resolutions.has(id)) continue;
    const user = userMap.get(key(ride.user_id));
    let systemAction = text(ride.system_action) || text(ride.action_taken) || text(ride.unlock_status);
    if (!systemAction && (ride.is_locked === true || ride.is_locked === 1)) systemAction = 'Locked';
    if (!systemAction && (ride.is_locked === false || ride.is_locked === 0)) systemAction = 'Unlocked';
    incidents.set(id, {
      id, timestamp: text(ride.start_time) || text(ride.created_at),
      rider: text(user?.name) || text(user?.full_name), email: text(user?.email),
      trigger, brac, severity: incidentSeverity(ride.severity || ride.severity_level, status, trigger, reading, limit),
      systemAction, originalStatus: text(ride.status),
      details: text(ride.failure_reason) || text(ride.reason) || text(ride.incident_details), status: 'Active',
    });
  }
  for (const [id, { event, details }] of resolutions) {
    const snapshot = object(details.incident);
    const original = incidents.get(id);
    const field = (name: keyof Incident) => {
      const saved = typeof snapshot[name] === 'string' ? text(snapshot[name]) : '';
      if (name === 'severity') {
        const trigger = text(snapshot.trigger) || text(original?.trigger);
        const status = normalize(snapshot.originalStatus || original?.originalStatus);
        const brac = text(snapshot.brac) || text(original?.brac);
        const reading = brac ? Number(brac) : NaN;
        return incidentSeverity(saved || original?.severity, status, trigger, reading, limit);
      }
      return typeof snapshot[name] === 'string' ? snapshot[name] as string : text(original?.[name]);
    };
    const actor = userMap.get(key(event.user_id));
    incidents.set(id, {
      id, timestamp: field('timestamp'), rider: field('rider'), email: field('email'),
      trigger: field('trigger'), brac: field('brac'), severity: field('severity'),
      systemAction: field('systemAction'), originalStatus: field('originalStatus'), details: field('details'), status: 'Resolved',
      resolvedAt: text(event.created_at),
      resolvedBy: text(details.resolved_by) || text(actor?.name) || text(actor?.email) || key(event.user_id),
      note: text(details.resolution_note),
    });
  }
  const deleted = new Set(events.filter(event => event.action_type === ALERT_DELETED)
    .map(event => key(object(event.action_details).ride_id)));
  return [...incidents.values()].filter(incident => !(incident.status === 'Resolved' && deleted.has(incident.id)))
    .sort((a, b) => time(b.timestamp) - time(a.timestamp));
}

export function triggerLabel(incident: Incident): string {
  return (incident.trigger || 'Not Recorded') + (incident.brac.trim() ? ` — ${incident.brac} BAC` : '');
}

export function filterIncidents(incidents: Incident[], search: string, status: string, severity: string, trigger: string): Incident[] {
  return incidents.filter(incident => incident.rider.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
    && (status === 'all' || incident.status === status)
    && (severity === 'all' || (incident.severity || 'Not Recorded') === severity)
    && (trigger === 'all' || (incident.trigger || 'Not Recorded') === trigger));
}

export interface AlertStore {
  read(table: string): Promise<AlertRow[]>;
  getActor(): Promise<{ id: string; email?: string } | null>;
  insert(event: AlertRow): Promise<AlertRow>;
}

export async function resolveIncident(store: AlertStore, incident: Incident, note: string): Promise<AlertRow> {
  const actor = await store.getActor();
  // Avoid duplicate resolution from a stale view and preserve the first administrator's note.
  const events = await store.read('audit_logs');
  const existing = events.find(event => {
    const details = object(event.action_details);
    return event.action_type === ALERT_RESOLVED && details.status === 'Resolved' && key(details.ride_id) === incident.id;
  });
  if (existing) return existing;
  const profileId = await auditProfileId(store, actor);
  return store.insert({
    user_id: profileId,
    action_type: ALERT_RESOLVED,
    created_at: new Date().toISOString(),
    action_details: {
      module: 'Alerts', ride_id: incident.id, status: 'Resolved',
      resolved_by: actor?.email || actor?.id || null,
      resolved_by_auth_id: actor?.id ?? null,
      resolution_note: note.trim() || null,
      incident: {
        timestamp: incident.timestamp, rider: incident.rider, email: incident.email,
        trigger: incident.trigger, brac: incident.brac, severity: incident.severity,
        systemAction: incident.systemAction, originalStatus: incident.originalStatus, details: incident.details,
      },
    },
  });
}

async function auditProfileId(store: AlertStore, actor: Awaited<ReturnType<AlertStore['getActor']>>): Promise<string | null> {
  // audit_logs.user_id references public.users, not auth.users. Legacy admin
  // profiles can have a different ID, as supported by the email-based login.
  let profileId: string | null = null;
  if (actor) {
    const profiles = await store.read('users');
    let profile = profiles.find(candidate => key(candidate.id) === actor.id);
    if (!profile && actor.email?.trim()) {
      const email = actor.email.trim().toLowerCase();
      const matches = profiles.filter(candidate => text(candidate.email).toLowerCase() === email);
      if (matches.length === 1) profile = matches[0];
    }
    if (!profile || !key(profile.id) || !['admin', 'superadmin'].includes(text(profile.role))) {
      throw new Error('Unable to match your signed-in account to a MotoLock administrator profile. Please sign in again or have your administrator profile checked.');
    }
    profileId = key(profile.id);
  }
  return profileId;
}

export async function deleteResolvedIncident(store: AlertStore, incident: Incident): Promise<AlertRow> {
  if (incident.status !== 'Resolved') throw new Error('Only resolved alerts can be deleted.');
  const actor = await store.getActor();
  if (!actor) throw new Error('Please sign in before deleting a resolved alert.');
  const profileId = await auditProfileId(store, actor);
  const events = await store.read('audit_logs');
  const matches = (event: AlertRow) => key(object(event.action_details).ride_id) === incident.id;
  if (!events.some(event => matches(event) && event.action_type === ALERT_RESOLVED && object(event.action_details).status === 'Resolved')) {
    throw new Error('This alert has no saved resolution. Refresh alerts and try again.');
  }
  const existing = events.find(event => matches(event) && event.action_type === ALERT_DELETED);
  if (existing) return existing;
  // Record a soft deletion so the test and resolution remain intact and the
  // incident cannot reappear as an active alert on reload.
  return store.insert({
    user_id: profileId,
    action_type: ALERT_DELETED,
    created_at: new Date().toISOString(),
    action_details: {
      module: 'Alerts', ride_id: incident.id,
      deleted_by: actor.email || actor.id, deleted_by_auth_id: actor.id,
    },
  });
}
