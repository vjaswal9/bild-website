-- Early lead capture (join form step 1) can happen before an email address
-- is known, so email can no longer be required at insert time.
ALTER TABLE members ALTER COLUMN email DROP NOT NULL;
