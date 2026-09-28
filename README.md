# ATS Company Platform

ระบบใบสั่งงานผลิตชั่วคราว **Temporary Work Order** ที่เชื่อม Next.js → NestJS REST API → PostgreSQL จริง ใช้ pnpm monorepo และแบ่งโมดูลเพื่อเพิ่ม ERP ในอนาคต

## สิ่งที่ใช้งานได้

- Login ด้วย email/username, bcrypt, JWT access token, HttpOnly refresh cookie, rotation และตรวจจับ refresh token ที่ถูกใช้ซ้ำ
- RBAC: ADMIN, ISSUER, SUPERVISOR, APPROVER, VIEWER ตรวจที่ API; ตรวจเจ้าของร่างและผู้รับผิดชอบในขั้นอนุมัติ
- Dashboard 8 ตัวเลข, งานกำหนดส่งวันนี้, รายการล่าสุด และความคืบหน้าจากฐานข้อมูล
- ค้นหา/กรอง/เรียงลำดับ/แบ่งหน้าฝั่งเซิร์ฟเวอร์
- สร้าง/แก้ร่าง/ทำสำเนา/ยกเลิก, วัตถุดิบเพิ่ม ลบ เรียงลำดับ, แนบไฟล์ด้วย drag & drop
- Workflow ครบ พร้อมยืนยันการดำเนินการ ความคิดเห็น และป้องกันการเขียนทับจากหลายหน้าจอด้วย version
- Audit Log จริงแบบ append-only ป้องกัน UPDATE/DELETE ด้วย PostgreSQL trigger
- S3-compatible StorageService, ตรวจ MIME/เนื้อหาไฟล์, จำกัด 20 MB, private bucket, signed download 5 นาที
- PDF A4 ภาษาไทยด้วย Sarabun ที่รวมในโปรเจกต์ มี QR สำหรับเปิดเอกสารหลัง Login และระบุผู้ดำเนินการอนุมัติจริง
- Machine Master และสร้างผู้ใช้/มอบบทบาทผ่านหน้าตั้งค่าสำหรับ Admin
- Swagger, SQL migrations, seed, Docker Compose และ Render/Vercel configuration

เมนู ERP อื่นแสดงไว้และปิดการใช้งานตามขอบเขต ไม่มีข้อมูลจำลองฝั่งหน้าเว็บ ไม่มีการเก็บใบงานใน localStorage

## Architecture และโครงสร้าง

อ่าน [Requirement analysis, Architecture, ERD และแผนงาน](docs/architecture.md) ซึ่งจัดทำก่อนเริ่ม implementation

```text
apps/
  api/  NestJS: auth, roles, users, departments, machines,
        work-orders, documents, audit, storage
        prisma/schema.prisma + migrations/ + seed.ts
        assets/Sarabun-Regular.ttf + OFL.txt
  web/  Next.js App Router + Tailwind + shadcn-style Radix components
packages/
  types/          สัญญาข้อมูลและข้อความภาษาไทย
  config/         strict TypeScript
  eslint-config/  ESLint configuration
docs/
scripts/
```

