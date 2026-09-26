import { expect, it } from 'vitest';
import { getIdentityDisplay as display, getIdentityLockAction, formatVerificationTime, getVerificationMethod, getIdentityDetails, filterIdentityRecords } from './identity-status';
import { getSobrietyOutcome } from './sobriety-status';
import type { SafetyLog } from './types';

it('derives the final action from verification and the actual alcohol reading', () => {
  const identity = display({ face_verified: true, is_locked: false });
  for (const [brac, expected] of [
    ['', 'Awaiting Alcohol Test'], ['invalid', 'Awaiting Alcohol Test'],
    ['0', 'Unlocked'], ['0.05', 'Unlocked'], ['0.051', 'Locked'],
  ]) {
    const log = { brac, status: 'ongoing' } as SafetyLog;
    const { alcoholResult } = getSobrietyOutcome(log, '0.05');
    expect(getIdentityLockAction(identity, alcoholResult)).toBe(expected);
    expect(getIdentityLockAction(display({ face_verified: false, is_locked: false }), alcoholResult)).toBe('Locked');
  }
  const log = { brac: '0.04' } as SafetyLog;
  expect(getIdentityLockAction(identity, getSobrietyOutcome(log, '0.03').alcoholResult)).toBe('Locked');
  expect(getIdentityLockAction(display({}), 'Not Tested')).toBe('Pending');
});

it('shows the recorded date and time without inventing missing timestamps', () => {
  expect(formatVerificationTime('2026-09-23T17:14:00')).toBe('9/23/2026, 5:14 PM');
  expect(formatVerificationTime('')).toBe('Not recorded');
});

it('does not infer a hardware unlock from session completion', () => {
  for (const status of ['passed', 'completed', 'ongoing', 'unknown']) {
    expect(display({ status }).lockAction).toBe('Pending');
  }
  expect(display({ status: 'failed_face' })).toEqual({ verification: 'Failed', lockAction: 'Locked' });
  expect(display({ status: 'completed', unlock_status: 'Ignition access granted' }).lockAction).toBe('Unlocked');
  expect(display({ is_locked: true, status: 'completed' }).lockAction).toBe('Locked');
});
it('separates failed, verified, bypassed, and missing verification evidence', () => {
  expect(display({ face_verified: true }).verification).toBe('Verified');
  expect(display({ face_verified: false }).verification).toBe('Failed');
  expect(display({ status: 'failed_face', face_verified: true }).verification).toBe('Failed');
  expect(display({ status: 'verification_bypassed', face_verified: false }).verification).toBe('Bypassed');
  expect(display({ status: 'ongoing' }).verification).toBe('Not Recorded');
  const raw = { status: 'passed', unlock_status: 'pending' };
  display(raw);
  expect(raw).toEqual({ status: 'passed', unlock_status: 'pending' });
});

it('only labels methods supported by recorded method data', () => {
  expect(getVerificationMethod({ verification_method: 'face_recognition' })).toBe('Face Recognition');
  expect(getVerificationMethod({ verification_method: 'PIN/Override' })).toBe('PIN/Override');
  for (const verification_method of [undefined, null, '', 'unknown']) {
    expect(getVerificationMethod({ verification_method })).toBe('Not Recorded');
  }
});

it('only exposes details and valid attempt counts when recorded for the relevant result', () => {
  expect(getIdentityDetails({}, 'Failed')).toBeNull();
  expect(getIdentityDetails({}, 'Bypassed')).toBeNull();
  expect(getIdentityDetails({ failure_reason: 'Face mismatch', verification_attempts: 3 }, 'Failed'))
    .toBe('Failure reason: Face mismatch\nNumber of attempts: 3');
  expect(getIdentityDetails({ attempt_count: 0 }, 'Failed')).toBe('Number of attempts: 0');
  for (const attempt_count of [null, '', false, -1, 1.5, 'invalid']) {
    expect(getIdentityDetails({ attempt_count }, 'Failed')).toBeNull();
  }
  expect(getIdentityDetails({ override_details: 'Approved by administrator' }, 'Bypassed'))
    .toBe('Override details: Approved by administrator');
  expect(getIdentityDetails({ failure_reason: 'Unrelated failure' }, 'Bypassed')).toBeNull();
  expect(getIdentityDetails({ failure_reason: 'Unrelated failure' }, 'Verified')).toBeNull();
});

it('combines rider search and both filters, sorts newest first, and preserves source order', () => {
  const records = [
    { id: 1, full_name: 'Ana Cruz', created_at: '2026-09-23T17:14:00+08:00', identity_display: display({ face_verified: false }) },
    { id: 2, full_name: 'Ben Cruz', created_at: '2026-09-25T17:14:00+08:00', identity_display: display({}) },
    { id: 3, full_name: 'Ana Cruz', created_at: '2026-09-24T17:14:00+08:00', identity_display: display({ face_verified: false }) },
    { id: 4, full_name: 'Ana Cruz', created_at: '', identity_display: display({}) },
  ];
  expect(filterIdentityRecords(records, ' ANA ', 'Failed', 'Pending').map(r => r.id)).toEqual([3, 1]);
  expect(filterIdentityRecords(records, '', 'all', 'all').map(r => r.id)).toEqual([2, 3, 1, 4]);
  expect(filterIdentityRecords(records, 'missing', 'all', 'all')).toEqual([]);
  expect(records.map(r => r.id)).toEqual([1, 2, 3, 4]);
});
