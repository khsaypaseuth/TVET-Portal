/**
 * Workbook builders shared by the activity, approvals and team exports.
 *
 * Every sheet follows the same shape: a department header, a line recording
 * which filters produced it, the export timestamp, then a frozen, auto-filtered
 * table. Lao is the default language; column widths and the sheet font are
 * chosen so Lao script stays legible in Excel.
 */
import ExcelJS from 'exceljs';

export interface SheetOptions {
  /** Render headings in Lao (default) or English. */
  lao: boolean;
  /** Sheet title shown under the department name. */
  subtitle: string;
  /** Human-readable description of the filters that produced these rows. */
  scopeLine: string;
  /** Optional period, rendered under the scope line. */
  period?: { start?: string; end?: string };
}

const HEADER_FILL = 'FFF2F4F7';
const HEADER_BORDER = 'FFD0D5DD';

/** pg returns date columns as Date objects — render them as local YYYY-MM-DD. */
export function ymd(value: unknown) {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
      value.getDate()
    ).padStart(2, '0')}`;
  }
  return value ? String(value).slice(0, 10) : '';
}

/** Turns a filter object into "key=value, key=value" for the sheet header. */
export function describeFilters(filters: Record<string, unknown>, lao: boolean) {
  const parts = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${v}`);
  if (!parts.length) return lao ? 'ບໍ່ມີການກັ່ນຕອງ' : 'no filters';
  return parts.join(', ');
}

function startSheet(workbook: ExcelJS.Workbook, name: string, opts: SheetOptions) {
  const sheet = workbook.addWorksheet(name);
  sheet.addRow([
    opts.lao
      ? 'ກົມອາຊີວະສຶກສາ ແລະ ການຝຶກອົບຮົມວິຊາຊີບ'
      : 'Department of Technical and Vocational Education and Training',
  ]);
  sheet.addRow([opts.subtitle]);
  sheet.addRow([opts.lao ? 'ຂອບເຂດ' : 'Scope', opts.scopeLine]);
  sheet.addRow([
    opts.lao ? 'ໄລຍະເວລາ' : 'Period',
    opts.period?.start || opts.period?.end
      ? `${opts.period?.start || '…'} → ${opts.period?.end || '…'}`
      : opts.lao ? 'ທັງໝົດ' : 'all dates',
  ]);
  sheet.addRow([
    opts.lao ? 'ວັນທີສົ່ງອອກ' : 'Exported at',
    new Date().toISOString().slice(0, 16).replace('T', ' '),
  ]);
  sheet.addRow([]);
  return sheet;
}

function addHeaderRow(sheet: ExcelJS.Worksheet, headers: string[]) {
  const row = sheet.addRow(headers);
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.border = { bottom: { style: 'thin', color: { argb: HEADER_BORDER } } };
  });
  return row.number;
}

function finishSheet(sheet: ExcelJS.Worksheet, widths: number[], headerRowNumber: number, hasRows: boolean) {
  sheet.columns.forEach((col, i) => {
    col.width = widths[i] || 16;
  });
  // Lao script needs a font that can render it and room to breathe.
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.font = { ...(cell.font || {}), name: 'Noto Sans Lao' };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
  });
  sheet.views = [{ state: 'frozen', ySplit: headerRowNumber }];
  if (hasRows) {
    sheet.autoFilter = {
      from: { row: headerRowNumber, column: 1 },
      to: { row: headerRowNumber, column: widths.length },
    };
  }
}

