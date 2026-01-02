-- Add override tracking columns to agreement_items
ALTER TABLE agreement_items ADD COLUMN overrides_item_id uuid REFERENCES agreement_items(id);
ALTER TABLE agreement_items ADD COLUMN override_status text CHECK (override_status IN ('active', 'disputed', 'withdrawn'));
ALTER TABLE agreement_items ADD COLUMN contingency_condition text;
ALTER TABLE agreement_items ADD COLUMN source_conversation_id uuid REFERENCES conversations(id);
ALTER TABLE agreement_items ADD COLUMN source_message_id uuid REFERENCES messages(id);
ALTER TABLE agreement_items ADD COLUMN detected_at timestamptz;

-- Create index for efficient override chain traversal
CREATE INDEX idx_agreement_items_overrides ON agreement_items(overrides_item_id) WHERE overrides_item_id IS NOT NULL;

-- Create function to get effective agreement item for a topic
-- Traverses override chain to find the currently active item
CREATE OR REPLACE FUNCTION get_effective_agreement_item(p_user_id uuid, p_topic text)
RETURNS TABLE(
  id uuid,
  agreement_id uuid,
  topic text,
  full_text text,
  summary text,
  item_ref text,
  is_active boolean,
  overrides_item_id uuid,
  override_status text,
  contingency_condition text,
  source_conversation_id uuid,
  source_message_id uuid,
  detected_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE override_chain AS (
    -- Start with base items (no overrides_item_id) for the topic
    SELECT 
      ai.*,
      1 as depth
    FROM agreement_items ai
    WHERE ai.user_id = p_user_id 
      AND ai.topic = p_topic 
      AND ai.is_active = true
      AND ai.overrides_item_id IS NULL
    
    UNION ALL
    
    -- Find items that override items in the chain
    SELECT 
      child.*,
      parent.depth + 1
    FROM agreement_items child
    JOIN override_chain parent ON child.overrides_item_id = parent.id
    WHERE child.user_id = p_user_id
      AND child.is_active = true
  ),
  -- Find the deepest active override
  effective_items AS (
    SELECT oc.*
    FROM override_chain oc
    WHERE (oc.override_status IS NULL OR oc.override_status = 'active')
    ORDER BY oc.depth DESC
    LIMIT 1
  )
  SELECT 
    e.id,
    e.agreement_id,
    e.topic,
    e.full_text,
    e.summary,
    e.item_ref,
    e.is_active,
    e.overrides_item_id,
    e.override_status,
    e.contingency_condition,
    e.source_conversation_id,
    e.source_message_id,
    e.detected_at,
    e.created_at
  FROM effective_items e;
$$;

-- Create function to get the full override chain for an item
CREATE OR REPLACE FUNCTION get_agreement_item_override_chain(p_item_id uuid)
RETURNS TABLE(
  id uuid,
  agreement_id uuid,
  topic text,
  full_text text,
  summary text,
  item_ref text,
  is_active boolean,
  overrides_item_id uuid,
  override_status text,
  contingency_condition text,
  source_conversation_id uuid,
  source_message_id uuid,
  detected_at timestamptz,
  created_at timestamptz,
  chain_depth int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE chain_up AS (
    -- Start with the given item
    SELECT ai.*, 0 as chain_depth
    FROM agreement_items ai
    WHERE ai.id = p_item_id
    
    UNION ALL
    
    -- Walk up to find what this item overrides
    SELECT parent.*, child.chain_depth - 1
    FROM agreement_items parent
    JOIN chain_up child ON child.overrides_item_id = parent.id
  ),
  chain_down AS (
    -- Start with the given item
    SELECT ai.*, 0 as chain_depth
    FROM agreement_items ai
    WHERE ai.id = p_item_id
    
    UNION ALL
    
    -- Walk down to find items that override this one
    SELECT child.*, parent.chain_depth + 1
    FROM agreement_items child
    JOIN chain_down parent ON child.overrides_item_id = parent.id
  ),
  full_chain AS (
    SELECT * FROM chain_up WHERE chain_depth < 0
    UNION
    SELECT * FROM chain_down
  )
  SELECT 
    fc.id,
    fc.agreement_id,
    fc.topic,
    fc.full_text,
    fc.summary,
    fc.item_ref,
    fc.is_active,
    fc.overrides_item_id,
    fc.override_status,
    fc.contingency_condition,
    fc.source_conversation_id,
    fc.source_message_id,
    fc.detected_at,
    fc.created_at,
    fc.chain_depth
  FROM full_chain fc
  ORDER BY fc.chain_depth;
$$;