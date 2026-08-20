import { Response } from 'express';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { AuthRequest } from '../middleware/auth.js';
import { HierarchyService } from '../services/HierarchyService.js';
import { ReportService, ReportFilter } from '../services/ReportService.js';
import { ExcelService, sendWorkbook, describeFilters } from '../services/ExcelService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseFilter(query: AuthRequest['query']): ReportFilter {
  return {
    period_type: query.period_type as ReportFilter['period_type'],
    start_date: (query.start_date as string) || new Date(new Date().setDate(1)).toISOString().slice(0, 10),
    end_date: (query.end_date as string) || new Date().toISOString().slice(0, 10),
    scope: query.scope as ReportFilter['scope'],
    user_ids: query.user_ids
      ? String(query.user_ids).split(',').map(Number)
      : undefined,
    division_ids: query.division_ids
      ? String(query.division_ids).split(',').map(Number)
      : undefined,
    activity_type_ids: query.activity_type_ids
      ? String(query.activity_type_ids).split(',').map(Number)
      : undefined,
    statuses: query.statuses ? String(query.statuses).split(',') : undefined,
    q: (query.q as string | undefined) || undefined,
    ...parseReportPaging(query),
  };
}

const PAGE_SIZES = [20, 50, 100];

/** Resolves ?limit and ?page for the report tables. */
function parseReportPaging(query: AuthRequest['query']) {
  const requested = Number(query.limit);
  const limit = PAGE_SIZES.includes(requested) ? requested : PAGE_SIZES[0];
  const page = Math.max(Number(query.page) || 1, 1);
  return { limit, offset: (page - 1) * limit };
}

async function me(req: AuthRequest) {
  return HierarchyService.getUserWithScope(req.user!.id);
}

export const getDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const data = await ReportService.dashboardStats(user, {
      start_date: req.query.start_date as string | undefined,
      end_date: req.query.end_date as string | undefined,
    });
    return res.json({ success: true, data });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const runReport = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const type = req.params.type;
    const filter = parseFilter(req.query);

    let data;
    switch (type) {
      case 'individual':
        data = await ReportService.individual(user, filter);
        break;
      case 'division':
        data = await ReportService.divisionSummary(user, filter);
        break;
      case 'department':
        data = await ReportService.departmentSummary(user, filter);
        break;
      case 'meetings':
        data = await ReportService.meetingsRegister(user, filter);
        break;
      case 'compliance':
        data = await ReportService.compliance(user, filter);
        break;
      default:
        return res.status(400).json({ error: 'Unknown report type' });
    }
    const limit = filter.limit || PAGE_SIZES[0];
    const page = Math.floor((filter.offset || 0) / limit) + 1;
    const total = (data as { total?: number }).total ?? (data.rows?.length ?? 0);

    return res.json({
      success: true,
      data,
      filter,
      meta: {
        total,
        page,
        limit,
        pages: Math.max(Math.ceil(total / limit), 1),
        has_prev: page > 1,
        has_next: page * limit < total,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const exportExcel = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const type = req.params.type;
    // Exports cover the whole filtered report, never just the page on screen.
    const filter = { ...parseFilter(req.query), limit: 0, offset: 0 };
    const report =
      type === 'division'
        ? await ReportService.divisionSummary(user, filter)
        : type === 'department'
          ? await ReportService.departmentSummary(user, filter)
          : type === 'compliance'
            ? await ReportService.compliance(user, filter)
            : type === 'meetings'
              ? await ReportService.meetingsRegister(user, filter)
              : await ReportService.individual(user, filter);

    const lao = (req.query.lang || 'lo') === 'lo';
    const titles: Record<string, [string, string]> = {
      individual: ['ລາຍງານລາຍບຸກຄົນ', 'Individual report'],
      division: ['ລາຍງານຂັ້ນພະແນກ', 'Division report'],
      department: ['ລາຍງານຂັ້ນກົມ', 'Department report'],
      meetings: ['ບັນຊີກອງປະຊຸມ', 'Meetings register'],
      compliance: ['ລາຍງານການປະຕິບັດການລາຍງານ', 'Reporting compliance'],
    };
    const [titleLo, titleEn] = titles[type] || titles.individual;

    const workbook = ExcelService.reportWorkbook(report.rows as any[], {
      lao,
      subtitle: lao ? titleLo : titleEn,
      scopeLine: describeFilters(
        {
          scope: filter.scope,
          statuses: filter.statuses?.join('|'),
          activity_type_ids: filter.activity_type_ids?.join('|'),
          user_ids: filter.user_ids?.join('|'),
          division_ids: filter.division_ids?.join('|'),
          q: filter.q,
        },
        lao
      ),
      period: { start: filter.start_date, end: filter.end_date },
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return sendWorkbook(res, workbook, `tved-${type}-report-${stamp}.xlsx`);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const exportPdf = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const filter = { ...parseFilter(req.query), limit: 0, offset: 0 };
    const report = await ReportService.individual(user, filter);

    const fontCandidates = [
      path.resolve(__dirname, '../../fonts/NotoSansLao-Regular.ttf'),
      path.resolve(__dirname, '../../../public/fonts/NotoSansLao-Regular.ttf'),
    ];
    const fontPath = fontCandidates.find((p) => fs.existsSync(p));
    const fontFace = `
      ${fontPath ? `@font-face { font-family: 'NotoSansLao'; src: url('file://${fontPath}'); }` : ''}
      body { font-family: 'NotoSansLao', 'Noto Sans Lao', 'Noto Sans', sans-serif; font-size: 12px; line-height: 1.8; }
      h1 { font-size: 18px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 6px; text-align: left; overflow-wrap: anywhere; }
    `;

    const rowsHtml = report.rows
      .map(
        (r: any) => `<tr>
          <td>${r.start_date}</td>
          <td>${r.type_name_lo || r.type_name_en || ''}</td>
          <td>${r.title_lo}</td>
          <td>${((r.duration_minutes || 0) / 60).toFixed(1)}h</td>
          <td>${r.status}</td>
        </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${fontFace}</style></head>
      <body>
        <h1>ລະບົບຕິດຕາມກິດຈະກຳ TVED</h1>
        <p>TVED Activity Report — ${filter.start_date} → ${filter.end_date}</p>
        <p>ລວມຊົ່ວໂມງ: ${report.total_hours}</p>
        <table>
          <thead><tr><th>ວັນທີ</th><th>ປະເພດ</th><th>ຫົວຂໍ້</th><th>ຊົ່ວໂມງ</th><th>ສະຖານະ</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body></html>`;

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="tved-report.pdf"');
    return res.send(Buffer.from(pdf));
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      error: 'PDF generation failed. Ensure Chromium dependencies are available.',
      message: e instanceof Error ? e.message : String(e),
    });
  }
};
