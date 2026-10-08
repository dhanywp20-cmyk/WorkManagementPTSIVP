/**
 * Grup pilihan (checkbox / radio) untuk modal Edit Request.
 * Dulu didefinisikan DI DALAM komponen halaman - setiap render membuat tipe
 * komponen baru, sehingga React me-remount seluruh grup tiap render.
 */

const toggleArr = (arr: string[], val: string): string[] =>
  arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];

export const CheckGroup = ({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) => (
  <div className="mb-4">
    <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">{label}</label>
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const checked = value.includes(opt);
        return (
          <button key={opt} type="button" onClick={() => onChange(toggleArr(value, opt))}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${checked ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked ? 'border-teal-500 bg-teal-500' : 'border-gray-400'}`}>
              {checked && <svg aria-hidden="true" focusable="false" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            </div>
            {opt}
          </button>
        );
      })}
    </div>
  </div>
);

export const RadioGroup = ({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) => (
  <div className="mb-4">
    <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">{label}</label>
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${value === opt ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300'}`}>
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${value === opt ? 'border-teal-500' : 'border-gray-400'}`}>
            {value === opt && <div className="w-2 h-2 rounded-full bg-teal-500" />}
          </div>
          {opt}
        </button>
      ))}
    </div>
  </div>
);
