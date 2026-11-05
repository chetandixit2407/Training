import React, { useState, useRef } from 'react';
import { DailyTask, User, Language } from '../types';
import { fileToDataUrl } from '../services/storageService';
import { VoiceButton } from './VoiceButton';
import {
  X,
  Camera,
  Upload,
  CheckCircle2,
  Clock,
  MapPin,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  ShieldCheck,
  Calendar,
} from 'lucide-react';

export interface CompletionPhotoDraft {
  id: string;
  photoBase64: string;
  angleLabel: string;
  caption?: string;
}

interface TaskCompleteModalProps {
  task: DailyTask | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onComplete: (
    taskId: string,
    proofPhotos: Array<{ photoBase64: string; angleLabel?: string; caption?: string }>,
    primaryPhotoUrl: string,
    beforePhotoUrl?: string,
    notes?: string
  ) => void;
  language: Language;
}

export const TaskCompleteModal: React.FC<TaskCompleteModalProps> = ({
  task,
  isOpen,
  onClose,
  currentUser,
  onComplete,
  language,
}) => {
  const [completionPhotos, setCompletionPhotos] = useState<CompletionPhotoDraft[]>([]);
  const [beforePhoto, setBeforePhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState<string | null>(null);

  const multiPhotoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const beforeInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !task) return null;

  const currentBoyName = currentUser
    ? language === 'hi'
      ? currentUser.nameHi
      : currentUser.name
    : 'Pantry Boy';
  const currentBoyId = currentUser?.id || 'pb-101';
  const currentTimeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Handle multiple photo files upload
  const handleMultipleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsProcessing(true);
      setError(null);
      const newDrafts: CompletionPhotoDraft[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = await fileToDataUrl(file);
        const angleNum = completionPhotos.length + newDrafts.length + 1;
        newDrafts.push({
          id: `draft_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          photoBase64: dataUrl,
          angleLabel:
            language === 'hi'
              ? `एंगल #${angleNum}: ${file.name.slice(0, 15)}`
              : `Angle #${angleNum}: ${file.name.slice(0, 15)}`,
          caption: '',
        });
      }

      setCompletionPhotos((prev) => [...prev, ...newDrafts]);
    } catch (err) {
      setError(
        language === 'hi'
          ? 'फोटो लोड करने में त्रुटि हुई। कृपया दोबारा प्रयास करें।'
          : 'Error loading photo(s). Please try again.'
      );
    } finally {
      setIsProcessing(false);
      if (multiPhotoInputRef.current) multiPhotoInputRef.current.value = '';
    }
  };

  // Handle single camera capture
  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      setError(null);
      const dataUrl = await fileToDataUrl(file);
      const angleNum = completionPhotos.length + 1;

      setCompletionPhotos((prev) => [
        ...prev,
        {
          id: `draft_cam_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          photoBase64: dataUrl,
          angleLabel:
            language === 'hi'
              ? `कैमरा एंगल #${angleNum}`
              : `Camera Angle #${angleNum}`,
          caption: '',
        },
      ]);
    } catch (err) {
      setError(
        language === 'hi'
          ? 'कैमरा फोटो लोड करने में त्रुटि हुई।'
          : 'Error capturing camera photo.'
      );
    } finally {
      setIsProcessing(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleBeforeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const dataUrl = await fileToDataUrl(file);
      setBeforePhoto(dataUrl);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const removePhotoDraft = (id: string) => {
    setCompletionPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePhotoLabel = (id: string, angleLabel: string) => {
    setCompletionPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, angleLabel } : p))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (completionPhotos.length === 0) {
      setError(
        language === 'hi'
          ? 'कृपया काम पूरा होने का कम से कम 1 फोटो (Proof Photo) अपलोड करें।'
          : 'Please capture or upload at least 1 completion proof photo.'
      );
      return;
    }

    const payloadPhotos = completionPhotos.map((p) => ({
      photoBase64: p.photoBase64,
      angleLabel: p.angleLabel,
      caption: p.caption,
    }));

    const primaryPhotoUrl = completionPhotos[0]?.photoBase64 || '';
    onComplete(task.id, payloadPhotos, primaryPhotoUrl, beforePhoto || undefined, notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{task.scheduledTime}</span>
              <span>•</span>
              <MapPin className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? task.roomNameHi : task.roomNameEn}</span>
              <span>•</span>
              <span className="text-slate-300">Staff: {currentBoyName}</span>
            </div>
            <h3 className="text-base sm:text-lg font-black mt-0.5">
              {language === 'hi' ? task.titleHi : task.titleEn}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          
          {/* Instructions + Audio */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-extrabold text-amber-900 uppercase tracking-wide">
                {language === 'hi' ? 'कार्य निर्देश (Instructions)' : 'Instructions'}
              </span>
              <VoiceButton
                text={language === 'hi' ? (task.audioTextHi || task.instructionsHi) : task.instructionsEn}
                lang={language}
                textId={`task-modal-${task.id}`}
                size="sm"
                label={language === 'hi' ? 'निर्देश सुनें' : 'Listen'}
              />
            </div>
            <p className="text-sm text-slate-800 leading-relaxed font-medium">
              {language === 'hi' ? task.instructionsHi : task.instructionsEn}
            </p>
          </div>

          {/* Reference Photo Comparison Box */}
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
              {language === 'hi' ? 'मानक संदर्भ फोटो (Official Standard Target):' : 'Official Target Reference Standard:'}
            </label>
            <div className="aspect-16/9 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 relative group">
              {task.referencePhotoUrl ? (
                <img
                  src={task.referencePhotoUrl}
                  alt="Reference standard"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : null}
              <div className="absolute top-2 left-2 px-2.5 py-1 bg-black/75 backdrop-blur-xs text-white rounded-md text-[11px] font-bold">
                {language === 'hi' ? 'ऑफिस मानक लक्ष्य' : 'Official Target Standard'}
              </div>
            </div>
          </div>

          {/* 40-Day Retention Policy Notice Badge */}
          <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-start gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-lg shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-xs text-emerald-950">
              <div className="font-extrabold flex items-center gap-1">
                <span>{language === 'hi' ? '40-दिवसीय सुरक्षित फोटो संग्रह नीति' : '40-Day Secure Photo Retention Policy'}</span>
                <span className="px-1.5 py-0.2 bg-emerald-200 text-emerald-900 rounded font-black text-[10px]">
                  40 DAYS
                </span>
              </div>
              <p className="text-emerald-800 mt-0.5 leading-relaxed">
                {language === 'hi'
                  ? `हर फोटो आपके नाम (${currentBoyName}), आईडी (${currentBoyId}) और सटीक समय (${currentTimeString}) के साथ सर्वर में सुरक्षित 40 दिनों के लिए सेव होगी, जिसके बाद स्वतः डिलीट हो जाएगी।`
                  : `Every photo is permanently archived with your identity (${currentBoyName}), exact timestamp (${currentTimeString}), and room metadata in office storage for 40 days, then automatically purged.`}
              </p>
            </div>
          </div>

          {/* Multiple Completion Photos Upload Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-emerald-600" />
                <span>
                  {language === 'hi'
                    ? `कार्य संपन्नता के फोटो (Multiple Photos) * (${completionPhotos.length} संलग्न)`
                    : `Completion Proof Photos * (${completionPhotos.length} Attached)`}
                </span>
              </label>

              {completionPhotos.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCompletionPhotos([])}
                  className="text-xs text-red-600 hover:underline font-semibold cursor-pointer"
                >
                  {language === 'hi' ? 'सभी हटाएं' : 'Clear All'}
                </button>
              )}
            </div>

            {/* Hidden file inputs */}
            <input
              ref={multiPhotoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleMultipleFilesChange}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleCameraCapture}
            />

            {/* Grid of Captured Completion Photos */}
            {completionPhotos.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {completionPhotos.map((photo, idx) => (
                    <div
                      key={photo.id}
                      className="border-2 border-emerald-500 rounded-xl overflow-hidden bg-slate-900 relative group shadow-sm flex flex-col"
                    >
                      <div
                        className="aspect-4/3 relative cursor-pointer overflow-hidden"
                        onClick={() => setPreviewZoom(photo.photoBase64)}
                      >
                        <img
                          src={photo.photoBase64}
                          alt={`Proof angle ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-103 transition-transform"
                        />
                        <div className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-black/80 backdrop-blur-xs text-white rounded text-[10px] font-bold">
                          #{idx + 1}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePhotoDraft(photo.id);
                          }}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-red-600/90 hover:bg-red-700 text-white flex items-center justify-center cursor-pointer transition-colors shadow-xs"
                          title="Remove photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Photo Label input */}
                      <div className="p-1.5 bg-slate-900 border-t border-slate-800">
                        <input
                          type="text"
                          value={photo.angleLabel}
                          onChange={(e) => updatePhotoLabel(photo.id, e.target.value)}
                          placeholder="Angle description..."
                          className="w-full bg-slate-800 text-white text-[11px] px-2 py-1 rounded border border-slate-700 focus:outline-none focus:border-emerald-500 font-medium"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add More Photos Buttons Bar */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isProcessing}
                    className="flex-1 py-2 px-3 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors min-h-[40px]"
                  >
                    <Camera className="w-4 h-4 text-emerald-700" />
                    <span>{language === 'hi' ? '+ और फोटो खींचें (Camera)' : '+ Snap Another Photo'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => multiPhotoInputRef.current?.click()}
                    disabled={isProcessing}
                    className="flex-1 py-2 px-3 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors min-h-[40px]"
                  >
                    <Upload className="w-4 h-4 text-slate-700" />
                    <span>{language === 'hi' ? '+ गैलरी से जोड़ें' : '+ Select More Files'}</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Empty Upload Box */
              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/20 rounded-2xl p-6 text-center transition-all flex flex-col items-center justify-center min-h-[160px]">
                {isProcessing ? (
                  <div className="flex flex-col items-center py-4">
                    <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-2" />
                    <span className="text-xs text-slate-600 font-semibold">
                      {language === 'hi' ? 'फोटो प्रोसेस हो रहा है...' : 'Processing photos...'}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3 shadow-xs">
                      <Camera className="w-7 h-7" />
                    </div>
                    <span className="font-black text-sm text-slate-900 block">
                      {language === 'hi'
                        ? 'कार्य पूरा होने के फोटो अपलोड करें (Multiple Photos)'
                        : 'Capture or Upload Task Completion Photos'}
                    </span>
                    <span className="text-xs text-slate-500 mt-1 max-w-md">
                      {language === 'hi'
                        ? 'विभिन्न कोणों से फोटो खींचें: टेबल, कुर्सियां, पानी के गिलास, व कचरा पेटी। एक से अधिक फोटो एक साथ चुन सकते हैं।'
                        : 'Capture multiple angles: table surface, water setup, chair alignment & dustbin. You can upload multiple photos.'}
                    </span>

                    <div className="flex items-center gap-2 mt-4">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors min-h-[42px]"
                      >
                        <Camera className="w-4 h-4" />
                        <span>{language === 'hi' ? 'कैमरा से फोटो लें' : 'Take Camera Photo'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => multiPhotoInputRef.current?.click()}
                        className="py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors min-h-[42px]"
                      >
                        <Upload className="w-4 h-4" />
                        <span>{language === 'hi' ? 'फ़ाइलें चुनें' : 'Choose Files'}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Optional Before Photo */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                <span>{language === 'hi' ? 'सफाई से पहले का फोटो (वैकल्पिक Before Photo)' : 'Optional Before Cleaning Photo'}</span>
              </label>
              {beforePhoto && (
                <button
                  type="button"
                  onClick={() => setBeforePhoto(null)}
                  className="text-[11px] text-red-600 hover:underline font-semibold"
                >
                  {language === 'hi' ? 'हटाएं' : 'Remove'}
                </button>
              )}
            </div>

            <input
              ref={beforeInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBeforeFileChange}
            />

            {beforePhoto ? (
              <div className="h-24 w-36 rounded-lg overflow-hidden border border-slate-300 relative">
                <img src={beforePhoto} alt="Before" className="w-full h-full object-cover" />
                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/70 text-white text-[9px] font-bold rounded">
                  Before
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => beforeInputRef.current?.click()}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{language === 'hi' ? 'सफाई से पहले की फोटो जोड़ें' : 'Add Before Photo'}</span>
              </button>
            )}
          </div>

          {/* Optional Notes */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {language === 'hi' ? 'टिप्पणी (वैकल्पिक Staff Note):' : 'Optional Notes:'}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                language === 'hi'
                  ? 'उदा. टेबल सैनिटाइज की, 2 फ्रेश बोतलें रखीं, डस्टबिन बदला'
                  : 'e.g. Table sanitized, 2 fresh bottles placed, bin replaced'
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer min-h-[44px]"
          >
            {language === 'hi' ? 'रद्द करें' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={completionPhotos.length === 0 || isProcessing}
            className={`flex-1 py-3 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[48px] shadow-sm ${
              completionPhotos.length > 0
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>
              {language === 'hi'
                ? `कार्य संपन्न करें (${completionPhotos.length} फोटो के साथ)`
                : `Submit & Complete (${completionPhotos.length} Photo${completionPhotos.length > 1 ? 's' : ''})`}
            </span>
          </button>
        </div>

      </div>

      {/* Zoom Modal */}
      {previewZoom && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-pointer animate-in fade-in"
          onClick={() => setPreviewZoom(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <img
              src={previewZoom}
              alt="Zoomed preview"
              className="max-h-[80vh] w-auto max-w-full object-contain rounded-xl shadow-2xl"
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
