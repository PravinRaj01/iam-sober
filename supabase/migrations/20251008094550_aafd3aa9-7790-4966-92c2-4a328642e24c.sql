-- Drop the old check constraint
ALTER TABLE community_reactions DROP CONSTRAINT IF EXISTS community_reactions_reaction_type_check;

-- Add new check constraint with updated reaction types
ALTER TABLE community_reactions ADD CONSTRAINT community_reactions_reaction_type_check 
CHECK (reaction_type IN ('love', 'comment'));