import { describe, expect, it, vi } from 'vitest';
import { parsePinRecoveryRequest, processPinRecovery } from '../../supabase/functions/_shared/pin-recovery';

const validRequest = { action: 'request', email: '  Rider@Example.com  ' };
const validCompletion = { action: 'complete', email: 'Rider@example.com', code: '123456', pin: '7482' };

function dependencies() {
  return {
    allowAttempt: vi.fn(async () => true),
    sendRecoveryCode: vi.fn(async () => undefined),
    verifyRecoveryCode: vi.fn(async () => 'profile-id'),
    replacePin: vi.fn(async () => undefined),
  };
}

describe('rider PIN recovery', () => {
  it('normalizes a valid recovery request without exposing credentials', () => {
    expect(parsePinRecoveryRequest(validRequest)).toEqual({ action: 'request', email: 'rider@example.com' });
  });

  it.each([
    null,
    { action: 'admin-reset', email: 'rider@example.com' },
    { action: 'request', email: 'not-an-email' },
    { action: 'complete', email: 'rider@example.com', code: '12345', pin: '7482' },
    { action: 'complete', email: 'rider@example.com', code: '123456', pin: '1234' },
  ])('rejects malformed or weak recovery requests', input => {
    expect(parsePinRecoveryRequest(input)).toBeNull();
  });

  it('sends the same generic success response for a valid recovery request', async () => {
    const deps = dependencies();
    const result = await processPinRecovery(validRequest, deps);
    expect(result.status).toBe(200);
    expect(result.body.message).toMatch(/If the account is registered/);
    expect(deps.sendRecoveryCode).toHaveBeenCalledWith('rider@example.com');
  });

  it('completes recovery only after the trusted verifier accepts the code', async () => {
    const deps = dependencies();
    const result = await processPinRecovery(validCompletion, deps);
    expect(result).toEqual({ status: 200, body: { success: 'true' } });
    expect(deps.replacePin).toHaveBeenCalledWith('profile-id', '7482');
  });

  it.each(['invalid', 'expired', 'already used'])('rejects an %s recovery code without changing the PIN', async () => {
    const deps = dependencies();
    deps.verifyRecoveryCode.mockRejectedValue(new Error('OTP is invalid or expired'));
    const result = await processPinRecovery(validCompletion, deps);
    expect(result.status).toBe(400);
    expect(deps.replacePin).not.toHaveBeenCalled();
  });

  it('blocks repeated attempts after the backend rate limit is reached', async () => {
    const deps = dependencies();
    deps.allowAttempt.mockResolvedValue(false);
    const result = await processPinRecovery(validCompletion, deps);
    expect(result.status).toBe(429);
    expect(deps.verifyRecoveryCode).not.toHaveBeenCalled();
    expect(deps.replacePin).not.toHaveBeenCalled();
  });
});
