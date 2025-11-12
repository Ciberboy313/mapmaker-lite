export type Sprite = {
  id: string;
  name: string;
  img: HTMLImageElement;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  z: number;
};

export type Asset = {
  id: string;
  name: string;
  url: string;
  img?: HTMLImageElement;
  w?: number;
  h?: number;
  folderId?: string | null;
  _objectUrl?: string;
};

export type Folder = {
  id: string;
  name: string;
};

