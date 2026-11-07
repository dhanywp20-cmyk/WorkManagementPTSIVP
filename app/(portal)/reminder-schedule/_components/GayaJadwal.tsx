export function GayaJadwal() {
  return (
    <style>{`
      @keyframes fadeInUp {
        from { opacity:0; transform:translateY(14px); }
        to   { opacity:1; transform: none; }
      }
      @keyframes scale-in {
        from { opacity:0; transform:scale(0.92); }
        to   { opacity:1; transform: none; }
      }
      @keyframes bounce {
        0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
        40% { transform: scale(1); opacity: 1; }
      }
      select option { background: #ffffff; color: #1e293b; }
      input[type="date"]::-webkit-calendar-picker-indicator,
      input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.3); cursor: pointer; }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(220,38,38,0.25); border-radius: 4px; }
    `}</style>
  );
}
