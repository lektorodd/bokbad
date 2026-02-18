# Update Guide: Database & Code Changes

You've renamed your database tables to `bokbad_books` and `bokbad_reading_sessions`. This requires a database update on your live server.

## Step 1: Update the Live Database (Do this first!)

1.  Log into your **one.com control panel**.
2.  Open **phpMyAdmin**.
3.  Select your database (`cmhjbthip_bokbad`).
4.  Click the **"SQL"** tab at the top.
5.  Paste and run this command:

```sql
RENAME TABLE books TO bokbad_books;
```

*(If you have a `reading_sessions` table, also run: `RENAME TABLE reading_sessions TO bokbad_reading_sessions;`)*

**Why?** Your new code looks for `bokbad_books`, but your live database still has the old name `books`. This connects them.

---

## Step 2: Upload Updated Backend Code

Open **Cyberduck** and upload these updated files to `bok.lektorodd.no_/api/`:

1.  Navigate to `bok.lektorodd.no_/api/books/`
    *   Upload `index.php` (Overwrite existing)
2.  Navigate to `bok.lektorodd.no_/api/stats/`
    *   Upload `yearly.php` (Overwrite existing)
    *   Upload `summary.php` (Overwrite existing)

---

## Step 3: Upload Frontend (If you haven't already)

If you haven't uploaded the latest UI build yet:

1.  In Terminal, run: `npm run build`
2.  In Cyberduck, navigate to `bok.lektorodd.no_/`
3.  Upload contents of `dist/` (`index.html`, `assets/`, etc.)

---

## Step 4: Verify

1.  Go to [https://bok.lektorodd.no](https://bok.lektorodd.no)
2.  Refresh the page (Cmd+Shift+R)
3.  Your books should still be there! (The rename preserves data)
4.  Test adding a new book to make sure the new table name works.
