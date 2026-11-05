import React, { useState } from 'react';
import { SOP, Language } from '../types';
import { VoiceButton } from './VoiceButton';
import {
  UserCheck,
  UserPlus,
  Layout,
  Zap,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface SOPsSectionProps {
  sops: SOP[];
  language: Language;
}

export const SOPsSection: React.FC<SOPsSectionProps> = ({ sops, language }) => {
  const [selectedSOPId, setSelectedSOPId] = useState<string>(sops[0]?.id || 'sop-client-arrival');
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  const currentSOP = sops.find((s) => s.id === selectedSOPId) || sops[0];

  const getSopIcon = (iconName: string) => {
    switch (iconName) {
      case 'UserCheck':
        return UserCheck;
      case 'UserPlus':
        return UserPlus;
      case 'Layout':
        return Layout;
      case 'Zap':
        return Zap;
      case 'Clock':
        return Clock;
      default:
        return Sparkles;
    }
  };

  const toggleStepDone = (sopId: string, stepNum: number) => {
    const key = `${sopId}-${stepNum}`;
    setCompletedSteps((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (!currentSOP) return null;

  return (
    <div className="space-y-6 pb-20">
      
      {/* SOP Category Selector */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {sops.map((sop) => {
            const Icon = getSopIcon(sop.iconName);
            const isSelected = selectedSOPId === sop.id;
            return (
              <button
                key={sop.id}
                onClick={() => setSelectedSOPId(sop.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 transition-all cursor-pointer min-h-[44px] ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isSelected ? 'text-amber-400' : 'text-slate-500'}`} />
                <span>{language === 'hi' ? sop.titleHi : sop.titleEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SOP Header Card */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1">
            <span>{language === 'hi' ? 'मानक संचालन प्रक्रिया (SOP)' : 'Standard Operating Procedure'}</span>
            <span>•</span>
            <span>{language === 'hi' ? currentSOP.badgeHi : currentSOP.badgeEn}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-950">
            {language === 'hi' ? currentSOP.titleHi : currentSOP.titleEn}
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            {language === 'hi' ? currentSOP.summaryHi : currentSOP.summaryEn}
          </p>
        </div>

        {/* Master Voice Narration for Entire SOP */}
        <div className="shrink-0">
          <VoiceButton
            text={
              language === 'hi'
                ? `${currentSOP.titleHi}. ${currentSOP.steps
                    .map((s) => `कदम ${s.stepNumber}, ${s.audioTextHi}`)
                    .join('. ')}`
                : `${currentSOP.titleEn}. ${currentSOP.steps
                    .map((s) => `Step ${s.stepNumber}. ${s.titleEn}. ${s.audioTextEn}`)
                    .join('. ')}`
            }
            lang={language}
            textId={`sop-full-${currentSOP.id}-${language}`}
            label={language === 'hi' ? 'पूरा SOP ऑडियो में सुनें' : 'Listen Full SOP'}
            size="lg"
            className="w-full sm:w-auto"
          />
        </div>
      </div>

      {/* Step by Step Flow */}
      <div className="space-y-4">
        {currentSOP.steps.map((step) => {
          const stepKey = `${currentSOP.id}-${step.stepNumber}`;
          const isDone = !!completedSteps[stepKey];

          return (
            <div
              key={step.stepNumber}
              className={`bg-white rounded-2xl border transition-all p-5 shadow-xs ${
                isDone
                  ? 'border-emerald-300 bg-emerald-50/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Step Top Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-base shrink-0 ${
                    isDone
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 text-amber-400'
                  }`}>
                    {step.stepNumber}
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-950">
                      {language === 'hi' ? step.titleHi : step.titleEn}
                    </h3>
                  </div>
                </div>

                {/* Step Voice & Done Button */}
                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <VoiceButton
                    text={language === 'hi' ? step.audioTextHi : `${step.titleEn}. ${step.audioTextEn}`}
                    lang={language}
                    textId={`step-audio-${stepKey}-${language}`}
                    size="sm"
                    label={language === 'hi' ? 'बोलकर बताएं' : 'Listen'}
                  />

                  <button
                    onClick={() => toggleStepDone(currentSOP.id, step.stepNumber)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[36px] ${
                      isDone
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isDone
                        ? language === 'hi'
                          ? 'सीख लिया ✓'
                          : 'Understood ✓'
                        : language === 'hi'
                        ? 'समझ आ गया'
                        : 'Mark Done'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Step Detail Explanation */}
              <div className="text-slate-800 text-sm sm:text-base leading-relaxed mb-4 font-normal">
                {language === 'hi' ? step.detailHi : step.detailEn}
              </div>

              {/* Do vs Don't Tips Container */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* DO */}
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200/60 text-xs sm:text-sm text-emerald-950">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    ✓
                  </div>
                  <div>
                    <span className="font-bold text-emerald-800 block mb-0.5">
                      {language === 'hi' ? 'क्या करें (Do):' : 'Recommended Do:'}
                    </span>
                    <span>{language === 'hi' ? step.doTipHi : step.doTipEn}</span>
                  </div>
                </div>

                {/* DON'T */}
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200/60 text-xs sm:text-sm text-rose-950">
                  <div className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    ✗
                  </div>
                  <div>
                    <span className="font-bold text-rose-800 block mb-0.5">
                      {language === 'hi' ? 'क्या न करें (Don’t):' : 'Strict Don’t:'}
                    </span>
                    <span>{language === 'hi' ? step.dontTipHi : step.dontTipEn}</span>
                  </div>
                </div>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
