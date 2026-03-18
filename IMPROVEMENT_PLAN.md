# Bokbad Improvement Plan

> Based on the comprehensive codebase audit of v1.13.2 (March 2026).
> Each stage is self-contained — complete one before starting the next.
> Reference this document in future conversations to pick up where you left off.

---

## Stage Completion Routine

> **Follow this routine after completing every stage.** It ensures changes are tested, documented, versioned, and deployed consistently.

### 1. Build
```bash
npm run build
```
Verify zero errors. If ESLint is set up (Stage 3+), also run `npm run lint`.

### 2. Manual Testing — Local Dev with Production API
The dev server (`npm run dev`) proxies `/api/` and `/uploads/` requests to the **live production API** via `vite.config.js`. This means:
- You can **log in with real credentials** and see real data
- Your **local frontend code** (JS/CSS/HTML changes) runs in the browser
- **Nothing is deployed** — other users are unaffected
- The proxy config **does not affect `npm run build`** or the deploy script

Start the dev server and test on your machine or phone (same network):
```bash
npm run dev
# → opens http://localhost:5173
```
The agent will provide a **stage-specific test checklist** for what to verify.

### 3. Commit (using `git-commit` skill)
The agent stages changes logically and commits using Conventional Commits format:
```
<type>[scope]: <description>
```
Examples: `fix(auth): add rate limiting to login`, `perf(pwa): lazy-load barcode scanner`.
One logical change per commit. Multiple commits per stage if changes span different areas.

### 4. Changelog (using `changelog-maintenance` skill)
Update `CHANGELOG.md` following Keep a Changelog format:
- Categorize under `Added`, `Changed`, `Fixed`, `Security` as appropriate
- Bump version using semantic versioning (PATCH for fixes, MINOR for features)
- Update version in `package.json` to match
- Write entries from the **user's perspective**, not the developer's

### 5. Push
```bash
git push origin main
```

### 6. Deploy via SFTP
Run the deploy script to push changes to production:
```bash
./deploy.sh
```
Or deploy selectively:
```bash
./deploy.sh frontend   # Frontend only (dist/)
./deploy.sh backend    # Backend only (api/)
```
The script builds automatically before uploading frontend files.

### Skills Discovery (using `find-skills` skill)

> **At the start of each stage**, run targeted `npx skills find` queries to discover skills that could improve the quality of the work. Install any skill with 1K+ installs from a reputable source. Skills with <100 installs should be treated with skepticism.

The specific queries to run are listed in each stage's **🔍 Skills Discovery** section below.

---

## Stage 1 — Safety & Accessibility Quick Fixes

**Goal:** Eliminate security vulnerabilities and accessibility violations that exist right now.
**Effort:** ~1–2 hours | **Risk:** Low | **No breaking changes**

#### 🔍 Skills Discovery
Before starting, search for relevant skills:
```bash
npx skills find "web security csrf rate limiting"
npx skills find "accessibility wcag audit"
npx skills find "php security best practices"
```
Install any high-quality matches to guide implementation.

#### ✅ Stage 1 Test Checklist
After implementation, the agent will build and ask you to verify:
- [ ] Login still works (correct + incorrect password)
- [ ] Login locks out after 5 failed attempts
- [ ] Page is pinch-zoomable on mobile
- [ ] CSRF-protected endpoints reject requests without token
- [ ] App functions normally end-to-end

### 1.1 Remove zoom restriction from viewport _(accessibility)_
- **File:** `index.html` (line 7)
- **Change:** Remove `maximum-scale=1.0, user-scalable=no` from the viewport meta tag. Replace with `maximum-scale=5` if iOS form-zoom is a concern.
- **Why:** Violates WCAG 2.1 SC 1.4.4. Users with vision impairments cannot pinch-to-zoom.

