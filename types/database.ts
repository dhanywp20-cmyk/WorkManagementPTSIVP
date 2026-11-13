export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action_taken: string | null
          assigned_to_services: boolean | null
          created_at: string | null
          file_name: string | null
          file_url: string | null
          handler_name: string
          handler_username: string | null
          id: string
          new_status: string | null
          notes: string
          photo_name: string | null
          photo_url: string | null
          team_type: string | null
          ticket_id: string | null
        }
        Insert: {
          action_taken?: string | null
          assigned_to_services?: boolean | null
          created_at?: string | null
          file_name?: string | null
          file_url?: string | null
          handler_name: string
          handler_username?: string | null
          id?: string
          new_status?: string | null
          notes: string
          photo_name?: string | null
          photo_url?: string | null
          team_type?: string | null
          ticket_id?: string | null
        }
        Update: {
          action_taken?: string | null
          assigned_to_services?: boolean | null
          created_at?: string | null
          file_name?: string | null
          file_url?: string | null
          handler_name?: string
          handler_username?: string | null
          id?: string
          new_status?: string | null
          notes?: string
          photo_name?: string | null
          photo_url?: string | null
          team_type?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "notification_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "stuck_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_pakai_log: {
        Row: {
          created_at: string
          fitur: string
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          fitur: string
          id?: number
          user_id: string
        }
        Update: {
          created_at?: string
          fitur?: string
          id?: number
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_trail: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          module: string
          new_value: string | null
          notes: string | null
          old_value: string | null
          target_id: string | null
          target_name: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          module: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          target_id?: string | null
          target_name?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          module?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          target_id?: string | null
          target_name?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      brand_pic_mappings: {
        Row: {
          brand_name: string
          brand_type: string
          created_at: string | null
          id: string
          pic_user_id: string | null
          pic_user_name: string | null
        }
        Insert: {
          brand_name: string
          brand_type: string
          created_at?: string | null
          id?: string
          pic_user_id?: string | null
          pic_user_name?: string | null
        }
        Update: {
          brand_name?: string
          brand_type?: string
          created_at?: string | null
          id?: string
          pic_user_id?: string | null
          pic_user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_pic_mappings_pic_user_id_fkey"
            columns: ["pic_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_anggota: {
        Row: {
          created_at: string
          daftar_id: string
          nama: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daftar_id: string
          nama: string
          user_id: string
        }
        Update: {
          created_at?: string
          daftar_id?: string
          nama?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_anggota_daftar_id_fkey"
            columns: ["daftar_id"]
            isOneToOne: false
            referencedRelation: "checklist_daftar"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_bagian: {
        Row: {
          catatan: string
          daftar_id: string
          id: string
          judul: string
          urutan: number
        }
        Insert: {
          catatan?: string
          daftar_id: string
          id?: string
          judul: string
          urutan?: number
        }
        Update: {
          catatan?: string
          daftar_id?: string
          id?: string
          judul?: string
          urutan?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_bagian_daftar_id_fkey"
            columns: ["daftar_id"]
            isOneToOne: false
            referencedRelation: "checklist_daftar"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_daftar: {
        Row: {
          created_at: string
          dibuat_oleh: string | null
          dibuat_oleh_nama: string | null
          id: string
          judul: string
          keterangan: string
          legacy_location_id: string | null
          origin: string
          proyek_id: string
          share_aktif: boolean
          share_token: string | null
          source_reminder_id: string | null
          start_date: string | null
          sumber: string
          support_lokasi: string
          target_date: string | null
          updated_at: string
          urutan: number
        }
        Insert: {
          created_at?: string
          dibuat_oleh?: string | null
          dibuat_oleh_nama?: string | null
          id?: string
          judul: string
          keterangan?: string
          legacy_location_id?: string | null
          origin?: string
          proyek_id: string
          share_aktif?: boolean
          share_token?: string | null
          source_reminder_id?: string | null
          start_date?: string | null
          sumber?: string
          support_lokasi?: string
          target_date?: string | null
          updated_at?: string
          urutan?: number
        }
        Update: {
          created_at?: string
          dibuat_oleh?: string | null
          dibuat_oleh_nama?: string | null
          id?: string
          judul?: string
          keterangan?: string
          legacy_location_id?: string | null
          origin?: string
          proyek_id?: string
          share_aktif?: boolean
          share_token?: string | null
          source_reminder_id?: string | null
          start_date?: string | null
          sumber?: string
          support_lokasi?: string
          target_date?: string | null
          updated_at?: string
          urutan?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_daftar_proyek_id_fkey"
            columns: ["proyek_id"]
            isOneToOne: false
            referencedRelation: "checklist_proyek"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_item: {
        Row: {
          bagian_id: string
          catatan: string
          daftar_id: string
          foto_thumb_url: string | null
          foto_url: string | null
          id: string
          kelompok: string
          kendala: boolean
          kendala_catatan: string
          kendala_oleh: string | null
          kendala_pada: string | null
          legacy_component_id: string | null
          selesai: boolean
          selesai_lewat: string | null
          selesai_oleh: string | null
          selesai_pada: string | null
          teks: string
          urutan: number
        }
        Insert: {
          bagian_id: string
          catatan?: string
          daftar_id: string
          foto_thumb_url?: string | null
          foto_url?: string | null
          id?: string
          kelompok?: string
          kendala?: boolean
          kendala_catatan?: string
          kendala_oleh?: string | null
          kendala_pada?: string | null
          legacy_component_id?: string | null
          selesai?: boolean
          selesai_lewat?: string | null
          selesai_oleh?: string | null
          selesai_pada?: string | null
          teks: string
          urutan?: number
        }
        Update: {
          bagian_id?: string
          catatan?: string
          daftar_id?: string
          foto_thumb_url?: string | null
          foto_url?: string | null
          id?: string
          kelompok?: string
          kendala?: boolean
          kendala_catatan?: string
          kendala_oleh?: string | null
          kendala_pada?: string | null
          legacy_component_id?: string | null
          selesai?: boolean
          selesai_lewat?: string | null
          selesai_oleh?: string | null
          selesai_pada?: string | null
          teks?: string
          urutan?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_item_bagian_id_fkey"
            columns: ["bagian_id"]
            isOneToOne: false
            referencedRelation: "checklist_bagian"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_item_daftar_id_fkey"
            columns: ["daftar_id"]
            isOneToOne: false
            referencedRelation: "checklist_daftar"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_proyek: {
        Row: {
          client: string | null
          created_at: string
          deskripsi: string
          dibuat_oleh: string | null
          dibuat_oleh_nama: string | null
          id: string
          legacy_project_id: string | null
          nama: string
          origin: string
          sales_division: string | null
          sales_name: string | null
          share_aktif: boolean
          share_token: string | null
          source_reminder_id: string | null
          start_date: string | null
          status: string
          target_date: string | null
          updated_at: string
        }
        Insert: {
          client?: string | null
          created_at?: string
          deskripsi?: string
          dibuat_oleh?: string | null
          dibuat_oleh_nama?: string | null
          id?: string
          legacy_project_id?: string | null
          nama: string
          origin?: string
          sales_division?: string | null
          sales_name?: string | null
          share_aktif?: boolean
          share_token?: string | null
          source_reminder_id?: string | null
          start_date?: string | null
          status?: string
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          client?: string | null
          created_at?: string
          deskripsi?: string
          dibuat_oleh?: string | null
          dibuat_oleh_nama?: string | null
          id?: string
          legacy_project_id?: string | null
          nama?: string
          origin?: string
          sales_division?: string | null
          sales_name?: string | null
          share_aktif?: boolean
          share_token?: string | null
          source_reminder_id?: string | null
          start_date?: string | null
          status?: string
          target_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      checklist_riwayat: {
        Row: {
          aksi: string
          created_at: string
          daftar_id: string
          id: number
          item_id: string | null
          lewat: string
          nama: string
          teks_item: string
        }
        Insert: {
          aksi: string
          created_at?: string
          daftar_id: string
          id?: number
          item_id?: string | null
          lewat: string
          nama: string
          teks_item?: string
        }
        Update: {
          aksi?: string
          created_at?: string
          daftar_id?: string
          id?: number
          item_id?: string | null
          lewat?: string
          nama?: string
          teks_item?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_riwayat_daftar_id_fkey"
            columns: ["daftar_id"]
            isOneToOne: false
            referencedRelation: "checklist_daftar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_riwayat_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_item"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_report_team_entries: {
        Row: {
          address: string | null
          category: string
          created_at: string
          entered_by: string
          id: string
          member_name: string
          member_user_id: string | null
          project_name: string
          report_date: string
          sales_division: string | null
          sales_name: string | null
          source: string
          supervisor_notes: string | null
        }
        Insert: {
          address?: string | null
          category: string
          created_at?: string
          entered_by: string
          id?: string
          member_name: string
          member_user_id?: string | null
          project_name: string
          report_date: string
          sales_division?: string | null
          sales_name?: string | null
          source?: string
          supervisor_notes?: string | null
        }
        Update: {
          address?: string | null
          category?: string
          created_at?: string
          entered_by?: string
          id?: string
          member_name?: string
          member_user_id?: string | null
          project_name?: string
          report_date?: string
          sales_division?: string | null
          sales_name?: string | null
          source?: string
          supervisor_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_report_team_entries_member_user_id_fkey"
            columns: ["member_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reports: {
        Row: {
          created_at: string
          created_by: string
          id: string
          manual_activities: Json
          reminder_activities: Json
          reminder_notes: string | null
          report_date: string
          sales_division: string | null
          ticket_activities: Json
          updated_at: string | null
          user_id: string | null
          user_name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          manual_activities?: Json
          reminder_activities?: Json
          reminder_notes?: string | null
          report_date: string
          sales_division?: string | null
          ticket_activities?: Json
          updated_at?: string | null
          user_id?: string | null
          user_name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          manual_activities?: Json
          reminder_activities?: Json
          reminder_notes?: string | null
          report_date?: string
          sales_division?: string | null
          ticket_activities?: Json
          updated_at?: string | null
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      division_ivp_mappings: {
        Row: {
          brand_type: string | null
          created_at: string | null
          id: string
          ivp_id: string
          sales_division: string
        }
        Insert: {
          brand_type?: string | null
          created_at?: string | null
          id?: string
          ivp_id: string
          sales_division: string
        }
        Update: {
          brand_type?: string | null
          created_at?: string | null
          id?: string
          ivp_id?: string
          sales_division?: string
        }
        Relationships: [
          {
            foreignKeyName: "division_ivp_mappings_ivp_id_fkey"
            columns: ["ivp_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      division_supervisor_mappings: {
        Row: {
          created_at: string | null
          id: string
          sales_division: string
          supervisor_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          sales_division: string
          supervisor_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          sales_division?: string
          supervisor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "division_supervisor_mappings_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      fcm_tokens: {
        Row: {
          diperbarui_pada: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          diperbarui_pada?: string
          platform?: string
          token: string
          user_id: string
        }
        Update: {
          diperbarui_pada?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      form_reviews: {
        Row: {
          address: string | null
          assign_name: string | null
          assigned_to: string | null
          batch_id: string | null
          catatan_grade_product_knowledge: string | null
          catatan_grade_product_knowledge_bast: string | null
          catatan_grade_training_customer: string | null
          created_at: string | null
          foto_dokumentasi_url: string | null
          grade_product_knowledge: number | null
          grade_product_knowledge_bast: number | null
          grade_training_customer: number | null
          guest_fullname: string
          guest_user_id: string | null
          guest_username: string | null
          id: string
          product_bast: string | null
          product_demo: string | null
          project_name: string | null
          reminder_category: string | null
          reminder_id: string
          review_category: string | null
          sales_division: string | null
          sales_name: string | null
          sales_user_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          assign_name?: string | null
          assigned_to?: string | null
          batch_id?: string | null
          catatan_grade_product_knowledge?: string | null
          catatan_grade_product_knowledge_bast?: string | null
          catatan_grade_training_customer?: string | null
          created_at?: string | null
          foto_dokumentasi_url?: string | null
          grade_product_knowledge?: number | null
          grade_product_knowledge_bast?: number | null
          grade_training_customer?: number | null
          guest_fullname: string
          guest_user_id?: string | null
          guest_username?: string | null
          id?: string
          product_bast?: string | null
          product_demo?: string | null
          project_name?: string | null
          reminder_category?: string | null
          reminder_id: string
          review_category?: string | null
          sales_division?: string | null
          sales_name?: string | null
          sales_user_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          assign_name?: string | null
          assigned_to?: string | null
          batch_id?: string | null
          catatan_grade_product_knowledge?: string | null
          catatan_grade_product_knowledge_bast?: string | null
          catatan_grade_training_customer?: string | null
          created_at?: string | null
          foto_dokumentasi_url?: string | null
          grade_product_knowledge?: number | null
          grade_product_knowledge_bast?: number | null
          grade_training_customer?: number | null
          guest_fullname?: string
          guest_user_id?: string | null
          guest_username?: string | null
          id?: string
          product_bast?: string | null
          product_demo?: string | null
          project_name?: string | null
          reminder_category?: string | null
          reminder_id?: string
          review_category?: string | null
          sales_division?: string | null
          sales_name?: string | null
          sales_user_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      galat_klien: {
        Row: {
          contoh_ua: string | null
          digest: string | null
          hari: string
          jalur: string | null
          jumlah: number
          pertama: string
          pesan: string
          sidik: string
          sumber: string | null
          terakhir: string
          user_id: string | null
        }
        Insert: {
          contoh_ua?: string | null
          digest?: string | null
          hari?: string
          jalur?: string | null
          jumlah?: number
          pertama?: string
          pesan: string
          sidik: string
          sumber?: string | null
          terakhir?: string
          user_id?: string | null
        }
        Update: {
          contoh_ua?: string | null
          digest?: string | null
          hari?: string
          jalur?: string | null
          jumlah?: number
          pertama?: string
          pesan?: string
          sidik?: string
          sumber?: string | null
          terakhir?: string
          user_id?: string | null
        }
        Relationships: []
      }
      identitas_calon: {
        Row: {
          cara: string | null
          jumlah_baris: number | null
          kolom: string | null
          nama_akun: string | null
          nilai: string | null
          tabel: string | null
          user_id: string | null
        }
        Insert: {
          cara?: string | null
          jumlah_baris?: number | null
          kolom?: string | null
          nama_akun?: string | null
          nilai?: string | null
          tabel?: string | null
          user_id?: string | null
        }
        Update: {
          cara?: string | null
          jumlah_baris?: number | null
          kolom?: string | null
          nama_akun?: string | null
          nilai?: string | null
          tabel?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      identitas_sisa: {
        Row: {
          jumlah_baris: number | null
          kolom: string | null
          nilai: string | null
          tabel: string | null
        }
        Insert: {
          jumlah_baris?: number | null
          kolom?: string | null
          nilai?: string | null
          tabel?: string | null
        }
        Update: {
          jumlah_baris?: number | null
          kolom?: string | null
          nilai?: string | null
          tabel?: string | null
        }
        Relationships: []
      }
      identitas_usulan: {
        Row: {
          cara: string | null
          jumlah_baris: number | null
          kolom: string
          nama_akun: string | null
          nilai: string
          tabel: string
          user_id: string
        }
        Insert: {
          cara?: string | null
          jumlah_baris?: number | null
          kolom: string
          nama_akun?: string | null
          nilai: string
          tabel: string
          user_id: string
        }
        Update: {
          cara?: string | null
          jumlah_baris?: number | null
          kolom?: string
          nama_akun?: string | null
          nilai?: string
          tabel?: string
          user_id?: string
        }
        Relationships: []
      }
      incentive_disbursements: {
        Row: {
          amount_rp: number | null
          created_at: string | null
          id: string
          member_status: string | null
          payment_year_1_paid: boolean | null
          payment_year_2_paid: boolean | null
          payment_year_3_paid: boolean | null
          pct: number | null
          periode: string | null
          person_name: string
          person_username: string | null
          project_id: string | null
          redistributed_to: Json | null
          resigned_at: string | null
          role_type: string
        }
        Insert: {
          amount_rp?: number | null
          created_at?: string | null
          id?: string
          member_status?: string | null
          payment_year_1_paid?: boolean | null
          payment_year_2_paid?: boolean | null
          payment_year_3_paid?: boolean | null
          pct?: number | null
          periode?: string | null
          person_name: string
          person_username?: string | null
          project_id?: string | null
          redistributed_to?: Json | null
          resigned_at?: string | null
          role_type: string
        }
        Update: {
          amount_rp?: number | null
          created_at?: string | null
          id?: string
          member_status?: string | null
          payment_year_1_paid?: boolean | null
          payment_year_2_paid?: boolean | null
          payment_year_3_paid?: boolean | null
          pct?: number | null
          periode?: string | null
          person_name?: string
          person_username?: string | null
          project_id?: string | null
          redistributed_to?: Json | null
          resigned_at?: string | null
          role_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "incentive_disbursements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "incentive_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      incentive_nominal: {
        Row: {
          diubah_oleh: string | null
          diubah_pada: string
          nominal: number
          reminder_id: string
        }
        Insert: {
          diubah_oleh?: string | null
          diubah_pada?: string
          nominal?: number
          reminder_id: string
        }
        Update: {
          diubah_oleh?: string | null
          diubah_pada?: string
          nominal?: number
          reminder_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incentive_nominal_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: true
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      incentive_penetapan: {
        Row: {
          cakupan: Json
          cue: Json
          diubah_pada: string
          diusulkan_oleh: string | null
          diusulkan_pada: string | null
          divalidasi_oleh: string | null
          divalidasi_pada: string | null
          level: string
          level_status: string
          net_profit: number | null
          net_profit_oleh: string | null
          net_profit_pada: string | null
          nominal: number | null
          nominal_dasar: string | null
          reminder_id: string
        }
        Insert: {
          cakupan?: Json
          cue?: Json
          diubah_pada?: string
          diusulkan_oleh?: string | null
          diusulkan_pada?: string | null
          divalidasi_oleh?: string | null
          divalidasi_pada?: string | null
          level: string
          level_status?: string
          net_profit?: number | null
          net_profit_oleh?: string | null
          net_profit_pada?: string | null
          nominal?: number | null
          nominal_dasar?: string | null
          reminder_id: string
        }
        Update: {
          cakupan?: Json
          cue?: Json
          diubah_pada?: string
          diusulkan_oleh?: string | null
          diusulkan_pada?: string | null
          divalidasi_oleh?: string | null
          divalidasi_pada?: string | null
          level?: string
          level_status?: string
          net_profit?: number | null
          net_profit_oleh?: string | null
          net_profit_pada?: string | null
          nominal?: number | null
          nominal_dasar?: string | null
          reminder_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incentive_penetapan_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: true
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      incentive_penetapan_log: {
        Row: {
          aksi: string
          alasan: string | null
          dari: Json | null
          id: string
          ke: Json | null
          oleh: string
          pada: string
          reminder_id: string
        }
        Insert: {
          aksi: string
          alasan?: string | null
          dari?: Json | null
          id?: string
          ke?: Json | null
          oleh: string
          pada?: string
          reminder_id: string
        }
        Update: {
          aksi?: string
          alasan?: string | null
          dari?: Json | null
          id?: string
          ke?: Json | null
          oleh?: string
          pada?: string
          reminder_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incentive_penetapan_log_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      incentive_projects: {
        Row: {
          address: string | null
          atasan_name: string | null
          backup_names: string[] | null
          biaya_cadangan: number | null
          biaya_input_at: string | null
          biaya_input_by: string | null
          category: string
          cos_project_no: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          handler_name: string
          handler_username: string | null
          id: string
          installer_daerah: string | null
          installer_incentive_nominal: number | null
          installer_incentive_pct: number | null
          installer_name: string | null
          installer_paid: boolean | null
          mode_penyelesaian: string | null
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          periode: string | null
          pic_name: string | null
          pic_phone: string | null
          product: string | null
          project_name: string
          reminder_id: string | null
          sales_division: string | null
          sales_name: string | null
          status: string | null
          supervisor_name: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          atasan_name?: string | null
          backup_names?: string[] | null
          biaya_cadangan?: number | null
          biaya_input_at?: string | null
          biaya_input_by?: string | null
          category: string
          cos_project_no?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          handler_name: string
          handler_username?: string | null
          id?: string
          installer_daerah?: string | null
          installer_incentive_nominal?: number | null
          installer_incentive_pct?: number | null
          installer_name?: string | null
          installer_paid?: boolean | null
          mode_penyelesaian?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          periode?: string | null
          pic_name?: string | null
          pic_phone?: string | null
          product?: string | null
          project_name: string
          reminder_id?: string | null
          sales_division?: string | null
          sales_name?: string | null
          status?: string | null
          supervisor_name?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          atasan_name?: string | null
          backup_names?: string[] | null
          biaya_cadangan?: number | null
          biaya_input_at?: string | null
          biaya_input_by?: string | null
          category?: string
          cos_project_no?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          handler_name?: string
          handler_username?: string | null
          id?: string
          installer_daerah?: string | null
          installer_incentive_nominal?: number | null
          installer_incentive_pct?: number | null
          installer_name?: string | null
          installer_paid?: boolean | null
          mode_penyelesaian?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          periode?: string | null
          pic_name?: string | null
          pic_phone?: string | null
          product?: string | null
          project_name?: string
          reminder_id?: string | null
          sales_division?: string | null
          sales_name?: string | null
          status?: string | null
          supervisor_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incentive_projects_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      incentive_redistribusi: {
        Row: {
          dibuat_oleh: string | null
          dibuat_pada: string
          id: string
          nominal: number
          penerima: Json
          project_id: string
          sumber_nama: string
          sumber_user_id: string | null
          tahap: number | null
          tahun: number
          tranche_id: string | null
        }
        Insert: {
          dibuat_oleh?: string | null
          dibuat_pada?: string
          id?: string
          nominal: number
          penerima: Json
          project_id: string
          sumber_nama: string
          sumber_user_id?: string | null
          tahap?: number | null
          tahun: number
          tranche_id?: string | null
        }
        Update: {
          dibuat_oleh?: string | null
          dibuat_pada?: string
          id?: string
          nominal?: number
          penerima?: Json
          project_id?: string
          sumber_nama?: string
          sumber_user_id?: string | null
          tahap?: number | null
          tahun?: number
          tranche_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incentive_redistribusi_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incentive_redistribusi_tranche_id_fkey"
            columns: ["tranche_id"]
            isOneToOne: false
            referencedRelation: "incentive_tranches"
            referencedColumns: ["id"]
          },
        ]
      }
      incentive_scheme_settings: {
        Row: {
          id: string
          scheme: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          scheme: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          scheme?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      incentive_settings: {
        Row: {
          backup_pct: number
          handler_pct: number
          id: string
          pts_manager_username: string | null
          pts_supervisor_username: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          backup_pct?: number
          handler_pct?: number
          id?: string
          pts_manager_username?: string | null
          pts_supervisor_username?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          backup_pct?: number
          handler_pct?: number
          id?: string
          pts_manager_username?: string | null
          pts_supervisor_username?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      incentive_splits: {
        Row: {
          amount: number | null
          created_at: string | null
          id: string
          percentage: number
          project_id: string
          redistribusi_dari: string | null
          role: string
          source_ticket_id: string | null
          tranche_id: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          id?: string
          percentage: number
          project_id: string
          redistribusi_dari?: string | null
          role: string
          source_ticket_id?: string | null
          tranche_id?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          id?: string
          percentage?: number
          project_id?: string
          redistribusi_dari?: string | null
          role?: string
          source_ticket_id?: string | null
          tranche_id?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incentive_splits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incentive_splits_tranche_id_fkey"
            columns: ["tranche_id"]
            isOneToOne: false
            referencedRelation: "incentive_tranches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incentive_splits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      incentive_tranches: {
        Row: {
          created_at: string | null
          id: string
          paid_at: string | null
          payment_year: number
          percentage: number
          processed_at: string | null
          project_id: string
          scheme_label: string | null
          scheme_snapshot: Json | null
          scheme_snapshot_pra_rev3: Json | null
          status: string | null
          tranche_number: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          paid_at?: string | null
          payment_year: number
          percentage: number
          processed_at?: string | null
          project_id: string
          scheme_label?: string | null
          scheme_snapshot?: Json | null
          scheme_snapshot_pra_rev3?: Json | null
          status?: string | null
          tranche_number: number
        }
        Update: {
          created_at?: string | null
          id?: string
          paid_at?: string | null
          payment_year?: number
          percentage?: number
          processed_at?: string | null
          project_id?: string
          scheme_label?: string | null
          scheme_snapshot?: Json | null
          scheme_snapshot_pra_rev3?: Json | null
          status?: string | null
          tranche_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "incentive_tranches_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_global_settings: {
        Row: {
          id: number
          settings: Json
          updated_at: string | null
        }
        Insert: {
          id?: number
          settings: Json
          updated_at?: string | null
        }
        Update: {
          id?: number
          settings?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      kpi_manual_values: {
        Row: {
          bast_demo: number | null
          bast_demo_total: number | null
          created_at: string | null
          id: string
          komplain_count: number | null
          learning_mastery: number | null
          report_bulanan: number | null
          respon_time: number | null
          updated_at: string | null
          updated_by: string | null
          user_id: string
          year: number
        }
        Insert: {
          bast_demo?: number | null
          bast_demo_total?: number | null
          created_at?: string | null
          id?: string
          komplain_count?: number | null
          learning_mastery?: number | null
          report_bulanan?: number | null
          respon_time?: number | null
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
          year: number
        }
        Update: {
          bast_demo?: number | null
          bast_demo_total?: number | null
          created_at?: string | null
          id?: string
          komplain_count?: number | null
          learning_mastery?: number | null
          report_bulanan?: number | null
          respon_time?: number | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_manual_values_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_period_snapshots: {
        Row: {
          created_at: string | null
          created_by: string | null
          end_month: number
          id: string
          members_json: Json
          period: string
          period_label: string
          settings_json: Json | null
          start_month: number
          team_type: string
          year: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          end_month: number
          id?: string
          members_json?: Json
          period: string
          period_label: string
          settings_json?: Json | null
          start_month: number
          team_type: string
          year: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          end_month?: number
          id?: string
          members_json?: Json
          period?: string
          period_label?: string
          settings_json?: Json | null
          start_month?: number
          team_type?: string
          year?: number
        }
        Relationships: []
      }
      kpi_snapshot_members: {
        Row: {
          bast_score: number | null
          final_kpi: number | null
          form_review_low: number | null
          form_review_total: number | null
          id: string
          jabatan: string | null
          lc_attempts: number | null
          lc_avg_score: number | null
          lc_passed: number | null
          lc_score: number | null
          member_id: string
          name: string
          rnd_score: number | null
          snapshot_id: string
          team_type: string | null
          tech_notes_approved: number | null
          tick_score: number | null
          tickets_handled: number | null
          tickets_overdue: number | null
          tickets_solved: number | null
        }
        Insert: {
          bast_score?: number | null
          final_kpi?: number | null
          form_review_low?: number | null
          form_review_total?: number | null
          id?: string
          jabatan?: string | null
          lc_attempts?: number | null
          lc_avg_score?: number | null
          lc_passed?: number | null
          lc_score?: number | null
          member_id: string
          name: string
          rnd_score?: number | null
          snapshot_id: string
          team_type?: string | null
          tech_notes_approved?: number | null
          tick_score?: number | null
          tickets_handled?: number | null
          tickets_overdue?: number | null
          tickets_solved?: number | null
        }
        Update: {
          bast_score?: number | null
          final_kpi?: number | null
          form_review_low?: number | null
          form_review_total?: number | null
          id?: string
          jabatan?: string | null
          lc_attempts?: number | null
          lc_avg_score?: number | null
          lc_passed?: number | null
          lc_score?: number | null
          member_id?: string
          name?: string
          rnd_score?: number | null
          snapshot_id?: string
          team_type?: string | null
          tech_notes_approved?: number | null
          tick_score?: number | null
          tickets_handled?: number | null
          tickets_overdue?: number | null
          tickets_solved?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_snapshot_members_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "kpi_period_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      late_ticket_links: {
        Row: {
          attached_at: string | null
          attached_tranche_number: number
          id: string
          is_sunset: boolean | null
          late_ticket_id: string | null
          note: string | null
          parent_project_id: string
          ticket_value: number | null
        }
        Insert: {
          attached_at?: string | null
          attached_tranche_number: number
          id?: string
          is_sunset?: boolean | null
          late_ticket_id?: string | null
          note?: string | null
          parent_project_id: string
          ticket_value?: number | null
        }
        Update: {
          attached_at?: string | null
          attached_tranche_number?: number
          id?: string
          is_sunset?: boolean | null
          late_ticket_id?: string | null
          note?: string | null
          parent_project_id?: string
          ticket_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "late_ticket_links_parent_project_id_fkey"
            columns: ["parent_project_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      lc_answers: {
        Row: {
          ai_feedback: string | null
          ai_score: number | null
          answer: string | null
          answer_image_url: string | null
          answer_thumb_url: string | null
          answered_at: string | null
          attempt_id: string | null
          essay_text: string | null
          id: string
          is_correct: boolean | null
          manual_score: number | null
          question_id: string | null
          quiz_session_id: string | null
          user_id: string | null
        }
        Insert: {
          ai_feedback?: string | null
          ai_score?: number | null
          answer?: string | null
          answer_image_url?: string | null
          answer_thumb_url?: string | null
          answered_at?: string | null
          attempt_id?: string | null
          essay_text?: string | null
          id?: string
          is_correct?: boolean | null
          manual_score?: number | null
          question_id?: string | null
          quiz_session_id?: string | null
          user_id?: string | null
        }
        Update: {
          ai_feedback?: string | null
          ai_score?: number | null
          answer?: string | null
          answer_image_url?: string | null
          answer_thumb_url?: string | null
          answered_at?: string | null
          attempt_id?: string | null
          essay_text?: string | null
          id?: string
          is_correct?: boolean | null
          manual_score?: number | null
          question_id?: string | null
          quiz_session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lc_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "lc_quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lc_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "lc_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lc_answers_quiz_session_id_fkey"
            columns: ["quiz_session_id"]
            isOneToOne: false
            referencedRelation: "lc_quiz_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lc_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lc_eks_hasil: {
        Row: {
          benar: number | null
          dikirim_otomatis: string | null
          durasi_detik: number | null
          id: string
          jawaban: Json
          jumlah: number | null
          kelas_id: string
          keluar_jendela: number
          lewat_waktu: boolean
          log_pelanggaran: Json
          lulus: boolean | null
          mulai_pada: string
          percobaan: number
          peserta_id: string
          pindah_tab: number
          salin_tempel: number
          selesai_pada: string | null
          skor: number | null
          urutan_soal: string[]
        }
        Insert: {
          benar?: number | null
          dikirim_otomatis?: string | null
          durasi_detik?: number | null
          id?: string
          jawaban?: Json
          jumlah?: number | null
          kelas_id: string
          keluar_jendela?: number
          lewat_waktu?: boolean
          log_pelanggaran?: Json
          lulus?: boolean | null
          mulai_pada?: string
          percobaan?: number
          peserta_id: string
          pindah_tab?: number
          salin_tempel?: number
          selesai_pada?: string | null
          skor?: number | null
          urutan_soal: string[]
        }
        Update: {
          benar?: number | null
          dikirim_otomatis?: string | null
          durasi_detik?: number | null
          id?: string
          jawaban?: Json
          jumlah?: number | null
          kelas_id?: string
          keluar_jendela?: number
          lewat_waktu?: boolean
          log_pelanggaran?: Json
          lulus?: boolean | null
          mulai_pada?: string
          percobaan?: number
          peserta_id?: string
          pindah_tab?: number
          salin_tempel?: number
          selesai_pada?: string | null
          skor?: number | null
          urutan_soal?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "lc_eks_hasil_kelas_id_fkey"
            columns: ["kelas_id"]
            isOneToOne: false
            referencedRelation: "lc_eks_kelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lc_eks_hasil_peserta_id_fkey"
            columns: ["peserta_id"]
            isOneToOne: false
            referencedRelation: "lc_eks_peserta"
            referencedColumns: ["id"]
          },
        ]
      }
      lc_eks_kelas: {
        Row: {
          acak_soal: boolean
          aktif: boolean
          batas_pelanggaran: number | null
          buka_pada: string | null
          created_at: string
          detik_per_soal: number
          dibuat_nama: string | null
          dibuat_oleh: string | null
          dimulai_pada: string | null
          id: string
          isian_peserta: string
          jenis: string
          judul: string
          keterangan: string
          latar_url: string | null
          live_indeks: number
          live_jeda_pada: string | null
          live_sesi: number
          live_soal_mulai: string | null
          live_soal_tutup: string | null
          live_tahap: string
          live_urutan: string[]
          logo_url: string | null
          maks_peserta: number
          mode_mulai: string
          passing_grade: number
          question_ids: string[]
          satu_kali: boolean
          tema_warna: string | null
          timer_menit: number | null
          token: string
          tutup_pada: string | null
          updated_at: string
        }
        Insert: {
          acak_soal?: boolean
          aktif?: boolean
          batas_pelanggaran?: number | null
          buka_pada?: string | null
          created_at?: string
          detik_per_soal?: number
          dibuat_nama?: string | null
          dibuat_oleh?: string | null
          dimulai_pada?: string | null
          id?: string
          isian_peserta?: string
          jenis?: string
          judul: string
          keterangan?: string
          latar_url?: string | null
          live_indeks?: number
          live_jeda_pada?: string | null
          live_sesi?: number
          live_soal_mulai?: string | null
          live_soal_tutup?: string | null
          live_tahap?: string
          live_urutan?: string[]
          logo_url?: string | null
          maks_peserta?: number
          mode_mulai?: string
          passing_grade?: number
          question_ids?: string[]
          satu_kali?: boolean
          tema_warna?: string | null
          timer_menit?: number | null
          token: string
          tutup_pada?: string | null
          updated_at?: string
        }
        Update: {
          acak_soal?: boolean
          aktif?: boolean
          batas_pelanggaran?: number | null
          buka_pada?: string | null
          created_at?: string
          detik_per_soal?: number
          dibuat_nama?: string | null
          dibuat_oleh?: string | null
          dimulai_pada?: string | null
          id?: string
          isian_peserta?: string
          jenis?: string
          judul?: string
          keterangan?: string
          latar_url?: string | null
          live_indeks?: number
          live_jeda_pada?: string | null
          live_sesi?: number
          live_soal_mulai?: string | null
          live_soal_tutup?: string | null
          live_tahap?: string
          live_urutan?: string[]
          logo_url?: string | null
          maks_peserta?: number
          mode_mulai?: string
          passing_grade?: number
          question_ids?: string[]
          satu_kali?: boolean
          tema_warna?: string | null
          timer_menit?: number | null
          token?: string
          tutup_pada?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lc_eks_live_jawaban: {
        Row: {
          benar: boolean
          created_at: string
          id: string
          indeks: number
          kelas_id: string
          peserta_id: string
          pilihan: string
          poin: number
          sesi: number
          soal_id: string
          waktu_ms: number
        }
        Insert: {
          benar: boolean
          created_at?: string
          id?: string
          indeks: number
          kelas_id: string
          peserta_id: string
          pilihan: string
          poin: number
          sesi: number
          soal_id: string
          waktu_ms: number
        }
        Update: {
          benar?: boolean
          created_at?: string
          id?: string
          indeks?: number
          kelas_id?: string
          peserta_id?: string
          pilihan?: string
          poin?: number
          sesi?: number
          soal_id?: string
          waktu_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "lc_eks_live_jawaban_kelas_id_fkey"
            columns: ["kelas_id"]
            isOneToOne: false
            referencedRelation: "lc_eks_kelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lc_eks_live_jawaban_peserta_id_fkey"
            columns: ["peserta_id"]
            isOneToOne: false
            referencedRelation: "lc_eks_peserta"
            referencedColumns: ["id"]
          },
        ]
      }
      lc_eks_peserta: {
        Row: {
          created_at: string
          id: string
          instansi: string | null
          izin_kontak: boolean
          kelas_id: string
          kontak: string | null
          nama: string
          nama_norm: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          id?: string
          instansi?: string | null
          izin_kontak?: boolean
          kelas_id: string
          kontak?: string | null
          nama: string
          nama_norm: string
          token_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          instansi?: string | null
          izin_kontak?: boolean
          kelas_id?: string
          kontak?: string | null
          nama?: string
          nama_norm?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "lc_eks_peserta_kelas_id_fkey"
            columns: ["kelas_id"]
            isOneToOne: false
            referencedRelation: "lc_eks_kelas"
            referencedColumns: ["id"]
          },
        ]
      }
      lc_materials: {
        Row: {
          content_text: string | null
          created_at: string | null
          created_by: string | null
          file_name: string | null
          file_type: string | null
          file_url: string | null
          folder_path: string | null
          id: string
          materi_name: string
          updated_at: string | null
        }
        Insert: {
          content_text?: string | null
          created_at?: string | null
          created_by?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          folder_path?: string | null
          id?: string
          materi_name: string
          updated_at?: string | null
        }
        Update: {
          content_text?: string | null
          created_at?: string | null
          created_by?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          folder_path?: string | null
          id?: string
          materi_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lc_materials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lc_questions: {
        Row: {
          answer_format: string
          batch_name: string | null
          correct_answer: string | null
          created_at: string | null
          created_by: string | null
          difficulty: string | null
          gambar_url: string | null
          id: string
          materi_name: string
          material_id: string | null
          model_answer: string | null
          option_a: string | null
          option_b: string | null
          option_c: string | null
          option_d: string | null
          question: string
          question_type: string
          updated_at: string | null
          urutan: number | null
        }
        Insert: {
          answer_format?: string
          batch_name?: string | null
          correct_answer?: string | null
          created_at?: string | null
          created_by?: string | null
          difficulty?: string | null
          gambar_url?: string | null
          id?: string
          materi_name: string
          material_id?: string | null
          model_answer?: string | null
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          question: string
          question_type?: string
          updated_at?: string | null
          urutan?: number | null
        }
        Update: {
          answer_format?: string
          batch_name?: string | null
          correct_answer?: string | null
          created_at?: string | null
          created_by?: string | null
          difficulty?: string | null
          gambar_url?: string | null
          id?: string
          materi_name?: string
          material_id?: string | null
          model_answer?: string | null
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          question?: string
          question_type?: string
          updated_at?: string | null
          urutan?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lc_questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lc_questions_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "lc_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      lc_quiz_attempts: {
        Row: {
          graded_at: string | null
          graded_by: string | null
          grading_status: string
          id: string
          is_submitted: boolean | null
          passed: boolean | null
          quiz_session_id: string | null
          score: number | null
          started_at: string | null
          submitted_at: string | null
          tab_switches: number | null
          time_taken_sec: number | null
          total_correct: number | null
          total_questions: number | null
          user_id: string | null
        }
        Insert: {
          graded_at?: string | null
          graded_by?: string | null
          grading_status?: string
          id?: string
          is_submitted?: boolean | null
          passed?: boolean | null
          quiz_session_id?: string | null
          score?: number | null
          started_at?: string | null
          submitted_at?: string | null
          tab_switches?: number | null
          time_taken_sec?: number | null
          total_correct?: number | null
          total_questions?: number | null
          user_id?: string | null
        }
        Update: {
          graded_at?: string | null
          graded_by?: string | null
          grading_status?: string
          id?: string
          is_submitted?: boolean | null
          passed?: boolean | null
          quiz_session_id?: string | null
          score?: number | null
          started_at?: string | null
          submitted_at?: string | null
          tab_switches?: number | null
          time_taken_sec?: number | null
          total_correct?: number | null
          total_questions?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lc_quiz_attempts_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lc_quiz_attempts_quiz_session_id_fkey"
            columns: ["quiz_session_id"]
            isOneToOne: false
            referencedRelation: "lc_quiz_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lc_quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lc_quiz_sessions: {
        Row: {
          acak_soal: boolean
          allow_retake: boolean | null
          close_at: string | null
          closed_at: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          materi_name: string
          material_id: string | null
          open_at: string | null
          passing_grade: number | null
          question_count: number
          question_ids: string[] | null
          scheduled_at: string | null
          session_name: string
          session_type: string
          target_user_ids: string[] | null
          timer_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          acak_soal?: boolean
          allow_retake?: boolean | null
          close_at?: string | null
          closed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          materi_name: string
          material_id?: string | null
          open_at?: string | null
          passing_grade?: number | null
          question_count?: number
          question_ids?: string[] | null
          scheduled_at?: string | null
          session_name: string
          session_type?: string
          target_user_ids?: string[] | null
          timer_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          acak_soal?: boolean
          allow_retake?: boolean | null
          close_at?: string | null
          closed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          materi_name?: string
          material_id?: string | null
          open_at?: string | null
          passing_grade?: number | null
          question_count?: number
          question_ids?: string[] | null
          scheduled_at?: string | null
          session_name?: string
          session_type?: string
          target_user_ids?: string[] | null
          timer_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lc_quiz_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lc_quiz_sessions_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "lc_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          attempted_at: string | null
          id: string
          ip_address: string | null
          success: boolean | null
          username: string
        }
        Insert: {
          attempted_at?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean | null
          username: string
        }
        Update: {
          attempted_at?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean | null
          username?: string
        }
        Relationships: []
      }
      movement_logs: {
        Row: {
          catatan: string | null
          checkout_reference_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          event: string | null
          expected_return_date: string | null
          foto_barang_url: string | null
          foto_surat_url: string | null
          id: string
          is_deleted: boolean | null
          kondisi_barang: string | null
          nama_luar: string | null
          nama_pts: string | null
          project_name: string | null
          return_confirmed: boolean | null
          serial_number: string | null
          status_barang: string | null
          tanggal: string
          type_barang: string | null
        }
        Insert: {
          catatan?: string | null
          checkout_reference_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          event?: string | null
          expected_return_date?: string | null
          foto_barang_url?: string | null
          foto_surat_url?: string | null
          id?: string
          is_deleted?: boolean | null
          kondisi_barang?: string | null
          nama_luar?: string | null
          nama_pts?: string | null
          project_name?: string | null
          return_confirmed?: boolean | null
          serial_number?: string | null
          status_barang?: string | null
          tanggal: string
          type_barang?: string | null
        }
        Update: {
          catatan?: string | null
          checkout_reference_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          event?: string | null
          expected_return_date?: string | null
          foto_barang_url?: string | null
          foto_surat_url?: string | null
          id?: string
          is_deleted?: boolean | null
          kondisi_barang?: string | null
          nama_luar?: string | null
          nama_pts?: string | null
          project_name?: string | null
          return_confirmed?: boolean | null
          serial_number?: string | null
          status_barang?: string | null
          tanggal?: string
          type_barang?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_read: boolean | null
          ref_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_read?: boolean | null
          ref_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_read?: boolean | null
          ref_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      overdue_settings: {
        Row: {
          created_at: string
          due_date: string | null
          due_hours: number | null
          id: string
          set_by: string
          ticket_id: string | null
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          due_hours?: number | null
          id?: string
          set_by: string
          ticket_id?: string | null
        }
        Update: {
          created_at?: string
          due_date?: string | null
          due_hours?: number | null
          id?: string
          set_by?: string
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "overdue_settings_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "notification_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overdue_settings_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "stuck_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overdue_settings_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_otps: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          otp_hash: string
          used: boolean
          username: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          otp_hash: string
          used?: boolean
          username: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          otp_hash?: string
          used?: boolean
          username?: string
        }
        Relationships: []
      }
      pemakaian_menu: {
        Row: {
          created_at: string
          id: number
          modul: string
          sub: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          modul: string
          sub?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          modul?: string
          sub?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pemakaian_menu_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pengaturan_kode_acara: {
        Row: {
          aktif: boolean
          berlaku_sampai: string | null
          diubah_oleh: string | null
          diubah_pada: string
          id: boolean
          kode: string
        }
        Insert: {
          aktif?: boolean
          berlaku_sampai?: string | null
          diubah_oleh?: string | null
          diubah_pada?: string
          id?: boolean
          kode?: string
        }
        Update: {
          aktif?: boolean
          berlaku_sampai?: string | null
          diubah_oleh?: string | null
          diubah_pada?: string
          id?: boolean
          kode?: string
        }
        Relationships: []
      }
      picket_holidays: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string
          id: string
          label: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date: string
          id?: string
          label?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          id?: string
          label?: string
        }
        Relationships: []
      }
      piket_produk_lain: {
        Row: {
          created_at: string | null
          id: string
          kegiatan_id: string | null
          nama: string
          piket_id: string | null
          watt: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          kegiatan_id?: string | null
          nama?: string
          piket_id?: string | null
          watt?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          kegiatan_id?: string | null
          nama?: string
          piket_id?: string | null
          watt?: number
        }
        Relationships: [
          {
            foreignKeyName: "piket_produk_lain_kegiatan_id_fkey"
            columns: ["kegiatan_id"]
            isOneToOne: false
            referencedRelation: "piket_tamu_detail"
            referencedColumns: ["id"]
          },
        ]
      }
      piket_schedules: {
        Row: {
          created_at: string | null
          day_date: string | null
          day_of_week: string
          edited_by_name: string | null
          foto_url: string | null
          id: string
          kebutuhan: string[] | null
          pic: Json | null
          pic_ivp_id: string | null
          pic_ivp_name: string | null
          pic_mvi_id: string | null
          pic_mvi_name: string | null
          pic_ump_id: string | null
          pic_ump_name: string | null
          tamu_instansi: string | null
          updated_at: string | null
          week_start: string
        }
        Insert: {
          created_at?: string | null
          day_date?: string | null
          day_of_week: string
          edited_by_name?: string | null
          foto_url?: string | null
          id?: string
          kebutuhan?: string[] | null
          pic?: Json | null
          pic_ivp_id?: string | null
          pic_ivp_name?: string | null
          pic_mvi_id?: string | null
          pic_mvi_name?: string | null
          pic_ump_id?: string | null
          pic_ump_name?: string | null
          tamu_instansi?: string | null
          updated_at?: string | null
          week_start: string
        }
        Update: {
          created_at?: string | null
          day_date?: string | null
          day_of_week?: string
          edited_by_name?: string | null
          foto_url?: string | null
          id?: string
          kebutuhan?: string[] | null
          pic?: Json | null
          pic_ivp_id?: string | null
          pic_ivp_name?: string | null
          pic_mvi_id?: string | null
          pic_mvi_name?: string | null
          pic_ump_id?: string | null
          pic_ump_name?: string | null
          tamu_instansi?: string | null
          updated_at?: string | null
          week_start?: string
        }
        Relationships: []
      }
      piket_tamu_detail: {
        Row: {
          created_at: string | null
          edited_by_name: string | null
          foto_url: string | null
          id: string
          jam_mulai: string | null
          jam_selesai: string | null
          jenis_kegiatan: string | null
          kebutuhan: string[] | null
          keterangan: string | null
          nama_sales: string | null
          piket_id: string | null
          produk: string[] | null
          sales_division: string | null
          tamu_instansi: string | null
          team_rnd: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          edited_by_name?: string | null
          foto_url?: string | null
          id?: string
          jam_mulai?: string | null
          jam_selesai?: string | null
          jenis_kegiatan?: string | null
          kebutuhan?: string[] | null
          keterangan?: string | null
          nama_sales?: string | null
          piket_id?: string | null
          produk?: string[] | null
          sales_division?: string | null
          tamu_instansi?: string | null
          team_rnd?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          edited_by_name?: string | null
          foto_url?: string | null
          id?: string
          jam_mulai?: string | null
          jam_selesai?: string | null
          jenis_kegiatan?: string | null
          kebutuhan?: string[] | null
          keterangan?: string | null
          nama_sales?: string | null
          piket_id?: string | null
          produk?: string[] | null
          sales_division?: string | null
          tamu_instansi?: string | null
          team_rnd?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "piket_tamu_detail_piket_id_fkey"
            columns: ["piket_id"]
            isOneToOne: false
            referencedRelation: "piket_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      product_team_map: {
        Row: {
          created_at: string | null
          id: string
          product_type: string
          team_types: string[]
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_type: string
          team_types?: string[]
        }
        Update: {
          created_at?: string | null
          id?: string
          product_type?: string
          team_types?: string[]
        }
        Relationships: []
      }
      progress_actions: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          issue_id: string
          notes: string | null
          pic: string | null
          status: string
          target_date: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          issue_id: string
          notes?: string | null
          pic?: string | null
          status?: string
          target_date?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          issue_id?: string
          notes?: string | null
          pic?: string | null
          status?: string
          target_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_actions_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "progress_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_components: {
        Row: {
          category: string | null
          created_at: string
          id: string
          label: string
          location_id: string
          photo_thumb_url: string | null
          photo_url: string | null
          sort_order: number
          state: string
          weight: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          label: string
          location_id: string
          photo_thumb_url?: string | null
          photo_url?: string | null
          sort_order?: number
          state?: string
          weight?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          label?: string
          location_id?: string
          photo_thumb_url?: string | null
          photo_url?: string | null
          sort_order?: number
          state?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "progress_components_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "progress_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_issues: {
        Row: {
          action_plan: string | null
          component_id: string | null
          created_at: string
          due_date: string | null
          id: string
          issue: string
          location_id: string | null
          location_label: string | null
          note: string | null
          pic: string | null
          project_id: string
          resolution: string | null
          resolved_at: string | null
          root_cause: string | null
          severity: string
          sort_order: number
          status: string
        }
        Insert: {
          action_plan?: string | null
          component_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          issue: string
          location_id?: string | null
          location_label?: string | null
          note?: string | null
          pic?: string | null
          project_id: string
          resolution?: string | null
          resolved_at?: string | null
          root_cause?: string | null
          severity?: string
          sort_order?: number
          status?: string
        }
        Update: {
          action_plan?: string | null
          component_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          issue?: string
          location_id?: string | null
          location_label?: string | null
          note?: string | null
          pic?: string | null
          project_id?: string
          resolution?: string | null
          resolved_at?: string | null
          root_cause?: string | null
          severity?: string
          sort_order?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_issues_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "progress_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_issues_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "progress_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "progress_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_locations: {
        Row: {
          created_at: string
          id: string
          name: string
          note: string | null
          note_flag: boolean
          origin: string
          pic: string | null
          pic_user_id: string | null
          progress: number
          project_id: string
          sales_division: string | null
          sales_name: string | null
          sales_user_id: string | null
          sort_order: number
          source_reminder_id: string | null
          start_date: string | null
          status: string
          target_date: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          note?: string | null
          note_flag?: boolean
          origin?: string
          pic?: string | null
          pic_user_id?: string | null
          progress?: number
          project_id: string
          sales_division?: string | null
          sales_name?: string | null
          sales_user_id?: string | null
          sort_order?: number
          source_reminder_id?: string | null
          start_date?: string | null
          status?: string
          target_date?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          note_flag?: boolean
          origin?: string
          pic?: string | null
          pic_user_id?: string | null
          progress?: number
          project_id?: string
          sales_division?: string | null
          sales_name?: string | null
          sales_user_id?: string | null
          sort_order?: number
          source_reminder_id?: string | null
          start_date?: string | null
          status?: string
          target_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_locations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "progress_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_locations_source_reminder_id_fkey"
            columns: ["source_reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_projects: {
        Row: {
          client: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          origin: string
          sales_division: string | null
          sales_name: string | null
          sales_user_id: string | null
          share_enabled: boolean
          share_token: string | null
          source_reminder_id: string | null
          start_date: string | null
          status: string
          target_date: string | null
          updated_at: string
        }
        Insert: {
          client?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          origin?: string
          sales_division?: string | null
          sales_name?: string | null
          sales_user_id?: string | null
          share_enabled?: boolean
          share_token?: string | null
          source_reminder_id?: string | null
          start_date?: string | null
          status?: string
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          client?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          origin?: string
          sales_division?: string | null
          sales_name?: string | null
          sales_user_id?: string | null
          share_enabled?: boolean
          share_token?: string | null
          source_reminder_id?: string | null
          start_date?: string | null
          status?: string
          target_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_projects_source_reminder_id_fkey"
            columns: ["source_reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      project_attachments: {
        Row: {
          attachment_category: string | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          message_id: string | null
          request_id: string | null
          revision_version: number | null
          uploaded_at: string | null
          uploaded_by: string
        }
        Insert: {
          attachment_category?: string | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          message_id?: string | null
          request_id?: string | null
          revision_version?: number | null
          uploaded_at?: string | null
          uploaded_by: string
        }
        Update: {
          attachment_category?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          message_id?: string | null
          request_id?: string | null
          revision_version?: number | null
          uploaded_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "project_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_attachments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "project_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      project_messages: {
        Row: {
          created_at: string | null
          id: string
          message: string
          request_id: string | null
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          request_id?: string | null
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          request_id?: string | null
          sender_id?: string
          sender_name?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "project_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      project_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assign_name: string | null
          assign_user_id: string | null
          assigned_handler: string | null
          assigned_supervisor_id: string | null
          audio_detail: Json | null
          audio_mixer: string | null
          audio_system: string | null
          brand: string | null
          brand_display: string | null
          brand_display_2: string | null
          brand_display_2_pic_id: string | null
          brand_display_2_pic_name: string | null
          brand_display_pic_id: string | null
          brand_display_pic_name: string | null
          brand_middleware: string | null
          brand_middleware_pic_id: string | null
          brand_middleware_pic_name: string | null
          camera_conference: string | null
          camera_jumlah: string | null
          camera_tracking: Json | null
          controller_automation: string | null
          controller_type: string[] | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          due_date: string | null
          id: string
          internal_approved_at: string | null
          internal_approved_at_2: string | null
          internal_approved_by: string | null
          internal_sales_id: string | null
          internal_sales_id_2: string | null
          is_deleted: boolean | null
          ivp_assignee: string | null
          jaringan_cms: Json | null
          jumlah_input: string | null
          jumlah_output: string | null
          kebutuhan: Json | null
          kebutuhan_other: string | null
          keterangan_lain: string | null
          layout_signage: Json | null
          project_location: string | null
          project_name: string
          rejection_reason: string | null
          requester_id: string
          requester_name: string
          room_name: string | null
          rooms: Json | null
          routing_status: string | null
          sales_division: string | null
          sales_name: string | null
          sales_user_id: string | null
          solution_other: string | null
          solution_product: Json | null
          source: Json | null
          source_other: string | null
          status: string | null
          suggest_tampilan: string | null
          tabletop_input: string | null
          tabletop_jumlah: string | null
          ukuran_ruangan: string | null
          wallplate_input: string | null
          wallplate_jumlah: string | null
          wireless_dongle: string | null
          wireless_mode: string[] | null
          wireless_presentation: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assign_name?: string | null
          assign_user_id?: string | null
          assigned_handler?: string | null
          assigned_supervisor_id?: string | null
          audio_detail?: Json | null
          audio_mixer?: string | null
          audio_system?: string | null
          brand?: string | null
          brand_display?: string | null
          brand_display_2?: string | null
          brand_display_2_pic_id?: string | null
          brand_display_2_pic_name?: string | null
          brand_display_pic_id?: string | null
          brand_display_pic_name?: string | null
          brand_middleware?: string | null
          brand_middleware_pic_id?: string | null
          brand_middleware_pic_name?: string | null
          camera_conference?: string | null
          camera_jumlah?: string | null
          camera_tracking?: Json | null
          controller_automation?: string | null
          controller_type?: string[] | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string | null
          id?: string
          internal_approved_at?: string | null
          internal_approved_at_2?: string | null
          internal_approved_by?: string | null
          internal_sales_id?: string | null
          internal_sales_id_2?: string | null
          is_deleted?: boolean | null
          ivp_assignee?: string | null
          jaringan_cms?: Json | null
          jumlah_input?: string | null
          jumlah_output?: string | null
          kebutuhan?: Json | null
          kebutuhan_other?: string | null
          keterangan_lain?: string | null
          layout_signage?: Json | null
          project_location?: string | null
          project_name: string
          rejection_reason?: string | null
          requester_id: string
          requester_name: string
          room_name?: string | null
          rooms?: Json | null
          routing_status?: string | null
          sales_division?: string | null
          sales_name?: string | null
          sales_user_id?: string | null
          solution_other?: string | null
          solution_product?: Json | null
          source?: Json | null
          source_other?: string | null
          status?: string | null
          suggest_tampilan?: string | null
          tabletop_input?: string | null
          tabletop_jumlah?: string | null
          ukuran_ruangan?: string | null
          wallplate_input?: string | null
          wallplate_jumlah?: string | null
          wireless_dongle?: string | null
          wireless_mode?: string[] | null
          wireless_presentation?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assign_name?: string | null
          assign_user_id?: string | null
          assigned_handler?: string | null
          assigned_supervisor_id?: string | null
          audio_detail?: Json | null
          audio_mixer?: string | null
          audio_system?: string | null
          brand?: string | null
          brand_display?: string | null
          brand_display_2?: string | null
          brand_display_2_pic_id?: string | null
          brand_display_2_pic_name?: string | null
          brand_display_pic_id?: string | null
          brand_display_pic_name?: string | null
          brand_middleware?: string | null
          brand_middleware_pic_id?: string | null
          brand_middleware_pic_name?: string | null
          camera_conference?: string | null
          camera_jumlah?: string | null
          camera_tracking?: Json | null
          controller_automation?: string | null
          controller_type?: string[] | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string | null
          id?: string
          internal_approved_at?: string | null
          internal_approved_at_2?: string | null
          internal_approved_by?: string | null
          internal_sales_id?: string | null
          internal_sales_id_2?: string | null
          is_deleted?: boolean | null
          ivp_assignee?: string | null
          jaringan_cms?: Json | null
          jumlah_input?: string | null
          jumlah_output?: string | null
          kebutuhan?: Json | null
          kebutuhan_other?: string | null
          keterangan_lain?: string | null
          layout_signage?: Json | null
          project_location?: string | null
          project_name?: string
          rejection_reason?: string | null
          requester_id?: string
          requester_name?: string
          room_name?: string | null
          rooms?: Json | null
          routing_status?: string | null
          sales_division?: string | null
          sales_name?: string | null
          sales_user_id?: string | null
          solution_other?: string | null
          solution_product?: Json | null
          source?: Json | null
          source_other?: string | null
          status?: string | null
          suggest_tampilan?: string | null
          tabletop_input?: string | null
          tabletop_jumlah?: string | null
          ukuran_ruangan?: string | null
          wallplate_input?: string | null
          wallplate_jumlah?: string | null
          wireless_dongle?: string | null
          wireless_mode?: string[] | null
          wireless_presentation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_requests_internal_approved_by_fkey"
            columns: ["internal_approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_requests_internal_sales_id_fkey"
            columns: ["internal_sales_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_source_links: {
        Row: {
          confidence: number | null
          id: string
          mapped_at: string
          mapped_by: string | null
          mapping_type: string
          match_reason: string | null
          notes: string | null
          project_id: string | null
          source_module: string
          source_record_id: string
        }
        Insert: {
          confidence?: number | null
          id?: string
          mapped_at?: string
          mapped_by?: string | null
          mapping_type?: string
          match_reason?: string | null
          notes?: string | null
          project_id?: string | null
          source_module: string
          source_record_id: string
        }
        Update: {
          confidence?: number | null
          id?: string
          mapped_at?: string
          mapped_by?: string | null
          mapping_type?: string
          match_reason?: string | null
          notes?: string | null
          project_id?: string | null
          source_module?: string
          source_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_source_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_source_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_summary"
            referencedColumns: ["project_id"]
          },
        ]
      }
      projects: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          customer: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          sales_division: string | null
          sales_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          code?: string
          created_at?: string
          created_by?: string | null
          customer?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          sales_division?: string | null
          sales_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          customer?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          sales_division?: string | null
          sales_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      pts_team_mappings: {
        Row: {
          created_at: string | null
          id: string
          staff_user_id: string
          supervisor_user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          staff_user_id: string
          supervisor_user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          staff_user_id?: string
          supervisor_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pts_team_mappings_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pts_team_mappings_supervisor_user_id_fkey"
            columns: ["supervisor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rahasia_integrasi: {
        Row: {
          diperbarui_oleh: string | null
          diperbarui_pada: string
          kunci: string
          nilai: string
        }
        Insert: {
          diperbarui_oleh?: string | null
          diperbarui_pada?: string
          kunci: string
          nilai: string
        }
        Update: {
          diperbarui_oleh?: string | null
          diperbarui_pada?: string
          kunci?: string
          nilai?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          address: string | null
          assign_name: string
          assign_user_id: string | null
          assigned_supervisor_id: string | null
          assigned_to: string
          bast_date: string | null
          batch_id: string | null
          brand: string | null
          category: string | null
          completion_photo_url: string | null
          controller_automation_brand: string | null
          created_at: string | null
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          display_type: string | null
          domain_owner: string | null
          due_date: string
          due_time: string | null
          execution_mode: string | null
          guest_fullname: string | null
          id: string
          incentive_dasar_hpp: number | null
          incentive_excluded: boolean | null
          incentive_group_id: string | null
          incentive_tarif_kunci: string | null
          incentive_value: number | null
          installer_daerah: string | null
          installer_name: string | null
          installer_user_id: string | null
          internal_approved_at: string | null
          internal_approved_at_2: string | null
          internal_approved_by: string | null
          internal_sales_id: string | null
          internal_sales_id_2: string | null
          is_deleted: boolean | null
          mode_penyelesaian: string | null
          notes: string | null
          pic_id: string | null
          pic_name: string | null
          pic_phone: string | null
          pic_type: string | null
          priority: string | null
          product: string | null
          product_type: string | null
          progress_start_date: string | null
          progress_target_date: string | null
          project_name: string
          rejection_reason: string | null
          repeat: string | null
          requires_controller_automation: boolean | null
          requires_middleware: boolean | null
          routing_status: string | null
          sales_division: string | null
          sales_name: string | null
          sales_user_id: string | null
          status: string | null
          ticket_id: string | null
          updated_at: string | null
          warranty_years: number | null
        }
        Insert: {
          address?: string | null
          assign_name: string
          assign_user_id?: string | null
          assigned_supervisor_id?: string | null
          assigned_to: string
          bast_date?: string | null
          batch_id?: string | null
          brand?: string | null
          category?: string | null
          completion_photo_url?: string | null
          controller_automation_brand?: string | null
          created_at?: string | null
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          display_type?: string | null
          domain_owner?: string | null
          due_date: string
          due_time?: string | null
          execution_mode?: string | null
          guest_fullname?: string | null
          id?: string
          incentive_dasar_hpp?: number | null
          incentive_excluded?: boolean | null
          incentive_group_id?: string | null
          incentive_tarif_kunci?: string | null
          incentive_value?: number | null
          installer_daerah?: string | null
          installer_name?: string | null
          installer_user_id?: string | null
          internal_approved_at?: string | null
          internal_approved_at_2?: string | null
          internal_approved_by?: string | null
          internal_sales_id?: string | null
          internal_sales_id_2?: string | null
          is_deleted?: boolean | null
          mode_penyelesaian?: string | null
          notes?: string | null
          pic_id?: string | null
          pic_name?: string | null
          pic_phone?: string | null
          pic_type?: string | null
          priority?: string | null
          product?: string | null
          product_type?: string | null
          progress_start_date?: string | null
          progress_target_date?: string | null
          project_name: string
          rejection_reason?: string | null
          repeat?: string | null
          requires_controller_automation?: boolean | null
          requires_middleware?: boolean | null
          routing_status?: string | null
          sales_division?: string | null
          sales_name?: string | null
          sales_user_id?: string | null
          status?: string | null
          ticket_id?: string | null
          updated_at?: string | null
          warranty_years?: number | null
        }
        Update: {
          address?: string | null
          assign_name?: string
          assign_user_id?: string | null
          assigned_supervisor_id?: string | null
          assigned_to?: string
          bast_date?: string | null
          batch_id?: string | null
          brand?: string | null
          category?: string | null
          completion_photo_url?: string | null
          controller_automation_brand?: string | null
          created_at?: string | null
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          display_type?: string | null
          domain_owner?: string | null
          due_date?: string
          due_time?: string | null
          execution_mode?: string | null
          guest_fullname?: string | null
          id?: string
          incentive_dasar_hpp?: number | null
          incentive_excluded?: boolean | null
          incentive_group_id?: string | null
          incentive_tarif_kunci?: string | null
          incentive_value?: number | null
          installer_daerah?: string | null
          installer_name?: string | null
          installer_user_id?: string | null
          internal_approved_at?: string | null
          internal_approved_at_2?: string | null
          internal_approved_by?: string | null
          internal_sales_id?: string | null
          internal_sales_id_2?: string | null
          is_deleted?: boolean | null
          mode_penyelesaian?: string | null
          notes?: string | null
          pic_id?: string | null
          pic_name?: string | null
          pic_phone?: string | null
          pic_type?: string | null
          priority?: string | null
          product?: string | null
          product_type?: string | null
          progress_start_date?: string | null
          progress_target_date?: string | null
          project_name?: string
          rejection_reason?: string | null
          repeat?: string | null
          requires_controller_automation?: boolean | null
          requires_middleware?: boolean | null
          routing_status?: string | null
          sales_division?: string | null
          sales_name?: string | null
          sales_user_id?: string | null
          status?: string | null
          ticket_id?: string | null
          updated_at?: string | null
          warranty_years?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_assigned_supervisor_id_fkey"
            columns: ["assigned_supervisor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_installer_user_id_fkey"
            columns: ["installer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_internal_approved_by_fkey"
            columns: ["internal_approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_internal_sales_id_fkey"
            columns: ["internal_sales_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_pic_id_fkey"
            columns: ["pic_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      request_desain_ruang: {
        Row: {
          created_at: string
          desain_id: string
          dilampirkan_oleh: string | null
          dilampirkan_oleh_nama: string
          id: string
          request_id: string
          room_idx: number
          updated_at: string
          versi: number
          versi_id: string
        }
        Insert: {
          created_at?: string
          desain_id: string
          dilampirkan_oleh?: string | null
          dilampirkan_oleh_nama?: string
          id?: string
          request_id: string
          room_idx?: number
          updated_at?: string
          versi: number
          versi_id: string
        }
        Update: {
          created_at?: string
          desain_id?: string
          dilampirkan_oleh?: string | null
          dilampirkan_oleh_nama?: string
          id?: string
          request_id?: string
          room_idx?: number
          updated_at?: string
          versi?: number
          versi_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_desain_ruang_desain_id_fkey"
            columns: ["desain_id"]
            isOneToOne: false
            referencedRelation: "tools_desain_ruang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_desain_ruang_dilampirkan_oleh_fkey"
            columns: ["dilampirkan_oleh"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_desain_ruang_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "project_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_desain_ruang_versi_id_fkey"
            columns: ["versi_id"]
            isOneToOne: false
            referencedRelation: "tools_desain_ruang_versi"
            referencedColumns: ["id"]
          },
        ]
      }
      request_screen_connection: {
        Row: {
          created_at: string
          dilampirkan_oleh: string | null
          dilampirkan_oleh_nama: string
          id: string
          led_id: string | null
          nama: string
          request_id: string
          room_idx: number
          sumber_diubah_at: string | null
          svg: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dilampirkan_oleh?: string | null
          dilampirkan_oleh_nama?: string
          id?: string
          led_id?: string | null
          nama: string
          request_id: string
          room_idx: number
          sumber_diubah_at?: string | null
          svg: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dilampirkan_oleh?: string | null
          dilampirkan_oleh_nama?: string
          id?: string
          led_id?: string | null
          nama?: string
          request_id?: string
          room_idx?: number
          sumber_diubah_at?: string | null
          svg?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_screen_connection_dilampirkan_oleh_fkey"
            columns: ["dilampirkan_oleh"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_screen_connection_led_id_fkey"
            columns: ["led_id"]
            isOneToOne: false
            referencedRelation: "tools_led_simpan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_screen_connection_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "project_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_sld: {
        Row: {
          created_at: string
          dilampirkan_oleh: string | null
          dilampirkan_oleh_nama: string
          id: string
          request_id: string
          room_idx: number
          sld_id: string
          updated_at: string
          versi: number
          versi_id: string
        }
        Insert: {
          created_at?: string
          dilampirkan_oleh?: string | null
          dilampirkan_oleh_nama?: string
          id?: string
          request_id: string
          room_idx?: number
          sld_id: string
          updated_at?: string
          versi: number
          versi_id: string
        }
        Update: {
          created_at?: string
          dilampirkan_oleh?: string | null
          dilampirkan_oleh_nama?: string
          id?: string
          request_id?: string
          room_idx?: number
          sld_id?: string
          updated_at?: string
          versi?: number
          versi_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_sld_dilampirkan_oleh_fkey"
            columns: ["dilampirkan_oleh"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_sld_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "project_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_sld_sld_id_fkey"
            columns: ["sld_id"]
            isOneToOne: false
            referencedRelation: "tools_sld"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_sld_versi_id_fkey"
            columns: ["versi_id"]
            isOneToOne: false
            referencedRelation: "tools_sld_versi"
            referencedColumns: ["id"]
          },
        ]
      }
      rilis_android: {
        Row: {
          catatan: string | null
          diunggah_oleh: string | null
          diunggah_pada: string
          id: string
          kode_versi: number
          path: string | null
          ukuran: number
          versi: string
          wajib: boolean
        }
        Insert: {
          catatan?: string | null
          diunggah_oleh?: string | null
          diunggah_pada?: string
          id?: string
          kode_versi: number
          path?: string | null
          ukuran: number
          versi: string
          wajib?: boolean
        }
        Update: {
          catatan?: string | null
          diunggah_oleh?: string | null
          diunggah_pada?: string
          id?: string
          kode_versi?: number
          path?: string | null
          ukuran?: number
          versi?: string
          wajib?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "rilis_android_diunggah_oleh_fkey"
            columns: ["diunggah_oleh"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sql_diterapkan: {
        Row: {
          berkas: string
          catatan: string | null
          diterapkan_pada: string | null
          golongan: string
          urutan: number
        }
        Insert: {
          berkas: string
          catatan?: string | null
          diterapkan_pada?: string | null
          golongan: string
          urutan: number
        }
        Update: {
          berkas?: string
          catatan?: string | null
          diterapkan_pada?: string | null
          golongan?: string
          urutan?: number
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string | null
          id: string
          name: string
          photo_url: string | null
          role: string | null
          team_type: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          photo_url?: string | null
          role?: string | null
          team_type?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          photo_url?: string | null
          role?: string | null
          team_type?: string | null
          username?: string | null
        }
        Relationships: []
      }
      tech_note_folders: {
        Row: {
          category: string | null
          color: string
          created_at: string
          created_by: string
          description: string | null
          icon: string
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          category?: string | null
          color?: string
          created_at?: string
          created_by?: string
          description?: string | null
          icon?: string
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          category?: string | null
          color?: string
          created_at?: string
          created_by?: string
          description?: string | null
          icon?: string
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tech_note_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tech_note_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_note_history: {
        Row: {
          action: string
          created_at: string
          id: string
          note: string | null
          performed_by: string
          performed_by_name: string
          tech_note_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          note?: string | null
          performed_by: string
          performed_by_name: string
          tech_note_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          note?: string | null
          performed_by?: string
          performed_by_name?: string
          tech_note_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_note_history_tech_note_id_fkey"
            columns: ["tech_note_id"]
            isOneToOne: false
            referencedRelation: "tech_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_notes: {
        Row: {
          author_id: string
          author_name: string
          description: string
          folder_id: string
          id: string
          one_drive_link: string
          product: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_name: string | null
          status: string
          submitted_at: string
          tags: string[]
          team_type: string
          title: string
        }
        Insert: {
          author_id: string
          author_name: string
          description?: string
          folder_id: string
          id?: string
          one_drive_link: string
          product?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          status?: string
          submitted_at?: string
          tags?: string[]
          team_type?: string
          title: string
        }
        Update: {
          author_id?: string
          author_name?: string
          description?: string
          folder_id?: string
          id?: string
          one_drive_link?: string
          product?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          status?: string
          submitted_at?: string
          tags?: string[]
          team_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_notes_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "tech_note_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_support_assignment: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          domain: string
          id: string
          project_id: string | null
          ticket_id: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          domain: string
          id?: string
          project_id?: string | null
          ticket_id?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          domain?: string
          id?: string
          project_id?: string | null
          ticket_id?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_support_assignment_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_support_assignment_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_support_assignment_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          address: string | null
          assign_name: string
          assign_user_id: string | null
          assigned_supervisor_id: string | null
          brand: string | null
          created_at: string | null
          created_by: string | null
          current_team: string | null
          customer_phone: string | null
          date: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          escalation_notified_at: string | null
          id: string
          internal_sales_id: string | null
          internal_sales_id_2: string | null
          is_deleted: boolean | null
          issue_case: string
          overdue_hours: number | null
          photo_name: string | null
          photo_url: string | null
          priority: string | null
          product: string | null
          project_name: string
          rejection_reason: string | null
          reminder_id: string | null
          routing_status: string | null
          sales_division: string | null
          sales_name: string | null
          sales_user_id: string | null
          services_status: string | null
          sn_unit: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          assign_name: string
          assign_user_id?: string | null
          assigned_supervisor_id?: string | null
          brand?: string | null
          created_at?: string | null
          created_by?: string | null
          current_team?: string | null
          customer_phone?: string | null
          date?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          escalation_notified_at?: string | null
          id?: string
          internal_sales_id?: string | null
          internal_sales_id_2?: string | null
          is_deleted?: boolean | null
          issue_case: string
          overdue_hours?: number | null
          photo_name?: string | null
          photo_url?: string | null
          priority?: string | null
          product?: string | null
          project_name: string
          rejection_reason?: string | null
          reminder_id?: string | null
          routing_status?: string | null
          sales_division?: string | null
          sales_name?: string | null
          sales_user_id?: string | null
          services_status?: string | null
          sn_unit?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          assign_name?: string
          assign_user_id?: string | null
          assigned_supervisor_id?: string | null
          brand?: string | null
          created_at?: string | null
          created_by?: string | null
          current_team?: string | null
          customer_phone?: string | null
          date?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          escalation_notified_at?: string | null
          id?: string
          internal_sales_id?: string | null
          internal_sales_id_2?: string | null
          is_deleted?: boolean | null
          issue_case?: string
          overdue_hours?: number | null
          photo_name?: string | null
          photo_url?: string | null
          priority?: string | null
          product?: string | null
          project_name?: string
          rejection_reason?: string | null
          reminder_id?: string | null
          routing_status?: string | null
          sales_division?: string | null
          sales_name?: string | null
          sales_user_id?: string | null
          services_status?: string | null
          sn_unit?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      token_integrasi: {
        Row: {
          akhiran: string
          cakupan: string[]
          dibuat: string
          dicabut: string | null
          id: string
          nama: string
          terakhir_dipakai: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          akhiran: string
          cakupan?: string[]
          dibuat?: string
          dicabut?: string | null
          id?: string
          nama: string
          terakhir_dipakai?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          akhiran?: string
          cakupan?: string[]
          dibuat?: string
          dicabut?: string | null
          id?: string
          nama?: string
          terakhir_dipakai?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_integrasi_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_av_hasil: {
        Row: {
          catatan: string
          created_at: string
          dibuat_oleh: string | null
          dibuat_oleh_nama: string
          id: string
          judul: string
          lembar: Json
          proyek_id: string
          ringkasan: string
        }
        Insert: {
          catatan?: string
          created_at?: string
          dibuat_oleh?: string | null
          dibuat_oleh_nama?: string
          id?: string
          judul: string
          lembar: Json
          proyek_id: string
          ringkasan?: string
        }
        Update: {
          catatan?: string
          created_at?: string
          dibuat_oleh?: string | null
          dibuat_oleh_nama?: string
          id?: string
          judul?: string
          lembar?: Json
          proyek_id?: string
          ringkasan?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_av_hasil_dibuat_oleh_fkey"
            columns: ["dibuat_oleh"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_av_hasil_proyek_id_fkey"
            columns: ["proyek_id"]
            isOneToOne: false
            referencedRelation: "checklist_proyek"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_desain_ruang: {
        Row: {
          created_at: string
          data: Json
          diarsipkan_at: string | null
          dibuat_oleh: string | null
          dibuat_oleh_nama: string
          diubah_oleh_nama: string
          id: string
          jumlah_benda: number
          nama: string
          updated_at: string
          versi: number
        }
        Insert: {
          created_at?: string
          data: Json
          diarsipkan_at?: string | null
          dibuat_oleh?: string | null
          dibuat_oleh_nama?: string
          diubah_oleh_nama?: string
          id?: string
          jumlah_benda?: number
          nama: string
          updated_at?: string
          versi?: number
        }
        Update: {
          created_at?: string
          data?: Json
          diarsipkan_at?: string | null
          dibuat_oleh?: string | null
          dibuat_oleh_nama?: string
          diubah_oleh_nama?: string
          id?: string
          jumlah_benda?: number
          nama?: string
          updated_at?: string
          versi?: number
        }
        Relationships: [
          {
            foreignKeyName: "tools_desain_ruang_dibuat_oleh_fkey"
            columns: ["dibuat_oleh"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_desain_ruang_versi: {
        Row: {
          created_at: string
          data: Json
          desain_id: string
          dibuat_oleh_nama: string
          gambar: string | null
          gambar_hd: string | null
          id: string
          nama: string
          ringkasan: Json
          versi: number
        }
        Insert: {
          created_at?: string
          data: Json
          desain_id: string
          dibuat_oleh_nama?: string
          gambar?: string | null
          gambar_hd?: string | null
          id?: string
          nama: string
          ringkasan?: Json
          versi: number
        }
        Update: {
          created_at?: string
          data?: Json
          desain_id?: string
          dibuat_oleh_nama?: string
          gambar?: string | null
          gambar_hd?: string | null
          id?: string
          nama?: string
          ringkasan?: Json
          versi?: number
        }
        Relationships: [
          {
            foreignKeyName: "tools_desain_ruang_versi_desain_id_fkey"
            columns: ["desain_id"]
            isOneToOne: false
            referencedRelation: "tools_desain_ruang"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_gambar_desain: {
        Row: {
          created_at: string
          data: string
          dibuat_oleh: string | null
          hash: string
          ukuran: number
        }
        Insert: {
          created_at?: string
          data: string
          dibuat_oleh?: string | null
          hash: string
          ukuran: number
        }
        Update: {
          created_at?: string
          data?: string
          dibuat_oleh?: string | null
          hash?: string
          ukuran?: number
        }
        Relationships: [
          {
            foreignKeyName: "tools_gambar_desain_dibuat_oleh_fkey"
            columns: ["dibuat_oleh"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_led_simpan: {
        Row: {
          created_at: string
          data: Json
          dibuat_oleh: string | null
          dibuat_oleh_nama: string
          diubah_oleh_nama: string
          id: string
          nama: string
          ringkasan: Json
          svg_koneksi: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: Json
          dibuat_oleh?: string | null
          dibuat_oleh_nama?: string
          diubah_oleh_nama?: string
          id?: string
          nama: string
          ringkasan?: Json
          svg_koneksi?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          dibuat_oleh?: string | null
          dibuat_oleh_nama?: string
          diubah_oleh_nama?: string
          id?: string
          nama?: string
          ringkasan?: Json
          svg_koneksi?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_led_simpan_dibuat_oleh_fkey"
            columns: ["dibuat_oleh"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_objek_saya: {
        Row: {
          atur: Json
          created_at: string
          id: string
          jenis: string
          ket: string
          model: string | null
          nama: string
          ukuran_model: number
          updated_at: string
          user_id: string
        }
        Insert: {
          atur?: Json
          created_at?: string
          id?: string
          jenis: string
          ket?: string
          model?: string | null
          nama: string
          ukuran_model?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          atur?: Json
          created_at?: string
          id?: string
          jenis?: string
          ket?: string
          model?: string | null
          nama?: string
          ukuran_model?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_objek_saya_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_perbandingan: {
        Row: {
          catatan_verifikator: string | null
          created_at: string
          data: Json
          dibuat_nama: string | null
          dibuat_oleh: string
          diverifikasi_at: string | null
          diverifikasi_nama: string | null
          diverifikasi_oleh: string | null
          id: string
          judul: string
          status: string
          updated_at: string
        }
        Insert: {
          catatan_verifikator?: string | null
          created_at?: string
          data: Json
          dibuat_nama?: string | null
          dibuat_oleh: string
          diverifikasi_at?: string | null
          diverifikasi_nama?: string | null
          diverifikasi_oleh?: string | null
          id?: string
          judul?: string
          status?: string
          updated_at?: string
        }
        Update: {
          catatan_verifikator?: string | null
          created_at?: string
          data?: Json
          dibuat_nama?: string | null
          dibuat_oleh?: string
          diverifikasi_at?: string | null
          diverifikasi_nama?: string | null
          diverifikasi_oleh?: string | null
          id?: string
          judul?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_perbandingan_dibuat_oleh_fkey"
            columns: ["dibuat_oleh"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_perbandingan_diverifikasi_oleh_fkey"
            columns: ["diverifikasi_oleh"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_pustaka: {
        Row: {
          created_at: string
          data: Json
          dibuat_oleh: string | null
          diubah_oleh_nama: string | null
          id: string
          jenis: string
          nama: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          dibuat_oleh?: string | null
          diubah_oleh_nama?: string | null
          id?: string
          jenis: string
          nama: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          dibuat_oleh?: string | null
          diubah_oleh_nama?: string | null
          id?: string
          jenis?: string
          nama?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_pustaka_dibuat_oleh_fkey"
            columns: ["dibuat_oleh"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_sld: {
        Row: {
          created_at: string
          data: Json
          diarsipkan_at: string | null
          dibuat_oleh: string | null
          dibuat_oleh_nama: string
          diubah_oleh_nama: string
          id: string
          jumlah_perangkat: number
          nama: string
          updated_at: string
          versi: number
        }
        Insert: {
          created_at?: string
          data: Json
          diarsipkan_at?: string | null
          dibuat_oleh?: string | null
          dibuat_oleh_nama?: string
          diubah_oleh_nama?: string
          id?: string
          jumlah_perangkat?: number
          nama: string
          updated_at?: string
          versi?: number
        }
        Update: {
          created_at?: string
          data?: Json
          diarsipkan_at?: string | null
          dibuat_oleh?: string | null
          dibuat_oleh_nama?: string
          diubah_oleh_nama?: string
          id?: string
          jumlah_perangkat?: number
          nama?: string
          updated_at?: string
          versi?: number
        }
        Relationships: [
          {
            foreignKeyName: "tools_sld_dibuat_oleh_fkey"
            columns: ["dibuat_oleh"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_sld_katalog: {
        Row: {
          ada_foto: boolean | null
          created_at: string
          dibuat_oleh: string | null
          dibuat_oleh_nama: string
          dihapus_at: string | null
          diubah_oleh_nama: string
          foto: string | null
          id: string
          ikon: string
          kategori: string
          kelompok: string
          ket: string
          lebar: number
          model: string
          nama: string
          port: string[]
          rasio: number | null
          updated_at: string
          versi: number
        }
        Insert: {
          ada_foto?: boolean | null
          created_at?: string
          dibuat_oleh?: string | null
          dibuat_oleh_nama?: string
          dihapus_at?: string | null
          diubah_oleh_nama?: string
          foto?: string | null
          id?: string
          ikon?: string
          kategori?: string
          kelompok?: string
          ket?: string
          lebar?: number
          model?: string
          nama: string
          port?: string[]
          rasio?: number | null
          updated_at?: string
          versi?: number
        }
        Update: {
          ada_foto?: boolean | null
          created_at?: string
          dibuat_oleh?: string | null
          dibuat_oleh_nama?: string
          dihapus_at?: string | null
          diubah_oleh_nama?: string
          foto?: string | null
          id?: string
          ikon?: string
          kategori?: string
          kelompok?: string
          ket?: string
          lebar?: number
          model?: string
          nama?: string
          port?: string[]
          rasio?: number | null
          updated_at?: string
          versi?: number
        }
        Relationships: [
          {
            foreignKeyName: "tools_sld_katalog_dibuat_oleh_fkey"
            columns: ["dibuat_oleh"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_sld_versi: {
        Row: {
          created_at: string
          data: Json
          dibuat_oleh_nama: string
          id: string
          nama: string
          sld_id: string
          versi: number
        }
        Insert: {
          created_at?: string
          data: Json
          dibuat_oleh_nama?: string
          id?: string
          nama: string
          sld_id: string
          versi: number
        }
        Update: {
          created_at?: string
          data?: Json
          dibuat_oleh_nama?: string
          id?: string
          nama?: string
          sld_id?: string
          versi?: number
        }
        Relationships: [
          {
            foreignKeyName: "tools_sld_versi_sld_id_fkey"
            columns: ["sld_id"]
            isOneToOne: false
            referencedRelation: "tools_sld"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_template_kategori: {
        Row: {
          data: Json
          ditetapkan_oleh: string | null
          ditetapkan_oleh_nama: string | null
          kategori: string
          nama: string
          updated_at: string
        }
        Insert: {
          data: Json
          ditetapkan_oleh?: string | null
          ditetapkan_oleh_nama?: string | null
          kategori: string
          nama: string
          updated_at?: string
        }
        Update: {
          data?: Json
          ditetapkan_oleh?: string | null
          ditetapkan_oleh_nama?: string | null
          kategori?: string
          nama?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_template_kategori_ditetapkan_oleh_fkey"
            columns: ["ditetapkan_oleh"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_2fa: {
        Row: {
          aktif: boolean
          cadangan: string[]
          diaktifkan_pada: string | null
          dibuat: string
          langkah_terakhir: number
          rahasia: string
          user_id: string
        }
        Insert: {
          aktif?: boolean
          cadangan?: string[]
          diaktifkan_pada?: string | null
          dibuat?: string
          langkah_terakhir?: number
          rahasia: string
          user_id: string
        }
        Update: {
          aktif?: boolean
          cadangan?: string[]
          diaktifkan_pada?: string | null
          dibuat?: string
          langkah_terakhir?: number
          rahasia?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_2fa_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_credentials: {
        Row: {
          algorithm: string
          id: string
          password_hash: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          algorithm?: string
          id?: string
          password_hash: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          algorithm?: string
          id?: string
          password_hash?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_credentials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          ip_address: string | null
          token_hash: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          token_hash: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          token_hash?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_supervisor_mappings: {
        Row: {
          created_at: string | null
          id: string
          supervisor_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          supervisor_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          supervisor_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_supervisor_mappings_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_supervisor_mappings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          access_level: string
          allow_incentive_input: boolean | null
          allowed_menus: string[] | null
          atasan_id: string | null
          bisa_ditugaskan: boolean
          created_at: string | null
          daftar_via_event: boolean
          divisi: string | null
          full_name: string
          id: string
          incentive_akses: string | null
          incentive_brand_scope: string | null
          is_internal_sales: boolean
          jabatan: string | null
          kpi_enabled: boolean
          phone_number: string | null
          piket_akses: string | null
          piket_ubah: boolean
          pimpinan: boolean
          pts_daerah: string | null
          pts_type: string | null
          role: string | null
          sales_division: string | null
          tanggal_nonaktif: string | null
          team_type: string | null
          telegram_chat_id: string | null
          telegram_terhubung: boolean | null
          username: string
        }
        Insert: {
          access_level?: string
          allow_incentive_input?: boolean | null
          allowed_menus?: string[] | null
          atasan_id?: string | null
          bisa_ditugaskan?: boolean
          created_at?: string | null
          daftar_via_event?: boolean
          divisi?: string | null
          full_name: string
          id?: string
          incentive_akses?: string | null
          incentive_brand_scope?: string | null
          is_internal_sales?: boolean
          jabatan?: string | null
          kpi_enabled?: boolean
          phone_number?: string | null
          piket_akses?: string | null
          piket_ubah?: boolean
          pimpinan?: boolean
          pts_daerah?: string | null
          pts_type?: string | null
          role?: string | null
          sales_division?: string | null
          tanggal_nonaktif?: string | null
          team_type?: string | null
          telegram_chat_id?: string | null
          telegram_terhubung?: boolean | null
          username: string
        }
        Update: {
          access_level?: string
          allow_incentive_input?: boolean | null
          allowed_menus?: string[] | null
          atasan_id?: string | null
          bisa_ditugaskan?: boolean
          created_at?: string | null
          daftar_via_event?: boolean
          divisi?: string | null
          full_name?: string
          id?: string
          incentive_akses?: string | null
          incentive_brand_scope?: string | null
          is_internal_sales?: boolean
          jabatan?: string | null
          kpi_enabled?: boolean
          phone_number?: string | null
          piket_akses?: string | null
          piket_ubah?: boolean
          pimpinan?: boolean
          pts_daerah?: string | null
          pts_type?: string | null
          role?: string | null
          sales_division?: string | null
          tanggal_nonaktif?: string | null
          team_type?: string | null
          telegram_chat_id?: string | null
          telegram_terhubung?: boolean | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_atasan_id_fkey"
            columns: ["atasan_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_kirim_log: {
        Row: {
          created_at: string
          id: number
          target: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          target: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          target?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      checklist_stat_daftar: {
        Row: {
          daftar_id: string | null
          kendala: number | null
          selesai: number | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_item_daftar_id_fkey"
            columns: ["daftar_id"]
            isOneToOne: false
            referencedRelation: "checklist_daftar"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_tickets: {
        Row: {
          activity_count: number | null
          assigned_to: string | null
          created_at: string | null
          date: string | null
          id: string | null
          issue_case: string | null
          project_name: string | null
          status: string | null
        }
        Relationships: []
      }
      stuck_tickets: {
        Row: {
          assign_name: string | null
          created_at: string | null
          escalation_notified_at: string | null
          hours_idle: number | null
          id: string | null
          issue_case: string | null
          last_activity_at: string | null
          priority: string | null
          project_name: string | null
          status: string | null
        }
        Insert: {
          assign_name?: string | null
          created_at?: string | null
          escalation_notified_at?: string | null
          hours_idle?: never
          id?: string | null
          issue_case?: string | null
          last_activity_at?: never
          priority?: string | null
          project_name?: string | null
          status?: string | null
        }
        Update: {
          assign_name?: string | null
          created_at?: string | null
          escalation_notified_at?: string | null
          hours_idle?: never
          id?: string | null
          issue_case?: string | null
          last_activity_at?: never
          priority?: string | null
          project_name?: string | null
          status?: string | null
        }
        Relationships: []
      }
      ticket_stats_by_handler: {
        Row: {
          assigned_to: string | null
          pending_count: number | null
          process_count: number | null
          solved_count: number | null
          total_tickets: number | null
        }
        Relationships: []
      }
      v_project_summary: {
        Row: {
          code: string | null
          created_at: string | null
          customer: string | null
          design_count: number | null
          last_activity: string | null
          location: string | null
          name: string | null
          project_id: string | null
          review_count: number | null
          sales_division: string | null
          sales_name: string | null
          schedule_count: number | null
          status: string | null
          ticket_count: number | null
          total_activity: number | null
        }
        Relationships: []
      }
      vw_tech_note_kpi: {
        Row: {
          approved_count: number | null
          author_id: string | null
          author_name: string | null
          year: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_atau_full_access: { Args: never; Returns: boolean }
      akses_insentif: { Args: never; Returns: string }
      akses_insentif_input: { Args: never; Returns: boolean }
      akses_insentif_penuh: { Args: never; Returns: boolean }
      akun_event_saya: { Args: never; Returns: boolean }
      batalkan_tandai: { Args: { nama_berkas: string }; Returns: string }
      bersihkan_gambar_desain: { Args: never; Returns: number }
      boleh_atur_kpi: { Args: never; Returns: boolean }
      boleh_hapus_reminder: { Args: never; Returns: boolean }
      boleh_lihat_baris: {
        Args: {
          dibuat_oleh: string
          divisi: string
          nama_sales: string
          sales_uuid: string
        }
        Returns: boolean
      }
      boleh_lihat_project: {
        Args: { dibuat_oleh?: string; divisi: string; nama_sales: string }
        Returns: boolean
      }
      boleh_lihat_request: { Args: { req_id: string }; Returns: boolean }
      boleh_menu: { Args: { p_menu: string }; Returns: boolean }
      boleh_tulis_pengaturan: { Args: never; Returns: boolean }
      buang_policy_lama: { Args: { nama_tabel: string }; Returns: string }
      buka_app_settings: { Args: never; Returns: string }
      catat_galat_klien: {
        Args: {
          p_digest: string
          p_jalur: string
          p_pesan: string
          p_sidik: string
          p_sumber: string
          p_ua: string
          p_user: string
        }
        Returns: undefined
      }
      checklist_boleh_lihat_daftar: {
        Args: { p_daftar: string }
        Returns: boolean
      }
      checklist_boleh_lihat_proyek: {
        Args: { p_proyek: string }
        Returns: boolean
      }
      checklist_saya_anggota: { Args: { p_daftar: string }; Returns: boolean }
      cleanup_expired_sessions: { Args: never; Returns: number }
      cleanup_login_attempts: { Args: never; Returns: number }
      count_failed_attempts: {
        Args: { p_ip: string; p_username: string; p_window_mins?: number }
        Returns: number
      }
      debug_jwt_claims: {
        Args: never
        Returns: {
          full_name: string
          user_role: string
          username: string
        }[]
      }
      gabungkan_project: {
        Args: { p_asal: string; p_oleh?: string; p_tujuan: string }
        Returns: number
      }
      is_progress_admin: { Args: never; Returns: boolean }
      isi_pengaturan_merek: {
        Args: never
        Returns: {
          isi: string
          kunci: string
        }[]
      }
      jwt_claim: { Args: { nama: string }; Returns: string }
      jwt_full_name: { Args: never; Returns: string }
      jwt_user_id: { Args: never; Returns: string }
      kandidat_duplikat_project: {
        Args: { p_ambang?: number; p_limit?: number }
        Returns: {
          a_code: string
          a_id: string
          a_name: string
          a_total: number
          b_code: string
          b_id: string
          b_name: string
          b_total: number
          skor: number
        }[]
      }
      kategori_insentif_db: { Args: never; Returns: string[] }
      keadaan_app_settings: {
        Args: never
        Returns: {
          perintah: string
          policy: string
          syarat_baca: string
          syarat_tulis: string
        }[]
      }
      keadaan_rls: {
        Args: never
        Returns: {
          jumlah_policy: number
          policy_terpasang: string
          rls_menyala: boolean
          tabel: string
        }[]
      }
      kesehatan_sistem: { Args: never; Returns: Json }
      kunci_app_settings: { Args: never; Returns: string }
      kunci_rahasia: { Args: { k: string }; Returns: boolean }
      lc_eks_catat_pelanggaran: {
        Args: { p_hasil: string; p_jenis: string }
        Returns: number
      }
      lc_eks_live_papan: {
        Args: { p_kelas: string; p_sampai: number; p_sesi: number }
        Returns: {
          benar: number
          dijawab: number
          nama: string
          peserta_id: string
          poin: number
          waktu_benar_ms: number
        }[]
      }
      lingkup_divisi: { Args: never; Returns: string[] }
      lingkup_semua: { Args: never; Returns: boolean }
      matikan_rls: { Args: { nama_tabel: string }; Returns: string }
      nama_tidak_cocok: {
        Args: { nama_tabel: string }
        Returns: {
          akun: string
          catatan: string
          jumlah: number
          nama_di_data: string
          tabel: string
        }[]
      }
      norm_nama_project: { Args: { t: string }; Returns: string }
      nyalakan_rls: { Args: { nama_tabel: string }; Returns: string }
      periksa_lingkup: {
        Args: { nama_tabel: string }
        Returns: {
          akan_terlihat: number
          akun: string
          nama_mirip: number
          penilaian: string
          peran: string
          tabel: string
        }[]
      }
      pernah_dapat_bagian_insentif: {
        Args: { p_reminder_id: string }
        Returns: boolean
      }
      petakan_record_otomatis: {
        Args: {
          p_divisi?: string
          p_id: string
          p_lokasi?: string
          p_modul: string
          p_nama: string
          p_sales?: string
        }
        Returns: string
      }
      petakan_semua_otomatis: { Args: never; Returns: number }
      piket_akses_semua: { Args: never; Returns: boolean }
      piket_boleh_ubah: { Args: never; Returns: boolean }
      pimpinan_lihat_semua: { Args: never; Returns: boolean }
      propagate_user_rename: {
        Args: {
          p_new_name: string
          p_new_username: string
          p_old_name: string
          p_old_username: string
          p_user_id: string
        }
        Returns: Json
      }
      pts_ditugaskan_di_rooms: { Args: { rooms_json: Json }; Returns: boolean }
      record_belum_terpeta: {
        Args: { p_limit?: number }
        Returns: {
          info: string
          project_name: string
          source_module: string
          source_record_id: string
          tanggal: string
        }[]
      }
      rekap_lc_tahunan: {
        Args: { p_tahun: number; p_user_ids: string[] }
        Returns: {
          gagal: number
          lulus: number
          tidak_ikut: number
          user_id: string
          wajib: number
        }[]
      }
      ringkasan_mapping: {
        Args: never
        Returns: {
          auto_mapped: number
          belum_terpeta: number
          diabaikan: number
          manual_mapped: number
          total_project: number
        }[]
      }
      saran_project: {
        Args: { p_limit?: number; p_nama: string }
        Returns: {
          code: string
          location: string
          name: string
          project_id: string
          sales_name: string
          skor: number
        }[]
      }
      setujui:
        | { Args: { p_nilai: string }; Returns: string[] }
        | {
            Args: { p_kolom: string; p_nilai: string; p_tabel: string }
            Returns: string
          }
      setujui_ke: {
        Args: {
          p_kolom: string
          p_nilai: string
          p_tabel: string
          p_username: string
        }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      syarat_siap: {
        Args: never
        Returns: {
          ada: boolean
          fungsi: string
        }[]
      }
      syarat_tipe: {
        Args: never
        Returns: {
          cocok: boolean
          kolom: string
          tipe_diharapkan: string
          tipe_sekarang: string
        }[]
      }
      tandai: { Args: { ket?: string; nama_berkas: string }; Returns: string }
      tandai_semua_skema: { Args: never; Returns: string }
      tools_simpan_desain: {
        Args: {
          p_data: Json
          p_gambar: string
          p_id: string
          p_jumlah: number
          p_nama: string
          p_ringkasan: Json
          p_user: string
          p_user_nama: string
          p_versi: number
        }
        Returns: {
          id: string
          updated_at: string
          versi: number
        }[]
      }
      tools_simpan_desain_hd: {
        Args: { p_desain: string; p_gambar_hd: string; p_versi: number }
        Returns: undefined
      }
      tools_simpan_sld: {
        Args: {
          p_data: Json
          p_id: string
          p_jumlah: number
          p_nama: string
          p_user: string
          p_user_nama: string
          p_versi: number
        }
        Returns: {
          id: string
          updated_at: string
          versi: number
        }[]
      }
      tutup_jadwal_ticket: {
        Args: { p_status: string; p_ticket_id: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