export const ExcelService = {
  /** Activity rows — used by the activity list and the approvals queue. */
  activitiesWorkbook(rows: any[], opts: SheetOptions) {
    const { lao } = opts;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TVED Activity & Task Tracking System';
    const sheet = startSheet(workbook, lao ? 'ກິດຈະກຳ' : 'Activities', opts);

    const headers = lao
      ? ['ລຳດັບ', 'ວັນທີເລີ່ມ', 'ວັນທີສິ້ນສຸດ', 'ເວລາ', 'ປະເພດ', 'ຫົວຂໍ້ (ລາວ)', 'ຫົວຂໍ້ (ອັງກິດ)',
         'ຜູ້ຮັບຜິດຊອບ', 'ລະຫັດພະນັກງານ', 'ພະແນກ', 'ສະຖານະ', 'ຊົ່ວໂມງ', 'ສະຖານທີ່', 'ຄວາມສຳຄັນ', 'ຄວາມຄືບໜ້າ (%)']
      : ['#', 'Start date', 'End date', 'Time', 'Type', 'Title (Lao)', 'Title (English)',
         'Owner', 'Staff code', 'Division', 'Status', 'Hours', 'Location', 'Priority', 'Progress (%)'];
    const headerRow = addHeaderRow(sheet, headers);

    rows.forEach((r, i) => {
      sheet.addRow([
        i + 1,
        ymd(r.start_date),
        ymd(r.end_date),
        r.is_all_day
          ? lao ? 'ຕະຫຼອດມື້' : 'All day'
          : [r.start_time, r.end_time].filter(Boolean).map((x: string) => String(x).slice(0, 5)).join(' – '),
        (lao ? r.type_name_lo : r.type_name_en) || '',
        r.title_lo,
        r.title_en || '',
        r.owner_name || '',
        r.owner_staff_code || '',
        (lao ? r.division_name_lo : r.division_name_en) || '',
        r.status,
        Number(((r.duration_minutes || 0) / 60).toFixed(2)),
        r.location || '',
        r.priority || '',
        r.progress_percent ?? 0,
      ]);
    });

    sheet.addRow([]);
    const totals = sheet.addRow([
      lao ? 'ລວມ' : 'Total',
      String(rows.length),
      '', '', '', '', '', '', '', '', '',
      Number((rows.reduce((sum, r) => sum + (r.duration_minutes || 0), 0) / 60).toFixed(2)),
    ]);
    totals.font = { bold: true };

    finishSheet(sheet, [6, 13, 13, 14, 18, 42, 42, 24, 14, 24, 12, 9, 24, 12, 13], headerRow, rows.length > 0);
    return workbook;
  },

  /** Per-staff summary rows — used by the team page. */
  staffWorkbook(rows: any[], opts: SheetOptions) {
    const { lao } = opts;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TVED Activity & Task Tracking System';
    const sheet = startSheet(workbook, lao ? 'ພະນັກງານ' : 'Team', opts);

    const headers = lao
      ? ['ລຳດັບ', 'ຊື່ ແລະ ນາມສະກຸນ', 'ລະຫັດພະນັກງານ', 'ພະແນກ', 'ໂທລະສັບ', 'ອີເມວ',
         'ສົ່ງແລ້ວ', 'ອະນຸມັດແລ້ວ', 'ຊົ່ວໂມງລວມ', 'ສະຖານະການລາຍງານ']
      : ['#', 'Full name', 'Staff code', 'Division', 'Phone', 'Email',
         'Submitted', 'Approved', 'Total hours', 'Reporting status'];
    const headerRow = addHeaderRow(sheet, headers);

    rows.forEach((r, i) => {
      sheet.addRow([
        i + 1,
        r.full_name || '',
        r.staff_code || '',
        (lao ? r.division_name_lo : r.division_name_en) || '',
        r.phone || '',
        r.email || '',
        r.submitted_count ?? 0,
        r.approved_count ?? 0,
        Number(((r.total_minutes || 0) / 60).toFixed(2)),
        r.not_submitted
          ? lao ? 'ຍັງບໍ່ໄດ້ສົ່ງ' : 'Not submitted'
          : lao ? 'ສົ່ງແລ້ວ' : 'Reported',
      ]);
    });

    sheet.addRow([]);
    const totals = sheet.addRow([
      lao ? 'ລວມ' : 'Total',
      String(rows.length),
      '', '', '', '',
      rows.reduce((sum, r) => sum + (r.submitted_count || 0), 0),
      rows.reduce((sum, r) => sum + (r.approved_count || 0), 0),
      Number((rows.reduce((sum, r) => sum + (r.total_minutes || 0), 0) / 60).toFixed(2)),
    ]);
    totals.font = { bold: true };

    finishSheet(sheet, [6, 28, 16, 26, 18, 28, 12, 13, 14, 20], headerRow, rows.length > 0);
    return workbook;
  },

  /**
   * Generic table for the report exports, whose columns differ per report type.
   * Column keys are turned into readable headings, and minute/date columns are
   * rendered rather than dumped raw.
   */
  reportWorkbook(rows: any[], opts: SheetOptions & { sheetName?: string }) {
    const { lao } = opts;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TVED Activity & Task Tracking System';
    const sheet = startSheet(workbook, opts.sheetName || (lao ? 'ລາຍງານ' : 'Report'), opts);

    if (!rows.length) {
      sheet.addRow([lao ? 'ບໍ່ພົບຂໍ້ມູນ' : 'No records']);
      finishSheet(sheet, [40], 6, false);
      return workbook;
    }

    // Lao name columns are dropped when their English twin is present in the
    // English sheet, and vice versa, so the export isn't doubled up. Primary and
    // foreign keys are dropped too — they mean nothing to a reader.
    const available = Object.keys(rows[0]);
    const dropLocale = lao ? /_en$/ : /_lo$/;
    const keys = available.filter(
      (k) =>
        k !== 'participants' &&
        k !== 'description' &&
        k !== 'id' &&
        !/_id$/.test(k) &&
        !(dropLocale.test(k) && available.includes(k.replace(dropLocale, lao ? '_lo' : '_en')))
    );

    // Minute columns are written as hours, so their heading has to say hours.
    const heading = (key: string) => {
      if (key.includes('minute')) return lao ? 'ຊົ່ວໂມງລວມ' : 'Total hours';
      return key
        .replace(/_(lo|en)$/, '')
        .replace(/_/g, ' ')
        .replace(/^./, (c) => c.toUpperCase());
    };
    const headerRow = addHeaderRow(sheet, keys.map(heading));

    for (const row of rows) {
      sheet.addRow(
        keys.map((k) => {
          const value = row[k];
          if (k.includes('minute')) return Number(((value || 0) / 60).toFixed(2));
          if (k.includes('date')) return ymd(value);
          if (value === null || value === undefined) return '';
          if (value instanceof Date) return ymd(value);
          if (typeof value === 'object') return JSON.stringify(value);
          return value;
        })
      );
    }

    const minuteKey = keys.find((k) => k.includes('minute'));
    if (minuteKey) {
      sheet.addRow([]);
      const totals = sheet.addRow(
        keys.map((k, i) => {
          if (i === 0) return lao ? 'ລວມ' : 'Total';
          if (k === minuteKey) {
            return Number((rows.reduce((sum, r) => sum + (r[minuteKey] || 0), 0) / 60).toFixed(2));
          }
          return '';
        })
      );
      totals.font = { bold: true };
    }

    finishSheet(
      sheet,
      keys.map((k) => (/title|name|location|description/.test(k) ? 38 : 16)),
      headerRow,
      true
    );
    return workbook;
  },
};

/** Sets the download headers and streams a workbook to the response. */
export async function sendWorkbook(res: any, workbook: ExcelJS.Workbook, filename: string) {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  return res.end();
}
