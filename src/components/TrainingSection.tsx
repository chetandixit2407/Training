import React, { useState, useRef, useEffect } from 'react';
import { VisualGuide, Language, User, RoomPhotoItem, AIRoomAnalysis } from '../types';
import { VoiceButton } from './VoiceButton';
import { StorageService, fileToDataUrl, normalizeRoomCategory } from '../services/storageService';
import { AITrainingService } from '../services/aiTrainingService';
import { TaskCompleteModal } from './TaskCompleteModal';
import { DeletePhotoConfirmModal } from './DeletePhotoConfirmModal';
import { UpdatePhotoConfirmModal } from './UpdatePhotoConfirmModal';
import { DateHistoryModal } from './DateHistoryModal';
import { ReferenceImage } from './ReferenceImage';
import { DEFAULT_USERS } from '../data/defaultData';
import {
  CheckCircle2,
  XCircle,
  Maximize2,
  Sparkles,
  Info,
  ChevronRight,
  ChevronLeft,
  Eye,
  ShieldCheck,
  Zap,
  Coffee,
  Armchair,
  Briefcase,
  Users,
  Laptop,
  Camera,
  Upload,
  Trash2,
  RefreshCw,
  LayoutGrid,
  Check,
  Clock,
  Layers,
  Star,
  X,
  AlertCircle,
  PlusCircle,
  History,
} from 'lucide-react';

interface TrainingSectionProps {
  guides: VisualGuide[];
  language: Language;
  currentUser: User | null;
  onEditGuide?: (guide: VisualGuide) => void;
  onRefreshData?: () => void;
}

