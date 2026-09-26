# Google sign-in

The login button uses Supabase Google OAuth with PKCE. MainActivity exchanges the
callback code for a session; LoginScreen observes authenticated sessions before
navigating to the dashboard. Email/password login uses the same session observer.

## Provider configuration

1. In Google Cloud, configure the OAuth consent screen and create a Web application
   OAuth client. Add this authorized redirect URI:
   `https://bafziqymbvhrytziteuo.supabase.co/auth/v1/callback`.
2. In the matching Supabase project, enable Authentication > Providers > Google and
   enter that client's ID and secret. Never put the client secret in the Android app.
3. In Authentication > URL Configuration > Redirect URLs, add
   `com.example.motolock://auth-callback`.
4. If Google's consent screen is in testing mode, add the accounts used for testing.

Reference: https://supabase.com/docs/guides/auth/social-login/auth-google
Deep links: https://supabase.com/docs/reference/kotlin/v2/initializing

## Device verification

- Tap Continue with Google, select an account, and confirm return to the dashboard.
- Cancel Google consent, then retry; login must remain available.
- Test a cold start callback and a callback with the app already running.
- Verify email/password login and logout still work.
- Restart after signing in and confirm the session is restored.

Provider configuration and a real Google account are required for end-to-end testing.
