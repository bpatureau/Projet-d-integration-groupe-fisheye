-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('pending', 'answered', 'missed');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "calendar_id" VARCHAR(255),
    "teams_webhook_url" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "username" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "gmail_email" VARCHAR(255),
    "teams_email" VARCHAR(255),
    "preferences" JSONB NOT NULL DEFAULT '{"notifyOnTeams": true, "buzzerEnabled": true}',
    "role" "Role" NOT NULL DEFAULT 'USER',
    "manual_status" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_locations" (
    "teacher_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_locations_pkey" PRIMARY KEY ("teacher_id","location_id")
);

-- CreateTable
CREATE TABLE "doorbells" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "device_id" VARCHAR(255) NOT NULL,
    "mqtt_client_id" VARCHAR(255) NOT NULL,
    "location_id" UUID NOT NULL,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "last_seen" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doorbells_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buzzers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "device_id" VARCHAR(255) NOT NULL,
    "mqtt_client_id" VARCHAR(255) NOT NULL,
    "teacher_id" UUID NOT NULL,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "last_seen" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buzzers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "led_panels" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "device_id" VARCHAR(255) NOT NULL,
    "mqtt_client_id" VARCHAR(255) NOT NULL,
    "location_id" UUID NOT NULL,
    "selected_teacher_id" UUID,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "last_seen" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "led_panels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "doorbell_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "target_teacher_id" UUID,
    "status" "VisitStatus" NOT NULL DEFAULT 'pending',
    "answered_by_id" UUID,
    "answered_at" TIMESTAMPTZ(6),
    "door_opened" BOOLEAN NOT NULL DEFAULT false,
    "door_opened_at" TIMESTAMPTZ(6),
    "auto_miss_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "calendar_id" VARCHAR(255) NOT NULL,
    "event_id" VARCHAR(255) NOT NULL,
    "location_id" UUID NOT NULL,
    "teacher_email" VARCHAR(255) NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT,
    "start_time" TIMESTAMPTZ(6) NOT NULL,
    "end_time" TIMESTAMPTZ(6) NOT NULL,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "last_sync" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "text" TEXT NOT NULL,
    "sender_info" VARCHAR(255),
    "visit_id" UUID,
    "target_teacher_id" UUID,
    "target_location_id" UUID,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_locations_calendar_id" ON "locations"("calendar_id");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_username_key" ON "teachers"("username");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_email_key" ON "teachers"("email");

-- CreateIndex
CREATE INDEX "idx_teachers_username" ON "teachers"("username");

-- CreateIndex
CREATE INDEX "idx_teachers_email" ON "teachers"("email");

-- CreateIndex
CREATE INDEX "idx_teachers_gmail_email" ON "teachers"("gmail_email");

-- CreateIndex
CREATE INDEX "idx_teacher_location_teacher" ON "teacher_locations"("teacher_id");

-- CreateIndex
CREATE INDEX "idx_teacher_location_location" ON "teacher_locations"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "doorbells_device_id_key" ON "doorbells"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "doorbells_mqtt_client_id_key" ON "doorbells"("mqtt_client_id");

-- CreateIndex
CREATE INDEX "idx_doorbells_device_id" ON "doorbells"("device_id");

-- CreateIndex
CREATE INDEX "idx_doorbells_mqtt_client_id" ON "doorbells"("mqtt_client_id");

-- CreateIndex
CREATE INDEX "idx_doorbells_location_id" ON "doorbells"("location_id");

-- CreateIndex
CREATE INDEX "idx_doorbells_is_online" ON "doorbells"("is_online");

-- CreateIndex
CREATE UNIQUE INDEX "buzzers_device_id_key" ON "buzzers"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "buzzers_mqtt_client_id_key" ON "buzzers"("mqtt_client_id");

-- CreateIndex
CREATE UNIQUE INDEX "buzzers_teacher_id_key" ON "buzzers"("teacher_id");

-- CreateIndex
CREATE INDEX "idx_buzzers_device_id" ON "buzzers"("device_id");

