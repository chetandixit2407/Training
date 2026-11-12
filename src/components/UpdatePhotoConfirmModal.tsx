import React from 'react';
import { RefreshCw, History, Shield, X, ArrowRight, Check } from 'lucide-react';
import { Language } from '../types';
import { ReferenceImage } from './ReferenceImage';

interface UpdatePhotoConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isUpdating: boolean;
  language: Language;
  roomName?: string;
  currentPhotoUrl?: string;
  newPhotoPreview?: string;
  currentCaption?: string;
}

export const UpdatePhotoConfirmModal: React.FC<UpdatePhotoConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isUpdating,
  language,
  roomName,
  currentPhotoUrl,
  newPhotoPreview,
  currentCaption,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div
        className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white font-bold shrink-0">
              <RefreshCw className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black leading-tight">
                {language === 'hi' ? 'संदर्भ फोटो अपडेट की पुष्टि' : 'Confirm Reference Photo Update'}
              </h3>
              <p className="text-xs text-blue-100 font-medium mt-0.5">
                {roomName || (language === 'hi' ? 'कमरा संदर्भ' : 'Room Reference')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isUpdating}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comparison Body */}
        <div className="p-4 sm:p-6 space-y-4">
          
          {/* Visual Before / After Comparison */}
          <div className="grid grid-cols-2 gap-3 items-center">
            {/* Current photo to be archived */}
            <div className="flex flex-col space-y-1.5">
              <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <History className="w-3 h-3 text-amber-600" />
                <span>{language === 'hi' ? 'वर्तमान फोटो' : 'Current Photo'}</span>
              </div>
              <div className="aspect-4/3 rounded-xl overflow-hidden border-2 border-amber-300 bg-slate-100 relative shadow-xs">
                {currentPhotoUrl ? (
                  <ReferenceImage
                    src={currentPhotoUrl}
                    alt="Current Reference"
                    language={language}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                    No photo
                  </div>
                )}
                <div className="absolute bottom-1 inset-x-1 px-1.5 py-0.5 bg-slate-900/80 backdrop-blur-xs text-amber-300 text-[10px] font-bold text-center rounded">
                  {language === 'hi' ? 'इतिहास में सुरक्षित' : 'Will be archived'}
                </div>
              </div>
            </div>

            {/* New replacement photo */}
            <div className="flex flex-col space-y-1.5">
              <div className="text-[11px] font-bold text-emerald-700 uppercase flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-600" />
                <span>{language === 'hi' ? 'नया मानक फोटो' : 'New Reference'}</span>
              </div>
              <div className="aspect-4/3 rounded-xl overflow-hidden border-2 border-emerald-500 bg-slate-100 relative shadow-xs">
                {newPhotoPreview ? (
                  <img
                    src={newPhotoPreview}
                    alt="New Reference Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                    Preview
                  </div>
                )}
                <div className="absolute bottom-1 inset-x-1 px-1.5 py-0.5 bg-emerald-700 text-white text-[10px] font-bold text-center rounded">
                  {language === 'hi' ? 'नया मुख्य मानक' : 'New Primary'}
                </div>
              </div>
            </div>
          </div>

          {/* Non-Destructive Protection Notice */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
            <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-extrabold">
                {language === 'hi'
                  ? 'पिछला फोटो डिलीट नहीं होगा:'
                  : 'Previous photo is NOT deleted:'}
              </span>{' '}
              {language === 'hi'
                ? 'यह फोटो स्वचालित रूप से "दिनांक-वार इतिहास" में सुरक्षित रहेगा। एडमिन इसे कभी भी देख सकते हैं या दोबारा मुख्य मानक के रूप में पुनर्स्थापित (Restore) कर सकते हैं।'
                : 'It will be permanently archived in Date-Wise Photo History. Admins can view or restore it back as the primary standard at any time.'}
            </div>
          </div>

          {currentCaption && (
            <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-700">{language === 'hi' ? 'विवरण: ' : 'Caption: '}</span>
              {currentCaption}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isUpdating}
            className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-white text-slate-700 font-bold text-xs transition-colors cursor-pointer min-h-[42px]"
          >
            {language === 'hi' ? 'रद्द करें' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isUpdating}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-60 min-h-[42px]"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{language === 'hi' ? 'अपडेट हो रहा है...' : 'Archiving & Updating...'}</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{language === 'hi' ? 'पुष्टि करें व नया फोटो लगाएं' : 'Confirm & Set New Photo'}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
