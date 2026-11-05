import React, { useState, useEffect } from 'react';
import { DailyTask, User, Language, CompletionPhotoItem } from '../types';
import { AITrainingService } from '../services/aiTrainingService';
import { StorageService } from '../services/storageService';
import {
  CheckCircle2,
  Clock,
  MapPin,
  Maximize2,
  Calendar,
  AlertTriangle,
  MessageSquare,
  ShieldCheck,
  Check,
  RotateCcw,
  Camera,
  Trash2,
  FileCheck,
  User as UserIcon,
  HardDrive,
  Info,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface HistorySectionProps {
  tasks: DailyTask[];
  currentUser: User | null;
  language: Language;
  onUpdateTask: (task: DailyTask) => void;
}

interface RetentionAuditStatus {
  retentionPolicyDays: number;
  totalDatabaseRecords: number;
  diskFilesCount: number;
  diskUsageFormatted: string;
  storageDirectory: string;
  referenceStorageDirectory: string;
  nextExpiringPhoto?: {
    id: string;
    taskTitle: string;
    uploadedAt: string;
    expiresAt: string;
    daysRemaining: number;
  } | null;
  serverTime: string;
}

export const HistorySection: React.FC<HistorySectionProps> = ({
  tasks,
  currentUser,
  language,
  onUpdateTask,
}) => {
  const [zoomPhoto, setZoomPhoto] = useState<{
    url: string;
    caption?: string;
    timestamp?: string;
    photoId?: string;
    taskId?: string;
    canDelete?: boolean;
  } | null>(null);
  const [feedbackInput, setFeedbackInput] = useState<{ [taskId: string]: string }>({});
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('all');
  const [retentionStatus, setRetentionStatus] = useState<RetentionAuditStatus | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  // Delete individual completion photo
  const handleDeleteCompletionPhoto = async (photoId: string, taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const confirmMsg =
      language === 'hi'
        ? 'क्या आप इस कार्य समाप्ति फोटो को सर्वर से हमेशा के लिए हटाना चाहते हैं?'
        : 'Are you sure you want to permanently delete this completion photo from server storage?';

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await AITrainingService.deleteCompletionPhoto({
        photoId,
        taskId,
        user: currentUser,
      });

      if (res.success) {
        // Clear from local client storage immediately
        StorageService.deleteCompletionPhotoFromStorage(photoId, taskId);

        // Update task locally
        const targetTask = tasks.find((t) => t.id === taskId);
        if (targetTask) {
          const remainingPhotos = (targetTask.proofPhotos || []).filter((p) => p.id !== photoId);
          const updated: DailyTask = {
            ...targetTask,
            proofPhotos: remainingPhotos,
            proofPhotoUrl: remainingPhotos.length > 0 ? remainingPhotos[0].url : undefined,
          };
          onUpdateTask(updated);
        }

        if (zoomPhoto?.photoId === photoId) {
          setZoomPhoto(null);
        }

        setCleanupMessage(
          language === 'hi'
            ? 'फोटो सफलतापूर्वक हटा दी गई है।'
            : 'Completion photo deleted successfully.'
        );
        setTimeout(() => setCleanupMessage(null), 4000);
        await fetchRetentionAudit();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete photo');
    }
  };

  // Fetch 40-Day Retention statistics
  const fetchRetentionAudit = async () => {
    try {
      const data = await AITrainingService.getRetentionStatus();
      if (data && data.success) {
        setRetentionStatus(data);
      }
    } catch (e) {
      console.warn('Retention audit fetch notice:', e);
    }
  };

  useEffect(() => {
    fetchRetentionAudit();
  }, [tasks]);

  const handleManualCleanup = async () => {
    if (!currentUser || currentUser.role !== 'admin') return;
    try {
      setIsCleaning(true);
      setCleanupMessage(null);
      const res = await AITrainingService.triggerManualCleanup(currentUser);
      setCleanupMessage(
        language === 'hi'
          ? `सफलतापूर्वक सफाई संपन्न: ${res.result.deletedCount} समाप्त फोटो हटाई गईं, ${res.result.remainingCount} फोटो 40-दिवसीय अवधि में सुरक्षित हैं।`
          : `Cleanup completed: ${res.result.deletedCount} expired photos deleted, ${res.result.remainingCount} active within 40 days.`
      );
      await fetchRetentionAudit();
    } catch (err: any) {
      setCleanupMessage(err.message || 'Cleanup operation failed');
    } finally {
      setIsCleaning(false);
      setTimeout(() => setCleanupMessage(null), 6000);
    }
  };

  // Filter tasks that have at least one completion proof photo or proofPhotoUrl
  const completedTasks = tasks.filter(
    (t) => t.status === 'completed' && (t.proofPhotoUrl || (t.proofPhotos && t.proofPhotos.length > 0))
  );

  const filteredTasks = completedTasks.filter((t) => {
    if (selectedRoomFilter === 'all') return true;
    return t.category === selectedRoomFilter || t.roomNameEn.toLowerCase().includes(selectedRoomFilter.toLowerCase());
  });

  const handleAdminApprove = (task: DailyTask) => {
    const feedback =
      feedbackInput[task.id] ||
      (language === 'hi'
        ? 'कार्यालय मानक के अनुसार बहुत बढ़िया और स्वच्छ कार्य किया गया।'
        : 'Approved as per 5-star office standards.');
    onUpdateTask({
      ...task,
      adminStatus: 'approved',
      adminFeedback: feedback,
      adminReviewedAt: new Date().toISOString(),
    });
  };

  const handleAdminRework = (task: DailyTask) => {
    const feedback =
      feedbackInput[task.id] ||
      (language === 'hi'
        ? 'कृपया टेबल दोबारा पोंछें और सही कोण से स्पष्ट फोटो लें।'
        : 'Please re-clean and upload clear verification photo.');
    onUpdateTask({
      ...task,
      adminStatus: 'needs_rework',
      adminFeedback: feedback,
      adminReviewedAt: new Date().toISOString(),
    });
  };

  // Helper to calculate days remaining from 40-day retention
  const getDaysRemaining = (uploadedAtString?: string, expiresAtString?: string) => {
    const now = Date.now();
    let expireTime = 0;
    if (expiresAtString) {
      expireTime = new Date(expiresAtString).getTime();
    } else if (uploadedAtString) {
      expireTime = new Date(uploadedAtString).getTime() + 40 * 24 * 60 * 60 * 1000;
    } else {
      return 40;
    }
    const diffMs = expireTime - now;
    return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Top Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>{language === 'hi' ? 'कार्य सत्यापन व 40-दिवसीय ऑडिट' : 'Task Verification & 40-Day Audit'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-950">
            {language === 'hi' ? 'फोटो प्रमाण और इतिहास (Proof History)' : 'Photo Proofs & History'}
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            {language === 'hi'
              ? 'पैंट्री स्टाफ द्वारा अपलोड किए गए सभी फोटो, सटीक टाइमस्टैम्प, कमरा और 40-दिवसीय स्वचालित स्टोरेज अवधारण।'
              : 'Actual completion photos uploaded by pantry staff with exact timestamps, staff ID, and 40-day server retention.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs font-bold px-3.5 py-2 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center gap-1.5 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              {completedTasks.length}{' '}
              {language === 'hi' ? 'सत्यापित कार्य संपन्न' : 'Completed Tasks'}
            </span>
          </div>

          <button
            onClick={fetchRetentionAudit}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="Refresh Audit"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 40-Day Retention Policy & Storage Audit Dashboard Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-white">
                  {language === 'hi'
                    ? '40-दिवसीय स्वचालित फोटो अवधारण प्रणाली'
                    : '40-Day Automatic Photo Retention System'}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wide">
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {language === 'hi'
                  ? 'संदर्भ फोटो हमेशा स्थायी रहते हैं • कार्य समाप्ति फोटो 40 दिनों बाद सर्वर से स्वतः हटा दिए जाते हैं।'
                  : 'Reference photos are permanent • Task completion photos are stored for 40 days then auto-deleted from disk.'}
              </p>
            </div>
          </div>

          {/* Admin manual cleanup trigger */}
          {currentUser?.role === 'admin' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleManualCleanup}
                disabled={isCleaning}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {isCleaning
                    ? language === 'hi' ? 'सफाई चल रही है...' : 'Cleaning...'
                    : language === 'hi' ? '40-दिन पुरानी फोटो तुरंत साफ करें' : 'Run 40-Day Cleanup Now'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Audit Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block font-medium">
              {language === 'hi' ? 'अवधारण नीति' : 'Retention Window'}
            </span>
            <span className="text-base font-black text-amber-400 mt-0.5 block">
              40 {language === 'hi' ? 'दिन (Days)' : 'Days'}
            </span>
            <span className="text-[10px] text-slate-400">Strict Auto-Purge</span>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block font-medium">
              {language === 'hi' ? 'सक्रिय समाप्ति फोटो' : 'Active Proof Photos'}
            </span>
            <span className="text-base font-black text-emerald-400 mt-0.5 block">
              {retentionStatus ? retentionStatus.totalDatabaseRecords : completedTasks.length} {language === 'hi' ? 'फोटो' : 'Photos'}
            </span>
            <span className="text-[10px] text-slate-400">
              {retentionStatus ? retentionStatus.diskUsageFormatted : 'Disk Allocated'}
            </span>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block font-medium">
              {language === 'hi' ? 'सर्वर स्टोरेज स्थान' : 'Storage Directory'}
            </span>
            <span className="text-xs font-mono font-bold text-slate-200 mt-1 block truncate" title="/data/uploads/completion">
              /data/uploads/completion
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold">Separate from /reference</span>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block font-medium">
              {language === 'hi' ? 'संदर्भ फोटो (Reference)' : 'Reference Photos'}
            </span>
            <span className="text-base font-black text-white mt-0.5 block">
              {language === 'hi' ? 'स्थायी (Permanent)' : 'Permanent'}
            </span>
            <span className="text-[10px] text-slate-400">No Auto-Deletion</span>
          </div>
        </div>

        {cleanupMessage && (
          <div className="mt-3 p-3 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{cleanupMessage}</span>
          </div>
        )}
      </div>

      {/* History Grid */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Camera className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h4 className="font-extrabold text-base text-slate-900">
            {language === 'hi' ? 'कोई फोटो प्रमाण उपलब्ध नहीं है' : 'No Task Proof Photos Found'}
          </h4>
          <p className="text-slate-500 font-medium text-xs sm:text-sm mt-1 max-w-md mx-auto">
            {language === 'hi'
              ? 'पैंट्री बॉय "दैनिक कार्य" सेक्शन में जाकर काम पूरा करने के फोटो अपलोड करेंगे तो वे यहाँ 40 दिनों तक उपलब्ध रहेंगे।'
              : 'When pantry staff complete tasks with verification photos in the "Daily Tasks" tab, they will be archived here for 40 days.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredTasks.map((task) => {
            const isApproved = task.adminStatus === 'approved';
            const isRework = task.adminStatus === 'needs_rework';

            // Gather all proof photos: if task.proofPhotos has items, use them; otherwise fallback to single proofPhotoUrl
            const photosList: CompletionPhotoItem[] =
              task.proofPhotos && task.proofPhotos.length > 0
                ? task.proofPhotos
                : task.proofPhotoUrl
                ? [
                    {
                      id: `single_${task.id}`,
                      taskId: task.id,
                      taskTitle: task.titleEn,
                      roomName: task.roomNameEn,
                      pantryBoyId: task.completedByUserId || 'pb-101',
                      pantryBoyName: task.completedByName || 'Pantry Boy',
                      url: task.proofPhotoUrl,
                      fileName: '',
                      uploadedAt: task.completedAt || new Date().toISOString(),
                      expiresAt: new Date(new Date(task.completedAt || Date.now()).getTime() + 40 * 24 * 60 * 60 * 1000).toISOString(),
                      angleLabel: 'Completion Photo #1',
                      retentionDays: 40,
                    },
                  ]
                : [];

            const primaryProof = photosList[0];
            const primaryUploadDate = primaryProof?.uploadedAt || task.completedAt;
            const daysLeft = getDaysRemaining(primaryUploadDate, primaryProof?.expiresAt);
            const canDelete = currentUser?.role === 'admin' || (currentUser && currentUser.id === task.completedByUserId);

            return (
              <div
                key={task.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Photo Comparison Header */}
                  <div className="flex items-center justify-between bg-slate-900 text-white text-[11px] font-bold px-3.5 py-2.5 border-b border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>{language === 'hi' ? 'मानक संदर्भ vs स्टाफ अपलोड' : 'Target Standard vs Staff Uploads'}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-amber-400 text-[10px]">
                      <Clock className="w-3 h-3" />
                      <span>
                        {language === 'hi' ? `40-दिन अवधारण: ${daysLeft} दिन शेष` : `40-Day Retention: ${daysLeft}d left`}
                      </span>
                    </div>
                  </div>

                  {/* Dual Image Comparison Strip */}
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1.5">
                    {/* Reference photo (Permanent Target) */}
                    <div
                      className="relative aspect-4/3 bg-slate-200 overflow-hidden cursor-pointer group rounded-lg"
                      onClick={() =>
                        setZoomPhoto({
                          url: task.referencePhotoUrl,
                          caption: `${language === 'hi' ? 'ऑफिस मानक संदर्भ' : 'Official Target Standard'}: ${task.roomNameEn}`,
                        })
                      }
                    >
                      <img
                        src={task.referencePhotoUrl}
                        alt="Reference target"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-102 transition-transform"
                      />
                      <div className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-black/80 backdrop-blur-xs text-white rounded text-[10px] font-bold">
                        {language === 'hi' ? 'मानक संदर्भ' : 'Target Standard'}
                      </div>
                      <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 bg-blue-900/80 text-blue-200 rounded text-[9px] font-bold">
                        {language === 'hi' ? 'स्थायी' : 'Permanent'}
                      </div>
                    </div>

                    {/* Primary Proof photo (40-Day Retention) */}
                    <div
                      className="relative aspect-4/3 bg-emerald-950 overflow-hidden cursor-pointer group border-2 border-emerald-500 rounded-lg"
                      onClick={() =>
                        setZoomPhoto({
                          url: primaryProof?.url || task.proofPhotoUrl || '',
                          caption: `${task.titleEn} - Uploaded by ${task.completedByName}`,
                          timestamp: primaryUploadDate,
                          photoId: primaryProof?.id,
                          taskId: task.id,
                          canDelete: Boolean(canDelete),
                        })
                      }
                    >
                      {primaryProof?.url ? (
                        <img
                          src={primaryProof.url}
                          alt="Proof"
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform"
                        />
                      ) : null}

                      {/* Delete option for primary photo */}
                      {canDelete && primaryProof && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCompletionPhoto(primaryProof.id, task.id, e)}
                          className="absolute top-1.5 left-1.5 p-1.5 rounded-md bg-red-600/90 hover:bg-red-700 text-white flex items-center justify-center cursor-pointer transition-colors shadow-xs z-10"
                          title={language === 'hi' ? 'यह फोटो हटाएं' : 'Delete photo'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <div className="absolute top-1.5 right-1.5 px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold flex items-center gap-1 shadow-xs">
                        <Check className="w-3 h-3" />
                        <span>{language === 'hi' ? 'अपलोड प्रमाण' : 'Uploaded Proof'}</span>
                      </div>
                      <div className="absolute bottom-1.5 right-1.5 px-2 py-0.5 bg-black/80 text-amber-300 rounded text-[9px] font-bold">
                        ⏳ {daysLeft} {language === 'hi' ? 'दिन शेष' : 'days left'}
                      </div>
                    </div>
                  </div>

                  {/* Multi-photo Gallery Strip (if more than 1 photo uploaded) */}
                  {photosList.length > 1 && (
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1.5">
                        <span className="flex items-center gap-1">
                          <Camera className="w-3.5 h-3.5 text-emerald-600" />
                          <span>
                            {language === 'hi'
                              ? `कुल ${photosList.length} एंगल फोटो संलग्न:`
                              : `All ${photosList.length} Uploaded Angles:`}
                          </span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold">
                          {language === 'hi' ? 'क्लिक करके बड़ा देखें' : 'Click to preview'}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5">
                        {photosList.map((photo, pIdx) => (
                          <div
                            key={photo.id || pIdx}
                            onClick={() =>
                              setZoomPhoto({
                                url: photo.url,
                                caption: `${photo.angleLabel || `Angle #${pIdx + 1}`} - ${photo.taskTitle || task.titleEn}`,
                                timestamp: photo.uploadedAt,
                                photoId: photo.id,
                                taskId: task.id,
                                canDelete: Boolean(canDelete),
                              })
                            }
                            className="aspect-square rounded-lg overflow-hidden border border-slate-300 hover:border-emerald-500 cursor-pointer relative group bg-slate-900"
                          >
                            <img
                              src={photo.url}
                              alt={`Angle ${pIdx + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />

                            {/* Delete option for individual angle thumbnail */}
                            {canDelete && photo.id && (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteCompletionPhoto(photo.id, task.id, e)}
                                className="absolute top-1 right-1 p-1 rounded bg-red-600/90 hover:bg-red-700 text-white flex items-center justify-center cursor-pointer transition-colors shadow-xs z-10"
                                title={language === 'hi' ? 'फोटो हटाएं' : 'Delete photo'}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}

                            <div className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[9px] font-bold px-1 py-0.5 truncate text-center">
                              {photo.angleLabel || `#${pIdx + 1}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Details Block */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{task.scheduledTime}</span>
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-slate-700">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{language === 'hi' ? task.roomNameHi : task.roomNameEn}</span>
                      </span>
                    </div>

                    <h3 className="font-extrabold text-slate-900 text-base">
                      {language === 'hi' ? task.titleHi : task.titleEn}
                    </h3>

                    {/* Completion Metadata Card with Exact Timestamps */}
                    <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 border border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-1">
                          <UserIcon className="w-3 h-3 text-slate-400" />
                          <span>{language === 'hi' ? 'संपन्न करने वाले (Staff):' : 'Completed by:'}</span>
                        </span>
                        <span className="font-bold text-slate-900">
                          {task.completedByName || 'Pantry Boy'}
                          {task.completedByUserId ? ` (ID: ${task.completedByUserId})` : ''}
                        </span>
                      </div>

                      {primaryUploadDate && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>{language === 'hi' ? 'अपलोड सटीक समय (Timestamp):' : 'Upload Timestamp:'}</span>
                          </span>
                          <span className="font-mono font-bold text-slate-800">
                            {new Date(primaryUploadDate).toLocaleString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                      )}

                      {/* 40-Day Auto Expiration Badge */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/80 text-[11px]">
                        <span className="text-amber-800 font-semibold flex items-center gap-1">
                          <HardDrive className="w-3 h-3 text-amber-600" />
                          <span>{language === 'hi' ? 'सर्वर अवधारण (Retention):' : 'Retention Expiry:'}</span>
                        </span>
                        <span className="font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded">
                          {language === 'hi' ? `40 दिन में से ${daysLeft} दिन शेष` : `${daysLeft} days remaining of 40`}
                        </span>
                      </div>

                      {task.boyNotes && (
                        <div className="pt-1.5 text-slate-700 italic border-t border-slate-200">
                          "{task.boyNotes}"
                        </div>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isApproved && (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-1.5 font-bold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            {language === 'hi'
                              ? 'एडमिन द्वारा स्वीकृत (Approved)'
                              : 'Approved by Admin'}
                          </span>
                          {task.adminFeedback && (
                            <span className="font-normal italic ml-1"> - "{task.adminFeedback}"</span>
                          )}
                        </div>
                      )}

                      {isRework && (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center gap-1.5 font-bold">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>
                            {language === 'hi' ? 'सुधार आवश्यक (Needs Rework)' : 'Needs Rework'}
                          </span>
                          {task.adminFeedback && (
                            <span className="font-normal italic ml-1"> - "{task.adminFeedback}"</span>
                          )}
                        </div>
                      )}

                      {!isApproved && !isRework && (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-1.5 font-semibold">
                          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            {language === 'hi'
                              ? 'एडमिन समीक्षा लंबित (Pending Review)'
                              : 'Pending Admin Review'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Admin Review Action Form */}
                {currentUser?.role === 'admin' && (
                  <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={
                          language === 'hi'
                            ? 'एडमिन फीडबैक (वैकल्पिक टिप्पणी)'
                            : 'Admin feedback comment...'
                        }
                        value={feedbackInput[task.id] ?? task.adminFeedback ?? ''}
                        onChange={(e) =>
                          setFeedbackInput({ ...feedbackInput, [task.id]: e.target.value })
                        }
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAdminApprove(task)}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors min-h-[38px] shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{language === 'hi' ? 'स्वीकृत करें (Approve)' : 'Approve'}</span>
                      </button>
                      <button
                        onClick={() => handleAdminRework(task)}
                        className="py-2 px-3 rounded-xl border border-rose-300 hover:bg-rose-50 text-rose-700 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors min-h-[38px]"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{language === 'hi' ? 'पुनः कराएं' : 'Request Rework'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Zoom Modal */}
      {zoomPhoto && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in cursor-pointer"
          onClick={() => setZoomPhoto(null)}
        >
          <div
            className="relative max-w-5xl max-h-[92vh] w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={zoomPhoto.url}
              alt="Zoomed preview"
              className="max-h-[80vh] w-auto max-w-full object-contain rounded-xl shadow-2xl"
            />
            <div className="mt-3 text-center">
              {zoomPhoto.caption && (
                <div className="text-white text-sm font-bold bg-black/70 px-4 py-1.5 rounded-full inline-block">
                  {zoomPhoto.caption}
                </div>
              )}
              {zoomPhoto.timestamp && (
                <div className="text-slate-400 text-xs mt-1 font-mono">
                  Upload: {new Date(zoomPhoto.timestamp).toLocaleString()}
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center gap-3">
              {zoomPhoto.canDelete && zoomPhoto.photoId && zoomPhoto.taskId && (
                <button
                  type="button"
                  onClick={() => handleDeleteCompletionPhoto(zoomPhoto.photoId!, zoomPhoto.taskId!)}
                  className="text-xs text-white font-bold bg-red-600 hover:bg-red-700 px-4 py-1.5 rounded-full cursor-pointer transition-colors flex items-center gap-1.5 shadow-md"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{language === 'hi' ? 'यह फोटो हटाएं (Delete)' : 'Delete Photo'}</span>
                </button>
              )}
              <button
                onClick={() => setZoomPhoto(null)}
                className="text-xs text-white font-bold bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-full cursor-pointer transition-colors"
              >
                {language === 'hi' ? 'बंद करें (Close)' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
