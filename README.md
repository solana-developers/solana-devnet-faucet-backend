# Faucet Backend API

Backend-of-record for the Solana devnet faucet. The [`solana-devnet-faucet`](https://github.com/solana-developers/solana-devnet-faucet) frontend is the only consumer; this service gatekeeps airdrops (validates GitHub eligibility, enforces per-IP / per-wallet / per-GitHub caps plus a 30-day rolling window, records each successful airdrop) and tracks faucet wallet health (periodic on-chain balance snapshots of the three source wallets for the frontend's balance-over-time view).

## Tables

- `faucet.transactions` — one row per successful airdrop (`signature`, `ip_address`, `wallet_address`, `github_id`, `timestamp`). Read by `POST /validate` and `GET /transactions/last` to enforce rate limits; written by `POST /transactions`.
- `faucet.solana_balances` — on-chain balance snapshots of the faucet's source wallets. Written by a cron-style monitor job (`POST /solana-balances`) and read by the balances UI (`GET /solana-balances/recent`).

See [`docs/API.md`](docs/API.md) for the full endpoint reference.

---

## Development with Docker (recommended)

Spin up the API plus an ephemeral Postgres in one command:

```bash
docker compose up --build
```

- API listens on `http://localhost:3000/api`. Google-token auth is bypassed automatically because compose sets `POSTGRES_STRING` (see `src/routes/middleware/authorization.js`).
- Postgres is exposed on host port `5433` — user/password/database are all `faucet`. Connect with `psql postgres://faucet:faucet@localhost:5433/faucet` to inspect.
- Schema from `docker/init.sql` is applied on first boot.
- `src/` and `app.js` are bind-mounted read-only and the container runs under `node --watch`, so file edits reload without a rebuild.
- `GH_TOKENS` is passed through from your host env if set; without it, `/validate` and the GitHub check will error at request time (the app still boots fine).

Teardown:

```bash
docker compose down        # stop containers, keep the Postgres volume
docker compose down -v     # also wipe the Postgres volume for a clean slate
```

---

## Development (native)

Use this path if you want to run the API directly against your own Postgres (or the Cloud SQL Auth Proxy).

1. Clone the repository
   ```bash
   git clone <repository-url>
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and fill in values.

   **NOTE** to send requests directly to Analytics DB, use the [Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/mysql/sql-proxy):
   ```
   ./cloud-sql-proxy --address 0.0.0.0 --port 5434 <SQL DB Connection String>
   ```

4. Start the server
   ```bash
   npm start
   ```

5. Access the API at `http://localhost:3000/api`.

## Tests

```bash
npm test              # unit tests — fast, no external dependencies
npm run test:e2e      # end-to-end tests — spin up an ephemeral Postgres via testcontainers (requires Docker)
```
