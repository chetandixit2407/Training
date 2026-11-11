import React from 'react';
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';
import { Language } from '../types';

interface DeletePhotoConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  language: Language;
  photoUrl?: string;
  roomName?: string;
  angleIndex?: number;
  totalPhotos?: number;
  error?: string | null;
}

export const DeletePhotoConfirmModal: React.FC<DeletePhotoConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
  language,
  photoUrl,
  roomName,
  angleIndex,
  totalPhotos,
  error,
}) => {
  if (!isOpen) return null;

  const angleText =
    typeof angleIndex === 'number' && typeof totalPhotos === 'number' && totalPhotos > 0
      ? `Angle ${angleIndex + 1} of ${totalPhotos}`
      : undefined;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => {
        if (!isDeleting) onClose();
      }}
    >
      <div
        className="relative bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-5 sm:p-6 text-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Stripe */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-rose-500 to-amber-500" />

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isDeleting}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40"
          title={language === 'hi' ? 'बंद करें' : 'Close'}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Icon */}
        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-11 h-11 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              {language === 'hi'
                ? 'संदर्भ फोटो हमेशा के लिए हटाएं?'
                : 'Delete Reference Photo Permanently?'}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-300">
              {roomName && <span className="font-semibold text-amber-400 uppercase">{roomName}</span>}
              {roomName && angleText && <span>•</span>}
              {angleText && (
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-slate-300">
                  {angleText}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Photo Thumbnail Preview */}
        {photoUrl && (
          <div className="relative w-full h-36 sm:h-44 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 mb-4 flex items-center justify-center">
            <img
              src={photoUrl}
              alt="Photo preview to delete"
              className="w-full h-full object-contain"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-2.5">
              <span className="text-[11px] text-red-300 font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                {language === 'hi' ? 'यह फोटो हटा दी जाएगी' : 'This photo will be unlinked & purged'}
              </span>
            </div>
          </div>
        )}

        {/* Warning Details */}
        <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-3 text-xs text-red-200/90 space-y-1 mb-5">
          <p className="font-semibold flex items-center gap-1.5 text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {language === 'hi' ? 'सावधानी (Permanent Deletion)' : 'Permanent Deletion Notice'}
          </p>
          <p className="text-[11px] leading-relaxed text-slate-300">
            {language === 'hi'
              ? 'यह फोटो क्लाउड स्टोरेज डिस्क और डेटाबेस से पूरी तरह हट जाएगी। यह क्रिया पूर्ववत (undo) नहीं की जा सकती।'
              : 'This photo will be permanently deleted from cloud storage and the database. This action cannot be undone.'}
          </p>
        </div>

        {/* Error message banner if any */}
        {error && (
          <div className="mb-4 p-2.5 rounded-lg bg-red-900/40 border border-red-700 text-red-200 text-xs">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer disabled:opacity-40"
          >
            {language === 'hi' ? 'रद्द करें (Cancel)' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 transition-all shadow-lg shadow-red-950/50 cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{language === 'hi' ? 'हटाया जा रहा है...' : 'Deleting...'}</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>{language === 'hi' ? 'हाँ, हमेशा के लिए हटाएं' : 'Delete Permanently'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
