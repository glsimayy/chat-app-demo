# ellO Codex Handoff

Last updated: 2026-07-27
Source setup: desktop
Next setup: laptop

This file is the source of truth for continuing ellO work on another machine or
in another Codex task. The next session must continue from the feature branch
below, not from `main`.

## Repository State

- Repository: `https://github.com/glsimayy/chat-app-demo.git`
- Continue branch: `codex/post-handoff-demo-fixes`
- Remote tracking branch: `origin/codex/post-handoff-demo-fixes`
- Canonical `main` remains unchanged at `cd47d1d`.
- Latest code commit before this handoff/PDF delivery:
  `31bfd72 test: align demo stack defaults`
- Important commits on the continue branch:
  - `1ed7119 feat: complete post-handoff demo workflows`
  - `8cbdb60 security: harden compose secrets and exposed ports`
  - `31bfd72 test: align demo stack defaults`
- The newest branch commit also contains this updated handoff and the technical
  PDF. Verify its hash with `git log -1 --oneline` after pulling.
- Do not switch back to `emir_frontend`; its work is already included in the
  current history.

The only intended tracked artifact under `output/` is:

```text
output/pdf/ello-teknik-dokumani.pdf
```

Do not stage, delete, move, or overwrite any other user-owned output files
unless the user explicitly requests it.

## Exact Laptop Start

Run from the laptop repository:

```powershell
git fetch origin
git switch codex/post-handoff-demo-fixes
git pull --ff-only origin codex/post-handoff-demo-fixes
git status --short --branch
git log -4 --oneline
```

Expected result:

- Branch is `codex/post-handoff-demo-fixes`.
- Branch and origin are aligned.
- Worktree is clean apart from machine-local ignored files.
- The last four commits include this handoff/PDF commit followed by
  `31bfd72`, `8cbdb60`, and `1ed7119`.

Give the next Codex task this exact prompt:

```text
SETUP: laptop
Read docs/CODEX_HANDOFF.md, switch/pull codex/post-handoff-demo-fixes,
verify the root .env without exposing secrets, start Docker, and continue from
Next Work. Do not touch unrelated output files.
```

## Root Environment File

The root `.env` is intentionally not tracked. Docker Compose now refuses to
start without these values:

- `JWT_SECRET`
- `BOT_WEBHOOK_SECRET`
- `WEBHOOK_SECRET`

Each value must be a different random secret of at least 32 characters.
Production validation rejects documented placeholders and values beginning
with:

- `change-me`
- `replace-with`
- `local-compose-`

Do not print or commit the active values. On the laptop, ask Codex to inspect
only whether the variables exist and meet the length/placeholder rules. If the
laptop still has old Compose defaults, replace them with new random secrets.

Optional values can be copied from `.env.compose.example`, but its secret
placeholders must be replaced before Docker starts.

## Docker Start And Verification

```powershell
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

Expected long-running services:

| Service | URL or port | Expected |
| --- | --- | --- |
| Frontend | `http://localhost:5173` | healthy |
| Backend | `http://localhost:3000/api/health` | healthy |
| Java webhook | `http://localhost:8080/health` | healthy |
| PostgreSQL | `127.0.0.1:5432` | healthy |

Port exposure is intentional:

- Frontend `5173` is reachable from the LAN for second-device testing.
- Backend `3000`, Java `8080`, and PostgreSQL `5432` bind only to
  `127.0.0.1`.
- Frontend Nginx proxies `/api` and Socket.IO traffic to the backend.
- Swagger is enabled by default for this demo:
  `http://localhost:3000/api/docs`.

The startup jobs must finish successfully:

- `migrate`: applies Prisma migrations and runs the database audit.
- `built-in-users-bootstrap`: preserves/creates the six fixed test users and
  the Automation Bot.

## Current Verified State

The desktop verification completed on 2026-07-27:

