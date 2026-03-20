# Firefox Review Notes for AMO

Paste the text below into the AMO "Notes for Reviewers" field.

---

Owl Tags is a single-purpose WebExtension for Google Docs, Sheets, and Slides.

Primary functionality:
- scan the current Google editor for Owl tags
- highlight tags
- export tags
- mark tags done
- archive tags
- best-effort navigation to the selected tag on the current page

Packaging:
- Version file uploaded to AMO is built from `src/webext/dist/firefox/`
- Source code package uploaded to AMO is the reviewable source from `src/webext/`
- Firefox manifest sets `strict_min_version` to `140.0`

Build steps:
1. `cd src/webext`
2. `npm ci`
3. `npm run check`
4. `npm test`
5. `npm run build`
6. `npm run lint:firefox`
7. `npm run prepare:firefox-submission`

Permissions used:
- `storage`
- `scripting`
- `activeTab`
- `identity`

Host/network scope:
- Google Docs, Sheets, and Slides pages only
- Google OAuth and Google Workspace API endpoints only

Data handling:
- settings and OAuth tokens are stored locally in extension storage
- no Owl backend
- no analytics
- no crash reporting
- no passive sync

Reviewer setup note:
- the extension does not bundle a shared Google OAuth client ID
- to test live sign-in and Google Workspace actions, set a valid Firefox OAuth
  client ID in the options page before scanning or mutating a document
- if you want reviewers to test against a live Google account, provide that
  reviewer-only setup separately in the AMO listing notes

Why `data_collection_permissions` are declared:
- `authenticationInfo` because the extension uses Google OAuth
- `websiteContent` because the extension reads and writes the current user-selected Google Workspace document through Google-owned APIs
- Firefox 140+ is required so this consent is handled by Firefox's built-in
  install flow rather than a custom legacy fallback

Known review-relevant limitation:
- Safari support is intentionally separate and not part of the Firefox package

Third-party code:
- the shipped Firefox package contains no third-party runtime libraries
- build-time tooling is limited to public npm packages declared in
  `package.json` and pinned in `package-lock.json`

---
