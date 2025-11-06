# OTC Market (Admin-Controlled) — Full-Stack Starter

A production-ready starter for an OTC-style market where an **Admin fully controls price** and market behavior.
- **Real-time candlesticks** powered by a server-side price engine
- **Admin dashboard** to set price, volatility, pump/dump, pause/resume, and switch symbols
- **User trading** with market orders, PnL, trade history
- **Auth** (JWT), **Profile**, **Referral program**, **Leaderboard**
- Modern **React + Vite + Tailwind** frontend with **lightweight-charts** candlestick
- **SQLite** (via `better-sqlite3`) so you can run with zero external DB dependencies

> ⚠️ This is a technical demo. If you plan to accept real money, consult legal/compliance and add risk controls, audits, and disclosures.

## Quick Start

### 1) Server
```bash
cd server
cp .env.example .env
# edit .env as needed
npm install
node src/index.js
```
Server runs at `http://localhost:4000` by default.

### 2) Client
```bash
cd ../client
npm install
npm run dev
```
Frontend runs at the printed Vite URL, typically `http://localhost:5173`.

### 3) Mobile (Expo)
```bash
cd ../mobile
npm install          # already run by create-expo-app
npm run start        # launches Expo Dev Tools
# or: npm run android / npm run ios / npm run web
```
Configure the API base with `EXPO_PUBLIC_API_BASE` or update `app.json > expo.extra.apiBaseUrl`. For Android emulators use `http://10.0.2.2:4000`.
See `mobile/README.md` for platform-specific tooling, Expo Go testing, and EAS build instructions.

## Accounts
- On first run, an **admin** user is created from `.env` values. Default:
  - email: `admin@example.com`
  - password: `Admin#12345`
- You can sign up normal users via the Signup page.

## Admin Dashboard
- Go to **/admin** route in the frontend.
- Use the admin email/password to log in.
- Controls include: set price, set volatility, pump/dump %, pause/resume, symbol selection.
- All actions broadcast live to users (via WebSocket).

## Features Included
- JWT auth, password reset (token printed in server logs for demo).
- User profile (name/handle), editable.
- Referrals: every user has a unique code; signups with `?ref=CODE` attribute the referrer.
- Leaderboard: sorted by realized PnL (sum of closed trades).
- Trading: simple **market order** fill at current price; PnL = (sell - buy) * qty for round-trips.
- Market engine: configurable volatility, 1-second ticks, 1-minute OHLC candles.
- Candlestick API & real-time ticks via Socket.IO.

## Project Structure
```
/server         # Node/Express/Socket.IO backend + SQLite
/client         # React + Vite + Tailwind frontend
/mobile         # Expo React Native app (Android/iOS/Web preview)
```

## Extend & Maintain
- The code is modular (routes grouped by domain). Add routes and DB migrations safely.
- Replace the price engine with external feeds if desired; keep admin overrides.
- Integrate email service for password reset, 2FA, audit alerts, etc.
- Add KYC/AML, rate limits, and escrow if you deploy to production.

## License
MIT — Use freely, attribution appreciated.
# exchanger
