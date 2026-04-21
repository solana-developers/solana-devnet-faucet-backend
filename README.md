# Faucet Backend API

This API provides endpoints for interacting with two main tables: `faucet.transactions` and `faucet.solana_balances`.

See [`docs/API.md`](docs/API.md) for the full endpoint reference.

---
## Development

1. Clone the repository
   ```bash
   git clone <repository-url>
   ```

2. Install dependencies
   ```bash
   yarn install
   ```

3. Copy `.env.example` to `.env` and fill in values.

   **NOTE** to send requests directly to Analytics DB, use the [Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/mysql/sql-proxy):
   ```
   ./cloud-sql-proxy --address 0.0.0.0 --port 5434 <SQL DB Connection String>
   ```

4. Start the server
   ```bash
   yarn start
   ```

5. Access the API at `http://localhost:3000/api`.

6. Run tests
   ```bash
   yarn test
   ```
