# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
