import type { MediaClip, MusicTrack, StoryProject } from "../types";

const DB_NAME = "quickstory-local";
const STORE_NAME = "projects";
const CURRENT_KEY = "current";

type StoredClip = Omit<MediaClip, "objectUrl" | "thumbnailUrl">;
type StoredMusic = Omit<MusicTrack, "objectUrl">;
type StoredProject = Omit<StoryProject, "clips" | "music"> & { clips: StoredClip[]; music?: StoredMusic };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalProject(project: StoryProject) {
  const db = await openDatabase();
  const stored: StoredProject = {
    ...project,
    clips: project.clips.map(({ objectUrl: _url, thumbnailUrl: _thumb, ...clip }) => clip),
    music: project.music ? (({ objectUrl: _url, ...music }) => music)(project.music) : undefined,
    updatedAt: new Date().toISOString()
  };
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(stored, CURRENT_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function loadLocalProject(): Promise<StoryProject | null> {
  const db = await openDatabase();
  const stored = await new Promise<StoredProject | undefined>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(CURRENT_KEY);
    request.onsuccess = () => resolve(request.result as StoredProject | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  if (!stored) return null;
  return {
    ...stored,
    music: stored.music ? {
      ...stored.music,
      objectUrl: stored.music.file ? URL.createObjectURL(stored.music.file) : ""
    } : undefined,
    clips: stored.clips.map((clip) => ({
      ...clip,
      objectUrl: clip.file ? URL.createObjectURL(clip.file) : ""
    }))
  };
}

export async function clearLocalProject() {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(CURRENT_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}
