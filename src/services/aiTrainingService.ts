import {
  TrainingKnowledgeRecord,
  TrainingInstructionVersion,
  AIAnalysisResult,
  AIMessage,
  User,
} from '../types';

/**
 * Service to interact with the backend Gemini-powered AI Training and Knowledge endpoints.
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
   * ADMIN ONLY: Analyze an uploaded reference photograph using Gemini 3.8 Flash Vision.
   * Generates step-by-step instructions, cleaning procedures, quality standards, and voice scripts.
   */
  async analyzeReferencePhoto(params: {
    photoBase64: string;
    mimeType?: string;
    category: string;
    roomName: string;
    adminPrompt?: string;
    user?: User | null;
  }): Promise<AIAnalysisResult> {
    const res = await fetch('/api/ai/analyze-photo', {
      method: 'POST',
      headers: getAuthHeaders(params.user),
      body: JSON.stringify({
        photoBase64: params.photoBase64,
        mimeType: params.mimeType || 'image/jpeg',
        category: params.category,
        roomName: params.roomName,
        adminPrompt: params.adminPrompt,
        userRole: params.user?.role,
        userId: params.user?.id,
      }),
    });

    if (res.status === 403) {
      throw new Error('Access Denied: Only authenticated Admin accounts can analyze reference photos and generate training.');
    }

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.error || `Vision analysis failed: ${res.statusText}`);
    }

    const json = await res.json();
    return json.data;
  },

  /**
   * ADMIN ONLY: Convert spoken natural instructions into structured training rules.
   */
  async learnFromVoiceInstruction(params: {
    spokenText: string;
    categoryHint?: string;
    user?: User | null;
  }): Promise<{ data: AIAnalysisResult; originalSpeech: string }> {
    const res = await fetch('/api/ai/voice-instruction', {
      method: 'POST',
      headers: getAuthHeaders(params.user),
      body: JSON.stringify({
        spokenText: params.spokenText,
        categoryHint: params.categoryHint,
        userRole: params.user?.role,
        userId: params.user?.id,
      }),
    });

    if (res.status === 403) {
      throw new Error('Access Denied: Only Admin can update training via voice instructions.');
    }

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.error || `Voice interpretation failed: ${res.statusText}`);
    }

    const json = await res.json();
    return json;
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

