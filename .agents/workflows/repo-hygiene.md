---
description: Rules for keeping repositories clean and professional
---

## AI-Generated Docs

Never commit AI-generated documentation files (e.g. `EMERGENCY_FIX.md`, `DEPLOYMENT.md`, `MIGRATION_GUIDE.md`, `QUICKSTART.md`, `UPDATE_WORKFLOW.md`, `IMPLEMENTATION_PLAN.md`, `WALKTHROUGH.md`) to any repository.

Only `README.md` and `CHANGELOG.md` belong in the repo root.

These filenames should be listed in each repo's `.gitignore` under an `# AI-generated docs` section.
