# Dhandha Studio — AI Image Generation Backend

Production-ready Node.js backend implementing an asynchronous AI image generation system with Firebase Firestore, Cloudinary, and Google Gemini API.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in your credentials
cp .env.example .env

# 3. Start in dev mode (auto-restart on changes)
npm run dev

# 4. Or start in production
npm start
```

The server runs on `http://localhost:3000` by default.

---

## Environment Setup

### 1. Firebase Firestore

1. Go to [Firebase Console](https://console.firebase.google.com/) → Create or select a project
2. Enable **Firestore Database** (start in production mode)
3. Go to **Project Settings → Service Accounts → Generate New Private Key**
4. Save the JSON file as `serviceAccountKey.json` in the project root
5. Set in `.env`:
   ```
   FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
   ```
6. **Create the `users` collection** with at least one document:
   ```json
   {
     "apiKey": "your-secret-api-key-here",
     "credits": 100,
     "clientId": "your-client-id"
   }
   ```
   The document ID becomes the `user_id`.  
   The `jobs` collection is created automatically on first use.

### 2. Cloudinary

1. Sign up at [cloudinary.com](https://cloudinary.com/)
2. From the Dashboard, copy your **Cloud Name**, **API Key**, and **API Secret**
3. Set in `.env`:
   ```
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=123456789012345
   CLOUDINARY_API_SECRET=your-api-secret
   ```

### 3. Google Gemini API

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Create an API key
3. Set in `.env`:
   ```
   GEMINI_API_KEY=your-gemini-api-key
   ```

---

## API Endpoints

All endpoints (except `/health`) require:
- `Authorization: Bearer <API_KEY>` header
- `X-Client-ID: <client_id>` header
- Optional: `x-instruction` and `x-textoverlay` headers

### Health Check

```
GET /health
```

### Generate Image

```
POST /generate
Content-Type: application/json

{
  "image_b64": "data:image/jpeg;base64,...",
  "model_type": "indian_male_20s",
  "background_theme": "urban_minimalist",
  "clothing_category": "ethnic_wear",
  "lighting_style": "golden_hour"
}
```

**Response (202):**
```json
{
  "status": "queued",
  "job_id": "uuid",
  "credits_remaining": 99,
  "eta_seconds": 45,
  "check_status": "/status/uuid"
}
```

### Refine Image

```
GET /refine/:job_id/:refinement_instructions
```

### Check Status

```
GET /status/:job_id
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Invalid Base64 |
| 401 | Missing Authorization |
| 402 | Insufficient Credits |
| 403 | Invalid API Key |
| 404 | Job Not Found |
| 429 | Rate Limit Exceeded |
| 500 | Server Error |

---

## Architecture

```
src/
  config/         ← External service initialization
  controllers/    ← Request handlers (sync response + async processing)
  middlewares/     ← Auth, rate limiting, error handling
  services/       ← Business logic (credits, jobs, Gemini, Cloudinary)
  routes/         ← Express route definitions
  utils/          ← Helpers (validation, ID generation)
  server.js       ← Entry point
```

### Async Processing Flow

1. Client sends request → server validates, deducts credit, creates job
2. Server responds immediately with `job_id` (HTTP 202)
3. Background: `setImmediate` → Gemini API → Cloudinary upload → Firestore update
4. Client polls `/status/:job_id` until `completed` or `failed`
