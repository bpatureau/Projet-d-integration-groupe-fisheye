-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level VARCHAR(20) NOT NULL CHECK (level IN ('debug', 'info', 'warning', 'error')),
  message TEXT NOT NULL,
  component VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_component ON system_logs(component);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE system_logs;
-- +goose StatementEnd