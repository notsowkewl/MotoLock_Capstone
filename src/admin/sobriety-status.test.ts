import { expect, it } from 'vitest';
import { getSobrietyOutcome as outcome, getSobrietyDetails } from './sobriety-status';
import type { SafetyLog } from './types';
const check = (brac: string, status: string, alcoholResult: string, overallStatus: string, limit = '0.05') =>
  expect(outcome({ brac, status } as SafetyLog, limit)).toMatchObject({ alcoholResult, overallStatus });
it('separates alcohol results from safety outcomes', () => {
  check('0', 'passed', 'Within Limit', 'Cleared');
  check('0.02', 'completed', 'Within Limit', 'Cleared');
  check('0.05', 'completed', 'Within Limit', 'Cleared');
  check('0.051', 'completed', 'Above Limit', 'Restricted');
  check('', 'failed_face', 'Not Tested', 'Verification Failed');
  check('', 'in_progress', 'Not Tested', 'In Progress');
  check('0.02', 'testing', 'Within Limit', 'In Progress');
  check('', 'abandoned', 'Not Tested', 'Incomplete');
  check('0.02', 'completed_with_issues', 'Within Limit', 'Incomplete');
  for (const brac of ['', 'invalid', '0.02garbage', '-0.01', 'Infinity', ' ']) {
    check(brac, 'completed', 'Not Tested', 'Incomplete');
  }
  check('0.02', 'completed', 'Above Limit', 'Restricted', '0.01');
  expect(outcome({ brac: '0', status: 'completed', face_verified: false } as SafetyLog, '0.05').overallStatus).toBe('Verification Failed');
  expect(outcome({ brac: '0', status: 'completed', helmet_verified: false } as SafetyLog, '0.05').overallStatus).toBe('Incomplete');
});
it('uses the threshold even for legacy alcohol failure statuses', () => {
  for (const status of ['failed_brac', 'restricted']) {
    check('0.05', status, 'Within Limit', 'Incomplete');
    check('0.05', status, 'Above Limit', 'Restricted', '0.04');
    check('', status, 'Not Tested', 'Incomplete');
  }
});

it('only provides details for statuses needing explanation', () => {
  const log = { status: 'failed_face', reason: 'Face did not match the enrolled rider.' } as SafetyLog;
  expect(getSobrietyDetails(log, 'Verification Failed')).toBe(log.reason);
  expect(getSobrietyDetails(log, 'Cleared')).toBeNull();
  expect(getSobrietyDetails(log, 'Restricted')).toBeNull();
  expect(getSobrietyDetails({ status: 'abandoned' } as SafetyLog, 'Incomplete')).toContain('abandoned');
  expect(getSobrietyDetails({ current_stage: 'Helmet check' } as SafetyLog, 'In Progress')).toBe('Current stage: Helmet check');
  expect(getSobrietyDetails({ status: 'failed_face' } as SafetyLog, 'Verification Failed')).toContain('No specific failure reason');
  expect(getSobrietyDetails({ status: 'incomplete', failure_reason: 'Device disconnected.' } as SafetyLog, 'Incomplete')).toBe('Device disconnected.');
});

it('explains the recorded cause of incomplete sessions', () => {
  const details = (brac: string, status: string) => getSobrietyDetails({ brac, status } as SafetyLog, 'Incomplete');
  expect(details('', 'completed')).toContain('valid alcohol test reading is missing');
  expect(details('invalid', 'completed')).toContain('valid alcohol test reading is missing');
  expect(details('0.05', 'failed_brac')).toContain('stopped at the alcohol check');
  expect(details('0.02', 'completed_with_issues')).toContain('completed with issues');
  expect(details('0.02', 'failed_helmet')).toContain('helmet check failed');
  expect(details('0.02', 'timed_out')).toContain('timed out');
  expect(getSobrietyDetails({ brac: '0', status: 'incomplete', current_stage: 'Helmet check' } as SafetyLog, 'Incomplete')).toContain('last recorded stage was Helmet check');
  check('0', 'ongoing', 'Within Limit', 'In Progress');
});
