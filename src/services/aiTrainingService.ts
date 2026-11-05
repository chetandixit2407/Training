import {
  TrainingKnowledgeRecord,
  TrainingInstructionVersion,
  User,
  RoomPhotoItem,
  AIRoomAnalysis,
} from '../types';

/**
 * Service to interact with the backend Training and Knowledge endpoints.
 * Enforces admin authorization headers ('x-user-id' and 'x-user-role') on mutation endpoints.
 */

function getAuthHeaders(user?: User | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (user) {
    headers['x-user-id'] = user.id;
    headers['x-user-role'] = user.role;
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
  ): Promise<{ success: boolean; photos: RoomPhotoItem[] }> {
    const res = await fetch(`/api/photos/room/${encodeURIComponent(category)}/item/${encodeURIComponent(photoId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(user),
      body: JSON.stringify({
        userRole: user?.role,
        userId: user?.id,
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
  }): Promise<void> {
    const res = await fetch(`/api/photos/room/${encodeURIComponent(params.category)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(params.user),
      body: JSON.stringify({
        photoType: params.photoType || 'reference',
        userRole: params.user?.role,
        userId: params.user?.id,
      }),
    });

    if (res.status === 403) {
      throw new Error('Access Denied: Only Admin can delete reference photos.');
    }

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.error || `Failed to delete photo: ${res.statusText}`);
    }
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
};



