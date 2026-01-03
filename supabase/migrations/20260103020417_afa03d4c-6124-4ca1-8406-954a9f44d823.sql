-- Add user_guidance column for guided re-analysis feature
ALTER TABLE conversation_analyses 
ADD COLUMN user_guidance TEXT DEFAULT NULL;

COMMENT ON COLUMN conversation_analyses.user_guidance IS 
'User-provided questions or concerns that guided this analysis. NULL for standard analyses.';