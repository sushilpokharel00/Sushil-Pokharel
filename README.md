# Sushil Pokharel — Website

A responsive personal website with a maintenance landing page, a beta access
request flow, and a Terms & Conditions page.

## Features

- Responsive layouts for desktop and mobile
- Dedicated maintenance, beta request, confirmation, terms, and not-found pages
- Beta participation terms with required applicant acknowledgement
- Accessible navigation, forms, and status messages
- Email drafts prepared for review before sending
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

The repository includes a stdio MCP server with a read-only
`check_github_pages_routes` tool. It checks the site root and requested
same-site routes, identifies GitHub Pages' generic 404 response, recognizes
the app shell served as a client-side route fallback, and labels the expected
client page for known routes and unknown paths. By default, it checks the
Terms, beta, and account pages, plus a probe path that should render the app's
not-found page. For safety, it only requests HTTPS sites hosted on `github.io`.

Run the server with `npm run mcp`, or open this repository in VS Code to load
the server from `.vscode/mcp.json`. Pass a project Pages URL and optional
relative route paths, for example:

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
email-confirmation and password policies in the Supabase dashboard. Add the
GitHub Actions repository secrets `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` with the project URL and public anon/publishable key.
These public client configuration values are embedded in the generated website
bundle; never use a Supabase service-role key in the browser or GitHub Pages.
Allow the following redirect URL in Supabase Auth URL Configuration:

```text
https://sushilpokharel00.github.io/Sushil-Pokharel/account
```

For local development, copy `.env.example` to `.env.local` and fill in the same
public project values. Do not commit `.env.local`. If the values are not
configured, the account page explains how to configure them and does not
attempt to authenticate.

## Admin dashboard

After setting up Supabase, apply
`supabase/migrations/20261008000000_site_settings.sql` in the Supabase SQL
Editor. The home page reads the public maintenance status and message from this
table. `/admin` lets an administrator update the availability switch, heading,
and message.

There is intentionally no default admin username or password. Create and
confirm your personal account at `/account`, then enable an authenticator in
its account security settings. In the Supabase SQL Editor, replace the example
email below with that confirmed account's email and run the statement to assign
the trusted `app_metadata` role:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"role":"admin"}'::jsonb
where email = 'YOUR_CONFIRMED_ACCOUNT_EMAIL'
returning id, email;
```

Sign out and back in after granting the role so Supabase issues a fresh token,
then visit `/admin`. Row-level security allows only an `admin` role in
Supabase-managed `app_metadata` with an `aal2` (MFA-verified) session to update
the content. The site never contains a service-role key. Do not grant the admin
role through user-editable `user_metadata`.

## Project structure

```text
src/
  AdminPage.jsx Admin-only home-page status editor
  AuthPage.jsx  Account, sign-in, signup, MFA, and password flows
  App.jsx       Page content and interactions
  lib/
    supabase.js Supabase Auth client
  main.jsx      React entry point
  site-path.js  GitHub Pages-aware route helper
  styles.css    Responsive styles
mcp-server/
  index.js          MCP stdio server
  index.test.js     MCP startup test
  pages-checker.js  GitHub Pages route diagnostics
  pages-checker.test.js
supabase/
  migrations/   Public status table with admin/MFA-only update policies
app.html        Vite HTML source template
vite.config.js  Vite configuration for the GitHub Pages project path
index.html      Generated GitHub Pages entry point
404.html        Generated GitHub Pages SPA fallback
```

The Terms & Conditions content is general information, not legal advice.
Review it with a qualified legal professional before relying on it.
