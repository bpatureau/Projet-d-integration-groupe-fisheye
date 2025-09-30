-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL DEFAULT 'doorbell' CHECK (type IN ('doorbell', 'motion')),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'missed', 'ignored')),
  has_message BOOLEAN NOT NULL DEFAULT FALSE,
  message_filename VARCHAR(255),
  message_filepath VARCHAR(500),
  message_size BIGINT,
  message_duration INTEGER, -- seconds
  message_listened BOOLEAN NOT NULL DEFAULT FALSE,
  message_listened_at TIMESTAMP WITH TIME ZONE,
  answered_at TIMESTAMP WITH TIME ZONE,
  response_time INTEGER, -- seconds
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_visits_created_at ON visits(created_at DESC);
CREATE INDEX idx_visits_status ON visits(status);
CREATE INDEX idx_visits_has_message ON visits(has_message) WHERE has_message = true;
CREATE INDEX idx_visits_message_listened ON visits(message_listened) WHERE message_listened = false AND has_message = true;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE visits;
-- +goose StatementEnd