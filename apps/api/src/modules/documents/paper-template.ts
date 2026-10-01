export const PAPER_TEMPLATE_VERSION = 'a4-work-order-v5';

export interface PaperOrder {
  documentNo: string;
  orderDate: Date | string;
  issuerDisplayName?: string;
  issuer: { name: string };
  department: { name: string };
  description: string;
  followAttachment: boolean;
  productCode: string;
  productName: string;
  quantity: number | null;
  quantityText?: string;
  unit: string;
  machineDetails: { machine: { name: string }; quantity: number | null; remark: string }[];
  dueDate: Date | string;
  dueTime: string;
  materials: { materialCode: string; materialName: string; materialGrade?: string }[];
  specialInstructions: string;
  reasonType: string;
  reasonDetail: string;
  approvals: { stage: string; status: string; decidedBy?: { name: string } | null }[];
}

export const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

const paperDate = (value: Date | string) => {
  const date = new Date(value);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getUTCFullYear() + 543}`;
};

/** Draw the work order directly at A4 size; the logo is the only raster element. */
export function paperHtml(order: PaperOrder, logo: Buffer, font: Buffer) {
  const extra: string[] = [];
  const limited = (label: string, value: string, length: number) => {
    if (Array.from(value).length <= length) return value;
    extra.push(`<h2>${escapeHtml(label)}</h2><p>${escapeHtml(value)}</p>`);
    return 'ดูรายละเอียดในหน้าต่อไป';
  };
  const at = (x: number, y: number, w: number, h: number, contents: string, className = '') =>
    `<div class="placed ${className}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">${contents}</div>`;
  const value = (x: number, y: number, w: number, text: unknown) =>
    at(x, y, w, 26, `<span class="fit underlined">${escapeHtml(text)}</span>`, 'value');
  const label = (x: number, y: number, w: number, text: string, className = '') =>
    at(x, y, w, 25, text, `label ${className}`);
  const dotted = (x: number, y: number, w: number, text = '') =>
    at(x, y, w, 22, `<span class="fit">${escapeHtml(text)}</span>`, 'dotted');
  const mark = (checked: boolean) =>
    `<span class="mark">(${checked ? '<span class="tick">✓</span>' : '<span class="tick"></span>'})</span>`;

  const description = limited(
    'รายละเอียดงานผลิต',
    order.description || (order.followAttachment ? 'ตามเอกสารแนบท้าย' : ''),
    60,
  );
  const product = limited('รหัสชิ้นงาน/ชื่อสินค้า', [order.productCode, order.productName].filter(Boolean).join(' / '), 48);
  const instructions = limited('ขั้นตอน/คำสั่งพิเศษ', order.specialInstructions, 120);
  const other = order.reasonType === 'URGENT' || order.reasonType === 'OTHER';
  const reason = limited(
    'เหตุผลในการออกเอกสารชั่วคราว',
    order.reasonDetail || (order.reasonType === 'URGENT' ? 'งานด่วน' : ''),
    65,
  );
  const steps = Array.from({ length: 5 }, (_, i) => {
    const machine = order.machineDetails[i];
    const y = 489 + i * 28;
    return [
      label(66, y, 18, `${i + 1}.`),
      label(84, y, 52, 'ขั้นตอน:'),
      dotted(137, y, 263, machine?.remark || ''),
      label(416, y, 68, 'เครื่องจักร:'),
      dotted(485, y, 243, machine?.machine.name || ''),
    ].join('');
  }).join('');
  if (order.machineDetails.length > 5 || order.machineDetails.some((m) =>
    m.quantity !== null || Array.from(m.machine.name).length > 28 || Array.from(m.remark).length > 32
  )) {
    extra.push(
      `<h2>แผนการผลิต (เครื่องจักร)</h2><table><thead><tr><th>#</th><th>เครื่องจักร</th><th>จำนวน</th><th>หมายเหตุ</th></tr></thead><tbody>${order.machineDetails.map((m, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(m.machine.name)}</td><td>${escapeHtml(m.quantity ?? '')}</td><td>${escapeHtml(m.remark)}</td></tr>`).join('')}</tbody></table>`,
    );
  }
  const materials = Array.from({ length: 2 }, (_, i) => {
    const item = order.materials[i];
    const y = 721 + i * 28;
    return [
      label(66, y, 18, `${i + 1}.`),
      label(84, y, 37, 'วัสดุ:'),
      dotted(120, y, 338, item?.materialName || item?.materialCode || ''),
      label(470, y, 42, 'เกรด:'),
      dotted(513, y, 176, item?.materialGrade || ''),
    ].join('');
  }).join('');
  if (
    order.materials.length > 2 ||
    order.materials.some((m) => Array.from(m.materialName || m.materialCode).length > 42 || Array.from(m.materialGrade || '').length > 20)
  ) {
    extra.push(
      `<h2>รายการวัตถุดิบ / ส่วนประกอบ</h2><table><thead><tr><th>#</th><th>วัสดุ</th><th>เกรด</th></tr></thead><tbody>${order.materials.map((m, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(m.materialName || m.materialCode)}</td><td>${escapeHtml(m.materialGrade)}</td></tr>`).join('')}</tbody></table>`,
    );
  }
  const signatures = ([
    ['ISSUER', 'ผู้สั่งงาน'],
    ['SUPERVISOR', 'ผู้รับสั่งงาน/หัวหน้างาน'],
    ['APPROVER', 'ผู้อนุมัติ'],
  ] as const).map(([stage, title], i) => {
    const approval = order.approvals.find((a) => a.stage === stage && a.status === 'APPROVED');
    return at(66, 944 + i * 42, 450, 27,
      `<span>ลงชื่อ: </span><span class="signature-line">${escapeHtml(approval?.decidedBy?.name || '')}</span><span>(${title})</span>`,
      'signature');
  }).join('');
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><style>
    @font-face{font-family:PaperThai;src:url(data:font/ttf;base64,${font.toString('base64')})}
    @page{size:A4;margin:0}*{box-sizing:border-box}
    html,body{margin:0;padding:0;color:#111;font-family:PaperThai,serif}
    .page{position:relative;width:210mm;height:297mm;overflow:hidden;break-after:page}
    .page:last-child{break-after:auto}
    .border{position:absolute;left:35px;top:77px;width:724px;height:992px;border:1.5px solid #111}
    .logo{position:absolute;left:60px;top:111px;width:150px;height:auto}
    .title{position:absolute;left:285px;top:116px;width:415px;font-size:17px;text-decoration:underline;white-space:nowrap}
    .placed{position:absolute;font-size:15px;line-height:24px;white-space:nowrap}
    .label{font-weight:normal}.value{display:flex;align-items:center;font-weight:bold;padding-left:2px}
    .fit{display:inline-block;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .underlined{text-decoration:underline;text-underline-offset:3px}
    .dotted{border-bottom:1px dotted #555;display:flex;align-items:center;overflow:hidden}
    .section{font-weight:bold}.instructions{white-space:pre-wrap;overflow-wrap:anywhere;line-height:22px;overflow:hidden}
    .reason{display:flex;align-items:center;gap:14px}.reason-option{white-space:nowrap}
    .mark{display:inline-flex;align-items:center;justify-content:space-around;width:28px;height:23px}
    .tick{display:inline-block;width:12px;height:20px;line-height:20px;font-weight:bold}
    .signature{display:flex;align-items:center}.signature-line{display:inline-block;width:200px;height:19px;border-bottom:1px dotted #444;text-align:center;margin:0 1px}
    .appendix{padding:48px;font-size:15px;line-height:1.6;break-before:page}h1{font-size:20px}h2{font-size:16px}
    p{white-space:pre-wrap;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}th,td{border:1px solid #555;padding:7px;text-align:left;overflow-wrap:anywhere}tr{break-inside:avoid}thead{display:table-header-group}
  </style></head><body><div class="page"><div class="border"></div>
    <img class="logo" src="data:image/png;base64,${logo.toString('base64')}" alt="ATS">
    <div class="title">ใบสั่งงานผลิตชั่วคราว (TEMPORARY WORK ORDER)</div>
    ${label(65, 196, 170, 'เลขที่เอกสาร (Doc No.):')}
    ${value(230, 196, 116, order.documentNo)}
    ${label(350, 196, 140, 'วันที่สั่งการ (Date):')}
    ${value(495, 196, 120, paperDate(order.orderDate))}
    ${label(65, 255, 110, 'ผู้สั่งงาน (Issuer):')}
    ${value(174, 255, 118, order.issuerDisplayName || order.issuer.name)}
    ${label(295, 255, 92, 'แผนก (Dept):')}
    ${value(384, 255, 333, order.department.name)}
    ${label(65, 310, 154, '[รายละเอียดงานผลิต]')}
    ${value(218, 310, 500, description)}
    ${label(65, 367, 230, 'รหัสชิ้นงาน/ชื่อสินค้า (Product ID/Name):')}
    ${value(322, 367, 391, product)}
    ${label(65, 424, 178, 'จำนวนที่สั่งผลิต (Quantity):')}
    ${value(242, 424, 116, order.quantity === null ? order.quantityText : order.quantity)}
    ${label(367, 424, 119, 'หน่วยนับ (Unit):')}
    ${value(484, 424, 220, order.unit)}
    ${label(65, 458, 165, '[ขั้นตอนการผลิต]', 'section')}
    ${steps}
    ${label(65, 648, 166, 'กำหนดส่งงาน (Due Date):')}
    ${value(230, 648, 112, paperDate(order.dueDate))}
    ${label(348, 648, 100, 'เวลา (Time):')}
    ${dotted(447, 648, 196, order.dueTime)}
    ${label(65, 691, 277, '[รายการวัตถุดิบ / ส่วนประกอบ]', 'section')}
    ${materials}
    ${label(65, 773, 450, '[ขั้นตอน/คำสั่งพิเศษ (Special Instructions)]')}
    ${at(65, 799, 665, 50, escapeHtml(instructions), 'instructions')}
    ${label(65, 844, 450, '[เหตุผลในการออกเอกสารชั่วคราว]')}
    ${at(65, 872, 660, 26,
      `<span class="reason-option">${mark(order.reasonType === 'REWORK')} งานแก้ไข (Rework)</span><span class="reason-option">${mark(order.reasonType === 'SAMPLE')} ผลิตสินค้าตัวอย่าง (Sample)</span><span class="reason-option">${mark(order.reasonType === 'ERP_FAILURE')} ระบบ ERP ขัดข้อง</span>`, 'reason')}
    ${at(65, 898, 660, 28, `${mark(other)} อื่นๆ (ระบุ): <span class="underlined">${escapeHtml(other ? reason : '')}</span>`, 'other')}
    ${signatures}
  </div>${extra.length ? `<section class="appendix"><h1>เอกสารแนบท้าย ${escapeHtml(order.documentNo)}</h1>${extra.join('')}</section>` : ''}</body></html>`;
}
