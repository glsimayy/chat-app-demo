# ellO Codex Handoff

Last updated: 2026-07-24
Source setup: desktop
Target setup: any

This file is the persistent source of truth when changing machines, Codex
threads, or models. On a new setup, pull `main`, ask Codex to read this file,
and continue from the "Next Work" section.

## Repository State

- Repository: `https://github.com/glsimayy/chat-app-demo.git`
- Canonical branch: `main`
- Verified audio-call implementation commit: `098d07f`
- Verified merge commit on `main`: `94ad86e`
- Feature backup branch: `codex/webrtc-audio-calls`
- Feature commit: `2296360`
- The incorrect standalone presence experiment was reverted before the
  verified implementation was merged into `main`.
- `output/` is user-owned, untracked local output. Never stage, delete, move,
  or overwrite it unless the user explicitly requests it.

The handoff commit is newer than the code baseline above. After pulling on the
desktop, `git status` should be clean apart from any machine-local untracked
files.

## Desktop Bootstrap

Run these commands from the repository root:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git status --short --branch
git log -1 --oneline
docker compose up -d --build
docker compose ps
```

Expected services:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:3000/api/health`
- Swagger: `http://localhost:3000/api/docs`
- Java webhook health: `http://localhost:8080/health`
- PostgreSQL: port `5432`

All four long-running Docker services should report `healthy`.

To give Codex the context on the desktop, use this exact message:

```text
SETUP: desktop
Read docs/CODEX_HANDOFF.md, verify main and Docker, then continue from Next Work.
Do not touch the untracked output/ directory.
```

## Implemented And Verified

- NestJS backend, React frontend, PostgreSQL persistence, and Java webhook run
  together with Docker Compose.
- Authentication, admin/user authorization, persistent sessions, direct
  messaging, group messaging, group management, manager chat, automation bot
  groups, support tickets, attachments, profiles, message search, bookmarks,
  archive/delete preferences, and contact invitations are integrated.
- Socket.IO provides realtime messages, edits, deletes, group changes,
  presence, typing, and WebRTC signaling.
- Audio calling has a WebRTC UI, signaling, persisted call history, call
  status/duration, and redial support.
- Audio calls tolerate short Socket.IO outages, resynchronize the server call
  session after reconnect, and attempt ICE recovery before failing.
- Call signaling logs include lifecycle metadata without SDP or ICE contents.
- Calls page uses real backend data instead of template data.
- Presence is based on authenticated active sockets and supports multiple tabs.
- Contacts no longer render every user in PostgreSQL. They are derived from
  active direct-conversation participants.
- The backend exposes those direct-conversation contacts through
  `GET /api/conversations/contacts`, independently of chat pagination or
  per-user archive/delete preferences.
- Existing direct-conversation participants are available in the group member
  picker, and their profile is shown as an existing contact instead of offering
  a duplicate invitation.
- Incoming messages no longer create popup notifications. Socket-driven
  in-chat updates, unread state/badges, list refreshes, and hidden-tab title
  notifications remain active.
- Saved Messages menus stay inside the viewport.
- Opening a bookmarked message scrolls only the conversation container and does
  not move the page or composer.
- Playwright starts isolated frontend/backend servers on ports `5273` and
  `3100` with an in-memory backend database, so Docker can remain running
  without polluting the local PostgreSQL database.

Last complete verification:

- Backend unit tests: `54/54`
- Frontend unit tests: `18/18`
- Playwright E2E tests: `29/29`
- Backend and frontend production builds passed.
- Full Docker Compose build, migration, and health checks passed.

## Open Bugs

### BUG-3: Bot API idempotency response is unclear

Observed:

- `POST /api/bot/groups` intentionally reuses a group when `externalRef` is
  repeated.
- Sending a different group payload with the same `externalRef` silently looks
  like the second group failed to be created.

Expected improvement:

- Clearly return metadata such as `created: false` / `reused: true`, or return
  an explanatory `409 Conflict` when the same `externalRef` is reused with a
  materially different payload.
- Preserve retry-safe idempotency.

Example that reuses the first group:

```json
{
  "name": "Arkadaslarla Bot Testi 2",
  "participantIds": ["2", "1", "3", "5", "4", "6"],
  "managerIds": ["2", "1"],
  "memberCanSendMessages": true,
  "membersCanLeave": true,
  "externalRef": "friends-test-20260724"
}
```

A genuinely new group currently requires a new value such as
`friends-test-20260724-2`.

## Resolved Bugs

### BUG-1: Duplicate popup notifications

Resolved on `codex/disable-message-popups`:

- Removed the dedicated incoming-message toast, its click-to-open behavior, and
  its custom styling.
- `message:new` still refreshes conversation lists so unread state and badges
  update immediately.
- Messages still appear in an open conversation without refresh, and hidden
  tabs still temporarily identify the sender in the document title.
- Playwright verifies the unread badge, popup absence, and realtime
  bidirectional direct messaging.
- The mobile viewport E2E assertion now waits for the chat panel transition to
  settle before measuring the composer.

### BUG-2: Direct message and Contact relationship gap

Resolved on `codex/contact-dm-sync`:

- Active direct conversations are the single Contact relationship source; no
  duplicate Contact table or direct conversation is created.
- `GET /api/conversations/contacts` returns the authenticated user's unique
  non-bot direct contacts even when the chat is hidden from that user's list.
- The frontend loads contacts on the Chats screen and refreshes them before
  opening the group member picker.
- User profiles recognize existing direct contacts and no longer offer a
  duplicate invitation.
