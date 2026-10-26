# Barwaqt Rider Web

Mobile-style Next.js rider portal, port **3003**. Uses the existing Barwaqt server and administrator-created RIDER accounts. No public registration or demo credentials.

## Run

```sh
cd rider_web
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3003. Start the API on port 4000 first. `API_URL` is server-only and defaults to `http://localhost:4000/api/v1`.

## Check the full workflow

1. Admin creates a rider under Riders.
2. Rider logs in here and clicks Start shift (AVAILABLE).
3. Vendor accepts and marks the order Ready for pickup.
4. Admin opens Riders → Ready for dispatch, refreshes, selects this rider and assigns the order.
5. Rider sees the assignment automatically within 15 seconds, or presses Refresh.
6. Open the order, navigate to pickup, and confirm pickup.
7. At the destination, enter the customer's six-digit delivery PIN. For COD, collect the displayed exact amount and confirm collection. For prepaid orders collect zero cash.
8. Confirm delivery. The backend updates the order and makes the rider available.
9. Admin records collected COD remittance in Finance before the rider can end their shift.

Delivery failure requires a reason; dispatch must retry or return failed orders. Busy shifts cannot pause or end. Delivery windows and rider shifts are separate concepts.

## Phone testing

Dev server binds to `0.0.0.0`. Open `http://<your-computer-LAN-IP>:3003` on a phone on the same network. Location sharing requires browser permission and HTTPS (or localhost); ordinary LAN HTTP may block geolocation. Navigation links still work. Location sharing is a deliberate one-time action, not background tracking.

## Security and checks

Authentication tokens stay in HttpOnly rider-specific cookies. The login proxy rejects non-RIDER accounts. API calls use the backend's rider ownership checks. Production requires HTTPS for secure cookies. Password resets are handled through the administrator.

```sh
npm run lint
npx tsc --noEmit
npm run build
npm start
```

History is paginated (20 assignments per page). Shift history uses the backend's latest 100 shifts. This is a browser app, not a native app or an offline/PWA delivery tracker.

## CI/CD and production hosting

Pushes to `main` automatically validate and deploy the rider portal to `/var/www/rider.barwaqt.com`, using PM2 (`barwaqt-rider`) on port 3003 behind Nginx at `https://rider.barwaqt.com`. Follow [Ubuntu, Nginx, HTTPS and GitHub setup](DEPLOYMENT.md) for the first deployment.
