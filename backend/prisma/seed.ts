import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "./generated/client.js";

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface SeedData {
  locations: Array<{
    name: string;
    description: string;
    calendarId?: string;
    teamsWebhookUrl?: string;
  }>;
  teachers: Array<{
    username: string;
    email: string;
    password: string;
    name: string;
    gmailEmail?: string;
    teamsEmail?: string;
    preferences: {
      notifyOnTeams: boolean;
      buzzerEnabled: boolean;
    };
    role?: "ADMIN" | "USER";
  }>;
  devices: {
    doorbells: Array<{
      deviceId: string;
      mqttClientId: string;
      locationName: string;
      hasDoorSensor: boolean;
    }>;
    buzzers: Array<{
      deviceId: string;
      mqttClientId: string;
      teacherUsername: string;
    }>;
    ledPanels: Array<{
      deviceId: string;
      mqttClientId: string;
      locationName: string;
    }>;
  };
  teacherLocationAssignments: Array<{
    teacherUsername: string;
    locationName: string;
  }>;
}

const seedData: SeedData = {
  locations: [
    {
      name: "Labo d'électronique",
      description: "Bureau et laboratoire d'électronique",
      calendarId:
        "51229adc55b98f4bfb4d67f28f23bc9f07049634134b5b0782aa85f06a21df4f@group.calendar.google.com",
    },
  ],
  teachers: [
    {
      username: "admin",
      email: "s.fontaine@students.ephec.be",
      password: "admin",
      name: "Simon Fontaine",
      gmailEmail: "simfon07@gmail.com",
      teamsEmail: "s.fontaine@students.ephec.be",
      preferences: {
        notifyOnTeams: true,
        buzzerEnabled: true,
      },
      role: "ADMIN",
    },
    {
      username: "user",
      email: "user@example.com",
      password: "user",
      name: "Regular User",
      preferences: {
        notifyOnTeams: false,
        buzzerEnabled: false,
      },
      role: "USER",
    },
  ],
  devices: {
    doorbells: [
      {
        deviceId: "DOORBELL_001",
        mqttClientId: "doorbell_client_001",
        locationName: "Labo d'électronique",
        hasDoorSensor: true,
      },
    ],
    buzzers: [
      {
        deviceId: "BUZZER_001",
        mqttClientId: "buzzer_client_001",
        teacherUsername: "admin",
      },
    ],
    ledPanels: [
      {
        deviceId: "PANEL_001",
        mqttClientId: "panel_client_001",
        locationName: "Labo d'électronique",
      },
    ],
  },
  teacherLocationAssignments: [
    { teacherUsername: "admin", locationName: "Labo d'électronique" },
    { teacherUsername: "john.doe", locationName: "Labo d'électronique" },
  ],
};

async function main() {
  console.log("Starting database seeding...\n");

  // Check if database is already seeded
  const existingTeachers = await prisma.teacher.count();
  const existingLocations = await prisma.location.count();
  const existingDoorbells = await prisma.doorbell.count();

  if (existingTeachers > 1 || existingLocations > 0 || existingDoorbells > 0) {
    console.log("Database already contains data. Skipping seed.");
    console.log(
      `Teachers: ${existingTeachers}, Locations: ${existingLocations}, Doorbells: ${existingDoorbells}`,
    );
    console.log("\nTo re-seed, run: npm run prisma:reset\n");
    return;
  }

  // Create locations
  console.log("Creating locations...");
  const locationMap = new Map<string, string>();

  for (const locationData of seedData.locations) {
    const location = await prisma.location.create({
      data: locationData,
    });
    locationMap.set(locationData.name, location.id);
    console.log(`Created location: ${locationData.name}`);
  }

  // Create teachers
  console.log("\nCreating teachers...");
  const teacherMap = new Map<string, string>();

  for (const teacherData of seedData.teachers) {
    const passwordHash = await hash(teacherData.password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    const teacher = await prisma.teacher.create({
      data: {
        username: teacherData.username,
        email: teacherData.email,
        passwordHash,
        name: teacherData.name,
        gmailEmail: teacherData.gmailEmail,
        teamsEmail: teacherData.teamsEmail,
        preferences: teacherData.preferences,
        role: teacherData.role || "USER",
      },
    });
    teacherMap.set(teacherData.username, teacher.id);
    console.log(
      `Created teacher: ${teacherData.name} (${teacherData.username})`,
    );
  }

  // Assign teachers to locations
  console.log("\nAssigning teachers to locations...");
  for (const assignment of seedData.teacherLocationAssignments) {
    const teacherId = teacherMap.get(assignment.teacherUsername);
    const locationId = locationMap.get(assignment.locationName);

    if (!teacherId || !locationId) {
      console.log(
        `Skipping invalid assignment: ${assignment.teacherUsername} -> ${assignment.locationName}`,
      );
      continue;
    }

    await prisma.teacherLocation.create({
      data: {
        teacherId,
        locationId,
      },
    });
    console.log(
      `Assigned ${assignment.teacherUsername} to ${assignment.locationName}`,
    );
  }

  // Create doorbells
  console.log("\nCreating doorbells...");
  for (const doorbellData of seedData.devices.doorbells) {
    const locationId = locationMap.get(doorbellData.locationName);

    if (!locationId) {
      console.log(
        `Skipping doorbell for unknown location: ${doorbellData.locationName}`,
      );
      continue;
    }

    await prisma.doorbell.create({
      data: {
        deviceId: doorbellData.deviceId,
        mqttClientId: doorbellData.mqttClientId,
        locationId,
      },
    });
    console.log(
      `Created doorbell: ${doorbellData.deviceId} at ${doorbellData.locationName}`,
    );
  }

  // Create buzzers
  console.log("\nCreating buzzers...");
  for (const buzzerData of seedData.devices.buzzers) {
    const teacherId = teacherMap.get(buzzerData.teacherUsername);

    if (!teacherId) {
      console.log(
        `Skipping buzzer for unknown teacher: ${buzzerData.teacherUsername}`,
      );
      continue;
    }

    await prisma.buzzer.create({
      data: {
        deviceId: buzzerData.deviceId,
        mqttClientId: buzzerData.mqttClientId,
        teacherId,
      },
    });
    console.log(
      `Created buzzer: ${buzzerData.deviceId} for ${buzzerData.teacherUsername}`,
    );
  }

  // Create LED panels
  console.log("\nCreating LED panels...");
  for (const panelData of seedData.devices.ledPanels) {
    const locationId = locationMap.get(panelData.locationName);

    if (!locationId) {
      console.log(
        `Skipping LED panel for unknown location: ${panelData.locationName}`,
      );
      continue;
    }

    await prisma.ledPanel.create({
      data: {
        deviceId: panelData.deviceId,
        mqttClientId: panelData.mqttClientId,
        locationId,
      },
    });
    console.log(
      `Created LED panel: ${panelData.deviceId} at ${panelData.locationName}`,
    );
  }

  console.log("\nDatabase seeding completed successfully!");
  console.log("\nSummary:");
  console.log(`Locations: ${seedData.locations.length}`);
  console.log(`Teachers: ${seedData.teachers.length}`);
  console.log(`Doorbells: ${seedData.devices.doorbells.length}`);
  console.log(`Buzzers: ${seedData.devices.buzzers.length}`);
  console.log(`LED Panels: ${seedData.devices.ledPanels.length}`);
  console.log("\nDemo credentials:");
  console.log(
    `${seedData.teachers[0].username} / ${seedData.teachers[0].password}`,
  );
}

main()
  .catch((e) => {
    console.error("Error during seeding:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
