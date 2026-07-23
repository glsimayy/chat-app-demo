require("dotenv").config({ quiet: true });

const bcrypt = require("bcrypt");
const { PrismaClient, UserRole } = require("@prisma/client");

const PASSWORD = "123456";
const BUILT_IN_USERS = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    automationId: 1,
    username: "emiradmin",
    email: "emiradmin@ello.com",
    role: UserRole.admin,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    automationId: 2,
    username: "emiruser",
    email: "emiruser@ello.com",
    role: UserRole.user,
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    automationId: 3,
    username: "aslıadmin",
    email: "asliadmin@ello.com",
    role: UserRole.admin,
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    automationId: 4,
    username: "aslıuser",
    email: "asliuser@ello.com",
    role: UserRole.user,
  },
  {
    id: "00000000-0000-4000-8000-000000000005",
    automationId: 5,
    username: "gülsimaadmin",
    email: "gulsimaadmin@ello.com",
    role: UserRole.admin,
  },
  {
    id: "00000000-0000-4000-8000-000000000006",
    automationId: 6,
    username: "gülsimauser",
    email: "gulsimauser@ello.com",
    role: UserRole.user,
  },
];

async function ensureBuiltInUser(prisma, input) {
  const matches = await prisma.user.findMany({
    where: {
      OR: [
        { id: input.id },
        { automationId: input.automationId },
        { email: input.email },
        { username: input.username },
      ],
    },
  });

  const conflictingUser = matches.find(user => user.id !== input.id);
  if (conflictingUser) {
    throw new Error(
      `Built-in identity ${input.automationId} conflicts with existing user ${conflictingUser.email} (${conflictingUser.id})`,
    );
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.user.upsert({
    where: { id: input.id },
    create: { ...input, passwordHash },
    update: {
      automationId: input.automationId,
      username: input.username,
      email: input.email,
      role: input.role,
      passwordHash,
    },
  });
}

async function main() {
  if (!process.env.DATABASE_URL?.startsWith("postgresql://")) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection URL");
  }

  const prisma = new PrismaClient();
  try {
    for (const input of BUILT_IN_USERS) {
      const user = await ensureBuiltInUser(prisma, input);
      console.log(
        `Built-in user ready: ${user.automationId} -> ${user.email} (${user.role})`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(`Built-in user bootstrap failed: ${error.message}`);
  process.exitCode = 1;
});
