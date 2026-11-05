import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Language,
  RoomCategory,
  TrainingKnowledgeRecord,
  AIAnalysisResult,
  TrainingInstructionStep,
  TrainingInstructionVersion,
} from '../types';
import { AITrainingService } from '../services/aiTrainingService';
import { fileToDataUrl } from '../services/storageService';
import { speechService } from '../services/speechService';
import {
  Sparkles,
  Camera,
  Upload,
  Mic,
  MicOff,
  CheckCircle2,
  AlertCircle,
  History,
  RotateCcw,
  Edit3,
  Trash2,
  Volume2,
  Save,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowRight,
  ShieldAlert,
  Plus,
  RefreshCw,
  FileCheck,
} from 'lucide-react';

interface AdminTrainingKnowledgeProps {
  currentUser: User | null;
  language: Language;
  onRefreshData?: () => void;
}

export const AdminTrainingKnowledge: React.FC<AdminTrainingKnowledgeProps> = ({
  currentUser,
  language,
  onRefreshData,
}) => {
  // Guard: Admin role only (Requirement 4)
  const isAdmin = currentUser?.role === 'admin';

  const [approvedRecords, setApprovedRecords] = useState<TrainingKnowledgeRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<TrainingInstructionVersion[]>([]);
  const [isVersionDrawerOpen, setIsVersionDrawerOpen] = useState(false);

  // Mode: 'analyze_photo' | 'voice_learn' | 'manage_library'
  const [activeTab, setActiveTab] = useState<'analyze_photo' | 'voice_learn' | 'manage_library'>('analyze_photo');

  // Photo Analysis State
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<RoomCategory>('reception');
  const [selectedRoomName, setSelectedRoomName] = useState<string>('RECEPTION AREA');
  const [adminCustomPrompt, setAdminCustomPrompt] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);

  // Editable Form for Generated or Selected Instruction
  const [editTitleHi, setEditTitleHi] = useState('');
  const [editTitleEn, setEditTitleEn] = useState('');
  const [editSummaryHi, setEditSummaryHi] = useState('');
  const [editSteps, setEditSteps] = useState<TrainingInstructionStep[]>([]);
  const [editCleaningHi, setEditCleaningHi] = useState('');
  const [editExpectedResultsHi, setEditExpectedResultsHi] = useState('');
  const [editQualityStandardsHi, setEditQualityStandardsHi] = useState<string[]>([]);
  const [editMistakesToAvoidHi, setEditMistakesToAvoidHi] = useState<string[]>([]);
  const [editVoiceScriptHi, setEditVoiceScriptHi] = useState('');
  const [changeNote, setChangeNote] = useState('AI Vision analysis approved by Admin');

  // Spoken Voice Instruction State (Requirement 3)
  const [spokenInput, setSpokenInput] = useState('');
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isInterpretingVoice, setIsInterpretingVoice] = useState(false);

  // Feedback notifications
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const voiceRecognitionRef = useRef<any>(null);

  // Office Room options
  const roomOptions: { category: RoomCategory; nameHi: string; nameEn: string }[] = [
    { category: 'reception', nameHi: 'RECEPTION AREA', nameEn: 'RECEPTION AREA' },
    { category: 'lalit_sir_cabin', nameHi: 'LALIT SIR CABIN', nameEn: 'LALIT SIR CABIN' },
    { category: 'prestige_loft', nameHi: 'PRESTIGE LOFT (WAITING AREA)', nameEn: 'PRESTIGE LOFT' },
    { category: 'the_skyline', nameHi: 'THE SKYLINE (4 कुर्सियां, 1 टेबल)', nameEn: 'THE SKYLINE' },
    { category: 'the_community', nameHi: 'THE COMMUNITY (10 कुर्सियां, 1 बड़ी टेबल)', nameEn: 'THE COMMUNITY' },
    { category: 'the_summit', nameHi: 'THE SUMMIT (4 कुर्सियां, 1 टेबल)', nameEn: 'THE SUMMIT' },
    { category: 'wcr_air', nameHi: 'WCR AIR (2 सोफे, 1 टेबल)', nameEn: 'WCR AIR' },
    { category: 'elegance_suite', nameHi: 'ELEGANCE SUITE (3 कुर्सियां, 1 टेबल)', nameEn: 'ELEGANCE SUITE' },
    { category: 'prime_loft', nameHi: 'PRIME LOFT (3 कुर्सियां, 1 टेबल)', nameEn: 'PRIME LOFT' },
    { category: 'regency', nameHi: 'REGENCY (3 कुर्सियां, 1 टेबल)', nameEn: 'REGENCY' },
    { category: 'pantry', nameHi: 'PANTRY SETUP', nameEn: 'PANTRY SETUP' },
    { category: 'lights_equipment', nameHi: 'LIGHTS, SWITCHES & EQUIPMENT', nameEn: 'LIGHTS & EQUIPMENT' },
  ];

  // Load approved knowledge from server on mount
  const loadApprovedKnowledge = async () => {
    try {
      const records = await AITrainingService.getApprovedKnowledge();
      setApprovedRecords(records);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadApprovedKnowledge();
  }, []);

  // Initialize Web Speech for Admin Voice Instruction Learning
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'hi-IN';

        recognition.onstart = () => {
          setIsVoiceRecording(true);
          setErrorMessage(null);
        };

        recognition.onresult = (event: any) => {
          let text = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            text += event.results[i][0].transcript;
          }
          setSpokenInput(text);
        };

        recognition.onerror = (e: any) => {
          console.warn('Voice error:', e);
          setIsVoiceRecording(false);
        };

        recognition.onend = () => {
          setIsVoiceRecording(false);
        };

        voiceRecognitionRef.current = recognition;
      }
    }
  }, []);

  const handleStartVoiceRecording = () => {
    speechService.stop();
    if (voiceRecognitionRef.current) {
      try {
        voiceRecognitionRef.current.start();
      } catch (e) {
        console.warn(e);
      }
    }
  };

  const handleStopVoiceRecording = () => {
    if (voiceRecognitionRef.current) {
      voiceRecognitionRef.current.stop();
    }
    setIsVoiceRecording(false);
  };

  // Upload and handle image file
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await fileToDataUrl(file, 1400);
      setUploadedPhotoUrl(dataUrl);
      setErrorMessage(null);

      // Save permanently to server backend disk storage
      const res = await AITrainingService.uploadReferencePhoto({
        photoBase64: dataUrl,
        category: selectedCategory,
        roomName: selectedRoomName,
        user: currentUser,
      });
      if (res && res.photoUrl) {
        setUploadedPhotoUrl(res.photoUrl);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process selected image file.');
    }
  };


  // Run Gemini Multimodal Vision Analysis (Requirement 1)
  const handleRunVisionAnalysis = async () => {
    if (!uploadedPhotoUrl) {
      setErrorMessage(
        language === 'hi'
          ? 'कृपया पहले एक रेफरेंस फोटो अपलोड करें।'
          : 'Please upload a reference photograph first.'
      );
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await AITrainingService.analyzeReferencePhoto({
        photoBase64: uploadedPhotoUrl,
        category: selectedCategory,
        roomName: selectedRoomName,
        adminPrompt: adminCustomPrompt,
        user: currentUser,
      });

      setAnalysisResult(result);

      // Populate live editor fields so Admin can inspect, edit, or approve
      setEditTitleHi(result.titleHi || `${selectedRoomName} मानक`);
      setEditTitleEn(result.titleEn || `${selectedRoomName} Standard`);
      setEditSummaryHi(result.summaryHi || '');
      setEditSteps(result.steps || []);
      setEditCleaningHi(result.cleaningProcedureHi || '');
      setEditExpectedResultsHi(result.expectedResultsHi || '');
      setEditQualityStandardsHi(result.qualityStandardsHi || []);
      setEditMistakesToAvoidHi(result.mistakesToAvoidHi || []);
      setEditVoiceScriptHi(result.voiceScriptHi || '');
      setChangeNote('AI Vision analysis approved by Admin');

      setSuccessMessage(
        language === 'hi'
          ? 'रेफरेंस फोटो का AI विश्लेषण पूरा हुआ! नीचे दिए गए नियमों को चेक करें और स्वीकृत करें।'
          : 'AI Vision analysis complete! Review instructions below and click Approve & Save.'
      );
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'AI Vision analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Convert Spoken Voice into Structured Training (Requirement 3)
  const handleInterpretSpokenVoice = async () => {
    if (!spokenInput.trim()) {
      setErrorMessage(
        language === 'hi'
          ? 'कृपया पहले अपनी हिदायत बोलें या लिखें।'
          : 'Please speak or enter instruction text first.'
      );
      return;
    }

    setIsInterpretingVoice(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await AITrainingService.learnFromVoiceInstruction({
        spokenText: spokenInput,
        categoryHint: selectedCategory,
        user: currentUser,
      });

      const structured = result.data;
      setAnalysisResult(structured);

      // Auto-update selected category if AI detected a better match
      if (structured.category) {
        setSelectedCategory(structured.category as RoomCategory);
        const match = roomOptions.find((r) => r.category === structured.category);
        if (match) {
          setSelectedRoomName(match.nameHi);
        }
      }

      setEditTitleHi(structured.titleHi);
      setEditTitleEn(structured.titleEn);
      setEditSummaryHi(structured.summaryHi);
      setEditSteps(structured.steps || []);
      setEditCleaningHi(structured.cleaningProcedureHi || '');
      setEditExpectedResultsHi(structured.expectedResultsHi || '');
      setEditQualityStandardsHi(structured.qualityStandardsHi || []);
      setEditMistakesToAvoidHi(structured.mistakesToAvoidHi || []);
      setEditVoiceScriptHi(structured.voiceScriptHi || '');
      setChangeNote(`Voice instruction learned: "${spokenInput.slice(0, 60)}..."`);

      setSuccessMessage(
        language === 'hi'
          ? 'आपकी बोली हुई हिदायत को AI ने ट्रेनिंग नियमों में बदल दिया है! नीचे चेक करें और सेव करें।'
          : 'Voice instruction structured successfully! Review below and click Approve & Save.'
      );
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Voice interpretation failed.');
    } finally {
      setIsInterpretingVoice(false);
    }
  };

  // Approve & Save Training Instruction (Requirement 1 & 4)
  const handleApproveAndSave = async () => {
    if (!editTitleHi.trim()) {
      setErrorMessage('Title is required.');
      return;
    }

    const photoToSave =
      uploadedPhotoUrl ||
      approvedRecords.find((r) => r.category === selectedCategory)?.referencePhotoUrl ||
      '/src/assets/images/office_reception_lounge_1793614168526.jpg';

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const approved = await AITrainingService.approveTrainingKnowledge(
        {
          id: `knowledge-${selectedCategory}`,
          category: selectedCategory,
          roomNameHi: selectedRoomName,
          roomNameEn: selectedRoomName,
          referencePhotoUrl: photoToSave,
          titleHi: editTitleHi.trim(),
          titleEn: editTitleEn.trim() || editTitleHi.trim(),
          summaryHi: editSummaryHi.trim(),
          summaryEn: editSummaryHi.trim(),
          steps: editSteps,
          cleaningProcedureHi: editCleaningHi.trim(),
          cleaningProcedureEn: editCleaningHi.trim(),
          expectedResultsHi: editExpectedResultsHi.trim(),
          expectedResultsEn: editExpectedResultsHi.trim(),
          qualityStandardsHi: editQualityStandardsHi,
          qualityStandardsEn: editQualityStandardsHi,
          mistakesToAvoidHi: editMistakesToAvoidHi,
          mistakesToAvoidEn: editMistakesToAvoidHi,
          voiceScriptHi: editVoiceScriptHi.trim(),
          voiceScriptEn: editVoiceScriptHi.trim(),
          changeNote: changeNote || 'Updated by Admin',
          adminName: currentUser?.name || 'Admin (Office Manager)',
        },
        currentUser
      );

      setSuccessMessage(
        language === 'hi'
          ? `नियम सफलतापूर्वक स्वीकृत व सेव हो गए! (संस्करण v${approved.currentVersion}) पैंट्री बॉय अब इसे तुरंत सुन व देख सकते हैं।`
          : `Training instructions approved & saved! (Version v${approved.currentVersion}). Immediately live for Pantry Boys.`
      );

      await loadApprovedKnowledge();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to approve training.');
    } finally {
      setIsSaving(false);
    }
  };

  // Load an existing record into the editor
  const handleSelectRecordForInspection = (rec: TrainingKnowledgeRecord) => {
    setSelectedRecordId(rec.id);
    setSelectedCategory(rec.category);
    setSelectedRoomName(rec.roomNameHi);
    setUploadedPhotoUrl(rec.referencePhotoUrl || '');
    setEditTitleHi(rec.titleHi);
    setEditTitleEn(rec.titleEn);
    setEditSummaryHi(rec.summaryHi);
    setEditSteps(rec.steps || []);
    setEditCleaningHi(rec.cleaningProcedureHi || '');
    setEditExpectedResultsHi(rec.expectedResultsHi || '');
    setEditQualityStandardsHi(rec.qualityStandardsHi || []);
    setEditMistakesToAvoidHi(rec.mistakesToAvoidHi || []);
    setEditVoiceScriptHi(rec.voiceScriptHi || '');
    setChangeNote(`Revision on Version ${rec.currentVersion}`);
    setSelectedVersions(rec.versions || []);
  };

  // View Version History Drawer
  const handleOpenVersionHistory = async (record: TrainingKnowledgeRecord) => {
    setSelectedRecordId(record.id);
    try {
      const versions = await AITrainingService.getKnowledgeVersions(record.id);
      setSelectedVersions(versions);
      setIsVersionDrawerOpen(true);
    } catch (e) {
      console.warn(e);
    }
  };

  // 1-Click Revert to previous version
  const handleRevertToVersion = async (targetVer: number) => {
    if (!selectedRecordId) return;

    if (
      !window.confirm(
        language === 'hi'
          ? `क्या आप वास्तव में संस्करण ${targetVer} पर वापस जाना चाहते हैं?`
          : `Revert to Version ${targetVer}?`
      )
    ) {
      return;
    }

    try {
      const reverted = await AITrainingService.revertKnowledgeVersion(
        selectedRecordId,
        targetVer,
        currentUser
      );
      setSuccessMessage(
        language === 'hi'
          ? `सफलतापूर्वक संस्करण ${targetVer} की हिदायतों पर रीस्टोर किया गया!`
          : `Successfully reverted to Version ${targetVer}!`
      );
      handleSelectRecordForInspection(reverted);
      await loadApprovedKnowledge();
      setIsVersionDrawerOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Revert failed');
    }
  };

  // If not admin, show permission denied banner
  if (!isAdmin) {
    return (
      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 text-center max-w-lg mx-auto my-8 shadow-sm">
        <ShieldAlert className="w-12 h-12 text-amber-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-amber-900 mb-1">
          {language === 'hi' ? 'केवल एडमिन अधिकार (Admin Only)' : 'Admin Authorization Required'}
        </h3>
        <p className="text-sm text-amber-800 leading-relaxed mb-4">
          {language === 'hi'
            ? 'रेफरेंस फोटो अपलोड करने, AI विज़न विश्लेषण चलाने और ट्रेनिंग नियमों को स्वीकृत करने का अधिकार केवल एडमिन के पास है।'
            : 'Uploading reference photos, AI vision analysis, and approving training knowledge is restricted to Admin.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-16">
      
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-6 shadow-md border border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-bold shadow-sm">
              <Sparkles className="w-7 h-7 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
                  {language === 'hi'
                    ? 'AI विज़न रेफरेंस फोटो व ट्रेनिंग हब'
                    : 'AI Vision Reference Photo & Training Hub'}
                </h2>
                <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                  Admin Only
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                {language === 'hi'
                  ? 'फोटो अपलोड करें $\\rightarrow$ AI से तुरंत नियम बनाएं $\\rightarrow$ जांचकर 1-क्लिक में स्वीकृत करें'
                  : 'Upload reference photo $\\rightarrow$ AI auto-generates rules $\\rightarrow$ 1-click Approve with version history'}
              </p>
            </div>
          </div>

          {/* Sub Navigation */}
          <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('analyze_photo')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'analyze_photo'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {language === 'hi' ? '📸 फोटो विज़न AI' : '📸 Photo Vision AI'}
            </button>
            <button
              onClick={() => setActiveTab('voice_learn')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'voice_learn'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {language === 'hi' ? '🎙️ बोलकर सिखाएं' : '🎙️ Voice Learning'}
            </button>
            <button
              onClick={() => setActiveTab('manage_library')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'manage_library'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {language === 'hi' ? '📚 स्वीकृत लाइब्रेरी' : '📚 Approved Library'}
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-300 text-red-900 px-4 py-3 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-700 hover:text-red-900 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: PHOTO VISION AI TRAINING */}
      {activeTab === 'analyze_photo' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Left Column: Photo Upload & Trigger */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-600" />
                <span>{language === 'hi' ? '1. रेफरेंस फोटो अपलोड करें' : '1. Upload Reference Photo'}</span>
              </h3>

              {/* Room Selector */}
              <div className="mb-3.5">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'hi' ? 'संबंधित कमरा / एरिया चुनें:' : 'Select Target Room / Area:'}
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    const cat = e.target.value as RoomCategory;
                    setSelectedCategory(cat);
                    const match = roomOptions.find((r) => r.category === cat);
                    if (match) setSelectedRoomName(match.nameHi);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {roomOptions.map((opt) => (
                    <option key={opt.category} value={opt.category}>
                      {language === 'hi' ? opt.nameHi : opt.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Photo Upload Zone */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[160px] ${
                  uploadedPhotoUrl
                    ? 'border-amber-400 bg-amber-50/30'
                    : 'border-slate-300 hover:border-amber-500 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                {uploadedPhotoUrl ? (
                  <div className="relative w-full">
                    <img
                      src={uploadedPhotoUrl}
                      alt="Uploaded Reference"
                      className="w-full max-h-56 object-cover rounded-lg shadow-xs"
                    />
                    <div className="absolute inset-0 bg-black/40 hover:bg-black/50 rounded-lg flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity text-white text-xs font-bold gap-1.5">
                      <Upload className="w-4 h-4" />
                      <span>{language === 'hi' ? 'फोटो बदलें' : 'Change Photo'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                      <Upload className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-slate-700">
                      {language === 'hi' ? 'ऑफिस की वास्तविक फोटो चुनें' : 'Select Actual Office Photo'}
                    </span>
                    <span className="text-[11px] text-slate-400">JPG, PNG, WebP (Max 15MB)</span>
                  </div>
                )}
              </div>

              {/* Optional Admin Note for AI */}
              <div className="mt-3.5">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'hi' ? 'एडमिन विशेष निर्देश (वैकल्पिक):' : 'Admin Special Note (Optional):'}
                </label>
                <input
                  type="text"
                  value={adminCustomPrompt}
                  onChange={(e) => setAdminCustomPrompt(e.target.value)}
                  placeholder={
                    language === 'hi'
                      ? 'उदा. लेदर कोस्टर पर पानी रखने का नियम ज़रूर जोड़ें'
                      : 'e.g., Emphasize tucking chairs parallel under table'
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Big AI Analyze Button */}
              <button
                type="button"
                onClick={handleRunVisionAnalysis}
                disabled={!uploadedPhotoUrl || isAnalyzing}
                className="w-full mt-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-extrabold text-sm py-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin text-slate-950" />
                    <span>{language === 'hi' ? 'AI फोटो का विश्लेषण कर रहा है...' : 'AI Vision is analyzing photo...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-slate-950" />
                    <span>{language === 'hi' ? 'AI Vision से नियम बनाएं' : 'Generate Training Rules via AI'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Editable Preview & Approval */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    {language === 'hi' ? '2. नियम जांचें, एडिट करें व स्वीकृत करें' : '2. Review, Edit & Approve'}
                  </h3>
                </div>
                {editVoiceScriptHi && (
                  <button
                    onClick={() => speechService.speak(editVoiceScriptHi, 'hi')}
                    className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{language === 'hi' ? 'आवाज़ टेस्ट' : 'Test Audio'}</span>
                  </button>
                )}
              </div>

              {/* Form Fields */}
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'hi' ? 'शीर्षक (Hindi Title):' : 'Title (Hindi):'}
                  </label>
                  <input
                    type="text"
                    value={editTitleHi}
                    onChange={(e) => setEditTitleHi(e.target.value)}
                    placeholder="उदा. ललित सर कैबिन व्यवस्था व प्रोटोकॉल"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'hi' ? 'संक्षिप्त विवरण (Summary):' : 'Summary:'}
                  </label>
                  <textarea
                    rows={2}
                    value={editSummaryHi}
                    onChange={(e) => setEditSummaryHi(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Step by step instructions */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      {language === 'hi' ? 'चरण-दर-चरण निर्देश (Steps):' : 'Step-by-Step Instructions:'}
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setEditSteps([
                          ...editSteps,
                          {
                            stepNumber: editSteps.length + 1,
                            instructionHi: '',
                            instructionEn: '',
                            keyPoints: '',
                          },
                        ])
                      }
                      className="text-[11px] font-bold text-amber-600 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{language === 'hi' ? 'नया स्टेप जोड़ें' : 'Add Step'}</span>
                    </button>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {editSteps.map((step, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-start gap-2"
                      >
                        <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-1">
                          {idx + 1}
                        </span>
                        <div className="flex-1 space-y-1">
                          <input
                            type="text"
                            value={step.instructionHi}
                            onChange={(e) => {
                              const updated = [...editSteps];
                              updated[idx].instructionHi = e.target.value;
                              setEditSteps(updated);
                            }}
                            placeholder="निर्देश हिंदी में"
                            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-800"
                          />
                          <input
                            type="text"
                            value={step.keyPoints || ''}
                            onChange={(e) => {
                              const updated = [...editSteps];
                              updated[idx].keyPoints = e.target.value;
                              setEditSteps(updated);
                            }}
                            placeholder="मुख्य ध्यान देने योग्य बात (Key Point)"
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-0.8 text-[11px] text-slate-600"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditSteps(editSteps.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                          title="Remove step"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cleaning Procedure & Standards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {language === 'hi' ? 'सफाई प्रक्रिया (Cleaning Procedure):' : 'Cleaning Procedure:'}
                    </label>
                    <textarea
                      rows={2}
                      value={editCleaningHi}
                      onChange={(e) => setEditCleaningHi(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {language === 'hi' ? 'अपेक्षित परिणाम (Expected Results):' : 'Expected Results:'}
                    </label>
                    <textarea
                      rows={2}
                      value={editExpectedResultsHi}
                      onChange={(e) => setEditExpectedResultsHi(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-800"
                    />
                  </div>
                </div>

                {/* Natural Hindi Voice Script */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'hi'
                      ? 'पैंट्री बॉय के लिए प्राकृतिक वॉइस स्क्रिप्ट ("भैया..." शैली):'
                      : 'Natural Voice Narration Script:'}
                  </label>
                  <textarea
                    rows={3}
                    value={editVoiceScriptHi}
                    onChange={(e) => setEditVoiceScriptHi(e.target.value)}
                    placeholder="भैया, सोफे के सभी कुशन बिल्कुल सीधे..."
                    className="w-full bg-amber-50/40 border border-amber-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Version Change Note */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'hi' ? 'संस्करण टिप्पणी (Change Note):' : 'Version Change Note:'}
                  </label>
                  <input
                    type="text"
                    value={changeNote}
                    onChange={(e) => setChangeNote(e.target.value)}
                    placeholder="उदा. नए सोफे की फोटो जोड़ी गई"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800"
                  />
                </div>

                {/* Approve & Save Button */}
                <button
                  type="button"
                  onClick={handleApproveAndSave}
                  disabled={isSaving || !editTitleHi.trim()}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                      <span>{language === 'hi' ? 'सेव हो रहा है...' : 'Saving to Database...'}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5 text-amber-400" />
                      <span>
                        {language === 'hi'
                          ? 'स्वीकृत करें व पक्का सेव करें (Approve & Save)'
                          : 'Approve & Save Permanently'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: ADMIN VOICE INSTRUCTION LEARNING (Requirement 3) */}
      {activeTab === 'voice_learn' && (
        <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-bold">
              <Mic className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                {language === 'hi'
                  ? 'एडमिन वॉइस लर्निंग (बोलकर नए नियम बनाएं)'
                  : 'Admin Voice Instruction Learning'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {language === 'hi'
                  ? 'आप साधारण बोलचाल में कहें $\\rightarrow$ AI उसे समझकर सही कमरे के नियम में तब्दील कर देगा'
                  : 'Speak naturally $\\rightarrow$ AI interprets and converts into production-grade training'}
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 font-medium">
            <span className="font-bold">{language === 'hi' ? 'उदाहरण:' : 'Example:'} </span>
            "Reception desk clean karne ke baad chairs ko properly align karna hai. Aur glass par fingerprints nahi hone chahiye."
          </div>

          {/* Spoken text area */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              {language === 'hi' ? 'अपनी हिदायत बोलें या टाइप करें:' : 'Spoken Instruction Transcript:'}
            </label>
            <div className="relative">
              <textarea
                rows={4}
                value={spokenInput}
                onChange={(e) => setSpokenInput(e.target.value)}
                placeholder={
                  language === 'hi'
                    ? 'माइक दबाकर बोलें या यहां अपनी हिदायत टाइप करें...'
                    : 'Click mic to speak or type your instruction here...'
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-3.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Controls: Big Mic Button & AI Structuring Button */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={isVoiceRecording ? handleStopVoiceRecording : handleStartVoiceRecording}
              className={`w-full sm:w-auto px-5 py-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isVoiceRecording
                  ? 'bg-red-600 text-white animate-pulse shadow-md ring-4 ring-red-100'
                  : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs'
              }`}
            >
              {isVoiceRecording ? (
                <>
                  <MicOff className="w-5 h-5" />
                  <span>{language === 'hi' ? 'सुनना रोकें (Stop)' : 'Stop Recording'}</span>
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5 text-slate-950" />
                  <span>{language === 'hi' ? 'माइक से बोलें' : 'Click to Speak'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleInterpretSpokenVoice}
              disabled={!spokenInput.trim() || isInterpretingVoice}
              className="w-full sm:flex-1 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs sm:text-sm py-3 px-4 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isInterpretingVoice ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                  <span>{language === 'hi' ? 'AI समझ रहा है...' : 'AI is processing speech...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <span>{language === 'hi' ? 'हिदायत को नियमों में बदलें' : 'Structure into Training Rules'}</span>
                </>
              )}
            </button>
          </div>

          {/* If structured, show quick switch to edit & approve */}
          {analysisResult && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 mt-3 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-900 block">
                  {analysisResult.titleHi} ({analysisResult.category})
                </span>
                <span className="text-[11px] text-emerald-700">
                  {analysisResult.steps?.length || 0} {language === 'hi' ? 'नियम तैयार हैं' : 'steps generated'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('analyze_photo')}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <span>{language === 'hi' ? 'जांचें व स्वीकृत करें' : 'Review & Approve'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: APPROVED LIBRARY & VERSION HISTORY (Requirement 1 & 4) */}
      {activeTab === 'manage_library' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">
              {language === 'hi' ? 'स्वीकृत ट्रेनिंग नियम व संस्करण' : 'Approved Training Knowledge & Versions'}
            </h3>
            <span className="text-xs text-slate-500 font-semibold">
              {approvedRecords.length} {language === 'hi' ? 'कमरे दर्ज हैं' : 'rooms recorded'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {approvedRecords.map((record) => (
              <div
                key={record.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="relative h-40 bg-slate-100">
                  {record.referencePhotoUrl ? (
                    <img
                      src={record.referencePhotoUrl}
                      alt={record.roomNameHi}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <Camera className="w-8 h-8" />
                    </div>
                  )}
                  <span className="absolute top-2.5 right-2.5 bg-slate-950/80 text-white text-[11px] font-bold px-2 py-0.5 rounded-md backdrop-blur-xs">
                    v{record.currentVersion}
                  </span>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 leading-snug">
                      {record.titleHi}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 line-clamp-2">
                      {record.summaryHi}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenVersionHistory(record)}
                      className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 px-2.5 py-1.5 rounded-lg cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>{language === 'hi' ? 'इतिहास' : 'History'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleSelectRecordForInspection(record);
                        setActiveTab('analyze_photo');
                      }}
                      className="flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{language === 'hi' ? 'एडिट करें' : 'Edit'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VERSION HISTORY DRAWER / MODAL */}
      {isVersionDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-600" />
                <h3 className="font-extrabold text-base text-slate-900">
                  {language === 'hi' ? 'संस्करण इतिहास (Audit Trail)' : 'Version History & Audit'}
                </h3>
              </div>
              <button
                onClick={() => setIsVersionDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              {selectedVersions.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  {language === 'hi' ? 'कोई पुराना संस्करण मौजूद नहीं है।' : 'No older versions recorded.'}
                </div>
              ) : (
                selectedVersions.map((ver) => (
                  <div
                    key={ver.version}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-900 text-white text-xs font-bold px-2 py-0.5 rounded-md">
                          v{ver.version}
                        </span>
                        <span className="text-xs font-extrabold text-slate-800">{ver.titleHi}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-1">
                        {ver.changeNote || 'Standard update'}
                      </p>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {new Date(ver.updatedAt).toLocaleString()} • {ver.updatedBy}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRevertToVersion(ver.version)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{language === 'hi' ? 'रीस्टोर करें' : 'Revert'}</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsVersionDrawerOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
              >
                {language === 'hi' ? 'बंद करें' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
