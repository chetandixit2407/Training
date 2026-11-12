import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { auth, db, storage, googleAuthProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { RoomPhotoItem, CompletionPhotoItem, DeletionAuditLog } from '../types';

const assetMemoryCache = new Map<string, string>();

export function sanitizeFirestoreId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || `id_${Date.now()}`;
}

export function extractMimeType(dataUrl: string): string {
  const m = dataUrl.match(/^data:([^;]+);base64,/);
  return m ? m[1] : 'image/jpeg';
}

export const CloudPhotoService = {
  onAuthChange(cb: (user: FirebaseUser | null) => void) {
    return onAuthStateChanged(auth, cb);
  },

  getCurrentFirebaseUser(): FirebaseUser | null {
    return auth.currentUser;
  },

  async signInWithGoogle(): Promise<FirebaseUser> {
    const result = await signInWithPopup(auth, googleAuthProvider);
    const fbUser = result.user;
    if (fbUser) {
      const profileRef = doc(db, 'users', fbUser.uid);
      const isOwnerAdmin = fbUser.email === 'chatgpt2407.open@gmail.com';
      try {
        const existing = await getDoc(profileRef);
        const role = existing.exists()
          ? existing.data().role || (isOwnerAdmin ? 'admin' : 'pantry_boy')
          : isOwnerAdmin
          ? 'admin'
          : 'pantry_boy';
        await setDoc(profileRef, {
          uid: fbUser.uid,
          email: fbUser.email || 'user@office.local',
          displayName: fbUser.displayName || fbUser.email || 'Office Staff',
          role,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('User profile sync notice:', err);
      }
    }
    return fbUser;
  },

  async signOutGoogle(): Promise<void> {
    await signOut(auth);
  },

  async savePhotoAsset(assetId: string, dataUrl: string, storagePath: string): Promise<string> {
    const fbUser = auth.currentUser;
    if (!fbUser) return '';

    const cleanId = sanitizeFirestoreId(assetId);
    const contentType = extractMimeType(dataUrl);
    assetMemoryCache.set(cleanId, dataUrl);

    // 1. Save to Firestore photo_assets (guaranteed available with deployed rules)
    try {
      await setDoc(doc(db, 'photo_assets', cleanId), {
        id: cleanId,
        contentType,
        dataUrl: dataUrl.slice(0, 940000),
        storagePath,
        createdAt: new Date().toISOString(),
        uploadedByUid: fbUser.uid,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `photo_assets/${cleanId}`);
    }

    // 2. Also upload to Firebase Storage bucket if enabled
    try {
      const sRef = storageRef(storage, storagePath);
      await uploadString(sRef, dataUrl, 'data_url');
      const dlUrl = await getDownloadURL(sRef);
      return dlUrl;
    } catch {
      // Fallback to Firestore-backed asset URL
      return `cloud-asset://${cleanId}`;
    }
  },

  async getPhotoAssetDataUrl(assetId: string): Promise<string | null> {
    const cleanId = sanitizeFirestoreId(assetId);
    if (assetMemoryCache.has(cleanId)) {
      return assetMemoryCache.get(cleanId)!;
    }
    if (!auth.currentUser) return null;
    try {
      const snap = await getDoc(doc(db, 'photo_assets', cleanId));
      if (snap.exists()) {
        const dataUrl = snap.data().dataUrl as string;
        if (dataUrl) {
          assetMemoryCache.set(cleanId, dataUrl);
          return dataUrl;
        }
      }
    } catch (err) {
      console.warn(`Could not fetch photo_assets/${cleanId}:`, err);
    }
    return null;
  },

  async uploadRoomPhoto(params: {
    photoId: string;
    roomId: string;
    fileName: string;
    dataUrl: string;
    url: string;
    captionHi?: string;
    captionEn?: string;
    photoType?: 'reference' | 'incorrect';
    isPrimary?: boolean;
    uploadedBy: string;
    uploadedAt: string;
  }): Promise<void> {
    const fbUser = auth.currentUser;
    if (!fbUser) return;

    const cleanId = sanitizeFirestoreId(params.photoId);
    const assetId = `asset_${cleanId}`;
    const storagePath = `rooms/${params.roomId}/${params.fileName}`;

    const cloudUrl = await this.savePhotoAsset(assetId, params.dataUrl, storagePath);
    const finalUrl = cloudUrl && cloudUrl.startsWith('https://') ? cloudUrl : params.url;

    try {
      await setDoc(doc(db, 'room_photos', cleanId), {
        id: cleanId,
        roomId: params.roomId,
        fileName: params.fileName,
        storagePath,
        assetId,
        url: finalUrl,
        captionHi: params.captionHi || '',
        captionEn: params.captionEn || '',
        photoType: params.photoType || 'reference',
        isPrimary: Boolean(params.isPrimary),
        isCurrent: true,
        uploadedAt: params.uploadedAt,
        uploadedBy: params.uploadedBy,
        uploadedByUid: fbUser.uid,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `room_photos/${cleanId}`);
    }
  },

  async archiveRoomPhoto(photoId: string): Promise<void> {
    const fbUser = auth.currentUser;
    if (!fbUser) return;
    const cleanId = sanitizeFirestoreId(photoId);
    try {
      await updateDoc(doc(db, 'room_photos', cleanId), {
        isCurrent: false,
        isPrimary: false,
      });
    } catch (err) {
      console.warn(`Archive room_photos/${cleanId} notice:`, err);
    }
  },

  async uploadTaskProof(params: {
    proofId: string;
    taskId: string;
    taskTitle: string;
    roomId: string;
    roomName: string;
    employeeId: string;
    employeeName: string;
    fileName: string;
    dataUrl: string;
    url: string;
    angleLabel?: string;
    caption?: string;
    uploadedAt: string;
    markPreviousNonLatest?: boolean;
  }): Promise<void> {
    const fbUser = auth.currentUser;
    if (!fbUser) return;

    if (params.markPreviousNonLatest) {
      try {
        const q = query(collection(db, 'task_proofs'), where('taskId', '==', params.taskId));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          if (d.data().isLatest) {
            await updateDoc(d.ref, { isLatest: false });
          }
        }
      } catch (err) {
        console.warn('Previous task_proofs archive notice:', err);
      }
    }

    const cleanId = sanitizeFirestoreId(params.proofId);
    const assetId = `asset_${cleanId}`;
    const storagePath = `task_proofs/${params.taskId}/${params.fileName}`;
    const cloudUrl = await this.savePhotoAsset(assetId, params.dataUrl, storagePath);
    const finalUrl = cloudUrl && cloudUrl.startsWith('https://') ? cloudUrl : params.url;

    try {
      await setDoc(doc(db, 'task_proofs', cleanId), {
        id: cleanId,
        taskId: params.taskId,
        taskTitle: params.taskTitle,
        roomId: params.roomId,
        roomName: params.roomName,
        employeeId: params.employeeId,
        employeeName: params.employeeName,
        fileName: params.fileName,
        storagePath,
        assetId,
        url: finalUrl,
        angleLabel: params.angleLabel || '',
        caption: params.caption || '',
        isLatest: true,
        uploadedAt: params.uploadedAt,
        uploadedByUid: fbUser.uid,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `task_proofs/${cleanId}`);
    }
  },

  async listRoomPhotos(roomId?: string): Promise<RoomPhotoItem[]> {
    if (!auth.currentUser) return [];
    const path = 'room_photos';
    try {
      const q = roomId
        ? query(collection(db, path), where('roomId', '==', roomId), orderBy('uploadedAt', 'desc'))
        : query(collection(db, path), orderBy('uploadedAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as RoomPhotoItem);
    } catch (err) {
      console.warn('Firestore listRoomPhotos notice:', err);
      return [];
    }
  },

  async listTaskProofs(taskId?: string): Promise<CompletionPhotoItem[]> {
    if (!auth.currentUser) return [];
    const path = 'task_proofs';
    try {
      const q = taskId
        ? query(collection(db, path), where('taskId', '==', taskId), orderBy('uploadedAt', 'desc'))
        : query(collection(db, path), orderBy('uploadedAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({
        ...(d.data() as any),
        pantryBoyId: d.data().employeeId,
        pantryBoyName: d.data().employeeName,
        expiresAt: d.data().uploadedAt,
      }));
    } catch (err) {
      console.warn('Firestore listTaskProofs notice:', err);
      return [];
    }
  },

  async adminDeleteHistoricalPhoto(params: {
    targetType: 'room_reference' | 'task_proof';
    targetId: string;
    roomId?: string;
    taskId?: string;
    fileName: string;
    storagePath: string;
    assetId?: string;
    deletedBy: string;
  }): Promise<void> {
    const fbUser = auth.currentUser;
    if (!fbUser) return;

    const cleanId = sanitizeFirestoreId(params.targetId);
    const colName = params.targetType === 'room_reference' ? 'room_photos' : 'task_proofs';

    try {
      await deleteDoc(doc(db, colName, cleanId));
      if (params.assetId) {
        await deleteDoc(doc(db, 'photo_assets', sanitizeFirestoreId(params.assetId)));
      }
      const logId = sanitizeFirestoreId(`del_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
      await setDoc(doc(db, 'deletion_audit_logs', logId), {
        id: logId,
        targetType: params.targetType,
        targetId: cleanId,
        roomId: params.roomId || '',
        taskId: params.taskId || '',
        fileName: params.fileName || cleanId,
        storagePath: params.storagePath || `${colName}/${cleanId}`,
        deletedBy: params.deletedBy || fbUser.email || 'Admin',
        deletedByUid: fbUser.uid,
        deletedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${colName}/${cleanId}`);
    }
  },

  async listDeletionAuditLogs(): Promise<DeletionAuditLog[]> {
    if (!auth.currentUser) return [];
    try {
      const q = query(collection(db, 'deletion_audit_logs'), orderBy('deletedAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as DeletionAuditLog);
    } catch (err) {
      console.warn('listDeletionAuditLogs notice:', err);
      return [];
    }
  },
};