### 1.2 Add brute-force protection to login _(security)_
- **File:** `api/auth/login.php`
- **Change:** Track failed login attempts per IP or username. Lock out after 5 failures for 15 minutes. Options:
  - Add a `login_attempts` table (`ip`, `username`, `attempts`, `locked_until`)
  - Check before `verifyUserPassword()`, increment on failure, reset on success
- **Why:** Currently unlimited login attempts are allowed — trivial to brute-force.

### 1.3 Add CSRF token validation _(security)_
- **Files:** `api/utils/auth_middleware.php`, all POST/PUT/DELETE endpoints, `src/api.js`
- **Change:**
  - Generate a CSRF token on session start, store in `$_SESSION['csrf_token']`
  - Expose it via `GET /api/auth/check.php`
  - Send it as `X-CSRF-Token` header from the JS API client
  - Validate on all mutation endpoints
- **Why:** Session cookies alone + `SameSite=Lax` don't protect against all CSRF vectors.

### 1.4 Clarify `sanitizeString()` _(security hygiene)_
- **File:** `api/utils/response.php`
- **Change:** Rename to `trimInput()` or add `htmlspecialchars()` wrapping:
  ```php
  function sanitizeString($str) {
      return htmlspecialchars(trim($str), ENT_QUOTES, 'UTF-8');
  }
  ```
- **Why:** Current name implies sanitization, but it only trims. Could mislead future contributors.

### 1.5 Remove hardcoded test credentials from schema _(security hygiene)_
- **File:** `database/schema.sql` (line 114–116)
- **Change:** Move the test user INSERT into a separate `database/seed.sql` file. Add a comment in `schema.sql` pointing to it. Reference `seed.sql` in the README for development setup only.
- **Why:** Reduces the chance of production deployments starting with a known admin password.

---

## Stage 2 — PWA & Performance

**Goal:** Make the app installable with proper icons and reduce initial bundle size.
**Effort:** ~2–3 hours | **Risk:** Low

#### 🔍 Skills Discovery
```bash
npx skills find "pwa progressive web app manifest"
npx skills find "web performance lighthouse optimization"
npx skills find "service worker caching strategy"
```

#### ✅ Stage 2 Test Checklist
- [ ] Android shows "Add to Home Screen" install prompt
- [ ] iOS homescreen icon appears correctly (not blank)
- [ ] Barcode scanner still works (lazy-loaded)
- [ ] Skeleton loaders appear while data loads
- [ ] Lighthouse PWA audit passes
- [ ] App still works offline (cached pages)

### 2.1 Generate raster PWA icons
- **Files:** `public/manifest.json`, `index.html`
- **Change:**
  - Generate PNG icons from `logo.svg` at 192×192 and 512×512
  - Add them to `manifest.json` icons array
  - Add `<link rel="apple-touch-icon" href="/icon-192.png">` to `index.html`
  - Add Apple splash screen meta tags for common iOS sizes
- **Why:** Android requires raster icons for install prompts. iOS needs `apple-touch-icon` for homescreen appearance.

### 2.2 Enhance manifest.json
- **File:** `public/manifest.json`
- **Change:** Add the following fields:
  ```json
  "id": "/",
  "scope": "/",
  "categories": ["books", "education", "lifestyle"],
  "screenshots": [...]
  ```
- **Why:** Improves the install UI on Android and helps with PWA discoverability.

### 2.3 Lazy-load `html5-qrcode`
- **File:** `src/main.js`
- **Change:** Replace the static import with a dynamic `import()` inside the scan button handler:
  ```js
  // Before
  import { Html5Qrcode } from 'html5-qrcode';

  // After — load only when user taps "Scan"
  const { Html5Qrcode } = await import('html5-qrcode');
  ```
- **Why:** Saves ~100KB from the initial bundle. Barcode scanning is used rarely.

### 2.4 Add skeleton loaders
- **Files:** `index.html`, `src/main.js`, `src/style.css`
- **Change:** Replace `<div class="loading">Loading books...</div>` with CSS skeleton placeholders that match the book card shape. Show them while data loads, then swap with real content.
- **Why:** Perceived performance is significantly better with skeleton UI vs. text loading indicators.

