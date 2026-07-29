# ellO Codex Handoff

Last updated: 2026-07-29
Source setup: laptop
Next setup: desktop

This file is the source of truth for continuing the current ellO work. Read it
before changing code, Docker state, or Git history.

## Exact Prompt For Desktop Codex

```text
SETUP: desktop
Open the existing chat-app-demo checkout, read docs/CODEX_HANDOFF.md,
preserve unknown local changes, fetch origin, switch/pull emir_v0.1+ without
merging it into main, verify the root .env without exposing values, start
Docker, and continue from Next Work.
```

## Git State

- Repository: `https://github.com/glsimayy/chat-app-demo.git`
- Continue branch: `emir_v0.1+`
- Remote branch: `origin/emir_v0.1+`
- Base branch: `main`
- Keep `emir_v0.1+` separate. Do not merge it into `main` unless the user
  explicitly asks.
- This branch started from `main` commit `5e24b39`.
- Use the newest commit on `origin/emir_v0.1+` as the handoff commit.

Desktop commands:

```powershell
git fetch origin
git switch 'emir_v0.1+'
git pull --ff-only origin 'emir_v0.1+'
git rev-parse --short HEAD
git status --short --branch
```

If the branch does not exist locally:

```powershell
git switch --track -c 'emir_v0.1+' origin/'emir_v0.1+'
```

The expected result is a clean worktree aligned with
`origin/emir_v0.1+`. If the desktop checkout already has changes, inspect them
before pulling and do not overwrite unknown work.

## Work Included In This Branch

### Admin Control Center

An admin-only operations area was added with:

- stored user, conversation, message, attachment, ticket, call, and audit
  totals
- process and Socket.IO counters
- live overview refresh every five seconds while the tab is visible
- interval deltas for HTTP requests, socket events, created messages, and
  active sockets
- masked message metadata browsing
- reason-and-justification-gated content reveal
- attachment metadata, explicit reveal, preview, and download
- immutable message content access logs

Message content remains masked by default. Revealing content creates an audit
record. Attachment access requires the matching audit.

### Moderation Reports

Users can report eligible user messages. The admin moderation queue supports:

- report reason and status filters
- masked evidence until an administrator records an access reason
- dismiss, delete-message, warn-user, and suspend-user decisions
- decision notes and audited evidence linkage
- clearer decision button states: blocked state explains what is missing and
  ready state uses a high-contrast green action

System messages cannot be reported. The frontend removes the report action and
the backend independently rejects a direct API attempt.

### Deterministic Catch-up

Group conversations have an LLM-free Catch-up panel. It summarizes a selected
recent window using deterministic message counts, participants, repeated topic
terms, notable phrases, attachments, and system activity.

### Composer Improvements

This branch also contains:

- per-user, per-conversation message drafts
- voice-message recording and audio preview
- responsive composer and mobile bottom buffer adjustments
- related frontend unit coverage

### Temporary Server Reliability

`scripts/start-temporary-server.ps1` now waits for the Cloudflare Quick Tunnel
hostname to resolve and for public frontend health before reporting success.
No old Quick Tunnel URL should be assumed valid.

## Latest Verification

Completed on the laptop on 2026-07-29:

- frontend typecheck passed
- frontend tests passed: 36/36
- frontend production build passed
- backend typecheck passed
- backend E2E tests passed: 16/16
- Docker frontend and backend images rebuilt successfully
- PostgreSQL, backend, Java webhook, and frontend were healthy
- `GET http://localhost:3000/api/health` returned `status: ok`
- live Admin Overview was checked in the browser
- five-second overview deltas and second-level timestamps updated correctly
- no horizontal overflow was present in the checked desktop viewport

The normal React Router v7 future-flag warnings still appear in one frontend
test. They do not fail the suite.

## Next Work

The user requested the following three features immediately before the handoff.
They were inspected only; implementation has not started.

1. Group mentions
   - Only active members of the current group may be mentioned.
   - Support both `@username` and `@email@domain`.
   - Treat the second `@` inside an email as part of the same mention.
   - Prefer a member autocomplete menu over free-form guessing.
   - Highlight recognized mentions in rendered messages.
   - Add parser/autocomplete tests, especially email mentions.

2. Turkish language support
   - Add a Turkish/English choice inside user Settings.
   - Persist the selected language.
   - Translate the application interface, validation/status text, moderation
     UI, admin UI, and known system-message templates.
   - Do not rewrite stored user-authored message content.
   - Standard system messages are currently stored in English, so translate
     known templates at presentation time or introduce stable event keys
     without breaking existing rows.

3. Admin self-report isolation
   - If a report targets an admin's own message, that admin must not see the
     report in their moderation queue.
   - The same admin must also be blocked from resolving the report by directly
     calling the endpoint with a guessed report ID.
   - Another admin must still be able to see and resolve it.
   - Add E2E coverage for queue filtering and the direct resolution guard.

Recommended order:

1. Implement and test the backend self-report isolation first because it is a
   security boundary.
2. Add the mention parser and group-member autocomplete.
3. Add the language provider and Settings control, then migrate visible
   surfaces section by section.
4. Run all backend/frontend tests, typechecks, builds, and Docker browser checks.
5. Keep work on `emir_v0.1+`; do not merge to `main` without an explicit request.

## Root Environment

The root `.env` is ignored by Git and is machine-local.

Required secrets:

- `JWT_SECRET`
- `BOT_WEBHOOK_SECRET`
- `WEBHOOK_SECRET`

On desktop, inspect only presence, minimum length, uniqueness, and placeholder
status. Never print or commit secret values.

If `.env` is missing:

```powershell
Copy-Item .env.compose.example .env
```

Replace placeholders with unique random values of at least 32 characters.
`POSTGRES_PASSWORD` and the password inside `DATABASE_URL` must match.

## Docker

Start or rebuild:

```powershell
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

Expected long-running services:

| Service | URL |
| --- | --- |
| Frontend | `http://localhost:5173` |
| Backend health | `http://localhost:3000/api/health` |
| Swagger | `http://localhost:3000/api/docs` |
| Java webhook | `http://localhost:8080/health` |
| PostgreSQL | `127.0.0.1:5432` |

Do not use `docker compose down -v` and do not reset demo data unless the user
explicitly requests it. PostgreSQL data is machine-local and is not transferred
by Git.

## Fixed Development Accounts

All passwords are `123456`.

| ID | Username | Email | Role |
| --- | --- | --- | --- |
| 1 | emiradmin | emiradmin@ello.com | admin |
| 2 | emiruser | emiruser@ello.com | user |
| 3 | asliadmin | asliadmin@ello.com | admin |
| 4 | asliuser | asliuser@ello.com | user |
| 5 | gulsimaadmin | gulsimaadmin@ello.com | admin |
| 6 | gulsimauser | gulsimauser@ello.com | user |

The Automation Bot is created automatically by the first BOT API operation.

## Useful Commands

Local stack:

```powershell
docker compose up -d
```

Temporary public test server:

```powershell
npm.cmd run server:temporary:build
```

Stop only public access:

```powershell
npm.cmd run server:temporary:stop
```

Stop local services without deleting PostgreSQL data:

```powershell
docker compose stop
```

Final sanity:

```powershell
git status --short --branch
docker compose ps
Invoke-RestMethod http://localhost:3000/api/health
Invoke-WebRequest -UseBasicParsing http://localhost:5173/healthz
Invoke-RestMethod http://localhost:8080/health
```
