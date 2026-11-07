import type { Brand } from "@/lib/brand-routing";
import type { NewTicketForm } from "./NewTicketModal";

export const getJakartaDateString = () => {
  const now = new Date();
  const jakartaDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const y = jakartaDate.getFullYear();
  const m = String(jakartaDate.getMonth() + 1).padStart(2, "0");
  const d = String(jakartaDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export function formTiketAwal(): NewTicketForm {
  return {
    project_name: "",
    address: "",
    customer_phone: "",
    sales_name: "",
    sales_division: "",
    sn_unit: "",
    product: "",
    issue_case: "",
    description: "",
    assign_name: "",
    date: getJakartaDateString(),
    status: "Pending",
    current_team: "Team PTS IVP",
    photo: null as File | null,
    reminder_id: null as string | null,
    brand: undefined as Brand | undefined,
  };
}

export function formAktivitasAwal() {
  return {
    handler_name: "",
    action_taken: "",
    notes: "",
    new_status: "",
    sn_unit: "",
    file: null as File | null,
    photo: null as File | null,
    assign_to_services: false,
    services_assignee: "",
    onsite_use_schedule: false,
    onsite_schedule_date: "",
    onsite_schedule_hour: "08",
    onsite_schedule_minute: "00",
    extend_days: "",
  };
}

export function formPenggunaAwal() {
  return {
    username: "",
    password: "",
    full_name: "",
    team_member: "",
    role: "team",
    team_type: "Team PTS IVP",
  };
}

export function formSandiAwal() {
  return {
    current: "",
    new: "",
    confirm: "",
  };
}
