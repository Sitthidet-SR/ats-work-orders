import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../.env') });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.workOrder.findMany({
    where: { machineId: { not: null } },
  });
  console.log(`Found ${orders.length} orders to migrate.`);
  let count = 0;
  for (const order of orders) {
    if (!order.machineId) continue;
    const existing = await prisma.workOrderMachine.findFirst({
      where: { workOrderId: order.id }
    });
    if (existing) continue; // Already migrated

    await prisma.workOrderMachine.create({
      data: {
        workOrderId: order.id,
        machineId: order.machineId,
        quantity: null,
        remark: '',
        sortOrder: 0,
      }
    });
    count++;
  }
  console.log(`Successfully migrated ${count} orders.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
