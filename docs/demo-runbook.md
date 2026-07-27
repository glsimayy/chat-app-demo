# ellO Presentation And Demo Runbook

This runbook is for the v0.1 technical presentation and live demo. It avoids
destructive resets and keeps recovery steps short enough to use during a
presentation.

## 1. Preflight

Run from the repository root at least 10 minutes before the presentation:

```powershell
git switch codex/post-handoff-demo-fixes
git pull --ff-only origin codex/post-handoff-demo-fixes
docker compose up -d --build
docker compose ps
npm.cmd run test:full-stack
```

Expected:

- `backend`, `frontend`, `java-webhook`, and `postgres` are `healthy`.
- `migrate` and `built-in-users-bootstrap` finish with exit code `0`.
- The full-stack script returns `"ok": true`.

Open and keep these pages ready:

- Application: `http://localhost:5173`
- Swagger: `http://localhost:3000/api/docs`
- Technical report: `output/pdf/ello-teknik-dokumani.pdf`

Use separate browser origins for two independent local sessions:

- Admin session: `http://localhost:5173`
- User session: `http://127.0.0.1:5173`

Suggested accounts:

| Session | Email | Password |
| --- | --- | --- |
| Admin | `emiradmin@ello.com` | `123456` |
| User 1 | `asliuser@ello.com` | `123456` |
| User 2 / phone | `gulsimauser@ello.com` | `123456` |

Do not show the root `.env`, JWTs, webhook secrets, or Docker environment
output on the projector.

## 2. Suggested Demo Sequence

Target duration: 10-12 minutes.

### A. Product And Architecture - 60 seconds

Explain the complete request path:

```text
React/Nginx -> NestJS -> PostgreSQL
                  |
                  +-> Socket.IO realtime
                  +-> WebRTC signaling
                  +-> Spring Boot webhook adapter
```

Mention that frontend, API proxy, database migration, fixed demo users, and the
Java adapter start together through Docker Compose.

### B. Authentication And Roles - 60 seconds

1. Log in as `emiradmin`.
2. Show the admin role and Support area.
3. Log in independently as `asliuser`.
4. Show that the regular user does not receive admin-only controls.

### C. Direct Realtime Messaging - 90 seconds

1. Open the same direct conversation in both sessions.
2. Send one message from admin to user.
3. Confirm it appears without refresh and only once.
4. Reply from the user.
5. Edit or delete one sender-owned message and show the realtime update.

### D. Search, Saved Message, And Attachment - 90 seconds

1. Send a uniquely searchable message.
2. Search for it and jump to the focused message.
3. Bookmark the message and open it from Saved Messages.
4. Send a small image/file and open its authenticated preview.

### E. Group Policies And Manager Chat - 90 seconds

1. Open an existing group or create a new admin-managed group.
2. Show owner, manager, and member roles in Group Info.
3. Toggle the member message policy and show the composer updating.
4. Switch between Group Chat and the private Manager Chat.
5. Mention owner transfer, leave policy, and participant removal.

### F. Automation Bot Through Swagger - 2 minutes

1. Open `POST /api/bot/groups`.
2. Read the active `x-bot-secret` before the presentation and keep it outside
   the projected screen.
3. Use a unique `externalRef`, for example:

   ```text
   presentation-20260727-01
   ```

4. Create a group with built-in automation IDs.
5. Copy the returned conversation ID.
6. Use `POST /api/bot/groups/{conversationId}/messages`.
7. Confirm the bot group and message appear without refresh.
8. Repeat the create request with the same `externalRef` and explain the
   `created` / `reused` idempotency result.

### G. Support Ticket Coordination - 90 seconds

1. Create a ticket from a regular user.
2. Show the admin All/Mine/Unassigned filters.
3. Claim or assign the ticket.
4. Change priority/status and add an admin note.
5. Mention optimistic version checks that prevent two admins from silently
   overwriting each other.

### H. Audio Call - 60 seconds

1. Keep both users online.
2. Start an audio call.
3. Accept, confirm two-way sound, mute/unmute, and end the call.
4. Open Calls and show persisted status/duration.

For different-network audio testing, use HTTPS and authenticated TURN. The
public STUN-only configuration is acceptable for the already verified demo
path but is not a production reliability claim.

### I. Close - 30 seconds

Open the technical PDF and summarize:

- Persistent relational state and authorization live in NestJS/PostgreSQL.
- Socket.IO distributes realtime state.
- WebRTC carries audio.
- Spring Boot adapts an external ticket system.
- Automated tests verify the same Docker stack used in the demo.

## 3. Failure Recovery

### Application does not open

```powershell
docker compose ps
docker compose up -d
```

If a service is unhealthy:

```powershell
docker compose logs --tail 100 backend
docker compose logs --tail 100 frontend
docker compose logs --tail 100 java-webhook
```

Do not run `docker compose down -v`; it deletes the PostgreSQL volume.

### Backend health returns 404

Use the complete URL:

```text
http://localhost:3000/api/health
```

The frontend itself is `http://localhost:5173`.

### Login fails

1. Confirm the email/password from the table above.
2. Check that `built-in-users-bootstrap` exited with code `0`:

   ```powershell
   docker compose ps -a
   ```

3. Re-run only the idempotent bootstrap if needed:

   ```powershell
   docker compose run --rm built-in-users-bootstrap
   ```

### Too Many Requests

- Stop repeated clicks/requests.
- Wait for the displayed Retry-After countdown.
- Do not restart or reset the database for a rate-limit response.

### Message does not appear immediately

1. Confirm both views show `Realtime connected`.
2. Wait briefly for automatic Socket.IO reconnect.
3. Refresh only after noting the realtime failure for later investigation.
4. The REST fallback should preserve a sent message even if the socket drops.

### Swagger bot request returns 401

- The `x-bot-secret` header is missing or does not match the backend.
- Retrieve the local value privately:

  ```powershell
  docker inspect chat-app-demo-backend-1 `
    --format '{{range .Config.Env}}{{println .}}{{end}}' |
    Select-String '^BOT_WEBHOOK_SECRET='
  ```

- Never paste the secret into chat, documentation, screenshots, or commits.

### Bot create request returns an existing group

- Check `externalRef`.
- Repeating the same value is intentionally idempotent.
- Use a new `externalRef` only when the external event represents a genuinely
  new group.

### Audio call does not connect

1. Confirm both users are online and the browser has microphone permission.
2. End the call cleanly and retry once.
3. Use the same-LAN verified path for the live presentation.
4. Do not repeatedly retry a failing cross-network path; explain the documented
   TURN requirement and continue with Calls history.

### Docker Desktop is unavailable

1. Start Docker Desktop.
2. Wait until the engine reports running.
3. Run:

   ```powershell
   docker compose up -d
   docker compose ps
   ```

## 4. Post-Demo

Stop a temporary public tunnel immediately:

```powershell
docker stop ello-quick-tunnel
```

The normal Docker stack may remain running for local testing. To stop it
without deleting data:

```powershell
docker compose stop
```

Before committing any later work:

```powershell
git status --short --branch
```

Do not stage unrelated user-owned output files.
