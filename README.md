# Sushil Pokharel — Website

A responsive personal website with original home-page content, site policies,
contact and support options, an Android app information page, and account and
beta-access features. Secondary destinations and the double-opt-in newsletter
are organized in the site footer; the home page focuses on the current site
message and a small set of primary actions.

## Features

- Responsive layouts for desktop and mobile
- Home, Terms & Conditions, Privacy Policy, Disclaimer, Contact, Support, and
  Android app pages, plus published community posts at `/posts`
- Dedicated beta request, confirmation, account, and not-found pages
- Public `/status` dashboard with live service checks, consent-based traffic
  aggregates, response time, and an explicit uptime-monitoring status
- Beta participation terms with required applicant acknowledgement
- Accessible navigation, forms, and status messages
- Cookie preferences with optional analytics and advertising disabled until opt-in
- Email drafts prepared for review before sending
- Account-protected support requests with an admin inbox and MCP-managed replies
- Admin-controlled support availability indicator
- Supabase username/password accounts, authenticator-app MFA, and password recovery
- Dedicated `super_admin` role for all administration, guarded by verified TOTP
- Idempotent Super Admin seeder that delegates password hashing to Supabase Auth
- User dashboard for profiles, avatars, notification settings, posts, and
  platform announcements
- MFA-protected admin dashboard for maintenance settings, support, accounts,
  home-page metadata, post moderation, announcements, newsletter campaigns, and
  traffic summaries
- Responsive footer navigation for contact, policies, account, support, beta
  access, app information, and newsletter signup
- Double-opt-in newsletter subscriptions and Resend delivery through Supabase
  Edge Functions

## Tech stack

- React 18
- Vite 6
- Capacitor 8 for Android
- CSS
- Supabase Auth
- Supabase Postgres, Row Level Security, Storage, and Edge Functions

## Getting started

Install the locked dependencies and start the development server:

```bash
npm ci
npm run dev
```

Open `http://localhost:3000` after Vite starts.
If PowerShell blocks `npm.ps1` because of its execution policy, use
`npm.cmd ci` and `npm.cmd run dev` instead.

## Production

Create and preview a production build:

```bash
npm run build
npm run preview
```

The generated site is written to `dist/`. Build output and installed
dependencies are intentionally excluded from version control.

Pushing to `main` builds and deploys the site at `https://sushilpokharel00.com.np/` using
`.github/workflows/deploy-pages.yml`. The workflow also publishes the built
HTML, fallback `404.html`, and assets to the repository root for branch-based
GitHub Pages hosting. The fallback serves the app shell for routes such as
`/terms`, `/privacy`, `/disclaimer`, `/contact`, `/app`, `/status`, `/beta`,
`/account/security`, `/admin/login`, `/user`, and `/posts`, which the client-side router then
renders. `app.html` is the Vite source template; the
root `index.html` and `404.html` are generated deployment output.

The Google AdSense account tag is included in the shared HTML template. Its
loader is requested only after a visitor allows advertising technologies in
Cookie settings; optional analytics is likewise off until allowed. Visitors
can review or change choices from the banner or the persistent Cookie settings
control. The root `ads.txt` entry is copied into the published site. Ad
placement and Google consent messaging should still be configured in the
AdSense account; the site does not include placeholder ad units. The AdSense
publisher ID remains reviewed source-code configuration rather than editable
admin text; arbitrary script injection is not allowed. The custom domain is configured through `CNAME`, DNS, and GitHub
Pages settings, not changed by a runtime dashboard.

Each Pages deployment builds the Android APK, publishes it at
`https://sushilpokharel00.com.np/downloads/Sushil-Pokharel.apk`, and updates
the `android-download` GitHub Release.

The browser uses both `favicon.svg` and `favicon.ico` for the shared portrait
logo. Android launcher icons are generated from the PNG embedded in
`favicon.svg`, with a matching wave treatment, whenever `npm run android:sync`
runs. Website deployments run that sync before building and publishing the
updated APK, so replacing the favicon updates the web identity and next APK
automatically.