ใช้ Next.js **16.3.6** stable ที่ตรวจจาก registry ขณะสร้าง, NestJS 11 และ Prisma 6.19.3 แบบ pin version Prisma 6 ใช้ CommonJS เข้ากับ NestJS โดยตรง การย้าย Prisma major version ต้องทดสอบ schema/config/driver adapter ใหม่ตาม [Prisma upgrade guide](https://docs.prisma.io/docs/guides/upgrade-prisma-orm/v7) การทำ App Router อ้างอิง [Next.js 16 documentation](https://nextjs.org/docs/app/guides/upgrading/version-16)

## เริ่มรันบน Windows

ต้องมี Node.js 22.12+ (แนะนำ Node 24) และ Docker Desktop Linux containers เปิดทำงาน

```powershell
# ติดตั้ง pnpm ใน workspace ไม่เปลี่ยน global environment
npm.cmd install --prefix .tools pnpm@10.32.1
.\.tools\node_modules\.bin\pnpm.cmd install --frozen-lockfile
node scripts/setup-local.mjs

# เริ่มฐานข้อมูลและ private object storage
docker compose up -d postgres object-storage
.\.tools\node_modules\.bin\pnpm.cmd --filter api db:generate
.\.tools\node_modules\.bin\pnpm.cmd --filter api db:migrate
.\.tools\node_modules\.bin\pnpm.cmd --filter api db:seed
.\.tools\node_modules\.bin\pnpm.cmd --filter api storage:init

# ดาวน์โหลด Chromium สำหรับ PDF และ browser tests
.\.tools\node_modules\.bin\pnpm.cmd --filter api exec playwright install chromium

# Build ก่อนรัน
.\.tools\node_modules\.bin\pnpm.cmd build
```

เปิด Terminal สองหน้าจอจากโฟลเดอร์โปรเจกต์:

```powershell
# Terminal 1
.\.tools\node_modules\.bin\pnpm.cmd --filter api start:prod
# Terminal 2
.\.tools\node_modules\.bin\pnpm.cmd --filter web start
```

เว็บ: http://localhost:3000 · API: http://localhost:4000/api · Swagger: http://localhost:4000/api/docs · Object Storage Console: http://localhost:9001

หากดาวน์โหลด Chromium ไม่ได้ ใช้ Chrome/Edge ที่ติดตั้งแล้ว โดยตั้งใน `.env` เช่น `CHROMIUM_EXECUTABLE_PATH=C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe` เครื่องที่สร้างโปรเจกต์นี้ตั้ง Edge ไว้และทดสอบ PDF ผ่านแล้ว

`setup-local.mjs` สร้าง `.env` พร้อม secrets และรหัสผ่าน random; ไม่แสดง secret ใน console และไม่ทับไฟล์เดิม เปิด `.env` ใน editor เพื่ออ่าน `ADMIN_INITIAL_PASSWORD` แล้วใช้ **admin@ats.local** หรือ **admin** ที่หน้า Login

เมื่อ `SEED_DEMO=true` มีบัญชี development: `Pattama.sa`, `supervisor`, `approver`, `viewer` ใช้รหัสผ่านเริ่มต้นเดียวกันจาก environment พร้อมใบตัวอย่าง PN2609023 ข้อมูลตัวอย่างและข้อมูลจากการทดสอบอยู่เฉพาะฐานข้อมูล local นี้ แยก database/project จาก production เสมอ

บน macOS/Linux ใช้ `pnpm` แทนคำสั่ง `pnpm.cmd`; สามารถติดตั้งด้วย `npm install -g pnpm@10.32.1` หรือวิธีมาตรฐานของ pnpm

## Docker Compose ทั้งระบบ

สร้าง `.env` ด้วย `node scripts/setup-local.mjs` ก่อน แล้วรัน:

```sh
docker compose up --build -d
docker compose logs -f backend frontend
```

Compose มี PostgreSQL, RustFS object storage, bucket initializer, backend และ frontend ใช้ named volumes สำหรับ database และไฟล์แนบ Backend รัน `prisma migrate deploy` และ seed ก่อนเริ่ม API; frontend URL ถูกกำหนดตอน build

หากมี server แบบ host รันบน 3000/4000 ให้หยุดก่อน เพื่อไม่ให้ ports ชนกัน Docker backend override browser path เป็น `/usr/bin/chromium` และใช้ URL object storage ภายใน network; signed download URLs ใช้ `http://localhost:9000` เมื่อเปิดจากเครื่องเดียวกัน หากเปิดจากเครื่องอื่นต้องเปลี่ยน `NEXT_PUBLIC_API_URL`, `FRONTEND_URL` และ `STORAGE_PUBLIC_ENDPOINT` ให้ตรง hostname/IP

RustFS เป็น S3-compatible object storage สำหรับ local development ตาม [official container guide](https://docs.rustfs.com/en/installation/container) production ใช้ S3/R2 หรือ private object storage ที่องค์กรดูแล ไฟล์ production ไม่ถูกเก็บบน Render disk

## Environment variables

| ตัวแปร                                     | ใช้สำหรับ                                                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                             | PostgreSQL/Neon connection URI, production ต้องใช้ SSL                                                      |
| `JWT_SECRET`, `JWT_REFRESH_SECRET`         | คนละค่า อย่างน้อย 32 ตัวอักษร                                                                               |
| `PORT`                                     | Backend port; bind `0.0.0.0`                                                                                |
| `FRONTEND_URL`                             | Origin ที่อนุญาต เช่น `https://your-app.vercel.app`; หลาย origin คั่นด้วย comma ไม่มี spaces/trailing slash |
| `NEXT_PUBLIC_API_URL`                      | API base URL พร้อม `/api`; กำหนดตอน build frontend                                                          |
| `COOKIE_SAME_SITE`                         | `lax` local; `none` เมื่อต่างโดเมน Vercel/Render; production เป็น Secure                                    |
| `ADMIN_INITIAL_PASSWORD`                   | seed admin; อย่างน้อย 12 ตัวอักษร ไม่ทับ password ของบัญชีเดิม                                              |
| `SEED_DEMO`                                | true เฉพาะ development; production ปฏิเสธ sample data                                                       |
| `STORAGE_ENDPOINT`, `STORAGE_REGION`       | S3-compatible endpoint/region; S3 ใช้ default endpoint ได้                                                  |
| `STORAGE_BUCKET`                           | private bucket ที่สร้างไว้                                                                                  |
| `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` | credentials ที่มีสิทธิ์ bucket ตามที่จำเป็น                                                                 |
| `STORAGE_FORCE_PATH_STYLE`                 | true สำหรับ RustFS/MinIO; false สำหรับ providers ที่ใช้ virtual-host style                                  |
| `STORAGE_PUBLIC_ENDPOINT`                  | optional เมื่อ URL สำหรับเซิร์ฟเวอร์และ browser ต่างกัน                                                     |
| `CHROMIUM_EXECUTABLE_PATH`                 | optional system Chromium/Edge; container กำหนดให้แล้ว                                                       |

อย่า commit `.env`; `.env.example` มีเฉพาะตัวอย่าง ไม่มี production secrets

## Development / verification

```sh
pnpm --filter api dev
pnpm --filter web dev
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
node scripts/browser-check.mjs
pnpm build
```

`api dev` compile TypeScript ก่อนรัน และ watch compiled output; หลังแก้ source ให้ compile ด้วย `pnpm --filter api exec tsc -p tsconfig.build.json` หรือ restart command เพื่อ emit decorator metadata ที่ DTO validation/Nest dependency injection ต้องใช้

Windows: หยุด API ก่อน `prisma generate`/`pnpm build` เพราะ process ที่กำลังรันถือ native Prisma DLL ทำให้ rename ไฟล์ไม่ได้

Integration tests ต้องมี local API ที่รันอยู่, `NODE_ENV=development`, `SEED_DEMO=true` และ services พร้อมใช้งาน ทดสอบเลขเอกสารพร้อมกัน, optimistic locking, partial-update preservation, permissions/ownership, lifecycle/approval/rejection, immutable audit, refresh replay, MIME validation, signed files และ Thai PDF **สร้างข้อมูลทดสอบจริงในฐานข้อมูล local และไม่ลบทิ้งเพื่อเก็บ Audit** Browser tests ต้องรัน frontend ด้วยและสร้างใบงานจริงเช่นกัน screenshots อยู่ `.local/screenshots/` การทดสอบหลายรอบรวดเร็วอาจติด login rate limit ให้เว้นอย่างน้อย 60 วินาที

## Workflow และ API

```text
DRAFT → SUBMITTED → SUPERVISOR_REVIEW → WAITING_APPROVAL
      → APPROVED → ISSUED → IN_PROGRESS → COMPLETED
                   ↘ REJECTED / CANCELLED ตาม transition ที่อนุญาต
```

ผู้รับสั่งงานกดรับงานจาก SUBMITTED ก่อน แล้วกดตรวจสอบเสร็จเพื่อส่งผู้อนุมัติ ทั้งสองครั้งใช้ `POST /work-orders/:id/supervisor-review` ผู้อนุมัติ approve/reject ได้เฉพาะ WAITING_APPROVAL เอกสาร terminal กลับเป็นร่างไม่ได้ ใช้ทำสำเนาเพื่อสร้างใบใหม่

ทุก mutation หลังสร้างใช้ `version` ล่าสุด เช่น `{ "version": 2, "comment": "ตรวจสอบแล้ว" }` Reject/Cancel/Delete ต้องระบุเหตุผล Frontend refresh ข้อมูลเมื่อ conflict

`GET /api/work-orders` รองรับ `search,status,priority,machineId,departmentId,issuerId,dateFrom,dateTo,dueFrom,dueTo,page,limit,sortBy,sortOrder` จำกัด 100 รายการ/หน้า

`DELETE /api/work-orders/:id` ใช้ permission `work_order.delete` และ soft cancel **เฉพาะ DRAFT** เก็บเลขเอกสารและประวัติไว้ ไม่ลบ Audit; UI ใช้ปุ่มยกเลิกใบงาน

`GET /api/work-orders/:id/pdf` สำหรับ export; `/print` สำหรับ print ตามสิทธิ์ ผู้สั่งงานพิมพ์เฉพาะใบของตัวเอง QR ใช้ UUID publicReference แต่ยังต้อง Login

วันที่เก็บเป็น Gregorian `YYYY-MM-DD`; เลขเอกสารใช้เดือนปัจจุบันของ Bangkok และ atomic UPSERT ใน transaction รูปแบบเริ่มต้น `PN` + `YYMM` + ลำดับอย่างน้อย 3 หลัก ลำดับที่เกิน 999 ไม่ถูกตัดทิ้ง UUID คือ primary key

Assignments กับผู้ดำเนินการอนุมัติจริงเก็บแยกกัน (`userId` / `decidedById`) เพื่อให้ Admin ดำเนินการแทนได้และลายเซ็น PDF ไม่อ้างชื่อผู้ที่ไม่ได้กดอนุมัติ

## Deploy: Neon → Render → Vercel

1. สร้าง Neon PostgreSQL project แยก production แล้วตั้ง `DATABASE_URL` เป็น URI ที่ Neon ให้พร้อม `sslmode=require`; ใช้ direct connection สำหรับ migration หากเงื่อนไขของ pooled connection ต้องการ
2. ตั้ง secrets ใน Render environment; ไม่ใส่ลง Git ตั้ง `NODE_ENV=production`, `SEED_DEMO=false`, `FRONTEND_URL` เป็น Vercel origin จริง, `COOKIE_SAME_SITE=none` และ S3/R2 credentials/private bucket
3. เชื่อม repository กับ Render Blueprint [render.yaml](render.yaml) โดยใช้ Dockerfile ของ API ซึ่งรวม system Chromium และฟอนต์ไทยไว้ Startup command รัน `prisma migrate deploy` ก่อน API จึงรองรับ plans ที่ไม่มี pre-deploy hook; migration ล้มเหลวจะไม่เปิด API
4. ทำ initial production seed หนึ่งครั้งผ่าน Render Shell/one-off job: ตั้ง `ADMIN_INITIAL_PASSWORD` เป็นค่าจริง แล้วรัน `pnpm --filter api db:seed`; จากนั้นเอาค่า password seed ออกจาก runtime environment ได้ Sample data ไม่ถูกสร้างใน production
5. ตั้ง Vercel Root Directory เป็น `apps/web`, เปิดให้ build เข้าถึงไฟล์นอก root ใน monorepo ใช้ pnpm workspace lockfile และ configuration [apps/web/vercel.json](apps/web/vercel.json) ตั้ง `NEXT_PUBLIC_API_URL=https://your-api.onrender.com/api` ก่อน build
6. เปิดเว็บ Login admin → ตั้งค่า → เพิ่มบัญชี ISSUER/SUPERVISOR/APPROVER ด้วยรหัสผ่านจริง จากนั้นสร้างใบงาน ทดสอบ review/approve/print และดาวน์โหลดไฟล์
7. เมื่อ Vercel URL แน่นอน ให้ตรวจ `FRONTEND_URL` กับ CORS/QR อีกครั้ง ดู `/api/health` และ `/api/docs`

Frontend และ API ข้ามโดเมนใช้ HttpOnly Secure SameSite=None refresh cookie หากนโยบาย browser/องค์กรบล็อก third-party cookies ให้ใช้ custom domains ใต้ site เดียวกัน เช่น `erp.example.com` และ `api.example.com` พร้อมตั้งค่า Origin ให้ตรง

ไฟล์นี้เตรียม configuration และขั้นตอน deployment แล้ว การ publish จริงต้องมีบัญชี/project และ environment ของเจ้าของระบบ ซึ่งไม่ได้แนบมาในคำขอ

## ขอบเขตของรุ่นนี้

ไม่มี inventory engine, MRP, BOM engine, purchasing, CRM, accounting, HR, QC workflow หรือ scheduling เพิ่มขึ้น เมนูเหล่านี้รอ future modules ระบบปัจจุบันมีการสร้างผู้ใช้และมอบบทบาท; การแก้สิทธิ์/reset password/self-service ยังไม่มีหน้า UI ควรเพิ่มตามนโยบาย provisioning ขององค์กรเมื่อใช้งานจริง
