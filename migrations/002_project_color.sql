ALTER TABLE projects ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#7292c7' CHECK (color ~ '^#[0-9a-fA-F]{6}$');
