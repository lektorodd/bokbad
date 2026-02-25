# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.13.2] - 2026-02-25

### Fixed
- **iPhone PWA Bottom Bar Spacing** — reduced excessive bottom navigation height/safe-area padding so the UI is less spacious and matches browser behavior better.
- **"Ny bok" FAB Overlap** — adjusted floating add-book button positioning and layering so it no longer gets blocked by the bottom nav in iPhone PWA mode.
- **Keyboard Regression Scope** — keyboard offset logic is now scoped to Settings/Feedback modals only, preventing the Add Book modal from being pushed out of view.
- **Deploy Coverage** — deploy script now includes `sw.js`, manifest/logo, `api/books/lookup.php`, and debug/migration files so live deploys match local tested behavior.

## [1.13.1] - 2026-02-25

### Security
- **Session Hardening** — login now rotates session IDs to reduce session fixation risk, and logout explicitly clears the session cookie.
- **Maintenance Endpoint Lockdown** — `api/migrations/fix_audiobook_sessions.php` is now CLI-only; `api/debug/check_db.php` is disabled by default and requires `BOKBAD_DEBUG_ENDPOINT=1` plus admin auth.
- **Cover Proxy Hardening** — `api/upload/proxy_cover.php` now validates target URLs/hosts more strictly, blocks private/reserved IP destinations, disables redirects, and streams downloads with a hard size cap.
- **Service Worker Privacy** — API responses are no longer cached offline (`/api/*` now uses network-only behavior).
- **XSS Mitigations** — hardened front-end rendering for toast messages, notes textarea content, and image URL handling.

### Fixed
- **Stats Date Validation** — `summary`, `dashboard_stats`, and `reading_pace` endpoints now validate `from`/`to` query params (`YYYY-MM-DD`) and return `400` on invalid ranges/formats instead of failing.
- **Feedback Schema Gap** — `platform_feedback` table is now included in `database/schema.sql` for clean installs.

## [1.13.0] - 2026-02-24

### Changed
- **Home Carousel** — narrower slides (68%) so adjacent book covers peek in, giving a better scrollable feel.
- **Progress Ring** — enlarged from 36×36 to 56×56px with bigger text (11px) for much better readability.
- **Stats Page** — metric tiles redesigned as a 2×3 card grid with icon circles and subtle borders instead of a flat icon list.
- **Daily Chart** — fewer x-axis labels (10 max) with larger font for less cramping.
- **FAB** — converted from plain circle to a labelled "Add Book" gradient pill, shown only on Home view.
- **Library Nav Icon** — replaced single-book icon with "books on shelf" (3 vertical rectangles) to differentiate from Home.
- **Dark Mode Contrast** — brightened accent purple to `#c4b5fd` (Violet 300) for better WCAG accessibility.

### Added
- **Goal Progress Bar** — linear progress bar below the reading goal widget alongside the existing ring.
- **Empty State CTA** — friendly empty state on Home with "Add Book" button when no books are being read.
- **Menu Divider** — additional divider in header dropdown before "Report Issue" for better grouping.

### Fixed
- **Library Card Alignment** — compact view cards now have consistent 88px min-height so badges and format icons align across rows.

## [1.12.3] - 2026-02-23

### Changed
- **Dashboard** — removed redundant "Oversikt" heading; the bottom nav already labels the tab.

### Added
- **Force Password Change** — users flagged with `must_change_password` are prompted to change their password on login. Settings modal opens automatically with a warning toast.

## [1.12.2] - 2026-02-23

### Changed
- **Dashboard Period Buttons** — replaced bordered pill buttons with a modern iOS-style segmented control (subtle background, elevated active state, smooth transitions, dark mode support).
- **Default Period** — dashboard now defaults to "Last 30 Days" instead of "All Time", with buttons ordered short→long (30d → 12m → This Year → All Time).

## [1.12.1] - 2026-02-23

### Fixed
- **Author/Topic Autocomplete** — suggestions now work correctly; was broken because the closure captured a stale empty array reference.
- **Text Search Matches Series** — searching for a series name (e.g. "Fabian Risk") now returns all books in that series.

## [1.12.0] - 2026-02-23

### Added
- **Compact Add Book Form** — reorganized form with collapsible sections (📋 Details, 📅 Dates & Notes). Essential fields always visible at top; Status + Format on one row. Significantly less scrolling.
- **Author Auto-Fill from Series** — selecting a series in the add-book form auto-fills the author from existing books in that series.
- **Series Filter Pill** — clicking a series chip in book detail now shows a dedicated 📖 filter pill (removable) instead of text search.

### Fixed
- **Series Filtering** — series chip now filters by `series_id` instead of text search, correctly showing all books in the series including newly added ones.
- **Missing Series Name on New Books** — API now JOINs the series table when returning created/updated books, so `series_name` is populated immediately.
- **Modal Scroll Position** — add/edit book modal now always scrolls to top when opened.

## [1.11.0] - 2026-02-22

### Added
- **Finish Date Precision** — when logging a book, you can now choose between "Exact date", "Month & year", or "Year only" for the finish date. Perfect for adding books you read in the past where you only remember the year. The detail modal displays dates accordingly (e.g., "2023" or "Mar 2023").
- Database migration v7 (`finish_date_precision` column).

