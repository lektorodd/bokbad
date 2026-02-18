# 🚨 Emergency Fix: Repairing the Live App

I found the issue! The app is broken because of two things:
1.  **Missing File:** The app is looking for `api/books/reading_sessions.php` but can't find it (404 error).
2.  **Data Mismatch:** The frontend expects `books` but the backend is sending `bokbad_books`.

Here is the quick fix to get everything working immediately.

## Step 1: Upload the Fixed Backend Files

I have fixed the code on your computer. You just need to upload these **2 files** to `bok.lektorodd.no_/api/books/`:

1.  **Open Cyberduck**
2.  Navigate to `bok.lektorodd.no_/api/books/`
3.  Upload (drag & drop) these files from your computer:
    *   `api/books/index.php` (I fixed the data key issue)
    *   `api/books/reading_sessions.php` (I created this missing file)

## Step 2: Refresh and Test

1.  Go to [https://bok.lektorodd.no](https://bok.lektorodd.no)
2.  **Hard Refresh** (Cmd+Shift+R)
3.  The app should load effectively!

---

**Explanation of the Fix:**
-   **`index.php`**: I changed it to read from the new table `bokbad_books` but send the data back as `books` (so the frontend works).
-   **`reading_sessions.php`**: I created this file so the frontend stops getting a 404 error, which was crashing the app.