### 2.5 Bump service worker cache version
- **File:** `public/sw.js`
- **Change:** Update `CACHE_NAME` to include a hash or version that changes with each build. Consider having Vite inject a build hash.
- **Why:** Currently manual; easy to forget, leading to users seeing stale versions.

---

## Stage 3 — Developer Experience

**Goal:** Add tooling that prevents bugs and enforces consistency.
**Effort:** ~2–3 hours | **Risk:** Low

#### 🔍 Skills Discovery
```bash
npx skills find "eslint javascript best practices"
npx skills find "prettier code formatting"
npx skills find "jsdoc typescript checking"
```

#### ✅ Stage 3 Test Checklist
- [ ] `npm run lint` runs without errors
- [ ] `npm run format` reformats files consistently
- [ ] VS Code shows type hints from JSDoc annotations
- [ ] Build still succeeds with no regressions

### 3.1 Add ESLint
- **Change:**
  ```bash
  npm install -D eslint @eslint/js
  npx eslint --init
  ```
  Configure for browser + ES modules. Enable rules for unused variables, potential errors, and consistent code style.
- **Why:** Catches bugs at edit time. No linter means issues are only found at runtime.

### 3.2 Add Prettier
- **Change:**
  ```bash
  npm install -D prettier eslint-config-prettier
  ```
  Add `.prettierrc` with project conventions (single quotes, 2-space indent, trailing commas).
- **Why:** Eliminates formatting debates and ensures consistent style across all files.

### 3.3 Add `npm run lint` and `npm run format` scripts
- **File:** `package.json`
- **Change:** Add scripts:
  ```json
  "lint": "eslint src/",
  "format": "prettier --write 'src/**/*.{js,css}' index.html"
  ```
- **Why:** One-command linting and formatting for the entire codebase.

### 3.4 Add JSDoc type annotations to key functions
- **Files:** `src/api.js`, `src/bookManager.js`, `src/auth.js`
- **Change:** Add `@param` and `@returns` JSDoc comments to public functions. Enable `// @ts-check` at the top of files for editor-level type checking without migrating to TypeScript.
- **Why:** Free type safety in VS Code. Documents function contracts for future contributors.

---

## Stage 4 — Testing Foundation

**Goal:** Establish a testing baseline that catches regressions.
**Effort:** ~4–6 hours | **Risk:** Low

#### 🔍 Skills Discovery
```bash
npx skills find "vitest testing javascript"
npx skills find "playwright e2e testing"
npx skills find "test coverage best practices"
```

#### ✅ Stage 4 Test Checklist
- [ ] `npm test` runs and all tests pass
- [ ] Unit tests cover formatDate, genre normalization, escapeHtml
- [ ] API client tests verify error handling and auth expiry
- [ ] (If Playwright) E2E login flow passes

### 4.1 Set up Vitest
- **Change:**
  ```bash
  npm install -D vitest
  ```
  Add `"test": "vitest"` to `package.json` scripts. Configure in `vite.config.js`.
- **Why:** Vitest integrates natively with Vite — zero config, fast execution.

### 4.2 Write unit tests for pure logic
- **New files:** `src/__tests__/format.test.js`, `src/__tests__/genre.test.js`
- **Test targets:**
  - `formatDate()`, `formatDateRelative()`, `formatDuration()`
  - `normalizeGenreKey()`, `normalizeGenres()`
  - `escapeHtml()`
- **Why:** These are pure functions with no DOM dependencies — easiest to test first.

### 4.3 Write unit tests for API client
- **New file:** `src/__tests__/api.test.js`
- **Change:** Test `API.get()`, `API.post()`, `API.put()`, `API.delete()` with mocked `fetch()`.
- **Why:** The API client is used everywhere. Verifying its error handling and auth expiry detection prevents cascading failures.

