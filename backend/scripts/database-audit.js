require("dotenv").config({ quiet: true });

const { PrismaClient } = require("@prisma/client");

const EXPECTED_INDEXES = [
  "conversation_participants_leftAt_idx",
  "conversation_participants_pkey",
  "conversation_participants_role_idx",
  "conversation_participants_userId_idx",
  "conversations_createdBy_idx",
  "conversations_externalRef_key",
  "conversations_parentConversationId_key",
  "conversations_pkey",
  "conversations_status_idx",
  "conversations_type_idx",
  "conversations_updatedAt_idx",
  "messages_conversationId_createdAt_idx",
  "messages_deletedAt_idx",
  "messages_messageType_idx",
  "messages_pkey",
  "messages_senderId_clientMessageId_key",
  "messages_senderId_idx",
  "users_email_key",
  "users_pkey",
  "users_role_idx",
  "users_username_key",
];

const EXPECTED_FOREIGN_KEYS = new Map([
  ["conversations_createdBy_fkey", "RESTRICT"],
  ["conversations_parentConversationId_fkey", "CASCADE"],
  ["conversation_participants_conversationId_fkey", "CASCADE"],
  ["conversation_participants_userId_fkey", "CASCADE"],
  ["messages_conversationId_fkey", "CASCADE"],
  ["messages_senderId_fkey", "SET NULL"],
]);

async function main() {
  if (!process.env.DATABASE_URL?.startsWith("postgresql://")) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection URL");
  }

  const prisma = new PrismaClient();

  try {
    const indexes = await prisma.$queryRaw`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
    `;
    const indexNames = new Set(indexes.map(row => row.indexname));
    const missingIndexes = EXPECTED_INDEXES.filter(name => !indexNames.has(name));

    const foreignKeys = await prisma.$queryRaw`
      SELECT
        tc.constraint_name AS "constraintName",
        rc.delete_rule AS "deleteRule"
      FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_schema = tc.constraint_schema
       AND rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_schema = 'public'
        AND tc.constraint_type = 'FOREIGN KEY'
    `;
    const foreignKeyRules = new Map(
      foreignKeys.map(row => [row.constraintName, row.deleteRule]),
    );
    const invalidForeignKeys = Array.from(EXPECTED_FOREIGN_KEYS).filter(
      ([name, rule]) => foreignKeyRules.get(name) !== rule,
    );

    if (missingIndexes.length || invalidForeignKeys.length) {
      if (missingIndexes.length) {
        console.error(`Missing indexes: ${missingIndexes.join(", ")}`);
      }
      if (invalidForeignKeys.length) {
        console.error(
          `Invalid foreign keys: ${invalidForeignKeys
            .map(([name, rule]) => `${name} expected ${rule}`)
            .join(", ")}`,
        );
      }
      throw new Error("Database constraint/index audit failed");
    }

    console.log(
      `Database audit passed: ${EXPECTED_INDEXES.length} indexes, ` +
        `${EXPECTED_FOREIGN_KEYS.size} foreign keys`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(`Database audit failed: ${error.message}`);
  process.exitCode = 1;
});
