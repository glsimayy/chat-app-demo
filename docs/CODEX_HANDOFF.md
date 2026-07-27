# ellO Codex Handoff

Last updated: 2026-07-28
Source setup: desktop
Next setup: not selected

This is the source of truth for resuming ellO work on either machine. Read the
whole file before changing code or Git state.

## Transfer Note

The laptop-to-desktop transfer completed successfully and current work is on
the desktop `main` branch. The user authorized committing and pushing the chat
background picker update and this handoff after local validation.

A separate OneDrive ZIP is retained only as a backup:

```text
C:\Users\emovi\OneDrive\Masaüstü\ello-desktop-handoff-2026-07-27.zip
```

Depending on Windows localization, File Explorer may display `Masaüstü` as
`Desktop`; use the actual OneDrive Desktop folder on the target machine.

Normal desktop continuation should use Git, not the ZIP. PostgreSQL data lives
in a machine-local Docker volume and is not included in Git or the backup.

## Exact Prompt For Next Codex

Give the next Codex task this prompt, replacing the setup name if needed:

```text
SETUP: desktop
Open the existing chat-app-demo checkout, read docs/CODEX_HANDOFF.md,
preserve any existing local changes, switch/pull main, verify Docker without
exposing .env values, and continue from Next Work.
```

## Repository State

- Repository: `https://github.com/glsimayy/chat-app-demo.git`
- Continue branch: `main`
- Remote tracking branch: `origin/main`
- Feature branch `codex/post-handoff-demo-fixes` was fast-forward merged into
  `main` on 2026-07-27.
- Reply fix commit: `228babb fix: persist chat replies end to end`
- Technical reference commit:
  `de585d7 docs: add API and database reference reports`
- Bot automation and support realtime commit:
  `c29d359 feat: expand bot automation and realtime support`
- WebRTC diagnostics commit:
  `9bd7a79 feat: add WebRTC call diagnostics`
- The commit containing this handoff also contains the chat background picker
  update. Verify it with `git log -1 --oneline` after pulling.
- Do not switch to `emir_frontend`; that work is already in current history.

Desktop preparation:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git rev-parse --short HEAD
git status --short --branch
```

The expected result is a clean worktree aligned with
`origin/main`. If the desktop repo already has changes, stop and inspect them
before pulling. Do not overwrite unknown work.

## Latest Branch Work

### Reply Fix

The reply composer previously showed the selected message but the sent message
did not persist `replyToMessageId`.

The fix:

- passes `replyToMessageId` explicitly from the composer
- preserves `replyOf` for optimistic rendering
- sends the same reply target through Socket.IO and REST fallback
- removes false `0 Files` text from text-only reply previews
- adds a Playwright regression scenario for replying to a BOT message

Laptop verification:

- frontend typecheck passed
- all 18 frontend unit tests passed
- frontend production build passed
- targeted BOT-message reply Playwright test passed

### Database Model Documentation

Created:

- `docs/database-data-model.md`
- `output/pdf/ellodb-veri-modeli.pdf`
- `scripts/generate-database-model-report.py`

Updated the database audit to cover the current schema. Last laptop
verification:

- 46 expected indexes
- 22 expected foreign keys
- 11-page A4 database model PDF
- all PDF pages rendered and visually checked

### API And Java Webhook Documentation

Created:

- `docs/api-java-webhook-reference.md`
- `docs/openapi.snapshot.json`
- `output/pdf/ello-api-java-webhook-dokumani.pdf`
- `scripts/generate-api-webhook-report.py`

Last laptop verification:

- 45 OpenAPI paths
- 56 REST operations
- 57 schemas
- 20 documented Socket.IO client events
- 48-page A4 PDF
- no empty pages, clipped content, or broken Turkish glyphs
- all 20 Java webhook tests passed with JDK 21

### Temporary Internet Server

Created:

- `scripts/start-temporary-server.ps1`
- `scripts/stop-temporary-server.ps1`
- `docs/temporary-public-server.md`
- root npm commands `server:temporary`, `server:temporary:build`, and
  `server:temporary:stop`

The start script:

- validates Docker and root `.env`
- starts Docker Compose
- waits for frontend health
- removes a stale tunnel container
- starts a Cloudflare Quick Tunnel
- prints the temporary public URL

A Windows PowerShell issue was fixed: `cloudflared` writes normal information
logs to stderr, so the script now captures those lines without treating them
as terminating errors.

The script was syntax checked and live tested. Public frontend `/healthz`
returned `200` and public `/api/health` returned `ok`.

Quick Tunnel details:

- no deployment is created
- the URL changes on restart
- city/POP selection is not available
- only frontend `5173` is tunneled
- backend `3000`, Java `8080`, and PostgreSQL `5432` stay loopback-only
- no previous public URL should be assumed valid

### Expanded Bot Automation And Support Realtime

The BOT API now supports the automation group lifecycle beyond group creation:

- create or get an idempotent group
- inspect and update group settings
- list, add, remove, and promote/demote participants
- create, edit, and delete bot-authored messages

Examples are in `docs/bot-api-examples.md`. Bot operations use
`x-bot-secret`; normal user JWTs are not used for these endpoints.

Support tickets now emit `ticket:created` and `ticket:updated` Socket.IO
events. The frontend refreshes the relevant ticket state from those events, so
admin and requester views update without a manual refresh. The cross-session
Playwright scenario passed.

### WebRTC Diagnostics And Audio Verification

The call overlay now includes a diagnostics panel for:

- peer and ICE connection state
- microphone sending bytes
- remote audio receiving bytes
- selected network path and candidate type
- actionable recovery messages

Recovery logic can restart ICE or rebuild the peer connection when needed.
Local audio passed, and two-way audio also passed between phone and desktop
through the Cloudflare HTTPS URL. The observed successful path was
`host / host / udp`.

No authenticated TURN service is bundled. The current STUN/host path can work
on permissive networks, but a production TURN server is still recommended for
restrictive NAT or firewall combinations.

### Chat Background Picker

The Settings > Themes background selector was replaced with a responsive
three-column preview grid:

- nine named and keyboard-accessible radio choices
- stable rectangular previews instead of nearly invisible circles
- selected border, label color, and check indicator
- preview-only contrast enhancement for the very pale source PNGs
- no filter applied to the actual chat background

The mobile settings header overlap was also fixed. Validation completed on
desktop and a `390px` viewport with no horizontal overflow. The targeted
Playwright test verifies all nine choices, the default selection, and actual
chat background switching.

Current frontend verification on 2026-07-28:

- typecheck passed
- all 23 unit tests passed
- production build passed
- targeted theme Playwright test passed
- Docker frontend was rebuilt and is healthy

## Root Environment

The root `.env` is intentionally ignored by Git and is not in the repository
or handoff ZIP.

Required values:

- `JWT_SECRET`
- `BOT_WEBHOOK_SECRET`
- `WEBHOOK_SECRET`

Laptop verification on 2026-07-27:

- all three values exist
- all are at least 32 characters
- none use documented placeholders
- values were not printed

On desktop, inspect only presence, length, uniqueness, and placeholder status.
Never print or commit the values.

If `.env` is missing:

```powershell
Copy-Item .env.compose.example .env
```

Then replace every secret placeholder with a unique random value of at least 32
characters. `POSTGRES_PASSWORD` and the password inside `DATABASE_URL` must
match.

## Docker State

Docker Desktop and all four long-running services were healthy on the desktop
after the final frontend rebuild on 2026-07-28. No public tunnel should be
assumed active.

Start on desktop:

```powershell
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

