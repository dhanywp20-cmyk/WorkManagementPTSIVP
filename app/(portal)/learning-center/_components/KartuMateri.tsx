'use client';

import { Material, FolderNode, countMaterials, fmtDate, BtnEdit, BtnDelete, BtnOpen } from './shared';

const GRID_COLS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-5',
};

export function MaterialCard({
  material: m, isAdmin, onDelete, onEdit, compact, colorHex,
}: {
  material: Material; isAdmin: boolean; onDelete?: (id: string) => void;
  onEdit?: (m: Material) => void;
  compact?: boolean; colorHex?: string;
}) {
  const hex = colorHex || '#3b82f6';
  return (
    <div className="group flex items-center gap-3 p-3 rounded-xl border border-white/60 hover:border-white/90 hover:shadow-md transition-all duration-200 mb-1.5"
      style={{ background: 'rgba(255,255,255,0.72)' }}>
      <div className={`${compact ? 'w-7 h-7' : 'w-9 h-9'} rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm`}
        style={{ background: `${hex}18`, border: `1.5px solid ${hex}33` }}>
        <svg aria-hidden="true" focusable="false" className={`${compact ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5'}`} style={{ color: hex }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className={`font-semibold text-slate-800 group-hover:text-blue-700 transition-colors ${compact ? 'text-xs' : 'text-sm'} truncate`}>{m.materi_name}</h4>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[11px] text-slate-500">{fmtDate(m.created_at)}</span>
          {m.file_url && <span className="text-[11px] text-slate-400">• ada link</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {m.file_url && (
          <BtnOpen onClick={() => window.open(m.file_url!, '_blank')}>Buka</BtnOpen>
        )}
        {isAdmin && onEdit && (
          <BtnEdit onClick={() => onEdit(m)} />
        )}
        {isAdmin && onDelete && (
          <BtnDelete onClick={() => onDelete(m.id)} />
        )}
      </div>
    </div>
  );
}

export function FolderTreeView({
  node, depth = 0, isAdmin, onDelete, onEdit, expandedPaths, togglePath, onAddToFolder, gridCols = 2, colorHex,
}: {
  node: FolderNode; depth?: number; isAdmin: boolean; onDelete?: (id: string) => void;
  onEdit?: (m: Material) => void;
  expandedPaths: Set<string>; togglePath: (path: string) => void;
  onAddToFolder?: (path: string) => void;
  gridCols?: number; colorHex?: string;
}) {
  const folderKeys = Object.keys(node.children).sort();
  const hasMaterials = node.materials.length > 0;
  const hasFolders = folderKeys.length > 0;
  if (!hasMaterials && !hasFolders) return null;

  return (
    <div className={depth > 0 ? 'mt-1' : ''}>
      {hasMaterials && (
        <div className="space-y-1 mb-3">
          {node.materials.map(m => (
            <MaterialCard key={m.id} material={m} isAdmin={isAdmin} onDelete={onDelete} onEdit={onEdit} compact colorHex={colorHex} />
          ))}
        </div>
      )}

      {hasFolders && (
        <div className={`grid ${GRID_COLS[gridCols] ?? 'grid-cols-2'} gap-2`}>
          {folderKeys.map(key => {
            const child = node.children[key];
            const isOpen = expandedPaths.has(child.path);
            const totalInside = countMaterials(child);
            return (
              <div key={child.path}
                onClick={() => togglePath(child.path)}
                className={`flex flex-col gap-1.5 p-2.5 rounded-xl border cursor-pointer select-none transition-all
                  ${isOpen
                    ? 'border-blue-300 bg-blue-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm hover:bg-blue-50/40'}`}>
                <div className="flex items-start justify-between gap-1">
                  <svg aria-hidden="true" focusable="false" className="w-7 h-7 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                    <path d="M2 7.5C2 6.67 2.67 6 3.5 6H9l2 2h9.5c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5h-17C2.67 20 2 19.33 2 18.5v-11z"
                      fill={isOpen ? '#FCD34D' : '#FBBF24'} stroke="#D97706" strokeWidth="0.8" />
                  </svg>
                  {isAdmin && onAddToFolder && (
                    <button
                      onClick={e => { e.stopPropagation(); onAddToFolder(child.path); }}
                      className="w-4 h-4 rounded bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-200 transition-all flex-shrink-0"
                      title={`Tambah ke "${child.name}"`}>+</button>
                  )}
                </div>
                <p className="text-[11px] font-bold text-slate-800 leading-snug line-clamp-2">{child.name}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-medium">{totalInside} item</span>
                  <svg aria-hidden="true" focusable="false" className={`w-3 h-3 text-slate-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {folderKeys.map(key => {
        const child = node.children[key];
        if (!expandedPaths.has(child.path)) return null;
        const hasContent = Object.keys(child.children).length > 0 || child.materials.length > 0;
        if (!hasContent) return null;
        return (
          <div key={`exp-${child.path}`} className="mt-2 rounded-xl border border-blue-200 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-blue-100 bg-blue-50/80">
              <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                <path d="M2 7.5C2 6.67 2.67 6 3.5 6H9l2 2h9.5c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5h-17C2.67 20 2 19.33 2 18.5v-11z" fill="#FCD34D" stroke="#D97706" strokeWidth="0.8" />
              </svg>
              <span className="text-[11px] font-bold text-blue-800 truncate">{child.name}</span>
              <span className="ml-auto text-[10px] text-blue-400 flex-shrink-0">{countMaterials(child)} item</span>
            </div>
            <div className="p-2.5">
              <FolderTreeView
                node={child} depth={depth + 1} isAdmin={isAdmin} onDelete={onDelete} onEdit={onEdit}
                expandedPaths={expandedPaths} togglePath={togglePath} onAddToFolder={onAddToFolder}
                gridCols={gridCols} colorHex={colorHex}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
