describe('MotoLock rider critical flows', () => {
  beforeEach(() => {
    cy.intercept('https://**', { statusCode: 200, body: '' });
    cy.intercept('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', {
      statusCode: 200,
      body: `
        const calls = { signUp: [], signIn: [], resend: [], rpc: [], rideWrites: [], userWrites: [], updateUser: [], profile: null, emailChange: null };
        const authUser = { id: 'rider-auth-id', email: 'rider@example.test', email_confirmed_at: '2026-01-01T00:00:00Z', user_metadata: { full_name: 'Test Rider' } };
        const profile = { id: 'rider-auth-id', name: 'Test Rider', email: authUser.email, phone: '09171234567', role: 'rider', status: 'active' };
        function query(table) {
          let action = 'select'; let payload = null;
          const q = {
            select() { return q; }, eq() { return q; }, order() { return q; }, limit() { return q; },
            update(value) { action = 'update'; payload = value; return q; },
            insert(value) { action = 'insert'; payload = value; if (table === 'ride_history') calls.rideWrites.push(value); if (table === 'users') calls.userWrites.push(value); return q; },
            maybeSingle() { return Promise.resolve({ data: table === 'users' ? profile : table === 'devices' ? { id: 'device-id' } : null, error: null }); },
            single() {
              if (table === 'users' && action === 'update') Object.assign(profile, payload);
              if (table === 'users') return Promise.resolve({ data: profile, error: null });
              if (table === 'ride_history') return Promise.resolve({ data: { id: 'ride-event', ...payload }, error: null });
              if (table === 'devices') return Promise.resolve({ data: { id: 'device-id' }, error: null });
              return Promise.resolve({ data: payload, error: null });
            },
            then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject); },
          };
          return q;
        }
        window.__supabaseMock = calls;
        calls.profile = profile;
        window.supabase = { createClient: () => ({
          auth: {
            onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
            async signUp(payload) {
              calls.signUp.push(payload);
              if (calls.duplicateSignUp) return { data: { user: { id: 'hidden', identities: [] }, session: null }, error: null };
              return { data: { user: { id: 'new-rider', identities: [{ provider: 'email' }] }, session: null }, error: null };
            },
            async signInWithPassword(credentials) {
              calls.signIn.push(credentials);
              if (calls.unverifiedLogin) return { data: { user: null }, error: { message: 'Email not confirmed' } };
              return { data: { user: authUser, session: { access_token: 'test' } }, error: null };
            },
            async resend(payload) { calls.resend.push(payload); return { error: null }; },
            async getUser() { return { data: { user: authUser }, error: null }; },
            async signOut() { return { error: null }; },
            async resetPasswordForEmail(email, options) { calls.reset = { email, options }; return { error: null }; },
            async verifyOtp(input) { calls.otp = input; return { data: { user: authUser, session: { access_token: 'recovery' } }, error: null }; },
            async updateUser(input) { calls.updateUser.push(input); calls.emailChange = input; return { data: { user: authUser }, error: null }; },
            async signInWithOAuth(input) { calls.oauth = input; return { data: { url: 'https://accounts.google.test' }, error: null }; },
          },
          rpc: async (name, args) => { calls.rpc.push({ name, args }); return { data: name === 'motolock_reader_profile_id' ? 'rider-auth-id' : name === 'has_rider_security_pin', error: null }; },
          from: query,
          functions: { invoke: async (name, options) => ({ data: { message: 'If the account is registered, a recovery code has been sent.' }, error: null }) },
        }) };
      `
    });
    cy.visit('/');
  });

  it('opens rider sign-in and rejects missing credentials locally', () => {
    cy.get('#login').should('be.visible');
    cy.window().then((window) => cy.stub(window, 'alert').as('browserAlert'));
    cy.get('#login button.btn').contains('Login').click();
    cy.get('@browserAlert').should('have.been.calledOnceWith', 'Please enter your email and password.');
    cy.window().its('__supabaseMock.signIn').should('have.length', 0);
  });

  it('registers through Auth and routes to email verification', () => {
    cy.get('#login button').contains('Create Account').click();
    cy.get('#create-fullname').type('Test Rider');
    cy.get('#create-email').type('new@example.test');
    cy.get('#create-phone').type('09171234567');
    cy.get('#create-password').type('MotoLock!123');
    cy.get('#create-confirm-password').type('MotoLock!123');
    cy.get('#terms-check').check();
    cy.get('#privacy-check').check();
    cy.get('#createAccount button.btn').contains('Create Account').click();
    cy.get('#verifyEmail').should('have.class', 'active');
    cy.get('#verification-email-address').should('contain', 'new@example.test');
    cy.window().its('__supabaseMock.signUp').should('have.length', 1);
    cy.window().its('__supabaseMock.signUp.0.options.data.full_name').should('eq', 'Test Rider');
  });

  it('rejects an existing email from the Auth response without creating a duplicate profile', () => {
    cy.window().then(window => { window.__supabaseMock.duplicateSignUp = true; });
    cy.get('#login button').contains('Create Account').click();
    cy.get('#create-fullname').type('Test Rider');
    cy.get('#create-email').type('used@example.test');
    cy.get('#create-phone').type('09171234567');
    cy.get('#create-password').type('MotoLock!123');
    cy.get('#create-confirm-password').type('MotoLock!123');
    cy.get('#terms-check').check();
    cy.get('#privacy-check').check();
    cy.get('#createAccount button.btn').contains('Create Account').click();
    cy.get('#create-email-error').should('contain', 'This email is already registered. Please log in or use a different email.');
    cy.get('#create-email').should('have.attr', 'aria-invalid', 'true');
    cy.window().its('__supabaseMock.userWrites').should('have.length', 0);
    cy.window().its('__supabaseMock.signUp').should('have.length', 1);
    cy.get('#createAccount').should('have.class', 'active');
    cy.get('#verifyEmail').should('not.have.class', 'active');
  });

  it('validates signup fields inline before submitting to Supabase', () => {
    cy.get('#login button').contains('Create Account').click();
    cy.get('#createAccount button.btn').contains('Create Account').click();
    cy.get('#create-fullname-error').should('contain', 'Name is required.');
    cy.get('#create-email-error').should('contain', 'Email is required.');
    cy.get('#create-phone-error').should('contain', 'Phone number is required.');
    cy.get('#create-password-error').should('contain', 'Password is required.');
    cy.get('#create-confirm-password-error').should('contain', 'Please confirm your password.');
    cy.get('#create-email').type('not-an-email');
    cy.get('#create-email-error').should('contain', 'Please enter a valid email address.');
    cy.get('#create-password').type('weak');
    cy.get('#create-password-error').should('contain', 'Password must contain at least 8 characters.');
    cy.get('#create-password').clear().type('LongPassword1');
    cy.get('#create-password-error').should('contain', 'Password must contain at least one special character.');
    cy.get('#create-confirm-password').type('NotTheSame!123');
    cy.get('#create-confirm-password-error').should('contain', 'Passwords do not match.');
    cy.get('#create-confirm-password').clear().type('LongPassword1');
    cy.get('#create-confirm-password-error').should('not.contain', 'Passwords do not match.');
    cy.window().its('__supabaseMock.signUp').should('have.length', 0);
  });

  it('resends verification and never enters the rider app for an unverified password login', () => {
    cy.window().then(window => { window.__supabaseMock.unverifiedLogin = true; });
    cy.get('#login-email').type('unverified@example.test');
    cy.get('#login-password').type('MotoLock!123');
    cy.get('#login button.btn').contains('Login').click();
    cy.get('#verifyEmail').should('have.class', 'active');
    cy.window().its('__supabaseMock.resend').should('have.length', 1);
    cy.get('#dashboard').should('not.have.class', 'active');
  });

  it('persists name and phone through the authenticated profile UUID and refreshes UI from returned data', () => {
    cy.window().then(window => {
      window.go('riderProfile');
      window.document.getElementById('profile-name').value = 'Updated Rider';
      window.document.getElementById('profile-phone').value = '09170000000';
      return window.saveRiderProfile();
    });
    cy.window().its('__supabaseMock.profile').should('deep.include', { name: 'Updated Rider', phone: '09170000000' });
    cy.window().its('localStorage').invoke('getItem', 'user').should('contain', 'Updated Rider');
  });

  it('starts a Google OAuth request without using a profile email as identity', () => {
    cy.get('#login .google-btn').click();
    cy.window().its('__supabaseMock.oauth.provider').should('eq', 'google');
    cy.window().its('__supabaseMock.signIn').should('have.length', 0);
  });

  it('sends a generic recovery email, verifies the code, and changes the password in-app', () => {
    cy.get('#login .forgot').click();
    cy.get('#forgot-email').type('rider@example.test');
    cy.get('#m-forgot button').contains('Send Reset Code').click();
    cy.get('#m-app-message button').click();
    cy.get('#verifyResetCode').should('have.class', 'active');
    cy.get('#reset-code').type('123456');
    cy.get('#verifyResetCode button').contains('Verify Code').click();
    cy.get('#m-app-message button').click();
    cy.get('#forgotResetPassword').should('have.class', 'active');
    cy.get('#new-reset-password').type('MotoLock!456');
    cy.get('#confirm-reset-password').type('MotoLock!456');
    cy.get('#forgotResetPassword button').contains('Update Password').click();
    cy.get('#m-app-message button').click();
    cy.window().its('__supabaseMock.updateUser.0.password').should('eq', 'MotoLock!456');
    cy.get('#login').should('have.class', 'active');
  });

  it('records an ESP32 manual override and shows a clear dashboard return action', () => {
    cy.window().then(window => {
      window.parseMotoLockStatus('STATUS:{"overrideActive":true,"locked":false,"ignitionEnabled":true}');
    });
    cy.get('#manualOverrideResult').should('have.class', 'active');
    cy.get('#manual-override-result-title').should('contain', 'Manual Override Activated');
    cy.get('#manual-override-result-status').should('contain', 'Recorded in Ride History');
    cy.window().its('__supabaseMock.rideWrites').should('have.length', 1);
    cy.window().its('__supabaseMock.rideWrites.0').should('deep.include', { event_type: 'manual_override', user_id: 'rider-auth-id', device_id: 'device-id' });
    cy.window().then(window => {
      window.parseMotoLockStatus('STATUS:{"overrideActive":true,"locked":false,"ignitionEnabled":true}');
    });
    cy.window().its('__supabaseMock.rideWrites').should('have.length', 1);
    cy.get('#manualOverrideResult button').contains('Return to Dashboard').click();
    cy.get('#dashboard').should('have.class', 'active');
  });
});
