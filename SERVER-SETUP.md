# Rider server setup — rider.barwaqt.com

Run these on the VPS as **root**, in this order.
**One command at a time.** After each command, read the **Expect** line. If you get something else, stop and read the Troubleshooting section at the bottom.

The `coming-soon`, `api.barwaqt.com`, `app.barwaqt.com`, `console.barwaqt.com` and `stagging.barwaqt.com` Nginx files are **separate setups**. Do not edit or delete them. This guide only **adds** a new file called `rider.barwaqt.com`.

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
This renames the old folder to `rider.barwaqt.com.old`. Nothing is deleted.
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

## Part 2 — Create the Nginx site file for rider.barwaqt.com

There is no `rider.barwaqt.com` file yet. These commands create it. Your other site files are left alone.

### 2.1

```bash
cd /etc/nginx/sites-available
```

**Expect:** no output.

---

### 2.2

```bash
ls /var/www/rider.barwaqt.com/deploy/rider.barwaqt.com
```

**Expect:** the same path printed back.
If it says `No such file or directory`, Part 1 did not finish — run 1.5 again.

---

### 2.3

```bash
cp /var/www/rider.barwaqt.com/deploy/rider.barwaqt.com /etc/nginx/sites-available/rider.barwaqt.com
```

**Expect:** no output. This creates the file `rider.barwaqt.com`.

---

### 2.4

```bash
cat /etc/nginx/sites-available/rider.barwaqt.com
```

**Expect:** a `server { ... }` block containing `server_name rider.barwaqt.com;` and `proxy_pass http://127.0.0.1:3003;`.

---

### 2.5

```bash
ln -s /etc/nginx/sites-available/rider.barwaqt.com /etc/nginx/sites-enabled/rider.barwaqt.com
```

**Expect:** no output. If it says `File exists`, the link is already there — just continue.

---

### 2.6

```bash
ls -l /etc/nginx/sites-enabled/
```

**Expect:** a line like `rider.barwaqt.com -> /etc/nginx/sites-available/rider.barwaqt.com`.

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

**Expect:** `HTTP/1.1 200 OK`.
If it still shows the Coming Soon page, go to Troubleshooting.

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

**`nginx -t` says `conflicting server name "rider.barwaqt.com"`.**
Another config file also declares this domain. Find it:

```bash
grep -Rn 'rider.barwaqt.com' /etc/nginx/
```

Every line except `/etc/nginx/sites-available/rider.barwaqt.com` is a conflict. Remove the domain name from that other file's `server_name` line (leave its other names in place), then run 2.7 again. Do not delete the other file.

**2.9 still shows the Coming Soon page.**
The same cause as above — another block is winning. Run the `grep -Rn` command above and send me the output.

**1.14 does not return 200.**
Read the app log:

```bash
pm2 logs barwaqt-rider --lines 80 --nostream
```

**You want the old folder files back.**
They are untouched in `/var/www/rider.barwaqt.com.old`.

**You want to remove this new Nginx file again.**

```bash
rm /etc/nginx/sites-enabled/rider.barwaqt.com
```

```bash
rm /etc/nginx/sites-available/rider.barwaqt.com
```
