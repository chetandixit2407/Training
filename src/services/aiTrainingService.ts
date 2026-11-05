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
   * CONVERSATIONAL AI ASSISTANT: Ask questions grounded in approved office knowledge.
   * Open to both Pantry Boys and Admins.
   */
  async chatWithAssistant(params: {
    messages: AIMessage[];
    currentLanguage?: string;
    user?: User | null;
    currentRoomHint?: string;
  }): Promise<{
    replyText: string;
    audioSpokenText: string;
    languageDetected: 'hi' | 'hinglish' | 'en';
    referencedRooms: string[];
    followUpSuggestions: string[];
  }> {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: params.messages,
        currentLanguage: params.currentLanguage || 'hi',
        userRole: params.user?.role || 'pantry_boy',
        pantryBoyName: params.user?.name || 'भैया',
        currentRoomHint: params.currentRoomHint,
      }),
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.error || `AI Assistant chat failed: ${res.statusText}`);
    }

    const json = await res.json();
    return json.data;
  },

  /**
   * SYNTHESIZE SPEECH: Calls backend Gemini 3.8 TTS to produce real audio.
   */
  async synthesizeSpeech(
    text: string,
    lang = 'hi',
    voiceName?: string
  ): Promise<{ audio: string; mimeType: string; sampleRate: number }> {
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
   * REAL-TIME STREAMING: Streams conversational AI reply tokens chunk-by-chunk for sub-second voice latency.
   * Calls onChunk(chunkText) as words arrive, onAudioChunk(audioData) as Gemini audio arrives, and onDone(fullText) when complete.
   * Supports AbortSignal for instantaneous barge-in interruptions!
   */
  async streamChatWithAssistant(params: {
    messages: AIMessage[];
    user?: User | null;
    signal?: AbortSignal;
    onChunk: (chunk: string) => void;
    onAudioChunk?: (chunk: { audio: string; mimeType: string; sampleRate: number; sentence?: string }) => void;
    onDone: (fullText: string) => void;
    onError?: (err: Error) => void;
  }): Promise<void> {
    try {
      const res = await fetch('/api/ai/chat-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: params.messages,
          userRole: params.user?.role || 'pantry_boy',
          pantryBoyName: params.user?.name || 'भैया',
        }),
        signal: params.signal,
      });

      if (!res.ok) {
        throw new Error(`Streaming failed: ${res.statusText}`);
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error('ReadableStream not supported on response.');
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.replace('data: ', '').trim();
          if (dataStr === '[DONE]') {
            params.onDone(fullText);
            return;
          }
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.type === 'audio' && parsed.audio) {
              if (params.onAudioChunk) {
                params.onAudioChunk({
                  audio: parsed.audio,
                  mimeType: parsed.mimeType || 'audio/wav',
                  sampleRate: parsed.sampleRate || 24000,
                  sentence: parsed.sentence,
                });
              }
            } else if (parsed.text) {
              fullText += parsed.text;
              params.onChunk(parsed.text);
            }
          } catch (e) {
            // ignore non-json tick
          }
        }
      }

      params.onDone(fullText);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User barged in and interrupted; cleanly exit
        return;
      }
      if (params.onError) {
        params.onError(err);
      } else {
        console.error('Error streaming chat:', err);
      }
    }
  },
};

