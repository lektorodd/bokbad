# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
