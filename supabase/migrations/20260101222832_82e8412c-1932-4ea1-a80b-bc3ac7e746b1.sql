-- Add role_context column to people table
ALTER TABLE people 
ADD COLUMN role_context text;

-- Create person_relationships junction table
CREATE TABLE person_relationships (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  related_person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  relationship_type text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  user_id uuid DEFAULT auth.uid(),
  CONSTRAINT no_self_reference CHECK (person_id != related_person_id)
);

-- Enable Row Level Security
ALTER TABLE person_relationships ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Enable all for users based on user_id" 
ON person_relationships FOR ALL 
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_person_relationships_person_id ON person_relationships(person_id);
CREATE INDEX idx_person_relationships_related_person_id ON person_relationships(related_person_id);