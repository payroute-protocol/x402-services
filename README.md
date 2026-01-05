# Payroute API Documentation

This API provides services for registering creators, managing wrapped content, and processing payments (x402) for content access.

## Base URL

`/` (Root where the server is deployed, typically `http://localhost:3000`)

---

## Creator Endpoints

### 1. Register Creator

Registers a new creator by their wallet address.

- **URL**: `/creator/register`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "walletAddress": "string"
  }
  ```
- **Response**:
  - `200 OK`: Returns the created creator object.
  - `400 Bad Request`: Missing wallet address.
  - `409 Conflict`: Creator already exists.

### 2. Get Creator Profile

Retrieves a creator's profile by their ID.

- **URL**: `/creator/:id`
- **Method**: `GET`
- **URL Parameters**:
  - `id` (integer): The ID of the creator.
- **Response**:
  - `200 OK`: Returns the creator profile.
  - `500 Internal Server Error`

### 3. Get All Creators

Retrieves a list of all registered creators.

- **URL**: `/creator/`
- **Method**: `GET`
- **Response**:
  - `200 OK`: Returns an array of creator objects.
  - `500 Internal Server Error`

---

## Wrapped Data Endpoints

### 4. Create Wrapped Content

Creates a new wrapped content entry (gateway) for a creator.

- **URL**: `/creator/wrapped/:creatorId`
- **Method**: `POST`
- **URL Parameters**:
  - `creatorId` (integer): The ID of the creator.
- **Request Body**:
  ```json
  {
    "originalUrl": "string",
    "methods": "string", // e.g., "GET,POST"
    "gatewaySlug": "string",
    "paymentAmount": "string",
    "paymentReceipt": "string",
    "description": "string"
  }
  ```
- **Response**:
  - `201 Created`: Returns success message and new URL.
  - `400 Bad Request`: Missing required fields.
  - `500 Internal Server Error`

### 5. Get Wrapped Data

Retrieves all wrapped methods for a specific creator.

- **URL**: `/creator/wrapped/:idCreator`
- **Method**: `GET`
- **URL Parameters**:
  - `idCreator` (integer): The ID of the creator.
- **Response**:
  - `200 OK`: Returns an array of wrapped data objects.
  - `404 Not Found`: No data found.
  - `500 Internal Server Error`

---

## Payroute (Gateway) Endpoints

### 6. Access Gateway (Direct Payment)

Accesses the wrapped content. Requires payment verification via headers.

- **URL**: `/:gatewaySlug`
- **Method**: `GET` / `POST` / `...` (Matches `originalUrl` method)
- **URL Parameters**:
  - `gatewaySlug` (string): The slug defined when creating wrapped content.
- **Headers**:
  - `x-payment-tx` (string, optional): The transaction hash of the direct payment (Mantle Testnet).
- **Response**:
  - `200 OK`: Proxies the response from the `originalUrl`.
  - `402 Payment Required`: If payment is missing or pending. Returns details needed to pay.
    ```json
    {
      "message": "Payment Required",
      "receiverAddress": "string",
      "transactionId": "string",
      "escrowAddress": "string", // If applicable
      "amount": number,
      "currency": "MUSD",
      "chain": "MANTLE TESTNET",
      "requiredHeader": "x-payment-tx"
    }
    ```
  - `404 Not Found`: Gateway slug not found or Transaction not found.
  - `405 Method Not Allowed`: If the HTTP method is not allowed for this route.
  - `500 Internal Server Error`