### 4.4 Add Playwright for E2E testing _(optional, higher effort)_
- **Change:**
  ```bash
  npm install -D @playwright/test
  npx playwright install
  ```
  Write tests for: login flow, add book, log reading session, change language.
- **Why:** E2E tests catch integration issues that unit tests miss. Start with the happy paths.

---

## Stage 5 — Architecture Refactoring

**Goal:** Break the monoliths into maintainable modules.
**Effort:** ~6–10 hours | **Risk:** Medium — requires careful testing

#### 🔍 Skills Discovery
```bash
npx skills find "javascript module architecture"
npx skills find "css design tokens custom properties"
npx skills find "svg icon system"
npx skills find "code splitting vite"
```

#### ✅ Stage 5 Test Checklist
- [ ] All views render correctly (home, library, dashboard)
- [ ] All modals open/close/submit (add book, edit, session, settings, detail)
- [ ] Pull-to-refresh and swipe gestures work
- [ ] Dark mode toggles correctly
- [ ] All existing Vitest tests still pass
- [ ] Build output is similar size (no accidental duplication)

### 5.1 Split `main.js` into feature modules
- **Current:** 3,720 lines in one file
- **Target structure:**
  ```
  src/
  ├── main.js              ← Entry point (~100 lines): init, routing, imports
  ├── views/
  │   ├── home.js          ← Home view rendering, streak, carousel
  │   ├── library.js       ← Book list, filtering, sorting, view modes
  │   └── dashboard.js     ← Charts, stats, period selector
  ├── modals/
  │   ├── bookModal.js     ← Add/edit book form
  │   ├── sessionModal.js  ← Reading session + timer
  │   ├── detailModal.js   ← Book detail read-only view
  │   └── settingsModal.js ← Settings, password, goals, export
  ├── components/
  │   ├── toast.js         ← Toast notification system
  │   ├── swipe.js         ← Swipe gesture handlers
  │   ├── pullToRefresh.js ← Pull-to-refresh logic
  │   └── carousel.js      ← Book carousel component
  ├── utils/
  │   ├── format.js        ← Date/duration formatting
  │   ├── genre.js         ← Genre hierarchy & normalization
  │   └── escapeHtml.js    ← HTML escaping utility
  ├── api.js               ← (existing) API client
  ├── auth.js              ← (existing) Auth module
  ├── bookManager.js       ← (existing) Book data manager
  ├── i18n.js              ← (existing) Internationalization
  └── style.css            ← (existing, split later in 5.2)
  ```
- **Approach:** Move functions one module at a time, re-export from `main.js` initially to avoid breaking imports. Run manual tests after each move. Use Vitest (from Stage 4) for regression checking.

### 5.2 Organize CSS with design tokens
- **File:** `src/style.css` (4,560 lines)
- **Change:**
  - Extract CSS custom properties into a `:root` block (colors, spacing, typography, border-radius)
  - Group styles by feature (login, header, nav, library, dashboard, modals, etc.)
  - Consider splitting into multiple files imported from a main `style.css`
- **Why:** A design token system makes theming easier and ensures consistency across components.

### 5.3 Replace emoji icons with SVG icon system
- **Files:** `index.html`, `src/main.js`
- **Change:** Replace emoji usage in menus (🌙, ⚙️, 🐛, 🚪) and section headers (📖, ⏭️, 📚) with inline SVGs or an icon component. The bottom nav already uses SVGs — extend that approach.
- **Why:** Emoji render inconsistently across OS/browser. SVGs are consistent, styleable, scalable, and accessible.

---

## Stage 6 — Scalability & Resilience

**Goal:** Prepare the app for growth and improve error handling.
**Effort:** ~4–6 hours | **Risk:** Low–Medium

#### 🔍 Skills Discovery
```bash
npx skills find "api pagination best practices"
npx skills find "error handling resilience"
npx skills find "database migration runner php"
npx skills find "application logging monitoring"
```

