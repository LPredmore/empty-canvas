-- Update existing role values to new format
UPDATE people SET role = 'Parent' WHERE role = 'parent';
UPDATE people SET role = 'Child' WHERE role = 'child';
UPDATE people SET role = 'Me' WHERE role = 'me';
UPDATE people SET role = 'Step-Parent' WHERE role = 'step_parent';
UPDATE people SET role = 'Clinician' WHERE role = 'therapist';
UPDATE people SET role = 'Legal' WHERE role IN ('lawyer', 'judge');
UPDATE people SET role = 'Other' WHERE role = 'other';