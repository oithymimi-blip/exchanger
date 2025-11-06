# Mobile Real-Market Expansion Plan

## 1. Stabilise The Development Loop
- [ ] Confirm backend reachable from emulators (use `EXPO_PUBLIC_API_BASE` or `app.json > expo.extra.apiBaseUrl`).
- [ ] Add `/api/health` endpoint in server to test connectivity.
- [ ] Provide `scripts/dev-mobile.sh` to start server + Expo with sane defaults (`ANDROID_AVD_HOME` exported, Metro cache cleared).

## 2. Activity Logging Foundation
- [ ] Design `activity_log` schema (event id, actor id, action, entity, payload, ip/user agent).
- [ ] Create server middleware to record every authenticated API call (method, route, body snapshot).
- [ ] Emit structured log events for market ticks, orders, binary trades, admin actions.
- [ ] Build `/api/activity` routes with pagination & filters.

## 3. Market Data Service
- [ ] Extract price engine into standalone module with adapters:
  - Simulated engine (current logic).
  - External feed adapter (REST/WebSocket aggregator).
- [ ] Add `market_sources` table to configure symbol -> data source.
- [ ] Cache incoming ticks, persist to `ticks` and `candles` tables with retention policy.
- [ ] Serve `/api/market/state` and `/api/market/candles` from cached store with failover.

## 4. Mobile Feature Parity
- [ ] Forex mode: continue using current stack.
- [ ] Binary mode: **done** (initial ticket + stats) — needs QA & tests.
- [ ] Spot mode: port order book, watchlists, open orders. Reuse REST endpoints from web.
- [ ] Web3 mode placeholder: define MVP (e.g., link external wallet status).

## 5. Charting Upgrade
- [ ] Evaluate `@tradingview/react-native-charts` vs. custom Skia chart (candles, indicators, crosshair).
- [ ] Build chart service hook that multiplexes price feed for all modes.
- [ ] Add drawing/indicator presets (EMA, Bollinger) configurable per user.

## 6. Activity Insights UI
- [ ] Mobile Activity screen summarising recent actions, filter by type, export to CSV (server-generated).
- [ ] Admin mobile view for risk monitoring (largest trades, exposure, log search).

## 7. QA & Tooling
- [ ] Unit/integration tests for logging middleware, price sync.
- [ ] Detox/E2E flows for binary & spot trades.
- [ ] Load-test tick ingestion and logging retention.

## Open Questions
- How real-time data will be sourced (paid feed vs. open API)?
- GDPR/PII requirements for log retention?
- Do we need multi-region replication or single node suffices for now?

---
**Next actionable step**: add `/api/health` and improve server reachability so emulator testing is reliable, then implement logging middleware covering trades/binary endpoints.
