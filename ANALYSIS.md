# Dhandha Studio — Codebase Analysis (Phase 1)

**Date:** 2026-03-01  
**Scope:** Backend + Client architecture, generation pipeline, dashboards, auth, credits, roles

---

## 1. Current Backend Architecture

| Component | Status | Location |
|-----------|--------|----------|
| Entry point | ✅ Express 4.x | `src/server.js` |
| Routes | ✅ Modular | `src/routes/*.js` |
| Controllers | ✅ Separated | `src/controllers/*.js` |
| Services | ✅ Layered | `src/services/*.js` |
| Middleware | ✅ Auth, rate limit, error | `src/middlewares/*.js` |
| Config | ✅ Externalized | `src/config/*.js` |

**Server flow:** dotenv → helmet, cors, morgan, json, rateLimiter → routes → 404 → errorHandler

---

## 2. Service Flow (Generation Pipeline)

```
User Request (POST /generate)
   ↓
(1) validateBase64, validateConfig, applyRules
   ↓
(2) validateAndDeductCredit (sync, before 202)
   ↓
(3) uploadBase64 → Cloudinary
   ↓
(4) createJob (pipelineStage: intake)
   ↓
202 Response
   ↓
[ASYNC] setImmediate:
   (5) Gemini Image Analysis (ALWAYS)
   (6) Gemini Instruction Refinement (CONDITIONAL — if instruction exists)
   (7) Prompt Compilation
   (8) KIE generateImage (PRIMARY ENGINE)
   (9) uploadBuffer → Cloudinary
   (10) updatePipelineStage(completed|failed)
```

✅ **Correct:** Gemini = preprocessing only. KIE = only image generator.  
✅ **Correct:** Instruction fallback — if missing, uses `imageAnalysis.garmentDescription`.

---

## 3. Existing Dashboards

