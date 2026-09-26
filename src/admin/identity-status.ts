export type IdentityVerification = 'Verified' | 'Failed' | 'Bypassed' | 'Not Recorded';

export interface IdentityMetadata {
  verification_method?: unknown;
  failure_reason?: unknown;
  verification_attempts?: unknown;
  attempt_count?: unknown;
  bypass_reason?: unknown;
  bypass_details?: unknown;
  override_reason?: unknown;
  override_details?: unknown;
}

const recordedText = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export function getVerificationMethod(record: IdentityMetadata): string {
  const method = recordedText(record.verification_method).toLowerCase().replace(/[\s/-]+/g, '_');
  if (['face', 'face_recognition', 'facial_recognition'].includes(method)) return 'Face Recognition';
  if (['pin', 'override', 'pin_override'].includes(method)) return 'PIN/Override';
  return 'Not Recorded';
}

export function getIdentityDetails(record: IdentityMetadata, result?: IdentityVerification): string | null {
  const details: string[] = [];
  if (result === 'Failed') {
    const reason = recordedText(record.failure_reason);
    if (reason) details.push('Failure reason: ' + reason);
    const raw = record.verification_attempts ?? record.attempt_count;
    const attempts = typeof raw === 'number' ? raw : recordedText(raw) ? Number(raw) : NaN;
    if (Number.isSafeInteger(attempts) && attempts >= 0) details.push('Number of attempts: ' + attempts);
  } else if (result === 'Bypassed') {
    for (const [label, value] of [
      ['Bypass reason', record.bypass_reason], ['Bypass details', record.bypass_details],
      ['Override reason', record.override_reason], ['Override details', record.override_details],
    ]) {
      const text = recordedText(value);
      if (text) details.push(label + ': ' + text);
    }
  }
  return details.length ? details.join('\n') : null;
}

export function filterIdentityRecords<T extends {
  full_name: string; created_at: string;
  identity_display?: { verification: IdentityVerification; lockAction: IdentityLockAction };
}>(records: T[], search: string, result: string, action: string): T[] {
  const query = search.trim().toLocaleLowerCase();
  const time = (value: string) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : -Infinity;
  return records.filter(record => record.full_name.toLocaleLowerCase().includes(query)
    && (result === 'all' || record.identity_display?.verification === result)
    && (action === 'all' || record.identity_display?.lockAction === action))
    .sort((a, b) => time(b.created_at) - time(a.created_at));
}
export type IdentityLockAction = 'Locked' | 'Unlocked' | 'Pending' | 'Awaiting Alcohol Test';

export function getIdentityLockAction(
  identity: { verification: IdentityVerification; lockAction: IdentityLockAction },
  alcoholResult: 'Within Limit' | 'Above Limit' | 'Not Tested',
): IdentityLockAction {
  if (identity.verification === 'Failed') return 'Locked';
  if (identity.verification === 'Verified') {
    if (alcoholResult === 'Not Tested') return 'Awaiting Alcohol Test';
    return alcoholResult === 'Within Limit' ? 'Unlocked' : 'Locked';
  }
  return identity.lockAction;
}

export function formatVerificationTime(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString('en-US', {
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export function getIdentityDisplay(record: {
  status?: unknown; face_verified?: unknown; unlock_status?: unknown; is_locked?: unknown;
}) {
  const normalize = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase().replace(/[\s-]+/g, '_') : '';
  const status = normalize(record.status);
  const action = normalize(record.unlock_status);
  let verification: IdentityVerification = 'Not Recorded';
  // Explicit failures and bypasses take precedence over legacy boolean defaults.
  if (['failed_face', 'failed_identity', 'verification_failed'].includes(status)) verification = 'Failed';
  else if (['verification_bypassed', 'face_bypassed', 'bypassed'].includes(status)) verification = 'Bypassed';
  else if (record.face_verified === true || record.face_verified === 1) verification = 'Verified';
  else if (record.face_verified === false || record.face_verified === 0) verification = 'Failed';
  // Supabase sample-data review defines passed as a completed pre-ride check.
  else if (['passed', 'completed'].includes(status)) verification = 'Verified';

  let lockAction: IdentityLockAction = 'Pending';
  // Only recorded hardware outcomes establish unlock; session completion does not.
  if (record.is_locked === true || record.is_locked === 1) lockAction = 'Locked';
  else if (record.is_locked === false || record.is_locked === 0) lockAction = 'Unlocked';
  else if (['locked', 'motor_still_locked'].includes(action)) lockAction = 'Locked';
  else if (['unlocked', 'ok_unlocked', 'ignition_access_granted'].includes(action)) lockAction = 'Unlocked';
  // Supabase failed_* sessions represent blocked attempts, not travel.
  else if (['failed_face', 'failed_brac', 'failed_helmet', 'locked'].includes(status)) lockAction = 'Locked';
  else if (status === 'unlocked') lockAction = 'Unlocked';
  return { verification, lockAction };
}
