import React, { useState, useRef, useEffect } from 'react';
import { User, VisualGuide, DailyTask, RoomCategory, Language, RoomPhotoItem, AIRoomAnalysis, CompletionPhotoItem } from '../types';
import { StorageService, fileToDataUrl } from '../services/storageService';
import { AITrainingService } from '../services/aiTrainingService';
import { VoiceButton } from './VoiceButton';
import {
  Shield,
  ShieldCheck,
  Calendar,
  UserPlus,
  Trash2,
  Edit3,
  Camera,
  Upload,
  PlusCircle,
  RotateCcw,
  CheckCircle2,
  Users,
  Image as ImageIcon,
  CheckSquare,
  Lock,
  Clock,
  Sparkles,
  Star,
  Maximize2,
  RefreshCw,
  X,
  AlertCircle,
  HelpCircle,
  Layers,
  ChevronRight,
  Info,
  Check,
} from 'lucide-react';

interface AdminSectionProps {
  users: User[];
  guides: VisualGuide[];
  tasks: DailyTask[];
  currentUser: User | null;
  language: Language;
  onRefreshData: () => void;
  onSelectGuideForEdit?: (guide: VisualGuide) => void;
}

interface StagedPhoto {
  id: string;
  file: File;
  base64: string;
  captionHi: string;
  captionEn: string;
  photoType: 'reference' | 'incorrect';
  isPrimary: boolean;
}

