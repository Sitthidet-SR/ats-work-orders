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

  // ─── Departments ────────────────────────────────────────────────────
  const departmentNames = [
    'Assembly',                          // D1
    'CNC Milling',                       // D2
    'CNC Lathe',                         // D3
    'Logistics',                         // D4
    'ฝ่ายบริหาร/จัดซื้อ/จัดคาง',            // D5
    'Design & Development',              // D6
    'บัญชี การเงิน',                       // D7
    'จัดซื้อ/จัดคาง/Store',                 // D8
    'IT Support',                        // D9
    'วางแผนการผลิต',                       // D10
    'ฝ่ายผลิต',                            // D11
    'วิศวกรรม',                            // D12
    'Drawing',                           // D13
    'QC',                                // D14
    'Store',                             // D15
    'จัดซื้อ',                              // D16
    'HR',                                // D17
    'IT',                                // D18
  ];

  const departments: Record<string, { id: string }> = {};
  for (const [i, name] of departmentNames.entries()) {
    const code = `D${i + 1}`;
    departments[name] = await db.department.upsert({
      where: { code },
      update: { name },
      create: { code, name },
    });
  }

  // ─── Machines ───────────────────────────────────────────────────────
  const machineList = [
    'CNC Milling',
    'CNC Turning',
    'CNC Router',
    'Laser',
    'Water Jet',
    'Manual',
    'Other',
  ];
  const machines: Machine[] = [];
  for (const [i, name] of machineList.entries())
    machines.push(
      await db.machine.upsert({
        where: { code: `M${i + 1}` },
        update: { name },
        create: { code: `M${i + 1}`, name },
      }),
    );

  // ─── Roles & Permissions ───────────────────────────────────────────
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

  // ─── Helper ─────────────────────────────────────────────────────────
  async function upsertUser(
    email: string,
    username: string,
    name: string,
    position: string,
    roleName: string,
    departmentId: string,
  ) {
    const u = await db.user.upsert({
      where: { email },
      update: { name, position, departmentId },
      create: { email, username, name, position, departmentId, passwordHash },
    });
    const role = await db.role.findUniqueOrThrow({ where: { name: roleName } });
    await db.userRole.upsert({
      where: { userId_roleId: { userId: u.id, roleId: role.id } },
      update: {},
      create: { userId: u.id, roleId: role.id },
    });
    return u;
  }

  // ─── Employees (30 คน จากทะเบียนพนักงาน) ──────────────────────────
  // [รหัส, ชื่อ-นามสกุล(ไทย), ชื่ออังกฤษ, ตำแหน่ง, แผนก, role]
  const employees: [string, string, string, string, string, string][] = [
    ['1ATS001', 'นายอลงกรณ์ ขุนทรง', 'Piamnoei', 'ที่ปรึกษาอาวุโส / หัวหน้าแผนก', 'Assembly', 'ISSUER'],
    ['1ATS002', 'นายสุนทร เปี่ยมโมรี', 'Sunthorn', 'หัวหน้าแผนก', 'Assembly', 'ISSUER'],
    ['1ATS003', 'นายณัฐพล ศรีจรัสวัฒนาชัย', 'Nattapon', 'ช่างเทคนิค', 'CNC Milling', 'ISSUER'],
    ['1ATS004', 'นายศิริพัณ ทองเล็ก', 'Piphat', 'ช่างเทคนิคอาวุโส', 'Assembly', 'ISSUER'],
    ['1ATS005', 'นายณัฐพงศ์ สมศักดิ์', 'Nutthapong', 'หัวหน้าแผนก', 'Logistics', 'ISSUER'],
    ['1ATS006', 'นายธูริทัศน์ แย้มคลิ้ม', 'Sutthinen', 'ช่างเทคนิค', 'CNC Milling', 'ISSUER'],
    ['1ATS007', 'นายวัชรพล ปุญญาถานส์', 'Watcharapo', 'หัวหน้าแผนก', 'CNC Lathe', 'ISSUER'],
    ['1ATS009', 'น.ส.ฐิติรัตน์ เงาธรร', 'Ngaouree', 'หัวหน้าแผนก / เลขานุการ', 'ฝ่ายบริหาร/จัดซื้อ/จัดคาง', 'ISSUER'],
    ['1ATS010', 'นายปรเมษฐ์ ศรีนุช', 'Poramet', 'ช่างเทคนิค', 'CNC Milling', 'ISSUER'],
    ['1ATS011', 'น.ส.ปัทมา แสงงาม', 'Pattama', 'หัวหน้าแผนก', 'Design & Development', 'ISSUER'],
    ['1ATS012', 'นายวิชาการ กฤษราวิทย์', 'Wichakorn', 'หัวหน้าแผนก', 'CNC Milling', 'ISSUER'],
    ['1ATS013', 'นายกณิษ กู้ลิปปรุ่ง', 'Kanit', 'วิศวกร', 'Assembly', 'ISSUER'],
    ['1ATS015', 'นายสุรเชษฐ์ บัวตูม', 'Surachet', 'ช่างเทคนิค', 'CNC Lathe', 'ISSUER'],
    ['1ATS026', 'น.ส.สุพัตร์ จันทร์ณัฐชิดา', 'Supaek', 'หัวหน้างาน', 'CNC Lathe', 'ISSUER'],
    ['1ATS027', 'นายจัตุพล สมบัติไทยคลัง', 'Rattanapho', 'ช่างเทคนิค', 'CNC Lathe', 'ISSUER'],
    ['1ATS028', 'นายชนวรรชน์ ป่าหรักษ์', 'Thanawat', 'ช่างเทคนิค', 'Assembly', 'ISSUER'],
    ['1ATS029', 'นายชูรพงษ์ เพชรกอง', 'Nuttrapong', 'หัวหน้าแผนก', 'Assembly', 'ISSUER'],
    ['1ATS030', 'Miss.Nan SAN KNAM (Myanmar)', 'San Khan', 'หัวหน้างาน', 'Assembly', 'ISSUER'],
    ['1ATS031', 'MR.WAI YAN PHYO (Myanmar)', 'YAN PHYO', 'หัวหน้างาน', 'CNC Lathe', 'ISSUER'],
    ['1ATS032', 'น.ส.พรวิภา บำรุงป่าหุ้ม', 'Porwipba', 'หัวหน้างาน', 'Assembly', 'ISSUER'],
    ['1ATS035', 'นายภานุพงษ์ กิงดา', 'Phanuphong', 'หัวหน้างาน', 'Assembly', 'ISSUER'],
    ['1ATS036', 'นางสาวบุรลิ้ง เตียมนา', 'Yuvaree', 'เจ้าหน้าที่', 'จัดซื้อ/จัดคาง/Store', 'ISSUER'],
    ['1ATS038', 'นางสาวอรีษา หาดเพชร', 'Areeporn', 'หัวหน้างาน', 'บัญชี การเงิน', 'ISSUER'],
    ['1ATS039', 'นางสาวฐิตา ประค่ำ', 'Thita', 'เจ้าหน้าที่QC', 'Design & Development', 'ISSUER'],
    ['1ATS043', 'นายเอกรัฐ คุละมาทรงค์', 'Eakrat', 'หัวหน้างานขับรถ', 'Assembly', 'ISSUER'],
    ['1ATS044', 'นายวรศักดิ์ บริสุทธิ์', 'Worasak', 'วิศวกรรมการผลิต', 'Design & Development', 'ISSUER'],
    ['1ATS045', 'นางสาวศริญญา จันทวี', 'Sarinya', 'เจลล์สำหญาย', 'Assembly', 'ISSUER'],
    ['1ATS047', 'นายธราวุฒิ รักษาเพชร', 'Sarawut', 'ช่างเชื่อม', 'Assembly', 'ISSUER'],
    ['1ATS050', 'นายสิทธิเดช สีเรือง', 'Sitthidet', 'เจ้าหน้าที่ IT Support', 'IT Support', 'ISSUER'],
  ];

  // สร้างพนักงานทุกคน
  for (const [code, name, _eng, position, deptName, roleName] of employees) {
    const deptId = departments[deptName]?.id;
    if (!deptId) throw new Error(`Department not found: ${deptName}`);
    const email = `${code.toLowerCase()}@ats.local`;
    const username = code;
    await upsertUser(email, username, name, position, roleName, deptId);
  }

  // ─── Admin → สิทธิเดช สีเรือง (1ATS050) ──────────────────────────
  const sitthidet = await db.user.findUnique({ where: { email: 'sitthidet@ats.com' } });
  if (sitthidet) {
    const adminRole = await db.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
    await db.userRole.upsert({
      where: { userId_roleId: { userId: sitthidet.id, roleId: adminRole.id } },
      update: {},
      create: { userId: sitthidet.id, roleId: adminRole.id },
    });
    console.log(`Admin role linked to: ${sitthidet.name} (${sitthidet.email})`);
  }

  // ─── Legacy admin account (keep for fallback) ─────────────────────
  await upsertUser(
    'admin@ats.local',
    'admin',
    'ATS Administrator',
    'System Administrator',
    'ADMIN',
    departments['IT Support'].id,
  );

  // ─── Demo seed (development only) ─────────────────────────────────
  if (process.env.SEED_DEMO === 'true') {
    if (process.env.NODE_ENV === 'production')
      throw new Error('Demo seed is disabled in production');

    // ใช้พนักงานจริงเป็น issuer สำหรับ demo
    const issuer = await db.user.findUniqueOrThrow({ where: { email: '1ats011@ats.local' } }); // ปัทมา
    const supervisor = await db.user.findUniqueOrThrow({ where: { email: '1ats012@ats.local' } }); // วิชาการ
    const approver = await db.user.findUniqueOrThrow({ where: { email: '1ats001@ats.local' } }); // อลงกรณ์

    // ให้ role เพิ่มสำหรับ demo workflow
    const supRole = await db.role.findUniqueOrThrow({ where: { name: 'SUPERVISOR' } });
    await db.userRole.upsert({
      where: { userId_roleId: { userId: supervisor.id, roleId: supRole.id } },
      update: {},
      create: { userId: supervisor.id, roleId: supRole.id },
    });
    const appRole = await db.role.findUniqueOrThrow({ where: { name: 'APPROVER' } });
    await db.userRole.upsert({
      where: { userId_roleId: { userId: approver.id, roleId: appRole.id } },
      update: {},
      create: { userId: approver.id, roleId: appRole.id },
    });

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
