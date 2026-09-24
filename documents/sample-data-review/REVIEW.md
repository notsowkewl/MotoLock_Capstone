# Supabase sample data for approval

Prepared against the table definitions and enum values you supplied. Nothing has been inserted or changed in Supabase or the application. All events are synthetic; they are not evidence of the named riders' actions. Names were supplied by you, and all remaining details are invented.

## Rider and motorcycle preview

| Rider | Motorcycle | Year / color | Plate example |
| --- | --- | --- | --- |
| Joe Seth Basilio | Honda Click 125i | 2024 / Black | NCA 4821 |
| Nathaniel Baculi | Yamaha Mio i 125 | 2023 / Blue | DAB 7316 |
| Rose Marie Roxas | Honda BeAT | 2024 / White | GHT 2058 |
| Jenna Diaz | Yamaha Mio Gear | 2025 / Red | KLM 6943 |
| Jefferson Atractibo | Suzuki Raider R150 | 2023 / Black | MNP 8172 |
| Jeric Rotoni | Honda ADV160 | 2025 / Gray | RBC 3509 |
| Alexis Olaybal | Yamaha NMAX | 2024 / Silver | VXZ 1264 |

Emails use each full name, lowercase and dot-separated, at example.com. All profiles are active riders. Each rider has one motorcycle, one device and two fictional contacts (one primary). Contact phone numbers are fictional Philippine-style examples and are not verified or intended for contact. MAC addresses are unique locally administered sample addresses, not actual hardware identifiers.

## Exact counts

| Table | Rows |
| --- | ---: |
| `users` | 7 |
| `motorcycles` | 7 |
| `devices` | 7 |
| `emergency_contacts` | 14 |
| `ride_history` | 70 |
| `audit_logs` | 120 |

There are 70 history records: **42 completed, 7 passed, 7 ongoing, 7 failed_brac, 7 failed_face**. Each rider has 6 completed trips and one of each other status. `passed` represents a completed pre-ride check with no trip completion recorded. `failed_*` represents a blocked attempt, not travel. `ongoing` represents a simulated active session at the snapshot time.

Registrations: August 11–17, 2026. Completed trips: September 1, 4, 7, 10, 13 and 16. Blocked BrAC attempts: September 17. Blocked face checks: September 18. Passed checks: September 22. Ongoing sessions: September 23. All timestamps use +08:00 (Asia/Manila), with snapshot time September 23 at 18:00. This is fixed historical data; it does not advance with the clock.

Devices: 5 online, 1 offline, 1 maintenance. Ongoing rows for the offline/maintenance devices use `device_id = NULL`, representing unavailable telemetry. Earlier historical rows retain their device links. GPS points are invented Metro Manila-area coordinates, not actual routes or personal addresses. Only completed trips have end times, final readings and endpoint coordinates.

BrAC examples: 0.000, 0.010, 0.020, 0.049, 0.050, 0.080. These exercise the existing UI threshold of 0.05; physical units and calibration are not established. The samples do not claim a medical or legal threshold.

## Audit history

`audit_logs.action_details` holds explicitly labeled synthetic event details, using the actual jsonb column rather than invented incident/override tables:

- 7 profile registrations and 70 ride/check status events.
- 7 stationary overrides after simulated checks passed, linked to September 13 completed trips.
- 14 incident openings (7 BrAC, 7 face) and 8 resolutions; 6 remain open. Resolution does not authorize a ride.
- 14 simulated login events: 7 failed and 7 successful. No real authentication or messaging is performed.

`user_id` identifies the subject rider. The fictional administrator label in override details is not an actual administrator account. Every audit detail includes `synthetic: true` and the dataset label.

## Schema compatibility and Auth

All IDs and references are UUIDs. Rides use `initial_brac_level` / `final_brac_level` and `gps_start_*` / `gps_end_*`. Every status is from your supplied enums. User descriptors remain NULL; no fabricated biometrics. The users' `password_hash` marker matches the existing account-creation code (`supabase-auth-managed`), but does not create a Supabase Auth account or enable rider login.

Your supplied users definition has no Auth foreign key. These fixtures are public reporting profiles only. If you later want real app logins, provision test Auth accounts and coordinate their IDs with these profiles before seeding. No writes to `auth.users`, `pins` or `system_settings` are included. PIN hashing is not established by the Supabase code, and existing settings should not be replaced just to test reports.

Triggers and row-level-security policies were not supplied or checked. Review any existing database triggers before running SQL, especially any that create extra records or initiate external effects.

## Files and execution behavior

- `sample-data.json`: full review data, metadata and expected counts; actual table rows are under `tables`.
- `seed-review.sql`: transaction containing explicit INSERTs in dependency order. It commits if manually executed successfully; it has NOT been executed. No upserts: duplicate IDs/emails/plates/MACs stop the transaction instead of modifying existing data. If an execution fails, roll back the failed transaction.
- `remove-sample-review.sql`: transaction deleting only this batch's UUIDs in reverse dependency order. It refuses if additional known-table rows reference these sample users/devices or PINs have been added. Unknown dependencies/triggers can still block or affect cleanup. Review before execution; do not use it after repurposing the sample accounts.

## Admin changes still needed to test reports correctly

The data follows your actual schema. Existing code does not fully follow it:

1. Supabase exports read `brac_level`, which does not exist in your ride_history definition, and currently fall back to zero. They must read `initial_brac_level` and optionally `final_brac_level`.
2. The app's Supabase ride inserts also use `brac_level`, `gps_lat`, `gps_lng` and omit required `initial_brac_level`. They need matching field mappings.
3. Safety previews read override-only local backend logs, while exports read Supabase rides without the selected filters. Inserting this dataset alone does not align them.
4. Devices and audit screens still use local backend routes. They need Supabase reads and mappings for UUIDs, device motorcycle/user relationships, `action_type` and `action_details`.
5. Dashboard 'today' counts all history, overrides is hardcoded zero, and all users are counted as riders. With this dataset alone it would show 70 today instead of 7 September 23 rows.
6. The admin's TypeScript interfaces still use numeric IDs for several entities. Supabase motorcycle/device/ride/audit IDs are UUID strings.

These application fixes are separate from the review dataset and have not been made.

## Expected report checks after query fixes

- Entire dataset: 70 history rows, 42 completed trips, 14 blocked attempts, 7 passed checks and 7 ongoing sessions.
- Each rider: 10 history rows with the same 6/1/1/1/1 status breakdown.
- September 17: exactly 7 failed_brac rows; September 18: exactly 7 failed_face rows.
- September 23: exactly 7 ongoing rows, including 2 with no device telemetry.
- Audit-derived overrides: 7. Incidents: 14 opened, 8 resolved, 6 still open.
- PDF/Excel should match the selected report and date/status filters after those queries are fixed.

Validation performed locally: exact field sets, UUID validity, referenced user/device/motorcycle IDs, enum membership, unique identifiers/emails/plates/MACs/contact pairs, primary contact counts, nonnegative readings, chronological completed trips and expected status totals. No live database execution was performed.
