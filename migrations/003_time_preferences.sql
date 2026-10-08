-- Viewing preferences belong to the authenticated user, never the project.
CREATE TABLE IF NOT EXISTS time_preferences (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope text NOT NULL,
  filter jsonb NOT NULL,
  PRIMARY KEY (user_id, scope)
);