- Backend unit tests: `58/58`
- Backend API E2E tests: `13/13`
- Frontend unit tests: `18/18`
- Playwright E2E tests: `33/33`
- Backend and frontend typechecks passed.
- Backend and frontend production builds passed.
- Production security test passed.
- Full-stack Docker test passed, including:
  - frontend and same-origin API proxy
  - backend health
  - Swagger UI and OpenAPI JSON
  - Java health and readiness
  - admin login and role checks
  - regular-user authorization boundary
  - support ticket assignment/conflict/resolution
  - direct Socket.IO delivery and retry idempotency
  - persistent attachment upload/delivery/download
  - Java webhook authentication
  - ticket webhook group idempotency
  - read-only automation group policy
  - group Socket.IO delivery and persistence
- Database audit passed with 34 indexes and 13 foreign keys.
- Manual two-browser group chat test passed without refresh.
- The user previously verified that audio calls connect and transmit sound.

## Implemented Product Scope

### Authentication And Users

- Register, login, current user, logout, protected routes, and password change.
- JWT authentication and global admin/user roles.
- Login/register throttling and frontend Retry-After countdown.
- User search and persistent profile fields.
- Profile image compression and validation.
- Six stable built-in demo accounts plus the Automation Bot.

### Conversations And Contacts

- Idempotent direct conversations.
- Contacts derived from active direct-conversation relationships.
- Contact invitations with accept/decline and duplicate protection.
- Admin-created groups with owner/manager/member roles.
- Group rename, description, status, member message policy, and leave policy.
- Participant add/remove, manager role changes, owner transfer, and group leave.
- Private management conversation visible only to owner/managers.
- User-specific conversation bookmark, archive, and delete preferences.

### Messaging

- Persistent text messages with cursor pagination.
- Realtime create, edit, delete, typing, read receipt, and unread badges.
- Conversation message search and focused-message navigation.
- Persistent replies linked through `replyToMessageId`.
- Persistent forwarded labels and attachment forwarding.
- Copy and mark-unread message actions.
- User-specific persistent message bookmarks/Saved Messages.
- Shared contacts, emoji, camera/file composer actions.
- Up to five persistent 5 MB attachments per message.
- Participant-only authenticated attachment preview/download.
- `clientMessageId` retry idempotency and REST fallback when Socket.IO is down.

### Realtime And Calls

- JWT-authenticated Socket.IO namespace `/chat`.
- User and conversation rooms.
- Multi-tab online/offline presence.
- Reconnect conversation sync.
- Direct WebRTC audio calls with mute, end, reject, missed, and history.
- 15-second socket disconnect grace period.
- Call sync/recover and ICE recovery after transient disconnects.
- SDP and ICE content are not written to logs.

### Support And Automation

- User-created support tickets visible only to the requester and admins.
- Admin ticket pool with All/Mine/Unassigned filters.
- Claim, assign, transfer, unassign, status, priority, and admin note flows.
- Optimistic ticket versioning with `409 Conflict` protection.
- Persistent ticket activity history.
- Shared-secret bot API for external groups, participants, messages, settings,
  and manager roles.
- Idempotent `externalRef` behavior with `created` and `reused` metadata.
- Spring Boot Java ticket webhook adapter with validation, timeout, retry,
  health/readiness, and controlled 502 behavior.

### Frontend And Demo

- Chats, Contacts, Calls, Saved Messages, Support, Settings, and Profile tabs.
- Responsive desktop/mobile chat and group detail views.
- Light/dark mode persisted in localStorage.
- Working Help modals for FAQ, Contact, and Terms & Privacy.
- Incoming message popups are intentionally disabled; unread state, open-chat
  updates, badges, and hidden-tab title notifications remain.
- Swagger is intentionally on by default for the demo.

## Latest Post-Handoff Work

Commit `1ed7119` completed previously non-working demo actions:

- Reply persistence in PostgreSQL.
- Forwarded-message persistence.
- Attachment forwarding.
- Copy and mark-unread actions.
- Help menu modals.
- Light/dark theme persistence.
- Additional backend and Playwright coverage.

Commit `8cbdb60` fixed the highest-priority security exposure:

- Removed known default JWT and webhook secrets from Compose.
- Required local random secrets.
- Rejected documented secret placeholders in production.
- Bound backend, Java, and PostgreSQL host ports to loopback.
- Kept only frontend `5173` externally reachable.

