# Release v1.0.1 — Dormmate

Release date: 2026-07-05

Highlights:
- Renamed app from GroceSplit to `dormmate` across the codebase and UI.
- Updated localStorage keys and internal event names to use `dormmate_` prefixes.
- Replaced PWA icons with new Dormmate logo (SVGs in `public/`).
- Updated `package.json` and cloud function package name.

Important for users:
- Please update your installed PWA to receive the latest fixes and notifications.
- If you use the hosted app, redeploy the `dist` to your hosting provider so clients get the new service worker and manifest.

Suggested release note / notification message:
> Dormmate v1.0.1 is available — we've renamed the app and updated icons. Please refresh or reinstall the PWA to get the latest features and improved notifications.

How to publish (maintainer):
1. Create a GitHub Release from tag `v1.0.1` and paste the contents of this file as the release description.
2. Build and deploy to hosting:
```
npm run build
firebase deploy --only hosting,functions
```
3. Optionally create a short Twitter/GitHub-issue/email to announce the update.
