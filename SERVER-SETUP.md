# Rider server setup — rider.barwaqt.com

Run these on the VPS as **root**, in this order.
**One command at a time.** After each command, read the **Expect** line. If you get something else, stop and read the Troubleshooting section at the bottom.

Keep the same SSH window open the whole time — command 2.2 saves a variable that the next commands use.

---

## Part 1 — Put the rider code on the server

### 1.1

```bash
cd /var/www
```

**Expect:** no output.

---

### 1.2

```bash
mv rider.barwaqt.com rider.barwaqt.com.old
```

**Expect:** no output.
This renames the old folder (the Coming Soon files) to `rider.barwaqt.com.old`. Nothing is deleted.
If it says `No such file or directory`, that is fine — just continue.

---

### 1.3

```bash
mkdir rider.barwaqt.com
```

**Expect:** no output.

---

### 1.4

```bash
cd /var/www/rider.barwaqt.com
```

**Expect:** no output.

---

### 1.5

```bash
git clone https://github.com/Barwaqt/rider_web.git .
```

**Expect:** `Cloning into '.'...` and then `done.`

---

### 1.6

```bash
ls
```

**Expect:** you can see `app`, `barwaqt-rider.config.cjs`, `deploy`, `package.json`, `scripts`.

---

### 1.7

```bash
node -v
```

**Expect:** `v24.` something.
If it is not v24, run `nvm install 24` first and then `nvm use 24`.

---

### 1.8

```bash
printf 'API_URL=https://api.barwaqt.com/api/v1\nAPP_ORIGIN=https://rider.barwaqt.com\n' > .env.local
```

**Expect:** no output.

---

### 1.9

```bash
cat .env.local
```

**Expect:** exactly these two lines:

```
API_URL=https://api.barwaqt.com/api/v1
APP_ORIGIN=https://rider.barwaqt.com
```

---

### 1.10

```bash
npm ci --include=dev
```

**Expect:** `added XXX packages`. Takes a minute or two.

---

### 1.11

```bash
npm run build
```

**Expect:** `✓ Compiled successfully` and a route list. Takes 1–3 minutes.

---

### 1.12

```bash
pm2 start barwaqt-rider.config.cjs
```

**Expect:** a PM2 table with the app named `barwaqt-rider` and status `online`.
**This is the command that fixes the failing GitHub Action.**

---

### 1.13

```bash
pm2 save
```

**Expect:** `Successfully saved in ...`

---

### 1.14

```bash
curl -I http://127.0.0.1:3003/
```

**Expect:** `HTTP/1.1 200 OK`.

---

## Part 2 — Point Nginx at the rider app

### 2.1

```bash
grep -Rl 'server_name.*rider.barwaqt.com' /etc/nginx/sites-enabled/ /etc/nginx/conf.d/
```

**Expect:** one file path printed, for example `/etc/nginx/sites-enabled/rider.barwaqt.com`.
If nothing is printed, go to Troubleshooting.

---

### 2.2

```bash
f=$(grep -Rl 'server_name.*rider.barwaqt.com' /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ | head -1)
```

**Expect:** no output. This just remembers the file from 2.1.

---

### 2.3

```bash
echo "$f"
```

**Expect:** the same path you saw in 2.1. If it prints a blank line, re-run 2.2 — your SSH session was probably closed and reopened.

---

### 2.4

```bash
cp "$f" /root/nginx-rider-backup.conf
```

**Expect:** no output. This is your backup of the old Nginx config.

---

### 2.5

```bash
cp /var/www/rider.barwaqt.com/deploy/rider.barwaqt.com "$f"
```

**Expect:** no output. This replaces the Coming Soon page config with the rider proxy config.

---

### 2.6

```bash
cat "$f"
```

**Expect:** a `server { ... }` block containing `server_name rider.barwaqt.com;` and `proxy_pass http://127.0.0.1:3003;`.

---

### 2.7

```bash
nginx -t
```

**Expect:** `syntax is ok` and `test is successful`.
If it fails, stop here and go to Troubleshooting.

---

### 2.8

```bash
systemctl reload nginx
```

**Expect:** no output.

---

### 2.9

```bash
curl -I http://rider.barwaqt.com/
```

**Expect:** `HTTP/1.1 200 OK`. The site is now the rider portal.

---

## Part 3 — HTTPS certificate

### 3.1

```bash
certbot --nginx -d rider.barwaqt.com --redirect
```

**Expect:** `Congratulations!` and `Successfully deployed certificate`.
At the prompts: enter an email if asked, and choose to redirect HTTP to HTTPS.

---

### 3.2

```bash
curl -I https://rider.barwaqt.com/
```

**Expect:** `HTTP/2 200` with no certificate error.

---

### 3.3

```bash
certbot renew --dry-run
```

**Expect:** `Congratulations, all simulated renewals succeeded`.

---

## Part 4 — Re-run the deployment on GitHub

Nothing to run on the server here.

1. Open `https://github.com/Barwaqt/rider_web/actions`
2. Click the top run of **Rider CI and deployment**
3. Click **Re-run all jobs**
4. Both `test` and `deploy` should turn green

---

From now on, **you never run commands on the server again.** Every push to `main` builds the app and restarts `barwaqt-rider` automatically.

---

## Troubleshooting

**2.1 printed nothing.**
The block is somewhere else. Find it:

```bash
grep -Rl 'rider.barwaqt.com' /etc/nginx/
```

Then run 2.2 using that folder:

```bash
f=$(grep -Rl 'rider.barwaqt.com' /etc/nginx/ | head -1)
```

Then carry on from 2.3.

**`nginx -t` says `conflicting server name "rider.barwaqt.com"`.**
Two config files serve this domain. Find the extra one:

```bash
grep -Rl 'server_name.*rider.barwaqt.com' /etc/nginx/sites-enabled/
```

It should print only one file. If it prints two, remove the extra one from `sites-enabled` (leave the file in `sites-available`, just delete the link), then run 2.7 again.

**1.14 does not return 200.**
Read the app log:

```bash
pm2 logs barwaqt-rider --lines 80 --nostream
```

**You want the Coming Soon page files back.**
They are untouched in `/var/www/rider.barwaqt.com.old`.

**You want the old Nginx config back.**

```bash
cp /root/nginx-rider-backup.conf "$f"
```
