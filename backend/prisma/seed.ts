import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "./generated/client.js";

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting fresh database seeding...");

  // 1. Clean up database
  console.log("Cleaning up existing data...");
  await prisma.message.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.teacherLocation.deleteMany();
  await prisma.ledPanel.deleteMany();
  await prisma.buzzer.deleteMany();
  await prisma.doorbell.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.location.deleteMany();

  console.log("Database cleaned.");

  // 2. Create Locations
  console.log("Création des locaux (EPHEC LLN)...");
  const locationsData = [
    {
      name: "Laboratoire Électronique (L201)",
      description: "Laboratoire pour les cours d'électronique et IoT",
      teamsWebhookUrl: process.env.TEAMS_WEBHOOK_URL,
      calendarId: process.env.GOOGLE_CALENDAR_ID,
    },
    {
      name: "Salle Réseau (L118)",
      description: "Salle équipée pour les TPs réseaux et serveurs",
    },
    {
      name: "Auditoire (LA01)",
      description: "Grand auditoire pour les cours magistraux",
    },
  ];

  const locations = [];
  for (const loc of locationsData) {
    const l = await prisma.location.create({ data: loc });
    locations.push(l);
    console.log(`Local créé: ${l.name}`);
  }

  // 3. Create Users (Teachers)
  console.log("Création des utilisateurs...");
  const defaultPasswordHash = await hash("password123", {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  // Custom admin password from env or default
  const adminPasswordHash = process.env.ADMIN_PASSWORD
    ? await hash(process.env.ADMIN_PASSWORD, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
      })
    : defaultPasswordHash;

  const usersData = [
    // Admins
    {
      username: "admin",
      email: "admin@ephec.be",
      name: "Simon Fontaine",
      role: "ADMIN" as const,
      passwordHash: adminPasswordHash,
      gmailEmail: process.env.ADMIN_GMAIL,
      teamsEmail: process.env.ADMIN_TEAMS_EMAIL,
    },
    {
      username: "casey_morgan",
      email: "casey_morgan@ephec.be",
      name: "Casey Morgan",
      role: "ADMIN" as const,
      passwordHash: defaultPasswordHash,
    },
    // Normal Users
    {
      username: "john_doe",
      email: "john_doe@ephec.be",
      name: "John Doe",
      role: "USER" as const,
      passwordHash: defaultPasswordHash,
    },
    {
      username: "jane_doe",
      email: "jane_doe@ephec.be",
      name: "Jane Doe",
      role: "USER" as const,
      passwordHash: defaultPasswordHash,
    },
    {
      username: "alex_smith",
      email: "alex_smith@ephec.be",
      name: "Alex Smith",
      role: "USER" as const,
      passwordHash: defaultPasswordHash,
    },
  ];

  const users = [];
  for (const u of usersData) {
    const user = await prisma.teacher.create({
      data: {
        username: u.username,
        email: u.email,
        passwordHash: u.passwordHash,
        name: u.name,
        role: u.role,
        gmailEmail: u.gmailEmail,
        teamsEmail: u.teamsEmail,
        preferences: { notifyOnTeams: false, buzzerEnabled: false },
      },
    });
    users.push(user);
    console.log(`Utilisateur créé: ${u.name} (${u.role})`);
  }

  // 4. Create Doorbells
  console.log("Création des sonnettes...");
  const doorbellsData = [
    {
      deviceId: "DOORBELL_001",
      mqttClientId: "doorbell_client_001",
      locationId: locations[0].id,
    },
    {
      deviceId: "DOORBELL_002",
      mqttClientId: "doorbell_client_002",
      locationId: locations[1].id,
    },
  ];

  for (const db of doorbellsData) {
    await prisma.doorbell.create({ data: db });
    console.log(`Sonnette créée: ${db.deviceId}`);
  }

  // 5. Create LED Panel
  console.log("Création du panneau LED...");
  const ledPanelData = {
    deviceId: "PANEL_001",
    mqttClientId: "panel_client_001",
    locationId: locations[0].id,
  };

  await prisma.ledPanel.create({ data: ledPanelData });
  console.log(`Panneau LED créé: ${ledPanelData.deviceId}`);

  // Assign some teachers to locations
  console.log("Assignation des professeurs aux locaux...");
  if (users.length > 0 && locations.length > 0) {
    await prisma.teacherLocation.create({
      data: { teacherId: users[0].id, locationId: locations[0].id },
    });
    await prisma.teacherLocation.create({
      data: { teacherId: users[2].id, locationId: locations[1].id },
    });
  }

  console.log("Peuplement de la base de données terminé.");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
