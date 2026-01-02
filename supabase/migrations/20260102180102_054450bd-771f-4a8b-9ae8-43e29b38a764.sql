-- Create topic_categories lookup table
CREATE TABLE topic_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS: readable by all authenticated users (lookup table)
ALTER TABLE topic_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Topic categories readable by authenticated users"
  ON topic_categories FOR SELECT
  USING (auth.role() = 'authenticated');

-- Seed with existing categories (matching current AgreementCategory type)
INSERT INTO topic_categories (slug, display_name, description, sort_order) VALUES
  ('decision_making', 'Decision Making', 'Legal and joint decision-making authority', 1),
  ('parenting_time', 'Parenting Time', 'Regular custody schedules and time allocation', 2),
  ('holiday_schedule', 'Holiday Schedule', 'Holiday and special occasion schedules', 3),
  ('school', 'School', 'Education, school choice, and academic matters', 4),
  ('communication', 'Communication', 'Parent-to-parent and parent-child communication', 5),
  ('financial', 'Financial', 'Child support, expenses, and financial obligations', 6),
  ('travel', 'Travel', 'Domestic and international travel rules', 7),
  ('right_of_first_refusal', 'Right of First Refusal', 'Childcare priority when parent unavailable', 8),
  ('exchange', 'Exchange', 'Pickup, dropoff, and transition logistics', 9),
  ('medical', 'Medical', 'Healthcare, insurance, and medical decisions', 10),
  ('extracurricular', 'Extracurricular', 'Sports, activities, and enrichment programs', 11),
  ('technology', 'Technology', 'Screen time, devices, and social media', 12),
  ('third_party', 'Third Party', 'Rules about other adults, partners, and caregivers', 13),
  ('dispute_resolution', 'Dispute Resolution', 'Mediation, arbitration, and conflict resolution', 14),
  ('modification', 'Modification', 'How agreements can be changed', 15),
  ('other', 'Other', 'Miscellaneous provisions', 99);

-- Add topic_category_slugs to conversation_analyses
ALTER TABLE conversation_analyses 
ADD COLUMN topic_category_slugs jsonb DEFAULT '[]'::jsonb;

-- Add GIN index for efficient JSONB array queries
CREATE INDEX idx_conversation_analyses_categories 
ON conversation_analyses USING GIN (topic_category_slugs);

COMMENT ON COLUMN conversation_analyses.topic_category_slugs IS 
  'Normalized topic categories (array of slugs from topic_categories table)';