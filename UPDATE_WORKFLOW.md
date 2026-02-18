# Bokbad Update Workflow

Quick checklist for deploying updates to your live site.

---

## When I Make Code Changes

Follow these steps to get updates live on bok.lektorodd.no:

### Pre-Release Checklist
Before building or deploying, ensure you have:
- [ ] Updated `CHANGELOG.md` with your changes
- [ ] Bumped the version number in `README.md` (and `package.json` if applicable)

### For Backend Changes (PHP files in `api/`)

**No rebuild needed - just upload!**

- [ ] 1. Open Cyberduck and connect to your server
- [ ] 2. Navigate to `bok.lektorodd.no_/api/`
- [ ] 3. Upload the changed PHP file(s)
- [ ] 4. Test on bok.lektorodd.no (refresh browser)

**Example:** For the ISBN update I just made:
- Upload: `/Users/torodd/GitHub/bokbad/api/metadata/isbn.php`
- To: `bok.lektorodd.no_/api/metadata/isbn.php`

---

### For Frontend Changes (HTML, CSS, JavaScript)

**Requires rebuild!**

- [ ] 1. Open Terminal
- [ ] 2. Navigate to project: `cd /Users/torodd/GitHub/bokbad`
- [ ] 3. Build: `npm run build`
- [ ] 4. Open Cyberduck and connect to server
- [ ] 5. Navigate to `bok.lektorodd.no_/`
- [ ] 6. Upload files from `dist/` folder:
  - `index.html`
  - `assets/` folder (all files)
- [ ] 7. Clear browser cache and test

---

### For Database Changes

**Use phpMyAdmin**

- [ ] 1. Log into one.com control panel
- [ ] 2. Open phpMyAdmin
- [ ] 3. Select `cmhjbthip_bokbad` database
- [ ] 4. Run SQL queries or import schema

---

## Current Update: Enhanced ISBN Lookup

**What changed:** Added Open Library fallback for better international book coverage

**Files to upload:**
1. `api/metadata/isbn.php` ← Upload this file

**Steps:**
1. Open Cyberduck
2. Connect to your server
3. Navigate to `bok.lektorodd.no_/api/metadata/`
4. Drag `api/metadata/isbn.php` from your local folder
5. Confirm overwrite
6. Test by trying ISBN lookup on your site

---

## Quick Reference

| Change Type | Rebuild? | Upload Location |
|-------------|----------|-----------------|
| PHP backend | ❌ No | `bok.lektorodd.no_/api/` |
| Frontend | ✅ Yes | `bok.lektorodd.no_/` (from `dist/`) |
| Database | N/A | phpMyAdmin |
| Config | ❌ No | `bok.lektorodd.no_/api/config/` |

---

## Tips

- **Backend changes** are instant (just upload)
- **Frontend changes** need `npm run build` first
- **Always test** after uploading
- **Clear browser cache** if changes don't appear (Cmd+Shift+R)
- **Backup database** before major changes

---

## Troubleshooting

**Changes not showing?**
- Clear browser cache (Cmd+Shift+R)
- Check you uploaded to correct folder
- Verify file uploaded completely (check file size)

**Build fails?**
- Run `npm install` first
- Check for error messages
- Make sure you're in `/Users/torodd/GitHub/bokbad`

**Upload fails?**
- Check SFTP connection
- Verify file permissions
- Try re-uploading
