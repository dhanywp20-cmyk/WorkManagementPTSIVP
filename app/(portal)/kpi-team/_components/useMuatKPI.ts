'use client';

import React, { useCallback } from 'react';
import { CATEGORY_COLORS, PiketPic, STATUS_COLORS, computeCascadedPiketToday, getMonday, monthStart, todayStr } from './DashboardKPI-bantu';
import { lingkupSaya, namaKelompokPTS } from '@/lib/kelompok/inti';
import { supabase } from '@/lib/supabase';
import type { PenggunaPortal as User } from '@/lib/tipe-pengguna';
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

      let namaDikecualikan: string[] = [];
      if (scope.kind === 'admin') {
        const kelompokDikecualikan = namaKelompokPTS().filter(t => !lingkupSaya(currentUser?.id).includes(t));
        if (kelompokDikecualikan.length > 0) {
          const { data: anggotaDikecualikan } = await supabase.from('users')
            .select('full_name').in('team_type', kelompokDikecualikan);
          namaDikecualikan = (anggotaDikecualikan ?? []).map((u) => u.full_name as string).filter(Boolean);
        }
      }

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

      const [ticketsRes, actLogsRes, remindersRes, piketHolidaysRes, piketWeekRes, kegiatanRes, movRes, usersRes, lcSessionsRes] =
        await Promise.all([
          scopeTickets(supabase.from('tickets').select('id,project_name,status,assign_name,sales_division,date,created_at,product')),
          supabase.from('activity_logs').select('id,ticket_id,new_status,created_at,handler_name').order('created_at',{ascending:false}).limit(500),
          scopeReminders(supabase.from('reminders').select('id,project_name,assign_name,status,category,due_date,due_time,product')),
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

      const tickets   = (ticketsRes.data   ?? []);
      const reminders = (remindersRes.data ?? []);
      let movements = (movRes.data       ?? []);
      const actLogs       = (actLogsRes.data     ?? []);
      const piketHolidays = (piketHolidaysRes.data ?? []).map((h) => h.date as string);
      const piketWeek     = (piketWeekRes.data   ?? []) as (PiketPic & { day_date: string; id: string })[];
      const piketToday    = computeCascadedPiketToday(piketWeek, piketHolidays, today);
      const kegiatan   = (kegiatanRes.data   ?? []);
      const users      = (usersRes.data      ?? []);
      const lcAttempts = (lcSessionsRes.data ?? []);

      if (scope.kind === 'pts_sup') {
        movements = movements.filter((m: any) => scope.ptsMemberNames?.includes(m.nama_pts));
      }

      const open           = tickets.filter((t: any)=>!['Solved','Cancelled'].includes(t.status)).length;
      const solved         = tickets.filter((t: any)=>t.status==='Solved').length;
      const waitingApproval= tickets.filter((t: any)=>t.status==='Waiting Approval').length;

      const scopedTicketIds = new Set(tickets.map((t: any)=>t.id as string));
      const resolvedToday = actLogs.filter((a)=>
        a.new_status==='Solved' && a.created_at?.startsWith(today) && scopedTicketIds.has(a.ticket_id)
      ).length;

      const handlerMap: Record<string,number> = {};
      tickets.filter((t: any)=>t.assign_name && !['Solved','Cancelled'].includes(t.status))
        .forEach((t: any)=>{ handlerMap[t.assign_name]=(handlerMap[t.assign_name]||0)+1; });
      const byHandler = Object.entries(handlerMap).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count);

      const statusMap: Record<string,number> = {};
      tickets.forEach((t: any)=>{ statusMap[t.status]=(statusMap[t.status]||0)+1; });
      const byStatus = Object.entries(statusMap).map(([status,count])=>({ status,count,color:STATUS_COLORS[status]??'#94a3b8' })).sort((a,b)=>b.count-a.count);

      const divMap: Record<string,number> = {};
      tickets.forEach((t: any)=>{ if(t.sales_division) divMap[t.sales_division]=(divMap[t.sales_division]||0)+1; });
      const byDivision = Object.entries(divMap).map(([div,count])=>({div,count})).sort((a,b)=>b.count-a.count);
      const productTicketMap: Record<string,number> = {};
      tickets.forEach((t: any)=>{ if(t.product) productTicketMap[t.product]=(productTicketMap[t.product]||0)+1; });
      const byProduct = Object.entries(productTicketMap).map(([product,count])=>({product,count})).sort((a,b)=>b.count-a.count);

      const solvedT = tickets.filter((t: any)=>t.status==='Solved'&&t.date&&t.created_at);
      const totalDays = solvedT.reduce((acc:number,t: any)=>{
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
      reminders.forEach((r: any)=>{ catMap[r.category]=(catMap[r.category]||0)+1; });
      const byCategory = Object.entries(catMap).map(([cat,count])=>({ cat,count,color:CATEGORY_COLORS[cat]??'#94a3b8' })).sort((a,b)=>b.count-a.count);
      const dueSoon     = reminders.filter((r: any)=>r.status==='pending'&&r.due_date>=today&&r.due_date<=oneWeekStr).length;
      const overdueCount= reminders.filter((r: any)=>r.status==='pending'&&r.due_date<today).length;
      const reminderProdMap: Record<string, Record<string,number>> = {};
      reminders.forEach((r: any)=>{ 
        if(r.product) {
          if(!reminderProdMap[r.product]) reminderProdMap[r.product]={};
          reminderProdMap[r.product][r.category||'Lainnya']=(reminderProdMap[r.product][r.category||'Lainnya']||0)+1;
        }
      });
      const remindersByProduct = Object.entries(reminderProdMap).map(([product,catMap])=>({
        product,
        byCategory: Object.entries(catMap).map(([cat,count])=>({cat,count})).sort((a,b)=>b.count-a.count),
      })).sort((a,b)=>b.byCategory.reduce((s,c)=>s+c.count,0)-a.byCategory.reduce((s,c)=>s+c.count,0));

      const weekFilled = piketWeek.filter((p)=>p.pic_ivp_name||p.pic_ump_name||p.pic_mvi_name).length;
      const weekWorkDays = 5;

      const roleMap: Record<string,number> = {};
      users.forEach((u)=>{ const r = typeof u.role === 'string' && u.role.trim() ? u.role.trim() : 'belum diatur'; roleMap[r]=(roleMap[r]||0)+1; });

      const lcSubmitted = lcAttempts.length;
      const lcPassed = lcAttempts.filter((a: any) => a.passed === true).length;
      const lcParticipants = new Set(lcAttempts.map((a: any) => a.user_id as string).filter(Boolean)).size;
      const lcScores = lcAttempts.filter((a: any) => a.score != null).map((a: any) => a.score as number);
      const lcAvgScore = lcScores.length ? Math.round(lcScores.reduce((a:number,b:number)=>a+b,0)/lcScores.length) : 0;

      const tglLokal = (iso: string) => {
        const d = new Date(iso);
        return isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };

      const kiniLokal = tglLokal(new Date().toISOString());
      const jadwalAktif = reminders.filter((r: any)=>r.status!=='cancelled' && r.due_date>=kiniLokal && (r.due_date===kiniLokal || r.status!=='done'));
      const tglDekat = jadwalAktif.reduce((m:string,r: any)=>(!m||r.due_date<m?r.due_date:m),'');
      const jadwalTgl = jadwalAktif.filter((r: any)=>r.due_date===tglDekat).sort((a: any,b: any)=>String(a.due_time??'').localeCompare(String(b.due_time??'')));
      const jadwalDekat = !tglDekat ? null : {
        hariIni: tglDekat===kiniLokal,
        label: new Date(`${tglDekat}T00:00:00`).toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'short'}),
        total: jadwalTgl.length,
        selesai: jadwalTgl.filter((r: any)=>r.status==='done').length,
        daftar: jadwalTgl.slice(0,6).map((r: any)=>({ id:r.id as string, proyek:(r.project_name as string)||'—', kategori:(r.category as string)||'—', pic:(r.assign_name as string)||'Belum di-assign', jam:String(r.due_time??'').slice(0,5), selesai:r.status==='done' })),
      };
      const bebanHari = Array.from({length:5},(_,i)=>{
        const d = new Date(); d.setDate(d.getDate()+i+1);
        const kunci = tglLokal(d.toISOString());
        return { kunci, label:d.toLocaleDateString('id-ID',{weekday:'short'}), jumlah:reminders.filter((r: any)=>r.due_date===kunci&&!['cancelled','done'].includes(r.status)).length };
      });
      const tiketTua = tickets.filter((t: any)=>!['Solved','Cancelled'].includes(t.status)&&t.created_at)
        .sort((a: any,b: any)=>String(a.created_at).localeCompare(String(b.created_at))).slice(0,4)
        .map((t: any)=>({ id:t.id as string, proyek:(t.project_name as string)||'—', handler:(t.assign_name as string)||'Belum di-assign', status:t.status as string, hari:Math.max(0,Math.floor((Date.now()-new Date(t.created_at).getTime())/86400000)) }));

      setKpi({
        jadwalDekat,
        bebanHari,
        tiketTua,
        deret:{
          tiket:tickets.map((t: any)=>({ t:tglLokal(t.created_at), s:t.status as string })),
          jadwal:reminders.map((r: any)=>({ t:r.due_date as string, s:r.status as string })),
        },
        tickets:{ total:tickets.length,open,solved,waitingApproval,byHandler,byStatus,byDivision,byProduct,resolvedToday,avgResolutionDays,monthlyTickets },
        reminders:{ total:reminders.length,pending:reminders.filter((r: any)=>r.status==='pending').length,done:reminders.filter((r: any)=>r.status==='done').length,dueSoon,byCategory,byProduct:remindersByProduct,overdueCount },
        piket:{ todayIVP:piketToday?.pic_ivp_name??null,todayUMP:piketToday?.pic_ump_name??null,todayMvi:piketToday?.pic_mvi_name??null,weekFilled,weekTotal:weekWorkDays,kegiatanToday:kegiatan.length },
        units:{ totalLogs:movements.length,keluarThisMonth:movements.filter((m)=>m.status_barang==='Keluar').length,masukThisMonth:movements.filter((m)=>m.status_barang==='Masuk').length },
        users:{ total:users.length,byRole:Object.entries(roleMap).map(([role,count])=>({role,count})) },
        learning:{ totalSessions:lcSubmitted, completedSessions:lcPassed, totalParticipants:lcParticipants, avgScore:lcAvgScore },
      });
    } catch(e){ console.error('KPI fetch error:',e); }
    finally { setLoading(false); }
  }, [scope, scopeReady, currentUser]);
  return { fetchKPI };
}
