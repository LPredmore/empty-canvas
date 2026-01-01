-- Add receiver_id column to messages table
ALTER TABLE messages 
ADD COLUMN receiver_id uuid REFERENCES people(id);

-- Add ended_at column to conversations table
ALTER TABLE conversations 
ADD COLUMN ended_at timestamp with time zone;

-- Backfill ended_at from the MAX sent_at of each conversation's messages
UPDATE conversations c
SET ended_at = (
  SELECT MAX(sent_at) 
  FROM messages m 
  WHERE m.conversation_id = c.id
);

-- Backfill started_at if null (from MIN sent_at)
UPDATE conversations c
SET started_at = (
  SELECT MIN(sent_at) 
  FROM messages m 
  WHERE m.conversation_id = c.id
)
WHERE started_at IS NULL;