| Dashboard | Routes | Backend | Frontend |
|-----------|--------|---------|----------|
| **Admin** | `/admin/*` | adminController, adminRoutes | admin/*.jsx |
| **User (B2C)** | `/user/*` | userController, userRoutes | user/*.jsx |
| **Client (B2B)** | `/client/*` | clientController, clientRoutes | client/*.jsx |

**Layout:** Shared `DashboardLayout.jsx` with role switcher (admin | user | client).

---

## 4. Authentication System

| Aspect | Implementation |
|--------|-----------------|
| Header | `Authorization: Bearer <API_KEY>` |
| Lookup | `creditService.findUserByApiKey(apiKey)` → Firestore `users` |
| Attach | `req.user = { userId, apiKey, credits, clientId, role }` |
| Optional | `X-Client-ID`, `X-Instruction`, `X-TextOverlay` |

⚠️ **Issue:** When `apiKey` is empty after trim (e.g. client sends `Bearer ` or `Bearer`), middleware returns:
> "Authorization header must be in format: Bearer <API_KEY>. Received: Bearer"

Root cause: `RefundsPage.jsx` (and possibly others) use `Bearer ${localStorage.getItem('ds_api_key') || ''}` — when key is empty, sends `Bearer ` which fails regex. No explicit empty-key rejection before Firestore lookup.

❌ **Missing:** API key validation middleware (explicit empty-key check).  
❌ **Missing:** Environment variable validation on server start (KIE validates on import; others load lazily).

---

## 5. API Routes

| Method | Path | Auth | Role |
|--------|------|------|------|
| GET | `/health` | No | — |
| POST | `/generate` | Yes | Any |
| GET | `/status/:job_id` | Yes | Any |
| GET | `/admin/stats` | Yes | admin |
| GET | `/admin/users` | Yes | admin |
| GET | `/admin/clients` | Yes | admin |
| GET | `/admin/refunds` | Yes | admin |
| POST | `/admin/refunds/:id/approve` | Yes | admin |
| POST | `/admin/refunds/:id/reject` | Yes | admin |
| POST | `/admin/credits/adjust` | Yes | admin |
| GET | `/user/profile` | Yes | user, admin |
| PUT | `/user/profile` | Yes | user, admin |
| GET | `/user/history` | Yes | user, admin |
| GET | `/user/credits` | Yes | user, admin |
| POST | `/user/refund` | Yes | user, admin |
| GET | `/client/keys` | Yes | client, admin |
| POST | `/client/keys` | Yes | client, admin |
| POST | `/client/keys/:id/rotate` | Yes | client, admin |
| GET | `/client/analytics` | Yes | client, admin |
| GET | `/client/billing` | Yes | client, admin |
| GET | `/client/jobs` | Yes | client, admin |

---

## 6. Generation Pipeline (Detailed)

| Step | Service | Notes |
|------|---------|-------|
| 1 | `geminiAnalysisService.analyzeImage()` | Always runs |
| 2 | `geminiInstructionService.processInstruction()` | If instruction exists → refine; else → use analysis |
| 3 | `promptCompiler.compilePrompt()` | Builds master prompt object |
| 4 | `kieService.generateImage()` | Submit → poll → download |

✅ KIE is the only image generator. No direct Gemini image generation.

---

## 7. Environment Configuration

| Variable | Validated at | Notes |
|----------|--------------|-------|
| `KIE_API_URL` | kie.js import | Throws if missing |
| `KIE_API_KEY` | kie.js import | Throws if missing |
| `FIREBASE_*` | firebase.js init | Throws if missing |
| `GEMINI_API_KEY` | — | ❌ Not validated on startup |
| `CLOUDINARY_*` | — | ❌ Not validated on startup |

---

## 8. Credit System

| Feature | Status |
|---------|--------|
| Lookup by API key | ✅ |
| Atomic deduction (transaction) | ✅ |
| Admin adjust | ✅ |
| Refund request (user) | ✅ |
| Refund approve/reject (admin) | ✅ |
| **Credit rollback on generation failure** | ❌ **Missing** |

When async pipeline fails, credits are NOT refunded. User loses 1 credit even if KIE/Gemini fails.

---

## 9. Role Handling

| Role | Stored | Middleware | Access |
|------|--------|------------|--------|
| `user` | `users.role` (default) | `requireRole('user','admin')` | /user/*, /generate, /status |
| `client` | `users.role` | `requireRole('client','admin')` | /client/*, /generate, /status |
| `admin` | `users.role` | `requireRole('admin')` | All routes |

✅ Role-based access is implemented. Dashboards share backend with role checks.

---

## 10. Aspect Ratio

| Field | Status |
|------|--------|
| `aspectRatio` in config | ✅ Supported |
| Allowed values | `1:1`, `3:4`, `4:5`, `16:9`, `9:16`, `custom` |
| Validation | `configValidator` + `featureCatalog.ASPECT_RATIOS` |
| Prompt builder | `promptCompiler` uses `calculateDimensions` |
| KIE payload | Dimensions passed in prompt object |

✅ **Complete.** No changes needed for aspect ratio.

---

## Summary: What Exists / Incorrect / Missing

### ✅ What Already Exists

- KIE-centric pipeline (Gemini preprocessing, KIE generation)
- Instruction fallback (analysis → instruction when user instruction empty)
- Three dashboards (admin, user, client) with role-based routing
- Credit deduction, admin adjust, refund request/approve/reject
- Aspect ratio support (1:1, 3:4, 4:5, 16:9, 9:16, custom)
- KIE service with submit/poll/download
- Centralized error handler
- Health check (`/health`)
- Rate limiting, helmet, CORS

### ⚠️ What Is Incorrect

1. **Authorization header error** — Empty API key sends `Bearer ` → AUTH_MALFORMED. Need explicit empty-key rejection.
2. **RefundsPage** — Does not show raw image, generated image, prompt. Approve/reject buttons don't call backend API.
3. **RefundsPage** — Uses direct fetch with `Bearer ${key || ''}`; when key empty, triggers auth error.

### ❌ What Is Missing

1. **API key validation** — Explicit empty-key check in auth middleware.
2. **Env validation on startup** — Fail-fast for GEMINI_API_KEY, CLOUDINARY_*, KIE_* before accepting requests.
3. **Credit rollback on failure** — When async pipeline fails, refund 1 credit.
4. **Demo account seed** — No script for `aryanparvani12@gmail.com` / `Aryan@1212` (high credits).
5. **Login/signup** — No traditional auth flow; users set API key in localStorage. B2C expects login/signup (may be out of scope for this refactor).
6. **Request logging** — No structured request log for generation (optional).
7. **Retry-safe generation** — No idempotency or retry handling (optional).

---

## Phase 2–4 Change Plan (Next Steps)

1. **Auth fix** — Add empty apiKey check; improve error message.
2. **Env validation** — Validate required env vars on server start.
3. **Credit rollback** — Add `addCredits(userId, amount)` and call on async failure.
4. **RefundsPage** — Use api.js; show raw/generated images + prompt; call approve/reject API.
5. **Refund data** — Ensure `finalPrompt` is available (from job or stored in refund).
6. **Demo seed** — Create `scripts/seed-demo-user.js` (or document manual Firestore add).
7. **Health check** — Already exists; optionally add dependency checks.
