# Sushil Pokharel — Website

A responsive personal website with a maintenance landing page, a beta access
request flow, and a Terms & Conditions page.

## Features

- Responsive layouts for desktop and mobile
- Dedicated maintenance, beta request, confirmation, terms, and not-found pages
- Beta participation terms with required applicant acknowledgement
- Accessible navigation, forms, and status messages
- Email drafts prepared for review before sending

## Tech stack

- React 18
- Vite 6
- CSS

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
HTML and assets to the repository root for branch-based GitHub Pages hosting.
`app.html` is the Vite source template; the root `index.html` is generated
deployment output.

## Project structure

```text
src/
  App.jsx       Page content and interactions
  main.jsx      React entry point
  styles.css    Responsive styles
app.html        Vite HTML source template
vite.config.js  Vite configuration for the GitHub Pages project path
index.html      Generated GitHub Pages entry point
```

The Terms & Conditions content is general information, not legal advice.
Review it with a qualified legal professional before relying on it.
