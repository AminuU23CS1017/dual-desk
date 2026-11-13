# Dual Desk

Published at https://dual-desk-trading.ayomideaminu.chatgpt.site

The user chose public website access. Public visitors can view market charts and token research. Saving a practice account, signals, watchlists, journal and settings requires ChatGPT sign-in. Records are keyed by authenticated user ID and stay separate between users.

## Simple use
1. Choose Forex, Memecoins, Synthetics or Futures.
2. For forex, choose the currency pair. For memecoins, select a trending Solana token or paste its contract address.
3. Read the chart and “Should I buy?” panel.
4. A qualifying forex or futures setup can be tried with practice money. No real order is placed.

## Buy checks
A buy setup requires at least 55 completed 15-minute candles, EMA 20 above EMA 50 and a close above the previous 20-bar high. Stops use 1.5 ATR 14 and targets 2R. Missing/stale quotes and stale candles cannot produce an entry. This strategy is unvalidated and does not establish likely profitability.

Memecoin liquidity below $100,000 produces “Avoid buying for now.” Even when the price rule matches, unverified mint/freeze authority and holder concentration produce “Wait — token checks incomplete.” No automatic memecoin buy signal is generated. Manual practice setups remain available.

## Charts
- Deriv public WebSocket: forex and synthetic candles and ticks.
- GeckoTerminal: real 15-minute USD candles for indexed Solana token pools and trending token selection.
- DEX Screener: token quote, liquidity, volume and pool information.
- Binance/Bybit: public futures prices and candles.

A token may lack indexed history. The site shows the error and pool link, without fabricated prices. The chart provider may use a different pool from the quote provider when the same pool is unavailable.

## Limitations
Practice trades use normalized instrument units and 0.10% fees per side. Broker contract multipliers, spread, funding, liquidation and slippage are not simulated. Only the selected instrument is monitored while the page remains open. Telegram requires server-side bot secrets. Live trading adapters and always-on execution are not connected.

## Validation
TypeScript and production build are required before publishing. Deriv EUR/USD returned 100 candles. Trending tokens loaded and an indexed Solana token returned 100 GeckoTerminal candles. Assessment checks cover missing/stale data, no breakout, buy breakout, low liquidity and unverified token checks. Previously verified paper risk, fees, duplicate rejection, position caps, persistence and authentication remain in place.


Chart update: Deriv forex and Volatility/Boom/Crash instrument lists load from the public active-symbol feed. Futures load the selected exchange's active USDT perpetual catalog; if unavailable, a list of 30 common contracts is shown. Exchange feeds can fail from the hosting region. In that case a labelled TradingView reference chart is displayed and automated buy checks remain unavailable. Contract availability varies; the fallback is not a verified listing.

Memecoins: the first trending Solana token opens automatically as a browsing default, not a recommendation. You can select another token or search by name/symbol, full Solana contract address, or a pump.fun/GMGN token link. Name searches show separate addresses to distinguish duplicate names. New launches may not yet have indexed pool history.

Telegram setup: create a bot with @BotFather, add it to your private group, and send a message in the group. Configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID as server secrets through Sites runtime settings. Set TELEGRAM_ALLOWED_USER_IDS to the authenticated IDs of the two approved accounts; public visitors cannot send messages to your private group. Never put the bot token into the public website or source files. Delivery uses the Send to Telegram button; no background monitoring is active. Test delivery after secrets are configured.

Telegram connection update: approved authenticated emails can be configured with TELEGRAM_ALLOWED_EMAILS, avoiding manual approval-ID copying. Existing ID allowlists remain supported. The Connections panel checks Telegram independently of desk storage and offers an authorized Send test message action. Anonymous and non-approved users cannot send.


## Continuous Telegram monitoring
The Site exposes authenticated MCP tools `read_alert_monitor` and `scan_and_send_alerts`. Install/connect the Site's own plugin as the owner before scheduling. The scanner is authorized by the same approved-account policy as Telegram and reads only that user's first two saved Solana tokens. Defaults also cover EURUSD, GBPUSD, USDJPY, R_75, BOOM1000, CRASH1000, and Bybit BTC/ETH USDT perpetuals on 15m and 1h. Run every 15 minutes after candle close (e.g. minutes 2,17,32,47). No browser or local computer is required after the cloud schedule is connected and verified.
Each run fetches current provider data, evaluates completed candles, sends up to six new research alerts to the existing Telegram group, and records its summary. Alert IDs include strategy version, instrument, timeframe, direction and candle; a database uniqueness constraint prevents repeated delivery. Delivery timeouts are recorded as uncertain and not automatically retried. A five-minute run lock prevents overlapping calls. Provider failures are skipped and reported; no substitute prices are fabricated. Memecoins are watchlist-only alerts until token security is verified. No real orders are placed.
A cloud task should call `read_alert_monitor`, then `scan_and_send_alerts` when enabled, then `read_alert_monitor` to confirm the saved result. Stay quiet for unchanged/no-setup runs; report failures requiring action. Do not edit the Site or publish each run. This document contains no credentials. Scheduling is incomplete until the connected tool has been verified and the cloud schedule has actually been created.

