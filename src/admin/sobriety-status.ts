import type { SafetyLog } from './types';

export const alcoholResults = ['Within Limit', 'Above Limit', 'Not Tested'] as const;
export const overallStatuses = ['Cleared', 'Restricted', 'In Progress', 'Verification Failed', 'Incomplete'] as const;

export function getSobrietyOutcome(log: SafetyLog, threshold: string) {
  const raw = log.brac?.trim();
  const value = raw ? Number(raw) : NaN;
  const brac = Number.isFinite(value) && value >= 0 ? value : null;
  const configured = threshold.trim() ? Number(threshold) : NaN;
  const limit = Number.isFinite(configured) && configured >= 0 ? configured : 0.05;
  const alcoholResult: typeof alcoholResults[number] = brac === null ? 'Not Tested' : brac > limit ? 'Above Limit' : 'Within Limit';
  const status = (log.unlock_status || log.status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  let overallStatus: typeof overallStatuses[number] = 'Incomplete';
  if (alcoholResult === 'Above Limit') {
    overallStatus = 'Restricted';
  } else if (log.face_verified === false || ['failed_face', 'verification_failed', 'failed_identity'].includes(status)) {
    overallStatus = 'Verification Failed';
  } else if (['in_progress', 'ongoing', 'started', 'pending', 'testing', 'verifying'].includes(status)) {
    overallStatus = 'In Progress';
  } else if (['passed', 'completed', 'cleared', 'unlocked'].includes(status)
    && alcoholResult === 'Within Limit' && log.helmet_verified !== false) {
    // A low reading alone does not establish completion of the required checks.
    overallStatus = 'Cleared';
  }
  return {
    brac, alcoholResult, overallStatus,
    alcoholColor: alcoholResult === 'Within Limit' ? 'var(--green)' : alcoholResult === 'Above Limit' ? 'var(--red)' : 'var(--muted)',
    overallColor: overallStatus === 'Cleared' ? 'var(--green)' : ['Restricted', 'Verification Failed'].includes(overallStatus) ? 'var(--red)' : overallStatus === 'In Progress' ? 'var(--yellow)' : 'var(--muted)',
  };
}

export function getSobrietyDetails(log: SafetyLog, overallStatus: string): string | null {
  if (!['Verification Failed', 'Incomplete', 'In Progress'].includes(overallStatus)) return null;
  const text = (value?: string) => typeof value === 'string' ? value.trim() : '';
  if (overallStatus === 'In Progress') {
    return text(log.current_stage) ? 'Current stage: ' + text(log.current_stage) : 'The process is ongoing. No current stage was recorded.';
  }
  const reason = text(log.failure_reason) || text(log.reason);
  if (reason) return reason;
  if (overallStatus === 'Verification Failed') return 'Identity verification failed. No specific failure reason was recorded.';
  const status = (log.unlock_status || log.status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (status === 'failed_helmet' || log.helmet_verified === false) return 'The required helmet check failed. No further reason was recorded.';
  if (['cancelled', 'canceled', 'abandoned'].includes(status)) return 'The process was cancelled or abandoned before completion. No further reason was recorded.';
  if (['timeout', 'timed_out', 'expired'].includes(status)) return 'The process timed out before completion.';
  const reading = text(log.brac) ? Number(log.brac) : NaN;
  if (!Number.isFinite(reading) || reading < 0) return 'A valid alcohol test reading is missing, so the required safety checks cannot be confirmed as complete.';
  if (['failed_brac', 'restricted'].includes(status)) return 'The session was recorded as stopped at the alcohol check. Its BrAC is within the current limit, but no successful completion of all required checks was recorded.';
  if (status === 'completed_with_issues') return 'The session was marked completed with issues rather than successfully cleared. The record does not identify which issue prevented clearance.';
  const stage = text(log.current_stage);
  if (stage) return 'The last recorded stage was ' + stage + '. Completion of the remaining checks was not recorded.';
  return 'The saved status (' + status.replace(/_/g, ' ') + ') does not confirm completion of all required safety checks. The record contains no further failure or stopping-stage details.';
}


