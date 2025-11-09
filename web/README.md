# Anthology web client

This Angular 20 application provides the catalogue interface for Anthology. It ships with [Angular Material](https://www.npmjs.com/package/@angular/material) and delivers a clean, media-focused collection view out of the box.

## Prerequisites

* Node.js 20+
* Angular CLI (optional, installed as a dev dependency)

## Development server

```bash
npm install
npm start
```

The client listens on `http://localhost:4200`. API calls target the URL exposed through the `<meta name="anthology-api">` tag in `src/index.html` (defaults to `http://localhost:8080/api`). The Material 3 theme is defined in [`src/styles.scss`](src/styles.scss) so design updates live alongside global styles.

## Building for production

```bash
npm run build
```

Bundles are emitted under `dist/web/` and can be served by any static host (for example, nginx in front of the Go API).

## Testing

```bash
npm test -- --watch=false
npm run lint
```

The default Karma/Jasmine setup covers unit tests. Add e2e tooling (such as Playwright) once the app grows beyond the MVP.
