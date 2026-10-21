'use client';

/** useMuatKPI - dipecah dari app/(portal)/kpi-team/_components/DashboardKPI.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import React, { useCallback } from 'react';
import { CATEGORY_COLORS, PiketPic, STATUS_COLORS, computeCascadedPiketToday, getMonday, monthStart, todayStr } from './DashboardKPI-bantu';
import { lingkupSaya, namaKelompokPTS } from '@/lib/kelompok';
import { supabase } from '@/lib/supabase';
import { User } from '@/app/(portal)/dashboard/_components/shared';
import { KPIData, Scope } from './DashboardKPI-tipe';

export interface MuatKPIKonteks {
  currentUser: User;
  scope: Scope;
  scopeReady: boolean;
  setKpi: React.Dispatch<React.SetStateAction<KPIData | null>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useMuatKPI(k: MuatKPIKonteks) {
  const { currentUser, scope, scopeReady, setKpi, setLoading } = k;
  const fetchKPI = useCallback(async () => {
    if (!scopeReady || scope.kind === 'none') { setLoading(false); return; }
    setLoading(true);
    try {
      const today     = todayStr();
      const inOneWeek = new Date(); inOneWeek.setDate(inOneWeek.getDate()+7);
      const oneWeekStr = inOneWeek.toISOString().split('T')[0];

      // Nama anggota kelompok PTS yang SENGAJA dikeluarkan dari lingkup akun
      // ini (mis. Manager PTS IVP yang tidak membawahi PTS UMP) - dipakai
      // untuk MENGECUALIKAN, bukan membatasi ke satu kelompok saja. Admin
      // sungguhan (tanpa pemetaan Lingkup Manager) tetap melihat semuanya,
      // karena lingkupSaya() bawaannya mengembalikan seluruh kelompok PTS.
      // Beda dari 'pts_sup' yang MEMBATASI ke tim sendiri: di sini tiket
      // Sales/Marketing/Services tanpa kelompok PTS tetap harus ikut tampil.
      let namaDikecualikan: string[] = [];
      if (scope.kind === 'admin') {
        const kelompokDikecualikan = namaKelompokPTS().filter(t => !lingkupSaya(currentUser?.id).includes(t));
        if (kelompokDikecualikan.length > 0) {
          const { data: anggotaDikecualikan } = await supabase.from('users')
            .select('full_name').in('team_type', kelompokDikecualikan);
          namaDikecualikan = (anggotaDikecualikan ?? []).map((u: any) => u.full_name as string).filter(Boolean);
        }
      }

      // Helpers to build scoped queries
      const scopeTickets = (q: any) => {
        if (scope.kind === 'pts_sup' && scope.ptsMemberNames?.length) {
          return q.in('assign_name', scope.ptsMemberNames);
        }
        if (namaDikecualikan.length > 0) return q.not('assign_name', 'in', `(${namaDikecualikan.map(n => `"${n}"`).join(',')})`);
        return q;
      };
      const scopeReminders = (q: any) => {
        if (scope.kind === 'pts_sup' && scope.ptsMemberNames?.length) {
          return q.in('assign_name', scope.ptsMemberNames);
        }
        if (namaDikecualikan.length > 0) return q.not('assign_name', 'in', `(${namaDikecualikan.map(n => `"${n}"`).join(',')})`);
        return q;
      };

      // Parallel fetches
      const [ticketsRes, actLogsRes, remindersRes, piketHolidaysRes, piketWeekRes, kegiatanRes, movRes, usersRes, lcSessionsRes] =
        await Promise.all([
          scopeTickets(supabase.from('tickets').select('id,status,assign_name,sales_division,date,created_at,product')),
          supabase.from('activity_logs').select('id,ticket_id,new_status,created_at,handler_name').order('created_at',{ascending:false}).limit(500),
          scopeReminders(supabase.from('reminders').select('id,status,category,due_date,product')),
          supabase.from('picket_holidays').select('date'),
          supabase.from('piket_schedules').select('id,day_date,pic_ivp_name,pic_ump_name,pic_mvi_name').gte('day_date', getMonday()).lte('day_date', todayStr()).order('day_date'),
          supabase.from('piket_tamu_detail').select('id,created_at').gte('created_at', today),
          supabase.from('movement_logs').select('id,status_barang,tanggal,nama_pts').gte('tanggal', monthStart()),
          scope.kind === 'admin'
            ? supabase.from('users').select('id,role,team_type')
            : Promise.resolve({ data: [] }),
          scope.kind === 'admin'
            ? supabase.from('lc_quiz_attempts').select('id,user_id,score,passed,is_submitted,grading_status').eq('is_submitted', true).neq('grading_status', 'pending_review')
            : Promise.resolve({ data: [] }),
        ]);

      const tickets   = (ticketsRes.data   ?? []) as any[];
      const reminders = (remindersRes.data ?? []) as any[];
      let movements = (movRes.data       ?? []) as any[];
      const actLogs       = (actLogsRes.data     ?? []) as any[];
      const piketHolidays = (piketHolidaysRes.data ?? []).map((h: any) => h.date as string);
      const piketWeek     = (piketWeekRes.data   ?? []) as (PiketPic & { day_date: string; id: string })[];
      const piketToday    = computeCascadedPiketToday(piketWeek, piketHolidays, today);
      const kegiatan   = (kegiatanRes.data   ?? []) as any[];
      const users      = (usersRes.data      ?? []) as any[];
      const lcAttempts = (lcSessionsRes.data ?? []) as any[];

      // PTS scope: filter piket & movements to own team
      if (scope.kind === 'pts_sup') {
        const tt = scope.ptsTeamType ?? '';
        movements = movements.filter((m:any) => scope.ptsMemberNames?.includes(m.nama_pts));
        // piket: show all, but today card highlights their team column
      }

      // KPI calculations (identical to before, just on scoped data)
      const open           = tickets.filter((t:any)=>!['Solved','Cancelled'].includes(t.status)).length;
      const solved         = tickets.filter((t:any)=>t.status==='Solved').length;
      const waitingApproval= tickets.filter((t:any)=>t.status==='Waiting Approval').length;

      // Resolved today: cross-reference actLogs that belong to scoped tickets
      const scopedTicketIds = new Set(tickets.map((t:any)=>t.id as string));
      const resolvedToday = actLogs.filter((a:any)=>
        a.new_status==='Solved' && a.created_at?.startsWith(today) && scopedTicketIds.has(a.ticket_id)
      ).length;

      const handlerMap: Record<string,number> = {};
      tickets.filter((t:any)=>t.assign_name && !['Solved','Cancelled'].includes(t.status))
        .forEach((t:any)=>{ handlerMap[t.assign_name]=(handlerMap[t.assign_name]||0)+1; });
      const byHandler = Object.entries(handlerMap).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count);

      const statusMap: Record<string,number> = {};
      tickets.forEach((t:any)=>{ statusMap[t.status]=(statusMap[t.status]||0)+1; });
      const byStatus = Object.entries(statusMap).map(([status,count])=>({ status,count,color:STATUS_COLORS[status]??'#94a3b8' })).sort((a,b)=>b.count-a.count);

      const divMap: Record<string,number> = {};
      tickets.forEach((t:any)=>{ if(t.sales_division) divMap[t.sales_division]=(divMap[t.sales_division]||0)+1; });
      const byDivision = Object.entries(divMap).map(([div,count])=>({div,count})).sort((a,b)=>b.count-a.count);
      const productTicketMap: Record<string,number> = {};
      tickets.forEach((t:any)=>{ if(t.product) productTicketMap[t.product]=(productTicketMap[t.product]||0)+1; });
      const byProduct = Object.entries(productTicketMap).map(([product,count])=>({product,count})).sort((a,b)=>b.count-a.count);

      const solvedT = tickets.filter((t:any)=>t.status==='Solved'&&t.date&&t.created_at);
      const totalDays = solvedT.reduce((acc:number,t:any)=>{
        const d=(new Date(t.date).getTime()-new Date(t.created_at).getTime())/86400000;
        return acc+Math.max(0,d);
      },0);
      const avgResolutionDays = solvedT.length?Math.round(totalDays/solvedT.length):0;

      const currentYear = new Date().getFullYear();
      const monthlyTickets = Array.from({length: 12}, (_, mi) =>
        tickets.filter((t: any) => {
          const d = new Date(t.created_at);
          return d.getFullYear() === currentYear && d.getMonth() === mi;
        }).length
      );

      const catMap: Record<string,number> = {};
      reminders.forEach((r:any)=>{ catMap[r.category]=(catMap[r.category]||0)+1; });
      const byCategory = Object.entries(catMap).map(([cat,count])=>({ cat,count,color:CATEGORY_COLORS[cat]??'#94a3b8' })).sort((a,b)=>b.count-a.count);
      const dueSoon     = reminders.filter((r:any)=>r.status==='pending'&&r.due_date>=today&&r.due_date<=oneWeekStr).length;
      const overdueCount= reminders.filter((r:any)=>r.status==='pending'&&r.due_date<today).length;
      // Reminder byProduct: per produk, group by category
      const reminderProdMap: Record<string, Record<string,number>> = {};
      reminders.forEach((r:any)=>{ 
        if(r.product) {
          if(!reminderProdMap[r.product]) reminderProdMap[r.product]={};
          reminderProdMap[r.product][r.category||'Lainnya']=(reminderProdMap[r.product][r.category||'Lainnya']||0)+1;
        }
      });
      const remindersByProduct = Object.entries(reminderProdMap).map(([product,catMap])=>({
        product,
        byCategory: Object.entries(catMap).map(([cat,count])=>({cat,count})).sort((a,b)=>b.count-a.count),
      })).sort((a,b)=>b.byCategory.reduce((s,c)=>s+c.count,0)-a.byCategory.reduce((s,c)=>s+c.count,0));

      const weekFilled = piketWeek.filter((p:any)=>p.pic_ivp_name||p.pic_ump_name||p.pic_mvi_name).length;
      // weekTotal = jumlah hari kerja (Senin-Jumat) dari awal minggu ini s.d. hari ini
      // weekTotal selalu 5 (Senin-Jumat), bukan hanya sampai hari ini
      const weekWorkDays = 5;

      const roleMap: Record<string,number> = {};
      //  Role kosong / null dikelompokkan sebagai "belum diatur" - dulu kunci objeknya jadi teks "null" dan tampil "NULL" di grafik.
      users.forEach((u:any)=>{ const r = typeof u.role === 'string' && u.role.trim() ? u.role.trim() : 'belum diatur'; roleMap[r]=(roleMap[r]||0)+1; });

      // Learning: dari lc_quiz_attempts (submitted)
      const lcSubmitted = lcAttempts.length;
      const lcPassed = lcAttempts.filter((a:any) => a.passed === true).length;
      const lcParticipants = new Set(lcAttempts.map((a:any) => a.user_id as string).filter(Boolean)).size;
      const lcScores = lcAttempts.filter((a:any) => a.score != null).map((a:any) => a.score as number);
      const lcAvgScore = lcScores.length ? Math.round(lcScores.reduce((a:number,b:number)=>a+b,0)/lcScores.length) : 0;

      setKpi({
        tickets:{ total:tickets.length,open,solved,waitingApproval,byHandler,byStatus,byDivision,byProduct,resolvedToday,avgResolutionDays,monthlyTickets },
        reminders:{ total:reminders.length,pending:reminders.filter((r:any)=>r.status==='pending').length,done:reminders.filter((r:any)=>r.status==='done').length,dueSoon,byCategory,byProduct:remindersByProduct,overdueCount },
        piket:{ todayIVP:piketToday?.pic_ivp_name??null,todayUMP:piketToday?.pic_ump_name??null,todayMvi:piketToday?.pic_mvi_name??null,weekFilled,weekTotal:weekWorkDays,kegiatanToday:kegiatan.length },
        units:{ totalLogs:movements.length,keluarThisMonth:movements.filter((m:any)=>m.status_barang==='Keluar').length,masukThisMonth:movements.filter((m:any)=>m.status_barang==='Masuk').length },
        users:{ total:users.length,byRole:Object.entries(roleMap).map(([role,count])=>({role,count})) },
        learning:{ totalSessions:lcSubmitted, completedSessions:lcPassed, totalParticipants:lcParticipants, avgScore:lcAvgScore },
      });
    } catch(e){ console.error('KPI fetch error:',e); }
    finally { setLoading(false); }
  }, [scope, scopeReady, currentUser]);
  return { fetchKPI };
}
