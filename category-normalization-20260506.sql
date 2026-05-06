BEGIN;

-- Preview expected affected rows before any UPDATE
-- Expected row count: 0
SELECT id, category_key, category_label, category_type
FROM transactions
WHERE id IN ()
ORDER BY id;



-- Verify the preview row count and values before running the UPDATE statements below.

COMMIT;
