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

Configure the repository’s GitHub Pages source once under **Settings →
Pages → Build and deployment → Source → GitHub Actions**. Then pushing to
`main` builds and deploys the site using `.github/workflows/deploy-pages.yml`.

## Project structure

```text
src/
  App.jsx       Page content and interactions
  main.jsx      React entry point
  styles.css    Responsive styles
vite.config.js  Vite configuration for the GitHub Pages project path
index.html      HTML entry point and metadata
```

The Terms & Conditions content is general information, not legal advice.
Review it with a qualified legal professional before relying on it.
