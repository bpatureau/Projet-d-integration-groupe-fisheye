-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_name VARCHAR(100) NOT NULL DEFAULT 'Fisheye Doorbell',
  do_not_disturb BOOLEAN NOT NULL DEFAULT FALSE,
  welcome_messages TEXT[] DEFAULT ARRAY['Welcome! Please ring the bell.', 'Someone will be with you shortly.'],
  message_rotation_seconds INTEGER DEFAULT 30,
  schedule JSONB DEFAULT '{"monday": {"enabled": true, "start": "09:00", "end": "18:00"}, "tuesday": {"enabled": true, "start": "09:00", "end": "18:00"}, "wednesday": {"enabled": true, "start": "09:00", "end": "18:00"}, "thursday": {"enabled": true, "start": "09:00", "end": "18:00"}, "friday": {"enabled": true, "start": "09:00", "end": "17:00"}, "saturday": {"enabled": false}, "sunday": {"enabled": false}}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ensure only one settings row exists
CREATE UNIQUE INDEX idx_settings_single_row ON settings ((true));
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE settings;
-- +goose StatementEnd