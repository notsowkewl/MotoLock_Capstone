import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('index.html', 'utf8');
const motorcycleMigration = readFileSync('supabase/migrations/20260930060000_add_ride_history_motorcycle_link.sql', 'utf8');
const authEmailMigration = readFileSync('supabase/migrations/20260930070000_sync_verified_auth_email.sql', 'utf8');
const pinSqlTest = readFileSync('documents/test-rider-pin-rls.sql', 'utf8');
const emailOwnershipTest = readFileSync('documents/test-rider-auth-email-ownership.sql', 'utf8');

describe('rider functional security contracts', () => {
  it('signs up through Supabase Auth, requires verification, and handles duplicate Auth responses in place', () => {
    expect(app).toContain("supabaseClient.auth.signUp({");
    expect(app).toContain("data: { full_name: fullName }");
    expect(app).toContain("type: 'signup', email: verificationEmail");
    expect(app).toContain('This email is already registered. Please log in or use a different email.');
    expect(app).toContain("Array.isArray(data.user.identities) && data.user.identities.length === 0");
    expect(app).toContain("localStorage.setItem('motolock_pending_verification_email', email)");
    expect(app).toContain("id=\"verification-email-address\"");
    expect(app).toContain("!data.user.email_confirmed_at && !data.user.confirmed_at");
    expect(app).not.toContain(".eq('email', email)");
  });

  it('validates signup fields inline before Auth and enforces configured password requirements', () => {
    expect(app).toContain('function getSignupFieldError(id)');
    expect(app).toContain('Name is required.');
    expect(app).toContain('Please enter a valid email address.');
    expect(app).toContain('Password must contain at least 8 characters.');
    expect(app).toContain('Password must contain at least one special character.');
    expect(app).toContain('Passwords do not match.');
    expect(app).toContain('input.setAttribute(\'aria-invalid\', message ? \'true\' : \'false\')');
    expect(app).toContain('document.getElementById(invalidIds[0])?.focus()');
  });

  it('verifies reset codes, handles Auth recovery links, and updates only through Supabase Auth', () => {
    expect(app).toContain("type: 'recovery'");
    expect(app).toContain("event === 'PASSWORD_RECOVERY'");
    expect(app).toContain('auth.exchangeCodeForSession(authCode)');
    expect(app).toContain("supabaseClient.auth.updateUser({ password })");
    expect(app).toContain("getAuthRedirectUrl(true)");
    expect(app).toContain("body: { action: 'complete', email: forgotPinEmail, code: recoveryCode, pin: createdPin }");
  });

  it('uses the rider profile UUID and verifies persistence after profile edits', () => {
    expect(app).toContain(".eq('id', authUser.id)");
    expect(app).toContain(".update({ name: fullName, phone })");
    expect(app).toContain("Saved, but could not verify the profile refresh");
    expect(app).toContain('<label>Name</label>');
    expect(authEmailMigration).toContain('sync_verified_auth_email_to_profile');
    expect(authEmailMigration).toContain('NEW.email IS DISTINCT FROM auth_email');
    expect(emailOwnershipTest).toContain('FAIL: rider changed profile email without verifying it through Auth');
  });

  it('keeps Google sign-in in Supabase Auth and ties profiles to the Auth UUID', () => {
    expect(app).toContain("provider: 'google'");
    expect(app).toContain(".eq('id', authUser.id)");
    expect(app).not.toContain(".eq('email', authUser.email)");
  });

  it('uses own-account PIN RPCs, denies direct table writes, and covers create/update', () => {
    expect(app).toContain("supabaseClient.rpc(rpc, args)");
    expect(app).toContain("'set_rider_security_pin'");
    expect(pinSqlTest).toContain('public.set_rider_security_pin');
    expect(pinSqlTest).toContain('public.change_rider_security_pin');
    expect(pinSqlTest).toContain('UPDATE public.user_security_pins');
  });

  it('limits face retries to five and rejects lost, multiple, or changed faces during transition', () => {
    expect(app).toContain('const MAX_ATTEMPTS = 5;');
    expect(app).toContain('const MAX_VERIFICATION_FAILURES = 5;');
    expect(app).toContain('if (lostCount >= 2)');
    expect(app).toContain('Different face detected during transition. Resetting.');
    expect(app).toContain('Rider identity changed during transition. Resetting.');
    expect(app).toContain('registeredFace: isHelmet ? enrolledRiderFace : registeredFace');
  });

  it('reconnects using the Android bond and keeps only a non-secret device-address hint', () => {
    expect(app).toContain("localStorage.getItem('motolockBluetoothAddress')");
    expect(app).toContain("localStorage.setItem('motolockBluetoothAddress', motolockBluetoothAddress)");
    expect(app).toContain('Paired Bluetooth devices:');
  });

  it('records manual override in Supabase once per pending event and displays a dashboard action', () => {
    expect(app).toContain("event_type: 'manual_override'");
    expect(app).toContain('event_id: manualOverridePendingEventId');
    expect(app).toContain("supabaseClient.from('ride_history').insert({");
    expect(app).toContain("onclick=\"returnFromManualOverride()\">Return to Dashboard");
    expect(motorcycleMigration).toContain('m.user_id = (SELECT public.motolock_reader_profile_id())');
  });
});
