import '../src/common/env';
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const users = await db.user.findMany({ select: { id: true, email: true, username: true } });
  console.log(users);
}
main().catch(console.error).finally(() => db.$disconnect());
