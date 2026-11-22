# API reference

The JSON API prefix is `/api/v1`. Except for registration, login, logout, and session discovery, endpoints require the session cookie. Health endpoints are outside this prefix and do not require authentication.

## Conventions

- A successful response is `{ "data": ... }`; successful deletions/logout return `204` without a body.
- A list is `{ "data": { "items": [], "nextCursor": null } }`. Feed, user directory, profile-post, and graph lists accept `limit` (default 10, maximum 50) and an opaque `cursor`. Reuse the same filters when following a cursor.
- Suggestions are a ranked, capped list, not a paginated feed: `{ "data": [...] }`, with `limit` from 1 to 20, default 5.
- All state-changing requests require an `Origin` header exactly matching `APP_ORIGIN`. Browsers provide it automatically. There is intentionally no wildcard CORS configuration.
- Bodies are strict: unknown fields are rejected rather than mass-assigned. JSON bodies are limited to 16 KB.
- Application timestamps are UTC. Cursor timestamps retain six fractional-second digits.
- A fresh `X-Request-Id` accompanies every request. Errors include the same ID; logs never include credentials, cookies, or submitted request bodies.
- Authenticated API/media responses use `Cache-Control: no-store`. Email appears only in the signed-in user's own session/profile response.

## Routes

| Method | Path                           | Purpose                                                                   |
| ------ | ------------------------------ | ------------------------------------------------------------------------- |
| POST   | `/auth/register`               | Create an account and browser session; `201`                              |
| POST   | `/auth/login`                  | Verify a password, rotate this browser's session; `200`                   |
| POST   | `/auth/logout`                 | Revoke the supplied session and clear its cookie; `204`                   |
| GET    | `/auth/session`                | Optional session discovery for SPA startup; user or `null`                |
| GET    | `/auth/me`                     | Require authentication and return the current user                        |
| GET    | `/users?query=avery&limit=10`  | Discover users by case-insensitive handle prefix                          |
| GET    | `/users/suggestions?limit=5`   | Public, not-yet-followed candidates ranked by mutual accepted connections |
| PATCH  | `/users/me`                    | Update `name`, `handle`, `bio`, and/or `isPublic`                         |
| DELETE | `/users/me`                    | Delete the account after current-password confirmation                    |
| PUT    | `/users/me/avatar`             | Upload one `image` multipart field                                        |
| GET    | `/users/me/requests`           | The current user's pending incoming requests                              |
| GET    | `/users/:userId`               | Public profile metadata, counts, and viewer relationship                  |
| GET    | `/users/:userId/avatar`        | Authenticated access to the profile avatar                                |
| GET    | `/users/:userId/posts`         | Visible posts by this user                                                |
| GET    | `/users/:userId/followers`     | Accepted followers, subject to the target user's privacy                  |
| GET    | `/users/:userId/following`     | Accepted outgoing connections, subject to privacy                         |
| PUT    | `/follows/:userId`             | Follow, or create a private follow request; safe to retry                 |
| DELETE | `/follows/:userId`             | Unfollow or cancel an outgoing request; safe to retry                     |
| PUT    | `/follows/:requesterId/accept` | Accept an incoming request; safe to retry while the edge exists           |
| DELETE | `/followers/:userId`           | Remove a follower or decline a pending incoming request                   |
| GET    | `/posts`                       | Following feed, including the current user's own posts                    |
| POST   | `/posts`                       | Create a text/image post with an `Idempotency-Key` header                 |
| GET    | `/posts/:postId`               | Read a visible post, or `404`                                             |
| PATCH  | `/posts/:postId`               | Replace caption/purpose on a post owned by the actor                      |
| DELETE | `/posts/:postId`               | Delete a post owned by the actor                                          |
| GET    | `/posts/:postId/image`         | Read a post's image with the same visibility policy                       |
| GET    | `/health/live`                 | Process liveness; outside `/api/v1`                                       |
| GET    | `/health/ready`                | Database readiness; `200` or `503`; outside `/api/v1`                     |

