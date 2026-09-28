import { ForbiddenException, Injectable } from '@nestjs/common';
import { chromium } from 'playwright';
import QRCode from 'qrcode';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WorkOrdersService } from '../work-orders/work-orders.service';
import { Actor } from '../auth/auth.types';
import { required } from '../../common/env';
const esc = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const date = (value: Date) =>
  new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' }).format(value);
@Injectable()
export class PdfService {
  constructor(private readonly orders: WorkOrdersService) {}
  async generate(id: string, actor: Actor, permission = 'work_order.export') {
    if (!actor.permissions.includes(permission))
      throw new ForbiddenException('คุณไม่มีสิทธิ์พิมพ์/ส่งออก');
    const order = await this.orders.detail(id);
    if (!actor.roles.includes('ADMIN')) this.orders.assertOwner(actor, order);
    const font = await readFile(resolve(__dirname, '../../../assets/Sarabun-Regular.ttf'));
    const qr = await QRCode.toDataURL(
      `${required('FRONTEND_URL').split(',')[0]}/work-orders/${order.publicReference}`,
    );
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><style>@font-face{font-family:Sarabun;src:url(data:font/ttf;base64,${font.toString('base64')})}*{box-sizing:border-box}body{font-family:Sarabun,sans-serif;font-size:11px;color:#17243b}header{display:flex;justify-content:space-between;border-bottom:3px solid #bd2430;padding-bottom:12px}.logo{font-size:36px;font-weight:bold;color:#bd2430}h1{font-size:20px;margin:4px 0}h2{font-size:13px;background:#edf1f6;padding:7px;margin-top:15px}table{width:100%;border-collapse:collapse}th,td{padding:7px;border:1px solid #c8d0dc;text-align:left;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}.text{white-space:pre-wrap;overflow-wrap:anywhere}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}.signatures{display:flex;gap:15px;margin-top:30px;break-inside:avoid}.signature{width:33%;text-align:center;border-top:1px solid #68758a;padding-top:10px}footer{margin-top:20px;color:#68758a;font-size:9px}</style></head><body><header><div><div class="logo">ATS</div>AUTO-TECHSYSTEM CO., LTD.</div><div><h1>ใบสั่งงานผลิตชั่วคราว</h1>TEMPORARY WORK ORDER<br><b>${esc(order.documentNo)}</b> · ${esc(order.status)}</div><img width="72" height="72" src="${qr}" alt="QR"></header><div class="grid"><div>วันที่สั่งการ: ${date(order.orderDate)}</div><div>ผู้สั่งงาน: ${esc(order.issuer.name)}</div><div>แผนก: ${esc(order.department.name)}</div><div>ความสำคัญ: ${esc(order.priority)}</div></div><h2>รายละเอียดงานผลิต</h2><div class="text">${esc(order.description)}</div><p>ตามเอกสารแนบท้าย: ${order.followAttachment ? 'ใช่' : 'ไม่ใช่'}</p><h2>ข้อมูลชิ้นงาน</h2><table><tr><th>รหัสชิ้นงาน</th><td>${esc(order.productCode)}</td><th>ชื่อสินค้า</th><td>${esc(order.productName)}</td></tr><tr><th>จำนวน</th><td>${esc(order.quantity)} ${esc(order.unit)}</td><th>เครื่องจักร</th><td>${esc(order.machine.name)}</td></tr><tr><th>กำหนดส่ง</th><td colspan="3">${date(order.dueDate)} เวลา ${esc(order.dueTime)}</td></tr></table><h2>รายการวัตถุดิบ / ส่วนประกอบ</h2><table><thead><tr><th>#</th><th>รหัส</th><th>วัตถุดิบ</th><th>จำนวน</th><th>หน่วย</th><th>หมายเหตุ</th></tr></thead><tbody>${order.materials.map((m, i) => `<tr><td>${i + 1}</td><td>${esc(m.materialCode)}</td><td>${esc(m.materialName)}</td><td>${esc(m.quantity)}</td><td>${esc(m.unit)}</td><td>${esc(m.remark)}</td></tr>`).join('') || '<tr><td colspan="6">ไม่มีรายการ</td></tr>'}</tbody></table><h2>ขั้นตอน / คำสั่งพิเศษ</h2><div class="text">${esc(order.specialInstructions)}</div><h2>เหตุผลในการออกเอกสารชั่วคราว</h2><div class="text">${esc(order.reasonType)} ${esc(order.reasonDetail)}</div><h2>เอกสารแนบ</h2><div class="text">${esc(order.attachments.map((a) => a.fileName).join('\n') || 'ไม่มีไฟล์แนบ')}</div><div class="signatures">${[
      'ISSUER',
      'SUPERVISOR',
      'APPROVER',
    ]
      .map((stage, i) => {
        const approval = order.approvals.find((a) => a.stage === stage);
        return `<div class="signature">${['ผู้สั่งงาน', 'ผู้รับสั่งงาน / หัวหน้า', 'ผู้อนุมัติ'][i]}<br>${esc(approval?.decidedBy?.name ?? approval?.user.name)}<br>${esc(approval?.status)}<br>${approval?.decidedAt ? date(approval.decidedAt) : '—'}<br>${esc(approval?.comment)}</div>`;
      })
      .join(
        '',
      )}</div><footer>เอกสารภายในบริษัท · ลายเซ็นอิเล็กทรอนิกส์จากประวัติการอนุมัติ · QR ต้องเข้าสู่ระบบ</footer></body></html>`;
    const browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
      args: [
        '--disable-dev-shm-usage',
        ...(process.env.NODE_ENV === 'production' ? ['--no-sandbox'] : []),
      ],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      return {
        documentNo: order.documentNo,
        buffer: await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' },
          displayHeaderFooter: true,
          headerTemplate: '<span></span>',
          footerTemplate:
            '<div style="font-size:9px;width:100%;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
        }),
      };
    } finally {
      await browser.close();
    }
  }
}
