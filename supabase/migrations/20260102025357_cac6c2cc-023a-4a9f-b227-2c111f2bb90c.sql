-- Create issue_people junction table for linking issues to people
CREATE TABLE public.issue_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  involvement_type text DEFAULT 'involved',
  user_id uuid DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(issue_id, person_id)
);

-- Enable Row Level Security
ALTER TABLE public.issue_people ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can manage their own issue people links"
  ON public.issue_people FOR ALL
  USING (auth.uid() = user_id);

-- Create indexes for efficient querying
CREATE INDEX idx_issue_people_issue ON public.issue_people(issue_id);
CREATE INDEX idx_issue_people_person ON public.issue_people(person_id);