export function GayaReview() {
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
      @keyframes shimmer {
        0% { background-position: 200% center; }
        100% { background-position: -200% center; }
      }
      select option { background: #ffffff; color: #1e293b; }
      input[type="date"]::-webkit-calendar-picker-indicator,
      input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.3); cursor: pointer; }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.25); border-radius: 4px; }
      .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    `}</style>
  );
}
