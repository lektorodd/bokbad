-- Migration v7: Add finish_date_precision column
-- Allows tracking books where only year or month+year of completion is known

ALTER TABLE bokbad_books
  ADD COLUMN finish_date_precision ENUM('day','month','year') NOT NULL DEFAULT 'day'
  AFTER finish_date;
