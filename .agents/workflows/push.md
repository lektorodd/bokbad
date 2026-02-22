---
description: How to commit and push changes to GitHub
---

// turbo-all

## Steps

1. **Update CHANGELOG.md** — Add a new version entry at the top with the changes made. Follow the [Keep a Changelog](https://keepachangelog.com) format with `### Added`, `### Changed`, `### Fixed` sections as needed.

2. **Bump version in `package.json`** — Update the `"version"` field. Use semver: patch for fixes, minor for features.

3. **Update README.md version badge** — Update the version number in the badge on line 1: `![Version](https://img.shields.io/badge/version-X.Y.Z-blue.svg)`

4. **Stage all changes:**
```bash
git add -A
```

5. **Commit with descriptive message:**
```bash
git commit -m "vX.Y.Z: short summary

- bullet point details of changes"
```

6. **Push to GitHub:**
```bash
git push origin main
```

> **IMPORTANT:** Steps 1-3 (CHANGELOG, package.json, README badge) must ALWAYS be done before committing. Never push without updating these files first.
