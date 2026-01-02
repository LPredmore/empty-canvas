-- Table to store conversation-level analysis results
CREATE TABLE public.conversation_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  user_id uuid DEFAULT auth.uid(),
  summary text NOT NULL,
  overall_tone text NOT NULL,
  key_topics jsonb DEFAULT '[]'::jsonb,
  agreement_violations jsonb DEFAULT '[]'::jsonb,
  message_annotations jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Enable RLS
ALTER TABLE public.conversation_analyses ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users can manage their own conversation analyses"
ON public.conversation_analyses
FOR ALL
USING (auth.uid() = user_id);

-- Table to link conversations to issues (conversation-level, not just message-level)
CREATE TABLE public.conversation_issue_links (
  conversation_id uuid NOT NULL,
  issue_id uuid NOT NULL,
  user_id uuid DEFAULT auth.uid(),
  link_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, issue_id, user_id)
);

-- Enable RLS
ALTER TABLE public.conversation_issue_links ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users can manage their own conversation issue links"
ON public.conversation_issue_links
FOR ALL
USING (auth.uid() = user_id);

-- Add index for faster lookups
CREATE INDEX idx_conversation_analyses_conversation_id ON public.conversation_analyses(conversation_id);
CREATE INDEX idx_conversation_issue_links_issue_id ON public.conversation_issue_links(issue_id);
CREATE INDEX idx_conversation_issue_links_conversation_id ON public.conversation_issue_links(conversation_id);