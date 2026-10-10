# Sushil Pokharel — Website

A responsive personal website with a maintenance landing page, a beta access
request flow, and a Terms & Conditions page.

## Features

- Responsive layouts for desktop and mobile
- Dedicated maintenance, beta request, confirmation, terms, and not-found pages
- Beta participation terms with required applicant acknowledgement
- Accessible navigation, forms, and status messages
- Email drafts prepared for review before sending
- Account-protected support requests with an admin inbox and MCP-managed replies
- Admin-controlled support availability indicator
- Supabase email/password accounts, authenticator-app MFA, and password recovery
- MFA-protected admin dashboard for the public home-page status and message

## Tech stack

- React 18
- Vite 6
- CSS
- Supabase Auth

## Getting started

Install the locked dependencies and start the development server:

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

## Production

Create and preview a production build:

```bash
npm run build
npm run preview
```

The generated site is written to `dist/`. Build output and installed
dependencies are intentionally excluded from version control.

Pushing to `main` builds and deploys the site using
`.github/workflows/deploy-pages.yml`. The workflow also publishes the built
HTML, fallback `404.html`, and assets to the repository root for branch-based
GitHub Pages hosting. The fallback serves the app shell for routes such as
`/terms`, which the client-side router then renders. `app.html` is the Vite
source template; the root `index.html` and `404.html` are generated deployment
output.

## GitHub Pages MCP diagnostics

The repository includes a local stdio MCP server. In addition to the read-only
`check_github_pages_routes` tool, it checks Supabase storage, reads and updates
the public website-status row, and can grant the admin role to an already
confirmed account with verified TOTP MFA. Supabase is persistent storage; the
MCP server is a trusted local management interface, not a hosted database.

The route checker tests the site root, Terms, beta, account and admin URLs, plus
a probe path that should render the app's not-found page. For safety, it only
requests HTTPS sites hosted on `github.io`.

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
  "siteUrl": "https://sushilpokharel00.github.io/Sushil-Pokharel/",
  "routes": ["terms", "beta"]
}
```

Run its tests with `npm test`.

## Account authentication

The `/account` page supports email/password sign-up and sign-in, email-confirmed
registration, password reset and change, and TOTP authenticator enrollment,
verification, and removal. Supabase verifies a TOTP challenge before a user
with MFA enabled can finish signing in. Authentication is provided by Supabase;
the website does not store account passwords itself.

Create a Supabase project, enable email/password authentication, and set the
email-confirmation and password policies in the Supabase dashboard. The deploy
workflow is configured with this project's public URL and publishable key as
fallback values; optional `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` repository secrets override those defaults.
The client also accepts the older `VITE_SUPABASE_ANON_KEY` name as a fallback.
These public client configuration
values are embedded in the generated website bundle; never use a Supabase
service-role key in the browser or GitHub Pages.
Allow the following redirect URL in Supabase Auth URL Configuration:

```text
https://sushilpokharel00.github.io/Sushil-Pokharel/account
```

For local website development, put the public project values in `.env` as
shown in `.env.example`. The MCP service-role key is read only by the Node MCP
process; Vite does not expose it to the browser because it is not prefixed
with `VITE_`.

Users can permanently delete their own account from `/account` after entering
`DELETE` to confirm. This calls the `delete-account` Supabase Edge Function,
which validates the signed-in user and uses the server-side service-role key
only to delete that same user's account. Related support requests are removed
by the database foreign-key cascade. Deploy it with
`supabase functions deploy delete-account`; configure the function's
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` secrets
in the Supabase project settings. Never put the service-role key in Vite
environment variables or the GitHub Pages build.

## Admin dashboard

After setting up Supabase, apply both
`supabase/migrations/20261008000000_site_settings.sql` and
`supabase/migrations/20261010000000_support_requests.sql` in the Supabase SQL
Editor. The home page reads the public maintenance status, message, and support
availability from the settings table. `/admin` lets an administrator update
these settings and view the latest support requests.

There is intentionally no default admin username or password. Create and
confirm your own account at `/account`, enable and verify an authenticator,
then call the MCP `grant_site_admin` tool with that exact email in both input
fields. The tool verifies the account is email-confirmed and has verified TOTP
before assigning the trusted `app_metadata` role. Sign out and back in after
promotion so Supabase issues a fresh token, then visit `/admin`.

Row-level security allows only an `admin` role in
Supabase-managed `app_metadata` with an `aal2` (MFA-verified) session to update
the content. The site never contains a service-role key. Do not grant the admin
role through user-editable `user_metadata`.

Signed-in users can submit private support requests at `/support` and view
administrator replies there. The admin MCP tools use the local service-role
key to list requests and save replies; keep the MCP server on a trusted machine.
The online/offline indicator is a manually managed availability status, not
real-time presence.
Apply the support-request migration before using `/support` or the admin inbox.
The inbox and replies use the local MCP server; they do not send email.

## Project structure

```text
src/
  AdminPage.jsx Admin-only status editor and support inbox
  AuthPage.jsx  Account, sign-in, signup, MFA, and password flows
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
  functions/delete-account/  Authenticated self-service account deletion
  migrations/   Public status and private support tables with access policies
app.html        Vite HTML source template
vite.config.js  Vite configuration for the GitHub Pages project path
index.html      Generated GitHub Pages entry point
404.html        Generated GitHub Pages SPA fallback
```

The Terms & Conditions content is general information, not legal advice.
Review it with a qualified legal professional before relying on it.
