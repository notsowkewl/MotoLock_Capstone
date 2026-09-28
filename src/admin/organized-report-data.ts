import { reportOptions, safetyViews } from './report-options';
import { createReportSnapshot, reportDate, reportIgnitionState, reportRideStatus } from './report-snapshot';
import type { ReportSnapshot } from './report-snapshot';
import { buildIncidents } from './alert-records';

export type ReportRecord = Record<string, unknown>;
export interface ReportSources { users: ReportRecord[]; rides: ReportRecord[]; events: ReportRecord[]; devices: ReportRecord[]; motorcycles: ReportRecord[]; contacts: ReportRecord[] }
export const emptyReportSources: ReportSources = { users: [], rides: [], events: [], devices: [], motorcycles: [], contacts: [] };
export interface ReportFilters { search: string; start: string; end: string; sort: string; ride: string; sobriety: string; ignition: string; failure: string; role: string; face: string; account: string }
export const defaultReportFilters: ReportFilters = { search: '', start: '', end: '', sort: 'newest', ride: 'all', sobriety: 'all', ignition: 'all', failure: 'all', role: 'all', face: 'all', account: 'all' };
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
const key = text;
const normalized = (value: unknown) => text(value).toLowerCase().replace(/[\s-]+/g, '_');
export const accountStatusValue = (value: unknown) => normalized(value) === 'inactive' ? 'not_active' : normalized(value);
export const humanLabel = (value: unknown) => text(value).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Not Recorded';
const show = (value: unknown) => text(value) || 'Not Recorded';
function object(value: unknown): ReportRecord {
  if (typeof value === 'string') { try { return object(JSON.parse(value)); } catch { return {}; } }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ReportRecord : {};
}
const measured = (row: ReportRecord) => text(row.initial_brac_level) !== '' && Number.isFinite(Number(row.initial_brac_level)) && Number(row.initial_brac_level) >= 0;
const timestamp = (row: ReportRecord) => text(row.start_time) || text(row.created_at);
const lock = (row: ReportRecord) => reportIgnitionState({ id: key(row.id), is_locked: row.is_locked as boolean });
const outcome = (row: ReportRecord) => reportRideStatus({ id: key(row.id), status: text(row.status) });
const sobrietyFailure = (row: ReportRecord) => ['failed_brac', 'failed_sobriety', 'sobriety_test_failed'].includes(normalized(row.status));
const lockout = (row: ReportRecord) => row.lockout_triggered === true || row.lockout_triggered === 1 || ['lockout', 'locked_out', 'lockout_triggered'].includes(normalized(row.status));
export function reportControls(type: string, view: string) {
  const safety = type === 'safety-sobriety';
  const details = safety && view === 'details';
  const inventory = ['device-inventory', 'helmet-unit', 'motorcycle-unit', 'device-pairing', 'device-connection'].includes(type);
  return { safety, details, inventory, ride: details || type === 'rider-safety', sobriety: details || type === 'rider-safety',
    ignition: details || type === 'device-inventory', failure: safety && view === 'failures',
    account: type === 'rider-master', dates: !inventory && !['rider-master', 'motorcycle-reg'].includes(type),
    devices: inventory || type === 'device-fault' || type === 'motorcycle-reg' };
}

