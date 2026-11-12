import { User, VisualGuide, SOP, DailyTask, Language, RoomPhotoItem, AIRoomAnalysis } from '../types';
import {
  DEFAULT_USERS,
  DEFAULT_VISUAL_GUIDES,
  DEFAULT_SOPS,
  DEFAULT_DAILY_TASKS,
} from '../data/defaultData';
import { AITrainingService } from './aiTrainingService';


const STORAGE_KEYS = {
  USERS: 'office_train_users_v4',
  VISUAL_GUIDES: 'office_train_guides_v4',
  SOPS: 'office_train_sops_v4',
  TASKS: 'office_train_tasks_v4',
  CURRENT_USER: 'office_train_current_user_v4',
  LANGUAGE: 'office_train_lang_v4',
  ROOM_PHOTOS: 'office_train_room_photos_v4',
  ROOM_ANALYSES: 'office_train_room_analyses_v4',
};

// Real-time broadcast helper
function broadcastUpdate(type: 'guides' | 'tasks' | 'users' | 'photos' | 'all') {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('office_data_updated', { detail: { type } }));
    } catch (e) {
      console.warn('Broadcast failed:', e);
    }
  }
}

/**
 * Persistent IndexedDB Store for High-Res Reference Photos and Proof Images.
 * Guarantees that uploaded reference photos stay saved permanently across
 * browser reloads, cache clears, and localStorage quota limits until changed again.
 */
const DB_NAME = 'office_pantry_photos_v2';
const STORE_NAME = 'photos';

function openPhotoDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject('IndexedDB not supported');
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// In-memory photo cache so synchronous calls return immediately
const photoMemoryCache: Record<string, string> = {};