#### ✅ Stage 6 Test Checklist
- [ ] Book list loads correctly with pagination (if library has 50+ books)
- [ ] Error recovery screen appears on network failure (airplane mode test)
- [ ] Retry button works after error
- [ ] Migration runner applies pending migrations correctly
- [ ] Error logs are written on 5xx responses

### 6.1 Add pagination to book list API
- **File:** `api/books/index.php`
- **Change:** Accept `?page=1&limit=50` query params. Return pagination metadata in response:
  ```json
  { "books": [...], "page": 1, "total": 234, "totalPages": 5 }
  ```
  Update `src/bookManager.js` to support paginated loading with a "load more" button or infinite scroll.
- **Why:** Libraries with 500+ books will cause slow loads and high memory usage.

### 6.2 Add error boundaries / recovery UI
- **File:** `src/main.js` → `src/main.js` (entry point after refactor)
- **Change:** Wrap `init()` in a try/catch that shows a user-friendly error screen with a "Retry" button instead of a blank page.
- **Why:** Network failures, API errors, or JS exceptions currently leave users with a blank or frozen screen.

### 6.3 Add database migration runner
- **New file:** `api/utils/migrate.php` or `database/migrate.php`
- **Change:** A CLI script that reads migration files in order and tracks which have been applied (via a `migrations` table). Safer than manually running SQL files.
- **Why:** 7 migration files exist with no automated way to apply them. Risk of missed migrations on deploy.

### 6.4 Add request logging / error logging
- **File:** `api/utils/response.php` or new `api/utils/logger.php`
- **Change:** Log all 5xx errors and failed auth attempts to a file or database table. Include timestamp, IP, endpoint, and error message.
- **Why:** No observability currently — issues in production can go undetected.

---

## Stage 7 — Long-term Architecture _(Future)_

**Goal:** Larger architectural improvements for when the app grows significantly.
**Effort:** Days–weeks each | **Risk:** High — major refactors

#### 🔍 Skills Discovery
```bash
npx skills find "svelte sveltekit migration"
npx skills find "typescript migration javascript"
npx skills find "github actions ci cd deployment"
npx skills find "redis session management"
```

### 7.1 Consider SvelteKit or similar framework
- Replace vanilla JS SPA with component-based architecture
- Benefits: reactive state, component isolation, SSR option, routing, better DX
- Only worthwhile if the app's complexity continues to grow

### 7.2 Add TypeScript
- Migrate `.js` → `.ts` incrementally (Vite supports this natively)
- Start with utilities and API client, expand to views/modals
- Catch type errors at build time instead of runtime

### 7.3 CI/CD pipeline via GitHub Actions
- Replace manual `deploy.sh` SFTP workflow with:
  - Lint + test on every push
  - Build + deploy on merge to `main`
  - Use SSH/rsync instead of expect scripts
- Eliminates human error in deployments

### 7.4 Redis session store _(if scaling to more users)_
- Replace PHP file-based sessions with Redis
- Enables horizontal scaling (multiple web servers)
- Only needed if user count grows significantly

### 7.5 CDN for uploads
- Move cover images to S3/Cloudflare R2 + CDN
- Reduces server load and improves global image delivery
- Only needed if storage or bandwidth becomes an issue

---

## Progress Tracker

| Stage | Status | Notes |
|-------|--------|-------|
| 1 — Safety & Accessibility | ✅ Complete | v1.14.0 |
| 2 — PWA & Performance | ✅ Complete | v1.15.0 |
| 3 — Developer Experience | ✅ Complete | v1.16.0 |
| 4 — Testing Foundation | ✅ Complete | v1.17.0 |
| 5 — Architecture Refactoring | ⬜ Not started | |
| 6 — Scalability & Resilience | ⬜ Not started | |
| 7 — Long-term Architecture | ⬜ Not started | Future |

> **How to use this plan:** Reference this file path in future conversations:
> `@IMPROVEMENT_PLAN.md` — then ask to work on a specific stage or item.
