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
    GITHUB_TOKEN=<Github Token>
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

## Rate Limits Endpoints

### **Create a New Rate Limit**

**POST** `/api/rate-limits`

- **Description**: Adds a new rate limit entry.
- **Request Body**:
  ```json
  {
    "key": "string",
    "timestamps": ["number"]
  }
  ```
- **Curl Command**:
  ```bash
  curl -v -X POST http://localhost:3000/api/rate-limits \
  -H "Content-Type: application/json" \
  -d '{"key": "test_key_1", "timestamps": [1635793421]}'
  ```
- **Response**:
  ```json
  {
    "key": "string",
    "timestamps": ["number"]
  }
  ```

### **Get a Rate Limit by Key**

**GET** `/api/rate-limits/:key`

- **Description**: Retrieves the rate limit entry for a specific key.
- **Curl Command**:
  ```bash
  curl -v http://localhost:3000/api/rate-limits/test_key_1
  ```
- **Response**:
  ```json
  {
    "key": "string",
    "timestamps": ["number"]
  }
  ```

### **Update Timestamps for a Rate Limit**

**PUT** `/api/rate-limits/:key`

- **Description**: Updates the timestamps for a specific rate limit key.
- **Request Body**:
  ```json
  {
    "timestamps": ["number"]
  }
  ```
- **Curl Command**:
  ```bash
  curl -v -X PUT http://localhost:3000/api/rate-limits/test_key_1 \
  -H "Content-Type: application/json" \
  -d '{"timestamps": [1635793500]}'
  ```
- **Response**:
  ```json
  {
    "key": "string",
    "timestamps": ["number"]
  }
  ```

### **Create a New Rate Limit Combination**

**POST** `/api/rate-limits-combo`

- **Description**: Adds a new rate limit combination entry. Each combination of `ip_address`, `wallet_address`,
  and `github_userid` is checked for uniqueness before inserting to DB.
- **Request Body**:
  ```json
  {
    "ip_address": "string",
    "wallet_address": "string",
    "github_userid": "string"
  }
  ```
- **Curl Command**:
  ```bash
  curl -v -X POST http://localhost:3000/api/rate-limits-combo \
    -H "Content-Type: application/json" \
    -d '{
      "ip_address": "19216801",
      "wallet_address": "wallet_123",
      "github_userid": "user123"
    }'
  ```
- **Response**:
 ```json
  {
   "id": "3",
  "ip_address":"19216801",
  "wallet_address":"wallet_123",
  "github_userid":"user123"
  }
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

## Error Handling

All endpoints return appropriate HTTP status codes:
- `201 Created` for successful creations.
- `200 OK` for successful data retrieval or updates.
- `404 Not Found` if the requested resource does not exist.
- `500 Internal Server Error` for unhandled exceptions.