## Android

The project is packaged as an Android app with Capacitor. The Android app loads
the bundled local web assets directly from the APK, ensuring instant offline
startup, zero-latency transitions between sections, and complete offline access
to the Terms & Conditions. When connected to the internet, live updates and
Supabase features (authentication, support tickets, dynamic status) sync
automatically. External links open in the system browser and email drafts trigger
the device's email client. The APK build workflow produces a standalone APK. The
package ID is `com.sushilpokharel.terms`; choose the final ID before creating a
Play Console listing because it cannot be changed for that listing later.

Install Android Studio with JDK 21 and Android SDK platform 36, then build and
sync the website into the native project:

```bash
npm ci
npm run android:sync
```

Open the generated `android/` project in Android Studio to run it on an emulator
or connected device. On Windows, a debug APK can also be built with:

```powershell
cd android
.\gradlew.bat assembleDebug
```

The APK is written to
`android/app/build/outputs/apk/debug/app-debug.apk`. The
`.github/workflows/android-apk.yml` workflow builds this debug APK on pushes to
`main` and uploads it as a downloadable Actions artifact.

Google Play requires a signed Android App Bundle, not a debug APK. Before
publishing, create and safely back up an upload key, build a signed release
bundle, provide a public privacy-policy URL, complete the Play Console Data
safety and content declarations, and prepare the store listing and screenshots.
Never commit the signing key or its passwords. Review Play's app-quality and
minimum-functionality requirements for web-content apps before submitting.

## GitHub Pages MCP diagnostics

The repository includes a local stdio MCP server. In addition to the read-only
`check_github_pages_routes` tool, it checks Supabase storage, reads and updates
the public website-status row, and can grant the `super_admin` role to an
already confirmed account with verified TOTP MFA. Supabase is persistent storage; the
MCP server is a trusted local management interface, not a hosted database.

The route checker tests the site root, Terms, beta, account and admin URLs, plus
a probe path that should render the app's not-found page. It only requests
HTTPS GitHub Pages sites or the official `sushilpokharel00.com.np` domain.
The live website status dashboard is available at `/status`; beta requests use
the dedicated `/beta` route.

Copy `.env.example` to `.env` and fill in the public Supabase project URL and
anon/publishable key. Set `SUPABASE_SERVICE_ROLE_KEY` to the local-only
service-role key from the Supabase project API settings to enable MCP settings
updates and admin promotion. Keep `.env` private; it is gitignored. Never use
the service-role key as a `VITE_` variable or GitHub Actions secret. The MCP
server loads `.env` from the repository root when it starts; restart the MCP
server after changing it. The service-role key bypasses website RLS, so only
use this stdio MCP server from a trusted local editor.

Run the server with `npm run mcp`, or start it from `.vscode/mcp.json`.
The MCP server exposes these tools:

- `check_supabase_storage` — verify local storage configuration and the
  `site_settings` row/migration.
- `get_site_settings` — read current public website-status settings.
- `update_site_settings` — update the status, heading, and message using the
  local service-role key.
- `list_support_requests` — read the latest 100 customer support requests.
- `reply_to_support_request` — send a response to a request; it appears in the
  requester’s signed-in support inbox.
- `grant_site_admin` — promote a confirmed account only after it has verified
  TOTP MFA and the caller repeats its email for confirmation.
- `check_github_pages_routes` — check the deployed website routes.

Example input for `check_github_pages_routes`:

```json
{
  "siteUrl": "https://sushilpokharel00.com.np/",
  "routes": ["terms", "beta"]
}
```

Run its tests with `npm test`.

## Account authentication

The `/account` page supports username-and-email registration,
username/password sign-in, email-based password recovery, and TOTP
authenticator enrollment, verification, and removal. Dashboard routes redirect
signed-out visitors to sign-in, then route trusted admin accounts to `/admin`
and standard accounts to `/user`. The administrator login is at
`/admin/login`; it accepts only a dedicated account granted the trusted
Supabase `app_metadata.role = super_admin` claim and requires verified TOTP
MFA. All privileged UI routes, backend actions, and RLS policies require this
role and a verified MFA session. Credentials and password verification remain
in Supabase Auth; the website never stores passwords or hard-codes
administrator credentials.

