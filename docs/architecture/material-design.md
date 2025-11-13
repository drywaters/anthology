# Angular Material Reference

This note captures how the Anthology frontend applies [Material Design](https://m3.material.io/) and what to double-check before shipping formatting changes.

## Reference stack

- **Design language:** The UI follows Material Design 3; use the Material guidance above for color, typography, and motion decisions.
- **Component library:** [Angular Material](https://material.angular.io/) is installed via `@angular/material` and drives theming plus the component primitives (table, toolbar, snack-bar, etc.).
- **Theme definition:** `web/src/styles.scss` imports `@angular/material` with `@use '@angular/material' as mat;` and defines the `$anthology-theme` tokens, including the Azure and Rose palettes along with the Inter/Segoe/Roboto font stack. `mat.core()`, `mat.all-component-themes()`, and `mat.all-component-typographies()` are included globally so standalone components automatically inherit the theme.

## How the theme is applied

1. `npm install` pulls Angular Material and its peer dependencies (see `web/package.json`).
2. `web/src/main.ts` bootstraps the standalone `App` component, which imports no CSS of its own—global styles come entirely from `src/styles.scss`.
3. Component SCSS files stay lean. Layout is mostly handled by Angular Material primitives:
   - `ItemsPageComponent` uses `MatToolbarModule`, `MatTableModule`, `MatSnackBarModule`, `MatButtonModule`, and `MatIconModule`.
   - `LoginPageComponent` consumes form-field, input, button, and card modules.
   - `ItemFormComponent` composes select, input, and button modules with Angular’s reactive forms.
4. Icons come from Google Fonts (`Material Icons`) via the link tag in `web/src/index.html`.

## Formatting checklist

Before merging any theme or layout update:

1. **Validate theme tokens** – Update `web/src/styles.scss` only with ASCII-safe edits, run `npm run lint` to catch SCSS import issues, and confirm palettes/typography still follow Material Design guidance.
2. **Spot-check primary screens** – `npm start`, log in, and skim the items table, form dialog, and login card to ensure Angular Material components pick up the new tokens (surface container, on-surface, etc.).
3. **Run unit tests** – Execute `npm test -- --watch=false` so visual tweaks do not mask regressions in form validation logic.
4. **Build for production** – `npm run build` should emit `web/dist/web/browser` with themed CSS. The nginx-based UI container serves these assets in production.

Following this checklist keeps visual changes grounded in Material Design while ensuring formatting changes ship smoothly.
