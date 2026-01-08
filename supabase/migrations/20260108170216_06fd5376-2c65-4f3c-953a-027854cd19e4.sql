-- Create a case-insensitive unique index on issues to prevent duplicate titles per user
-- Uses LOWER(TRIM(title)) for normalization
CREATE UNIQUE INDEX IF NOT EXISTS issues_user_id_title_lower_idx 
ON issues (user_id, LOWER(TRIM(title)));

-- Add a comment explaining the purpose
COMMENT ON INDEX issues_user_id_title_lower_idx IS 
  'Prevents duplicate issue titles per user (case-insensitive, trimmed)';