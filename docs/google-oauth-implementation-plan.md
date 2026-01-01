# Google OAuth Authentication Implementation Plan

## Overview
Add Google OAuth 2.0 authentication to Anthology. Items and shelves remain shared (no ownership changes in this phase).

## Key Decisions
- **Multi-instance deployment**: Database-backed sessions required
- **Google OAuth only**: No legacy API_TOKEN support needed (single user currently)
- **Libraries**: `golang.org/x/oauth2` + `github.com/coreos/go-oidc/v3` (industry standard)

## Multi-Environment Setup (Local Dev / Production)

Google OAuth requires exact redirect URI matching. Configure all environments in Google Cloud Console:

**Google Cloud Console → APIs & Services → Credentials → OAuth Client:**
Add all redirect URIs:
- `http://localhost:8080/api/auth/google/callback` (local dev)
- `https://app.yourdomain.com/api/auth/google/callback` (production)

Each deployment sets `AUTH_GOOGLE_REDIRECT_URL` to its environment-specific URI.

---

## Phase 1: Database Schema

### Migration: `migrations/0010_create_users.sql`

```sql
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL DEFAULT '',
    oauth_provider TEXT NOT NULL,
    oauth_provider_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_users_oauth ON users (oauth_provider, oauth_provider_id);
CREATE UNIQUE INDEX uq_users_email ON users (email);

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_agent TEXT NOT NULL DEFAULT '',
    ip_address TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions (user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions (expires_at);
```

---

## Phase 2: Backend - New `internal/auth` Package

### Files to Create

| File | Purpose |
|------|---------|
| `internal/auth/user.go` | User and Session domain types |
| `internal/auth/repository.go` | Repository interface |
| `internal/auth/postgres_repository.go` | Postgres implementation |
| `internal/auth/google.go` | Google OAuth/OIDC authenticator |
| `internal/auth/service.go` | Auth business logic (create user, create/validate session) |

### Key Components

**GoogleAuthenticator** (`google.go`):
- Initialize OIDC provider with `https://accounts.google.com`
- Configure OAuth2 with scopes: `openid`, `email`, `profile`
- `AuthURL(state)` - Generate Google consent URL
- `Exchange(code)` - Exchange code for ID token, verify, extract claims
- `IsEmailAllowed(email)` - Check against domain/email allowlists

**AuthService** (`service.go`):
- `CreateOrUpdateUser(claims)` - Find by (provider, sub) or create new user
- `CreateSession(userID, userAgent, ip)` - Generate secure token, store hash in DB
- `ValidateSession(token)` - Lookup by hash, check expiry, return user
- `DeleteSession(token)` - Remove from DB

---

## Phase 3: Backend - Configuration

### File: `internal/config/config.go`

Replace token-based config with OAuth config:
```go
// Google OAuth
GoogleClientID       string
GoogleClientSecret   string
GoogleRedirectURL    string   // Environment-specific callback URL
GoogleAllowedDomains []string
GoogleAllowedEmails  []string
FrontendURL          string   // For OAuth redirects after login

// Sessions (database-backed)
SessionTTL time.Duration // default 12h
```

Remove `APIToken` field - no longer needed.

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `AUTH_GOOGLE_CLIENT_SECRET` | Yes | Client secret (or `_FILE` for Docker secrets) |
| `AUTH_GOOGLE_REDIRECT_URL` | Yes | Environment-specific callback URL |
| `AUTH_GOOGLE_ALLOWED_DOMAINS` | In production | Comma-separated domain list |
| `AUTH_GOOGLE_ALLOWED_EMAILS` | In production | Comma-separated email list |
| `FRONTEND_URL` | Yes | Frontend URL for redirects (e.g., `http://localhost:4200`) |

---

## Phase 4: Backend - HTTP Handlers

