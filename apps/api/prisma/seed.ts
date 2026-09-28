import '../src/common/env';
import { PrismaClient, Machine } from '@prisma/client';
import { hash } from 'bcrypt';
import { rolePermissions } from '../src/modules/roles/permissions';
import { required } from '../src/common/env';
const db = new PrismaClient();
async function seed() {
  const password = required('ADMIN_INITIAL_PASSWORD');
  if (password.length < 12)
    throw new Error('ADMIN_INITIAL_PASSWORD must contain at least 12 characters');
  if (Buffer.byteLength(password, 'utf8') > 72)
    throw new Error('ADMIN_INITIAL_PASSWORD must not exceed 72 bytes');
  const passwordHash = await hash(password, 12);
  const departmentNames = [
    'วางแผนการผลิต',
    'ฝ่ายผลิต',
    'วิศวกรรม',
    'Drawing',
    'QC',
    'Store',
    'จัดซื้อ',
    'HR',
    'IT',
  ];
  const departments = [];
  for (const [i, name] of departmentNames.entries())
    departments.push(
      await db.department.upsert({
        where: { code: `D${i + 1}` },
        update: { name },
        create: { code: `D${i + 1}`, name },
      }),
    );
  const machines: Machine[] = [];
  for (const [i, name] of [
    'CNC Milling',
    'CNC Turning',
    'CNC Router',
    'Laser',
    'Water Jet',
    'Manual',
    'Other',
  ].entries())
    machines.push(
      await db.machine.upsert({
        where: { code: `M${i + 1}` },
        update: { name },
        create: { code: `M${i + 1}`, name },
      }),
    );
  for (const [name, permissions] of Object.entries(rolePermissions)) {
    const role = await db.role.upsert({ where: { name }, update: {}, create: { name } });
    for (const permissionName of permissions) {
      const permission = await db.permission.upsert({
        where: { name: permissionName },
        update: {},
        create: { name: permissionName },
      });
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
  async function user(
    email: string,
    username: string,
    name: string,
    position: string,
    roleName: string,
    departmentId: string,
  ) {
    const user = await db.user.upsert({
      where: { email },
      update: {},
      create: { email, username, name, position, departmentId, passwordHash },
    });
    const role = await db.role.findUniqueOrThrow({ where: { name: roleName } });
    await db.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
    return user;
  }
  await user(
    'admin@ats.local',
    'admin',
    'ATS Administrator',
    'System Administrator',
    'ADMIN',
    departments[8].id,
  );
  if (process.env.SEED_DEMO === 'true') {
    if (process.env.NODE_ENV === 'production')
      throw new Error('Demo seed is disabled in production');
    const issuer = await user(
      'pattama@ats.local',
      'Pattama.sa',
      'Pattama.sa',
      'Production Planner',
      'ISSUER',
      departments[0].id,
    );
    const supervisor = await user(
      'supervisor@ats.local',
      'supervisor',
      'Production Supervisor',
      'หัวหน้าฝ่ายผลิต',
      'SUPERVISOR',
      departments[1].id,
    );
    const approver = await user(
      'approver@ats.local',
      'approver',
      'Production Manager',
      'ผู้จัดการฝ่ายผลิต',
      'APPROVER',
      departments[1].id,
    );
    await user(
      'viewer@ats.local',
      'viewer',
      'ATS Viewer',
      'ผู้ตรวจสอบ',
      'VIEWER',
      departments[4].id,
    );
    await db.$transaction(async (tx) => {
      const existing = await tx.workOrder.findUnique({ where: { documentNo: 'PN2609023' } });
      if (existing) return;
      const order = await tx.workOrder.create({
        data: {
          documentNo: 'PN2609023',
          orderDate: new Date('2026-09-28'),
          issuerId: issuer.id,
          departmentId: issuer.departmentId,
          description: 'ผลิตชิ้นงานตามแบบ CALP2609-067 ตรวจสอบขนาดตาม Spec ก่อนส่ง QC',
          productCode: 'CALP2609-067',
          productName: 'ชิ้นส่วนจับยึด / Clamping plate',
          quantity: 12,
          unit: 'ชิ้น',
          machineId: machines[0].id,
          dueDate: new Date('2026-09-30'),
          dueTime: '16:30',
          priority: 'URGENT',
          reasonType: 'URGENT',
          specialInstructions: 'งานด่วน\nโปรดผลิตตามแบบแนบท้าย',
          materials: {
            create: [
              {
                materialCode: 'AL-6061',
                materialName: 'Aluminium 6061',
                quantity: 12,
                unit: 'ชิ้น',
                sortOrder: 0,
                remark: 'ตรวจสอบขนาดก่อนผลิต',
              },
            ],
          },
          approvals: {
            create: [
              { userId: issuer.id, stage: 'ISSUER' },
              { userId: supervisor.id, stage: 'SUPERVISOR' },
              { userId: approver.id, stage: 'APPROVER' },
            ],
          },
        },
      });
      await tx.$executeRaw`INSERT INTO document_sequences (id,period,value,"updatedAt") VALUES (gen_random_uuid(),'PN2609',23,NOW()) ON CONFLICT (period) DO UPDATE SET value=GREATEST(document_sequences.value,23), "updatedAt"=NOW()`;
      await tx.auditLog.create({
        data: {
          userId: issuer.id,
          action: 'CREATE',
          entityType: 'WorkOrder',
          entityId: order.id,
          newValue: { documentNo: order.documentNo, source: 'development-seed' },
        },
      });
    });
  }
  console.log(
    'Seed completed. Passwords are environment-supplied; existing passwords were preserved.',
  );
}
seed()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Seed failed');
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