export function buildOrganizedReport(type: string, view: string, data: ReportSources, filters: ReportFilters, threshold: string): ReportSnapshot {
  const controls = reportControls(type, view);
  const userMap = new Map(data.users.map(row => [key(row.id), row]));
  const rideMap = new Map(data.rides.map(row => [key(row.id), row]));
  const rider = (id: unknown) => {
    const user = userMap.get(key(id));
    return [text(user?.name) || text(user?.full_name) || (key(id) ? 'Name not available' : 'Unassigned'), text(user?.email)].filter(Boolean).join('\n');
  };
  const matches = (...values: unknown[]) => !filters.search.trim() || values.some(value => text(value).toLocaleLowerCase().includes(filters.search.trim().toLocaleLowerCase()));
  const riderMatches = (id: unknown) => matches(rider(id));
  const inRange = (value: string) => {
    if (!controls.dates || (!filters.start && !filters.end)) return true;
    const time = Date.parse(value);
    return Number.isFinite(time) && (!filters.start || time >= new Date(filters.start + 'T00:00:00').getTime()) && (!filters.end || time <= new Date(filters.end + 'T23:59:59.999').getTime());
  };
  const ordered = (rows: ReportRecord[], date = timestamp) => [...rows].sort((a, b) => {
    const x = Date.parse(date(a)), y = Date.parse(date(b));
    if (!Number.isFinite(x)) return Number.isFinite(y) ? 1 : 0;
    if (!Number.isFinite(y)) return -1;
    return (filters.sort === 'oldest' ? 1 : -1) * (x - y);
  });
  // Reuse the existing sobriety classification and its configured threshold.
  const asReportRow = (row: ReportRecord) => ({ id: key(row.id), created_at: timestamp(row), full_name: rider(row.user_id).split('\n')[0],
    email: text(userMap.get(key(row.user_id))?.email), brac: text(row.initial_brac_level), status: text(row.status),
    is_locked: row.is_locked as boolean, failure_reason: text(row.failure_reason) });
  const detailSnapshot = (rows: ReportRecord[]) => createReportSnapshot('sobriety-test', rows.map(asReportRow), { coverage: '', filters: '', alcoholThreshold: threshold, sortOrder: filters.sort });
  const sobrietyCache = new Map<ReportRecord, string>();
  const sober = (row: ReportRecord) => {
    if (!sobrietyCache.has(row)) sobrietyCache.set(row, detailSnapshot([row]).rows[0][3]);
    return sobrietyCache.get(row)!;
  };
  const activeFilters = [filters.search && `Search: ${filters.search.trim()}`, controls.dates && (filters.start || filters.end) && `Dates: ${filters.start || 'Beginning'} to ${filters.end || 'Present'}`,
    controls.ride && filters.ride !== 'all' && `Ride Status: ${filters.ride}`, controls.sobriety && filters.sobriety !== 'all' && `Sobriety Status: ${filters.sobriety}`,
    controls.ignition && filters.ignition !== 'all' && `Ignition State: ${filters.ignition}`, controls.failure && filters.failure !== 'all' && `Failure / Lockout Type: ${humanLabel(filters.failure)}`,
    controls.account && filters.role !== 'all' && `Role: ${humanLabel(filters.role)}`, controls.account && filters.face !== 'all' && `Face ID: ${filters.face}`,
    controls.account && filters.account !== 'all' && `Account Status: ${humanLabel(filters.account)}`].filter(Boolean);
  const snapshot: ReportSnapshot = { type, view: controls.safety ? view : undefined, title: reportOptions.find(option => option.value === type)?.label || 'MotoLock Report',
    generatedAt: new Date().toISOString(), coverage: controls.dates ? `${filters.start || 'Beginning'} to ${filters.end || 'Present'}` : 'Current saved records',
    filters: [...(controls.safety ? [`View: ${safetyViews.find(item => item.value === view)?.label || 'Detailed Records'}`] : []), ...activeFilters, `Sort Order: ${filters.sort === 'oldest' ? 'Oldest first' : 'Newest first'}`].join(' | '), hasFilters: !!activeFilters.length, headers: [], rows: [] };
  const rides = ordered(data.rides.filter(row => riderMatches(row.user_id) && inRange(timestamp(row))
    && (!controls.ride || filters.ride === 'all' || outcome(row) === filters.ride)
    && (!controls.sobriety || filters.sobriety === 'all' || sober(row) === filters.sobriety)
    && (!controls.ignition || filters.ignition === 'all' || lock(row) === filters.ignition)));
  const stat = (label: string, value: number | string) => ({ label, value });
  const safetyStats = (rows: ReportRecord[]) => [stat('Total Records', rows.length), ...['Sober', 'Not Sober'].map(label => stat(label, rows.filter(row => sober(row) === label).length)), ...['Passed', 'Failed', 'Ongoing'].map(label => stat(label, rows.filter(row => outcome(row) === label).length))];
  if (controls.safety) {
    if (view === 'details') {
      const detail = detailSnapshot(rides);
      snapshot.headers = detail.headers; snapshot.rows = detail.rows; snapshot.summary = safetyStats(rides);
    } else if (view === 'failures') {
      snapshot.title = 'Failed Tests & Lockouts';
      const events = data.events.filter(event => ['lockout_triggered', 'sobriety_test_failed'].includes(normalized(event.action_type))).flatMap(event => {
        const details = object(event.action_details), linked = rideMap.get(key(details.ride_id));
        // Do not count a log and its failed ride as separate events.
        if (linked && (sobrietyFailure(linked) || lockout(linked))) return [];
        return [{ ...details, id: event.id, user_id: linked?.user_id || details.user_id || event.user_id,
          start_time: event.created_at, status: event.action_type, initial_brac_level: details.initial_brac_level ?? details.brac_level }];
      });
      const failed = ordered([...data.rides.filter(row => sobrietyFailure(row) || lockout(row)), ...events].filter(row => riderMatches(row.user_id) && inRange(timestamp(row))
        && (filters.failure === 'all' || (filters.failure === 'sobriety' ? sobrietyFailure(row) : lockout(row)))));
      const hasReason = failed.some(row => text(row.failure_reason) || text(row.lockout_reason) || text(row.reason));
      snapshot.headers = ['Date & Time', 'Rider Details', 'BAC Level', 'Sobriety Status', ...(hasReason ? ['Failure / Lockout Reason'] : []), 'Ignition State', 'Ride Status'];
      snapshot.rows = failed.map(row => { const cells = detailSnapshot([row]).rows[0]; return [...cells.slice(0, 4), ...(hasReason ? [humanLabel(row.failure_reason || row.lockout_reason || row.reason)] : []), cells[4], outcome(row)]; });
      snapshot.summary = [stat('Total Failed Events', failed.length), stat('Sobriety Failures', failed.filter(sobrietyFailure).length), stat('Lockouts', failed.filter(lockout).length), stat('Riders Affected', new Set(failed.map(row => key(row.user_id)).filter(Boolean)).size)];
    } else {
      snapshot.title = 'Sobriety Trends';
      const tests = rides.filter(measured), dated = tests.filter(row => Number.isFinite(Date.parse(timestamp(row))));
      const buckets = new Map<string, ReportRecord[]>();
      for (const row of dated) {
        const date = new Date(timestamp(row));
        const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        buckets.set(day, [...(buckets.get(day) || []), row]);
      }
      const undated = tests.filter(row => !Number.isFinite(Date.parse(timestamp(row))));
      if (undated.length) buckets.set('Not Recorded', undated);
      const passed = tests.filter(row => outcome(row) === 'Passed').length;
      const failed = tests.filter(row => outcome(row) === 'Failed').length;
      const rate = (p: number, total: number) => total ? `${(p / total * 100).toFixed(1)}%` : 'Not Recorded';
      snapshot.summary = [stat('Total Tests', tests.length), stat('Passed', passed), stat('Failed', failed), stat('Sober', tests.filter(row => sober(row) === 'Sober').length), stat('Not Sober', tests.filter(row => sober(row) === 'Not Sober').length), stat('Pass Rate', rate(passed, tests.length))];
      snapshot.headers = ['Date', 'Total Tests', 'Passed', 'Failed', 'Sober', 'Not Sober', 'Pass Rate'];
      snapshot.chart = [];
      for (const [date, rows] of [...buckets.entries()].sort(([a], [b]) => a === 'Not Recorded' ? 1 : b === 'Not Recorded' ? -1 : filters.sort === 'oldest' ? a.localeCompare(b) : b.localeCompare(a))) {
        const p = rows.filter(row => outcome(row) === 'Passed').length, f = rows.filter(row => outcome(row) === 'Failed').length;
        const s = rows.filter(row => sober(row) === 'Sober').length, n = rows.filter(row => sober(row) === 'Not Sober').length;
        snapshot.rows.push([date, String(rows.length), String(p), String(f), String(s), String(n), rate(p, rows.length)]);
        if (date !== 'Not Recorded') snapshot.chart.push({ date, total: rows.length, sober: s, notSober: n });
      }
    }
  } else if (type === 'rider-safety') {
    snapshot.headers = ['Rider', 'Total Tests', 'Sober Tests', 'Not Sober Tests', 'Passed Rides', 'Failed Rides'];
    const groups = new Map<string, ReportRecord[]>();
    for (const row of rides) { const id = key(row.user_id); if (id) groups.set(id, [...(groups.get(id) || []), row]); }
    snapshot.rows = [...groups.entries()].map(([id, rows]) => [rider(id), String(rows.filter(measured).length), String(rows.filter(row => sober(row) === 'Sober').length), String(rows.filter(row => sober(row) === 'Not Sober').length), String(rows.filter(row => outcome(row) === 'Passed').length), String(rows.filter(row => outcome(row) === 'Failed').length)]);
  } else if (type === 'rider-reg') {
    // Account creation timestamps are registration history. Current account
    // status and profile updates do not establish a historical registration status.
    const registrations = ordered(data.users.filter(row => normalized(row.role) === 'rider'
      && Number.isFinite(Date.parse(text(row.created_at)))
      && riderMatches(row.id) && inRange(text(row.created_at))), row => text(row.created_at));
    snapshot.headers = ['Registration Date & Time', 'Rider', 'Account ID'];
    snapshot.rows = registrations.map(row => [reportDate(text(row.created_at)), rider(row.id), show(row.id)]);
    snapshot.summary = [stat('Registrations', registrations.length)];
  } else if (type === 'rider-master') {
    const users = ordered(data.users.filter(row => riderMatches(row.id) && (
      (filters.role === 'all' || row.role === filters.role) && (filters.face === 'all' || (row.face_enrolled || row.face_descriptor ? 'Enrolled' : 'Missing') === filters.face)
      && (filters.account === 'all' || accountStatusValue(row.status) === filters.account))), row => text(row.created_at));
    const hasAccount = data.users.some(row => text(row.status));
    snapshot.headers = ['Rider Name', 'Email', 'Motorcycle', 'Emergency Contacts', 'Role', 'Face ID', ...(hasAccount ? ['Account Status'] : [])];
    snapshot.rows = users.map(row => {
      const name = text(row.name) || text(row.full_name) || 'Not Recorded', face = row.face_enrolled || row.face_descriptor ? 'Enrolled' : 'Missing';
      return [name, show(row.email), data.motorcycles.filter(m => key(m.user_id) === key(row.id)).map(m => [text(m.model), text(m.plate_number)].filter(Boolean).join(' · ')).join('\n') || 'None registered',
        data.contacts.filter(c => key(c.user_id) === key(row.id)).map(c => text(c.name)).filter(Boolean).join('\n') || 'Not Recorded', humanLabel(row.role), face, ...(hasAccount ? [humanLabel(accountStatusValue(row.status))] : [])];
    });
  } else if (type === 'rider-activity') {
    snapshot.headers = ['Date & Time', 'Rider', 'Activity', 'Area', 'Related Record'];
    snapshot.rows = ordered(data.events.filter(event => userMap.has(key(event.user_id)) && riderMatches(event.user_id) && inRange(text(event.created_at))), row => text(row.created_at)).map(event => {
      const details = object(event.action_details);
      return [reportDate(text(event.created_at)), rider(event.user_id), humanLabel(event.action_type), humanLabel(details.module || event.module), show(details.ride_id || details.device_id || details.motorcycle_id || details.target_record)];
    });
  } else if (type === 'rider-incident-hist') {
    snapshot.headers = ['Date & Time', 'Rider', 'Incident', 'Recorded Action', 'Status', 'Resolved At'];
    const incidents = buildIncidents(data.rides, data.users, data.events, threshold).filter(incident => matches(incident.rider, incident.email) && inRange(incident.timestamp));
    if (filters.sort === 'oldest') incidents.reverse();
    snapshot.rows = incidents.map(incident => [reportDate(incident.timestamp), [incident.rider, incident.email].filter(Boolean).join('\n'), humanLabel(incident.trigger), humanLabel(incident.systemAction), incident.status, reportDate(incident.resolvedAt)]);
  } else if (type === 'motorcycle-reg') {
    snapshot.headers = ['Motorcycle ID', 'Plate / Registration', 'Rider', 'Motorcycle Model', 'Year', 'Color'];
    snapshot.rows = ordered(data.motorcycles.filter(row => matches(row.id, row.plate_number, row.model, rider(row.user_id)))).map(row => [show(row.id), show(row.plate_number), rider(row.user_id), show(row.model), show(row.year), show(row.color)]);
  } else if (type === 'device-fault') {
    snapshot.headers = ['Date & Time', 'Device ID', 'SIM Card Slot', 'Assigned Rider', 'Fault / Failure', 'Recorded Details'];
    snapshot.rows = ordered(data.events.filter(event => ['device_fault', 'device_failure', 'helmet_fault', 'motorcycle_fault'].includes(normalized(event.action_type)) && inRange(text(event.created_at))), row => text(row.created_at)).flatMap(event => {
      const details = object(event.action_details), device = data.devices.find(d => key(d.id) === key(details.device_id));
      if (!matches(details.device_id, rider(device?.user_id || event.user_id))) return [];
      return [[reportDate(text(event.created_at)), show(details.device_id), text(device?.sim_number) || 'N/A', rider(device?.user_id || event.user_id), humanLabel(event.action_type), show(details.failure_reason || details.reason || details.message)]];
    });
  } else {
    const motorcycleMap = new Map(data.motorcycles.map(row => [key(row.id), row]));
    const units = ordered(data.devices.filter(row => {
      const unit = normalized(row.device_type || row.unit_type);
      return (type !== 'helmet-unit' || unit === 'helmet') && (type !== 'motorcycle-unit' || unit === 'motorcycle')
        && matches(row.id, row.sim_number, row.mac_address, rider(row.user_id), motorcycleMap.get(key(row.motorcycle_id))?.plate_number)
        && (!controls.ignition || filters.ignition === 'all' || lock(row) === filters.ignition);
    }));
    const base = ['Device ID', 'SIM Card Slot'];
    snapshot.headers = type === 'device-inventory' ? [...base, 'Ignition State', 'Assigned Rider']
      : type === 'device-pairing' ? [...base, 'Assigned Rider', 'Motorcycle ID', 'Plate / Registration']
      : type === 'device-connection' ? [...base, 'Assigned Rider', 'Recorded Device Status', 'Last Ping']
      : [...base, 'Assigned Rider', 'MAC Address', 'Firmware Version', 'Motorcycle ID'];
    snapshot.rows = units.map(row => {
      const baseCells = [show(row.id), text(row.sim_number) || 'N/A'];
      if (type === 'device-inventory') return [...baseCells, lock(row), rider(row.user_id)];
      if (type === 'device-pairing') return [...baseCells, rider(row.user_id), show(row.motorcycle_id), show(motorcycleMap.get(key(row.motorcycle_id))?.plate_number)];
      if (type === 'device-connection') return [...baseCells, rider(row.user_id), humanLabel(row.status), reportDate(text(row.last_ping_at))];
      return [...baseCells, rider(row.user_id), show(row.mac_address), show(row.firmware_version), show(row.motorcycle_id)];
    });
  }
  snapshot.summary ??= [stat(type === 'rider-safety' ? 'Riders' : 'Total Records', snapshot.rows.length)];
  return snapshot;
}