export const TrainingSection: React.FC<TrainingSectionProps> = ({
  guides,
  language,
  currentUser,
  onEditGuide,
  onRefreshData,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'detailed'>('grid');
  const [selectedGuideId, setSelectedGuideId] = useState<string>(guides[0]?.id || '');
  
  // Interactive Lightbox State
  const [lightboxRoomCategory, setLightboxRoomCategory] = useState<string | null>(null);
  const [lightboxPhotoIndex, setLightboxPhotoIndex] = useState<number>(0);
  const [lightboxPhotos, setLightboxPhotos] = useState<RoomPhotoItem[]>([]);
  const [, setRefreshTick] = useState(0);
  
  // Direct Multi-file upload for Admin from Training Section
  const [uploadingForGuideId, setUploadingForGuideId] = useState<string | null>(null);
  const [quickSuccessMsg, setQuickSuccessMsg] = useState<{ id: string; text: string } | null>(null);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState<string | null>(null);

  // For Pantry Boy direct room proof upload
  const [proofRoomModal, setProofRoomModal] = useState<VisualGuide | null>(null);
  const [historyModalRoom, setHistoryModalRoom] = useState<{ roomId: string; roomLabel: string } | null>(null);

  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const lightboxReplaceInputRef = useRef<HTMLInputElement>(null);
  const activeGuideRef = useRef<string | null>(null);

  const [isReplacingLightbox, setIsReplacingLightbox] = useState(false);
  const [lightboxErrorMsg, setLightboxErrorMsg] = useState<string | null>(null);
  const [pendingLightboxUpdate, setPendingLightboxUpdate] = useState<{
    category: string;
    photoId: string;
    currentPhotoUrl?: string;
    newPhotoPreview: string;
    photoIndex?: number;
    roomName: string;
  } | null>(null);

  const handleStartLightboxReplace = () => {
    if (lightboxReplaceInputRef.current) {
      lightboxReplaceInputRef.current.value = '';
      lightboxReplaceInputRef.current.click();
    }
  };

  const handleConfirmLightboxReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !lightboxRoomCategory || !currentLightboxPhoto) return;

    try {
      const base64 = await fileToDataUrl(file);
      setPendingLightboxUpdate({
        category: lightboxRoomCategory,
        photoId: currentLightboxPhoto.id,
        currentPhotoUrl: currentLightboxPhoto.url,
        newPhotoPreview: base64,
        photoIndex: lightboxPhotoIndex,
        roomName: lightboxRoomCategory.replace(/_/g, ' ').toUpperCase(),
      });
    } catch (err: any) {
      setLightboxErrorMsg(err.message || 'Failed to read image file');
      setTimeout(() => setLightboxErrorMsg(null), 4000);
    } finally {
      if (lightboxReplaceInputRef.current) lightboxReplaceInputRef.current.value = '';
    }
  };

  const handleExecuteLightboxUpdate = async () => {
    if (!pendingLightboxUpdate) return;
    setIsReplacingLightbox(true);
    setLightboxErrorMsg(null);
    try {
      const adminUser = currentUser?.role === 'admin'
        ? currentUser
        : StorageService.getUsers().find((u) => u.role === 'admin');

      const res = await AITrainingService.replaceRoomPhotoItem({
        category: pendingLightboxUpdate.category,
        photoId: pendingLightboxUpdate.photoId,
        photoBase64: pendingLightboxUpdate.newPhotoPreview,
        photoUrl: pendingLightboxUpdate.currentPhotoUrl,
        photoIndex: pendingLightboxUpdate.photoIndex,
        user: adminUser,
      });

      if (res.success) {
        const updated = res.photos || [];
        StorageService.setRoomPhotos(pendingLightboxUpdate.category, updated);
        setLightboxPhotos(updated);
        setRefreshTick((t) => t + 1);

        setQuickSuccessMsg({
          id: pendingLightboxUpdate.category,
          text: language === 'hi'
            ? 'संदर्भ फोटो सफलतापूर्वक अपडेट कर दी गई और पुरानी फोटो इतिहास में सुरक्षित हो गई!'
            : 'Reference photo successfully updated! Previous photo preserved in Date-Wise History.',
        });
        setTimeout(() => setQuickSuccessMsg(null), 3500);

        onRefreshData?.();
      }
      setPendingLightboxUpdate(null);
    } catch (err: any) {
      setLightboxErrorMsg(err.message || 'Failed to replace photo');
      setTimeout(() => setLightboxErrorMsg(null), 5000);
    } finally {
      setIsReplacingLightbox(false);
    }
  };

  const isAdmin = currentUser?.role === 'admin';

  // Selected guide for detailed view
  const currentDetailedGuide = guides.find((g) => g.id === selectedGuideId) || guides[0];
  const [isLoadingDetailedPhotos, setIsLoadingDetailedPhotos] = useState(false);

  // Fetch fresh photos from server whenever an area is opened in detailed view
  useEffect(() => {
    if (viewMode !== 'detailed' || !currentDetailedGuide?.category) return;
    let cancelled = false;
    setIsLoadingDetailedPhotos(true);
    AITrainingService.getRoomPhotos(currentDetailedGuide.category)
      .then((res) => {
        if (cancelled) return;
        if (Array.isArray(res.photos)) {
          StorageService.setRoomPhotos(currentDetailedGuide.category, res.photos);
          if (res.analysis) {
            StorageService.setRoomAnalysis(currentDetailedGuide.category, res.analysis);
          }
          setRefreshTick((t) => t + 1);
        }
      })
      .catch((err) => {
        console.warn('Failed to refresh room photos on area open:', err);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDetailedPhotos(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewMode, currentDetailedGuide?.category]);

  // Helper to get room gallery photos
  const getRoomPhotosForGuide = (guide: VisualGuide): RoomPhotoItem[] => {
    // 1. Check loaded room photos in StorageService
    const stored = StorageService.getRoomPhotos(guide.category);
    if (stored !== undefined && Array.isArray(stored)) {
      if (stored.length > 0) return stored;
      // If stored is explicitly empty, user has deleted all photos: DO NOT restore default photos!
      return [];
    }

    // 2. Check guide.photos
    if (guide.photos && Array.isArray(guide.photos)) {
      return guide.photos;
    }

    // 3. Fallback only if photoUrl is present and non-empty
    if (guide.photoUrl && guide.photoUrl.trim() !== '') {
      return [
        {
          id: `photo_${guide.category}_1`,
          url: guide.photoUrl,
          captionHi: guide.photoCaptionHi,
          captionEn: guide.photoCaptionEn,
          uploadedAt: guide.updatedAt || '2026-11-02T08:30:00Z',
          uploadedBy: 'Admin (System)',
          isPrimary: true,
          photoType: 'reference',
        },
      ];
    }
    return [];
  };

  // Helper to get AI analysis for guide
  const getRoomAnalysisForGuide = (guide: VisualGuide): AIRoomAnalysis | null => {
    return guide.aiRoomAnalysis || StorageService.getRoomAnalysis(guide.category);
  };

  // Open Lightbox for a specific room and photo index
  const openLightbox = (category: string, index = 0) => {
    const norm = normalizeRoomCategory(category);
    const targetGuide = guides.find((g) => normalizeRoomCategory(g.category) === norm || g.category === category);
    const photos = targetGuide ? getRoomPhotosForGuide(targetGuide) : StorageService.getRoomPhotos(category);
    setLightboxRoomCategory(category);
    setLightboxPhotos(photos);
    setLightboxPhotoIndex(photos.length > 0 ? Math.max(0, Math.min(index, photos.length - 1)) : 0);
  };

  const closeLightbox = () => {
    setLightboxRoomCategory(null);
    setLightboxPhotos([]);
    setLightboxPhotoIndex(0);
  };

  // Trigger multi-file upload for Admin
  const handleTriggerMultiUpload = (guideId: string) => {
    activeGuideRef.current = guideId;
    if (multiFileInputRef.current) {
      multiFileInputRef.current.value = '';
      multiFileInputRef.current.click();
    }
  };

  // Admin handles multiple photos uploaded at once
  const handleMultiFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const targetGuideId = activeGuideRef.current;
    if (!files || files.length === 0 || !targetGuideId) return;

    const targetGuide = guides.find((g) => g.id === targetGuideId);
    if (!targetGuide) return;

    try {
      setUploadingForGuideId(targetGuideId);
      const fileList = Array.from(files);
      const existingPhotos = getRoomPhotosForGuide(targetGuide);
      const uploadPayload = [];

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const dataUrl = await fileToDataUrl(file);
        const angleNum = existingPhotos.length + i + 1;
        uploadPayload.push({
          photoBase64: dataUrl,
          captionHi: `${targetGuide.titleHi} - संदर्भ कोण #${angleNum}`,
          captionEn: `${targetGuide.titleEn} - Reference Angle #${angleNum}`,
          photoType: 'reference' as const,
          isPrimary: existingPhotos.length === 0 && i === 0,
        });
      }

      const res = await AITrainingService.uploadMultipleRoomPhotos({
        category: targetGuide.category,
        roomName: targetGuide.titleEn,
        photos: uploadPayload,
        user: currentUser,
      });

      if (res.success) {
        StorageService.setRoomPhotos(targetGuide.category, res.photos);
        setQuickSuccessMsg({
          id: targetGuideId,
          text:
            language === 'hi'
              ? `${res.photos.length} फोटो सफलतापूर्वक गैलरी में सुरक्षित!`
              : `${uploadPayload.length} photos added to gallery!`,
        });
        setTimeout(() => setQuickSuccessMsg(null), 3000);
        onRefreshData?.();
      }
    } catch (err: any) {
      console.error(err);
      setLightboxErrorMsg(err.message || 'Error uploading photos');
      setTimeout(() => setLightboxErrorMsg(null), 4000);
    } finally {
      setUploadingForGuideId(null);
    }
  };

  // Admin triggers AI room analysis
  const handleTriggerAIAnalysis = async (guide: VisualGuide) => {
    setIsAnalyzingAI(guide.id);
    try {
      const res = await AITrainingService.analyzeRoomPhotosWithAI(guide.category, guide.titleEn, currentUser);
      if (res.success) {
        StorageService.setRoomAnalysis(guide.category, res.analysis);
        setQuickSuccessMsg({
          id: guide.id,
          text:
            language === 'hi'
              ? 'AI ने सभी फोटो का 360° विश्लेषण पूरा कर लिया!'
              : 'AI analysis completed across all room photos!',
        });
        setTimeout(() => setQuickSuccessMsg(null), 3500);
        onRefreshData?.();
      }
    } catch (err: any) {
      setLightboxErrorMsg(err.message || 'AI analysis failed');
      setTimeout(() => setLightboxErrorMsg(null), 4000);
    } finally {
      setIsAnalyzingAI(null);
    }
  };

  // Photo deletion confirmation modal state
  const [photoToDelete, setPhotoToDelete] = useState<{
    id: string;
    url?: string;
    category: string;
    index: number;
    roomName: string;
    totalPhotos: number;
    guideId?: string;
  } | null>(null);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const [deletePhotoError, setDeletePhotoError] = useState<string | null>(null);

  // Request single photo deletion (opens confirmation modal)
  const handleRequestDeletePhoto = (category: string, photoId: string, guideId?: string, photoUrl?: string, customIndex?: number) => {
    setDeletePhotoError(null);
    const targetGuide = guides.find((g) => normalizeRoomCategory(g.category) === normalizeRoomCategory(category) || g.category === category);
    const photos = targetGuide ? getRoomPhotosForGuide(targetGuide) : StorageService.getRoomPhotos(category);
    const activeIdx =
      typeof customIndex === 'number'
        ? customIndex
        : lightboxPhotoIndex !== null && lightboxRoomCategory && normalizeRoomCategory(lightboxRoomCategory) === normalizeRoomCategory(category)
        ? lightboxPhotoIndex
        : photos.findIndex((p) => p.id === photoId || p.url === photoUrl);

    const matchedPhoto = photos[activeIdx] || photos.find((p) => p.id === photoId || p.url === photoUrl);
    setPhotoToDelete({
      id: matchedPhoto?.id || photoId,
      url: matchedPhoto?.url || photoUrl,
      category,
      index: activeIdx >= 0 ? activeIdx : 0,
      roomName: targetGuide?.titleEn || targetGuide?.titleHi || category.toUpperCase(),
      totalPhotos: photos.length,
      guideId,
    });
  };

  // Backwards-compatible alias
  const handleDeletePhotoItem = handleRequestDeletePhoto;

  // Confirm and execute single photo deletion permanently
  const handleConfirmDeletePhoto = async () => {
    if (!photoToDelete) return;
    setIsDeletingPhoto(true);
    setDeletePhotoError(null);

    try {
      const adminUser = currentUser?.role === 'admin'
        ? currentUser
        : StorageService.getUsers().find((u) => u.role === 'admin') || DEFAULT_USERS[2];

      const res = await AITrainingService.deleteRoomPhotoItem(
        photoToDelete.category,
        photoToDelete.id,
        adminUser,
        photoToDelete.url,
        photoToDelete.index
      );

      if (res.success) {
        const updatedPhotos = res.photos || [];
        // Immediately persist to cache & localStorage
        StorageService.setRoomPhotos(photoToDelete.category, updatedPhotos);

        // Advance viewer or close if last photo deleted
        if (lightboxRoomCategory && normalizeRoomCategory(lightboxRoomCategory) === normalizeRoomCategory(photoToDelete.category)) {
          if (updatedPhotos.length === 0) {
            // Last photo deleted -> close viewer and show empty state
            closeLightbox();
          } else {
            // Multiple photos existed -> advance to next available photo
            setLightboxPhotos(updatedPhotos);
            const nextIdx = Math.min(photoToDelete.index, updatedPhotos.length - 1);
            setLightboxPhotoIndex(nextIdx);
          }
        }

        // Trigger local re-render immediately
        setRefreshTick((t) => t + 1);

        setQuickSuccessMsg({
          id: photoToDelete.guideId || photoToDelete.category,
          text: language === 'hi'
            ? 'संदर्भ फोटो सर्वर और डेटाबेस से सफलतापूर्वक हटा दिया गया है!'
            : 'Reference photo permanently deleted from cloud storage and database!',
        });
        setTimeout(() => setQuickSuccessMsg(null), 3500);

        setPhotoToDelete(null);
        onRefreshData?.();
      } else {
        throw new Error(res.message || 'Failed to delete photo');
      }
    } catch (err: any) {
      setDeletePhotoError(err.message || 'Failed to delete photo');
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  // Admin sets primary
  const handleSetPrimaryItem = async (category: string, photoId: string, guideId: string) => {
    try {
      const res = await AITrainingService.setPrimaryRoomPhoto(category, photoId, currentUser);
      if (res.success) {
        StorageService.setRoomPhotos(category, res.photos);
        setQuickSuccessMsg({
          id: guideId,
          text: language === 'hi' ? 'मुख्य मानक फोटो अपडेट हुआ' : 'Primary photo updated',
        });
        setTimeout(() => setQuickSuccessMsg(null), 3000);
        onRefreshData?.();
      }
    } catch (err: any) {
      setLightboxErrorMsg(err.message || 'Failed to set primary');
      setTimeout(() => setLightboxErrorMsg(null), 4000);
    }
  };

  // Handle submission of pantry boy proof for a room
  const handleRoomProofSubmit = async (
    taskId: string,
    proofPhotos: Array<{ photoBase64: string; angleLabel?: string; caption?: string }>,
    primaryPhotoUrl: string,
    beforePhotoUrl?: string,
    notes?: string
  ) => {
    const guide = guides.find((g) => g.id === taskId);
    if (!guide) return;

    const newTaskId = `task-room-${Date.now()}`;
    const newTask = {
      id: newTaskId,
      titleHi: `${guide.titleHi} - सफाई व व्यवस्था सत्यापन`,
      titleEn: `${guide.titleEn} - Inspection & Sanitization`,
      category: guide.category,
      roomNameHi: guide.titleHi,
      roomNameEn: guide.titleEn,
      scheduledTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      assignedToUserId: currentUser?.id || 'pb-101',
      referencePhotoUrl: guide.photoUrl,
      instructionsHi: guide.furnitureDetailsHi,
      instructionsEn: guide.furnitureDetailsEn,
      audioTextHi: guide.voiceScriptHi,
      audioTextEn: guide.voiceScriptEn,
      status: 'completed' as const,
      completedByUserId: currentUser?.id || 'pb-101',
      completedByName: currentUser ? (language === 'hi' ? currentUser.nameHi : currentUser.name) : 'Ramesh Kumar',
      completedAt: new Date().toISOString(),
      proofPhotoUrl: primaryPhotoUrl,
      beforePhotoUrl,
      boyNotes: notes,
      adminStatus: 'pending_review' as const,
    };

    StorageService.addTask(newTask);
    setProofRoomModal(null);

    // Persist to backend server with 40-day retention
    try {
      await AITrainingService.completeTaskWithPhotos({
        taskId: newTaskId,
        taskTitle: guide.titleEn,
        roomName: guide.titleEn,
        user: currentUser,
        notes,
        beforePhotoBase64: beforePhotoUrl,
        completionPhotos: proofPhotos,
      });
    } catch (e) {
      console.warn('Backend completion photo persist notice:', e);
    }

    onRefreshData?.();
  };

  // Lightbox active photo list
  const activeLightboxPhotos = lightboxPhotos.length > 0
    ? lightboxPhotos
    : (lightboxRoomCategory ? StorageService.getRoomPhotos(lightboxRoomCategory) || [] : []);
  const currentLightboxPhoto = activeLightboxPhotos[lightboxPhotoIndex] || activeLightboxPhotos[0];

  return (
    <div className="space-y-6 pb-20">
      
      {/* Hidden file input for replacing single photo in lightbox */}
      <input
        ref={lightboxReplaceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleConfirmLightboxReplace}
      />

      {/* Hidden multiple file input for Admin multi-photo upload */}
      <input
        ref={multiFileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleMultiFileChange}
      />

      {/* Top Banner with View Switcher */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">
            <Layers className="w-4 h-4" />
            <span>{language === 'hi' ? 'कार्यालय कमरे व व्यवस्था' : 'Office Rooms & Operations'}</span>
            <span>•</span>
            <span>{guides.length} {language === 'hi' ? 'कमरे' : 'Rooms'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-950">
            {language === 'hi' ? 'रूम डैशबोर्ड और मल्टी-फोटो गैलरी' : 'Rooms Dashboard & Photo Galleries'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
            {language === 'hi'
              ? 'प्रत्येक कमरे के सभी अनुमोदित संदर्भ फोटो और एआई 360° स्वच्छता विश्लेषण देखें। पैंट्री स्टाफ केवल देख सकते हैं; एडमिन नए फोटो जोड़ या बदल सकते हैं।'
              : 'Inspect approved multi-angle reference photos and AI multimodal analysis for each room. Pantry staff can view; Admin can add or replace photos.'}
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[40px] ${
                viewMode === 'grid'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>{language === 'hi' ? 'सभी 10 कमरे' : 'All Rooms'}</span>
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[40px] ${
                viewMode === 'detailed'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>{language === 'hi' ? 'विस्तृत गैलरी' : 'Detailed Gallery'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: DASHBOARD GRID OF ALL ROOMS */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {guides.map((guide, index) => {
            const photos = getRoomPhotosForGuide(guide);
            const primaryPhoto = photos.find((p) => p.isPrimary) || photos[0];
            const hasPhoto = Boolean(primaryPhoto?.url);
            const isUploadingThis = uploadingForGuideId === guide.id;
            const isAnalyzingThis = isAnalyzingAI === guide.id;
            const analysis = getRoomAnalysisForGuide(guide);

            return (
              <div
                key={guide.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 transition-all shadow-xs overflow-hidden flex flex-col justify-between"
              >
                <div>
                  
                  {/* Card Header: Room Name & Furniture Badge */}
                  <div className="p-4 sm:p-5 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-6 h-6 rounded-md bg-slate-900 text-amber-400 font-black text-xs flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            OFFICE ROOM
                          </span>
                          {/* Photo Count Pill */}
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[10px]">
                            📸 {photos.length} {language === 'hi' ? 'फोटो' : 'Photos'}
                          </span>
                          {analysis && (
                            <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900 font-bold text-[10px] flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>AI</span>
                            </span>
                          )}
                        </div>
                        <h3 className="text-base sm:text-lg font-black text-slate-950 tracking-tight">
                          {language === 'hi' ? guide.titleHi : guide.titleEn}
                        </h3>
                      </div>

                      <VoiceButton
                        text={
                          language === 'hi'
                            ? guide.voiceScriptHi
                            : `${guide.titleEn}. ${guide.furnitureDetailsEn}. ${guide.voiceScriptEn}`
                        }
                        lang={language}
                        textId={`voice-room-${guide.id}`}
                        size="sm"
                        label={language === 'hi' ? 'ऑडियो' : 'Audio'}
                      />
                    </div>

                    {/* Furniture Details Badge */}
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200/90 rounded-xl text-amber-950 text-xs font-bold">
                      <span className="text-amber-700">🛋️ {language === 'hi' ? 'फर्नीचर:' : 'Furniture:'}</span>
                      <span className="font-extrabold text-slate-900">
                        {language === 'hi' ? guide.furnitureDetailsHi : guide.furnitureDetailsEn}
                      </span>
                    </div>
                  </div>

                  {/* Reference Photo Container with Gallery Overlay */}
                  <div className="relative aspect-16/10 bg-slate-100 overflow-hidden group">
                    {hasPhoto ? (
                      <>
                        <ReferenceImage
                          src={primaryPhoto.url}
                          alt={guide.titleEn}
                          language={language}
                          className="w-full h-full object-cover group-hover:scale-101 transition-transform duration-300 cursor-pointer"
                          onClick={() => openLightbox(guide.category, 0)}
                        />

                        {/* Top Controls: Zoom & Gallery Count */}
                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePhotoItem(guide.category, primaryPhoto.id, guide.id, primaryPhoto.url);
                              }}
                              className="p-2 rounded-xl bg-black/60 hover:bg-rose-600 text-white backdrop-blur-xs transition-colors cursor-pointer"
                              title={language === 'hi' ? 'यह संदर्भ फोटो हटाएं' : 'Delete reference photo'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openLightbox(guide.category, 0)}
                            className="p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs transition-colors cursor-pointer"
                            title="Fullscreen Zoom"
                          >
                            <Maximize2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Bottom Left Badge */}
                        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-2">
                          <div className="px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-xs text-white text-[11px] font-bold flex items-center gap-1.5">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                            <span>{language === 'hi' ? 'मुख्य मानक संदर्भ' : 'Primary Reference'}</span>
                          </div>

                          {photos.length > 1 && (
                            <button
                              onClick={() => openLightbox(guide.category, 1)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-[11px] font-black cursor-pointer shadow-sm transition-colors"
                            >
                              +{photos.length - 1} {language === 'hi' ? 'अन्य कोण' : 'More Angles'} →
                            </button>
                          )}
                        </div>
                      </>
                    ) : !StorageService.isPhotosInitialized() ? (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                        <RefreshCw className="w-8 h-8 mb-2 text-amber-500 animate-spin" />
                        <span className="text-xs font-bold text-slate-600 block">
                          {language === 'hi' ? 'फोटो लोड हो रहे हैं...' : 'Loading photos...'}
                        </span>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                        <Camera className="w-10 h-10 mb-2 text-slate-300" />
                        <span className="text-xs font-bold text-slate-600 block">
                          {language === 'hi' ? 'कोई फोटो उपलब्ध नहीं है' : 'No Reference Photo'}
                        </span>
                      </div>
                    )}

                    {/* Upload spinner overlay */}
                    {(isUploadingThis || isAnalyzingThis) && (
                      <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center text-white text-xs font-bold gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                        <span>
                          {isUploadingThis
                            ? (language === 'hi' ? 'फोटो अपलोड हो रहे हैं...' : 'Uploading photos to server...')
                            : (language === 'hi' ? 'AI विश्लेषण हो रहा है...' : 'AI analyzing all photos...')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Multi-Photo Thumbnail Strip (if room has multiple photos) */}
                  {photos.length > 1 && (
                    <div className="px-4 py-2.5 bg-slate-100/70 border-t border-slate-200/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                        {language === 'hi' ? 'सभी कोण:' : 'Angles:'}
                      </span>
                      {photos.map((p, pIdx) => (
                        <button
                          key={p.id}
                          onClick={() => openLightbox(guide.category, pIdx)}
                          className="w-10 h-8 rounded-md overflow-hidden border border-slate-300 hover:border-amber-500 shrink-0 cursor-pointer relative group transition-all"
                          title={p.captionEn || `Angle ${pIdx + 1}`}
                        >
                          <ReferenceImage src={p.url} alt={p.captionEn || `Angle ${pIdx + 1}`} language={language} compact className="w-full h-full object-cover" />
                          {p.isPrimary && (
                            <div className="absolute inset-0 bg-amber-500/20 border border-amber-500 pointer-events-none"></div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Quick success toast */}
                  {quickSuccessMsg?.id === guide.id && (
                    <div className="bg-emerald-600 text-white text-xs font-bold px-3 py-2 flex items-center gap-1.5 animate-in fade-in">
                      <Check className="w-4 h-4" />
                      <span>{quickSuccessMsg.text}</span>
                    </div>
                  )}

                  {/* Instructions Summary */}
                  <div className="p-4 bg-slate-50 border-t border-slate-100">
                    <p className="text-xs text-slate-700 leading-relaxed font-medium line-clamp-2">
                      {language === 'hi' ? guide.subtitleHi : guide.subtitleEn}
                    </p>
                  </div>

                </div>

                {/* Card Actions Footer: Admin vs Pantry Boy */}
                <div className="p-4 bg-white border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  
                  {/* ADMIN CONTROLS: Add Multiple Photos & Manage Gallery */}
                  {isAdmin ? (
                    <div className="flex items-center gap-2 w-full">
                      <button
                        onClick={() => handleTriggerMultiUpload(guide.id)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[42px] shadow-xs"
                      >
                        <Camera className="w-4 h-4" />
                        <span>{language === 'hi' ? 'और फोटो जोड़ें (Add)' : 'Add Photos'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedGuideId(guide.id);
                          setViewMode('detailed');
                        }}
                        className="py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer min-h-[42px]"
                      >
                        <Layers className="w-4 h-4 text-slate-700" />
                        <span>{language === 'hi' ? 'गैलरी देखें' : 'Gallery'}</span>
                      </button>

                      <button
                        onClick={() =>
                          setHistoryModalRoom({
                            roomId: guide.category,
                            roomLabel: language === 'hi' ? guide.titleHi : guide.titleEn,
                          })
                        }
                        className="py-2.5 px-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer min-h-[42px]"
                        title={language === 'hi' ? 'दिनांक-वार फोटो इतिहास' : 'Date-Wise Photo History'}
                      >
                        <History className="w-4 h-4 text-amber-600" />
                      </button>
                    </div>
                  ) : (
                    /* PANTRY BOY CONTROLS: Browse Gallery & Upload Cleaning Proof */
                    <div className="flex items-center gap-2 w-full">
                      <button
                        onClick={() => setProofRoomModal(guide)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[42px] shadow-xs"
                      >
                        <Camera className="w-4 h-4" />
                        <span>{language === 'hi' ? 'सफाई का फोटो अपलोड करें' : 'Upload Proof Photo'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedGuideId(guide.id);
                          setViewMode('detailed');
                        }}
                        className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer min-h-[42px]"
                      >
                        <span>{language === 'hi' ? 'सभी फोटो देखें' : 'View Gallery'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() =>
                          setHistoryModalRoom({
                            roomId: guide.category,
                            roomLabel: language === 'hi' ? guide.titleHi : guide.titleEn,
                          })
                        }
                        className="py-2.5 px-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer min-h-[42px]"
                        title={language === 'hi' ? 'दिनांक-वार फोटो इतिहास' : 'Date-Wise Photo History'}
                      >
                        <History className="w-4 h-4 text-amber-600" />
                      </button>
                    </div>
                  )}

                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: DETAILED ROOM VIEW WITH FULL PHOTO GALLERY & AI ANALYSIS */}
      {viewMode === 'detailed' && currentDetailedGuide && (
        <div className="space-y-6">
          
          {/* Room Selector Pills */}
          <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {guides.map((g) => {
                const isSelected = currentDetailedGuide.id === g.id;
                const photos = getRoomPhotosForGuide(g);
                return (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGuideId(g.id)}
                    className={`px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 transition-all cursor-pointer min-h-[44px] flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <span>{language === 'hi' ? g.titleHi : g.titleEn}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isSelected ? 'bg-amber-400 text-slate-950 font-black' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {photos.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Room Header Card */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">
                <span>{language === 'hi' ? 'विस्तृत प्रशिक्षण गाइड व रूम गैलरी' : 'Detailed Room Standard & Gallery'}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-950">
                {language === 'hi' ? currentDetailedGuide.titleHi : currentDetailedGuide.titleEn}
              </h2>
              
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg text-xs font-bold text-amber-950">
                <span>🛋️ {language === 'hi' ? 'फर्नीचर संख्या:' : 'Furniture Count:'}</span>
                <span className="font-extrabold text-slate-900">
                  {language === 'hi' ? currentDetailedGuide.furnitureDetailsHi : currentDetailedGuide.furnitureDetailsEn}
                </span>
              </div>
            </div>

            {/* Actions: Voice & Admin Controls */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <VoiceButton
                text={
                  language === 'hi'
                    ? currentDetailedGuide.voiceScriptHi
                    : `${currentDetailedGuide.titleEn}. ${currentDetailedGuide.furnitureDetailsEn}. ${currentDetailedGuide.voiceScriptEn}`
                }
                lang={language}
                textId={`detailed-audio-${currentDetailedGuide.id}`}
                label={language === 'hi' ? 'प्रशिक्षण सुनें' : 'Listen Guide'}
                size="md"
              />

              {isAdmin && (
                <button
                  onClick={() => handleTriggerMultiUpload(currentDetailedGuide.id)}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-colors cursor-pointer min-h-[44px] flex items-center gap-1.5 shadow-xs"
                >
                  <Camera className="w-4 h-4" />
                  <span>{language === 'hi' ? 'कई फोटो अपलोड करें' : 'Upload Multiple Photos'}</span>
                </button>
              )}
            </div>
          </div>

          {/* FULL SEPARATE ROOM PHOTO GALLERY (Requirement 3 & 4) */}
          {(() => {
            const currentPhotos = getRoomPhotosForGuide(currentDetailedGuide);
            return (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-extrabold text-slate-950 text-base flex items-center gap-2">
                      <Camera className="w-5 h-5 text-amber-600" />
                      <span>
                        {language === 'hi'
                          ? `${currentDetailedGuide.titleHi} - आधिकारिक फोटो गैलरी (${currentPhotos.length} कोण)`
                          : `${currentDetailedGuide.titleEn} - Official Photo Gallery (${currentPhotos.length} Angles)`}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {language === 'hi'
                        ? 'विभिन्न कोणों से कमरे की सही व्यवस्था देखें। किसी भी फोटो पर क्लिक करके बड़ा करें।'
                        : 'Inspect full setup from multiple angles. Click any photo to preview in high definition.'}
                    </p>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => handleTriggerMultiUpload(currentDetailedGuide.id)}
                      className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 self-start sm:self-auto"
                    >
                      <PlusCircle className="w-4 h-4 text-amber-700" />
                      <span>{language === 'hi' ? 'और फोटो जोड़ें' : 'Add Photos'}</span>
                    </button>
                  )}
                </div>

                {/* Photo Gallery Grid */}
                {isLoadingDetailedPhotos && currentPhotos.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                    <span className="text-xs font-bold">
                      {language === 'hi' ? 'इस क्षेत्र की फोटो लोड हो रही हैं...' : 'Loading area photos...'}
                    </span>
                  </div>
                ) : currentPhotos.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Camera className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-bold text-slate-700">
                      {language === 'hi' ? 'इस क्षेत्र में अभी कोई संदर्भ फोटो नहीं है' : 'No reference photos uploaded for this area yet'}
                    </p>
                  </div>
                ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {currentPhotos.map((photo, pIdx) => {
                    const isPrimary = Boolean(photo.isPrimary);
                    return (
                      <div
                        key={photo.id}
                        className={`bg-slate-50 rounded-2xl border overflow-hidden flex flex-col justify-between ${
                          isPrimary ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-slate-200'
                        }`}
                      >
                        <div>
                          <div
                            className="relative aspect-16/10 bg-slate-200 overflow-hidden cursor-pointer group"
                            onClick={() => openLightbox(currentDetailedGuide.category, pIdx)}
                          >
                            <ReferenceImage
                              src={photo.url}
                              alt={photo.captionEn || `Angle ${pIdx + 1}`}
                              language={language}
                              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                            />
                            {isPrimary && (
                              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px] shadow-sm flex items-center gap-1 z-20">
                                <Star className="w-3 h-3 fill-slate-950" />
                                <span>{language === 'hi' ? 'मुख्य मानक' : 'Primary'}</span>
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openLightbox(currentDetailedGuide.category, pIdx);
                              }}
                              className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs transition-colors cursor-pointer z-20"
                              title="Fullscreen"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-white text-[10px] font-mono z-20">
                              Angle #{pIdx + 1}
                            </div>
                          </div>

                          <div className="p-3">
                            <p className="text-xs font-bold text-slate-900 line-clamp-2">
                              {language === 'hi'
                                ? photo.captionHi || photo.captionEn || 'संदर्भ फोटो'
                                : photo.captionEn || photo.captionHi || 'Reference Photo'}
                            </p>
                            {photo.uploadedAt && (
                              <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{new Date(photo.uploadedAt).toLocaleString()}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Admin-only controls on each photo card */}
                        {isAdmin && (
                          <div className="p-2.5 bg-white border-t border-slate-200/80 flex items-center justify-between text-xs">
                            {!isPrimary ? (
                              <button
                                onClick={() => handleSetPrimaryItem(currentDetailedGuide.category, photo.id, currentDetailedGuide.id)}
                                className="text-[11px] font-bold text-amber-700 hover:underline cursor-pointer"
                              >
                                ⭐ {language === 'hi' ? 'मुख्य बनाएं' : 'Make Primary'}
                              </button>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-700">✓ Official</span>
                            )}
                            <button
                              onClick={() => handleDeletePhotoItem(currentDetailedGuide.category, photo.id, currentDetailedGuide.id, photo.url)}
                              className="text-rose-600 hover:text-rose-800 p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer transition-colors"
                              title={language === 'hi' ? 'यह संदर्भ फोटो हटाएं' : 'Delete reference photo'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            );
          })()}

          {/* AI MULTI-PHOTO ANALYSIS SECTION (Requirement 8) */}
          {(() => {
            const analysis = getRoomAnalysisForGuide(currentDetailedGuide);
            const photos = getRoomPhotosForGuide(currentDetailedGuide);

            return (
              <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-5 sm:p-6 shadow-md space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wide mb-1">
                      <Sparkles className="w-4 h-4" />
                      <span>GEMINI 3.8 FLASH MULTI-ANGLE ANALYSIS</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-black">
                      {language === 'hi'
                        ? `एआई 360° स्वच्छता व व्यवस्था विश्लेषण`
                        : `AI 360° Cleanliness & Setup Analysis`}
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                      {language === 'hi'
                        ? `एआई ने इस कमरे के सभी ${photos.length} फोटो का एक साथ मूल्यांकन करके निम्नलिखित मानक तैयार किए हैं:`
                        : `AI analyzed all ${photos.length} reference photos together to establish these comprehensive facility benchmarks:`}
                    </p>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => handleTriggerAIAnalysis(currentDetailedGuide)}
                      disabled={isAnalyzingAI === currentDetailedGuide.id}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50 shrink-0"
                    >
                      {isAnalyzingAI === currentDetailedGuide.id ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                          <span>{language === 'hi' ? 'विश्लेषण चल रहा है...' : 'Analyzing...'}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>{language === 'hi' ? 'पुनः AI विश्लेषण चलाएं' : 'Run AI Analysis'}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {analysis ? (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                          {language === 'hi' ? 'एआई निरीक्षण सारांश' : 'AI Multimodal Observation'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {analysis.totalPhotosAnalyzed} angles analyzed
                        </span>
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed font-medium">
                        {language === 'hi' ? analysis.summaryHi : analysis.summaryEn}
                      </p>
                      <div className="pt-1">
                        <VoiceButton
                          text={
                            language === 'hi'
                              ? `कमरे का एआई विश्लेषण: ${analysis.summaryHi}. सफाई मानक: ${analysis.setupStandardsHi.join('. ')}`
                              : `AI Room Analysis: ${analysis.summaryEn}. Standards: ${analysis.setupStandardsEn.join('. ')}`
                          }
                          lang={language}
                          textId={`detailed-ai-analysis-${currentDetailedGuide.id}`}
                          size="sm"
                          label={language === 'hi' ? 'विश्लेषण सुनें' : 'Listen AI Report'}
                        />
                      </div>
                    </div>

                    {/* 4 Pillars Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                        <h5 className="font-extrabold text-xs text-amber-400 uppercase tracking-wider">
                          1. {language === 'hi' ? 'व्यवस्था मानक (Setup Standards)' : 'Setup Standards'}
                        </h5>
                        <ul className="space-y-1.5 text-xs text-slate-300">
                          {(language === 'hi' ? analysis.setupStandardsHi : analysis.setupStandardsEn).map((item, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                        <h5 className="font-extrabold text-xs text-emerald-400 uppercase tracking-wider">
                          2. {language === 'hi' ? 'सफाई प्रक्रिया (Cleaning Procedure)' : 'Cleaning Procedure'}
                        </h5>
                        <ul className="space-y-1.5 text-xs text-slate-300">
                          {(language === 'hi' ? analysis.cleaningProcedureHi : analysis.cleaningProcedureEn).map((item, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                        <h5 className="font-extrabold text-xs text-blue-400 uppercase tracking-wider">
                          3. {language === 'hi' ? 'गुणवत्ता मानक (Quality Benchmarks)' : 'Quality Benchmarks'}
                        </h5>
                        <ul className="space-y-1.5 text-xs text-slate-300">
                          {(language === 'hi' ? analysis.qualityStandardsHi : analysis.qualityStandardsEn).map((item, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                        <h5 className="font-extrabold text-xs text-rose-400 uppercase tracking-wider">
                          4. {language === 'hi' ? 'गलतियां जिनसे बचें (Mistakes to Avoid)' : 'Mistakes to Avoid'}
                        </h5>
                        <ul className="space-y-1.5 text-xs text-slate-300">
                          {(language === 'hi' ? analysis.mistakesToAvoidHi : analysis.mistakesToAvoidEn).map((item, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-dashed border-slate-700 text-center text-xs text-slate-400">
                    {language === 'hi'
                      ? 'इस कमरे का AI विश्लेषण उपलब्ध नहीं है।'
                      : 'AI analysis has not been run for this room yet.'}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 4 Architectural Inspection Pillars (Static Guidelines) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pillar 1: Furniture & Seating */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {language === 'hi' ? 'फर्नीचर और कुर्सी की स्थिति' : 'Furniture & Chair Alignment'}
                  </h3>
                </div>
              </div>
              <ul className="space-y-2.5">
                {(language === 'hi' ? currentDetailedGuide.furniturePlacementHi : currentDetailedGuide.furniturePlacementEn).map(
                  (item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 leading-snug">
                      <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  )
                )}
              </ul>
            </div>

            {/* Pillar 2: Water & items */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {language === 'hi' ? 'पानी की बोतल व गिलास की जगह' : 'Water, Coaster & Glass Placement'}
                  </h3>
                </div>
              </div>
              <ul className="space-y-2.5">
                {(language === 'hi' ? currentDetailedGuide.waterAndItemsHi : currentDetailedGuide.waterAndItemsEn).map(
                  (item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 leading-snug">
                      <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  )
                )}
              </ul>
            </div>

            {/* Pillar 3: Cleaning standard */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {language === 'hi' ? 'सफाई और स्वच्छता मानक' : 'Cleaning & Hygiene Standards'}
                  </h3>
                </div>
              </div>
              <ul className="space-y-2.5">
                {(language === 'hi' ? currentDetailedGuide.cleaningStandardHi : currentDetailedGuide.cleaningStandardEn).map(
                  (item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 leading-snug">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  )
                )}
              </ul>
            </div>

            {/* Pillar 4: Lights & switches */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs">
                    4
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {language === 'hi' ? 'लाइट्स, स्विच और एसी नियम' : 'Lights, AC & Switchboard Rules'}
                  </h3>
                </div>
              </div>
              <ul className="space-y-2.5">
                {(language === 'hi' ? currentDetailedGuide.lightsAndSwitchesHi : currentDetailedGuide.lightsAndSwitchesEn).map(
                  (item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 leading-snug">
                      <span className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  )
                )}
              </ul>
            </div>
          </div>

          <div className="text-center pt-2">
            <button
              onClick={() => setViewMode('grid')}
              className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              {language === 'hi' ? '← सभी कमरों का डैशबोर्ड देखें' : '← Back to All Rooms Dashboard'}
            </button>
          </div>

        </div>
      )}

      {/* Pantry Boy Room Completion Modal */}
      {proofRoomModal && (
        <TaskCompleteModal
          task={{
            id: proofRoomModal.id,
            titleHi: `${proofRoomModal.titleHi} - कार्य संपन्न सत्यापन`,
            titleEn: `${proofRoomModal.titleEn} - Completion Proof`,
            category: proofRoomModal.category,
            roomNameHi: proofRoomModal.titleHi,
            roomNameEn: proofRoomModal.titleEn,
            scheduledTime: 'दैनिक (Daily)',
            assignedToUserId: currentUser?.id || 'pb-101',
            referencePhotoUrl: proofRoomModal.photoUrl,
            instructionsHi: `फर्नीचर: ${proofRoomModal.furnitureDetailsHi}. ${proofRoomModal.subtitleHi}`,
            instructionsEn: `Furniture: ${proofRoomModal.furnitureDetailsEn}. ${proofRoomModal.subtitleEn}`,
            audioTextHi: proofRoomModal.voiceScriptHi,
            audioTextEn: proofRoomModal.voiceScriptEn,
            status: 'pending',
          }}
          isOpen={!!proofRoomModal}
          onClose={() => setProofRoomModal(null)}
          currentUser={currentUser}
          onComplete={handleRoomProofSubmit}
          language={language}
        />
      )}

      {/* Interactive Lightbox / Zoom Modal (Multi-Photo Carousel) */}
      {currentLightboxPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/95 backdrop-blur-md animate-in fade-in"
          onClick={closeLightbox}
        >
          <div
            className="relative max-w-5xl max-h-[94vh] w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header info */}
            <div className="w-full flex items-center justify-between text-white pb-3 px-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  {lightboxRoomCategory?.replace(/_/g, ' ').toUpperCase()}
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs font-bold text-slate-200">
                  Angle {lightboxPhotoIndex + 1} of {activeLightboxPhotos.length}
                </span>
                {currentLightboxPhoto.isPrimary && (
                  <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px]">
                    Primary Standard
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {lightboxRoomCategory && (
                  <>
                    <button
                      onClick={handleStartLightboxReplace}
                      disabled={isReplacingLightbox}
                      className="px-3 py-1.5 rounded-lg bg-blue-600/90 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs disabled:opacity-60"
                      title={language === 'hi' ? 'नई फोटो से अपडेट करें (Update/Replace)' : 'Update or replace reference photo'}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isReplacingLightbox ? 'animate-spin' : ''}`} />
                      <span>{language === 'hi' ? 'फोटो अपडेट करें' : 'Update Photo'}</span>
                    </button>
                    <button
                      onClick={() => handleDeletePhotoItem(lightboxRoomCategory, currentLightboxPhoto.id, undefined, currentLightboxPhoto.url)}
                      className="px-3 py-1.5 rounded-lg bg-red-600/90 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                      title={language === 'hi' ? 'यह संदर्भ फोटो हटाएं' : 'Delete reference photo'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{language === 'hi' ? 'फोटो हटाएं' : 'Delete Photo'}</span>
                    </button>
                  </>
                )}
                <button
                  onClick={closeLightbox}
                  className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Main Image Container with Next / Prev Buttons */}
            <div className="relative w-full flex items-center justify-center min-h-[300px] max-h-[72vh] overflow-hidden rounded-2xl bg-black/50">
              <ReferenceImage
                src={currentLightboxPhoto.url}
                alt="Room Reference Angle"
                language={language}
                className="max-h-[72vh] w-auto max-w-full object-contain rounded-xl shadow-2xl"
              />

              {/* Prev Button */}
              {activeLightboxPhotos.length > 1 && (
                <button
                  onClick={() =>
                    setLightboxPhotoIndex((prev) =>
                      prev === 0 ? activeLightboxPhotos.length - 1 : prev - 1
                    )
                  }
                  className="absolute left-3 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-xs transition-colors cursor-pointer"
                  title="Previous Angle"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              {/* Next Button */}
              {activeLightboxPhotos.length > 1 && (
                <button
                  onClick={() =>
                    setLightboxPhotoIndex((prev) =>
                      prev === activeLightboxPhotos.length - 1 ? 0 : prev + 1
                    )
                  }
                  className="absolute right-3 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-xs transition-colors cursor-pointer"
                  title="Next Angle"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* Caption & Thumbnail Tray */}
            <div className="w-full mt-3 text-center space-y-2">
              <p className="text-xs sm:text-sm font-semibold text-slate-200 bg-black/60 px-4 py-2 rounded-xl inline-block max-w-2xl">
                {language === 'hi'
                  ? currentLightboxPhoto.captionHi || currentLightboxPhoto.captionEn || 'आधिकारिक संदर्भ फोटो'
                  : currentLightboxPhoto.captionEn || currentLightboxPhoto.captionHi || 'Official Reference Photo'}
              </p>

              {lightboxErrorMsg && (
                <div className="text-xs font-bold text-rose-300 bg-rose-950/80 border border-rose-700 px-3 py-1.5 rounded-lg inline-block">
                  {lightboxErrorMsg}
                </div>
              )}

              {/* Thumbnail Strip */}
              {activeLightboxPhotos.length > 1 && (
                <div className="flex items-center justify-center gap-2 overflow-x-auto py-1">
                  {activeLightboxPhotos.map((p, idx) => (
                    <button
                      key={p.id}
                      onClick={() => setLightboxPhotoIndex(idx)}
                      className={`w-12 h-9 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                        idx === lightboxPhotoIndex
                          ? 'border-amber-400 scale-105 shadow-md'
                          : 'border-slate-700 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <ReferenceImage src={p.url} alt="" language={language} compact className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Update Reference Photo Confirmation Modal */}
      <UpdatePhotoConfirmModal
        isOpen={pendingLightboxUpdate !== null}
        onClose={() => {
          if (!isReplacingLightbox) {
            setPendingLightboxUpdate(null);
          }
        }}
        onConfirm={handleExecuteLightboxUpdate}
        isUpdating={isReplacingLightbox}
        language={language}
        roomName={pendingLightboxUpdate?.roomName}
        currentPhotoUrl={pendingLightboxUpdate?.currentPhotoUrl}
        newPhotoPreview={pendingLightboxUpdate?.newPhotoPreview}
      />

      {/* Delete Photo Confirmation Modal */}
      <DeletePhotoConfirmModal
        isOpen={photoToDelete !== null}
        onClose={() => {
          if (!isDeletingPhoto) {
            setPhotoToDelete(null);
            setDeletePhotoError(null);
          }
        }}
        onConfirm={handleConfirmDeletePhoto}
        isDeleting={isDeletingPhoto}
        language={language}
        photoUrl={photoToDelete?.url}
        roomName={photoToDelete?.roomName}
        angleIndex={photoToDelete?.index}
        totalPhotos={photoToDelete?.totalPhotos}
        error={deletePhotoError}
      />

      {/* Date-Wise Room Photo History Modal */}
      {historyModalRoom && (
        <DateHistoryModal
          isOpen={true}
          onClose={() => setHistoryModalRoom(null)}
          mode="room"
          roomId={historyModalRoom.roomId}
          roomLabel={historyModalRoom.roomLabel}
          currentUser={currentUser}
          language={language}
          onDeleted={() => {
            setRefreshTick((t) => t + 1);
            onRefreshData?.();
          }}
        />
      )}

    </div>
  );
};
