-- The note API accepts descriptions shorter than 1000 characters.
ALTER TABLE notes ALTER COLUMN description TYPE VARCHAR(1000);