### New File: `internal/http/oauth_handler.go`

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/google` | Initiate OAuth flow (redirect to Google) |
| GET | `/api/auth/google/callback` | Handle Google callback, create session |

**OAuth Flow:**
1. `InitiateGoogle`: Generate state, store in HttpOnly cookie, redirect to Google
2. `CallbackGoogle`: Verify state, exchange code, validate email_verified, check allowlist, create/update user, create session, set cookie, redirect to frontend

### File: `internal/http/middleware.go`

Replace `newTokenAuthMiddleware` with `newAuthMiddleware`:
- Extract session token from cookie
- Validate via AuthService (lookup token hash in DB)
- Inject user into context: `context.WithValue(r.Context(), userContextKey, user)`
- Return 401 if no valid session

### File: `internal/http/session_handler.go`

Simplify to OAuth-only:
- `Status` returns JSON with `authenticated` and `user` object
- `Logout` deletes session from DB and clears cookie
- `CurrentUser` endpoint returns authenticated user info

### File: `internal/http/router.go`

Add routes:
```go
r.Route("/api/auth", func(r chi.Router) {
    r.Get("/google", oauthHandler.InitiateGoogle)
    r.Get("/google/callback", oauthHandler.CallbackGoogle)
})
```

---

## Phase 5: Backend - Initialization

### File: `cmd/api/main.go`

1. Add dependencies to `go.mod`:
   ```
   golang.org/x/oauth2
   github.com/coreos/go-oidc/v3/oidc
   ```

2. Initialize OAuth components:
   ```go
   var authService *auth.Service
   var googleAuth *auth.GoogleAuthenticator

   if cfg.GoogleClientID != "" {
       authRepo := auth.NewPostgresRepository(db)
       authService = auth.NewService(authRepo, cfg.SessionTTL)
       googleAuth, _ = auth.NewGoogleAuthenticator(ctx, cfg.GoogleClientID, ...)
   }
   ```

3. Pass to router: `NewRouter(cfg, svc, catalogSvc, shelfSvc, authService, googleAuth, logger)`

---

## Phase 6: Frontend

### File: `web/src/app/services/auth.service.ts`

Add:
```typescript
interface User { id: string; email: string; name: string; avatarUrl: string; }
interface SessionStatus { authenticated: boolean; authMethod?: 'token' | 'oauth'; user?: User; }

// New method
loginWithGoogle(redirectTo?: string): void {
    window.location.href = `${this.authUrl}/google?redirectTo=${redirectTo || '/'}`;
}

// Update ensureSession to return user info
```

### File: `web/src/app/pages/login/login-page.component.ts`

1. Replace token form with "Sign in with Google" button
2. Handle OAuth error query params (`?error=...&message=...`)
3. Remove token-related form logic

### File: `web/src/app/pages/login/login-page.component.html`

```html
<mat-card class="login-card">
    <mat-card-header>
        <mat-card-title>Sign in to Anthology</mat-card-title>
    </mat-card-header>
    <mat-card-content>
        <p class="error" *ngIf="errorMessage()">{{ errorMessage() }}</p>
        <button mat-stroked-button class="google-button" (click)="loginWithGoogle()">
            <img src="assets/google-icon.svg" /> Continue with Google
        </button>
    </mat-card-content>
</mat-card>
```

### New File: `web/src/app/models/user.ts`

```typescript
export interface User {
    id: string;
    email: string;
    name: string;
    avatarUrl: string;
}
```

### Asset: `web/src/assets/google-icon.svg`

Add Google "G" logo for the sign-in button.

---

## Files Summary

### Backend - New Files
| File | Purpose |
|------|---------|
| `migrations/0010_create_users.sql` | Users and sessions tables |
| `internal/auth/user.go` | User, Session domain types |
| `internal/auth/repository.go` | Repository interface |
| `internal/auth/postgres_repository.go` | Postgres implementation |
| `internal/auth/google.go` | Google OAuth authenticator |
| `internal/auth/service.go` | Auth business logic |
| `internal/http/oauth_handler.go` | OAuth endpoints |

### Backend - Modified Files
| File | Changes |
|------|---------|
| `internal/config/config.go` | Add OAuth config, remove APIToken |
| `internal/http/middleware.go` | Replace token auth with session auth |
| `internal/http/session_handler.go` | Simplify to OAuth-only |
| `internal/http/router.go` | Add OAuth routes |
| `cmd/api/main.go` | Initialize auth components |
| `go.mod` | Add oauth2 + go-oidc deps |

### Frontend - New Files
| File | Purpose |
|------|---------|
| `web/src/app/models/user.ts` | User interface |
| `web/src/assets/google-icon.svg` | Google logo for button |

### Frontend - Modified Files
| File | Changes |
|------|---------|
| `web/src/app/services/auth.service.ts` | Add Google login, user state |
| `web/src/app/pages/login/login-page.component.ts` | Google sign-in button |
| `web/src/app/pages/login/login-page.component.html` | Simplified UI |
| `web/src/app/pages/login/login-page.component.scss` | Google button styling |

---

## Testing Approach

1. **Unit tests**: Allowlist logic, session token hashing, user creation
2. **Integration tests**: OAuth callback flow with mocked Google responses
3. **Manual testing**: Full OAuth flow with real Google credentials (dev mode)

---

## Rollout Strategy

1. Set up Google Cloud OAuth credentials with all environment redirect URIs
2. Deploy database migration
3. Deploy backend with OAuth support
4. Deploy frontend with Google sign-in
5. Verify login flow works in each environment (local → production)