Expected long-running services:

| Service | URL | Expected |
| --- | --- | --- |
| Frontend | `http://localhost:5173` | healthy |
| Backend | `http://localhost:3000/api/health` | healthy |
| Java webhook | `http://localhost:8080/health` | healthy |
| PostgreSQL | `127.0.0.1:5432` | healthy |

Swagger:

```text
http://localhost:3000/api/docs
```

## Historical Demo Database Baseline

At the final laptop check, the database was reset to:

- 6 fixed users
- 3 visible sample groups
- 3 private management conversations
- 6 messages total: one system and one welcome message per visible group
- 0 support tickets
- 0 contact invitations
- 0 call records

Visible groups:

| Group | Owner | Managers | Members can send | Members can leave |
| --- | --- | --- | --- | --- |
| Staj Proje Ekibi | emiradmin | asliadmin, gulsimaadmin | yes | yes |
| Backend Koordinasyon | asliadmin | emiradmin | no | no |
| Demo ve Test Ekibi | gulsimaadmin | emiradmin, asliadmin | yes | yes |

Every group contains all six fixed users.

The desktop database has since been used for browser, support, BOT, and call
tests. Do not assume the counts above are still current. Treat this section as
the reproducible demo baseline only. Do not use `docker compose down -v` or
reset demo data unless the user explicitly requests it.

## Fixed Test Accounts

All passwords are `123456`.

| Automation ID | Username | Email | Role |
| --- | --- | --- | --- |
| 1 | emiradmin | emiradmin@ello.com | admin |
| 2 | emiruser | emiruser@ello.com | user |
| 3 | asliadmin | asliadmin@ello.com | admin |
| 4 | asliuser | asliuser@ello.com | user |
| 5 | gulsimaadmin | gulsimaadmin@ello.com | admin |
| 6 | gulsimauser | gulsimauser@ello.com | user |

The Automation Bot is recreated automatically on the first BOT API operation
and does not need to be part of the initial six-user state.

## Local And Temporary Server Commands

Local-only stack:

```powershell
docker compose up -d
```

Open:

```text
http://localhost:5173
```

Temporary public test server:

```powershell
npm.cmd run server:temporary
```

Rebuild and open:

```powershell
npm.cmd run server:temporary:build
```

Stop public access but keep local services:

```powershell
npm.cmd run server:temporary:stop
```

Stop local services without deleting PostgreSQL data:

```powershell
docker compose stop
```

## Next Work

Recommended continuation order:

1. Pull `main` and verify a clean worktree.
2. Start Docker and wait for all long-running services to become healthy.
3. Open Settings > Themes and confirm the nine visible background previews.
4. Keep the current database unless the user requests the documented demo
   reset.
5. Select the next product priority with the user.
6. Consider authenticated TURN only if cross-network call reliability becomes
   a release requirement.
7. Continue from `main`; push new work only when the user explicitly asks.

## Final Sanity Commands

```powershell
git status --short --branch
git rev-parse --short HEAD
docker compose ps
Invoke-RestMethod http://localhost:3000/api/health
Invoke-WebRequest -UseBasicParsing http://localhost:5173/healthz
Invoke-RestMethod http://localhost:8080/health
Invoke-RestMethod http://localhost:8080/ready
Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/docs
```

The project now continues from `main`.
