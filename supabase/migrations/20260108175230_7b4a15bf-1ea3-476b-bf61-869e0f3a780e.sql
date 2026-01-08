-- Create analysis_runs table for tracking multi-stage pipeline progress
CREATE TABLE IF NOT EXISTS analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  current_stage text,
  completed_stages jsonb DEFAULT '[]'::jsonb,
  stage_outputs jsonb DEFAULT '{}'::jsonb,
  error_message text,
  error_stage text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE analysis_runs ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own analysis runs
CREATE POLICY "Users can manage their own analysis runs" 
  ON analysis_runs FOR ALL USING (user_id = auth.uid());

-- Indexes for common queries
CREATE INDEX idx_analysis_runs_conversation ON analysis_runs(conversation_id);
CREATE INDEX idx_analysis_runs_status ON analysis_runs(status);

-- Prevents concurrent analyses for same conversation per user
CREATE UNIQUE INDEX idx_analysis_runs_active 
  ON analysis_runs(conversation_id, user_id) 
  WHERE status IN ('pending', 'running');