## Authentication

Registration body:

```json
{
  "name": "Avery Morgan",
  "handle": "avery.makes",
  "email": "avery@example.test",
  "password": "choose-your-own-long-passphrase",
  "bio": "Learning with intention.",
  "isPublic": true
}
```

`name`, `handle`, `email`, and `password` are required. Passwords are 12-128 characters; handles are 3-30 ASCII letters/numbers/underscores/periods and must start with a letter or number. Email and handle are normalized to lowercase; name and bio are trimmed. `bio` defaults to empty and `isPublic` to true.

Login accepts only `email` and `password`. A nonexistent email and an incorrect password have the same public error. Sessions expire after seven days. The browser receives a random token in an HttpOnly, SameSite=Strict cookie scoped to `/api/v1`; only its SHA-256 hash is stored. The cookie is Secure for HTTPS origins. Tokens are never returned in JSON or placed in local storage.

Both login and registration have a combined per-process limit of 20 attempts per IP per 15 minutes. All versioned API requests have a per-process limit of 600 requests per IP per 15 minutes. Forwarded-IP headers are not implicitly trusted.

Account deletion body:

```json
{ "password": "your-current-password" }
```

Foreign keys remove sessions, posts, image bytes, avatars, retry records, and both incoming/outgoing graph edges. The React UI additionally requires typing the handle before submitting this action.

## Posts and retry keys

```json
{ "caption": "One small step forward today.", "purpose": "learning" }
```

Captions must contain 1-2200 non-blank characters after trimming. Purpose is one of `learning`, `fitness`, `creative`, or `mindful`. Send JSON for text-only posts, or multipart fields `caption`, `purpose`, and optional `image` for images. PATCH requires both caption and purpose; image replacement is not part of this API.

`POST /posts` requires a caller-generated UUID in `Idempotency-Key`. Keys are scoped to the signed-in account and must not be reused for a different logical operation.

| Situation                             | Outcome                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| New key                               | Post, image bytes, and retry record commit in one transaction; `201`                   |
| Same key and normalized content/image | Return the existing post's current representation; `200`, `Idempotency-Replayed: true` |
| Same key, different content/image     | `409 IDEMPOTENCY_CONFLICT`                                                             |
| Same key after its post was deleted   | `409 POST_ALREADY_DELETED`; no resurrection                                            |
| Failure before commit                 | All rows roll back; a retry can create the post normally                               |

Image identity is based on the uploaded file bytes, not on the filename or encoder version. The stored image is still safely re-encoded. The React composer retains the same key after a failed attempt when its draft has not changed. Retry records persist until account deletion.

`GET /posts` accepts `scope=following` (default), `discover` (public posts only), or `mine`, and optional `purpose`. Profile-post endpoints apply the target profile's visibility policy. Ties are ordered by post UUID after timestamp; cursors are not offsets and do not confer access.

## Follow and privacy rules

The authenticated actor is always taken from the session, never from a body-supplied user ID.

| Current state / operation                             | Result                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| No edge, follow a public account                      | `accepted`                                                                     |
| No edge, follow a private account                     | `pending`                                                                      |
| Existing edge, repeat follow                          | Existing state is retained                                                     |
| Pending edge, receiver accepts                        | `accepted`                                                                     |
| Accepted edge, repeat accept                          | Remains `accepted`                                                             |
| Missing edge, accept                                  | `404 REQUEST_NOT_FOUND`                                                        |
| Actor unfollows/cancels, or receiver removes/declines | Edge is deleted; repeated deletion for existing users returns `204`            |
| Follow yourself                                       | `400 SELF_FOLLOW`                                                              |
| Private becomes public                                | Privacy change and acceptance of all pending incoming requests commit together |
| Public becomes private                                | Existing accepted followers keep access; new requests are pending              |