## [1.10.4] - 2026-02-22

### Fixed
- **Dashboard Stats Overhaul** — unified all dashboard metrics into a single API endpoint (`dashboard_stats.php`), eliminating race conditions and inconsistent numbers across time periods. (#8)
- **Listening Time** — hybrid approach: finished audiobooks use book-level total duration, in-progress audiobooks use session-based listening time, no double-counting.
- **Consistent Metric Tiles** — all 4 time periods now show the same 6 metrics (days/book, books/mo, pages, streak, read time, listened) without label-swapping.

### Changed
- Deploy script now includes `dashboard_stats.php`.

## [1.10.3] - 2026-02-22

### Added
- **Cover Reuse from Library** — when adding a book, the ISBN lookup now checks the local database first before calling Google Books / Open Library, reusing covers from books already in the system. (#10)
- **Title-Match Cover Suggestion** — typing a book title in the add-book modal triggers a debounced search across all users. If a matching book with a cover is found, a banner appears offering to auto-fill the cover, authors, page count, and ISBN.
- New API endpoint `api/books/lookup.php` for title-based book metadata lookup.

## [1.10.2] - 2026-02-22

### Fixed
- **Series on Book Cards** — updated the books API to properly join the series table and retrieve the series name, ensuring the series chip actually renders on library book cards.

## [1.10.1] - 2026-02-21

### Added
- **Audiobook Listening Stat** — separate 🎧 stat on dashboard showing audiobook-only listening time alongside ⏱ total time.
- **Audiobook Session Migration** — one-time script to fix existing session records (`api/migrations/fix_audiobook_sessions.php`).

### Fixed
- Dashboard time stat icon changed from misleading 🎧 to ⏱ since it shows combined total time.

## [1.10.0] - 2026-02-21

### Added
- **Clickable Detail Elements** — tap author, status, series, or genre/topic tags in book detail to navigate to a filtered library view.
- **Author Filter** — dedicated author filter in BookManager with removable ✍ filter pill.
- **Series on Book Cards** — series name and order number now display on library book cards.
- **Scanner Instructions** — ISBN scanner overlay shows instruction text and animated scanning guide.

### Fixed
- **30-Day Stat Bug** — audiobook sessions now store the actual listening delta instead of the absolute position, fixing inflated stats in the dashboard chart.
- **Deploy Script** — replaced `mput` with individual `put` commands to prevent files being uploaded to wrong destinations.
- **Dark Mode** — filter tabs, genre tags, and topic tags now render correctly in dark mode.

## [1.9.0] - 2026-02-21

### Added
- **30-Day Dashboard View** — new "Last 30 Days" filter with stacked daily activity bar chart (reading vs. listening minutes) and period summary stats (days active, books finished, total time).
- **Cover Image Proxy** — ISBN-fetched cover images are now downloaded and cached locally, eliminating lag on every page load (`api/upload/proxy_cover.php`).
- **Report Issue** — 🐛 link in the overflow menu opens GitHub Issues for quick bug reporting.
- **Audiobook Position Input** — replaced plain number field with hh:mm time-position inputs for audiobook reading sessions, with a hint showing the current position.

### Changed
- **Log Reading Icon** — replaced pencil/edit icon with a clock icon to visually distinguish "Log Reading" from "Edit Book".
- **Session Validation** — page/percentage/position inputs are now validated per format before submission instead of a single generic `required` check.
- **Database Schema** — consolidated schema file now includes all migrations through v6 (user roles, display names, series & goals tables, series columns on books).

### Fixed
- Timer start button is now hidden for audiobooks (time is tracked externally).
- Removed unused legacy files (`src/counter.js`, `src/javascript.svg`).

## [1.8.0] - 2026-02-15

### Changed
- **Header** — replaced cluttered buttons with clean ⋯ overflow menu (Dark Mode, Settings, Logout)
- **Log Reading** — replaced hidden text button with floating action button (FAB) in bottom-right
- **Goal Widget** — compact inline banner with mini ring instead of large section
- **Up Next** — small cover thumbnails in horizontal scroll instead of full cards
- **Dashboard Stats** — redesigned from 9 large boxes to compact status pills + clean metric rows
- **Carousel** — fixed first/last slide alignment + shadow clipping on mobile

## [1.7.0] - 2026-02-15

### Added
- **Reading Goals** — set a yearly book/page target; animated ring widget on home screen tracks progress.
- **Reading Timer** — start/stop timer in the session log modal; auto-fills duration; persists across reloads; floating chip in header shows active timer.
- **Book Series Tracking** — create series, assign books with order numbers; series dropdown on book form.
- **Data Backup/Restore** — export all data as JSON; import with duplicate detection and transactional safety.
- Settings modal (⚙️ gear button in header) for managing goals and data backup.
- Database migration v5 (reading_goals + series tables, series columns on books).

## [1.0.0] - 2026-02-15

### Added
- Initial release of Bokbad book tracking application.
- User authentication (login/logout).
- Book management (add, edit, delete).
- Cover image upload from camera/gallery.
- Open Library ISBN lookup integration.
- Reading status tracking (Want to Read, Reading, Read).
- Statistics dashboard and yearly summaries.
- Mobile-responsive design.
