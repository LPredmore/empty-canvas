-- Add status column with default 'open'
ALTER TABLE conversations
ADD COLUMN status text NOT NULL DEFAULT 'open';

-- Add pending responder reference
ALTER TABLE conversations
ADD COLUMN pending_responder_id uuid;

-- Add constraint for valid status values
ALTER TABLE conversations
ADD CONSTRAINT conversations_status_check 
CHECK (status IN ('open', 'resolved'));

-- Index for common query patterns
CREATE INDEX idx_conversations_status_user 
ON conversations(user_id, status);

CREATE INDEX idx_conversations_pending_responder 
ON conversations(pending_responder_id) 
WHERE pending_responder_id IS NOT NULL;