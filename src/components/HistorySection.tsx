import React, { useState } from 'react';
import { DailyTask, User, Language } from '../types';
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
} from 'lucide-react';

interface HistorySectionProps {
  tasks: DailyTask[];
  currentUser: User | null;
  language: Language;
  onUpdateTask: (task: DailyTask) => void;
}

export const HistorySection: React.FC<HistorySectionProps> = ({
  tasks,
  currentUser,
  language,
  onUpdateTask,
}) => {
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const [feedbackInput, setFeedbackInput] = useState<{ [taskId: string]: string }>({});

  const completedTasks = tasks.filter((t) => t.status === 'completed' && t.proofPhotoUrl);

  const handleAdminApprove = (task: DailyTask) => {
    const feedback = feedbackInput[task.id] || (language === 'hi' ? 'मानक के अनुसार सही कार्य किया गया।' : 'Approved as per office standard.');
    onUpdateTask({
      ...task,
      adminStatus: 'approved',
      adminFeedback: feedback,
      adminReviewedAt: new Date().toISOString(),
    });
  };

  const handleAdminRework = (task: DailyTask) => {
    const feedback = feedbackInput[task.id] || (language === 'hi' ? 'कृपया टेबल दोबारा पोंछें और सही फोटो लें।' : 'Please re-clean and upload proper photo.');
    onUpdateTask({
      ...task,
      adminStatus: 'needs_rework',
      adminFeedback: feedback,
      adminReviewedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Top Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>{language === 'hi' ? 'कार्य सत्यापन रिकॉर्ड' : 'Task Verification Audit'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-950">
            {language === 'hi' ? 'फोटो प्रमाण और इतिहास (Proof History)' : 'Photo Proofs & History'}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {language === 'hi'
              ? 'पैंट्री स्टाफ द्वारा अपलोड किए गए वास्तविक फोटो, समय और एडमिन समीक्षा।'
              : 'Actual photos uploaded by pantry staff with timestamps and admin reviews.'}
          </p>
        </div>

        <div className="text-xs font-bold px-3.5 py-2 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>
            {completedTasks.length}{' '}
            {language === 'hi' ? 'सत्यापित कार्य संपन्न' : 'Completed Proofs'}
          </span>
        </div>
      </div>

      {/* History Grid */}
      {completedTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500 font-medium text-sm">
            {language === 'hi'
              ? 'अभी तक कोई फोटो प्रमाण अपलोड नहीं हुआ है। "दैनिक कार्य" सेक्शन में जाकर काम पूरा करें।'
              : 'No task proof photos uploaded yet. Complete a task in "Daily Tasks" tab to see proofs here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {completedTasks.map((task) => {
            const isApproved = task.adminStatus === 'approved';
            const isRework = task.adminStatus === 'needs_rework';

            return (
              <div
                key={task.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Photo Comparison Header */}
                  <div className="grid grid-cols-2 bg-slate-900 text-white text-[11px] font-bold px-3 py-2 border-b border-slate-800">
                    <div>{language === 'hi' ? 'मानक संदर्भ (Target)' : 'Target Reference'}</div>
                    <div className="text-emerald-400">
                      {language === 'hi' ? 'स्टाफ द्वारा अपलोड (Proof)' : 'Uploaded Proof'}
                    </div>
                  </div>

                  {/* Dual Image Comparison Strip */}
                  <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1">
                    {/* Reference photo */}
                    <div
                      className="relative aspect-4/3 bg-slate-200 overflow-hidden cursor-pointer group"
                      onClick={() => setZoomPhoto(task.referencePhotoUrl)}
                    >
                      <img
                        src={task.referencePhotoUrl}
                        alt="Reference"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-102 transition-transform"
                      />
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/70 text-white rounded text-[9px] font-bold">
                        {language === 'hi' ? 'ऑफिस मानक' : 'Standard'}
                      </div>
                    </div>

                    {/* Proof photo */}
                    <div
                      className="relative aspect-4/3 bg-emerald-950 overflow-hidden cursor-pointer group border-2 border-emerald-500"
                      onClick={() => setZoomPhoto(task.proofPhotoUrl || null)}
                    >
                      <img
                        src={task.proofPhotoUrl}
                        alt="Proof"
                        className="w-full h-full object-cover group-hover:scale-102 transition-transform"
                      />
                      <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-emerald-600 text-white rounded text-[9px] font-bold flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" />
                        <span>{language === 'hi' ? 'वास्तविक फोटो' : 'Actual'}</span>
                      </div>
                    </div>
                  </div>

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

                    {/* Completion metadata */}
                    <div className="p-2.5 bg-slate-50 rounded-xl text-xs space-y-1 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">{language === 'hi' ? 'संपन्न करने वाले:' : 'Completed by:'}</span>
                        <span className="font-bold text-slate-900">{task.completedByName}</span>
                      </div>
                      {task.completedAt && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">{language === 'hi' ? 'तारीख व समय:' : 'Timestamp:'}</span>
                          <span className="font-medium text-slate-700">
                            {new Date(task.completedAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {task.boyNotes && (
                        <div className="pt-1 text-slate-700 italic border-t border-slate-200">
                          "{task.boyNotes}"
                        </div>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isApproved && (
                        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-1.5 font-bold">
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
                        <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center gap-1.5 font-bold">
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
                        <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-1.5 font-semibold">
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
                            : 'Admin comment (optional)'
                        }
                        value={feedbackInput[task.id] ?? task.adminFeedback ?? ''}
                        onChange={(e) =>
                          setFeedbackInput({ ...feedbackInput, [task.id]: e.target.value })
                        }
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAdminApprove(task)}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors min-h-[36px]"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{language === 'hi' ? 'स्वीकृत करें (Approve)' : 'Approve'}</span>
                      </button>
                      <button
                        onClick={() => handleAdminRework(task)}
                        className="py-2 px-3 rounded-xl border border-rose-300 hover:bg-rose-50 text-rose-700 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors min-h-[36px]"
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
