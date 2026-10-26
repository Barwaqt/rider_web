# Rider CI/CD and Ubuntu setup

Repository: `Barwaqt/rider_web`. Domain: `rider.barwaqt.com`.
Application directory: `/var/www/rider.barwaqt.com`.
PM2 process: `barwaqt-rider`. Next.js listens on `127.0.0.1:3003` behind Nginx.

## First-time setup on Ubuntu

Point the DNS A record for `rider.barwaqt.com` at the VPS public IPv4 address. Only publish an AAAA record if IPv6 is configured for this VPS. Ensure ports 80 and 443 are reachable.

Use the same account that owns the PM2 process (root in the existing VPS setup). Install Node 24 and PM2 for that version, plus the utilities below. If NVM is installed, the deployment script selects Node 24.

```bash
apt-get update
apt-get install -y nginx rsync curl util-linux certbot python3-certbot-nginx
cd /var/www/rider.barwaqt.com
# One-time update to obtain the newly committed deployment files:
git pull origin main
nano .env.local
```

Set production values in `.env.local`:

```dotenv
API_URL=https://api.barwaqt.com/api/v1
APP_ORIGIN=https://rider.barwaqt.com
```

Build and start the rider process:

```bash
npm ci --include=dev
npm run build && test -s .next/BUILD_ID && pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
curl -I http://127.0.0.1:3003/
```

Follow the startup command PM2 prints if needed. If a rider process already occupies port 3003, use that existing process instead of starting another; set the GitHub `PM2_APP_NAME` variable to its exact name. Existing processes must use production `next start`, not `next dev`.

## Nginx and HTTPS

The checked-in config is an initial HTTP server block. If this domain already has an HTTPS configuration, merge the proxy settings into that existing block instead of replacing its certificates. Do not install a second server block for the same domain.

For a new domain configuration:

```bash
cd /var/www/rider.barwaqt.com
cp deploy/rider.barwaqt.com.conf /etc/nginx/sites-available/rider.barwaqt.com
ln -s /etc/nginx/sites-available/rider.barwaqt.com /etc/nginx/sites-enabled/rider.barwaqt.com
nginx -t && systemctl reload nginx
certbot --nginx -d rider.barwaqt.com --redirect
certbot renew --dry-run
curl -I https://rider.barwaqt.com/
```

If the symlink already exists, inspect it and use the existing link rather than recreating it. Certbot configures HTTPS after DNS and HTTP access work. Do not rerun the initial config copy after Certbot has configured TLS. CI/CD does not overwrite `/etc/nginx` or request certificates.

References: [Nginx proxy module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html), [Ubuntu TLS setup](https://ubuntu.com/server/docs/how-to/security/obtain-tls-certificates/).

## GitHub setup

In **Barwaqt/rider_web → Settings → Environments**, open or create `production`. Add these **environment secrets**, using the working VPS credentials:

| Secret | Value |
| --- | --- |
| DEPLOY_HOST | VPS public IP or SSH hostname |
| DEPLOY_USER | PM2 process owner, currently root |
| DEPLOY_SSH_KEY | Complete private SSH key, preserving line breaks |
| DEPLOY_KNOWN_HOSTS | Verified host-key entry matching DEPLOY_HOST and SSH port |

Secrets from the other repositories are not automatically inherited. The corresponding public key must already be authorized for the selected SSH account.

Optional **environment variables**: `PM2_APP_NAME` (default `barwaqt-rider`), `WEB_PORT` (default `3003`, health-check port only), `DEPLOY_PORT` (default SSH port `22`). Changing WEB_PORT does not change Next.js or Nginx; keep all three aligned.

Restrict environment deployment branches to main. Leave required reviewers and wait timers disabled if you want unattended deployment. Protect main with the CI `test` job.

## Automatic deployment

Every push to main runs lint, proxy regression tests and a production build. If successful, it uploads the tested revision, installs dependencies and builds in a temporary VPS directory using copies of existing production env files, synchronizes files, restarts PM2, and checks both the local rider portal and public HTTPS domain. Pull requests only run CI. Manual workflow runs on main also deploy.

The VPS needs writable `/var/www` staging space, enough memory for Next.js builds, and outbound npm/build asset access. Production `NEXT_PUBLIC_*` settings are compiled during the VPS build. `.env*`, `.git` and `uploads/` are preserved. After the health check passes, the deployment also moves the server's Git checkout to the revision it just activated, so `git log` and `git status` on the VPS report what is running. `.deployed-revision` records that revision.

Deployment happens in place with a short restart and no automatic rollback. On failure, inspect Actions and `pm2 logs barwaqt-rider --lines 80 --nostream`. Fix forward or push a reviewed revert. Future releases require no server-side git pull; see the next section to reconcile an existing checkout. This workflow does not change the backend, customer website, vendor console or database.

## Server-side Git checkout

`/var/www/rider.barwaqt.com` is a deployment target. Deployment synchronizes the built release and then, once the health check passes, aligns the checkout with it (`git fetch --prune origin`, then `git reset --hard <revision>`). A checkout on `main` therefore ends every successful deployment clean and on the revision that is actually running. No server-side `git pull` is needed, and `git status` no longer reports deployed files as local modifications.

The sync is best effort: it never fails a healthy deployment, it is skipped when the directory is not a Git checkout, and a failed fetch only prints `Warning: cannot fetch origin; Git checkout left unsynced.` These repositories are public, so the deployment account needs no credentials; for a private remote, give that account read access (a token in the remote URL or a read-only deploy key) to keep the checkout synced.

Only tracked files are touched: production env files, `uploads/` and other untracked runtime files are read-only to the sync. Tracked files that the new revision no longer contains are removed, which is how stale sources get cleaned up. `.deploy.lock` and `.deployed-revision` are runtime files written by `scripts/deploy.sh`, are ignored by Git, and must remain on the server.

Never run `git checkout`, `git restore` or `git stash` in this directory: they write older revisions over the deployed files, and the next build or PM2 restart would serve that older code. If a deployment fails before the sync runs, files may already be newer than the checkout; redeploy from Actions, or align it by hand after checking what is on disk:

```bash
cd /var/www/rider.barwaqt.com
git fetch origin
git diff --stat "$(cat .deployed-revision)"   # empty means disk matches the deployed revision
git reset --hard "$(cat .deployed-revision)"  # only after the diff above is empty
```

## Public request origin

Production requests are checked against `https://rider.barwaqt.com` for CSRF protection, independently of the internal Nginx URL. Set `APP_ORIGIN` to its exact public origin in the frontend production environment file (`.env.local`) and rebuild/restart. When `APP_ORIGIN` is unset, the check falls back to the request `Host` header, which also works behind this Nginx proxy. Missing and foreign Origin headers on mutations remain rejected.
