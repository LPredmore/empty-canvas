-- Phase 1: Idempotency fixes for conversation continuity

-- 1. Add source_conversation_id to profile_notes for deduplication during re-analysis
ALTER TABLE profile_notes 
ADD COLUMN source_conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL;

-- 2. Create unique constraint to prevent duplicate analysis notes per conversation
-- This allows upsert behavior: same person+conversation+type = update, not duplicate
CREATE UNIQUE INDEX idx_profile_notes_source_unique 
ON profile_notes(user_id, person_id, source_conversation_id, type)
WHERE source_conversation_id IS NOT NULL AND person_id IS NOT NULL;

-- 3. Add content_hash to messages for duplicate detection
ALTER TABLE messages 
ADD COLUMN content_hash text;

-- 4. Index for efficient duplicate lookup
CREATE INDEX idx_messages_content_hash 
ON messages(content_hash) 
WHERE content_hash IS NOT NULL;

-- 5. Add amendment_history to conversations to track appends
ALTER TABLE conversations 
ADD COLUMN amendment_history jsonb DEFAULT '[]'::jsonb;