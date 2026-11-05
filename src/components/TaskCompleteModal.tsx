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
} from 'lucide-react';

interface TaskCompleteModalProps {
  task: DailyTask | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onComplete: (
    taskId: string,
    proofPhotoUrl: string,
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
  const [proofPhoto, setProofPhoto] = useState<string | null>(null);
  const [beforePhoto, setBeforePhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const proofInputRef = useRef<HTMLInputElement>(null);
  const beforeInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !task) return null;

  const handleProofFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      setError(null);
      const dataUrl = await fileToDataUrl(file);
      setProofPhoto(dataUrl);
    } catch (err) {
      setError(
        language === 'hi'
          ? 'फोटो लोड करने में त्रुटि हुई। कृपया दोबारा प्रयास करें।'
          : 'Error loading photo. Please try again.'
      );
    } finally {
      setIsProcessing(false);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofPhoto) {
      setError(
        language === 'hi'
          ? 'कृपया काम पूरा होने का फोटो (Proof Photo) अपलोड करें।'
          : 'Please capture or upload a completion proof photo.'
      );
      return;
    }

    onComplete(task.id, proofPhoto, beforePhoto || undefined, notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{task.scheduledTime}</span>
              <span>•</span>
              <MapPin className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? task.roomNameHi : task.roomNameEn}</span>
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
              {language === 'hi' ? 'संदर्भ फोटो (Reference - ऐसा दिखना चाहिए):' : 'Official Reference Standard:'}
            </label>
            <div className="aspect-16/9 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 relative">
              {task.referencePhotoUrl ? (
                <img
                  src={task.referencePhotoUrl}
                  alt="Reference standard"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : null}
              <div className="absolute top-2 left-2 px-2.5 py-1 bg-black/70 backdrop-blur-xs text-white rounded-md text-[11px] font-bold">
                {language === 'hi' ? 'मानक फोटो' : 'Official Target Standard'}
              </div>
            </div>
          </div>

          {/* Upload Proof Photo */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-emerald-600" />
                <span>
                  {language === 'hi'
                    ? 'काम पूरा होने का फोटो खींचें / अपलोड करें *'
                    : 'Capture / Upload Completion Photo *'}
                </span>
              </label>
              {proofPhoto && (
                <button
                  type="button"
                  onClick={() => setProofPhoto(null)}
                  className="text-xs text-red-600 hover:underline font-semibold"
                >
                  {language === 'hi' ? 'फोटो हटाएं' : 'Remove'}
                </button>
              )}
            </div>

            <input
              ref={proofInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleProofFileChange}
            />

            {proofPhoto ? (
              <div className="aspect-16/9 rounded-xl overflow-hidden border-2 border-emerald-500 bg-slate-100 relative">
                <img
                  src={proofPhoto}
                  alt="Proof completion"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2 px-3 py-1 bg-emerald-600 text-white rounded-md text-xs font-bold flex items-center gap-1 shadow-sm">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{language === 'hi' ? 'फोटो तैयार' : 'Photo Attached'}</span>
                </div>
              </div>
            ) : (
              <div
                onClick={() => proofInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-amber-500 hover:bg-amber-50/20 rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px]"
              >
                {isProcessing ? (
                  <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2">
                      <Camera className="w-6 h-6" />
                    </div>
                    <span className="font-extrabold text-sm text-slate-900 block">
                      {language === 'hi' ? 'कैमरा खोलें या फोटो चुनें' : 'Take Camera Photo / Choose File'}
                    </span>
                    <span className="text-xs text-slate-500 mt-0.5">
                      {language === 'hi'
                        ? 'सफाई और व्यवस्था का स्पष्ट फोटो लें'
                        : 'Capture clean, clear proof photo of the room'}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Optional Notes */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {language === 'hi' ? 'टिप्पणी (वैकल्पिक Note):' : 'Optional Notes:'}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                language === 'hi'
                  ? 'उदा. टेबल सैनिटाइज की, 2 फ्रेश बोतलें रखीं'
                  : 'e.g. Table sanitized, 2 fresh bottles placed'
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
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
            disabled={!proofPhoto || isProcessing}
            className={`flex-1 py-3 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[48px] shadow-sm ${
              proofPhoto
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>
              {language === 'hi' ? 'कार्य संपन्न करें (Mark Complete)' : 'Submit & Mark Complete'}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};
