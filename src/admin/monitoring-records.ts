import type { Device } from './types';

type Row = Record<string, unknown>;
export interface RecordedState {
  value: boolean;
  timestamp: string;
  source: 'Ride record' | 'Audit event';
  recordId: string;
  synthetic: boolean;
}
export const monitoringReading = (value: unknown): boolean | null =>
  value === true || value === 1 ? true : value === false || value === 0 ? false : null;
const key = (value: unknown) => value == null ? '' : String(value);
const normalize = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : '';
function details(value: unknown): Row {
  if (typeof value === 'string') {
    try { return details(JSON.parse(value)); } catch { return {}; }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
}
function lockReading(row: Row) {
  const explicit = monitoringReading(row.is_locked);
  if (explicit !== null) return explicit;
  const state = normalize(row.unlock_status) || normalize(row.ignition);
  if (['locked', 'motor_still_locked'].includes(state)) return true;
  if (['unlocked', 'ok_unlocked', 'ignition_access_granted'].includes(state)) return false;
  return null;
}

// Only explicit outcomes with a device link and a usable timestamp are eligible.
// A passed/failed ride, online device, or shared rider does not establish a state.
export function attachMonitoringRecords<T extends Device>(devices: T[], rides: Row[], events: Row[]): (T & Pick<Device, 'recorded_status'>)[] {
  const rideMap = new Map(rides.map(ride => [key(ride.id), ride]));
  const history = new Map<string, { lock?: RecordedState; relay?: RecordedState }>();
  const sampleRides = new Set(events.filter(event => details(event.action_details).synthetic === true)
    .map(event => key(details(event.action_details).ride_id)).filter(Boolean));
  const add = (deviceId: string, row: Row, timestamp: unknown, source: RecordedState['source'], recordId: unknown, synthetic: boolean) => {
    if (!deviceId || typeof timestamp !== 'string' || !Number.isFinite(Date.parse(timestamp))) return;
    const state = history.get(deviceId) || {};
    for (const [field, value] of [['lock', lockReading(row)], ['relay', monitoringReading(row.relay_status)]] as const) {
      if (value === null) continue;
      if (!state[field] || Date.parse(timestamp) > Date.parse(state[field].timestamp)) {
        state[field] = { value, timestamp, source, recordId: key(recordId), synthetic };
      }
    }
    history.set(deviceId, state);
  };
  for (const ride of rides) {
    add(key(ride.device_id), ride, ride.updated_at || ride.created_at || ride.start_time,
      'Ride record', ride.id, ride.synthetic === true || sampleRides.has(key(ride.id)));
  }
  for (const event of events) {
    const data = details(event.action_details);
    const ride = rideMap.get(key(data.ride_id));
    const direct = key(data.device_id) || key(event.device_id);
    const linked = key(ride?.device_id);
    if (direct && linked && direct !== linked) continue;
    add(direct || linked, data, event.created_at, 'Audit event', event.id,
      data.synthetic === true || ride?.synthetic === true || sampleRides.has(key(data.ride_id)));
  }
  return devices.map(device => ({ ...device, recorded_status: history.get(key(device.id)) }));
}
