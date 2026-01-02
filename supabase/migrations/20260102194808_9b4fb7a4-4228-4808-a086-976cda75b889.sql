-- Add contribution tracking columns (all nullable for backward compatibility)
ALTER TABLE issue_people
ADD COLUMN IF NOT EXISTS contribution_type text DEFAULT 'involved',
ADD COLUMN IF NOT EXISTS contribution_description text,
ADD COLUMN IF NOT EXISTS contribution_valence text;

-- Add check constraint for valid contribution types
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_contribution_type') THEN
    ALTER TABLE issue_people
    ADD CONSTRAINT valid_contribution_type CHECK (
      contribution_type IS NULL OR contribution_type IN (
        'primary_contributor',
        'affected_party', 
        'secondary_contributor',
        'resolver',
        'enabler',
        'witness',
        'involved'
      )
    );
  END IF;
END $$;

-- Add check constraint for valid valence values
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_contribution_valence') THEN
    ALTER TABLE issue_people
    ADD CONSTRAINT valid_contribution_valence CHECK (
      contribution_valence IS NULL OR contribution_valence IN (
        'positive', 'negative', 'neutral', 'mixed'
      )
    );
  END IF;
END $$;

-- Add unique constraint for upsert operations (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_issue_person') THEN
    ALTER TABLE issue_people
    ADD CONSTRAINT unique_issue_person UNIQUE (issue_id, person_id);
  END IF;
END $$;

-- Comments for documentation
COMMENT ON COLUMN issue_people.contribution_type IS 'Role classification: primary_contributor, affected_party, secondary_contributor, resolver, enabler, witness, involved';
COMMENT ON COLUMN issue_people.contribution_description IS 'Specific description of what this person did or how they are affected';
COMMENT ON COLUMN issue_people.contribution_valence IS 'Whether contribution is positive, negative, neutral, or mixed';