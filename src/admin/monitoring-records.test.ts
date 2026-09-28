import { expect, it } from 'vitest';
import { attachMonitoringRecords } from './monitoring-records';

const devices = [{ id: 'device-a', user_id: 'rider' }, { id: 'device-b', user_id: 'rider' }];
const rides = [{ id: 'ride-a', device_id: 'device-a', user_id: 'rider', status: 'completed', start_time: '2026-09-01T08:00:00Z' }];

it('links audit outcomes through a ride and selects the newest explicit state independently for each field', () => {
  const result = attachMonitoringRecords(devices, rides, [
    { id: 'new', created_at: '2026-09-03T08:00:00Z', action_details: { ride_id: 'ride-a', ignition: 'unlocked', synthetic: true } },
    { id: 'old', created_at: '2026-09-02T08:00:00Z', action_details: JSON.stringify({ ride_id: 'ride-a', ignition: 'locked', relay_status: 0 }) },
    { id: 'unrelated', created_at: '2026-09-04T08:00:00Z', action_details: { ride_id: 'ride-a', status: 'completed' } },
  ]);
  expect(result[0].recorded_status?.lock).toMatchObject({ value: false, recordId: 'new', synthetic: true });
  expect(result[0].recorded_status?.relay).toMatchObject({ value: false, recordId: 'old' });
  expect(result[1].recorded_status).toBeUndefined();
  expect(devices[0]).not.toHaveProperty('recorded_status');
});

it('does not infer hardware status from ride success, failure, or rider identity', () => {
  const result = attachMonitoringRecords(devices, [
    ...rides,
    { id: 'failed', device_id: 'device-b', status: 'failed_brac', start_time: '2026-09-02T08:00:00Z' },
  ], [{ user_id: 'rider', created_at: '2026-09-03T08:00:00Z', action_details: { ignition: 'locked' } }]);
  expect(result.every(device => !device.recorded_status?.lock && !device.recorded_status?.relay)).toBe(true);
});

it('rejects conflicting device links and invalid dates, while preserving explicit ride values', () => {
  const result = attachMonitoringRecords(devices, [{ ...rides[0], is_locked: 0 }], [
    { created_at: '2026-09-03T08:00:00Z', action_details: { ride_id: 'ride-a', device_id: 'device-b', ignition: 'locked' } },
    { created_at: 'invalid', action_details: { device_id: 'device-a', ignition: 'locked' } },
    { created_at: '2026-09-03T08:00:00Z', action_details: '{invalid json' },
  ]);
  expect(result[0].recorded_status?.lock).toMatchObject({ value: false, source: 'Ride record', timestamp: rides[0].start_time });
  expect(result[1].recorded_status).toBeUndefined();
});
