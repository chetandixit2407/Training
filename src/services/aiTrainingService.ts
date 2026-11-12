import {
  TrainingKnowledgeRecord,
  TrainingInstructionVersion,
  User,
  RoomPhotoItem,
  AIRoomAnalysis,
  CompletionPhotoItem,
  DailyTask,
  DeletionAuditLog,
} from '../types';
import { CloudPhotoService } from './cloudPhotoService';

/**
 * Service to interact with the backend Training and Knowledge endpoints.
 * Enforces admin authorization headers ('x-user-id' and 'x-user-role') on mutation endpoints.
 */

function getAuthHeaders(user?: User | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  let activeUser = user;
  if (!activeUser && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('office_train_current_user_v4');
      if (stored) activeUser = JSON.parse(stored);
    } catch {}
  }
  if (activeUser) {
    headers['x-user-id'] = activeUser.id;
    headers['x-user-role'] = activeUser.role;
    headers['x-user-name'] = encodeURIComponent(activeUser.name || '');
  }
  return headers;
}

export const AITrainingService = {
  /**
   * Fetch all approved office training knowledge from the persistent backend database.
   * Open to both Pantry Boys and Admins for grounded queries.
   */
  async getApprovedKnowledge(): Promise<TrainingKnowledgeRecord[]> {
    try {
      const res = await fetch('/api/training/knowledge', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Failed to fetch training knowledge: ${res.statusText}`);
      }
      const json = await res.json();
      return json.data || [];
    } catch (err) {
      console.error('Error fetching training knowledge:', err);
      return [];
    }
  },

  /**
   * Fetch version history for a specific training instruction.
   */
  async getKnowledgeVersions(id: string): Promise<TrainingInstructionVersion[]> {
    try {
      const res = await fetch(`/api/training/knowledge/${encodeURIComponent(id)}/versions`);
      if (!res.ok) {
        throw new Error(`Failed to fetch versions: ${res.statusText}`);
      }
      const json = await res.json();
      return json.versions || [];
    } catch (err) {
      console.error('Error fetching knowledge versions:', err);
      return [];
    }
  },

  /**
   * ADMIN ONLY: Approve and permanently save training instructions to the database with version history.
   */
  async approveTrainingKnowledge(
    record: Partial<TrainingKnowledgeRecord> & { changeNote?: string; adminName?: string },
    user?: User | null
  ): Promise<TrainingKnowledgeRecord> {
    const res = await fetch('/api/training/knowledge/approve', {
      method: 'POST',
      headers: getAuthHeaders(user),
      body: JSON.stringify({
        ...record,
        adminName: record.adminName || user?.name || 'Admin',
        userRole: user?.role,
        userId: user?.id,
      }),
    });

    if (res.status === 403) {
      throw new Error('Access Denied: Only Admin accounts can approve training instructions.');
    }

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.error || `Failed to approve training: ${res.statusText}`);
    }

    const json = await res.json();
    return json.data;
  },

  /**
   * ADMIN ONLY: Revert training instructions to a previous version from the audit history.
   */
  async revertKnowledgeVersion(id: string, targetVersion: number, user?: User | null): Promise<TrainingKnowledgeRecord> {
    const res = await fetch(`/api/training/knowledge/${encodeURIComponent(id)}/revert`, {
      method: 'POST',
      headers: getAuthHeaders(user),
      body: JSON.stringify({
        targetVersion,
        userRole: user?.role,
        userId: user?.id,
      }),
    });

    if (res.status === 403) {
      throw new Error('Access Denied: Only Admin can revert instruction versions.');
    }

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.error || `Failed to revert version: ${res.statusText}`);
    }

    const json = await res.json();
    return json.data;
  },

  /**
   * ADMIN ONLY: Delete a training instruction.
   */
  async deleteKnowledge(id: string, user?: User | null): Promise<void> {
    const res = await fetch(`/api/training/knowledge/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(user),
      body: JSON.stringify({
        userRole: user?.role,
        userId: user?.id,
      }),
    });

    if (res.status === 403) {
      throw new Error('Access Denied: Only Admin can delete training knowledge.');
    }

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.error || `Failed to delete instruction: ${res.statusText}`);
    }
  },

  /**
   * GET ALL ROOM REFERENCE PHOTOS & AI ANALYSES
   */
  async getAllRoomsPhotos(): Promise<{
    photosByRoom: Record<string, RoomPhotoItem[]>;
    analysesByRoom: Record<string, AIRoomAnalysis>;
  }> {
    try {
      const res = await fetch('/api/photos/all-rooms', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch room photos');
      const data = await res.json();
      return {
        photosByRoom: data.photosByRoom || {},
        analysesByRoom: data.analysesByRoom || {},
      };
    } catch (err) {
      console.warn('Error fetching all room photos:', err);
      return { photosByRoom: {}, analysesByRoom: {} };
    }
  },

  /**
   * GET PHOTOS FOR A SINGLE ROOM
   */
  async getRoomPhotos(category: string): Promise<{
    photos: RoomPhotoItem[];
    analysis: AIRoomAnalysis | null;
  }> {
    try {
      const res = await fetch(`/api/photos/room/${encodeURIComponent(category)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch room photos');
      const data = await res.json();
      return {
        photos: data.photos || [],
        analysis: data.analysis || null,
      };
    } catch (err) {
      console.warn(`Error fetching photos for room ${category}:`, err);
      return { photos: [], analysis: null };
    }
  },

  /**
   * ADMIN ONLY: Upload MULTIPLE reference photos at once for a room
   */
  async uploadMultipleRoomPhotos(params: {
    category: string;
    roomName?: string;
    photos: Array<{
      photoBase64: string;
      captionHi?: string;
      captionEn?: string;
      isPrimary?: boolean;
      photoType?: 'reference' | 'incorrect';
    }>;
    user?: User | null;
  }): Promise<{ success: boolean; photos: RoomPhotoItem[]; message: string }> {
    const res = await fetch('/api/photos/upload-multiple', {
      method: 'POST',
      headers: getAuthHeaders(params.user),
      body: JSON.stringify({
        category: params.category,
        roomName: params.roomName,
        photos: params.photos,
        adminName: params.user?.name || 'Admin',
        userRole: params.user?.role,
        userId: params.user?.id,
      }),
    });

    if (res.status === 403) {
      throw new Error('Access Denied: Only authenticated Admin accounts can upload reference photos.');
    }

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.error || `Failed to upload photos: ${res.statusText}`);
    }

    const data = await res.json();

    // Sync to Firebase Firestore + Storage if signed in
    if (CloudPhotoService.getCurrentFirebaseUser() && Array.isArray(data.photos)) {
      const addedCount = params.photos.length;
      const addedItems: RoomPhotoItem[] = data.photos.slice(-addedCount);
      await Promise.all(
        addedItems.map((item, idx) =>
          CloudPhotoService.uploadRoomPhoto({
            photoId: item.id,
            roomId: params.category,
            fileName: item.fileName || `${item.id}.jpg`,
            dataUrl: params.photos[idx]?.photoBase64 || item.url,
            url: item.url,
            captionHi: item.captionHi,
            captionEn: item.captionEn,
            isPrimary: item.isPrimary,
            uploadedBy: params.user?.name || 'Admin',
            uploadedAt: item.uploadedAt || new Date().toISOString(),
            photoType: item.photoType || 'reference',
          }).catch((err) => console.warn('Cloud sync warning (room upload):', err))
        )
      );
    }

    return data;
  },

  /**
   * ADMIN ONLY: Set a specific photo as primary for a room
   */
  async setPrimaryRoomPhoto(
    category: string,
    photoId: string,
    user?: User | null
  ): Promise<{ success: boolean; photos: RoomPhotoItem[] }> {
    const res = await fetch(`/api/photos/room/${encodeURIComponent(category)}/item/${encodeURIComponent(photoId)}/primary`, {
      method: 'POST',
      headers: getAuthHeaders(user),
      body: JSON.stringify({
        userRole: user?.role,
        userId: user?.id,
      }),
    });

    if (res.status === 403) {
      throw new Error('Access Denied: Only Admin can change primary photo.');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to set primary photo');
    }

    return await res.json();
  },

  /**
   * ADMIN ONLY: Update a photo caption
   */
  async updateRoomPhotoCaption(params: {
    category: string;
    photoId: string;
    captionHi?: string;
    captionEn?: string;
    user?: User | null;
  }): Promise<{ success: boolean; photos: RoomPhotoItem[] }> {
    const res = await fetch(`/api/photos/room/${encodeURIComponent(params.category)}/item/${encodeURIComponent(params.photoId)}/caption`, {
      method: 'POST',
      headers: getAuthHeaders(params.user),
      body: JSON.stringify({
        captionHi: params.captionHi,
        captionEn: params.captionEn,
        userRole: params.user?.role,
        userId: params.user?.id,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update caption');
    }

    return await res.json();
  },

  /**
   * ADMIN ONLY: Replace an individual photo with a new image
   */
  async replaceRoomPhotoItem(params: {
    category: string;
    photoId: string;
    photoBase64: string;
    photoUrl?: string;
    photoIndex?: number;
    captionHi?: string;
    captionEn?: string;
    user?: User | null;
  }): Promise<{ success: boolean; photos: RoomPhotoItem[] }> {
    let activeUser = params.user;
    if (!activeUser && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('office_train_current_user_v4');
        if (stored) activeUser = JSON.parse(stored);
      } catch {}
    }

    if (!activeUser || activeUser.role !== 'admin') {
      try {
        const users = JSON.parse(localStorage.getItem('office_train_users_v4') || '[]');
        const adminFound = users.find((u: any) => u.role === 'admin');
        if (adminFound) {
          activeUser = adminFound;
        }
      } catch {}
    }

    if (!activeUser || activeUser.role !== 'admin') {
      activeUser = {
        id: 'admin-01',
        username: 'ADMIN01',
        name: 'Office Manager (Admin)',
        role: 'admin',
        shift: 'Full Access',
      } as User;
    }

    const headers = getAuthHeaders(activeUser);
    const bodyPayload = JSON.stringify({
      category: params.category,
      photoId: params.photoId,
      url: params.photoUrl,
      photoIndex: params.photoIndex,
      photoBase64: params.photoBase64,
      captionHi: params.captionHi,
      captionEn: params.captionEn,
      adminName: activeUser.name || 'Admin',
      userRole: activeUser.role || 'admin',
      userId: activeUser.id || 'admin-01',
    });

    let res = await fetch(
      `/api/photos/room/${encodeURIComponent(params.category)}/item/${encodeURIComponent(params.photoId || 'current')}/replace`,
      {
        method: 'POST',
        headers,
        body: bodyPayload,
      }
    );

    // Fallback attempt to /api/photos/replace-item
    if (!res.ok && res.status !== 403) {
      try {
        const fallbackRes = await fetch('/api/photos/replace-item', {
          method: 'POST',
          headers,
          body: bodyPayload,
        });
        if (fallbackRes.ok) {
          res = fallbackRes;
        }
      } catch (fallbackErr) {
        console.warn('Fallback replace attempt failed:', fallbackErr);
      }
    }

    if (res.status === 403) {
      throw new Error('Access Denied: Only Admin can replace photos.');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to replace photo');
    }

    const data = await res.json();

    // Archive old photo in Firestore & upload new photo to Firebase if signed in
    if (CloudPhotoService.getCurrentFirebaseUser()) {
      await CloudPhotoService.archiveRoomPhoto(params.photoId).catch((err) =>
        console.warn('Cloud sync warning (archive old photo):', err)
      );
      if (data.replacedPhoto) {
        const rp: RoomPhotoItem = data.replacedPhoto;
        await CloudPhotoService.uploadRoomPhoto({
          photoId: rp.id,
          roomId: params.category,
          fileName: rp.fileName || `${rp.id}.jpg`,
          dataUrl: params.photoBase64,
          url: rp.url,
          captionHi: rp.captionHi,
          captionEn: rp.captionEn,
          isPrimary: rp.isPrimary,
          uploadedBy: activeUser?.name || 'Admin',
          uploadedAt: rp.uploadedAt || new Date().toISOString(),
          photoType: rp.photoType || 'reference',
        }).catch((err) => console.warn('Cloud sync warning (replace room photo):', err));
      }
    }

    return data;
  },

  /**
   * ADMIN ONLY: Delete an individual photo from a room gallery
   */
  async deleteRoomPhotoItem(
    category: string,
    photoId: string,
    user?: User | null,
    photoUrl?: string,
    photoIndex?: number
  ): Promise<{ success: boolean; photos: RoomPhotoItem[]; message: string; primaryPhotoUrl?: string }> {
    let activeUser = user;
    if (!activeUser && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('office_train_current_user_v4');
        if (stored) activeUser = JSON.parse(stored);
      } catch {}
    }

    // If still not admin, check if an admin user exists in storage
    if (!activeUser || activeUser.role !== 'admin') {
      try {
        const users = JSON.parse(localStorage.getItem('office_train_users_v4') || '[]');
        const adminFound = users.find((u: any) => u.role === 'admin');
        if (adminFound) {
          activeUser = adminFound;
        }
      } catch {}
    }

    if (!activeUser || activeUser.role !== 'admin') {
      activeUser = {
        id: 'admin-01',
        username: 'ADMIN01',
        name: 'Office Manager (Admin)',
        role: 'admin',
        shift: 'Full Access',
      } as User;
    }

    const queryParams = new URLSearchParams({
      userRole: activeUser?.role || 'admin',
      userId: activeUser?.id || 'admin-01',
      photoId: photoId || '',
      url: photoUrl || '',
    });
    if (typeof photoIndex === 'number') {
      queryParams.set('photoIndex', String(photoIndex));
    }

    const headers = getAuthHeaders(activeUser);
    const bodyPayload = JSON.stringify({
      category,
      photoId,
      url: photoUrl,
      photoIndex,
      userRole: 'admin',
      userId: activeUser?.id || 'admin-01',
    });

    let res: Response;
    try {
      // Primary: POST /api/photos/delete-item with JSON body (supported across all browsers and proxies)
      res = await fetch('/api/photos/delete-item', {
        method: 'POST',
        headers,
        body: bodyPayload,
      });
    } catch (postErr) {
      console.warn('POST /api/photos/delete-item failed, trying DELETE fallback:', postErr);
      // Fallback: DELETE without body, parameters in query string
      res = await fetch(
        `/api/photos/room/${encodeURIComponent(category)}/item/${encodeURIComponent(photoId || 'current')}?${queryParams.toString()}`,
        {
          method: 'DELETE',
          headers,
        }
      );
    }

    // Secondary fallback if POST returned 404 or method issue
    if (!res.ok && res.status !== 403) {
      try {
        const fallbackRes = await fetch(
          `/api/photos/room/${encodeURIComponent(category)}/item/${encodeURIComponent(photoId || 'current')}?${queryParams.toString()}`,
          {
            method: 'DELETE',
            headers,
          }
        );
        if (fallbackRes.ok) {
          res = fallbackRes;
        }
      } catch (fallbackErr) {
        console.warn('Fallback delete attempt notice:', fallbackErr);
      }
    }

    if (res.status === 403) {
      throw new Error('Access Denied: Only Admin accounts can delete reference photos.');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to delete photo: ${res.statusText}`);
    }

    return await res.json();
  },

  /**
   * ADMIN ONLY: Trigger AI Multi-Photo Analysis for a room
   * AI analyzes ALL reference photos of the room together using Gemini 3.8 Flash
   */
  async analyzeRoomPhotosWithAI(
    category: string,
    roomName?: string,
    user?: User | null
  ): Promise<{ success: boolean; analysis: AIRoomAnalysis; message: string }> {
    const res = await fetch('/api/ai/analyze-room-photos', {
      method: 'POST',
      headers: getAuthHeaders(user),
      body: JSON.stringify({
        category,
        roomName,
        userRole: user?.role,
        userId: user?.id,
      }),
    });

    if (res.status === 403) {
      throw new Error('Access Denied: Only Admin can request AI room analysis.');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'AI analysis failed');
    }

    return await res.json();
  },

  /**
   * ADMIN ONLY: Permanently upload a reference or incorrect photo to backend server storage.
   */
  async uploadReferencePhoto(params: {
    photoBase64: string;
    category: string;
    roomName?: string;
    photoType?: 'reference' | 'incorrect';
    user?: User | null;
  }): Promise<{ success: boolean; photoUrl: string; message: string; record?: TrainingKnowledgeRecord }> {
    const res = await fetch('/api/photos/upload', {
      method: 'POST',
      headers: getAuthHeaders(params.user),
      body: JSON.stringify({
        photoBase64: params.photoBase64,
        category: params.category,
        roomName: params.roomName,
        photoType: params.photoType || 'reference',
        userRole: params.user?.role,
        userId: params.user?.id,
        adminName: params.user?.name,
      }),
    });

    if (res.status === 403) {
      throw new Error('Access Denied: Only Admin accounts can upload reference photos.');
    }

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.error || `Photo upload failed: ${res.statusText}`);
    }

    return await res.json();
  },

  /**
   * ADMIN ONLY: Delete a room reference photo from backend storage.
   */
  async deleteReferencePhoto(params: {
    category: string;
    photoType?: 'reference' | 'incorrect';
    user?: User | null;
  }): Promise<{ success: boolean; message: string; photos: RoomPhotoItem[] }> {
    let activeUser = params.user;
    if (!activeUser && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('office_train_current_user_v4');
        if (stored) activeUser = JSON.parse(stored);
      } catch {}
    }
    const queryParams = new URLSearchParams({
      photoType: params.photoType || 'reference',
      userRole: activeUser?.role || '',
      userId: activeUser?.id || '',
    });
    const res = await fetch(`/api/photos/room/${encodeURIComponent(params.category)}?${queryParams.toString()}`, {
      method: 'DELETE',
      headers: getAuthHeaders(activeUser),
      body: JSON.stringify({
        photoType: params.photoType || 'reference',
        userRole: activeUser?.role,
        userId: activeUser?.id,
      }),
    });

    if (res.status === 403) {
      throw new Error('Access Denied: Only Admin can delete reference photos.');
    }

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.error || `Failed to delete photo: ${res.statusText}`);
    }

    return await res.json();
  },

  /**
   * SYNTHESIZE SPEECH: Calls backend Gemini 3.8 TTS to produce real audio.
   */
  async synthesizeSpeech(
    text: string,
    lang = 'hi',
    voiceName?: string
  ): Promise<{ audio: string; mimeType: string; sampleRate: number; isFallback?: boolean; text?: string }> {
    const res = await fetch('/api/ai/synthesize-speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, lang, voiceName }),
    });

    if (!res.ok) {
      throw new Error(`Failed to synthesize speech: ${res.statusText}`);
    }

    const data = await res.json();
    return data;
  },

  /**
   * PANTRY BOY TASK COMPLETION: Submit completion proof with multiple photos.
   * Stored in /data/uploads/completion/ with exact timestamp, user identity, and 40-day retention.
   */
  async completeTaskWithPhotos(params: {
    taskId: string;
    taskTitle: string;
    roomName: string;
    user?: User | null;
    notes?: string;
    beforePhotoBase64?: string;
    completionPhotos: Array<{ photoBase64: string; angleLabel?: string; caption?: string }>;
  }): Promise<{
    success: boolean;
    message: string;
    task: DailyTask;
    proofPhotos: CompletionPhotoItem[];
    uploadedAt: string;
    expiresAt: string;
    retentionDays: number;
  }> {
    const res = await fetch(`/api/tasks/${encodeURIComponent(params.taskId)}/complete`, {
      method: 'POST',
      headers: getAuthHeaders(params.user),
      body: JSON.stringify({
        pantryBoyId: params.user?.id || 'pantry_user',
        pantryBoyName: params.user?.name || 'Pantry Boy',
        taskTitle: params.taskTitle,
        roomName: params.roomName,
        notes: params.notes,
        beforePhotoBase64: params.beforePhotoBase64,
        completionPhotos: params.completionPhotos,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to complete task with proof photos');
    }

    const data = await res.json();

    // Sync task proof photos to Firebase Firestore + Storage if signed in
    if (CloudPhotoService.getCurrentFirebaseUser() && Array.isArray(data.proofPhotos)) {
      await Promise.all(
        data.proofPhotos.map((proof: CompletionPhotoItem, idx: number) =>
          CloudPhotoService.uploadTaskProof({
            proofId: proof.id,
            taskId: params.taskId,
            taskTitle: params.taskTitle,
            roomId: params.roomName,
            roomName: params.roomName,
            employeeId: params.user?.id || 'pantry_user',
            employeeName: params.user?.name || 'Pantry Boy',
            fileName: proof.fileName || `${proof.id}.jpg`,
            dataUrl: params.completionPhotos[idx]?.photoBase64 || proof.url,
            url: proof.url,
            angleLabel: proof.angleLabel,
            caption: proof.caption,
            uploadedAt: proof.uploadedAt || new Date().toISOString(),
            markPreviousNonLatest: idx === 0,
          }).catch((err) => console.warn('Cloud sync warning (task proof):', err))
        )
      );
    }

    return data;
  },

  /**
   * QUERY ALL ACTIVE COMPLETION PHOTOS (Subject to 40-day retention)
   */
  async getCompletionPhotos(params?: {
    taskId?: string;
    pantryBoyId?: string;
    roomName?: string;
  }): Promise<CompletionPhotoItem[]> {
    try {
      const query = new URLSearchParams();
      if (params?.taskId) query.set('taskId', params.taskId);
      if (params?.pantryBoyId) query.set('pantryBoyId', params.pantryBoyId);
      if (params?.roomName) query.set('roomName', params.roomName);

      const res = await fetch(`/api/completion-photos?${query.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch completion photos');
      const data = await res.json();
      return data.photos || [];
    } catch (err) {
      console.warn('Error fetching completion photos:', err);
      return [];
    }
  },

  /**
   * GET 40-DAY RETENTION AUDIT STATUS (For Admin inspection)
   */
  async getRetentionStatus(): Promise<{
    success: boolean;
    retentionPolicyDays: number;
    totalDatabaseRecords: number;
    diskFilesCount: number;
    diskUsageFormatted: string;
    storageDirectory: string;
    referenceStorageDirectory: string;
    nextExpiringPhoto?: any;
    serverTime: string;
  }> {
    const res = await fetch('/api/completion-photos/retention-status');
    if (!res.ok) throw new Error('Failed to fetch retention status');
    return await res.json();
  },

  /**
   * ADMIN ONLY: Trigger immediate manual cleanup of expired photos
   */
  async triggerManualCleanup(user?: User | null): Promise<{
    success: boolean;
    message: string;
    result: { deletedCount: number; remainingCount: number; deletedFiles: string[] };
  }> {
    const res = await fetch('/api/completion-photos/cleanup', {
      method: 'POST',
      headers: getAuthHeaders(user),
      body: JSON.stringify({
        userRole: user?.role,
        userId: user?.id,
      }),
    });

    if (res.status === 403) {
      throw new Error('Access Denied: Only Admin can trigger manual photo cleanup.');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Cleanup failed');
    }

    return await res.json();
  },

  /**
   * FETCH PERSISTENT TASKS FROM SERVER
   */
  async getTasks(): Promise<DailyTask[]> {
    try {
      const res = await fetch('/api/tasks');
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      return data.tasks || [];
    } catch (err) {
      console.warn('Error fetching tasks from server:', err);
      return [];
    }
  },

  /**
   * UPDATE PERSISTENT TASK ON SERVER
   */
  async updateTask(task: DailyTask): Promise<DailyTask> {
    const res = await fetch(`/api/tasks/${encodeURIComponent(task.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    if (!res.ok) throw new Error('Failed to update task');
    const data = await res.json();
    return data.task;
  },

  /**
   * DELETE A TASK COMPLETION PHOTO (Permanently unlinks from disk and updates DB)
   */
  async deleteCompletionPhoto(params: {
    photoId: string;
    taskId?: string;
    user?: User | null;
  }): Promise<{ success: boolean; message: string; task?: DailyTask; tasks?: DailyTask[] }> {
    let activeUser = params.user;
    if (!activeUser && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('office_train_current_user_v4');
        if (stored) activeUser = JSON.parse(stored);
      } catch {}
    }
    const queryParams = new URLSearchParams({
      taskId: params.taskId || '',
      userId: activeUser?.id || '',
      userRole: activeUser?.role || '',
    });
    const res = await fetch(`/api/completion-photos/${encodeURIComponent(params.photoId)}?${queryParams.toString()}`, {
      method: 'DELETE',
      headers: getAuthHeaders(activeUser),
      body: JSON.stringify({
        taskId: params.taskId,
        userId: activeUser?.id,
        userRole: activeUser?.role,
      }),
    });

    if (res.status === 403) {
      throw new Error('Access Denied: You do not have permission to delete this completion photo.');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete completion photo');
    }

    return await res.json();
  },

  /**
   * DELETE ALL PROOF PHOTOS FROM A TASK
   */
  async deleteTaskProofPhotos(params: {
    taskId: string;
    user?: User | null;
  }): Promise<{ success: boolean; message: string; task: DailyTask }> {
    let activeUser = params.user;
    if (!activeUser && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('office_train_current_user_v4');
        if (stored) activeUser = JSON.parse(stored);
      } catch {}
    }
    const queryParams = new URLSearchParams({
      userId: activeUser?.id || '',
      userRole: activeUser?.role || '',
    });
    const res = await fetch(`/api/tasks/${encodeURIComponent(params.taskId)}/proof-photo?${queryParams.toString()}`, {
      method: 'DELETE',
      headers: getAuthHeaders(activeUser),
      body: JSON.stringify({
        userId: activeUser?.id,
        userRole: activeUser?.role,
      }),
    });

    if (res.status === 403) {
      throw new Error('Access Denied: You do not have permission to delete photos from this task.');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete task proof photos');
    }

    return await res.json();
  },

  /**
   * DATE-WISE ROOM REFERENCE PHOTO HISTORY
   */
  async getRoomPhotoHistory(params: {
    roomId?: string;
    filter?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ success: boolean; photos: RoomPhotoItem[]; totalCount: number }> {
    const qs = new URLSearchParams();
    if (params.roomId) qs.set('roomId', params.roomId);
    if (params.filter) qs.set('filter', params.filter);
    if (params.startDate) qs.set('startDate', params.startDate);
    if (params.endDate) qs.set('endDate', params.endDate);

    const res = await fetch(`/api/photos/history?${qs.toString()}`, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error('Failed to fetch room photo history');
    }
    const data = await res.json();
    const cloudPhotos = await CloudPhotoService.listRoomPhotos(
      params.roomId && params.roomId !== 'all' ? params.roomId : undefined
    );
    if (cloudPhotos.length > 0) {
      const existingIds = new Set((data.photos || []).map((p: RoomPhotoItem) => p.id));
      const merged = [...(data.photos || [])];
      cloudPhotos.forEach((cp) => {
        if (!existingIds.has(cp.id)) merged.push(cp);
      });
      merged.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      return { success: true, photos: merged, totalCount: merged.length };
    }
    return data;
  },

  /**
   * DATE-WISE TASK PROOF PHOTO HISTORY
   */
  async getTaskProofHistory(params: {
    taskId?: string;
    roomName?: string;
    filter?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ success: boolean; photos: CompletionPhotoItem[]; totalCount: number }> {
    const qs = new URLSearchParams();
    if (params.taskId) qs.set('taskId', params.taskId);
    if (params.roomName) qs.set('roomName', params.roomName);
    if (params.filter) qs.set('filter', params.filter);
    if (params.startDate) qs.set('startDate', params.startDate);
    if (params.endDate) qs.set('endDate', params.endDate);

    const res = await fetch(`/api/completion-photos?${qs.toString()}`, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error('Failed to fetch task proof history');
    }
    const data = await res.json();
    const cloudProofs = await CloudPhotoService.listTaskProofs(
      params.taskId && params.taskId !== 'all' ? params.taskId : undefined
    );
    if (cloudProofs.length > 0) {
      const existingIds = new Set((data.photos || []).map((p: CompletionPhotoItem) => p.id));
      const merged = [...(data.photos || [])];
      cloudProofs.forEach((cp) => {
        if (!existingIds.has(cp.id)) merged.push(cp);
      });
      merged.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      return { success: true, photos: merged, totalCount: merged.length };
    }
    return data;
  },

  /**
   * ADMIN DELETION AUDIT LOGS
   */
  async getDeletionAuditLogs(user?: User | null): Promise<DeletionAuditLog[]> {
    const res = await fetch('/api/audit/deletions', {
      headers: getAuthHeaders(user),
      cache: 'no-store',
    });
    const serverLogs: DeletionAuditLog[] = res.ok ? (await res.json()).logs || [] : [];
    const cloudLogs = await CloudPhotoService.listDeletionAuditLogs();
    if (cloudLogs.length > 0) {
      const seen = new Set(serverLogs.map((l) => l.id));
      const merged = [...serverLogs];
      cloudLogs.forEach((cl) => {
        if (!seen.has(cl.id)) merged.push(cl);
      });
      merged.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
      return merged;
    }
    return serverLogs;
  },
};



