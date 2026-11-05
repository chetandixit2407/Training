import React, { useState } from 'react';
import { DailyTask, User, Language } from '../types';
import { VoiceButton } from './VoiceButton';
import { TaskCompleteModal } from './TaskCompleteModal';
import {
  CheckCircle2,
  Clock,
  MapPin,
  Camera,
  Check,
  ChevronRight,
  UserCheck,
  Sparkles,
  Maximize2,
  Calendar,
} from 'lucide-react';

interface TasksSectionProps {
  tasks: DailyTask[];
  currentUser: User | null;
  language: Language;
  onUpdateTask: (task: DailyTask) => void;
  onOpenCreateTask?: () => void;
}

export const TasksSection: React.FC<TasksSectionProps> = ({
  tasks,
  currentUser,
  language,
  onUpdateTask,
  onOpenCreateTask,
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [activeTaskForModal, setActiveTaskForModal] = useState<DailyTask | null>(null);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const [showOnlyMine, setShowOnlyMine] = useState(false);

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'pending' && t.status === 'completed') return false;
    if (filter === 'completed' && t.status !== 'completed') return false;
    if (showOnlyMine && currentUser && t.assignedToUserId !== 'ALL' && t.assignedToUserId !== currentUser.id) {
      return false;
    }
    return true;
  });

  const handleCompleteTask = (
    taskId: string,
    proofPhotoUrl: string,
    beforePhotoUrl?: string,
    notes?: string
  ) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const updated: DailyTask = {
      ...task,
      status: 'completed',
      proofPhotoUrl,
      beforePhotoUrl,
      boyNotes: notes,
      completedByUserId: currentUser?.id || 'pb-101',
      completedByName: currentUser ? (language === 'hi' ? currentUser.nameHi : currentUser.name) : 'Ramesh Kumar',
      completedAt: new Date().toISOString(),
      adminStatus: 'pending_review',
    };

    onUpdateTask(updated);
  };

  const pendingCount = tasks.filter((t) => t.status !== 'completed').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  return (
    <div className="space-y-6 pb-20">
      
      {/* Top Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">
            <Calendar className="w-4 h-4" />
            <span>{language === 'hi' ? 'आज के निर्धारित कार्य' : "Today's Assigned Schedule"}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-950">
            {language === 'hi' ? 'दैनिक कार्य एवं प्रमाण (Tasks)' : 'Daily Task Checklist'}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {language === 'hi'
              ? 'काम पूरा करने के बाद फोटो अपलोड करके मार्क डन करें।'
              : 'Complete tasks according to reference standards and upload verification photos.'}
          </p>
        </div>

        {/* Action / Stats */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold px-3.5 py-2 bg-slate-100 rounded-xl">
            <span className="text-amber-700">⏳ {pendingCount} {language === 'hi' ? 'बाकी' : 'Pending'}</span>
            <span>•</span>
            <span className="text-emerald-700">✅ {completedCount} {language === 'hi' ? 'पूर्ण' : 'Done'}</span>
          </div>

          {currentUser?.role === 'admin' && onOpenCreateTask && (
            <button
              onClick={onOpenCreateTask}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer min-h-[44px]"
            >
              {language === 'hi' ? '+ नया कार्य जोड़ें' : '+ Create Task'}
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-xl">
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[40px] ${
              filter === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'hi' ? 'सभी कार्य' : 'All Tasks'} ({tasks.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[40px] ${
              filter === 'pending'
                ? 'bg-white text-amber-900 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'hi' ? 'लंबित कार्य' : 'Pending'} ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[40px] ${
              filter === 'completed'
                ? 'bg-white text-emerald-900 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'hi' ? 'पूर्ण कार्य' : 'Completed'} ({completedCount})
          </button>
        </div>

        {currentUser?.role !== 'admin' && (
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer self-start sm:self-auto">
            <input
              type="checkbox"
              checked={showOnlyMine}
              onChange={(e) => setShowOnlyMine(e.target.checked)}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
            />
            <span>{language === 'hi' ? 'केवल मेरे कार्य दिखाएं' : 'Show Only My Shift Tasks'}</span>
          </label>
        )}
      </div>

      {/* Task Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTasks.map((task) => {
          const isDone = task.status === 'completed';

          return (
            <div
              key={task.id}
              className={`bg-white rounded-2xl border transition-all p-5 shadow-xs flex flex-col justify-between ${
                isDone
                  ? 'border-emerald-300 bg-emerald-50/10'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                {/* Top Badge: Time + Room + Status */}
                <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-lg">
                      <Clock className="w-3.5 h-3.5 text-amber-700" />
                      <span>{task.scheduledTime}</span>
                    </span>
                    <span className="flex items-center gap-1 text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{language === 'hi' ? task.roomNameHi : task.roomNameEn}</span>
                    </span>
                  </div>

                  {isDone ? (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{language === 'hi' ? 'संपन्न' : 'Done'}</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold">
                      {language === 'hi' ? 'लंबित' : 'Pending'}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-base sm:text-lg font-black text-slate-950 mb-2">
                  {language === 'hi' ? task.titleHi : task.titleEn}
                </h3>

                {/* Instructions */}
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                  {language === 'hi' ? task.instructionsHi : task.instructionsEn}
                </p>

                {/* Reference Photo vs Proof Photo Comparison Strip */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {/* Reference */}
                  <div
                    className="relative aspect-16/10 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer group"
                    onClick={() => setZoomPhoto(task.referencePhotoUrl)}
                  >
                    <img
                      src={task.referencePhotoUrl}
                      alt="Standard"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform"
                    />
                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/70 text-white rounded text-[10px] font-bold">
                      {language === 'hi' ? 'मानक फोटो' : 'Reference'}
                    </div>
                  </div>

                  {/* Proof Photo (If Completed) or Upload placeholder */}
                  {isDone && task.proofPhotoUrl ? (
                    <div
                      className="relative aspect-16/10 rounded-xl overflow-hidden bg-emerald-50 border-2 border-emerald-500 cursor-pointer group"
                      onClick={() => setZoomPhoto(task.proofPhotoUrl || null)}
                    >
                      <img
                        src={task.proofPhotoUrl}
                        alt="Proof"
                        className="w-full h-full object-cover group-hover:scale-102 transition-transform"
                      />
                      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-emerald-700 text-white rounded text-[10px] font-bold flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" />
                        <span>{language === 'hi' ? 'अपलोड फोटो' : 'Uploaded Proof'}</span>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => setActiveTaskForModal(task)}
                      className="aspect-16/10 rounded-xl border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/40 hover:bg-amber-50/80 flex flex-col items-center justify-center p-2 text-center cursor-pointer transition-all"
                    >
                      <Camera className="w-5 h-5 text-amber-700 mb-1" />
                      <span className="text-[11px] font-bold text-amber-900 leading-tight">
                        {language === 'hi' ? 'फोटो अपलोड करें' : 'Upload Proof'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Proof Details if Done */}
                {isDone && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1 mb-4">
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="font-semibold text-slate-500">{language === 'hi' ? 'कर्मचारी:' : 'Completed by:'}</span>
                      <span className="font-bold">{task.completedByName}</span>
                    </div>
                    {task.completedAt && (
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="font-semibold text-slate-500">{language === 'hi' ? 'समय:' : 'Timestamp:'}</span>
                        <span>{new Date(task.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    )}
                    {task.boyNotes && (
                      <div className="pt-1 text-slate-700 italic border-t border-slate-200">
                        "{task.boyNotes}"
                      </div>
                    )}
                    {task.adminStatus === 'approved' && (
                      <div className="pt-1 text-emerald-800 font-bold flex items-center gap-1 border-t border-emerald-100">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{language === 'hi' ? 'एडमिन द्वारा स्वीकृत' : 'Admin Approved'}</span>
                        {task.adminFeedback && <span className="font-normal italic"> - "{task.adminFeedback}"</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <VoiceButton
                  text={language === 'hi' ? (task.audioTextHi || task.instructionsHi) : `${task.titleEn}. ${task.instructionsEn}`}
                  lang={language}
                  textId={`voice-task-${task.id}`}
                  size="sm"
                  label={language === 'hi' ? 'निर्देश सुनें' : 'Listen'}
                />

                {!isDone ? (
                  <button
                    onClick={() => setActiveTaskForModal(task)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer min-h-[44px]"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{language === 'hi' ? 'फोटो अपलोड करें व पूरा करें' : 'Upload Photo & Finish'}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveTaskForModal(task)}
                    className="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px]"
                  >
                    <Camera className="w-4 h-4 text-slate-500" />
                    <span>{language === 'hi' ? 'फोटो बदलें / री-अपलोड' : 'Re-upload Photo'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredTasks.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500 font-medium text-sm">
            {language === 'hi' ? 'कोई कार्य उपलब्ध नहीं है।' : 'No tasks match current filter.'}
          </p>
        </div>
      )}

      {/* Task Complete Modal */}
      {activeTaskForModal && (
        <TaskCompleteModal
          task={activeTaskForModal}
          isOpen={!!activeTaskForModal}
          onClose={() => setActiveTaskForModal(null)}
          currentUser={currentUser}
          onComplete={handleCompleteTask}
          language={language}
        />
      )}

      {/* Zoom Modal */}
      {Boolean(zoomPhoto && zoomPhoto.trim()) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md cursor-pointer animate-in fade-in"
          onClick={() => setZoomPhoto(null)}
        >
          <div className="relative max-w-5xl max-h-[92vh] w-full flex flex-col items-center">
            <img
              src={zoomPhoto!}
              alt="Zoomed reference"
              className="max-h-[82vh] w-auto max-w-full object-contain rounded-xl shadow-2xl"
            />
            <div className="mt-3 text-white text-xs font-semibold bg-black/60 px-4 py-2 rounded-full">
              {language === 'hi' ? 'बंद करने के लिए कहीं भी क्लिक करें' : 'Click anywhere to close preview'}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
