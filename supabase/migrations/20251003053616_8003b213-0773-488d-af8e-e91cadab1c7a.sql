-- Add sentiment column to journal_entries for AI analysis
ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS sentiment JSONB;

COMMENT ON COLUMN journal_entries.sentiment IS 'Stores AI-analyzed sentiment data: {"label": "positive|negative|neutral", "score": 0.0-1.0}';