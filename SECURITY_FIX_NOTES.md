# Security fix — rollout steps

These changes are staged in the working tree but **nothing has been applied to a
running stack**. Follow the steps in order; step 1 must happen *before* the
restart in step 2, or the backend will not be able to authenticate.

## Why step 1 is necessary

`MONGO_INITDB_ROOT_USERNAME` / `MONGO_INITDB_ROOT_PASSWORD` are honoured **only
when MongoDB initialises an empty `/data/db`**. The `mongodb_data` volume
already contains data, so the entrypoint skips user creation entirely. Setting
those variables and restarting would leave you with a stack that *looks*
configured but has no root user — and, once `--auth` is on, no way for the
backend to connect.

So the root user has to be created by hand, once, against the currently
unauthenticated instance.

---

## Step 1 — create the root user (before restarting)

While the stack is still running **without** auth. Run this from the directory
holding `docker-compose.yml` and `.env`, so the credentials are read from `.env`
rather than typed out (no secret ends up in your shell history):

```bash
set -a; . ./.env; set +a
docker exec -i proxmox-ai-mongodb mongo admin --eval \
  "db.createUser({user:\"$MONGO_ROOT_USERNAME\",pwd:\"$MONGO_ROOT_PASSWORD\",roles:[{role:\"root\",db:\"admin\"}]})"
```

`mongo` (not `mongosh`) is correct for the `mongo:4.4` image. Expect
`Successfully added user`. If it reports the user already exists, skip ahead.

## Step 2 — apply the config and restart

```bash
docker compose up -d --force-recreate mongodb backend frontend
```

## Step 3 — verify auth is actually enforced

Unauthenticated access must now fail:

```bash
docker exec -it proxmox-ai-mongodb mongo --quiet --eval 'db.adminCommand({listDatabases:1})'
```

Expect a failure mentioning `not authorized` / `command listDatabases requires
authentication`. **If this succeeds, auth is not on — stop and investigate.**

Authenticated access must succeed:

```bash
set -a; . ./.env; set +a
docker exec -i proxmox-ai-mongodb mongo admin --quiet \
  -u "$MONGO_ROOT_USERNAME" -p "$MONGO_ROOT_PASSWORD" \
  --eval 'db.adminCommand({listDatabases:1}).databases.map(d=>d.name)'
```

And confirm the backend came up clean (it now refuses to start without
`JWT_SECRET`, so a crash loop here means `.env` was not picked up):

```bash
docker compose logs --tail=40 backend
```

---

## Step 4 — invalidate the old sessions

`JWT_SECRET` changed, so every existing session token is now invalid. That is
intentional: tokens minted with the old, publicly-known secret must stop
working. Everyone will be logged out and needs to sign in again.

## Step 5 — rotate the Proxmox root password (do not skip)

The old password was readable by anyone who could reach port 27017, and it is
still valid on the Proxmox host until you change it there. Rotate it on the
host itself:

```bash
ssh root@192.168.1.56 passwd
```

## Step 6 — switch to key-based auth

The backend now uses a stored `private_key` in preference to a stored password
everywhere it connects (see below). To move over:

1. Generate a dedicated key — no passphrase, since the backend loads it
   unattended:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/proxmox_ai_assistant -C "proxmox-ai-assistant" -N ""
   ```
2. Install the public half on the Proxmox host:
   ```bash
   ssh-copy-id -i ~/.ssh/proxmox_ai_assistant.pub root@192.168.1.56
   ```
3. In the app, under **Settings → SSH Configuration**, paste the *private* half
   into the private key field and **clear the password field**.
4. Verify a connection works, then consider setting
   `PermitRootLogin prohibit-password` in the host's `/etc/ssh/sshd_config` so
   password auth cannot be used at all.

---

## What changed in the code

`private_key` was already stored, already returned by `get_ssh_credentials()`,
and already used by `portainer_tunnel_manager.py` and 12 call sites in
`server.py`. It was **not** an unused field — it was wired up in most places and
silently ignored in eight others, which fell back to password-only or to keys
inside the backend container.

Those eight now go through two shared helpers in `backend/server.py`:

- `load_ssh_private_key()` — loads a key of any supported type (Ed25519, RSA,
  ECDSA, DSS), replacing a bare-`except` RSA-only block that was copy-pasted 14
  times.
- `ssh_connect()` — connects preferring key → password → container agent, and
  returns which method was used for logging.

Converted call sites: Proxmox `lspci`/GPU discovery, the SSH health check, the
shared SSH client factory, container `docker exec`, and the three WebSocket
terminal paths (Docker host, VM/LXC console, Proxmox host shell).

### Known remaining gap

`execute_ssh_command()` in `backend/server.py` still hardcodes
`username='root'` with `look_for_keys=True` and takes no user context, so it
cannot consult stored credentials at all. Fixing it means threading a user or
config through its signature — left alone deliberately rather than changed
blind. It is unrelated to the plaintext-password issue but worth its own pass.