Profile metadata and avatars are discoverable to signed-in users even for private accounts. Post contents/images and follower/following lists are restricted. Hidden direct posts and images return `404`; an explicitly requested private profile list returns `403`. Access checks are also present inside the SQL reads, not only in a preceding controller/service check.

Participant user rows are locked in sorted ID order before a graph mutation. One unique `(follower_id, following_id)` row is the source of truth; follower/following views are projections, not two copies that must be synchronized.

## Images

Uploads accept exactly one JPEG, PNG, or WebP file up to 5 MB. The decoder verifies the file format rather than trusting its name/MIME header, caps input pixels at 20 million, rejects animated/multipage input, removes metadata, corrects orientation, and bounds output dimensions to 1600 by 1600. The stored WebP must be at most 2 MB.

Image bytes live in separate blob tables; feed reads never select them. Image requests are authenticated and private post images are checked against the current graph/privacy state on every request. At most two multipart requests per process are admitted at once, including buffering, decoding, and database work. Additional uploads receive `503 UPLOAD_BUSY` with `Retry-After: 1`; failures and aborted input release capacity.

## Errors

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Check the submitted fields",
    "fields": [{ "field": "caption", "message": "Caption is required" }],
    "requestId": "a-response-specific-uuid"
  }
}
```

`fields` appears only for schema validation. Field messages in the example are illustrative; codes/statuses are the application contract.

| Status | Typical codes                                                                           |
| ------ | --------------------------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`, `INVALID_JSON`, `INVALID_CURSOR`, `SELF_FOLLOW`                     |
| 401    | `AUTHENTICATION_REQUIRED`, `INVALID_CREDENTIALS`                                        |
| 403    | `ORIGIN_NOT_ALLOWED`, `PRIVATE_ACCOUNT`                                                 |
| 404    | `USER_NOT_FOUND`, `POST_NOT_FOUND`, `IMAGE_NOT_FOUND`, `REQUEST_NOT_FOUND`, `NOT_FOUND` |
| 409    | `RESOURCE_CONFLICT`, `RESOURCE_CHANGED`, `IDEMPOTENCY_CONFLICT`, `POST_ALREADY_DELETED` |
| 413    | `BODY_TOO_LARGE`, `LIMIT_FILE_SIZE`, `IMAGE_TOO_LARGE`                                  |
| 415    | `INVALID_IMAGE`                                                                         |
| 429    | `RATE_LIMITED`, `AUTH_RATE_LIMITED`                                                     |
| 500    | `INTERNAL_ERROR` without SQL, stack traces, or raw database messages                    |
| 503    | `RETRY_TRANSACTION` with `Retry-After: 1` for deadlocks/lock timeouts                   |

Rate-limit responses have a compact code/message envelope and standard rate-limit headers. Health responses use `{ "status": "up" }`, `{ "status": "ready" }`, or `{ "status": "not_ready" }` rather than the application data envelope.

## PowerShell example

With the development server running, this creates a disposable account, keeps its session in memory, and publishes a text post. Supply a unique handle/email for another run.

```powershell
$headers = @{ Origin = 'http://localhost:5173' }
$account = @{
  name = 'Local Explorer'
  handle = "explorer_$((New-Guid).ToString('N').Substring(0, 8))"
  email = "explorer-$((New-Guid).ToString('N').Substring(0, 8))@example.test"
  password = [guid]::NewGuid().ToString()
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/v1/auth/register' `
  -Headers $headers -ContentType 'application/json' -Body $account -SessionVariable session

$headers['Idempotency-Key'] = [guid]::NewGuid().ToString()
$post = @{ caption = 'Learning with intention.'; purpose = 'learning' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/v1/posts' `
  -Headers $headers -ContentType 'application/json' -Body $post -WebSession $session
```

### Requirements check

Route and authorization contracts are exercised by `Backend/test/integration/api.test.js`; complete browser interactions are exercised by `e2e/journeys.spec.js`. Intended limitations and deployment tradeoffs are documented in the root README rather than presented as implemented features.
