# Faucet Backend API

This API provides endpoints for interacting with two main tables: `faucet.solana_balances` and `faucet.rate_limits`.
Below are the available endpoints for each table.

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

4. **OPTIONAL** In order to test the Github API locally, you need to provide a [Github Personal Access Token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) in your `.env` file. The token only needs `read:user` and `public_repo`
    ```
    GH_TOKEN=<Github Token>
    ```

5. Start the server
   ```bash
   yarn start
   ```

5. Access the API at `http://localhost:3000/api`.

---

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

### **Get All Balances for an Account**

**GET** `/api/solana-balances/account/:account`

- **Description**: Retrieves all balances for a specific Solana account.
- **Curl Command**:
  ```bash
  curl -v http://localhost:3000/api/solana-balances/account/test_account_1
  ```
- **Response**:
  ```json
  [
    {
      "id": 1,
      "account": "string",
      "balance": "number",
      "date": "timestamp"
    }
  ]
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

## Github Validation Endpoints

### **Validate Github User ID**

**GET** `/api/github-validation/:userId`

- **Description**: Validates a Github user by fetching their information from the Github API using their user ID.
- **Request Params**:
    - `userId` (string): The Github User ID to validate.

- **Curl Command**:
  ```bash
  curl -v http://localhost:3000/api/gh-validation/exampleUser 
  ```
-**Response**:
```json
{
  "valid": "boolean"
} 
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
      "ip_address": "192.168.0.1",
      "wallet_address": "wallet_abc",
      "github_id": "user123",
      "timestamp": 1714752000
    }'
  ```
- **Response**:
  ```json
  {
    "signature": "tx_123",
    "ip_address": "192.168.0.1",
    "wallet_address": "wallet_abc",
    "github_id": "user123",
    "timestamp": 1714752000
  }
  ```

---

### **Get the Most Recent Transaction(s)**

**GET** `/api/transactions/last`

- **Description**: Retrieves the most recent transaction(s) matching the given query parameters. You must provide at least one of `wallet_address` or `ip_address`.
- **Query Params**:
    - `wallet_address` (string, optional)
    - `github_id` (string, optional)
    - `ip_address` (string, optional)
    - `count` (number, optional – number of results to return; defaults to 1)

- **Curl Command**:
  ```bash
  curl -v "http://localhost:3000/api/transactions/last?wallet_address=wallet_abc&count=2"
  ```
- **Response** (if found):
  ```json
  [
    {
      "signature": "tx_123",
      "ip_address": "192.168.0.1",
      "wallet_address": "wallet_abc",
      "github_id": "user123",
      "timestamp": 1714752000
    }
  ]
  ```

- **Response** (if not found):
  ```json
  {
    "message": "No transaction found for the given criteria."
  }
  ```

---

### **Delete a Transaction by Signature**

**DELETE** `/api/transactions/:signature`

- **Description**: Deletes a transaction based on its signature.
- **Curl Command**:
  ```bash
  curl -v -X DELETE http://localhost:3000/api/transactions/tx_123
  ```
- **Response** (if deleted):
  ```json
  {
    "signature": "tx_123",
    "ip_address": "192.168.0.1",
    "wallet_address": "wallet_abc",
    "github_id": "user123",
    "timestamp": 1714752000
  }
  ```

- **Response** (if not found):
  ```json
  {
    "message": "Transaction not found"
  }
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
        - Max 200 transactions per IP address (all-time)
        - Max 100 transactions per wallet address (all-time)
        - Max 100 transactions per GitHub ID (all-time)
        - Max 50 transactions for the combination of all three within the last 30 days

- **Request Body**:
  ```json
  {
    "ip_address": "string",
    "wallet_address": "string",
    "github_id": "string"
  }
  ```

- **Curl Command**:
  ```bash
  curl -v -X POST http://localhost:3000/api/validate -H "Content-Type: application/json" -d '{"ip_address": "1234567", "wallet_address": "some_address", "github_id": "54321"}'
  ```

- **Response (Valid)**:
  ```json
  {
    "valid": true,
    "reason": ""
  }
  ```

- **Response (Invalid)**:
  ```json
  {
    "valid": false,
    "reason": "Transaction history is invalid"
  }
  ```


## Error Handling

All endpoints return appropriate HTTP status codes:
- `201 Created` for successful creations.
- `200 OK` for successful data retrieval or updates.
- `404 Not Found` if the requested resource does not exist.
- `500 Internal Server Error` for unhandled exceptions.

