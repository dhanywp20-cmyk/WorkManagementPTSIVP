export function GayaTicketing() {
  return (
    <style>{`
      @keyframes scale-in {
        from { opacity: 0; transform: scale(0.92); }
        to { opacity: 1; transform: none; }
      }
      @keyframes bounce {
        0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
        40% { transform: scale(1); opacity: 1; }
      }
      .animate-scale-in { animation: scale-in 0.25s ease-out; }
      .animate-bounce { animation: bounce 0.6s ease-out; }
      input:focus, select:focus, textarea:focus { outline: none; }
    `}</style>
  );
}