Commit `31bfd72` restored demo-friendly defaults:

- Swagger is open by default in Docker Compose.
- Built-in test users remain available.
- Full-stack test uses `emiradmin` instead of the obsolete
  `admin@example.com` assumption.

## Technical PDF

The repository includes a 25-page Turkish technical report:

```text
output/pdf/ello-teknik-dokumani.pdf
```

It documents:

- all application features
- architecture and repository structure
- technology choices and why they were selected
- backend modules and global request pipeline
- PostgreSQL models, enums, relations, and indexes
- complete REST and Socket.IO references
- frontend architecture and UI behavior
- Java webhook flow
- security, Docker, testing, and operations
- development timeline and resolved bugs
- known limitations and recommended roadmap

The PDF was rendered page by page and visually checked. It contains no secret
values.

## Known Limitations

These are not blockers for the demo, but must not be presented as completed
production features:

- Email password reset is not implemented.
- Lock screen is a theme placeholder.
- Video calling is not implemented; an unused template modal exists.
- Privacy/security and theme color/background controls are not persisted to the
  backend. Light/dark mode is persistent.
- Password changes do not revoke already issued JWTs.
- JWT is stored in frontend localStorage.
- Nginx does not yet define a strict application CSP/Permissions-Policy.
- Public STUN works for tested audio paths; production cross-network
  reliability requires authenticated TURN and HTTPS.
- Attachments are stored as PostgreSQL bytes; object storage is preferable at
  larger scale.
- Presence and active call sessions are process-local; horizontal scaling
  requires a shared realtime adapter/state.
- The Create React App dependency chain has audit debt and should be migrated
  deliberately rather than with a forced audit fix.
- Demo passwords are weak by design.

## Temporary Internet Testing

If laptop-to-desktop or different-network testing is needed, expose only the
frontend through a temporary Cloudflare Quick Tunnel:

```powershell
docker run -d --name ello-quick-tunnel `
  cloudflare/cloudflared:latest tunnel --no-autoupdate `
  --url http://host.docker.internal:5173

docker logs ello-quick-tunnel
```

Do not expose backend `3000`, Java `8080`, or PostgreSQL `5432` directly.

Stop public access immediately after testing:

```powershell
docker stop ello-quick-tunnel
```

The public link is temporary. Demo users have weak passwords, so share the URL
only with intended testers.

## Test Accounts

All built-in account passwords are `123456`.

| Automation ID | Username | Email | Global role |
| --- | --- | --- | --- |
| `1` | `emiradmin` | `emiradmin@ello.com` | admin |
| `2` | `emiruser` | `emiruser@ello.com` | user |
| `3` | `asliadmin` | `asliadmin@ello.com` | admin |
| `4` | `asliuser` | `asliuser@ello.com` | user |
| `5` | `gulsimaadmin` | `gulsimaadmin@ello.com` | admin |
| `6` | `gulsimauser` | `gulsimauser@ello.com` | user |

## Next Work

Recommended order on the laptop:

1. Pull `codex/post-handoff-demo-fixes`, not `main`.
2. Verify the ignored root `.env` without printing secrets.
3. Start Docker and wait for all four long-running services to become healthy.
4. Run:

   ```powershell
   npm.cmd run test:full-stack
   ```

5. Manually verify one direct and one group message in two independent browser
   sessions without refresh.
6. Open the technical PDF and confirm it is available for the presentation.
7. Prepare the presentation/demo sequence and a short failure-recovery
   checklist.
8. After the laptop verification, decide whether to open a PR/merge this branch
   into `main`.

Do not start a broad CRA migration, attachment storage rewrite, or distributed
realtime refactor before the presentation unless the user explicitly changes
priority.

## Final Sanity Commands

```powershell
git status --short --branch
docker compose ps
Invoke-RestMethod http://localhost:3000/api/health
Invoke-WebRequest -UseBasicParsing http://localhost:5173/healthz
Invoke-RestMethod http://localhost:8080/health
Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/docs
```