After applying migrations, seed the initial Super Admin from a trusted local
environment. The email defaults to `admin@sushilpokharel00.com.np`; set
`SUPER_ADMIN_EMAIL` to an address you control before running the seeder. Create
a unique password of at least 16 characters, and supply it through the
`SUPER_ADMIN_PASSWORD` environment variable—not source code, a committed file,
or a GitHub Actions variable. Supabase Auth hashes passwords before storing
them; the seeder never handles or writes password hashes itself.

```powershell
$env:SUPER_ADMIN_EMAIL = "admin@sushilpokharel00.com.np"
$securePassword = Read-Host "New Super Admin password" -AsSecureString
$env:SUPER_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $securePassword).Password
npm run seed:super-admin
Remove-Item Env:SUPER_ADMIN_PASSWORD
```

Provide `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only in this trusted
local process. The script creates the confirmed account if absent, or assigns
the role to the confirmed account if it exists. Re-running it does not change
an existing password. New Super Admins must enroll and verify TOTP before
opening `/admin`. The deployment workflow intentionally does not receive a
service-role key or seed password; do not grant broad database credentials to
the static-site deployment job.

Username sign-in uses the `sign-in-with-username` Edge Function to resolve a
username to its private Auth email and then delegates password verification to
Supabase Auth. The email mapping is not exposed to browser clients, and
unknown usernames and incorrect passwords receive the same authentication
response. Existing accounts receive a username based on their email's local
part when possible; email sign-in remains available for accounts that need to
recover or change their username.

Create a Supabase project, enable email/password authentication, and set the
email-confirmation and password policies in the Supabase dashboard. The deploy
workflow is configured with this project's public URL and publishable key as
fallback values; optional `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` repository secrets override those defaults.
The client also accepts the older `VITE_SUPABASE_ANON_KEY` name as a fallback.
These public client configuration
values are embedded in the generated website bundle; never use a Supabase
service-role key in the browser or GitHub Pages.
Allow the account URLs in Supabase Auth URL Configuration:

```text
https://sushilpokharel00.com.np/account
https://www.sushilpokharel00.com.np/account
https://sushilpokharel00.com.np/account/security
https://www.sushilpokharel00.com.np/account/security
http://localhost:3000/account
```

Set the Supabase Auth Site URL to `https://sushilpokharel00.com.np` so recovery
emails do not point at a stopped local server. The app sends sign-up and
password-recovery links to that production origin by default. To test recovery
locally, set `VITE_AUTH_REDIRECT_URL=http://localhost:3000` in `.env` and keep
the local server running until you finish the email flow; add that exact account
URL to Supabase's allowed redirect URLs. Recovery links sent to the app root
are routed to the password form automatically.

For local website development, put the public project values in `.env` as
shown in `.env.example`. The MCP service-role key is read only by the Node MCP
process; Vite does not expose it to the browser because it is not prefixed
with `VITE_`.

The Supabase Edge Functions also allow the local development origin on port
3000. To use the local app with those hosted functions, deploy the updated
function sources:

```bash
supabase functions deploy sign-in-with-username
supabase functions deploy admin-platform
supabase functions deploy record-page-view
supabase functions deploy delete-account
supabase functions deploy newsletter
```

Users can permanently delete their own account from `/account/security` after entering
`DELETE` to confirm. This calls the `delete-account` Supabase Edge Function,
which validates the signed-in user and uses the server-side service-role key
only to delete that same user's account. Related support requests are removed
by the database foreign-key cascade. Deploy it with
`supabase functions deploy delete-account`; configure the function's
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` secrets
in the Supabase project settings. Never put the service-role key in Vite
environment variables or the GitHub Pages build.

Deploy username sign-in separately with
`supabase functions deploy sign-in-with-username`. It uses the same server-side
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` function
secrets. The function is configured for unauthenticated invocation because it
is the login endpoint; it validates input, returns no email mapping, and uses
Supabase Auth's password verification and rate limits. Never expose the
service-role key to the browser.

