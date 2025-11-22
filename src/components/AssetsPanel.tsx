import React, { useMemo, useState } from 'react';
import type { Asset, Folder } from '../types';
import { PanelLeft, ImagePlus, ChevronRight } from 'lucide-react';

export type AssetsPanelProps = {
  assets: Asset[];
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
  folders: Folder[];
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  selectedFolderId: string | null;
  setSelectedFolderId: (id: string | null) => void;
  onUploadClick?: () => void;
  onSetBackground?: (assetId: string) => void;
  onUploadToFolder?: (folderId: string | null) => void;
};

export default function AssetsPanel({ assets, setAssets, folders, setFolders, selectedFolderId, setSelectedFolderId, onUploadClick, onSetBackground, onUploadToFolder }: AssetsPanelProps) {
  const [q, setQ] = useState('');
  const [thumb, setThumb] = useState<number>(() => {
    try { const v = parseInt(localStorage.getItem('thumbSize') || ''); if (v>=32 && v<=160) return v; } catch {}
    return 72;
  });
  const setThumbPersist = (n: number) => { try { localStorage.setItem('thumbSize', String(n)); } catch {}; setThumb(n); };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return assets.filter(a => !term || a.name.toLowerCase().includes(term));
  }, [assets, q]);

  const visible = useMemo(() => {
    const fid = selectedFolderId || '__nofolder';
    return filtered.filter(a => (fid === '__nofolder' ? !a.folderId : a.folderId === selectedFolderId));
  }, [filtered, selectedFolderId]);

  const sections: { id: string; name: string; count: number }[] = useMemo(() => {
    const noCount = filtered.filter(a => !a.folderId).length;
    return [
      ...folders.map(f => ({ id: f.id, name: f.name, count: filtered.filter(a => a.folderId === f.id).length })),
      { id: '__nofolder', name: 'Senza folder', count: noCount },
    ];
  }, [filtered, folders]);

  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; type: 'asset'|'folder'|'none'; id?: string | null }>({ visible: false, x: 0, y: 0, type: 'none' });
  const openContextMenu = (e: React.MouseEvent, type: 'asset'|'folder', id?: string) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, type, id });
  };
  const closeContextMenu = () => setContextMenu({ visible: false, x: 0, y: 0, type: 'none', id: null });
  React.useEffect(() => {
    if (!contextMenu.visible) return;
    const onDocClick = () => closeContextMenu();
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [contextMenu.visible]);

  const renameAsset = (id?: string | null) => {
    if (!id) return; const a = assets.find(x=>x.id===id); if (!a) return; const newName = window.prompt('Rinomina asset', a.name); if (newName && newName.trim()) setAssets(prev => prev.map(x=> x.id===id? {...x, name: newName.trim() }: x)); closeContextMenu();
  };
  const deleteAsset = (id?: string | null) => {
    if (!id) return;
    setAssets(prev => {
      const found = prev.find(a => a.id === id);
      if (found && (found as any)._objectUrl) { try { URL.revokeObjectURL((found as any)._objectUrl as string); } catch {}
      }
      return prev.filter(a => a.id !== id);
    });
    closeContextMenu();
  };
  const setAssetAsBackground = (id?: string | null) => { if (!id) return; onSetBackground && onSetBackground(id); closeContextMenu(); };

  const renameFolder = (id?: string | null) => {
    if (!id) return; const f = folders.find(x=>x.id===id); if (!f) return; const newName = window.prompt('Rinomina cartella', f.name); if (newName && newName.trim()) setFolders(prev => prev.map(x => x.id===id? {...x, name: newName.trim() }: x)); closeContextMenu();
  };
  const deleteFolder = (id?: string | null) => {
    if (!id) return; setFolders(prev => prev.filter(f => f.id !== id)); setAssets(prev => prev.map(a => a.folderId === id ? { ...a, folderId: null } : a)); if (selectedFolderId === id) setSelectedFolderId(null); closeContextMenu();
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-xl h-full flex flex-col">
      <div className="px-3 py-2 border-b border-slate-800 flex items-center gap-2">
        <PanelLeft className="w-4 h-4"/>
        <span className="font-semibold">Assets</span>
        <div className="ml-auto">
          <button className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm" onClick={onUploadClick}><ImagePlus className="w-4 h-4 inline mr-1"/>Upload</button>
        </div>
      </div>
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <input value={q} onChange={(e)=> setQ(e.target.value)} placeholder="Cerca…" className="flex-1 bg-slate-800 rounded px-2 py-1 text-sm" />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span>Anteprime</span>
          <input type="range" min={48} max={160} step={8} value={thumb} onChange={(e)=> setThumbPersist(parseInt(e.target.value))} />
          <span>{thumb}px</span>
        </div>
        <div className="flex flex-col gap-2">
          {sections.map(sec => (
            <button key={sec.id} className={`flex items-center justify-between px-2 py-1 rounded text-sm border ${ (selectedFolderId||'__nofolder')===sec.id? 'bg-sky-700/20 border-sky-700 text-sky-100':'bg-slate-800 border-slate-700 text-slate-200' } ${hoveredFolderId===sec.id? 'ring-2 ring-sky-400 bg-sky-400/10':''}`}
              onClick={()=> setSelectedFolderId(sec.id==='__nofolder'? null : sec.id)}
              onDragOver={(e)=> e.preventDefault()}
              onDragEnter={(e)=> { e.preventDefault(); setHoveredFolderId(sec.id); }}
              onDragLeave={(e)=> { e.preventDefault(); setHoveredFolderId(prev => prev===sec.id? null : prev); }}
              onDrop={(e)=> { e.preventDefault(); const aid = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('assetId'); if (!aid) return; const fid = sec.id === '__nofolder' ? null : sec.id; setAssets(prev => prev.map(a => a.id===aid? {...a, folderId: fid }: a)); setHoveredFolderId(null); }}
              onContextMenu={(e)=> openContextMenu(e, 'folder', sec.id==='__nofolder'? undefined : sec.id)}
            >
              <div className="flex items-center gap-2 truncate"><ChevronRight className="w-4 h-4 opacity-60"/>{sec.name}</div>
              <div className="text-xs opacity-70">{sec.count}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="px-3 pb-3 overflow-auto">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumb}px, 1fr))` }}>
          {visible.map(a => (
            <div key={a.id} className="rounded-md border border-slate-700 bg-slate-800/40 p-1 select-none" draggable onDragStart={(e)=> { e.dataTransfer.setData('text/plain', a.id); e.dataTransfer.setData('assetId', a.id); }} onContextMenu={(e)=> openContextMenu(e, 'asset', a.id)}>
              <div className="w-full" style={{ height: thumb }}>
                {(a.img?.src || a.url) ? (
                  <img src={a.img?.src || a.url} alt={a.name} className="w-full h-full object-contain" decoding="async"/>
                ) : (
                  <div className="w-full h-full grid place-items-center text-xs text-slate-400">no preview</div>
                )}
              </div>
              <div className="mt-1 text-[11px] text-slate-300 truncate" title={a.name}>{a.name}</div>
            </div>
          ))}
          {visible.length === 0 && (
            <div className="text-xs text-slate-400">Nessun asset trovato.</div>
          )}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu.visible && (
        <div className="fixed inset-0 z-50" onClick={closeContextMenu}>
          <div className="absolute bg-slate-900 border border-slate-700 rounded shadow text-sm text-slate-100" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e)=> e.stopPropagation()}>
            {contextMenu.type === 'asset' && (
              <div className="py-1">
                <button className="w-full text-left px-3 py-1 hover:bg-slate-800" onClick={()=> renameAsset(contextMenu.id)}>Rinomina</button>
                <button className="w-full text-left px-3 py-1 hover:bg-slate-800" onClick={()=> deleteAsset(contextMenu.id)}>Elimina</button>
                {onSetBackground && <button className="w-full text-left px-3 py-1 hover:bg-slate-800" onClick={()=> setAssetAsBackground(contextMenu.id!)}>Imposta come background</button>}
              </div>
            )}
            {contextMenu.type === 'folder' && (
              <div className="py-1">
                <button className="w-full text-left px-3 py-1 hover:bg-slate-800" onClick={()=> renameFolder(contextMenu.id)}>Rinomina cartella</button>
                {contextMenu.id && <button className="w-full text-left px-3 py-1 hover:bg-slate-800" onClick={()=> deleteFolder(contextMenu.id)}>Elimina cartella</button>}
                {onUploadToFolder && (
                  <button className="w-full text-left px-3 py-1 hover:bg-slate-800" onClick={()=> { onUploadToFolder(contextMenu.id ?? null); closeContextMenu(); }}>Carica qui</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
