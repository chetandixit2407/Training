import {
  TrainingKnowledgeRecord,
  TrainingInstructionVersion,
  User,
  RoomPhotoItem,
  AIRoomAnalysis,
  CompletionPhotoItem,
  DailyTask,
} from '../types';

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
      const res = await fetch('/api/training/knowledge');
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
      const res = await fetch('/api/photos/all-rooms');
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
      const res = await fetch(`/api/photos/room/${encodeURIComponent(category)}`);
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

    return await res.json();
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
    captionHi?: string;
    captionEn?: string;
    user?: User | null;
  }): Promise<{ success: boolean; photos: RoomPhotoItem[] }> {
    const res = await fetch(`/api/photos/room/${encodeURIComponent(params.category)}/item/${encodeURIComponent(params.photoId)}/replace`, {
      method: 'POST',
      headers: getAuthHeaders(params.user),
      body: JSON.stringify({
        photoBase64: params.photoBase64,
        captionHi: params.captionHi,
        captionEn: params.captionEn,
        adminName: params.user?.name || 'Admin',
        userRole: params.user?.role,
        userId: params.user?.id,
      }),
    });

    if (res.status === 403) {
      throw new Error('Access Denied: Only Admin can replace photos.');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to replace photo');
    }

    return await res.json();
  },

  /**
   * ADMIN ONLY: Delete an individual photo from a room gallery
   */
  async deleteRoomPhotoItem(
    category: string,
    photoId: string,
    user?: User | null
  ): Promise<{ success: boolean; photos: RoomPhotoItem[]; message: string }> {
    let activeUser = user;
    if (!activeUser && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('office_train_current_user_v4');
        if (stored) activeUser = JSON.parse(stored);
      } catch {}
    }
    const queryParams = new URLSearchParams({
      userRole: activeUser?.role || '',
      userId: activeUser?.id || '',
    });
    const res = await fetch(`/api/photos/room/${encodeURIComponent(category)}/item/${encodeURIComponent(photoId)}?${queryParams.toString()}`, {
      method: 'DELETE',
      headers: getAuthHeaders(activeUser),
      body: JSON.stringify({
        userRole: activeUser?.role,
        userId: activeUser?.id,
      }),
    });

    if (res.status === 403) {
      throw new Error('Access Denied: Only Admin can delete photos.');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete photo');
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

    return await res.json();
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
};



