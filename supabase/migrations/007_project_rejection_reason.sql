-- Add rejection_reason column to project_requests for rejected re-submit flow
ALTER TABLE project_requests
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
