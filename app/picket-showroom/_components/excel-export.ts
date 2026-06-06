import { loadXLSX } from '@/lib/xlsx-loader';
import { PiketRow, KegiatanEntry } from './shared';

export function exportToExcel(allRows:PiketRow[], kegiatanList:KegiatanEntry[]) {
  const runExport = (XLSX:any) => {
    const exportDate = new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
    const sorted = [...allRows].sort((a,b)=>a.day_date.localeCompare(b.day_date));

    // ── Style definitions (same as ticketing) ──────────────────────────────
    const border = {top:{style:'thin',color:{rgb:'D1D5DB'}},bottom:{style:'thin',color:{rgb:'D1D5DB'}},left:{style:'thin',color:{rgb:'D1D5DB'}},right:{style:'thin',color:{rgb:'D1D5DB'}}};
    const boldBorder = {top:{style:'thin',color:{rgb:'000000'}},bottom:{style:'thin',color:{rgb:'000000'}},left:{style:'thin',color:{rgb:'000000'}},right:{style:'thin',color:{rgb:'000000'}}};
    const hdrStyle = {font:{name:'Arial',bold:true,sz:11,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:'991B1B'},patternType:'solid'},alignment:{horizontal:'center',vertical:'center',wrapText:true},border:boldBorder};
    const hdrBlue = {font:{name:'Arial',bold:true,sz:11,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:'1E3A5F'},patternType:'solid'},alignment:{horizontal:'center',vertical:'center',wrapText:true},border:boldBorder};
    const secHdr = {font:{name:'Arial',bold:true,sz:10,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:'DC2626'},patternType:'solid'},alignment:{horizontal:'center',vertical:'center'},border:boldBorder};
    const secHdrGreen = {font:{name:'Arial',bold:true,sz:10,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:'059669'},patternType:'solid'},alignment:{horizontal:'center',vertical:'center'},border:boldBorder};
    const secHdrPurple = {font:{name:'Arial',bold:true,sz:10,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:'7C3AED'},patternType:'solid'},alignment:{horizontal:'center',vertical:'center'},border:boldBorder};
    const secHdrBlue2 = {font:{name:'Arial',bold:true,sz:10,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:'2563EB'},patternType:'solid'},alignment:{horizontal:'center',vertical:'center'},border:boldBorder};
    const cellStyle = {font:{name:'Arial',sz:10},alignment:{vertical:'center',wrapText:true},border};
    const altStyle = {...cellStyle,fill:{fgColor:{rgb:'FFF5F5'},patternType:'solid'}};
    const titleStyle = {font:{name:'Arial',bold:true,sz:16,color:{rgb:'991B1B'}},alignment:{horizontal:'left',vertical:'center'}};
    const subTitleStyle = {font:{name:'Arial',sz:10,color:{rgb:'6B7280'}},alignment:{horizontal:'left',vertical:'center'}};
    const ctr = (v:any,s:any) => ({v,s,t:typeof v==='number'?'n':'s'});
    const cell = (v:any,s?:any) => ({v,s:s||cellStyle,t:typeof v==='number'?'n':'s'});
    const empty = (s?:any) => ({v:'',s:s||cellStyle,t:'s'});
    const row0 = (n:number,s?:any) => Array(n).fill(null).map(()=>empty(s));

    // Warna per jenis kegiatan
    const kgColorMap:Record<string,{bg:string;fg:string}> = {
      'Demo Product'   :{bg:'DBEAFE',fg:'1E40AF'},
      'RnD'            :{bg:'EDE9FE',fg:'6D28D9'},
      'Maintenance'    :{bg:'FEF3C7',fg:'92400E'},
      'Shooting Markom':{bg:'D1FAE5',fg:'065F46'},
    };
    const kgStyle=(jenis:string,base:any={})=>({
      ...base,...cellStyle,
      ...(kgColorMap[jenis]?{font:{name:'Arial',sz:10,bold:true,color:{rgb:kgColorMap[jenis].fg}},fill:{fgColor:{rgb:kgColorMap[jenis].bg},patternType:'solid'}}:{}),
    });

    // PIC team color
    const picStyle=(team:string,base:any={})=>{
      const colors:Record<string,{bg:string;fg:string}> = {'PTS IVP':{bg:'FEE2E2',fg:'991B1B'},'PTS UMP':{bg:'DBEAFE',fg:'1E3A5F'},'PTS MLDS':{bg:'EDE9FE',fg:'6D28D9'}};
      const c=colors[team]||{bg:'F3F4F6',fg:'374151'};
      return{...base,...cellStyle,font:{name:'Arial',sz:9,bold:true,color:{rgb:c.fg}},fill:{fgColor:{rgb:c.bg},patternType:'solid'}};
    };

    const wb = XLSX.utils.book_new();

    // ════════════════════════════════════════════════════════════════════════
    // SHEET 1 — 📊 Dashboard
    // ════════════════════════════════════════════════════════════════════════
    {
      const COLS = 6;
      const totalHari = sorted.length;
      const totalKegiatan = kegiatanList.length;
      const totalDemo = kegiatanList.filter(k=>k.jenis_kegiatan==='Demo Product'&&k.tamu_instansi).length;
      const totalRnD = kegiatanList.filter(k=>k.jenis_kegiatan==='RnD').length;
      const totalMaint = kegiatanList.filter(k=>k.jenis_kegiatan==='Maintenance').length;
      const totalShoot = kegiatanList.filter(k=>k.jenis_kegiatan==='Shooting Markom').length;
      const activeDaysSet = new Set(kegiatanList.map(k=>{const r=sorted.find(r=>r.id===k.piket_id);return r?.day_date;}).filter(Boolean));
      const totalActiveDays = activeDaysSet.size;

      // Top divisi
      const divMapEx:Record<string,number>={};
      kegiatanList.forEach(k=>{if(k.sales_division)divMapEx[k.sales_division]=(divMapEx[k.sales_division]||0)+1;});
      const divArrEx=Object.entries(divMapEx).sort(([,a],[,b])=>b-a);
      const topDivisiEx=divArrEx[0]?.[0]||'-';
      const topDivisiCountEx=divArrEx[0]?.[1]||0;

      // Top kegiatan
      const kgMapEx:Record<string,number>={'Demo Product':totalDemo,'RnD':totalRnD,'Maintenance':totalMaint,'Shooting Markom':totalShoot};
      const topKgEx=Object.entries(kgMapEx).sort(([,a],[,b])=>b-a)[0]?.[0]||'-';

      // Top produk — distribusi All Product ke semua produk spesifik
      const PRODUK_SPESIFIK_EX=['Videowall','LED','IFP','Audio System','Lighting','Kiosk'];
      const prodMapEx:Record<string,number>={};
      kegiatanList.forEach(k=>{
        const produk=k.produk||[];
        if(produk.includes('All Product')){
          PRODUK_SPESIFIK_EX.forEach(p=>{prodMapEx[p]=(prodMapEx[p]||0)+1;});
        } else {
          produk.forEach(p=>{prodMapEx[p]=(prodMapEx[p]||0)+1;});
        }
      });
      const prodArrEx=Object.entries(prodMapEx).sort(([,a],[,b])=>b-a);
      const topProdukEx=prodArrEx[0]?.[0]||'-';

      const data:any[][] = [
        [cell('📊 PIKET SHOWROOM — DASHBOARD REPORT',titleStyle),...row0(COLS-1,titleStyle)],
        [cell(`Tanggal Export: ${exportDate}`,subTitleStyle),...row0(COLS-1)],
        row0(COLS),
        // ── Ringkasan ──
        [ctr('RINGKASAN STATISTIK',secHdr),...row0(COLS-1,secHdr)],
        [ctr('Kategori',hdrStyle),ctr('Jumlah',hdrStyle),ctr('Persentase / Keterangan',hdrStyle),ctr('',hdrStyle),ctr('',hdrStyle),ctr('',hdrStyle)],
      ];
      const stats = [
        {label:'Hari Aktif (ada kegiatan)', val:totalActiveDays, note:`dari ${totalHari} hari piket`, fg:'1E3A5F'},
        {label:'Total Kegiatan',            val:totalKegiatan,   note:'semua jenis',                  fg:'DC2626'},
        {label:'Demo Product',              val:totalDemo,       note:totalKegiatan>0?((totalDemo/totalKegiatan)*100).toFixed(1)+'%':'0%', fg:'1E40AF'},
        {label:'RnD',                       val:totalRnD,        note:totalKegiatan>0?((totalRnD/totalKegiatan)*100).toFixed(1)+'%':'0%',  fg:'6D28D9'},
        {label:'Maintenance',               val:totalMaint,      note:totalKegiatan>0?((totalMaint/totalKegiatan)*100).toFixed(1)+'%':'0%',fg:'92400E'},
        {label:'Shooting Markom',           val:totalShoot,      note:totalKegiatan>0?((totalShoot/totalKegiatan)*100).toFixed(1)+'%':'0%',fg:'065F46'},
        {label:'Top Jenis Kegiatan',        val:topKgEx,         note:'terbanyak',                    fg:'7C3AED', isText:true},
        {label:'Top Divisi Sales',          val:topDivisiEx,     note:`${topDivisiCountEx}x kegiatan`,fg:'0891B2', isText:true},
        {label:'Top Produk Demo',           val:topProdukEx,     note:`${prodArrEx[0]?.[1]||0}x digunakan`, fg:'059669', isText:true},
      ];
      stats.forEach((s,i)=>{
        const rs = i%2===0?cellStyle:altStyle;
        data.push([
          cell(s.label,{...rs,font:{name:'Arial',sz:10,bold:true,color:{rgb:s.fg}}}),
          (s as any).isText
            ? cell(s.val,{...rs,font:{name:'Arial',sz:10,bold:true,color:{rgb:s.fg}}})
            : ctr(s.val,{...rs,alignment:{horizontal:'center',vertical:'center'}}),
          cell(s.note,{...rs,font:{name:'Arial',sz:9,color:{rgb:'6B7280'}}}),
          empty(),empty(),empty(),
        ]);
      });

      data.push(row0(COLS));

      // ── Statistik Produk (baru) ──
      if(prodArrEx.length>0){
        const secHdrTeal={font:{name:'Arial',bold:true,sz:10,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:'0F766E'},patternType:'solid'},alignment:{horizontal:'center',vertical:'center'},border:boldBorder};
        data.push([ctr('PENGGUNAAN PRODUK',secHdrTeal),...row0(COLS-1,secHdrTeal)]);
        data.push([ctr('Produk',hdrBlue),ctr('Jumlah Digunakan',hdrBlue),ctr('Persentase',hdrBlue),ctr('',hdrBlue),ctr('',hdrBlue),ctr('',hdrBlue)]);
        const totalProduk=prodArrEx.reduce((s,[,v])=>s+v,0);
        prodArrEx.forEach(([prod,cnt],i)=>{
          const pct=totalProduk>0?((cnt/totalProduk)*100).toFixed(1)+'%':'0%';
          const rs=i%2===0?cellStyle:altStyle;
          data.push([cell(prod,rs),ctr(cnt,{...rs,alignment:{horizontal:'center',vertical:'center'}}),ctr(pct,{...rs,alignment:{horizontal:'center',vertical:'center'}}),empty(),empty(),empty()]);
        });
        data.push(row0(COLS));
      }

      // ── Statistik per Instansi ──
      const instansiMap:Record<string,number>={};
      kegiatanList.filter(k=>k.tamu_instansi).forEach(k=>{instansiMap[k.tamu_instansi!]=(instansiMap[k.tamu_instansi!]||0)+1;});
      const instansiArr = Object.entries(instansiMap).sort(([,a],[,b])=>b-a);
      if(instansiArr.length>0){
        data.push([ctr('TAMU INSTANSI',secHdrBlue2),...row0(COLS-1,secHdrBlue2)]);
        data.push([ctr('Instansi',hdrBlue),ctr('Jumlah Demo',hdrBlue),ctr('Persentase',hdrBlue),ctr('',hdrBlue),ctr('',hdrBlue),ctr('',hdrBlue)]);
        instansiArr.forEach(([inst,cnt],i)=>{
          const pct = totalDemo>0?((cnt/totalDemo)*100).toFixed(1)+'%':'0%';
          const rs = i%2===0?cellStyle:altStyle;
          data.push([cell(inst,rs),ctr(cnt,{...rs,alignment:{horizontal:'center',vertical:'center'}}),ctr(pct,{...rs,alignment:{horizontal:'center',vertical:'center'}}),empty(),empty(),empty()]);
        });
        data.push(row0(COLS));
      }

      // ── Statistik Division Sales ──
      if(divArrEx.length>0){
        data.push([ctr('DIVISION SALES AKTIF',secHdrPurple),...row0(COLS-1,secHdrPurple)]);
        data.push([ctr('Division',hdrStyle),ctr('Jumlah Kegiatan',hdrStyle),ctr('Persentase',hdrStyle),ctr('',hdrStyle),ctr('',hdrStyle),ctr('',hdrStyle)]);
        divArrEx.forEach(([div,cnt],i)=>{
          const pct=totalKegiatan>0?((cnt/totalKegiatan)*100).toFixed(1)+'%':'0%';
          const rs=i%2===0?cellStyle:altStyle;
          data.push([cell(div,rs),ctr(cnt,{...rs,alignment:{horizontal:'center',vertical:'center'}}),ctr(pct,{...rs,alignment:{horizontal:'center',vertical:'center'}}),empty(),empty(),empty()]);
        });
        data.push(row0(COLS));
      }

      // ── Statistik PIC ──
      const picMap:Record<string,number>={};
      sorted.forEach(r=>{
        const names=[r.pic_ivp_name,r.pic_ump_name,r.pic_mlds_name].filter(Boolean) as string[];
        names.forEach(n=>{picMap[n]=(picMap[n]||0)+1;});
      });
      const picArr = Object.entries(picMap).sort(([,a],[,b])=>b-a);
      if(picArr.length>0){
        data.push([ctr('STATISTIK PIC PIKET',secHdrGreen),...row0(COLS-1,secHdrGreen)]);
        data.push([ctr('Nama PIC',hdrStyle),ctr('Total Hari Piket',hdrStyle),ctr('Persentase',hdrStyle),ctr('',hdrStyle),ctr('',hdrStyle),ctr('',hdrStyle)]);
        picArr.forEach(([name,cnt],i)=>{
          const pct = totalHari>0?((cnt/totalHari)*100).toFixed(1)+'%':'0%';
          const rs = i%2===0?cellStyle:altStyle;
          data.push([cell(name,rs),ctr(cnt,{...rs,alignment:{horizontal:'center',vertical:'center'}}),ctr(pct,{...rs,alignment:{horizontal:'center',vertical:'center'}}),empty(),empty(),empty()]);
        });
        data.push(row0(COLS));
      }

      // ── Statistik Kebutuhan ──
      const kbtMap:Record<string,number>={};
      kegiatanList.forEach(k=>(k.kebutuhan||[]).forEach(kb=>{kbtMap[kb]=(kbtMap[kb]||0)+1;}));
      const kbtArr = Object.entries(kbtMap).sort(([,a],[,b])=>b-a);
      if(kbtArr.length>0){
        data.push([ctr('KEBUTUHAN TERBANYAK',secHdrPurple),...row0(COLS-1,secHdrPurple)]);
        data.push([ctr('Kebutuhan',hdrStyle),ctr('Jumlah',hdrStyle),ctr('Persentase',hdrStyle),ctr('',hdrStyle),ctr('',hdrStyle),ctr('',hdrStyle)]);
        kbtArr.slice(0,10).forEach(([kb,cnt],i)=>{
          const pct = totalDemo>0?((cnt/totalDemo)*100).toFixed(1)+'%':'0%';
          const rs = i%2===0?cellStyle:altStyle;
          data.push([cell(kb,rs),ctr(cnt,{...rs,alignment:{horizontal:'center',vertical:'center'}}),ctr(pct,{...rs,alignment:{horizontal:'center',vertical:'center'}}),empty(),empty(),empty()]);
        });
      }

      const ws = XLSX.utils.aoa_to_sheet(data);
      const merges:any[]=[
        {s:{r:0,c:0},e:{r:0,c:COLS-1}},
        {s:{r:1,c:0},e:{r:1,c:COLS-1}},
        {s:{r:3,c:0},e:{r:3,c:COLS-1}},
      ];
      ws['!merges']=merges;
      ws['!cols']=[{wch:32},{wch:16},{wch:24},{wch:16},{wch:16},{wch:16}];
      ws['!rows']=[{hpt:34},{hpt:18},{hpt:8},{hpt:24}];
      XLSX.utils.book_append_sheet(wb,ws,'📊 Dashboard');
    }

    // ════════════════════════════════════════════════════════════════════════
    // SHEET 2 — 📋 Jadwal Piket
    // ════════════════════════════════════════════════════════════════════════
    {
      const headers=['No.','Tanggal','Hari','PIC','Team PIC','Jenis Kegiatan','Jam Mulai','Jam Selesai','Produk','Tamu Instansi','Nama Sales','Division Sales','Kebutuhan','Keterangan','Diedit Oleh'];
      const COLS=headers.length;
      const data:any[][]=[
        [cell('📋 DATA JADWAL PIKET SHOWROOM',{...titleStyle,font:{name:'Arial',bold:true,sz:14,color:{rgb:'991B1B'}}}),...row0(COLS-1)],
        [cell(`Total: ${sorted.length} hari piket · ${kegiatanList.length} kegiatan · Export: ${exportDate}`,subTitleStyle),...row0(COLS-1)],
        row0(COLS),
        headers.map(h=>ctr(h,hdrStyle)),
      ];
      let rowIdx=0;
      sorted.forEach(piket=>{
        const kgs=kegiatanList.filter(k=>k.piket_id===piket.id);
        const toR=kgs.length>0?kgs:[null];
        const dateObj=new Date(piket.day_date+'T00:00:00');
        const dateStr=dateObj.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
        const picNames=[piket.pic_ivp_name,piket.pic_ump_name,piket.pic_mlds_name].filter(Boolean).join(' / ')||'-';
        const picTeams=[piket.pic_ivp_name?'PTS IVP':'',piket.pic_ump_name?'PTS UMP':'',piket.pic_mlds_name?'PTS MLDS':''].filter(Boolean).join(' / ')||'-';
        const teamKey=piket.pic_ivp_name?'PTS IVP':piket.pic_ump_name?'PTS UMP':'PTS MLDS';
        toR.forEach((kg,ki)=>{
          const rs = rowIdx%2===0?cellStyle:altStyle;
          const ctrStyle = {...rs,alignment:{horizontal:'center',vertical:'center'}};
          data.push([
            ctr(rowIdx+1,ctrStyle),
            cell(dateStr,rs),
            cell(piket.day_of_week,{...rs,font:{name:'Arial',sz:10,bold:true,color:{rgb:'991B1B'}}}),
            cell(picNames,picStyle(teamKey,rs)),
            cell(picTeams,{...rs,font:{name:'Arial',sz:9,color:{rgb:'6B7280'}}}),
            kg ? cell(kg.jenis_kegiatan,kgStyle(kg.jenis_kegiatan)) : cell('-',rs),
            kg?.jam_mulai ? ctr(kg.jam_mulai,ctrStyle) : cell('-',rs),
            kg?.jam_selesai ? ctr(kg.jam_selesai,ctrStyle) : cell('-',rs),
            cell(kg?.produk?.join(', ')||'-',rs),
            cell(kg?.tamu_instansi||'-',rs),
            cell(kg?.nama_sales||'-',rs),
            cell(kg?.sales_division||'-',rs),
            cell(kg?.kebutuhan?.join(', ')||'-',rs),
            cell(kg?.keterangan||'-',{...rs,alignment:{horizontal:'left',vertical:'center',wrapText:true}}),
            cell((kg as any)?.edited_by_name||'-',{...rs,font:{name:'Arial',sz:9,color:{rgb:'6B7280'}}}),
          ]);
          rowIdx++;
        });
      });
      const ws=XLSX.utils.aoa_to_sheet(data);
      ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:COLS-1}},{s:{r:1,c:0},e:{r:1,c:COLS-1}}];
      ws['!cols']=[{wch:5},{wch:24},{wch:10},{wch:22},{wch:14},{wch:18},{wch:10},{wch:10},{wch:26},{wch:26},{wch:20},{wch:14},{wch:32},{wch:36},{wch:20}];
      ws['!rows']=[{hpt:28},{hpt:18},{hpt:8},{hpt:32}];
      XLSX.utils.book_append_sheet(wb,ws,'📋 Jadwal Piket');
    }

    // ════════════════════════════════════════════════════════════════════════
    // SHEET 3 — 🏢 Demo Product
    // ════════════════════════════════════════════════════════════════════════
    {
      const demoKg=kegiatanList.filter(k=>k.jenis_kegiatan==='Demo Product'&&k.tamu_instansi);
      const headers=['No.','Tanggal','Hari','PIC','Tamu Instansi','Nama Sales','Division','Produk','Kebutuhan'];
      const COLS=headers.length;
      const data:any[][]=[
        [cell('🏢 DATA DEMO PRODUCT — PIKET SHOWROOM',{...titleStyle,font:{name:'Arial',bold:true,sz:14,color:{rgb:'1E40AF'}}}),...row0(COLS-1)],
        [cell(`Total Demo: ${demoKg.length} · Export: ${exportDate}`,subTitleStyle),...row0(COLS-1)],
        row0(COLS),
        headers.map(h=>ctr(h,hdrBlue)),
      ];
      // Build piket map
      const piketMap:Record<string,PiketRow>={};
      sorted.forEach(r=>{piketMap[r.id]=r;});
      demoKg.forEach((kg,i)=>{
        const piket=piketMap[kg.piket_id];
        if(!piket)return;
        const rs=i%2===0?cellStyle:altStyle;
        const ctrStyle={...rs,alignment:{horizontal:'center',vertical:'center'}};
        const dateStr=new Date(piket.day_date+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
        const picNames=[piket.pic_ivp_name,piket.pic_ump_name,piket.pic_mlds_name].filter(Boolean).join(' / ')||'-';
        data.push([
          ctr(i+1,ctrStyle),
          cell(dateStr,rs),
          cell(piket.day_of_week,{...rs,font:{name:'Arial',sz:10,bold:true,color:{rgb:'991B1B'}}}),
          cell(picNames,rs),
          cell(kg.tamu_instansi||'-',{...rs,font:{name:'Arial',sz:10,bold:true}}),
          cell(kg.nama_sales||'-',rs),
          cell(kg.sales_division||'-',{...rs,alignment:{horizontal:'center',vertical:'center'}}),
          cell(kg.produk?.join(', ')||'-',rs),
          cell(kg.kebutuhan?.join(', ')||'-',rs),
        ]);
      });
      const ws=XLSX.utils.aoa_to_sheet(data);
      ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:COLS-1}},{s:{r:1,c:0},e:{r:1,c:COLS-1}}];
      ws['!cols']=[{wch:5},{wch:24},{wch:10},{wch:22},{wch:28},{wch:20},{wch:14},{wch:26},{wch:36}];
      ws['!rows']=[{hpt:28},{hpt:18},{hpt:8},{hpt:32}];
      XLSX.utils.book_append_sheet(wb,ws,'🏢 Demo Product');
    }

    // ════════════════════════════════════════════════════════════════════════
    // SHEET 4 — 🔧 Kegiatan Lain (RnD, Maintenance, Shooting)
    // ════════════════════════════════════════════════════════════════════════
    {
      const lainKg=kegiatanList.filter(k=>k.jenis_kegiatan!=='Demo Product');
      const headers=['No.','Tanggal','Hari','PIC','Jenis Kegiatan','Jam Mulai','Jam Selesai','Produk','Keterangan'];
      const COLS=headers.length;
      const data:any[][]=[
        [cell('🔧 KEGIATAN LAIN — RnD / MAINTENANCE / SHOOTING MARKOM',{...titleStyle,font:{name:'Arial',bold:true,sz:14,color:{rgb:'7C3AED'}}}),...row0(COLS-1)],
        [cell(`Total: ${lainKg.length} kegiatan · Export: ${exportDate}`,subTitleStyle),...row0(COLS-1)],
        row0(COLS),
        headers.map(h=>ctr(h,{...hdrStyle,fill:{fgColor:{rgb:'7C3AED'},patternType:'solid'}})),
      ];
      const piketMap:Record<string,PiketRow>={};
      sorted.forEach(r=>{piketMap[r.id]=r;});
      lainKg.forEach((kg,i)=>{
        const piket=piketMap[kg.piket_id];
        if(!piket)return;
        const rs=i%2===0?cellStyle:altStyle;
        const ctrStyle={...rs,alignment:{horizontal:'center',vertical:'center'}};
        const dateStr=new Date(piket.day_date+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
        const picNames=[piket.pic_ivp_name,piket.pic_ump_name,piket.pic_mlds_name].filter(Boolean).join(' / ')||'-';
        data.push([
          ctr(i+1,ctrStyle),
          cell(dateStr,rs),
          cell(piket.day_of_week,{...rs,font:{name:'Arial',sz:10,bold:true,color:{rgb:'991B1B'}}}),
          cell(picNames,rs),
          cell(kg.jenis_kegiatan,kgStyle(kg.jenis_kegiatan)),
          kg.jam_mulai?ctr(kg.jam_mulai,ctrStyle):cell('-',rs),
          kg.jam_selesai?ctr(kg.jam_selesai,ctrStyle):cell('-',rs),
          cell(kg.produk?.join(', ')||'-',rs),
          cell(kg.keterangan||'-',{...rs,alignment:{horizontal:'left',vertical:'center',wrapText:true}}),
        ]);
      });
      const ws=XLSX.utils.aoa_to_sheet(data);
      ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:COLS-1}},{s:{r:1,c:0},e:{r:1,c:COLS-1}}];
      ws['!cols']=[{wch:5},{wch:24},{wch:10},{wch:22},{wch:18},{wch:10},{wch:10},{wch:26},{wch:44}];
      ws['!rows']=[{hpt:28},{hpt:18},{hpt:8},{hpt:32}];
      XLSX.utils.book_append_sheet(wb,ws,'🔧 Kegiatan Lain');
    }

    const fileName=`Piket_Showroom_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb,fileName,{bookType:'xlsx',type:'binary',cellStyles:true});
  };

  loadXLSX(runExport);
}
