export type ProjectVersion = 1;

export type Project = {
  version: ProjectVersion;
  mapSize: { w: number; h: number };
  view?: { pan: { x: number; y: number }; zoom: number };
  grid: { enabled: boolean; size: number; snap: boolean };
  backgroundAssetId: string | null;
  folders: { id: string; name: string }[];
  assets: {
    id: string;
    name: string;
    url?: string; // may be data URL or external path
    w?: number;
    h?: number;
    folderId?: string | null;
  }[];
  sprites: {
    id: string;
    name: string;
    assetId?: string; // preferred link
    x: number; y: number; z: number;
    scale: number; rotation: number; opacity: number;
    visible: boolean; locked: boolean;
  }[];
};

export function serializeProject(state: {
  mapSize: { w: number; h: number };
  pan: { x: number; y: number };
  zoom: number;
  grid: boolean;
  gridSize: number;
  snap: boolean;
  backgroundAssetId: string | null | undefined;
  folders: { id: string; name: string }[];
  assets: { id: string; name: string; url?: string; w?: number; h?: number; folderId?: string | null }[];
  sprites: {
    id: string; name: string; img?: HTMLImageElement; x: number; y: number; z: number;
    scale: number; rotation: number; opacity: number; visible: boolean; locked: boolean;
  }[];
}): Project {
  return {
    version: 1,
    mapSize: { ...state.mapSize },
    view: { pan: { ...state.pan }, zoom: state.zoom },
    grid: { enabled: state.grid, size: state.gridSize, snap: state.snap },
    backgroundAssetId: state.backgroundAssetId ?? null,
    folders: state.folders.map(f => ({ id: f.id, name: f.name })),
    assets: state.assets.map(a => ({ id: a.id, name: a.name, url: a.url, w: a.w, h: a.h, folderId: a.folderId ?? null })),
    sprites: state.sprites.map(s => ({
      id: s.id, name: s.name, assetId: state.assets.find(a => a.name === s.name)?.id,
      x: s.x, y: s.y, z: s.z, scale: s.scale, rotation: s.rotation, opacity: s.opacity,
      visible: s.visible, locked: s.locked,
    })),
  };
}

export function validateAndMigrate(input: any): Project {
  if (!input || typeof input !== 'object') throw new Error('Invalid project: not an object');
  const v = Number(input.version) || 1;
  if (v !== 1) throw new Error('Unsupported project version');
  const w = Number(input.mapSize?.w) || 1024;
  const h = Number(input.mapSize?.h) || 768;
  const project: Project = {
    version: 1,
    mapSize: { w, h },
    view: {
      pan: { x: Number(input.view?.pan?.x) || 40, y: Number(input.view?.pan?.y) || 40 },
      zoom: Number(input.view?.zoom) || 1,
    },
    grid: {
      enabled: !!input.grid?.enabled,
      size: Number(input.grid?.size) || 64,
      snap: !!input.grid?.snap,
    },
    backgroundAssetId: input.backgroundAssetId ?? null,
    folders: Array.isArray(input.folders) ? input.folders.map((f: any) => ({ id: String(f.id), name: String(f.name || '') })) : [],
    assets: Array.isArray(input.assets) ? input.assets.map((a: any) => ({
      id: String(a.id), name: String(a.name || ''), url: a.url ? String(a.url) : undefined,
      w: Number(a.w) || undefined, h: Number(a.h) || undefined,
      folderId: a.folderId == null ? null : String(a.folderId),
    })) : [],
    sprites: Array.isArray(input.sprites) ? input.sprites.map((s: any) => ({
      id: String(s.id), name: String(s.name || ''), assetId: s.assetId ? String(s.assetId) : undefined,
      x: Number(s.x) || 0, y: Number(s.y) || 0, z: Number(s.z) || 0,
      scale: Number(s.scale) || 1, rotation: Number(s.rotation) || 0, opacity: Number(s.opacity) || 1,
      visible: s.visible !== false, locked: !!s.locked,
    })) : [],
  };
  return project;
}

