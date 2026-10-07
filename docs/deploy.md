# Deploy

Three pieces: Postgres on Supabase, the API on Railway, the web app on Netlify. Do them in this order.

## 1. Database (Supabase)

1. Create a project. Choose a region near your users (Singapore if you are in Vietnam).
2. Open the project, then **Connect**. Copy the **Session pooler** connection string (port 5432, host like `aws-0-REGION.pooler.supabase.com`, user `postgres.PROJECTREF`). Add `?sslmode=require` at the end if it is not there.
   - Use the session pooler rather than the direct connection: the direct host can be IPv6 only, which not every network reaches.
   - `sslmode=require` encrypts the connection but does not check the server certificate. For stricter checking use `sslmode=verify-full` with the Supabase CA certificate (see the Supabase docs). That needs the certificate file in the image, so it is not set up here (item L-ssl in `Not Fixed Bugs.md`).
   - The transaction pooler (port 6543) also works. The API detects port 6543 and turns off prepared statements, which that pooler does not support.
3. Keep that string. It is the `DATABASE_URL` secret. Never put it in the repo.

The API creates tables itself: the pre-deploy command in `railway.json` runs the migrations before each deploy.

## 2. Web app on Netlify (first, so you know its URL)

1. New site from Git, pick this repo. Build settings come from `netlify.toml`.
2. Site settings, Environment variables: add `VITE_API_URL` = `https://YOUR-DOMAIN.up.railway.app` (you get the Railway domain in step 3; come back and set it).
3. Note the site URL, for example `https://snapwork.netlify.app`. It is the `WEB_ORIGIN` for the API (no trailing slash, no path).

## 3. API on Railway

Railway runs the API from the Dockerfile. `railway.json` in the repo root holds the settings (Dockerfile path, health check at `/health`, one replica, migrations before each deploy).

1. Railway, **New Project**, **Deploy from GitHub repo**, pick this repo.
2. Open the service, **Settings**:
   - Region: pick the closest one (Southeast Asia, Singapore, if you are in Vietnam).
   - Make sure **Serverless / App Sleeping is OFF**. A sleeping service drops every waiting agent.
   - Replicas: **1** (the config file already says so).
3. **Settings, Networking, Generate Domain.** Note the domain, for example `snapwork-api-production.up.railway.app`.
4. **Variables**, add:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | Supabase session pooler string |
   | `API_PUBLIC_URL` | `https://YOUR-DOMAIN.up.railway.app` |
   | `WEB_ORIGIN` | your Netlify site URL |

   Railway sets `PORT` itself. Do not set it.
5. Redeploy. The first deploy before step 4 fails on purpose: in production the API refuses to start without these three variables.
6. Check it:

```sh
curl https://YOUR-DOMAIN.up.railway.app/health      # {"ok":true}
```

   The service **Logs** tab shows the app's JSON lines with route patterns only, no tokens or message text. Railway's own HTTP request logs are separate and record the full path, which includes the agent token in `/mcp/agt_...` URLs. Treat them as sensitive and do not share screenshots of them. Agents that can send an `Authorization: Bearer` header should use `/mcp` with the header instead of the path.
7. In Netlify set `VITE_API_URL` to the same Railway URL and redeploy the web site.
8. **Content Security Policy.** `netlify.toml` allows the browser to talk only to `https://*.up.railway.app` (plus the site itself). If you give the API your own domain, edit `connect-src` in `netlify.toml` to that domain, or the web app will be unable to reach the API (the browser console shows "Refused to connect").

### Cost

A new Railway account gets a one-time trial credit of 5 USD (it expires after 30 days). After that the Hobby plan is 5 USD per month and includes 5 USD of usage. Check the current prices at https://docs.railway.com/pricing/plans before you rely on this. Supabase and Netlify have free plans.

### Rules for the API service

- **One replica only.** Live streams, waiting agents and rate limits live in that process's memory. Two replicas would split rooms.
- Long-poll waits are at most 50 seconds. Keep them under 60 seconds: proxies commonly close connections that are idle for about a minute.
- The API trusts one proxy hop (`trust proxy 1`). Check on the first deploy that per-IP limits see different visitors as different addresses (item A10 in `Not Fixed Bugs.md`). If everyone looks like one IP, the create-room limit would block all users after 10 rooms an hour.
- In production the API refuses to start without `DATABASE_URL`, `API_PUBLIC_URL` and `WEB_ORIGIN`.

## 4. Smoke test (5 minutes)

1. Open the web site, create a room, bookmark the page.
2. Open the invite link in a private window, join as someone else. Both windows should show each other's messages at once.
3. Connect an agent with the card's command. It should greet within a few seconds.
4. Ask it to do something. An approval card should appear. Approve it from the owner window.
5. The Railway **Logs** tab (the app's own lines) shows requests, and no token or message text anywhere.

## 5. Updating and rolling back

- Update: push to the branch Railway watches. It builds, runs the migrations first, then switches over. If a migration fails, the old version keeps running.
- Roll back: Railway, service, **Deployments**, pick the previous one, **Redeploy**. Migrations are additive, so older code keeps working.
- Rotate the database password in Supabase, then update `DATABASE_URL` in Railway.

## Variables

| Name | Where | Value |
| --- | --- | --- |
| `DATABASE_URL` | Railway | Supabase session pooler string |
| `API_PUBLIC_URL` | Railway | `https://YOUR-DOMAIN.up.railway.app` |
| `WEB_ORIGIN` | Railway | Netlify site URL, the only origin CORS allows |
| `PORT` | set by Railway | do not set |
| `VITE_API_URL` | Netlify | `https://YOUR-DOMAIN.up.railway.app` |

## Not tested

I could not deploy from the build sandbox. `railway.json` and the Dockerfile were checked by simulating the production install and start command, not on Railway itself. Fix anything that differs on the first real deploy and tell me.
