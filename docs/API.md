# Faucet Backend API

This API provides endpoints for interacting with two main tables: `faucet.transactions` and `faucet.solana_balances`.

## Solana Balances Endpoints

### **Create a New Solana Balance**

**POST** `/api/solana-balances`

- **Description**: Adds a new Solana account balance.
- **Request Body**:
  ```json
  {
    "account": "string",
    "balance": "number"
  }
  ```
- **Curl Command**:
  ```bash
  curl -v -X POST http://localhost:3000/api/solana-balances \
  -H "Content-Type: application/json" \
  -d '{"account": "test_account_1", "balance": 100.50}'
  ```
- **Response**:
  ```json
  {
    "id": 1,
    "account": "string",
    "balance": "number",
    "date": "timestamp"
  }
  ```

### **Get Recent Balances (Last Month)**

**GET** `/api/solana-balances/recent`

- **Description**: Retrieves all Solana account balances from the past month, ordered by date.
- **Curl Command**:
  ```bash
  curl -v http://localhost:3000/api/solana-balances/recent
  ```
- **Response**:
  ```json
  [
    {
      "account": "string",
      "balance": "number",
      "date": "timestamp"
    }
  ]
  ```

---

## Transactions Endpoints

### **Create a New Transaction**

**POST** `/api/transactions`

- **Description**: Creates a new transaction entry with a unique signature.
- **Request Body**:
  ```json
  {
    "signature": "string",
    "ip_address": "string",
    "wallet_address": "string",
    "github_id": "string (optional)",
    "timestamp": "number"
  }
  ```
- **Curl Command**:
  ```bash
  curl -v -X POST http://localhost:3000/api/transactions \
    -H "Content-Type: application/json" \
    -d '{
      "signature": "tx_123",
      "ip_address": "19216801",
      "wallet_address": "11111111111111111111111111111111",
      "github_id": "54321",
      "timestamp": 1714752000
    }'
  ```
- **Response**:
  ```json
  {
    "signature": "tx_123",
    "ip_address": "19216801",
    "wallet_address": "11111111111111111111111111111111",
    "github_id": "54321",
    "timestamp": 1714752000
  }
  ```

---

### **Get the Most Recent Transaction(s)**

**GET** `/api/transactions/last`

- **Description**: Retrieves the most recent transaction(s) matching any of the given identifiers. Both `wallet_address` and `ip_address` are required; `github_id` is optional and broadens the match when supplied.
- **Query Params**:
    - `wallet_address` (string, required)
    - `ip_address` (string, required)
    - `github_id` (string, optional)
    - `count` (number, optional – number of results to return; defaults to 1)

- **Curl Command**:
  ```bash
  curl -v "http://localhost:3000/api/transactions/last?wallet_address=11111111111111111111111111111111&ip_address=19216801&count=2"
  ```
- **Response** — `200`. Returns an array of matching rows (empty when nothing matches):
  ```json
  [
    {
      "signature": "tx_123",
      "ip_address": "19216801",
      "wallet_address": "11111111111111111111111111111111",
      "github_id": "54321",
      "timestamp": 1714752000
    }
  ]
  ```

---

### **Validate User Information**

**POST** `/api/validate`

- **Description**: Validates a GitHub account and checks the transaction history for the given IP address, wallet address, and GitHub ID.

  #### Validation Criteria:
    - **GitHub Account**
        - Must be at least 30 days old
        - Must have at least 1 public repository
        - Must be of type `User`

    - **Transaction Limits**
        - Max 300 transactions per IP address (all-time)
        - Max 200 transactions per wallet address (all-time)
        - Max 200 transactions per GitHub ID (all-time)
        - Max 100 transactions for the combination of all three within the last 30 days

- **Request Body** (all fields required):
  | Field | Format |
  |---|---|
  | `ip_address` | Opaque client identifier, 1–45 chars (the faucet sends the IP with delimiters stripped, e.g. `19216811`) |
  | `wallet_address` | Solana base58 public key (32–44 chars, excludes `0 O I l`) |
  | `github_id` | Numeric string, ≤ 20 chars |

  Unknown body fields are rejected.
  ```json
  {
    "ip_address": "string",
    "wallet_address": "string",
    "github_id": "string"
  }
  ```

- **Curl Command**:
  ```bash
  curl -v -X POST http://localhost:3000/api/validate -H "Content-Type: application/json" -d '{"ip_address": "1234567", "wallet_address": "11111111111111111111111111111111", "github_id": "54321"}'
  ```

- **Response (Valid)** — `200`:
  ```json
  {
    "valid": true
  }
  ```

- **Response (Rejected by validation rules)** — `200`:
  ```json
  {
    "valid": false,
    "reason": "IP address limit exceeded"
  }
  ```
  Possible `reason` values include: `IP address limit exceeded`, `Wallet address limit exceeded`, `Github ID limit exceeded`, `Monthly request limit exceeded`, `Unable to verify transaction history`, `Github account not found`, `Github account type is not allowed`, `Github account is too new`, `Github account has too few public repos`, `Github account has too few followers`.

- **Response (Bad input)** — `400`:
  ```json
  {
    "error": "Validation failed",
    "details": [
      { "path": "wallet_address", "message": "must be a valid Solana base58 address (32–44 chars)" },
      { "path": "github_id", "message": "must be a numeric GitHub user ID" }
    ]
  }
  ```
  `details` lists every failing field; `path` identifies the offending field.


## Error Handling

All endpoints return appropriate HTTP status codes:
- `201 Created` for successful creations.
- `200 OK` for successful data retrieval or updates.
- `400 Bad Request` for missing, mistyped, or oversized request fields. All `400` responses share the shape shown under [`POST /api/validate`](#response-bad-input--400) — `{ "error": "Validation failed", "details": [{ "path", "message" }] }` — listing every offending field across body / query / params.
- `404 Not Found` if the requested resource does not exist.
- `429 Too Many Requests` from `POST /api/validate` when GitHub itself rate-limits us across all configured tokens. Includes a `Retry-After` header.
- `503 Service Unavailable` from `POST /api/validate` when we couldn't reach a verdict because the GitHub client failed (invalid PAT, GitHub outage, network error, missing `GH_TOKENS`). Body: `{ "valid": false, "reason": "Identity provider unavailable." }`. Distinct from `500` so the frontend can prompt a retry instead of treating it as a server bug.
- `500 Internal Server Error` for unhandled exceptions.