-- CreateIndex
CREATE INDEX "idx_buzzers_mqtt_client_id" ON "buzzers"("mqtt_client_id");

-- CreateIndex
CREATE INDEX "idx_buzzers_teacher_id" ON "buzzers"("teacher_id");

-- CreateIndex
CREATE INDEX "idx_buzzers_is_online" ON "buzzers"("is_online");

-- CreateIndex
CREATE UNIQUE INDEX "led_panels_device_id_key" ON "led_panels"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "led_panels_mqtt_client_id_key" ON "led_panels"("mqtt_client_id");

-- CreateIndex
CREATE INDEX "idx_led_panels_device_id" ON "led_panels"("device_id");

-- CreateIndex
CREATE INDEX "idx_led_panels_mqtt_client_id" ON "led_panels"("mqtt_client_id");

-- CreateIndex
CREATE INDEX "idx_led_panels_location_id" ON "led_panels"("location_id");

-- CreateIndex
CREATE INDEX "idx_led_panels_selected_teacher_id" ON "led_panels"("selected_teacher_id");

-- CreateIndex
CREATE INDEX "idx_led_panels_is_online" ON "led_panels"("is_online");

-- CreateIndex
CREATE INDEX "idx_visits_doorbell_id" ON "visits"("doorbell_id");

-- CreateIndex
CREATE INDEX "idx_visits_location_id" ON "visits"("location_id");

-- CreateIndex
CREATE INDEX "idx_visits_target_teacher_id" ON "visits"("target_teacher_id");

-- CreateIndex
CREATE INDEX "idx_visits_answered_by_id" ON "visits"("answered_by_id");

-- CreateIndex
CREATE INDEX "idx_visits_status" ON "visits"("status");

-- CreateIndex
CREATE INDEX "idx_visits_created_at" ON "visits"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_visits_status_auto_miss" ON "visits"("status", "auto_miss_at");

-- CreateIndex
CREATE UNIQUE INDEX "schedules_event_id_key" ON "schedules"("event_id");

-- CreateIndex
CREATE INDEX "idx_schedules_event_id" ON "schedules"("event_id");

-- CreateIndex
CREATE INDEX "idx_schedules_calendar_id" ON "schedules"("calendar_id");

-- CreateIndex
CREATE INDEX "idx_schedules_location_id" ON "schedules"("location_id");

-- CreateIndex
CREATE INDEX "idx_schedules_teacher_email" ON "schedules"("teacher_email");

-- CreateIndex
CREATE INDEX "idx_schedules_start_time" ON "schedules"("start_time");

-- CreateIndex
CREATE INDEX "idx_messages_visit_id" ON "messages"("visit_id");

-- CreateIndex
CREATE INDEX "idx_messages_target_teacher_id" ON "messages"("target_teacher_id");

-- CreateIndex
CREATE INDEX "idx_messages_target_location_id" ON "messages"("target_location_id");

-- CreateIndex
CREATE INDEX "idx_messages_is_read" ON "messages"("is_read");

-- CreateIndex
CREATE INDEX "idx_messages_created_at" ON "messages"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "teacher_locations" ADD CONSTRAINT "teacher_locations_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_locations" ADD CONSTRAINT "teacher_locations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doorbells" ADD CONSTRAINT "doorbells_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buzzers" ADD CONSTRAINT "buzzers_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "led_panels" ADD CONSTRAINT "led_panels_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "led_panels" ADD CONSTRAINT "led_panels_selected_teacher_id_fkey" FOREIGN KEY ("selected_teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_doorbell_id_fkey" FOREIGN KEY ("doorbell_id") REFERENCES "doorbells"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_target_teacher_id_fkey" FOREIGN KEY ("target_teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_answered_by_id_fkey" FOREIGN KEY ("answered_by_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_target_teacher_id_fkey" FOREIGN KEY ("target_teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_target_location_id_fkey" FOREIGN KEY ("target_location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
