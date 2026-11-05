import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';
import { speechService } from '../services/speechService';
import { Language } from '../types';

interface VoiceButtonProps {
  text: string;
  lang: Language;
  textId: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  text,
  lang,
  textId,
  label,
  size = 'md',
  className = '',
}) => {
  const [isSpeakingThis, setIsSpeakingThis] = useState(false);

  useEffect(() => {
    const unsubscribe = speechService.subscribe((state) => {
      setIsSpeakingThis(state.isSpeaking && state.currentTextId === textId);
    });
    return () => unsubscribe();
  }, [textId]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSpeakingThis) {
      speechService.stop();
    } else {
      speechService.speak(text, lang, textId);
    }
  };

  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs min-h-[36px]',
    md: 'px-3.5 py-2 text-sm min-h-[44px]',
    lg: 'px-5 py-3 text-base min-h-[48px]',
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all cursor-pointer select-none active:scale-95 ${sizeClasses[size]} ${
        isSpeakingThis
          ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-2 ring-amber-400 ring-offset-1'
          : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
      } ${className}`}
      title={isSpeakingThis ? 'ऑडियो रोकें / Stop Audio' : 'आवाज़ में सुनें / Listen to Audio'}
      aria-label={label || 'Listen to voice instruction'}
    >
      {isSpeakingThis ? (
        <>
          <VolumeX className="w-5 h-5 shrink-0 animate-pulse text-white" />
          <span className="font-semibold whitespace-nowrap">
            {lang === 'hi' ? 'रोकें (Stop)' : 'Stop'}
          </span>
          <span className="flex items-center gap-0.5 ml-1">
            <span className="w-1 h-3 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-1 h-4 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-1 h-2 bg-white rounded-full animate-bounce"></span>
          </span>
        </>
      ) : (
        <>
          <Volume2 className="w-5 h-5 shrink-0 text-amber-700" />
          <span className="whitespace-nowrap font-medium">
            {label ? label : lang === 'hi' ? 'आवाज़ में सुनें' : 'Listen Audio'}
          </span>
        </>
      )}
    </button>
  );
};
