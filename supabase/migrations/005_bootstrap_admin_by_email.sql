-- Optional: set the first admin by email. Run once after replacing YOUR_EMAIL with the actual email.
-- Example: UPDATE members SET is_admin = true WHERE email = 'admin@example.com';
-- Then either remove this migration or leave it (idempotent: safe to run again).
UPDATE members
SET is_admin = true
WHERE email = 'YOUR_EMAIL'
  AND is_admin = false;