## Admin dashboard

After setting up Supabase, apply all migrations in `supabase/migrations/` in
timestamp order. With the Supabase CLI installed, link the project and apply
the migrations:

```bash
supabase login
supabase link --project-ref afbyphuozsdsajzngndq
supabase db push
```

Alternatively, run each migration SQL file in order in the Supabase SQL
Editor. This includes the site settings and support tables, then
`20261101003814_user_platform_and_content.sql` for profiles, posts,
announcements, newsletter data, analytics, storage, triggers, and RLS, followed
by `20261101010920_username_authentication.sql` for unique usernames and
username-based authentication.
Do not expose database service-role credentials to the browser.

The `/` route reads its maintenance heading and message from `site_settings`.
The `/status` route checks that public configuration, reports its live response
time, and reads aggregate analytics through the `public-status` Edge Function.
Traffic data includes only visitors who opted in to analytics and is counted
per visitor, page, and UTC day. Active-user tracking is not enabled. Since no
independent uptime monitor is configured, the page reports uptime history as
unavailable rather than estimating a percentage.
`/user` and `/dashboard` require a signed-in non-Super-Admin user. `/admin` is
restricted to Super Admins with a verified TOTP MFA session. Neither
dashboard is linked as a public page, and the router checks the session and
role before rendering dashboard content.

There is intentionally no hard-coded administrator password. Use the secure
Super Admin seeder described above for the initial account, or create and
confirm a dedicated account at `/account`, enable and verify an authenticator,
then call the MCP `grant_site_admin` tool with that exact email in both input
fields. The tool verifies the account is email-confirmed and has verified TOTP
before assigning the trusted `super_admin` app_metadata role. Sign out and
back in after promotion so Supabase issues a fresh token, then open `/admin`.

Row-level security and privileged endpoints allow only a `super_admin` role in
Supabase-managed `app_metadata` with an `aal2` (MFA-verified) session to perform
administrative actions. The site never contains a service-role key. Do not
grant the role through user-editable `user_metadata`.

Signed-in users can submit private support requests at `/support` and view
administrator replies there. MFA-verified Super Admins can answer requests
from `/admin`; the admin MCP tools can also list requests and save replies from
a trusted local server.
The online/offline indicator is a manually managed availability status, not
real-time presence.
Apply the support-request migration before using `/support` or the admin inbox.
The inbox and replies use the local MCP server; they do not send email.

## Platform setup

### Authentication, SMTP, and password policy

In Supabase Authentication settings:

1. Enable email/password sign-in and require email confirmation.
2. Set the server-side password requirements to at least 8 characters,
   including lowercase, uppercase, numeric, and special characters. The signup,
   reset, and password-change forms enforce the same checks in the browser;
   Supabase remains the authoritative enforcement point.
3. Configure a trusted custom SMTP provider and review the confirmation,
   password recovery, email-change, and password-change notification templates.
   The site delegates those messages to Supabase Auth; SMTP passwords and
   provider API keys are never placed in the frontend.
   In Authentication → Email Templates, use
   `supabase/templates/password-recovery.html` for the reset-password email and
   `supabase/templates/password-changed-notification.html` for the password
   changed security notification. Enable the project-level password-changed
   security notification so Supabase sends the alert after a successful
   password change.
4. Add the website's account URL to Authentication URL Configuration, and
   ensure the confirmation/recovery redirect URLs use the official custom
   domain. For local testing, add the local Vite account URL as well.

The account page supports registration, sign-in/out, email verification,
password reset/change, and authenticator enrollment and challenge. Supabase
Auth sends password-related email notifications according to the project's
configured templates and security settings.

### Newsletter and analytics Edge Functions

The newsletter uses Resend for double-opt-in confirmation messages and admin
campaigns. Verify the sender domain with Resend first. Set these **Edge
Function secrets** in the Supabase project (never in Vite, `.env`, or a
committed file):

