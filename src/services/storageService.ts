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
};

// Real-time broadcast helper
function broadcastUpdate(type: 'guides' | 'tasks' | 'users' | 'all') {
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

// In-memory room photo & analysis caches
let roomPhotosCache: Record<string, RoomPhotoItem[]> = {};
let roomAnalysesCache: Record<string, AIRoomAnalysis> = {};

export const StorageService = {
  // Initialization function to ensure preloaded photo sync from server backend and IndexedDB
  async init(): Promise<void> {
    try {
      // 1. Fetch server-persisted reference photos and approved knowledge
      const knowledge = await AITrainingService.getApprovedKnowledge();
      if (Array.isArray(knowledge) && knowledge.length > 0) {
        knowledge.forEach((k) => {
          if (k.referencePhotoUrl) {
            photoMemoryCache[`guide_photo_guide-${k.category}`] = k.referencePhotoUrl;
            photoMemoryCache[`guide_photo_${k.category}`] = k.referencePhotoUrl;
          }
          if (k.incorrectPhotoUrl) {
            photoMemoryCache[`guide_inc_guide-${k.category}`] = k.incorrectPhotoUrl;
            photoMemoryCache[`guide_inc_${k.category}`] = k.incorrectPhotoUrl;
          }
        });
      }

      // 2. Fetch server-persisted room photos galleries & AI analyses
      const { photosByRoom, analysesByRoom } = await AITrainingService.getAllRoomsPhotos();
      if (photosByRoom && Object.keys(photosByRoom).length > 0) {
        roomPhotosCache = { ...photosByRoom };
        Object.entries(photosByRoom).forEach(([cat, list]) => {
          const primary = list.find((p) => p.isPrimary) || list[0];
          if (primary && primary.url) {
            photoMemoryCache[`guide_photo_guide-${cat}`] = primary.url;
            photoMemoryCache[`guide_photo_${cat}`] = primary.url;
          }
        });
      }
      if (analysesByRoom && Object.keys(analysesByRoom).length > 0) {
        roomAnalysesCache = { ...analysesByRoom };
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
              mergedTasks[idx] = { ...mergedTasks[idx], ...st };
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
      console.warn('Backend knowledge & photos sync notice:', e);
    }

    const photos = await PhotoStorageDB.getAllPhotos();
    Object.assign(photoMemoryCache, photos);
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
      } else {
        // Try migrating from v3 if present
        let initialGuides = [...DEFAULT_VISUAL_GUIDES];
        try {
          const oldV3 = localStorage.getItem('office_train_guides_v3');
          if (oldV3) {
            const parsedOld: VisualGuide[] = JSON.parse(oldV3);
            const photoMap = new Map<string, string>();
            parsedOld.forEach((og) => {
              if (og.photoUrl && og.photoUrl !== '') {
                photoMap.set(og.id, og.photoUrl);
              }
            });
            initialGuides = initialGuides.map((g) => {
              if (photoMap.has(g.id)) {
                return { ...g, photoUrl: photoMap.get(g.id)! };
              }
              return g;
            });
          }
        } catch {
          // ignore
        }
        guides = initialGuides;
      }
    } catch {
      guides = [...DEFAULT_VISUAL_GUIDES];
    }

    // Double check refrigerator is removed
    guides = guides.filter((g) => (g.category as string) !== 'refrigerator');

    // Overlay custom uploaded photos from PhotoStorageDB memory cache and server room galleries
    return guides.map((guide) => {
      const customPhoto = photoMemoryCache[`guide_photo_${guide.id}`] || photoMemoryCache[`guide_photo_${guide.category}`];
      const customIncPhoto = photoMemoryCache[`guide_inc_${guide.id}`] || photoMemoryCache[`guide_inc_${guide.category}`];

      // Resolve lightweight IDB pointer if present
      let finalPhoto = guide.photoUrl;
      if (finalPhoto && finalPhoto.startsWith('idb:guide_photo_')) {
        const idbKey = finalPhoto.replace('idb:', '');
        finalPhoto = photoMemoryCache[idbKey] || '';
      }

      let finalIncPhoto = guide.incorrectPhotoUrl;
      if (finalIncPhoto && finalIncPhoto.startsWith('idb:guide_inc_')) {
        const idbKey = finalIncPhoto.replace('idb:', '');
        finalIncPhoto = photoMemoryCache[idbKey] || undefined;
      }

      const roomGallery = roomPhotosCache[guide.category] || guide.photos || [];
      const primaryItem = roomGallery.find((p) => p.isPrimary);
      const primaryUrl = primaryItem ? primaryItem.url : '';
      const roomAnalysis = roomAnalysesCache[guide.category] || guide.aiRoomAnalysis;

      return {
        ...guide,
        photoUrl: primaryUrl || (customPhoto !== undefined ? customPhoto : finalPhoto),
        incorrectPhotoUrl: customIncPhoto !== undefined ? customIncPhoto : finalIncPhoto,
        photos: roomGallery,
        aiRoomAnalysis: roomAnalysis,
      };
    });
  },

  getRoomPhotos(category: string): RoomPhotoItem[] {
    return roomPhotosCache[category] || [];
  },

  getAllRoomPhotos(): Record<string, RoomPhotoItem[]> {
    return roomPhotosCache;
  },

  setRoomPhotos(category: string, photos: RoomPhotoItem[]): void {
    roomPhotosCache[category] = photos;
    const primary = photos.find((p) => p.isPrimary) || photos[0];
    if (primary && primary.url) {
      photoMemoryCache[`guide_photo_guide-${category}`] = primary.url;
      photoMemoryCache[`guide_photo_${category}`] = primary.url;
    }
    broadcastUpdate('guides');
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
    PhotoStorageDB.savePhoto(`guide_photo_${roomId}`, '');

    const guides = this.getVisualGuides();
    const idx = guides.findIndex((g) => g.id === roomId);
    if (idx !== -1) {
      guides[idx] = {
        ...guides[idx],
        photoUrl: '',
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin (Deleted)',
      };
      this.saveVisualGuides(guides);
    }
  },

  // Real-time incorrect photo upload / replace / delete
  updateRoomIncorrectPhoto(roomId: string, photoUrl: string): void {
    PhotoStorageDB.savePhoto(`guide_inc_${roomId}`, photoUrl);

    const guides = this.getVisualGuides();
    const idx = guides.findIndex((g) => g.id === roomId);
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
    PhotoStorageDB.savePhoto(`guide_inc_${roomId}`, '');

    const guides = this.getVisualGuides();
    const idx = guides.findIndex((g) => g.id === roomId);
    if (idx !== -1) {
      guides[idx] = {
        ...guides[idx],
        incorrectPhotoUrl: undefined,
        updatedAt: new Date().toISOString(),
      };
      this.saveVisualGuides(guides);
    }
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

      let finalRef = task.referencePhotoUrl;
      if (finalRef && finalRef.startsWith('idb:task_ref_')) {
        const idbKey = finalRef.replace('idb:', '');
        finalRef = photoMemoryCache[idbKey] || '';
      }

      let finalProof = task.proofPhotoUrl;
      if (finalProof && finalProof.startsWith('idb:task_proof_')) {
        const idbKey = finalProof.replace('idb:', '');
        finalProof = photoMemoryCache[idbKey] || undefined;
      }

      return {
        ...task,
        referencePhotoUrl: customRef !== undefined ? customRef : finalRef,
        proofPhotoUrl: customProof !== undefined ? customProof : finalProof,
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