export const AdminSection: React.FC<AdminSectionProps> = ({
  users,
  guides,
  tasks,
  currentUser,
  language,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'galleries' | 'users' | 'create_task' | 'completion_photos'>('galleries');

  // Completion Photos & 40-Day Retention Audit state
  const [allCompletionPhotos, setAllCompletionPhotos] = useState<CompletionPhotoItem[]>([]);
  const [completionFilterRoom, setCompletionFilterRoom] = useState<string>('all');
  const [completionFilterStaff, setCompletionFilterStaff] = useState<string>('all');
  const [retentionAudit, setRetentionAudit] = useState<any>(null);
  const [isLoadingCompletion, setIsLoadingCompletion] = useState(false);
  const [cleanupToast, setCleanupToast] = useState<string | null>(null);
  const [previewCompletionPhoto, setPreviewCompletionPhoto] = useState<CompletionPhotoItem | null>(null);

  // Room / Guide selector
  const [selectedGuideId, setSelectedGuideId] = useState<string>(() => guides[0]?.id || '');
  const selectedGuide = guides.find((g) => g.id === selectedGuideId) || guides[0];
  const selectedCategory = selectedGuide?.category || 'reception';

  // Room gallery state
  const [roomPhotos, setRoomPhotos] = useState<RoomPhotoItem[]>([]);
  const [roomAnalysis, setRoomAnalysis] = useState<AIRoomAnalysis | null>(null);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  // Multi-photo upload staging
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([]);
  const [isUploadingMultiple, setIsUploadingMultiple] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState<string | null>(null);

  // Single photo replacement
  const [replacingPhotoId, setReplacingPhotoId] = useState<string | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);

  // Caption editing
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [captionHiInput, setCaptionHiInput] = useState('');
  const [captionEnInput, setCaptionEnInput] = useState('');

  // Photo preview modal (lightbox)
  const [previewPhoto, setPreviewPhoto] = useState<RoomPhotoItem | null>(null);

  // AI Multi-Photo Analysis
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [aiErrorMsg, setAiErrorMsg] = useState<string | null>(null);
  const [aiSuccessMsg, setAiSuccessMsg] = useState<string | null>(null);

  // Guide editor fields
  const [editTitleHi, setEditTitleHi] = useState(() => selectedGuide?.titleHi || '');
  const [editTitleEn, setEditTitleEn] = useState(() => selectedGuide?.titleEn || '');
  const [editFurnitureHi, setEditFurnitureHi] = useState(() => selectedGuide?.furnitureDetailsHi || '');
  const [editFurnitureEn, setEditFurnitureEn] = useState(() => selectedGuide?.furnitureDetailsEn || '');
  const [editVoiceHi, setEditVoiceHi] = useState(() => selectedGuide?.voiceScriptHi || '');
  const [editVoiceEn, setEditVoiceEn] = useState(() => selectedGuide?.voiceScriptEn || '');
  const [guideSuccessMsg, setGuideSuccessMsg] = useState<string | null>(null);

  // Refs
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // User form state
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPin, setNewUserPin] = useState('1234');
  const [newUserShift, setNewUserShift] = useState('Morning (8:30 AM - 5:30 PM)');
  const [userSuccessMsg, setUserSuccessMsg] = useState<string | null>(null);

  // Task Creator state
  const [taskTitleHi, setTaskTitleHi] = useState('');
  const [taskTitleEn, setTaskTitleEn] = useState('');
  const [taskCategory, setTaskCategory] = useState<RoomCategory>('reception');
  const [taskRoomHi, setTaskRoomHi] = useState('RECEPTION AREA');
  const [taskRoomEn, setTaskRoomEn] = useState('RECEPTION AREA');
  const [taskTime, setTaskTime] = useState('11:00 AM');
  const [taskAssignedUser, setTaskAssignedUser] = useState<string>('pb-101');
  const [taskInstructionsHi, setTaskInstructionsHi] = useState('');
  const [taskInstructionsEn, setTaskInstructionsEn] = useState('');
  const [taskPhotoUrl, setTaskPhotoUrl] = useState('');
  const [taskSuccessMsg, setTaskSuccessMsg] = useState<string | null>(null);

  // Fetch photos & analysis for the currently selected room
  const loadCurrentRoomData = async (cat: string) => {
    setLoadingPhotos(true);
    try {
      const res = await AITrainingService.getRoomPhotos(cat);
      setRoomPhotos(res.photos || []);
      setRoomAnalysis(res.analysis || null);
      StorageService.setRoomPhotos(cat, res.photos || []);
      if (res.analysis) {
        StorageService.setRoomAnalysis(cat, res.analysis);
      }
    } catch (e) {
      console.warn('Failed to fetch room photos:', e);
      // Fallback to locally cached
      setRoomPhotos(StorageService.getRoomPhotos(cat));
      setRoomAnalysis(StorageService.getRoomAnalysis(cat));
    } finally {
      setLoadingPhotos(false);
    }
  };

  const loadCompletionAuditData = async () => {
    setIsLoadingCompletion(true);
    try {
      const [photos, status] = await Promise.all([
        AITrainingService.getCompletionPhotos(),
        AITrainingService.getRetentionStatus().catch(() => null),
      ]);
      setAllCompletionPhotos(photos);
      setRetentionAudit(status);
    } catch (e) {
      console.warn('Failed to load completion audit data in Admin:', e);
    } finally {
      setIsLoadingCompletion(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'completion_photos') {
      loadCompletionAuditData();
    }
  }, [activeTab]);

  const handleRunAdminCleanup = async () => {
    try {
      setCleanupToast(language === 'hi' ? 'सफाई चल रही है...' : 'Running 40-day cleanup...');
      const res = await AITrainingService.triggerManualCleanup(currentUser);
      setCleanupToast(
        language === 'hi'
          ? `${res.result.deletedCount} समाप्त फोटो हटाई गईं। ${res.result.remainingCount} फोटो 40-दिन की सीमा में सुरक्षित हैं।`
          : `Cleaned up ${res.result.deletedCount} expired photos. ${res.result.remainingCount} active photos remaining within 40-day window.`
      );
      await loadCompletionAuditData();
      onRefreshData();
      setTimeout(() => setCleanupToast(null), 5000);
    } catch (err: any) {
      setCleanupToast(err.message || 'Cleanup failed');
    }
  };

  const handleDeleteCompletionItem = async (photoId: string, taskId?: string) => {
    if (!window.confirm(language === 'hi' ? 'क्या आप इस समाप्ति फोटो को सर्वर से हमेशा के लिए हटाना चाहते हैं?' : 'Permanently delete this completion photo from server storage?')) return;
    try {
      const res = await AITrainingService.deleteCompletionPhoto({ photoId, taskId, user: currentUser });
      if (res.success) {
        StorageService.deleteCompletionPhotoFromStorage(photoId, taskId);
        setAllCompletionPhotos((prev) => prev.filter((p) => p.id !== photoId));
        if (previewCompletionPhoto?.id === photoId) setPreviewCompletionPhoto(null);
        await loadCompletionAuditData();
        onRefreshData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete completion photo');
    }
  };

  useEffect(() => {
    if (selectedGuide) {
      setEditTitleHi(selectedGuide.titleHi);
      setEditTitleEn(selectedGuide.titleEn);
      setEditFurnitureHi(selectedGuide.furnitureDetailsHi || '');
      setEditFurnitureEn(selectedGuide.furnitureDetailsEn || '');
      setEditVoiceHi(selectedGuide.voiceScriptHi);
      setEditVoiceEn(selectedGuide.voiceScriptEn);
      setGuideSuccessMsg(null);
      setStagedPhotos([]);
      loadCurrentRoomData(selectedGuide.category);
    }
  }, [selectedGuideId, selectedGuide]);

  // Handle selecting MULTIPLE files at once
  const handleSelectMultipleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const newStaged: StagedPhoto[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        const base64 = await fileToDataUrl(file);
        const indexNum = roomPhotos.length + stagedPhotos.length + i + 1;
        newStaged.push({
          id: `staged_${Date.now()}_${i}`,
          file,
          base64,
          captionHi: `${selectedGuide?.titleHi || 'कमरा'} - संदर्भ कोण #${indexNum}`,
          captionEn: `${selectedGuide?.titleEn || 'Room'} - Reference Angle #${indexNum}`,
          photoType: 'reference',
          isPrimary: roomPhotos.length === 0 && i === 0,
        });
      } catch (err) {
        console.error('Error processing file:', file.name, err);
      }
    }

    setStagedPhotos((prev) => [...prev, ...newStaged]);
    if (multiFileInputRef.current) {
      multiFileInputRef.current.value = '';
    }
  };

  // Remove photo from staging queue
  const handleRemoveStagedPhoto = (id: string) => {
    setStagedPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // Upload all staged photos to backend storage permanently
  const handleUploadStagedPhotos = async () => {
    if (stagedPhotos.length === 0 || !selectedGuide) return;

    setIsUploadingMultiple(true);
    setUploadProgressMsg(
      language === 'hi'
        ? `${stagedPhotos.length} फोटो सर्वर पर स्थायी रूप से सहेजे जा रहे हैं...`
        : `Permanently saving ${stagedPhotos.length} photos to server storage...`
    );

    try {
      const payload = stagedPhotos.map((p) => ({
        photoBase64: p.base64,
        captionHi: p.captionHi,
        captionEn: p.captionEn,
        photoType: p.photoType,
        isPrimary: p.isPrimary,
      }));

      const res = await AITrainingService.uploadMultipleRoomPhotos({
        category: selectedGuide.category,
        roomName: selectedGuide.titleEn,
        photos: payload,
        user: currentUser,
      });

      if (res.success) {
        setRoomPhotos(res.photos);
        StorageService.setRoomPhotos(selectedGuide.category, res.photos);
        setStagedPhotos([]);
        setUploadProgressMsg(null);
        setGuideSuccessMsg(
          language === 'hi'
            ? `सफलतापूर्वक ${payload.length} फोटो गैलरी में जोड़े गए और स्थायी रूप से सुरक्षित हो गए!`
            : `Successfully added and saved ${payload.length} photos to ${selectedGuide.titleEn} gallery!`
        );
        onRefreshData();
        setTimeout(() => setGuideSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to upload photos. Ensure Admin permissions.');
    } finally {
      setIsUploadingMultiple(false);
      setUploadProgressMsg(null);
    }
  };

  // Set single photo as Primary Standard
  const handleSetPrimary = async (photoId: string) => {
    if (!selectedGuide) return;
    try {
      const res = await AITrainingService.setPrimaryRoomPhoto(selectedGuide.category, photoId, currentUser);
      if (res.success) {
        setRoomPhotos(res.photos);
        StorageService.setRoomPhotos(selectedGuide.category, res.photos);
        const primary = res.photos.find((p) => p.isPrimary);
        if (primary) {
          StorageService.updateRoomReferencePhoto(selectedGuide.id, primary.url, currentUser?.name || 'Admin');
        }
        setGuideSuccessMsg(
          language === 'hi'
            ? 'मुख्य मानक फोटो सफलतापूर्वक सेट कर दिया गया है!'
            : 'Primary official reference photo updated!'
        );
        onRefreshData();
        setTimeout(() => setGuideSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to set primary photo');
    }
  };

  // Replace single photo
  const handleStartReplace = (photoId: string) => {
    setReplacingPhotoId(photoId);
    if (replaceInputRef.current) {
      replaceInputRef.current.value = '';
      replaceInputRef.current.click();
    }
  };

  const handleConfirmReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replacingPhotoId || !selectedGuide) return;

    setIsReplacing(true);
    try {
      const base64 = await fileToDataUrl(file);
      const existing = roomPhotos.find((p) => p.id === replacingPhotoId);

      const res = await AITrainingService.replaceRoomPhotoItem({
        category: selectedGuide.category,
        photoId: replacingPhotoId,
        photoBase64: base64,
        captionHi: existing?.captionHi,
        captionEn: existing?.captionEn,
        user: currentUser,
      });

      if (res.success) {
        setRoomPhotos(res.photos);
        StorageService.setRoomPhotos(selectedGuide.category, res.photos);
        setGuideSuccessMsg(
          language === 'hi'
            ? 'फोटो सफलतापूर्वक बदल दिया गया और स्थायी रूप से सहेज लिया गया!'
            : 'Photo successfully replaced and saved permanently!'
        );
        onRefreshData();
        setTimeout(() => setGuideSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to replace photo');
    } finally {
      setIsReplacing(false);
      setReplacingPhotoId(null);
    }
  };

  // Delete single photo
  const handleDeletePhoto = async (photoId: string) => {
    if (!selectedGuide) return;
    const confirmMsg =
      language === 'hi'
        ? 'क्या आप इस फोटो को गैलरी से हमेशा के लिए हटाना चाहते हैं?'
        : 'Are you sure you want to permanently delete this photo from the room gallery?';

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await AITrainingService.deleteRoomPhotoItem(selectedGuide.category, photoId, currentUser);
      if (res.success) {
        setRoomPhotos(res.photos);
        StorageService.setRoomPhotos(selectedGuide.category, res.photos);
        if (previewPhoto?.id === photoId) {
          setPreviewPhoto(null);
        }
        setGuideSuccessMsg(
          language === 'hi' ? 'फोटो सफलतापूर्वक हटा दिया गया है!' : 'Photo deleted successfully!'
        );
        onRefreshData();
        setTimeout(() => setGuideSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete photo');
    }
  };

  // Update Caption
  const handleSaveCaption = async (photoId: string) => {
    if (!selectedGuide) return;
    try {
      const res = await AITrainingService.updateRoomPhotoCaption({
        category: selectedGuide.category,
        photoId,
        captionHi: captionHiInput.trim(),
        captionEn: captionEnInput.trim(),
        user: currentUser,
      });
      if (res.success) {
        setRoomPhotos(res.photos);
        StorageService.setRoomPhotos(selectedGuide.category, res.photos);
        setEditingCaptionId(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update caption');
    }
  };

  // Trigger AI Multi-Photo Room Analysis
  const handleRunAIAnalysis = async () => {
    if (!selectedGuide) return;
    if (roomPhotos.length === 0) {
      alert(
        language === 'hi'
          ? 'कृपया विश्लेषण से पहले कम से कम एक संदर्भ फोटो अपलोड करें।'
          : 'Please upload at least one reference photo before triggering AI analysis.'
      );
      return;
    }

    setIsAnalyzingAI(true);
    setAiErrorMsg(null);
    setAiSuccessMsg(null);

    try {
      const res = await AITrainingService.analyzeRoomPhotosWithAI(
        selectedGuide.category,
        selectedGuide.titleEn,
        currentUser
      );
      if (res.success) {
        setRoomAnalysis(res.analysis);
        StorageService.setRoomAnalysis(selectedGuide.category, res.analysis);
        setAiSuccessMsg(
          language === 'hi'
            ? `एआई ने ${roomPhotos.length} फोटो के सभी कोणों का सफलतापूर्वक विश्लेषण कर लिया!`
            : `AI analyzed all ${roomPhotos.length} reference photos together!`
        );
        onRefreshData();
        setTimeout(() => setAiSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      console.error(err);
      setAiErrorMsg(err.message || 'AI analysis failed');
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  // Save Guide textual details & voice script
  const handleSaveGuide = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGuide) return;

    const updated: VisualGuide = {
      ...selectedGuide,
      titleHi: editTitleHi,
      titleEn: editTitleEn,
      furnitureDetailsHi: editFurnitureHi,
      furnitureDetailsEn: editFurnitureEn,
      voiceScriptHi: editVoiceHi,
      voiceScriptEn: editVoiceEn,
      updatedAt: new Date().toISOString(),
    };

    StorageService.updateVisualGuide(updated);
    setGuideSuccessMsg(
      language === 'hi'
        ? 'गाइड विवरण व ऑडियो स्क्रिप्ट सफलतापूर्वक सहेज ली गई!'
        : 'Room details and voice audio script updated successfully!'
    );
    onRefreshData();
    setTimeout(() => setGuideSuccessMsg(null), 3000);
  };

  // Handle Add User
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserUsername.trim() || !newUserPin.trim()) return;

    const newUser: User = {
      id: `pb-${Date.now()}`,
      name: newUserName.trim(),
      nameHi: newUserName.trim(),
      username: newUserUsername.trim().toUpperCase(),
      pin: newUserPin.trim(),
      role: 'pantry_boy',
      shift: newUserShift,
      shiftHi: newUserShift.includes('Morning') ? 'सुबह की शिफ्ट' : 'शाम की शिफ्ट',
      avatarColor: 'bg-teal-600',
    };

    StorageService.addUser(newUser);
    setNewUserName('');
    setNewUserUsername('');
    setNewUserPin('1234');
    setUserSuccessMsg(language === 'hi' ? 'नया पैंट्री बॉय सफलतापूर्वक जोड़ा गया!' : 'New pantry boy added successfully!');
    onRefreshData();
    setTimeout(() => setUserSuccessMsg(null), 3000);
  };

  const handleDeleteUser = (userId: string) => {
    if (window.confirm(language === 'hi' ? 'क्या आप इस उपयोगकर्ता को हटाना चाहते हैं?' : 'Are you sure you want to delete this user?')) {
      StorageService.deleteUser(userId);
      onRefreshData();
    }
  };

  // Handle Task Create
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitleHi.trim() || !taskInstructionsHi.trim()) return;

    const chosenPhoto = taskPhotoUrl || selectedGuide?.photoUrl || '/src/assets/images/office_pantry_setup_1793614167563.jpg';

    const newTask: DailyTask = {
      id: `task-${Date.now()}`,
      titleHi: taskTitleHi.trim(),
      titleEn: taskTitleEn.trim() || taskTitleHi.trim(),
      category: taskCategory,
      roomNameHi: taskRoomHi.trim(),
      roomNameEn: taskRoomEn.trim() || taskRoomHi.trim(),
      scheduledTime: taskTime,
      assignedToUserId: taskAssignedUser,
      referencePhotoUrl: chosenPhoto,
      instructionsHi: taskInstructionsHi.trim(),
      instructionsEn: taskInstructionsEn.trim() || taskInstructionsHi.trim(),
      audioTextHi: `${taskTitleHi}. ${taskInstructionsHi}`,
      audioTextEn: `${taskTitleEn}. ${taskInstructionsEn}`,
      status: 'pending',
    };

    StorageService.addTask(newTask);
    setTaskTitleHi('');
    setTaskTitleEn('');
    setTaskInstructionsHi('');
    setTaskInstructionsEn('');
    setTaskPhotoUrl('');
    setTaskSuccessMsg(language === 'hi' ? 'नया कार्य सफलतापूर्वक असाइन किया गया!' : 'Task created and assigned successfully!');
    onRefreshData();
    setTimeout(() => setTaskSuccessMsg(null), 3000);
  };

  const handleResetDefaults = () => {
    if (
      window.confirm(
        language === 'hi'
          ? 'क्या आप संपूर्ण ऐप का डेटा मूल डिफ़ॉल्ट पर रीसेट करना चाहते हैं?'
          : 'Reset all application data back to default realistic office state?'
      )
    ) {
      StorageService.resetAllToDefault();
      onRefreshData();
    }
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Hidden file input for replacing single photo */}
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleConfirmReplace}
      />

      {/* Admin Header */}
      <div className="bg-slate-900 text-white p-5 sm:p-6 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wide mb-1">
            <Shield className="w-4 h-4" />
            <span>{language === 'hi' ? 'प्रशासनिक नियंत्रण कक्ष' : 'Administrative Management'}</span>
            <span>•</span>
            <span className="text-emerald-400 font-mono">ADMIN AUTHENTICATED</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black">
            {language === 'hi' ? 'संदर्भ फोटो व प्रशिक्षण केंद्र (Admin Hub)' : 'Reference Photos & Training Hub'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
            {language === 'hi'
              ? 'प्रत्येक कमरे के लिए एक साथ कई संदर्भ फोटो अपलोड करें, अलग-अलग गैलरी प्रबंधित करें, और एआई द्वारा 360° स्वच्छता व सेटअप विश्लेषण चलाएं।'
              : 'Upload multiple reference photos per room at once, manage separate galleries, replace/delete individual photos, and trigger AI multimodal analysis.'}
          </p>
        </div>

        <button
          onClick={handleResetDefaults}
          className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 text-amber-400" />
          <span>{language === 'hi' ? 'डेटा रीसेट करें' : 'Reset Defaults'}</span>
        </button>
      </div>

      {/* Admin Subtabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-xl overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('galleries')}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[40px] ${
            activeTab === 'galleries' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ImageIcon className="w-4 h-4 text-slate-950" />
          <span>{language === 'hi' ? 'रूम फोटो गैलरी व AI विश्लेषण' : 'Room Photo Galleries & AI'}</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[40px] ${
            activeTab === 'users' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4 text-blue-600" />
          <span>{language === 'hi' ? 'स्टाफ प्रबंधन (Staff Users)' : 'Staff Management'}</span>
        </button>

        <button
          onClick={() => setActiveTab('create_task')}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[40px] ${
            activeTab === 'create_task' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CheckSquare className="w-4 h-4 text-emerald-600" />
          <span>{language === 'hi' ? 'नया कार्य असाइन करें' : 'Create & Assign Task'}</span>
        </button>

        <button
          onClick={() => setActiveTab('completion_photos')}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[40px] ${
            activeTab === 'completion_photos' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{language === 'hi' ? 'कार्य समाप्ति फोटो व 40-दिन ऑडिट' : 'Completion Photos & 40d Audit'}</span>
          {allCompletionPhotos.length > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              activeTab === 'completion_photos' ? 'bg-emerald-950 text-emerald-300' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {allCompletionPhotos.length}
            </span>
          )}
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: ROOM PHOTO GALLERIES & MULTIMODAL AI ANALYSIS     */}
      {/* ======================================================== */}
      {activeTab === 'galleries' && (
        <div className="space-y-6">
          
          {/* Room Selector Pills Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-slate-950 text-base sm:text-lg flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-500" />
                  <span>{language === 'hi' ? 'कमरा चुनें (Select Room Gallery)' : 'Select Room Gallery'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'hi'
                    ? 'प्रत्येक कमरे की अपनी स्वतंत्र फोटो गैलरी है। नीचे से कोई भी कमरा चुनें:'
                    : 'Each room has its own separate gallery. Select a room to view and manage its photos:'}
                </p>
              </div>

              {selectedGuide && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-950">
                  <span>🛋️ {language === 'hi' ? 'फर्नीचर:' : 'Furniture:'}</span>
                  <span className="font-extrabold text-slate-900">
                    {language === 'hi' ? selectedGuide.furnitureDetailsHi : selectedGuide.furnitureDetailsEn}
                  </span>
                </div>
              )}
            </div>

            {/* Room Selector Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-2">
              {guides.map((g) => {
                const isSelected = g.id === selectedGuideId;
                const photoCount = (g.photos && g.photos.length > 0)
                  ? g.photos.length
                  : (StorageService.getRoomPhotos(g.category).length || 1);

                return (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGuideId(g.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[64px] ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10 shadow-xs ring-2 ring-amber-500/30'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-950 line-clamp-1">
                      {language === 'hi' ? g.titleHi : g.titleEn}
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[11px]">
                      <span className="font-bold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded">
                        📸 {photoCount} {language === 'hi' ? 'फोटो' : 'Photos'}
                      </span>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-amber-500"></span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toast Messages */}
          {guideSuccessMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{guideSuccessMsg}</span>
            </div>
          )}

          {/* Section 1: Upload Multiple Photos at Once Dropzone */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-extrabold text-slate-950 text-base flex items-center gap-2">
                  <Upload className="w-5 h-5 text-amber-600" />
                  <span>
                    {language === 'hi'
                      ? `एक साथ कई फोटो अपलोड करें (${selectedGuide?.titleHi})`
                      : `Upload Multiple Photos at Once (${selectedGuide?.titleEn})`}
                  </span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'hi'
                    ? 'एक ही बार में कई फोटो चुनें। मौजूदा फोटो सुरक्षित रहेंगे और नए फोटो स्थायी रूप से जुड़ जाएंगे।'
                    : 'Select multiple photos in one go. Existing photos are preserved, and new photos are saved permanently to backend storage.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => multiFileInputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs min-h-[42px] self-start sm:self-auto"
              >
                <Camera className="w-4 h-4" />
                <span>{language === 'hi' ? 'कई फोटो चुनें (Select Multiple)' : 'Select Multiple Photos'}</span>
              </button>
            </div>

            {/* Hidden Multiple File Input */}
            <input
              ref={multiFileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleSelectMultipleFiles}
            />

            {/* Drag & Drop Visual Box */}
            <div
              onClick={() => multiFileInputRef.current?.click()}
              className="border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/40 rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-colors group"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <p className="font-bold text-sm text-slate-900">
                {language === 'hi'
                  ? 'यहां क्लिक करके एक साथ कई संदर्भ फोटो चुनें (Multi-Select Supported)'
                  : 'Click here or drag & drop to choose multiple photos at once'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                PNG, JPG, WEBP • {language === 'hi' ? 'बिना किसी सीमा के अतिरिक्त फोटो जोड़ें' : 'Add additional angle photos anytime'}
              </p>
            </div>

            {/* Staged Photos Preview Tray (Before Submitting) */}
            {stagedPhotos.length > 0 && (
              <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center">
                      {stagedPhotos.length}
                    </span>
                    <span className="font-bold text-sm text-slate-900">
                      {language === 'hi' ? 'अपलोड के लिए तैयार फोटो' : 'Photos Ready to Upload'}
                    </span>
                  </div>

                  <button
                    onClick={() => setStagedPhotos([])}
                    className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    {language === 'hi' ? 'सभी हटाएं' : 'Clear All'}
                  </button>
                </div>

                {/* Staged Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {stagedPhotos.map((item, idx) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs space-y-2 relative"
                    >
                      <button
                        onClick={() => handleRemoveStagedPhoto(item.id)}
                        className="absolute top-2 right-2 p-1 rounded-full bg-slate-900/70 hover:bg-rose-600 text-white transition-colors cursor-pointer z-10"
                        title="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      <div className="aspect-16/10 rounded-lg overflow-hidden bg-slate-100">
                        <img
                          src={item.base64}
                          alt="Staged"
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                          {language === 'hi' ? 'कैप्शन (हिंदी)' : 'Caption (Hindi)'}
                        </label>
                        <input
                          type="text"
                          value={item.captionHi}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStagedPhotos((prev) =>
                              prev.map((p) => (p.id === item.id ? { ...p, captionHi: val } : p))
                            );
                          }}
                          className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.isPrimary}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setStagedPhotos((prev) =>
                                prev.map((p) => ({
                                  ...p,
                                  isPrimary: p.id === item.id ? checked : false,
                                }))
                              );
                            }}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span>{language === 'hi' ? 'मुख्य मानक बनाएं' : 'Make Primary'}</span>
                        </label>

                        <span className="text-[10px] text-slate-400">#Angle {idx + 1}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Upload Button */}
                <button
                  type="button"
                  onClick={handleUploadStagedPhotos}
                  disabled={isUploadingMultiple}
                  className="w-full py-3.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-900 text-white font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-60 min-h-[46px]"
                >
                  {isUploadingMultiple ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                      <span>{uploadProgressMsg || 'Uploading photos...'}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-amber-400" />
                      <span>
                        {language === 'hi'
                          ? `ये सभी ${stagedPhotos.length} फोटो ${selectedGuide?.titleHi} गैलरी में स्थायी रूप से सहेजें`
                          : `Save all ${stagedPhotos.length} photos permanently to ${selectedGuide?.titleEn} gallery`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Section 2: Room Separate Gallery Grid (All Current Photos) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-extrabold text-slate-950 text-base flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-blue-600" />
                  <span>
                    {language === 'hi'
                      ? `${selectedGuide?.titleHi} - वर्तमान गैलरी (${roomPhotos.length} फोटो)`
                      : `${selectedGuide?.titleEn} - Current Gallery (${roomPhotos.length} Photos)`}
                  </span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'hi'
                    ? 'प्रत्येक फोटो का पूर्वावलोकन करें, बदलें, हटाएं या मुख्य संदर्भ के रूप में सेट करें।'
                    : 'Preview individual photos, replace image, delete photo, or set as primary standard.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => multiFileInputRef.current?.click()}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4 text-emerald-600" />
                  <span>{language === 'hi' ? 'और फोटो जोड़ें' : 'Add More Photos'}</span>
                </button>
              </div>
            </div>

            {loadingPhotos ? (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                <span className="text-xs font-bold">{language === 'hi' ? 'गैलरी लोड हो रही है...' : 'Loading room gallery...'}</span>
              </div>
            ) : roomPhotos.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Camera className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-bold text-slate-700">
                  {language === 'hi' ? 'इस कमरे में कोई संदर्भ फोटो नहीं है' : 'No photos in this room gallery yet'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {language === 'hi'
                    ? 'ऊपर दिए गए बटन से वास्तविक ऑफिस के फोटो अपलोड करें।'
                    : 'Use the upload button above to add reference photos.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {roomPhotos.map((photo, index) => {
                  const isPrimary = Boolean(photo.isPrimary);
                  const isEditingThisCaption = editingCaptionId === photo.id;

                  return (
                    <div
                      key={photo.id}
                      className={`bg-slate-50 rounded-2xl border overflow-hidden transition-all flex flex-col justify-between ${
                        isPrimary ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/20' : 'border-slate-200'
                      }`}
                    >
                      <div>
                        {/* Photo Thumbnail */}
                        <div className="relative aspect-16/10 bg-slate-200 overflow-hidden group">
                          <img
                            src={photo.url}
                            alt={photo.captionEn || `Photo ${index + 1}`}
                            className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300 cursor-pointer"
                            onClick={() => setPreviewPhoto(photo)}
                          />

                          {/* Primary Badge */}
                          {isPrimary && (
                            <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[11px] shadow-sm flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 fill-slate-950" />
                              <span>{language === 'hi' ? 'मुख्य मानक' : 'Primary'}</span>
                            </div>
                          )}

                          {/* Zoom Button */}
                          <button
                            onClick={() => setPreviewPhoto(photo)}
                            className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs transition-colors cursor-pointer"
                            title="Preview Fullscreen"
                          >
                            <Maximize2 className="w-4 h-4" />
                          </button>

                          {/* Angle Index Badge */}
                          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-xs text-white text-[10px] font-mono">
                            Angle #{index + 1}
                          </div>
                        </div>

                        {/* Captions */}
                        <div className="p-3.5 space-y-2">
                          {isEditingThisCaption ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={captionHiInput}
                                onChange={(e) => setCaptionHiInput(e.target.value)}
                                placeholder="कैप्शन (हिंदी)"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                              />
                              <input
                                type="text"
                                value={captionEnInput}
                                onChange={(e) => setCaptionEnInput(e.target.value)}
                                placeholder="Caption (English)"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                              />
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  onClick={() => handleSaveCaption(photo.id)}
                                  className="px-2.5 py-1 rounded-md bg-slate-900 text-white text-xs font-bold"
                                >
                                  {language === 'hi' ? 'सहेजें' : 'Save'}
                                </button>
                                <button
                                  onClick={() => setEditingCaptionId(null)}
                                  className="px-2.5 py-1 rounded-md border text-slate-600 text-xs"
                                >
                                  {language === 'hi' ? 'रद्द करें' : 'Cancel'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs font-bold text-slate-900 line-clamp-2">
                                {language === 'hi'
                                  ? photo.captionHi || photo.captionEn || 'संदर्भ फोटो'
                                  : photo.captionEn || photo.captionHi || 'Reference Photo'}
                              </p>
                              <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                                <span>{photo.uploadedBy || 'Admin'}</span>
                                <span>{new Date(photo.uploadedAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Photo Actions Bar */}
                      <div className="p-3 bg-white border-t border-slate-200/80 flex items-center justify-between gap-1.5">
                        {!isPrimary ? (
                          <button
                            onClick={() => handleSetPrimary(photo.id)}
                            className="px-2 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                            title="Set as primary reference photo for this room"
                          >
                            <Star className="w-3 h-3 text-amber-600" />
                            <span>{language === 'hi' ? 'मुख्य बनाएं' : 'Make Primary'}</span>
                          </button>
                        ) : (
                          <span className="text-[11px] font-black text-amber-700 bg-amber-100 px-2 py-1 rounded-lg">
                            ✓ {language === 'hi' ? 'आधिकारिक मानक' : 'Official Hero'}
                          </span>
                        )}

                        <div className="flex items-center gap-1">
                          {/* Edit Caption */}
                          <button
                            onClick={() => {
                              setEditingCaptionId(photo.id);
                              setCaptionHiInput(photo.captionHi || '');
                              setCaptionEnInput(photo.captionEn || '');
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Edit caption"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Replace Photo */}
                          <button
                            onClick={() => handleStartReplace(photo.id)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Replace this photo with new image"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Photo */}
                          <button
                            onClick={() => handleDeletePhoto(photo.id)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete this photo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 3: AI Multi-Photo Room Analysis (Gemini 3.8 Flash) */}
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-5 sm:p-6 shadow-md space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wide mb-1">
                  <Sparkles className="w-4 h-4" />
                  <span>GEMINI 3.8 FLASH MULTIMODAL FACILITY INSPECTION</span>
                </div>
                <h3 className="text-lg sm:text-xl font-black">
                  {language === 'hi'
                    ? `एआई 360° मल्टी-फोटो विश्लेषण (${selectedGuide?.titleHi})`
                    : `AI 360° Multi-Angle Analysis (${selectedGuide?.titleEn})`}
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                  {language === 'hi'
                    ? 'एआई इस कमरे के सभी फोटो का एक साथ विश्लेषण करके फर्नीचर की दूरी, कुर्सियों की सीध, कोस्टर, पानी की बोतल और सफाई के 100% मानक तय करता है।'
                    : 'AI synthesizes all reference angles together to formulate exact placement standards, cleaning procedure, and quality benchmarks.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunAIAnalysis}
                disabled={isAnalyzingAI || roomPhotos.length === 0}
                className="px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-50 shrink-0 min-h-[46px]"
              >
                {isAnalyzingAI ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                    <span>{language === 'hi' ? 'सभी फोटो का विश्लेषण हो रहा है...' : 'Analyzing all angles together...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {language === 'hi'
                        ? `सभी ${roomPhotos.length} फोटो का AI विश्लेषण चलाएं`
                        : `Analyze All ${roomPhotos.length} Photos with AI`}
                    </span>
                  </>
                )}
              </button>
            </div>

            {aiSuccessMsg && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-500 text-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{aiSuccessMsg}</span>
              </div>
            )}

            {aiErrorMsg && (
              <div className="p-3 bg-rose-950/80 border border-rose-500 text-rose-200 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{aiErrorMsg}</span>
              </div>
            )}

            {/* AI Analysis Content */}
            {roomAnalysis ? (
              <div className="space-y-4">
                {/* AI Summary Banner */}
                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                      {language === 'hi' ? 'एआई निरीक्षण सारांश' : 'AI Multimodal Inspection Summary'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {roomAnalysis.totalPhotosAnalyzed} photos analyzed • {new Date(roomAnalysis.analyzedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed font-medium">
                    {language === 'hi' ? roomAnalysis.summaryHi : roomAnalysis.summaryEn}
                  </p>
                  <div className="pt-2">
                    <VoiceButton
                      text={
                        language === 'hi'
                          ? `कमरे का एआई विश्लेषण: ${roomAnalysis.summaryHi}. सफाई मानक: ${roomAnalysis.setupStandardsHi.join('. ')}`
                          : `AI Room Analysis: ${roomAnalysis.summaryEn}. Standards: ${roomAnalysis.setupStandardsEn.join('. ')}`
                      }
                      lang={language}
                      textId={`admin-ai-analysis-${selectedGuide?.id || 'room'}`}
                      size="sm"
                      label={language === 'hi' ? 'विश्लेषण सुनें' : 'Listen AI Report'}
                    />
                  </div>
                </div>

                {/* 4 Pillars Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Pillar 1: Setup Standards */}
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                    <h5 className="font-extrabold text-xs text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span>1.</span>
                      <span>{language === 'hi' ? 'व्यवस्था मानक (Setup Standards)' : 'Setup Standards'}</span>
                    </h5>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {(language === 'hi' ? roomAnalysis.setupStandardsHi : roomAnalysis.setupStandardsEn).map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Pillar 2: Cleaning Procedure */}
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                    <h5 className="font-extrabold text-xs text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span>2.</span>
                      <span>{language === 'hi' ? 'सफाई प्रक्रिया (Cleaning Procedure)' : 'Cleaning Procedure'}</span>
                    </h5>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {(language === 'hi' ? roomAnalysis.cleaningProcedureHi : roomAnalysis.cleaningProcedureEn).map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Pillar 3: Quality Standards */}
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                    <h5 className="font-extrabold text-xs text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span>3.</span>
                      <span>{language === 'hi' ? 'गुणवत्ता मानक (Quality Benchmarks)' : 'Quality Benchmarks'}</span>
                    </h5>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {(language === 'hi' ? roomAnalysis.qualityStandardsHi : roomAnalysis.qualityStandardsEn).map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Pillar 4: Mistakes to Avoid */}
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                    <h5 className="font-extrabold text-xs text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span>4.</span>
                      <span>{language === 'hi' ? 'गलतियां जिनसे बचें (Mistakes to Avoid)' : 'Mistakes to Avoid'}</span>
                    </h5>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {(language === 'hi' ? roomAnalysis.mistakesToAvoidHi : roomAnalysis.mistakesToAvoidEn).map((item, i) => (
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
                  ? 'इस कमरे का अभी तक AI विश्लेषण नहीं हुआ है। ऊपर दिए गए बटन से विश्लेषण चलाएं।'
                  : 'AI has not analyzed this room yet. Click the button above to run multimodal analysis on all photos.'}
              </div>
            )}
          </div>

          {/* Section 4: Room Details & Voice Script Editor */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
            <h4 className="font-extrabold text-slate-950 text-base border-b border-slate-100 pb-3 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-amber-500" />
              <span>{language === 'hi' ? 'कमरे का विवरण व ऑडियो स्क्रिप्ट संपादित करें' : 'Room Details & Audio Script'}</span>
            </h4>

            <form onSubmit={handleSaveGuide} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'hi' ? 'कमरे का नाम (हिंदी)' : 'Room Title (Hindi)'}
                  </label>
                  <input
                    type="text"
                    value={editTitleHi}
                    onChange={(e) => setEditTitleHi(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'hi' ? 'कमरे का नाम (English)' : 'Room Title (English)'}
                  </label>
                  <input
                    type="text"
                    value={editTitleEn}
                    onChange={(e) => setEditTitleEn(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'hi' ? 'फर्नीचर संख्या (हिंदी, उदा. 4 कुर्सियां, 1 टेबल)' : 'Furniture Details (Hindi)'}
                  </label>
                  <input
                    type="text"
                    value={editFurnitureHi}
                    onChange={(e) => setEditFurnitureHi(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'hi' ? 'फर्नीचर संख्या (English)' : 'Furniture Details (English)'}
                  </label>
                  <input
                    type="text"
                    value={editFurnitureEn}
                    onChange={(e) => setEditFurnitureEn(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'hi'
                    ? 'ऑडियो आवाज स्क्रिप्ट (हिंदी - स्पीकर बटन दबाने पर यह बोला जाएगा)'
                    : 'Voice Audio Script (Hindi)'}
                </label>
                <textarea
                  rows={3}
                  value={editVoiceHi}
                  onChange={(e) => setEditVoiceHi(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm min-h-[44px]"
              >
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                <span>{language === 'hi' ? 'कमरे का विवरण सहेजें' : 'Save Room Details'}</span>
              </button>
            </form>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: STAFF USERS MANAGEMENT                            */}
      {/* ======================================================== */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-6">
          <div>
            <h3 className="font-extrabold text-slate-950 text-base sm:text-lg">
              {language === 'hi' ? 'कर्मचारी और पैंट्री बॉय सूची' : 'Pantry Staff & Admin Accounts'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'hi'
                ? 'प्रत्येक पैंट्री बॉय का अपना अलग आईडी और पिन होता है।'
                : 'Each pantry boy has an individual ID and PIN to track their proofs.'}
            </p>
          </div>

          {userSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{userSuccessMsg}</span>
            </div>
          )}

          <div className="space-y-2">
            {users.map((u) => {
              const isAdmin = u.role === 'admin';
              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                      isAdmin ? 'bg-amber-600' : 'bg-emerald-600'
                    }`}>
                      {isAdmin ? <Shield className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="font-extrabold text-slate-900 text-sm">
                        {u.name} ({u.nameHi})
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-700">ID: {u.username}</span>
                        <span>•</span>
                        <span className="font-mono">PIN: {u.pin}</span>
                        <span>•</span>
                        <span>{u.shift}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {!isAdmin ? (
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                        Admin
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-600" />
              <span>{language === 'hi' ? 'नया पैंट्री बॉय जोड़ें' : 'Add New Pantry Boy'}</span>
            </h4>

            <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {language === 'hi' ? 'नाम (Name)' : 'Full Name'}
                </label>
                <input
                  type="text"
                  placeholder="उदा. Amit Verma"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {language === 'hi' ? 'यूजर आईडी (ID)' : 'User ID'}
                </label>
                <input
                  type="text"
                  placeholder="उदा. PB103"
                  value={newUserUsername}
                  onChange={(e) => setNewUserUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-1 focus:ring-amber-500 focus:outline-none uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {language === 'hi' ? 'पिन (PIN)' : 'PIN (4 digits)'}
                </label>
                <input
                  type="text"
                  placeholder="1234"
                  value={newUserPin}
                  onChange={(e) => setNewUserPin(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs min-h-[38px]"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{language === 'hi' ? 'जोड़ें (Add)' : 'Add User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: CREATE & ASSIGN TASK                              */}
      {/* ======================================================== */}
      {activeTab === 'create_task' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-6">
          <div>
            <h3 className="font-extrabold text-slate-950 text-base sm:text-lg">
              {language === 'hi' ? 'नया दैनिक कार्य बनाएं और असाइन करें' : 'Create & Assign Daily Task'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'hi'
                ? 'समय निर्धारित करें, निर्देश दें और संदर्भ फोटो जोड़ें।'
                : 'Set schedule, detailed instructions, and attach reference photos.'}
            </p>
          </div>

          {taskSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{taskSuccessMsg}</span>
            </div>
          )}

          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'hi' ? 'कार्य शीर्षक (हिंदी) *' : 'Task Title (Hindi) *'}
                </label>
                <input
                  type="text"
                  placeholder="उदा. दोपहर 1:30: पैंट्री सिंक व काउंटर सफाई"
                  value={taskTitleHi}
                  onChange={(e) => setTaskTitleHi(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'hi' ? 'कार्य शीर्षक (English)' : 'Task Title (English)'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Afternoon 1:30: Pantry Sink & Counter Sanitization"
                  value={taskTitleEn}
                  onChange={(e) => setTaskTitleEn(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'hi' ? 'कमरा चुनें (Select Room)' : 'Select Room'}
                </label>
                <select
                  value={taskRoomHi}
                  onChange={(e) => {
                    const selected = guides.find((g) => g.titleHi === e.target.value);
                    if (selected) {
                      setTaskRoomHi(selected.titleHi);
                      setTaskRoomEn(selected.titleEn);
                      setTaskCategory(selected.category);
                      setTaskPhotoUrl(selected.photoUrl);
                    } else {
                      setTaskRoomHi(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:ring-1 focus:ring-amber-500 focus:outline-none bg-slate-50 cursor-pointer"
                >
                  {guides.map((g) => (
                    <option key={g.id} value={g.titleHi}>
                      {g.titleHi} ({g.furnitureDetailsEn})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'hi' ? 'समय (Scheduled Time)' : 'Scheduled Time'}
                </label>
                <input
                  type="text"
                  value={taskTime}
                  onChange={(e) => setTaskTime(e.target.value)}
                  placeholder="उदा. 11:30 AM"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'hi' ? 'किसे सौंपें (Assign To)' : 'Assign To'}
                </label>
                <select
                  value={taskAssignedUser}
                  onChange={(e) => setTaskAssignedUser(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:ring-1 focus:ring-amber-500 focus:outline-none bg-slate-50 cursor-pointer"
                >
                  <option value="ALL">{language === 'hi' ? 'सभी पैंट्री स्टाफ (All Staff)' : 'All Staff'}</option>
                  {users
                    .filter((u) => u.role !== 'admin')
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.username})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'hi' ? 'विस्तृत निर्देश (हिंदी) *' : 'Instructions (Hindi) *'}
              </label>
              <textarea
                rows={3}
                placeholder="उदा. सभी कप धोएं, काउंटर सूखा करें, ड्रिप ट्रे खाली करें और फोटो खींचकर अपलोड करें।"
                value={taskInstructionsHi}
                onChange={(e) => setTaskInstructionsHi(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm min-h-[44px]"
            >
              <CheckSquare className="w-4 h-4 text-emerald-400" />
              <span>{language === 'hi' ? 'कार्य बनाएं व असाइन करें (Assign Task)' : 'Assign Daily Task'}</span>
            </button>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: PANTRY BOY COMPLETION PHOTOS & 40-DAY AUDIT       */}
      {/* ======================================================== */}
      {activeTab === 'completion_photos' && (
        <div className="space-y-5 animate-in fade-in">
          {/* Header & Retention Policy Card */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base sm:text-lg text-white">
                      {language === 'hi'
                        ? 'पैंट्री बॉय कार्य समाप्ति फोटो व 40-दिवसीय ऑडिट'
                        : 'Pantry Boy Task Completion Photos & 40-Day Audit'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wide">
                      40-Day Retention
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    {language === 'hi'
                      ? 'पैंट्री स्टाफ द्वारा काम पूरा करने पर अपलोड की गई सभी फोटो यहाँ 40 दिनों तक सुरक्षित रहती हैं और 40 दिन बाद सर्वर से फ़ाइल व रिकॉर्ड स्वतः हटा दिए जाते हैं। संदर्भ फोटो स्थायी रहते हैं।'
                      : 'All photos uploaded by staff upon task completion are stored strictly in backend storage for 40 days, then automatically purged along with files from disk. Official reference photos remain permanent.'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                <button
                  type="button"
                  onClick={handleRunAdminCleanup}
                  className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{language === 'hi' ? '40-दिन पुरानी फोटो अभी साफ करें' : 'Run 40-Day Cleanup Now'}</span>
                </button>

                <button
                  type="button"
                  onClick={loadCompletionAuditData}
                  className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                  title="Refresh Audit Data"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Retention Status Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
              <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700/60">
                <span className="text-slate-400 block font-medium">
                  {language === 'hi' ? 'अवधारण नीति (Retention)' : 'Retention Policy'}
                </span>
                <span className="text-base font-black text-amber-400 mt-0.5 block">
                  40 {language === 'hi' ? 'दिन' : 'Days'}
                </span>
                <span className="text-[10px] text-slate-400">Strict Auto-Purge</span>
              </div>

              <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700/60">
                <span className="text-slate-400 block font-medium">
                  {language === 'hi' ? 'सक्रिय समाप्ति फोटो' : 'Active Proof Photos'}
                </span>
                <span className="text-base font-black text-emerald-400 mt-0.5 block">
                  {allCompletionPhotos.length} {language === 'hi' ? 'फोटो' : 'Photos'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {retentionAudit?.diskUsageFormatted || 'Disk Stored'}
                </span>
              </div>

              <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700/60">
                <span className="text-slate-400 block font-medium">
                  {language === 'hi' ? 'स्टोरेज डायरेक्टरी' : 'Storage Directory'}
                </span>
                <span className="text-xs font-mono font-bold text-slate-200 mt-1 block truncate" title="/data/uploads/completion">
                  /data/uploads/completion
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold">Isolated from /reference</span>
              </div>

              <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700/60">
                <span className="text-slate-400 block font-medium">
                  {language === 'hi' ? 'संदर्भ फोटो (Reference)' : 'Reference Photos'}
                </span>
                <span className="text-base font-black text-white mt-0.5 block">
                  {language === 'hi' ? 'स्थायी (Permanent)' : 'Permanent'}
                </span>
                <span className="text-[10px] text-slate-400">Until Admin deletes</span>
              </div>
            </div>

            {cleanupToast && (
              <div className="mt-4 p-3 bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{cleanupToast}</span>
              </div>
            )}
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  {language === 'hi' ? 'कमरा अनुसार फ़िल्टर:' : 'Filter by Room:'}
                </label>
                <select
                  value={completionFilterRoom}
                  onChange={(e) => setCompletionFilterRoom(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="all">{language === 'hi' ? 'सभी कमरे (All Rooms)' : 'All Rooms'}</option>
                  {guides.map((g) => (
                    <option key={g.id} value={g.titleEn}>
                      {language === 'hi' ? g.titleHi : g.titleEn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  {language === 'hi' ? 'स्टाफ अनुसार फ़िल्टर:' : 'Filter by Staff:'}
                </label>
                <select
                  value={completionFilterStaff}
                  onChange={(e) => setCompletionFilterStaff(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="all">{language === 'hi' ? 'सभी स्टाफ (All Staff)' : 'All Staff'}</option>
                  {users
                    .filter((u) => u.role === 'pantry_boy')
                    .map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name} ({u.username})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg self-start sm:self-auto">
              <span>{language === 'hi' ? 'दिखाए गए फोटो:' : 'Showing Photos:'}</span>{' '}
              <span className="text-emerald-700 font-black">
                {allCompletionPhotos.filter((p) => {
                  if (completionFilterRoom !== 'all' && !p.roomName.toLowerCase().includes(completionFilterRoom.toLowerCase())) return false;
                  if (completionFilterStaff !== 'all' && !p.pantryBoyName.toLowerCase().includes(completionFilterStaff.toLowerCase())) return false;
                  return true;
                }).length}
              </span>
            </div>
          </div>

          {/* Completion Photos Grid */}
          {isLoadingCompletion ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
              <span className="text-sm font-bold text-slate-600">
                {language === 'hi' ? 'कार्य समाप्ति फोटो लोड हो रहे हैं...' : 'Loading completion photos from server...'}
              </span>
            </div>
          ) : (() => {
            const displayed = allCompletionPhotos.filter((p) => {
              if (completionFilterRoom !== 'all' && !p.roomName.toLowerCase().includes(completionFilterRoom.toLowerCase())) return false;
              if (completionFilterStaff !== 'all' && !p.pantryBoyName.toLowerCase().includes(completionFilterStaff.toLowerCase())) return false;
              return true;
            });

            if (displayed.length === 0) {
              return (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                  <Camera className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h4 className="font-bold text-slate-700 text-sm">
                    {language === 'hi' ? 'कोई कार्य समाप्ति फोटो नहीं मिली' : 'No Completion Photos Found'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    {language === 'hi'
                      ? 'जब पैंट्री बॉय कार्य पूरा करके फोटो अपलोड करेंगे, वे यहाँ 40 दिनों तक प्रदर्शित होंगे।'
                      : 'When staff upload verification photos upon completing tasks, they are archived here for 40 days.'}
                  </p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {displayed.map((photo) => {
                  const uploadDate = new Date(photo.uploadedAt);
                  const expireDate = photo.expiresAt ? new Date(photo.expiresAt) : new Date(uploadDate.getTime() + 40 * 24 * 60 * 60 * 1000);
                  const daysRemaining = Math.max(0, Math.ceil((expireDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

                  return (
                    <div
                      key={photo.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between hover:border-emerald-400 transition-colors group"
                    >
                      <div>
                        {/* Thumbnail */}
                        <div
                          className="relative aspect-4/3 bg-slate-900 cursor-pointer overflow-hidden"
                          onClick={() => setPreviewCompletionPhoto(photo)}
                        >
                          <img
                            src={photo.url}
                            alt={photo.taskTitle}
                            className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                          />

                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-xs text-white text-[10px] font-bold">
                            {photo.angleLabel || 'Completion Photo'}
                          </div>

                          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-emerald-600/90 text-white text-[10px] font-black shadow-xs">
                            ⏳ {daysRemaining} {language === 'hi' ? 'दिन शेष' : 'days left'}
                          </div>

                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                            <Maximize2 className="w-6 h-6" />
                          </div>
                        </div>

                        {/* Details */}
                        <div className="p-3.5 space-y-1.5">
                          <div className="font-extrabold text-xs text-slate-900 line-clamp-1">
                            {photo.taskTitle}
                          </div>

                          <div className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                            <span>📍</span>
                            <span>{photo.roomName}</span>
                          </div>

                          <div className="text-[11px] text-slate-600 flex items-center justify-between pt-1 border-t border-slate-100">
                            <span className="font-bold text-slate-800">👤 {photo.pantryBoyName}</span>
                            <span className="text-[10px] text-slate-400">({photo.pantryBoyId})</span>
                          </div>

                          <div className="text-[10px] text-slate-500 pt-1 flex items-center justify-between">
                            <span className="font-medium flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{uploadDate.toLocaleDateString()}</span>
                            </span>
                            <span className="font-bold text-slate-700">
                              {uploadDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="px-3.5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setPreviewCompletionPhoto(photo)}
                          className="text-xs font-bold text-slate-700 hover:text-slate-950 flex items-center gap-1 cursor-pointer"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>{language === 'hi' ? 'बड़ा देखें' : 'Preview'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteCompletionItem(photo.id, photo.taskId)}
                          className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer"
                          title="Delete completion photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{language === 'hi' ? 'हटाएं' : 'Delete'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

        </div>
      )}

      {/* Completion Photo Lightbox Modal */}
      {previewCompletionPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in"
          onClick={() => setPreviewCompletionPhoto(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2 text-xs text-amber-400 font-bold">
                  <span>📍 {previewCompletionPhoto.roomName}</span>
                  <span>•</span>
                  <span>{previewCompletionPhoto.angleLabel || 'Completion Photo'}</span>
                </div>
                <h4 className="font-extrabold text-sm sm:text-base text-white mt-0.5">
                  {previewCompletionPhoto.taskTitle}
                </h4>
              </div>
              <button
                onClick={() => setPreviewCompletionPhoto(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Image */}
            <div className="flex-1 flex items-center justify-center bg-black/60 p-2 overflow-hidden">
              <img
                src={previewCompletionPhoto.url}
                alt="Completion Proof Preview"
                className="max-h-[70vh] max-w-full object-contain rounded-lg"
              />
            </div>

            {/* Footer with Metadata & Delete */}
            <div className="p-4 bg-slate-950 text-slate-300 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-slate-800">
              <div className="space-y-1">
                <div>
                  <span className="font-bold text-white">Staff:</span> {previewCompletionPhoto.pantryBoyName} ({previewCompletionPhoto.pantryBoyId})
                  <span className="mx-2">•</span>
                  <span className="font-bold text-white">Uploaded:</span> {new Date(previewCompletionPhoto.uploadedAt).toLocaleString()}
                </div>
                <div className="text-[11px] text-emerald-400">
                  <span>🛡️ 40-Day Auto Retention • Storage: /data/uploads/completion/{previewCompletionPhoto.fileName || ''}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDeleteCompletionItem(previewCompletionPhoto.id, previewCompletionPhoto.taskId)}
                className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{language === 'hi' ? 'सर्वर से हमेशा के लिए हटाएं' : 'Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Preview Fullscreen Modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                {previewPhoto.isPrimary && (
                  <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-xs font-bold">
                    Primary Reference
                  </span>
                )}
                <span className="font-bold text-sm text-slate-200">
                  {language === 'hi' ? previewPhoto.captionHi : previewPhoto.captionEn}
                </span>
              </div>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Image */}
            <div className="flex-1 flex items-center justify-center bg-black/60 p-2 overflow-hidden">
              <img
                src={previewPhoto.url}
                alt="Preview"
                className="max-h-[70vh] max-w-full object-contain rounded-lg"
              />
            </div>

            {/* Footer with Actions */}
            <div className="p-4 bg-slate-950 text-slate-300 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-slate-800">
              <div>
                <span>{language === 'hi' ? 'अपलोडकर्ता:' : 'Uploaded by:'} {previewPhoto.uploadedBy || 'Admin'}</span>
                <span className="mx-2">•</span>
                <span>{new Date(previewPhoto.uploadedAt).toLocaleString()}</span>
              </div>

              <div className="flex items-center gap-2">
                {!previewPhoto.isPrimary && (
                  <button
                    onClick={() => {
                      handleSetPrimary(previewPhoto.id);
                      setPreviewPhoto((prev) => prev ? { ...prev, isPrimary: true } : null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition-colors cursor-pointer"
                  >
                    ⭐ {language === 'hi' ? 'मुख्य मानक बनाएं' : 'Make Primary'}
                  </button>
                )}
                <button
                  onClick={() => handleStartReplace(previewPhoto.id)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors cursor-pointer"
                >
                  🔄 {language === 'hi' ? 'फोटो बदलें' : 'Replace Image'}
                </button>
                <button
                  onClick={() => handleDeletePhoto(previewPhoto.id)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors cursor-pointer"
                >
                  🗑️ {language === 'hi' ? 'हटाएं' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
