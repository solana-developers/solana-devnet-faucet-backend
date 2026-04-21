# Faucet Backend API

This API provides endpoints for interacting with two main tables: `faucet.solana_balances` and `faucet.rate_limits`.

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

3. Set up your `.env` file with the following
   ```env
   POSTGRES_STRING=postgresql://<user>:<password>@<host>:<port>/<database>
   PROJECT_ID=<GCP Project ID>
   ```
   **NOTE** if you want to send request directly to Analytics DB, use [Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/mysql/sql-proxy) to setup a connection
   ```
    ./cloud-sql-proxy --address 0.0.0.0 --port 5434 <SQL DB Connection String>
    ```

4. **OPTIONAL** In order to test the Github API locally, you need to provide one or more [Github Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) in your `.env` file. Tokens only need `read:user` and `public_repo`. Multiple tokens are comma-separated and rotated automatically on rate-limit responses.
    ```
    GH_TOKENS=<token1>,<token2>,...
    ```

5. Start the server
   ```bash
   yarn start
   ```

6. Access the API at `http://localhost:3000/api`.

7. Run tests
   ```bash
   yarn test
   ```
