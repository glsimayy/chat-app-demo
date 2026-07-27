# ellO Codex Handoff

Last updated: 2026-07-27
Source setup: laptop
Next setup: desktop

This is the source of truth for resuming ellO work on the desktop. Read the
whole file before changing code or Git state.

## Transfer Note

The user authorized committing and pushing because that makes the desktop
handoff safer. The branch contains the reply fix, documentation, PDFs,
temporary-server scripts, and this handoff.

A separate OneDrive ZIP is retained only as a backup:

```text
C:\Users\emovi\OneDrive\Masaüstü\ello-desktop-handoff-2026-07-27.zip
```

Depending on Windows localization, File Explorer may display `Masaüstü` as
`Desktop`; use the actual OneDrive Desktop folder on the target machine.

Normal desktop continuation should use Git, not the ZIP. PostgreSQL data lives
in a machine-local Docker volume and is not included in Git or the backup.

## Exact Prompt For Desktop Codex

Give the next Codex task this prompt:

```text
SETUP: desktop
Open C:\Users\emovi\OneDrive\Documents\GitHub\chat-app-demo, read
docs/CODEX_HANDOFF.md, switch/pull codex/post-handoff-demo-fixes, preserve any
existing local changes, verify the root .env without exposing secrets, start
Docker, recreate the documented 6-user/3-group demo database, and continue
from Next Work. Do not merge to main until I explicitly ask.
```

## Repository State

- Repository: `https://github.com/glsimayy/chat-app-demo.git`
- Continue branch: `codex/post-handoff-demo-fixes`
- Remote tracking branch: `origin/codex/post-handoff-demo-fixes`
- `origin/main`: `dc89a9a`
- Reply fix commit: `228babb fix: persist chat replies end to end`
- Technical reference commit:
  `de585d7 docs: add API and database reference reports`
- The latest commit contains temporary-server tooling and this desktop
  handoff. Verify it with `git log -1 --oneline` after pulling.
- Do not switch to `emir_frontend`; that work is already in current history.

Desktop preparation:

```powershell
git fetch origin
git switch codex/post-handoff-demo-fixes
git pull --ff-only origin codex/post-handoff-demo-fixes
git rev-parse --short HEAD
git status --short --branch
```

The expected result is a clean worktree aligned with
`origin/codex/post-handoff-demo-fixes`. If the desktop repo already has
changes, stop and inspect them before pulling. Do not overwrite unknown work.

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

Docker Desktop and the local stack were running and healthy at the final
laptop handoff check. No public tunnel should be assumed active.

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

## Last Verified Demo Database State

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

This database state will **not** transfer to desktop automatically because
Docker volumes are machine-local. The desktop Codex task should recreate this
state after Docker starts. Do not use `docker compose down -v` unless the user
explicitly requests complete volume deletion.

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

Recommended desktop order:

1. Pull `codex/post-handoff-demo-fixes` and verify a clean worktree.
2. Verify root `.env` without exposing secrets.
3. Start Docker and wait for all long-running services to become healthy.
4. Recreate the documented 6-user/3-group demo database.
5. Open the application and perform a short manual desktop sanity check.
6. Continue feature or bug work only after the user selects the next priority.
7. Do not merge to `main` until the user explicitly asks.

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

Do not merge the branch to `main` during handoff restoration unless the user
explicitly asks.
