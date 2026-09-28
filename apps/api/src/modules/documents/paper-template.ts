export const PAPER_TEMPLATE_VERSION = 'reference-2609-067-v1';
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
  machine: { name: string };
  dueDate: Date | string;
  dueTime: string;
  materials: {
    materialCode: string;
    materialName: string;
    quantity: number | null;
    unit: string;
    remark: string;
  }[];
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
  return `${date.getUTCDate()}/${date.getUTCMonth() + 1}/${date.getUTCFullYear() + 543}`;
};
/** Original reference embedded unchanged. Only writable areas are covered.
 * Coordinates use 1376 x 1780; Letter preserves the source's 2550:3300 ratio. */
export function paperHtml(order: PaperOrder, template: Buffer, font: Buffer) {
  const extra: string[] = [];
  const limited = (label: string, value: string, length: number) => {
    if (Array.from(value).length <= length) return value;
    extra.push(`<h2>${escapeHtml(label)}</h2><p>${escapeHtml(value)}</p>`);
    return 'ดูรายละเอียดในหน้าต่อไป';
  };
  const field = (x: number, y: number, w: number, h: number, value: unknown, underline = true) =>
    `<div class="field" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"><span class="fit ${underline ? 'underlined' : ''}">${escapeHtml(value)}</span></div>`;
  const description = limited(
    'รายละเอียดงานผลิต',
    order.description || (order.followAttachment ? 'ตามเอกสารแนบท้าย' : ''),
    72,
  );
  const product = limited(
    'รหัสชิ้นงาน/ชื่อสินค้า',
    [order.productCode, order.productName].filter(Boolean).join(' / '),
    65,
  );
  const instructions = limited('ขั้นตอน/คำสั่งพิเศษ', order.specialInstructions, 160);
  const other = order.reasonType === 'URGENT' || order.reasonType === 'OTHER';
  const reason = limited(
    'เหตุผลในการออกเอกสารชั่วคราว',
    order.reasonDetail || (order.reasonType === 'URGENT' ? 'งานด่วน' : ''),
    150,
  );
  const fields = [
    field(378, 264, 165, 38, order.documentNo),
    field(803, 264, 230, 38, paperDate(order.orderDate)),
    field(280, 350, 194, 44, order.issuerDisplayName || order.issuer.name),
    field(618, 350, 560, 44, order.department.name),
    field(356, 440, 845, 48, description),
    field(471, 532, 726, 47, product),
    field(389, 622, 191, 43, order.quantity === null ? order.quantityText : order.quantity),
    field(739, 622, 452, 43, order.unit),
    field(435, 713, 759, 45, order.machine.name, false),
    field(373, 802, 132, 47, paperDate(order.dueDate)),
    field(
      628,
      802,
      548,
      47,
      order.dueTime || '.....................................................................',
      !!order.dueTime,
    ),
  ];
  const positions = [
    [
      [340, 941, 110],
      [571, 941, 158],
      [794, 941, 247],
    ],
    [
      [248, 986, 347],
      [742, 986, 126],
      [937, 986, 237],
    ],
  ];
  for (let i = 0; i < 2; i++) {
    const material = order.materials[i];
    const values = [material?.materialCode || '', material?.quantity ?? '', material?.unit || ''];
    positions[i].forEach(([x, y, w], index) => {
      fields.push(
        field(
          x,
          y,
          w,
          42,
          values[index] === '' ? '.'.repeat(Math.floor(w / 5)) : values[index],
          false,
        ),
      );
    });
  }
  if (order.materials.length > 2 || order.materials.some((m) => m.materialName || m.remark)) {
    extra.push(
      `<h2>รายการวัตถุดิบ/ส่วนประกอบชั่วคราว</h2><table><thead><tr><th>#</th><th>รหัส / ชื่อ</th><th>จำนวน</th><th>หน่วย</th><th>หมายเหตุ</th></tr></thead><tbody>${order.materials.map((m, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(m.materialCode)} ${escapeHtml(m.materialName)}</td><td>${escapeHtml(m.quantity)}</td><td>${escapeHtml(m.unit)}</td><td>${escapeHtml(m.remark)}</td></tr>`).join('')}</tbody></table>`,
    );
  }
  for (const [stage, y] of [
    ['ISSUER', 1365],
    ['SUPERVISOR', 1457],
    ['APPROVER', 1545],
  ] as const) {
    const approval = order.approvals.find((a) => a.stage === stage && a.status === 'APPROVED');
    if (approval?.decidedBy) fields.push(field(174, y, 298, 30, approval.decidedBy.name, false));
  }
  const mark = (x: number, y: number, checked: boolean) =>
    `<span class="mark" style="left:${x}px;top:${y}px">${checked ? '/' : ''}</span>`;
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><style>
    @font-face{font-family:PaperThai;src:url(data:font/ttf;base64,${font.toString('base64')})}
    @page{size:Letter;margin:0}*{box-sizing:border-box}body{margin:0;color:#000;font-family:PaperThai,"Times New Roman",serif}
    .page{width:816px;height:1056px;position:relative;overflow:hidden;break-after:page}.page:last-child{break-after:auto}
    .sheet{position:relative;width:1376px;height:1780px;transform:scale(${816 / 1376});transform-origin:top left;background:url(data:image/jpeg;base64,${template.toString('base64')}) 0 0/100% 100% no-repeat}
    .field{position:absolute;background:white;display:flex;align-items:center;padding:0 7px;white-space:nowrap;font-size:23px;line-height:1.25;font-weight:bold}
    .fit{max-width:100%;display:block}.underlined{text-decoration:underline;text-underline-offset:3px}
    .writing{position:absolute;background:white;white-space:pre-wrap;overflow-wrap:anywhere;font-size:23px;line-height:47px;background-image:repeating-linear-gradient(to bottom,white 0,white 44px,#555 45px,white 46px,white 47px)}
    .mark{position:absolute;background:white;width:15px;height:29px;font-size:24px;text-align:center;line-height:29px}
    .appendix{padding:48px;font-size:15px;line-height:1.6;break-before:page}h1{font-size:20px}h2{font-size:16px}p{white-space:pre-wrap;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}th,td{border:1px solid #555;padding:7px;text-align:left;overflow-wrap:anywhere}tr{break-inside:avoid}thead{display:table-header-group}
  </style></head><body><div class="page"><div class="sheet">${fields.join('')}
    <div class="writing" style="left:113px;top:1068px;width:1057px;height:99px">${escapeHtml(instructions)}</div>
    <span style="position:absolute;left:137px;top:1223px;font-size:23px;font-weight:bold;">)</span>
    <span style="position:absolute;left:359px;top:1223px;font-size:23px;font-weight:bold;">)</span>
    <span style="position:absolute;left:634px;top:1223px;font-size:23px;font-weight:bold;">)</span>
    ${mark(121, 1223, order.reasonType === 'REWORK')}${mark(343, 1223, order.reasonType === 'SAMPLE')}${mark(618, 1223, order.reasonType === 'ERP_FAILURE')}${mark(124, 1269, other)}
    <div class="writing" style="left:267px;top:1255px;width:900px;height:48px;text-decoration:underline">${escapeHtml(other ? reason : '')}</div>
    <div class="writing" style="left:113px;top:1304px;width:1057px;height:39px"></div>
  </div></div>${extra.length ? `<section class="appendix"><h1>เอกสารแนบท้าย ${escapeHtml(order.documentNo)}</h1>${extra.join('')}</section>` : ''}</body></html>`;
}