export const PhotoStorageDB = {
  async getAllPhotos(): Promise<Record<string, string>> {
    try {
      const db = await openPhotoDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const map: Record<string, string> = {};
          if (Array.isArray(req.result)) {
            req.result.forEach((item) => {
              if (item && item.id !== undefined) {
                map[item.id] = item.photoUrl;
              }
            });
          }
          resolve(map);
        };
        req.onerror = () => resolve({});
      });
    } catch {
      return {};
    }
  },

  async savePhoto(id: string, photoUrl: string): Promise<void> {
    photoMemoryCache[id] = photoUrl;
    try {
      const db = await openPhotoDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({ id, photoUrl, updatedAt: new Date().toISOString() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch (e) {
      console.warn('Failed to write photo to IDB:', e);
    }
  },

  async deletePhoto(id: string): Promise<void> {
    delete photoMemoryCache[id];
    try {
      const db = await openPhotoDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // ignore
    }
  },
};

// Asynchronously load all saved photos from IndexedDB on startup
if (typeof window !== 'undefined') {
  PhotoStorageDB.getAllPhotos().then((photos) => {
    Object.assign(photoMemoryCache, photos);
    broadcastUpdate('all');
  });
}

// Canonical Room Category Normalizer
export function normalizeRoomCategory(cat: string): string {
  if (!cat) return 'general';
  return cat
    .toLowerCase()
    .trim()
    .replace(/^guide[-_]/, '')
    .replace(/-/g, '_');
}

export function normalizeImageUrl(url?: string): string {
  if (!url) return '';
  return url.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, '');
}

// In-memory room photo & analysis caches
let roomPhotosCache: Record<string, RoomPhotoItem[]> = {};
let roomAnalysesCache: Record<string, AIRoomAnalysis> = {};
let isRoomPhotosInitialized = false;

export const StorageService = {
  // Initialization function to ensure preloaded photo sync from server backend and IndexedDB
  async init(): Promise<void> {
    try {
      // 1. Fetch server-persisted room photos galleries & AI analyses FIRST
      const { photosByRoom, analysesByRoom } = await AITrainingService.getAllRoomsPhotos();
      if (photosByRoom && typeof photosByRoom === 'object') {
        Object.entries(photosByRoom).forEach(([cat, list]) => {
          const normCat = normalizeRoomCategory(cat);
          const safeList = Array.isArray(list) ? list : [];
          roomPhotosCache[normCat] = safeList;
          roomPhotosCache[cat] = safeList;

          if (safeList.length > 0) {
            const primary = safeList.find((p) => p.isPrimary) || safeList[0];
            if (primary && primary.url) {
              photoMemoryCache[`guide_photo_guide-${normCat}`] = primary.url;
              photoMemoryCache[`guide_photo_${normCat}`] = primary.url;
              photoMemoryCache[`guide_photo_guide-${cat}`] = primary.url;
              photoMemoryCache[`guide_photo_${cat}`] = primary.url;
            }
          } else {
            // Explicitly clear memory cache and IDB across all key variations for rooms with no photos
            const norm = normalizeRoomCategory(cat);
            const hyphen = norm.replace(/_/g, '-');
            const keysToPurge = [
              `guide_photo_guide-${norm}`,
              `guide_photo_${norm}`,
              `guide_photo_guide-${hyphen}`,
              `guide_photo_${hyphen}`,
              `guide_photo_guide-${cat}`,
              `guide_photo_${cat}`,
            ];
            keysToPurge.forEach((k) => {
              delete photoMemoryCache[k];
              PhotoStorageDB.deletePhoto(k);
            });
          }
        });
        isRoomPhotosInitialized = true;
        try {
          localStorage.setItem(STORAGE_KEYS.ROOM_PHOTOS, JSON.stringify(roomPhotosCache));
        } catch {}
      }

      if (analysesByRoom && Object.keys(analysesByRoom).length > 0) {
        Object.entries(analysesByRoom).forEach(([cat, analysis]) => {
          const normCat = normalizeRoomCategory(cat);
          roomAnalysesCache[normCat] = analysis;
          roomAnalysesCache[cat] = analysis;
        });
        try {
          localStorage.setItem(STORAGE_KEYS.ROOM_ANALYSES, JSON.stringify(roomAnalysesCache));
        } catch {}
      }

      // 2. Fetch server-persisted reference photos and approved knowledge
      const knowledge = await AITrainingService.getApprovedKnowledge();
      if (Array.isArray(knowledge) && knowledge.length > 0) {
        knowledge.forEach((k) => {
          const normCat = normalizeRoomCategory(k.category);
          // Only populate memory cache if room gallery on server actually has photos!
          const gallery = roomPhotosCache[normCat] || roomPhotosCache[k.category];
          if (gallery && gallery.length > 0 && k.referencePhotoUrl) {
            photoMemoryCache[`guide_photo_guide-${normCat}`] = k.referencePhotoUrl;
            photoMemoryCache[`guide_photo_${normCat}`] = k.referencePhotoUrl;
          }
          if (k.incorrectPhotoUrl) {
            photoMemoryCache[`guide_inc_guide-${normCat}`] = k.incorrectPhotoUrl;
            photoMemoryCache[`guide_inc_${normCat}`] = k.incorrectPhotoUrl;
          }
        });
      }

      // 3. Fetch server-persisted tasks (including proofPhotos with 40-day retention)
      try {
        const serverTasks = await AITrainingService.getTasks();
        if (Array.isArray(serverTasks) && serverTasks.length > 0) {
          const localTasks = this.getTasks();
          const mergedTasks = [...localTasks];
          serverTasks.forEach((st) => {
            const idx = mergedTasks.findIndex((lt) => lt.id === st.id);
            if (idx !== -1) {
              const merged = { ...mergedTasks[idx], ...st };
              if (Array.isArray(st.proofPhotos) && st.proofPhotos.length === 0 && !st.proofPhotoUrl) {
                merged.proofPhotos = [];
                merged.proofPhotoUrl = undefined;
                merged.afterPhotoUrl = undefined;
                delete photoMemoryCache[`task_proof_${st.id}`];
                PhotoStorageDB.deletePhoto(`task_proof_${st.id}`);
              }
              mergedTasks[idx] = merged;
            } else {
              mergedTasks.push(st);
            }
          });
          this.saveTasks(mergedTasks);
        }
      } catch (taskSyncErr) {
        console.warn('Server tasks sync notice:', taskSyncErr);
      }
    } catch (e) {
      console.warn('Backend knowledge & photos sync notice (using offline cache):', e);
    }

    // Offline fallback: if server fetch returned nothing (e.g., offline), hydrate from localStorage
    if (!isRoomPhotosInitialized) {
      try {
        const cachedPhotos = localStorage.getItem(STORAGE_KEYS.ROOM_PHOTOS);
        if (cachedPhotos) {
          const parsed = JSON.parse(cachedPhotos);
          if (parsed && typeof parsed === 'object') {
            roomPhotosCache = parsed;
            isRoomPhotosInitialized = true;
          }
        }
        const cachedAnalyses = localStorage.getItem(STORAGE_KEYS.ROOM_ANALYSES);
        if (cachedAnalyses) {
          const parsedA = JSON.parse(cachedAnalyses);
          if (parsedA && typeof parsedA === 'object') {
            roomAnalysesCache = parsedA;
          }
        }
      } catch {}
    }

    // Merge IndexedDB photos, but DO NOT resurrect deleted photos for empty galleries
    try {
      const photos = await PhotoStorageDB.getAllPhotos();
      Object.keys(photos).forEach((key) => {
        // If key relates to a room that is empty on server, purge from IDB and do not resurrect
        for (const [roomCat, list] of Object.entries(roomPhotosCache)) {
          if (list.length === 0) {
            const normRoom = normalizeRoomCategory(roomCat);
            const roomHyphen = normRoom.replace(/_/g, '-');
            if (
              key === `guide_photo_${normRoom}` ||
              key === `guide_photo_guide-${normRoom}` ||
              key === `guide_photo_${roomHyphen}` ||
              key === `guide_photo_guide-${roomHyphen}` ||
              key === `guide_photo_${roomCat}` ||
              key === `guide_photo_guide-${roomCat}`
            ) {
              PhotoStorageDB.deletePhoto(key);
              delete photoMemoryCache[key];
              return;
            }
          }
        }
        photoMemoryCache[key] = photos[key];
      });
    } catch {}

    // Ensure localStorage cached guides have empty photoUrl when room galleries have no photos
    try {
      localStorage.removeItem('office_train_guides_v3');
      const stored = localStorage.getItem(STORAGE_KEYS.VISUAL_GUIDES);
      if (stored) {
        const parsed: VisualGuide[] = JSON.parse(stored);
        let modified = false;
        parsed.forEach((g) => {
          const norm = normalizeRoomCategory(g.category);
          const gallery = roomPhotosCache[norm] || roomPhotosCache[g.category] || [];
          if (gallery.length === 0 && g.photoUrl) {
            g.photoUrl = '';
            modified = true;
          } else if (gallery.length > 0) {
            const primary = gallery.find((p) => p.isPrimary) || gallery[0];
            if (primary && g.photoUrl !== primary.url) {
              g.photoUrl = primary.url;
              modified = true;
            }
          }
        });
        if (modified) {
          localStorage.setItem(STORAGE_KEYS.VISUAL_GUIDES, JSON.stringify(parsed));
        }
      }
    } catch {}

    broadcastUpdate('all');
  },


  // Real-time subscription across components and tabs
  subscribe(callback: (type?: string) => void): () => void {
    if (typeof window === 'undefined') return () => {};

    const customHandler = (e: Event) => {
      const customEvent = e as CustomEvent;
      callback(customEvent.detail?.type || 'all');
    };

    const storageHandler = (e: StorageEvent) => {
      if (e.key && Object.values(STORAGE_KEYS).includes(e.key)) {
        callback('all');
      }
    };

    window.addEventListener('office_data_updated', customHandler);
    window.addEventListener('storage', storageHandler);

    return () => {
      window.removeEventListener('office_data_updated', customHandler);
      window.removeEventListener('storage', storageHandler);
    };
  },

  // Current Language
  getLanguage(): Language {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
      return (saved === 'en' ? 'en' : 'hi') as Language;
    } catch {
      return 'hi';
    }
  },

  setLanguage(lang: Language): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
      broadcastUpdate('all');
    } catch (e) {
      console.error(e);
    }
  },

  // Current User Session
  getCurrentUser(): User | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (data) {
        return JSON.parse(data);
      }
      const users = this.getUsers();
      const defaultUser = users[0] || DEFAULT_USERS[0];
      this.setCurrentUser(defaultUser);
      return defaultUser;
    } catch {
      return DEFAULT_USERS[0];
    }
  },

  setCurrentUser(user: User | null): void {
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
      broadcastUpdate('users');
    } catch (e) {
      console.error(e);
    }
  },

  // Users
  getUsers(): User[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      if (!data) {
        this.saveUsers(DEFAULT_USERS);
        return DEFAULT_USERS;
      }
      return JSON.parse(data);
    } catch {
      return DEFAULT_USERS;
    }
  },

  saveUsers(users: User[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      broadcastUpdate('users');
    } catch (e) {
      console.error(e);
    }
  },

  addUser(user: User): void {
    const users = this.getUsers();
    users.push(user);
    this.saveUsers(users);
  },

  deleteUser(userId: string): void {
    const users = this.getUsers().filter((u) => u.id !== userId);
    this.saveUsers(users);
  },

  // Visual Guides (Rooms)
  getVisualGuides(): VisualGuide[] {
    let guides: VisualGuide[] = [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.VISUAL_GUIDES);
      if (data) {
        guides = JSON.parse(data);
        const existingIds = new Set(guides.map((g) => g.id));
        const existingCats = new Set(guides.map((g) => normalizeRoomCategory(g.category)));
        const missingDefaults = DEFAULT_VISUAL_GUIDES.filter(
          (dg) => !existingIds.has(dg.id) && !existingCats.has(normalizeRoomCategory(dg.category))
        );
        if (missingDefaults.length > 0) {
          guides = [...guides, ...missingDefaults];
        }
      } else {
        guides = [...DEFAULT_VISUAL_GUIDES];
      }
    } catch {
      guides = [...DEFAULT_VISUAL_GUIDES];
    }

    // Double check refrigerator is removed
    guides = guides.filter((g) => (g.category as string) !== 'refrigerator');

    // Overlay custom uploaded photos from PhotoStorageDB memory cache and server room galleries
    return guides.map((guide) => {
      const normCat = normalizeRoomCategory(guide.category);
      const customPhoto = photoMemoryCache[`guide_photo_${guide.id}`] || photoMemoryCache[`guide_photo_${normCat}`] || photoMemoryCache[`guide_photo_${guide.category}`];
      const customIncPhoto = photoMemoryCache[`guide_inc_${guide.id}`] || photoMemoryCache[`guide_inc_${normCat}`] || photoMemoryCache[`guide_inc_${guide.category}`];

      // Check roomPhotosCache
      const hasLoadedGallery = isRoomPhotosInitialized || normCat in roomPhotosCache || guide.category in roomPhotosCache;
      const roomGallery = (normCat in roomPhotosCache ? roomPhotosCache[normCat] : (guide.category in roomPhotosCache ? roomPhotosCache[guide.category] : guide.photos)) || [];
      const primaryItem = roomGallery.find((p) => p.isPrimary) || roomGallery[0];
      const primaryUrl = primaryItem ? primaryItem.url : '';
      const roomAnalysis = roomAnalysesCache[normCat] || roomAnalysesCache[guide.category] || guide.aiRoomAnalysis;

      let resolvedPhotoUrl = '';
      if (roomGallery.length > 0) {
        resolvedPhotoUrl = primaryUrl || (customPhoto !== undefined ? customPhoto : '');
      } else if (hasLoadedGallery) {
        // Room photos have been fetched and this room has 0 photos.
        // NEVER restore deleted default photos!
        resolvedPhotoUrl = '';
      } else {
        // Only if not yet loaded from server, fall back
        resolvedPhotoUrl = customPhoto || guide.photoUrl || '';
      }

      return {
        ...guide,
        photoUrl: normalizeImageUrl(resolvedPhotoUrl),
        incorrectPhotoUrl: customIncPhoto !== undefined ? normalizeImageUrl(customIncPhoto) : (guide.incorrectPhotoUrl ? normalizeImageUrl(guide.incorrectPhotoUrl) : undefined),
        photos: roomGallery.map((p) => ({ ...p, url: normalizeImageUrl(p.url) })),
        aiRoomAnalysis: roomAnalysis,
      };
    });
  },

  isPhotosInitialized(): boolean {
    return isRoomPhotosInitialized;
  },

  getRoomPhotos(category: string): RoomPhotoItem[] {
    const normCat = normalizeRoomCategory(category);
    if (normCat in roomPhotosCache) return roomPhotosCache[normCat];
    if (category in roomPhotosCache) return roomPhotosCache[category];
    return [];
  },

  getAllRoomPhotos(): Record<string, RoomPhotoItem[]> {
    return roomPhotosCache;
  },

  setRoomPhotos(category: string, photos: RoomPhotoItem[]): void {
    const normCat = normalizeRoomCategory(category);
    const catHyphen = normCat.replace(/_/g, '-');
    const safePhotos = Array.isArray(photos) ? photos : [];
    roomPhotosCache[normCat] = safePhotos;
    roomPhotosCache[category] = safePhotos;
    roomPhotosCache[catHyphen] = safePhotos;

    const keysToManage = [
      `guide_photo_guide-${normCat}`,
      `guide_photo_${normCat}`,
      `guide_photo_guide-${catHyphen}`,
      `guide_photo_${catHyphen}`,
      `guide_photo_guide-${category}`,
      `guide_photo_${category}`,
    ];

    const primary = safePhotos.find((p) => p.isPrimary) || safePhotos[0];
    if (primary && primary.url) {
      keysToManage.forEach((k) => {
        photoMemoryCache[k] = primary.url;
        PhotoStorageDB.savePhoto(k, primary.url);
      });
    } else {
      keysToManage.forEach((k) => {
        delete photoMemoryCache[k];
        PhotoStorageDB.deletePhoto(k);
      });
    }

    // Immediately update guide in local storage
    try {
      const data = localStorage.getItem(STORAGE_KEYS.VISUAL_GUIDES);
      let guides: VisualGuide[];
      if (data) {
        guides = JSON.parse(data);
      } else {
        guides = [...DEFAULT_VISUAL_GUIDES];
      }
      const idx = guides.findIndex((g) => normalizeRoomCategory(g.category) === normCat || g.id === `guide-${normCat}` || g.category === category);
      if (idx !== -1) {
        guides[idx] = {
          ...guides[idx],
          photos: safePhotos,
          photoUrl: primary ? primary.url : '',
        };
        localStorage.setItem(STORAGE_KEYS.VISUAL_GUIDES, JSON.stringify(guides));
      }
    } catch (e) {
      console.warn('Notice saving local guides in setRoomPhotos:', e);
    }

    try {
      localStorage.setItem(STORAGE_KEYS.ROOM_PHOTOS, JSON.stringify(roomPhotosCache));
    } catch {}

    broadcastUpdate('guides');
    broadcastUpdate('photos');
  },

  getRoomAnalysis(category: string): AIRoomAnalysis | null {
    return roomAnalysesCache[category] || null;
  },

  setRoomAnalysis(category: string, analysis: AIRoomAnalysis): void {
    roomAnalysesCache[category] = analysis;
    broadcastUpdate('guides');
  },

  saveVisualGuides(guides: VisualGuide[]): void {
    // Make sure all photos in guides are also updated in IndexedDB
    guides.forEach((g) => {
      if (g.photoUrl && g.photoUrl.startsWith('data:image/')) {
        PhotoStorageDB.savePhoto(`guide_photo_${g.id}`, g.photoUrl);
      }
      if (g.incorrectPhotoUrl && g.incorrectPhotoUrl.startsWith('data:image/')) {
        PhotoStorageDB.savePhoto(`guide_inc_${g.id}`, g.incorrectPhotoUrl);
      }
    });

    try {
      localStorage.setItem(STORAGE_KEYS.VISUAL_GUIDES, JSON.stringify(guides));
      broadcastUpdate('guides');
    } catch (e) {
      console.warn('LocalStorage quota reached, saving lightweight guide pointers to localStorage while preserving full photos in IndexedDB:', e);
      try {
        const lightweight = guides.map((g) => ({
          ...g,
          photoUrl: g.photoUrl.startsWith('data:image/') ? `idb:guide_photo_${g.id}` : g.photoUrl,
          incorrectPhotoUrl: g.incorrectPhotoUrl?.startsWith('data:image/') ? `idb:guide_inc_${g.id}` : g.incorrectPhotoUrl,
        }));
        localStorage.setItem(STORAGE_KEYS.VISUAL_GUIDES, JSON.stringify(lightweight));
        broadcastUpdate('guides');
      } catch (err2) {
        console.error('Failed to save guides to localStorage even in lightweight mode:', err2);
      }
    }
  },

  updateVisualGuide(updated: VisualGuide): void {
    if (updated.photoUrl) {
      PhotoStorageDB.savePhoto(`guide_photo_${updated.id}`, updated.photoUrl);
    }
    if (updated.incorrectPhotoUrl !== undefined) {
      PhotoStorageDB.savePhoto(`guide_inc_${updated.id}`, updated.incorrectPhotoUrl);
    }

    const guides = this.getVisualGuides();
    const idx = guides.findIndex((g) => g.id === updated.id);
    if (idx !== -1) {
      guides[idx] = updated;
    } else {
      guides.push(updated);
    }
    this.saveVisualGuides(guides);
  },

  // Real-time photo upload & replace
  updateRoomReferencePhoto(roomId: string, photoUrl: string, updatedBy?: string): void {
    // 1. Permanently save to IndexedDB & memory cache
    PhotoStorageDB.savePhoto(`guide_photo_${roomId}`, photoUrl);

    // 2. Update state list
    const guides = this.getVisualGuides();
    const idx = guides.findIndex((g) => g.id === roomId);
    if (idx !== -1) {
      guides[idx] = {
        ...guides[idx],
        photoUrl,
        updatedAt: new Date().toISOString(),
        updatedBy: updatedBy || 'Admin',
      };
      this.saveVisualGuides(guides);
    }
  },

  // Real-time photo delete
  deleteRoomReferencePhoto(roomId: string): void {
    const normCat = normalizeRoomCategory(roomId);
    this.setRoomPhotos(normCat, []);
  },

  deleteRoomPhotoItem(category: string, photoId: string, photoUrl?: string): void {
    const normCat = normalizeRoomCategory(category);
    const existing = this.getRoomPhotos(normCat);
    const updated = existing.filter((p) => {
      if (p.id === photoId) return false;
      if (photoUrl && p.url === photoUrl) return false;
      return true;
    });
    this.setRoomPhotos(normCat, updated);
  },

  // Real-time incorrect photo upload / replace / delete
  updateRoomIncorrectPhoto(roomId: string, photoUrl: string): void {
    const rawCategory = roomId.replace(/^guide-/, '');
    PhotoStorageDB.savePhoto(`guide_inc_${roomId}`, photoUrl);
    PhotoStorageDB.savePhoto(`guide_inc_${rawCategory}`, photoUrl);
    photoMemoryCache[`guide_inc_${roomId}`] = photoUrl;
    photoMemoryCache[`guide_inc_${rawCategory}`] = photoUrl;

    const guides = this.getVisualGuides();
    const idx = guides.findIndex((g) => g.id === roomId || g.category === rawCategory);
    if (idx !== -1) {
      guides[idx] = {
        ...guides[idx],
        incorrectPhotoUrl: photoUrl,
        updatedAt: new Date().toISOString(),
      };
      this.saveVisualGuides(guides);
    }
  },

  deleteRoomIncorrectPhoto(roomId: string): void {
    const rawCategory = roomId.replace(/^guide-/, '');
    delete photoMemoryCache[`guide_inc_${roomId}`];
    delete photoMemoryCache[`guide_inc_${rawCategory}`];
    delete photoMemoryCache[`guide_inc_guide-${rawCategory}`];
    PhotoStorageDB.deletePhoto(`guide_inc_${roomId}`);
    PhotoStorageDB.deletePhoto(`guide_inc_${rawCategory}`);
    PhotoStorageDB.deletePhoto(`guide_inc_guide-${rawCategory}`);

    const guides = this.getVisualGuides();
    const idx = guides.findIndex((g) => g.id === roomId || g.category === rawCategory);
    if (idx !== -1) {
      guides[idx] = {
        ...guides[idx],
        incorrectPhotoUrl: undefined,
        updatedAt: new Date().toISOString(),
      };
      this.saveVisualGuides(guides);
    }
    broadcastUpdate('guides');
  },

  // Delete task completion photo from client storage
  deleteCompletionPhotoFromStorage(photoId: string, taskId?: string): void {
    if (photoId) {
      PhotoStorageDB.deletePhoto(`task_proof_${photoId}`);
      delete photoMemoryCache[`task_proof_${photoId}`];
    }
    if (taskId && (!photoId || photoId.startsWith('single_'))) {
      PhotoStorageDB.deletePhoto(`task_proof_${taskId}`);
      delete photoMemoryCache[`task_proof_${taskId}`];
    }
    const tasks = this.getTasks();
    let changed = false;
    tasks.forEach((t) => {
      if (!taskId || t.id === taskId) {
        if (!photoId || photoId.startsWith('single_')) {
          t.proofPhotos = [];
          t.proofPhotoUrl = undefined;
          t.afterPhotoUrl = undefined;
          PhotoStorageDB.deletePhoto(`task_proof_${t.id}`);
          delete photoMemoryCache[`task_proof_${t.id}`];
          changed = true;
        } else if (Array.isArray(t.proofPhotos)) {
          const prevLen = t.proofPhotos.length;
          t.proofPhotos = t.proofPhotos.filter((p) => p.id !== photoId && p.url !== photoId);
          if (t.proofPhotos.length !== prevLen) {
            changed = true;
            const nextUrl = t.proofPhotos.length > 0 ? t.proofPhotos[0].url : undefined;
            t.proofPhotoUrl = nextUrl;
            t.afterPhotoUrl = nextUrl;
            if (!nextUrl) {
              PhotoStorageDB.deletePhoto(`task_proof_${t.id}`);
              delete photoMemoryCache[`task_proof_${t.id}`];
            }
          }
        } else if (t.proofPhotoUrl === photoId) {
          t.proofPhotoUrl = undefined;
          t.afterPhotoUrl = undefined;
          PhotoStorageDB.deletePhoto(`task_proof_${t.id}`);
          delete photoMemoryCache[`task_proof_${t.id}`];
          changed = true;
        }
      }
    });
    if (changed) {
      this.saveTasks(tasks);
    }
    broadcastUpdate('tasks');
  },

  // SOPs
  getSOPs(): SOP[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SOPS);
      if (!data) {
        this.saveSOPs(DEFAULT_SOPS);
        return DEFAULT_SOPS;
      }
      return JSON.parse(data);
    } catch {
      return DEFAULT_SOPS;
    }
  },

  saveSOPs(sops: SOP[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SOPS, JSON.stringify(sops));
      broadcastUpdate('all');
    } catch (e) {
      console.error(e);
    }
  },

  // Daily Tasks
  getTasks(): DailyTask[] {
    let tasks: DailyTask[] = [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TASKS);
      if (data) {
        tasks = JSON.parse(data);
      } else {
        tasks = [...DEFAULT_DAILY_TASKS];
      }
    } catch {
      tasks = [...DEFAULT_DAILY_TASKS];
    }

    tasks = tasks.filter((t) => (t.category as string) !== 'refrigerator');

    return tasks.map((task) => {
      const customRef = photoMemoryCache[`task_ref_${task.id}`];
      const customProof = photoMemoryCache[`task_proof_${task.id}`];
      const normCat = normalizeRoomCategory(task.category || '');
      const liveGallery = roomPhotosCache[normCat] || roomPhotosCache[task.category] || [];
      const livePrimaryUrl = (liveGallery.find((p) => p.isPrimary) || liveGallery[0])?.url || '';

      let finalRef = task.referencePhotoUrl;
      if (finalRef && finalRef.startsWith('idb:task_ref_')) {
        const idbKey = finalRef.replace('idb:', '');
        finalRef = photoMemoryCache[idbKey] || '';
      }
      if (livePrimaryUrl) {
        finalRef = livePrimaryUrl;
      }

      let finalProof = task.proofPhotoUrl || undefined;
      if (finalProof && finalProof.startsWith('idb:task_proof_')) {
        const idbKey = finalProof.replace('idb:', '');
        finalProof = photoMemoryCache[idbKey] || undefined;
      }
      if (
        finalProof &&
        finalProof.startsWith('/uploads/reference/') &&
        (!task.proofPhotos || task.proofPhotos.length === 0) &&
        livePrimaryUrl
      ) {
        finalProof = livePrimaryUrl;
      }

      const proofExplicitlyCleared = Array.isArray(task.proofPhotos) && task.proofPhotos.length === 0 && !task.proofPhotoUrl;

      const rawRef = customRef !== undefined ? customRef : finalRef;
      const rawProof = proofExplicitlyCleared ? undefined : (customProof !== undefined ? customProof : finalProof);

      return {
        ...task,
        referencePhotoUrl: normalizeImageUrl(rawRef),
        proofPhotoUrl: rawProof ? normalizeImageUrl(rawProof) : undefined,
        proofPhotos: Array.isArray(task.proofPhotos)
          ? task.proofPhotos.map((p) => ({ ...p, url: normalizeImageUrl(p.url) }))
          : task.proofPhotos,
      };
    });
  },

  saveTasks(tasks: DailyTask[]): void {
    tasks.forEach((t) => {
      if (t.referencePhotoUrl && t.referencePhotoUrl.startsWith('data:image/')) {
        PhotoStorageDB.savePhoto(`task_ref_${t.id}`, t.referencePhotoUrl);
      }
      if (t.proofPhotoUrl && t.proofPhotoUrl.startsWith('data:image/')) {
        PhotoStorageDB.savePhoto(`task_proof_${t.id}`, t.proofPhotoUrl);
      }
    });

    try {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
      broadcastUpdate('tasks');
    } catch (e) {
      console.warn('LocalStorage quota reached, saving lightweight task pointers:', e);
      try {
        const lightweight = tasks.map((t) => ({
          ...t,
          referencePhotoUrl: t.referencePhotoUrl?.startsWith('data:image/') ? `idb:task_ref_${t.id}` : t.referencePhotoUrl,
          proofPhotoUrl: t.proofPhotoUrl?.startsWith('data:image/') ? `idb:task_proof_${t.id}` : t.proofPhotoUrl,
        }));
        localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(lightweight));
        broadcastUpdate('tasks');
      } catch (err2) {
        console.error('Failed to save tasks to localStorage:', err2);
      }
    }
  },

  addTask(task: DailyTask): void {
    if (task.referencePhotoUrl && task.referencePhotoUrl.startsWith('data:image/')) {
      PhotoStorageDB.savePhoto(`task_ref_${task.id}`, task.referencePhotoUrl);
    }
    const tasks = this.getTasks();
    tasks.unshift(task);
    this.saveTasks(tasks);
  },

  updateTask(updatedTask: DailyTask): void {
    if (updatedTask.referencePhotoUrl && updatedTask.referencePhotoUrl.startsWith('data:image/')) {
      PhotoStorageDB.savePhoto(`task_ref_${updatedTask.id}`, updatedTask.referencePhotoUrl);
    }
    if (updatedTask.proofPhotoUrl && updatedTask.proofPhotoUrl.startsWith('data:image/')) {
      PhotoStorageDB.savePhoto(`task_proof_${updatedTask.id}`, updatedTask.proofPhotoUrl);
    }
    const tasks = this.getTasks();
    const idx = tasks.findIndex((t) => t.id === updatedTask.id);
    if (idx !== -1) {
      tasks[idx] = updatedTask;
      this.saveTasks(tasks);
    }
    // Also asynchronously sync to backend server
    AITrainingService.updateTask(updatedTask).catch((e) => {
      console.warn('Backend task update notice:', e);
    });
  },

  deleteTask(taskId: string): void {
    PhotoStorageDB.deletePhoto(`task_ref_${taskId}`);
    PhotoStorageDB.deletePhoto(`task_proof_${taskId}`);
    const tasks = this.getTasks().filter((t) => t.id !== taskId);
    this.saveTasks(tasks);
  },

  // Reset to initial realistic data
  resetAllToDefault(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.USERS);
      localStorage.removeItem(STORAGE_KEYS.VISUAL_GUIDES);
      localStorage.removeItem(STORAGE_KEYS.SOPS);
      localStorage.removeItem(STORAGE_KEYS.TASKS);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      this.saveUsers(DEFAULT_USERS);
      this.saveVisualGuides(DEFAULT_VISUAL_GUIDES);
      this.saveSOPs(DEFAULT_SOPS);
      this.saveTasks(DEFAULT_DAILY_TASKS);
      this.setCurrentUser(DEFAULT_USERS[0]);
      broadcastUpdate('all');
    } catch (e) {
      console.error(e);
    }
  },
};

/**
 * Utility to compress an image file to a lightweight data URL
 * so photo uploads never crash LocalStorage quota and render instantly.
 */
export async function fileToDataUrl(file: File, maxDimension = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(readerEvent.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Compress as jpeg with 0.82 quality for sharp resolution & compact byte size
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = readerEvent.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