## Strategy v2 and chart timeframes
1m, 5m, 15m, 30m, 1h, 4h and daily charts use matching provider intervals (30m token candles aggregate native 15m OHLC). Completed candles only; EMA20/50 trend and minimum separation, ADX14 >=20, RSI14 50–75 buys/25–50 sells, and 20-bar range breakout. Stops use 1.5 ATR14, targets 2R, entries more than .5 ATR from reference are skipped. Insufficient, missing, nonfinite, stale and incomplete candle data are rejected. These are explainable research filters, not a best-strategy or win-rate claim. Logic tests do not establish profitability; out-of-sample testing with realistic spreads, fees, slippage and forward paper results is still required.


## Interactive charts and account navigation

Charts use TradingView Lightweight Charts with pan, zoom, candle inspection, an expanded view, and an Older candles button. Loaded history stays available while new quotes refresh; change instrument or timeframe to reset it. Charts show UTC; activity records show WAT.

Solana candle data is supplied by GeckoTerminal, with DEX Screener used for token search and quotes. Older candles use the same pool as the initial chart. History availability depends on token age, provider indexing and rate limits. The public API remains the selected feed; no Birdeye subscription or credentials have been added.

Accounts & bots is the dedicated connection hub. Telegram is configured for the approved owner. Deriv Trader, MT5, exchange execution and Solana wallet trading are not implemented yet; provider links are setup documentation, not connected accounts. No live order execution is enabled.


Memecoin display now defaults to DEX Screener’s hosted TradingView chart with GMGN as a selectable alternative. Token identity and pool lookup load first, so GeckoTerminal candle failures cannot block the hosted chart. GeckoTerminal remains the separate analysis feed; an embedded chart does not supply candles to the signal engine. Set the visual chart timeframe inside its toolbar. Reload, expand, and direct-open controls are provided.


## Deriv and Windows MT5 setup (pending user activation)

Accounts & bots now contains the actual connection workflow, restricted to approved signed-in users. Register a Deriv OAuth2 client with the trade scope and this exact callback: https://dual-desk-trading.ayomideaminu.chatgpt.site/api/broker/deriv/callback. Save its public Client ID on the page, then select Connect Deriv and approve on Deriv. Tokens are encrypted server-side per user, expire with the provider session, and are removed by Disconnect. No refresh token is assumed. Accounts are loaded from Deriv; real accounts are view-only. Demo accounts support connection tests, portfolio reads, and an explicit 1-unit Volatility 100 Rise/5-tick test quote and order. This test is not a strategy recommendation. No real WebSocket credentials are returned to the browser.

Download public/downloads/DualDeskBridge.mq5 on Windows, compile with MetaEditor, and install on one MT5 chart. Allow WebRequest to the site and paste the one-time-displayed pairing key into the EA. Keys are stored hashed and bind to the first terminal account/server; switching accounts requires a new key. Real and demo account balances can be monitored, with an offline indicator after 45 seconds.

MT5 automatic trading is demo-only and requires both the website Enable MT5 demo bot switch and the EA AllowDemoAutomation/Algo Trading switches. Closed-bar breakout filters use MT5-native EMA20/50, ADX14, RSI14, ATR14; calculations may differ from the website's indicator initialization. Risk is capped at 0.5% per trade and 3% daily equity loss, with a 10% sizing reserve, broker-calculated lot risk, max3 account positions and refusal to add risk when existing positions lack stops. Stops do not guarantee execution price. The baseline is saved by MT5 broker day from the first bridge run; deposits/withdrawals can affect this equity measure. Failed/uncertain order submissions are not retried for that candle. No entry is sent after a failed heartbeat. Open orders retain broker stops/targets if the bridge disconnects; pausing does not close positions.

Validation outstanding: user application registration/OAuth consent; authenticated Deriv API and demo-order test; MT5 Windows compilation, pairing, strategy-tester review and demo execution. The current Mac environment cannot compile MQL5 or verify a Windows broker terminal. Real execution and unattended Deriv Options automation are not enabled. Do not describe this release as completed live trading.