- Contact invitation conflicts now clearly report that the users are already
  contacts.
- Unit and Playwright coverage includes idempotent direct conversations,
  hidden chats, duplicate invitations, and DM-before-group selection.

### BUG-4: Audio call ends before connection

Originally observed during testing through a Cloudflare Quick Tunnel from
different networks:

- The call closes almost immediately before the receiver can establish the
  connection.
- The UI can show `Call ended` while the incoming-call presentation is still
  visible.

Implemented in `098d07f` and merged into `main`:

- A 15-second backend disconnect grace period keeps ringing/active sessions
  alive during transient socket reconnects.
- `call:sync` restores session state after reconnect and `call:recover`
  requests a fresh caller offer when the recipient needs ICE recovery.
- The frontend shows a reconnecting state, retries ICE, and sends terminal call
  events once.
- Structured lifecycle/signaling logs omit SDP and ICE payload contents.
- Backend unit tests and Playwright now cover the reconnecting ringing call.

User validation completed:

- The call connects successfully and audio is transmitted.
- BUG-4 is closed. TURN is not required for the tested path; it remains a
  future compatibility option for network combinations where public STUN
  cannot establish media.

## Next Work

Recommended priority on the desktop:

1. Improve the API contract and tests for BUG-3.
2. Run backend tests, frontend tests, production builds, targeted E2E tests,
   then the full E2E suite.
3. Commit to a focused `codex/` branch, merge to `main`, and push only after
   verification.

## Test Accounts

All built-in account passwords are `123456`.

| Automation ID | Username | Email | Global role |
| --- | --- | --- | --- |
| `1` | `emiradmin` | `emiradmin@ello.com` | admin |
| `2` | `emiruser` | `emiruser@ello.com` | user |
| `3` | `aslıadmin` | `asliadmin@ello.com` | admin |
| `4` | `aslıuser` | `asliuser@ello.com` | user |
| `5` | `gülsimaadmin` | `gulsimaadmin@ello.com` | admin |
| `6` | `gülsimauser` | `gulsimauser@ello.com` | user |

The database also contains the required `ellO Automation Bot` system account.
Do not expose normal direct messaging to the bot unless that product decision
is revisited.

## Bot API Test

Swagger:

```text
http://localhost:3000/api/docs
```

Bot endpoints use the `x-bot-secret` header. Read the active local value without
writing it into this document:

```powershell
docker inspect chat-app-demo-backend-1 --format '{{range .Config.Env}}{{println .}}{{end}}' |
  Select-String '^BOT_WEBHOOK_SECRET='
```

Useful flow:

1. `POST /api/bot/groups`
2. Copy the returned conversation ID.
3. `POST /api/bot/groups/{conversationId}/participants`
4. `POST /api/bot/groups/{conversationId}/messages`
5. Confirm group/message updates appear without refresh.

## Database State And Transfer

Git does not carry PostgreSQL data. Each machine has a separate Docker volume.
The laptop database was cleaned to the six built-in test accounts plus the
Automation Bot before the latest manual tests. Groups/messages created after
that cleanup are laptop-local.

If only code and fresh test accounts are needed, do not transfer the database.
`docker compose up -d --build` bootstraps the built-in users.

To move the exact laptop database to the desktop, create a fresh custom-format
dump on the laptop:

```powershell
docker exec chat-app-demo-postgres pg_dump `
  -U postgres -d chat_app_demo -Fc `
  -f /tmp/ello-desktop-handoff.dump

docker cp chat-app-demo-postgres:/tmp/ello-desktop-handoff.dump `
  "$HOME\Desktop\ello-desktop-handoff.dump"
```

Restore only after taking a backup of any existing desktop database. Stop the
backend/frontend/Java services during restore so they cannot write concurrently.

An older laptop backup made before a cleanup exists only on the laptop at:

```text
C:\Users\emovi\AppData\Local\Temp\ello-before-demo-only-cleanup-20260724-155816.dump
```

## Temporary Internet Testing

The laptop currently has a Docker-based Cloudflare Quick Tunnel container named
`ello-quick-tunnel`. It exposes the frontend, proxied API, and Socket.IO through
one temporary HTTPS URL.

Inspect the current laptop URL:

```powershell
docker logs ello-quick-tunnel 2>&1 |
  Select-String 'https://.*trycloudflare.com'
```

Stop public access before leaving the laptop:

```powershell
docker stop ello-quick-tunnel
```

The container restart policy is intentionally `no`, so it should not expose the
application automatically after Docker restarts. The URL is temporary and will
change when a new Quick Tunnel is created on the desktop.

Create a new desktop tunnel after the application is healthy:

```powershell
docker run -d --name ello-quick-tunnel `
  cloudflare/cloudflared:latest tunnel --no-autoupdate `
  --url http://host.docker.internal:5173

docker logs ello-quick-tunnel
```

The public link should be shared only with the intended testers. The demo
accounts use weak test passwords, and a Quick Tunnel is not a production
deployment.

## Final Desktop Sanity Check

```powershell
git status --short --branch
docker compose ps
Invoke-RestMethod http://localhost:3000/api/health
Invoke-WebRequest -UseBasicParsing http://localhost:5173/healthz
Invoke-RestMethod http://localhost:8080/health
```

Then manually verify:

- Login with one admin and two users.
- Direct and group messages update without refresh.
- Presence becomes online/offline correctly.
- Bot group creation and bot messages appear in realtime.
- Reproduce the four open bugs before changing code.
