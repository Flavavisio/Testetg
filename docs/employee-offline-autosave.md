# Employee offline work and automatic report drafts

Implementation branch: `feat/employee-offline-autosave`.

The installed application caches its static shell and a pinned, same-origin
Supabase SDK. After a successful employee/foreman login, the existing data cache
and confirmed server snapshots are saved together in one IndexedDB envelope,
scoped by the authenticated account ID. Cold offline startup uses only that
account's previously loaded profile and data. Explicit logout disables offline
access until the next successful online login; it preserves unsent report
checkpoints for recovery by the same account.

Report editors checkpoint after a 700 ms pause, on signature pointer release,
when photographs finish loading, periodically while dirty, and when closing or
backgrounding the application. Each checkpoint is scoped by company, employee,
OS, report category and equipment. Security/fire, custom and native AVAC,
cleaning and electrical reports reuse their existing draft serializers, including
REX dynamic table state and customer/technician signatures.

The status distinguishes changes in memory, an IndexedDB-committed checkpoint,
and a server-confirmed draft. Network failure or a changed report preserves the
local copy. Online retries use the original report ID, inspect current remote
state and use a small JSON version token for conditional updates. Newly completed
remote reports and changed drafts are not silently replaced. Server requests use
the current Supabase session and existing RLS; no authentication secrets or service
keys are added to the offline checkpoint stores. No schema migration is required.

The pre-existing hours/materials synchronization remains in place. Its cache now
commits before sync and restores unsent changes before fetching replacement data.
Offline reports remain drafts: finalization and final numbering require an online
connection. A cloud-only legacy draft must first be opened online on that device.
A new device and a first login also require internet. OS creation/finalization,
PDF exports, maps and other external services are not made fully offline by this
change. Existing unowned legacy v1 caches are not automatically adopted by a
newly authenticated identity.

## Verification

Run `npm ci && npm run test:offline` for checkpoint persistence, debounce, photos,
signatures, account isolation, retry idempotency, conflicts, atomic application
cache, shell assets and existing native/legacy report and logout regressions.

A full mobile Chromium scenario is supplied in
`tests/employee-offline-browser.cjs`. Serve this repository at
`http://127.0.0.1:8765`, install Playwright Chromium, and run the script. It uses
synthetic local data only and blocks external requests. It covers the actual
application shell, cold offline employee restoration, editing a CCTV report,
automatic checkpointing, closing, full reload and recovering the same text.
This scenario could not be executed in the implementation environment because
the Chromium download returned an invalid archive. Real iOS/PWA lifecycle and
live backend/RLS integration remain to be verified before production rollout.
