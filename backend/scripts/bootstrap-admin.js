require("dotenv").config({ quiet: true });

const bcrypt = require("bcrypt");
const { PrismaClient, UserRole } = require("@prisma/client");

function readAdminInput() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!process.env.DATABASE_URL?.startsWith("postgresql://")) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection URL");
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("ADMIN_EMAIL must be a valid email address");
  }
  if (!username || !/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
    throw new Error(
      "ADMIN_USERNAME must be 3-50 characters using letters, numbers, or underscores",
    );
  }
  if (
    !password ||
    password.length < 12 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new Error(
      "ADMIN_PASSWORD must be at least 12 characters with upper, lower, number, and symbol",
    );
  }

  return { email, username, password };
}

async function main() {
  const input = readAdminInput();
  const prisma = new PrismaClient();

  try {
    const matches = await prisma.user.findMany({
      where: {
        OR: [{ email: input.email }, { username: input.username }],
      },
    });

    if (matches.length > 1) {
      throw new Error(
        "ADMIN_EMAIL and ADMIN_USERNAME belong to different existing users",
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const existing = matches[0];
    const admin = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            email: input.email,
            username: input.username,
            passwordHash,
            role: UserRole.admin,
          },
        })
      : await prisma.user.create({
          data: {
            email: input.email,
            username: input.username,
            passwordHash,
            role: UserRole.admin,
          },
        });

    console.log(`ADMIN account ready: ${admin.email} (${admin.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(`ADMIN bootstrap failed: ${error.message}`);
  process.exitCode = 1;
});
