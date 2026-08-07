import { loadXLSX } from '@/lib/xlsx-loader';
import {
  ProjectDetail, STATUS_CONFIG, SEVERITY_CONFIG,
  averageProgress, componentsOf,
} from './shared';

/**
 * Export 1 proyek ke Excel — 3 sheet:
 *   1. Ringkasan       — header proyek + statistik
 *   2. Status Lokasi   — 1 baris per lokasi + komponennya
 *   3. Rekap Isu       — daftar isu terbuka
 *
 * Gaya sel mengikuti pola Picket Showroom & Ticketing (Arial, border tipis,
 * header berwarna solid) supaya file yang dikirim ke user terlihat seragam.
 */
export function exportProjectToExcel(detail: ProjectDetail) {
  const runExport = (XLSX: any) => {
    const { project, locations, issues, components } = detail;
    const exportDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const sortedLoc = [...locations].sort((a, b) => a.sort_order - b.sort_order);

    // ── Style ────────────────────────────────────────────────────────────────
    const border = { top:{style:'thin',color:{rgb:'D1D5DB'}}, bottom:{style:'thin',color:{rgb:'D1D5DB'}}, left:{style:'thin',color:{rgb:'D1D5DB'}}, right:{style:'thin',color:{rgb:'D1D5DB'}} };
    const boldBorder = { top:{style:'thin',color:{rgb:'000000'}}, bottom:{style:'thin',color:{rgb:'000000'}}, left:{style:'thin',color:{rgb:'000000'}}, right:{style:'thin',color:{rgb:'000000'}} };
    const hdrStyle   = { font:{name:'Arial',bold:true,sz:11,color:{rgb:'FFFFFF'}}, fill:{fgColor:{rgb:'0E7490'},patternType:'solid'}, alignment:{horizontal:'center',vertical:'center',wrapText:true}, border:boldBorder };
    const secHdr     = { font:{name:'Arial',bold:true,sz:10,color:{rgb:'FFFFFF'}}, fill:{fgColor:{rgb:'0891B2'},patternType:'solid'}, alignment:{horizontal:'center',vertical:'center'}, border:boldBorder };
    const cellStyle  = { font:{name:'Arial',sz:10}, alignment:{vertical:'center',wrapText:true}, border };
    const altStyle   = { ...cellStyle, fill:{fgColor:{rgb:'F0FDFA'},patternType:'solid'} };
    const labelStyle = { font:{name:'Arial',bold:true,sz:10,color:{rgb:'334155'}}, alignment:{vertical:'center'}, border };
    const titleStyle = { font:{name:'Arial',bold:true,sz:16,color:{rgb:'0E7490'}}, alignment:{horizontal:'left',vertical:'center'} };
    const subStyle   = { font:{name:'Arial',sz:10,color:{rgb:'6B7280'}}, alignment:{horizontal:'left',vertical:'center'} };

    const cell  = (v: any, s?: any) => ({ v: v ?? '', s: s || cellStyle, t: typeof v === 'number' ? 'n' : 's' });
    const empty = (s?: any) => ({ v: '', s: s || cellStyle, t: 's' });
    const row0  = (n: number, s?: any) => Array(n).fill(null).map(() => empty(s));

    const statusLabel = (s: string) => STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label ?? s;
    const sevLabel    = (s: string) => SEVERITY_CONFIG[s as keyof typeof SEVERITY_CONFIG]?.label ?? s;

    const wb = XLSX.utils.book_new();
    const avg = averageProgress(sortedLoc);
    const blocked = sortedLoc.filter(l => l.status === 'blocked').length;

    // ── Sheet 1: Ringkasan ──────────────────────────────────────────────────
    {
      const data: any[][] = [];
      data.push([{ v: project.name, s: titleStyle }, ...row0(3, titleStyle)]);
      data.push([{ v: `Diekspor ${exportDate}`, s: subStyle }, ...row0(3, subStyle)]);
      data.push(row0(4, subStyle));

      data.push([cell('RINGKASAN', secHdr), ...row0(3, secHdr)]);
      const info: [string, string | number][] = [
        ['Nama Proyek',    project.name],
        ['Client',         project.client ?? '—'],
        ['Status',         statusLabel(project.status)],
        ['Deskripsi',      project.description ?? '—'],
        ['Total Lokasi',   sortedLoc.length],
        ['Rata-rata Progres', `${avg}%`],
        ['Isu Terbuka',    issues.length],
        ['Butuh Perhatian', `${blocked} lokasi`],
      ];
      for (const [k, v] of info) {
        data.push([cell(k, labelStyle), cell(v), empty(), empty()]);
      }

      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 22 }, { wch: 46 }, { wch: 14 }, { wch: 14 }];
      ws['!merges'] = [
        { s:{r:0,c:0}, e:{r:0,c:3} },
        { s:{r:1,c:0}, e:{r:1,c:3} },
        { s:{r:3,c:0}, e:{r:3,c:3} },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Ringkasan');
    }

    // ── Sheet 2: Status Lokasi ──────────────────────────────────────────────
    {
      const data: any[][] = [];
      data.push([{ v: 'STATUS PER LOKASI', s: titleStyle }, ...row0(5, titleStyle)]);
      data.push(row0(6, subStyle));
      data.push(['No', 'Lokasi', 'PIC', 'Status', 'Progres', 'Komponen & Catatan'].map(h => cell(h, hdrStyle)));

      sortedLoc.forEach((loc, i) => {
        const st = i % 2 === 1 ? altStyle : cellStyle;
        const comps = componentsOf(components, loc.id);
        const compText = comps.length
          ? comps.map(c => `• ${c.label}`).join('\n')
          : '—';
        const noteText = loc.note ? `\n\nCatatan: ${loc.note}` : '';
        data.push([
          cell(i + 1, st),
          cell(loc.name, st),
          cell(loc.pic ?? '—', st),
          cell(statusLabel(loc.status), st),
          cell(`${loc.progress}%`, st),
          cell(compText + noteText, st),
        ]);
      });

      if (sortedLoc.length === 0) {
        data.push([cell('Belum ada lokasi', cellStyle), ...row0(5)]);
      }

      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 5 }, { wch: 26 }, { wch: 18 }, { wch: 16 }, { wch: 10 }, { wch: 52 }];
      ws['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:5} }];
      XLSX.utils.book_append_sheet(wb, ws, 'Status Lokasi');
    }

    // ── Sheet 3: Rekap Isu ──────────────────────────────────────────────────
    {
      const data: any[][] = [];
      data.push([{ v: 'REKAP ISU TERBUKA', s: titleStyle }, ...row0(3, titleStyle)]);
      data.push(row0(4, subStyle));
      data.push(['Lokasi', 'Isu', 'Severity', 'Keterangan'].map(h => cell(h, hdrStyle)));

      const sortedIssues = [...issues].sort((a, b) => a.sort_order - b.sort_order);
      sortedIssues.forEach((is, i) => {
        const st = i % 2 === 1 ? altStyle : cellStyle;
        data.push([
          cell(is.location_label ?? '—', st),
          cell(is.issue, st),
          cell(sevLabel(is.severity), st),
          cell(is.note ?? '—', st),
        ]);
      });

      if (sortedIssues.length === 0) {
        data.push([cell('Tidak ada isu terbuka', cellStyle), ...row0(3)]);
      }

      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 24 }, { wch: 38 }, { wch: 12 }, { wch: 52 }];
      ws['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:3} }];
      XLSX.utils.book_append_sheet(wb, ws, 'Rekap Isu');
    }

    const safeName = project.name.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'Project';
    const fileName = `Progress - ${safeName}.xlsx`;
    XLSX.writeFile(wb, fileName, { bookType: 'xlsx', type: 'binary', cellStyles: true });
  };

  loadXLSX(runExport);
}
