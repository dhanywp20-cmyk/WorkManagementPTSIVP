create policy ltl_tambah on public.late_ticket_links for insert to anon, authenticated
  with check (akses_insentif_input());

create policy ltl_hapus on public.late_ticket_links for delete to anon, authenticated
  using (akses_insentif_input());

create unique index if not exists late_ticket_links_tiket_unik
  on public.late_ticket_links (late_ticket_id) where late_ticket_id is not null;