```bash
supabase secrets set RESEND_API_KEY="your-resend-api-key" NEWSLETTER_FROM_EMAIL="Website <updates@your-verified-domain.example>" NEWSLETTER_TOKEN_SECRET="use-a-random-secret-of-at-least-32-bytes" ANALYTICS_HASH_SECRET="use-a-different-random-secret-of-at-least-32-bytes"
```

Supabase provides the function runtime's project URL and server credentials.
Deploy the functions after applying the platform migration:

```bash
supabase functions deploy newsletter
supabase functions deploy admin-platform
supabase functions deploy record-page-view
supabase functions deploy public-status
```

`newsletter` stores confirmation-token hashes and sends confirmation links
that expire after 24 hours. Admin campaigns contain unsubscribe links.
`record-page-view` stores a daily keyed hash and page path, not the raw visitor
IP; the dashboard's visitor and recent-sign-in counts are estimates, not
audited analytics. `public-status` exposes only aggregate counts from the
consent-based page-view records; it does not expose visitor hashes or page-level
records. No uptime-monitoring provider is connected, so the public status page
reports uptime as unconfigured. Configure a dedicated monitoring service if
uptime history or alerting is required. Review the Privacy Policy before
enabling analytics and advertising in production.

### Local environment and secrets

Copy `.env.example` to `.env` for local browser development and the trusted MCP
server. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are
browser-safe; all `VITE_` values are included in the public site bundle. The
non-`VITE_` service-role key is for local MCP administration only. Do not put
Resend or analytics signing secrets in `.env`, GitHub Actions, or the frontend.
Use Supabase Edge Function secrets for those values.

### GitHub publishing

The website's configured remote and Pages workflow deploy from `main`. Review
the worktree, commit the intended changes, and push:

```bash
git status
git add .
git commit -m "Update website platform"
git push origin main
```

The Actions workflow builds and publishes the website and Android APK. Check
the Actions run and the custom-domain pages after deployment. Never commit
`.env`, service-role keys, SMTP credentials, Resend keys, app-signing keys, or
generated credentials.

## Project structure

```text
src/
  AdminPage.jsx Admin-only settings, moderation, user, and newsletter panel
  AdminPlatformPanel.jsx Admin metrics, accounts, posts, announcements, campaigns
  AuthPage.jsx  Account, sign-in, signup, MFA, and password flows
  UserDashboard.jsx Profile, post, announcement, and preference management
  InfoPages.jsx Public legal, app, newsletter, posts, and landing pages
  StatusPage.jsx Live health checks, consent-based traffic, and uptime status
  SupportPage.jsx Signed-in support requests and replies
  App.jsx       Page content and interactions
  lib/
    supabase.js Supabase Auth client
  main.jsx      React entry point
  site-path.js  GitHub Pages-aware route helper
  styles.css    Responsive styles
mcp-server/
  index.js          MCP stdio server
  index.test.js     MCP startup test
  admin-users.js    Confirmed-MFA admin promotion
  admin-users.test.js
  site-settings.js  Supabase status read/update operations
  site-settings.test.js
  support-inbox.js  Supabase support request and reply operations
  support-inbox.test.js
  load-env.js       Loads ignored local .env for MCP only
  pages-checker.js  GitHub Pages route diagnostics
  pages-checker.test.js
supabase/
  functions/       Account, newsletter, status, and analytics endpoints
  migrations/      Status, support, and user-platform schema/RLS
app.html        Vite HTML source template
vite.config.js  Vite configuration for the GitHub Pages project path
index.html      Generated GitHub Pages entry point
404.html        Generated GitHub Pages SPA fallback
```

Run the frontend tests and production build with `npm test` and `npm run build`.
The platform and Super Admin migrations and Edge Functions must still be
deployed to the Supabase project; building the frontend does not apply or
deploy them. Apply the Super Admin migration before seeding or using the
administrator panel. The legacy `admin` role no longer grants administrator
access.

The Terms & Conditions content is general information, not legal advice.
Review it with a qualified legal professional before relying on it.
