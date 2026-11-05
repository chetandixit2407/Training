import React, { useEffect, useState } from 'react';
import { User, Language } from '../types';
import { speechService } from '../services/speechService';
import { VolumeX, UserCheck, Shield, Globe, LogOut, CheckCircle2 } from 'lucide-react';

interface HeaderProps {
  currentTab: 'training' | 'assistant' | 'sops' | 'tasks' | 'history' | 'admin';
  setCurrentTab: (tab: 'training' | 'assistant' | 'sops' | 'tasks' | 'history' | 'admin') => void;
  currentUser: User | null;
  onOpenLogin: () => void;
  language: Language;
  onToggleLanguage: () => void;
  pendingTasksCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  currentUser,
  onOpenLogin,
  language,
  onToggleLanguage,
  pendingTasksCount,
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    const unsub = speechService.subscribe((state) => {
      setIsSpeaking(state.isSpeaking);
    });
    return () => unsub();
  }, []);

  const navItems = [
    {
      id: 'training' as const,
      labelHi: 'फोटो गाइड्स',
      labelEn: 'Photo Guides',
      badge: null,
    },
    {
      id: 'assistant' as const,
      labelHi: 'AI सहायक',
      labelEn: 'AI Assistant',
      badge: 'AI',
    },
    {
      id: 'sops' as const,
      labelHi: 'मानक SOPs',
      labelEn: 'SOPs',
      badge: null,
    },
    {
      id: 'tasks' as const,
      labelHi: 'दैनिक कार्य',
      labelEn: 'Daily Tasks',
      badge: pendingTasksCount > 0 ? pendingTasksCount : null,
    },
    {
      id: 'history' as const,
      labelHi: 'फोटो इतिहास',
      labelEn: 'Task Proofs',
      badge: null,
    },
    {
      id: 'admin' as const,
      labelHi: 'एडमिन कंट्रोल',
      labelEn: 'Admin Panel',
      badge: null,
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-6">
        
        {/* Zone 1: Wordmark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            OP
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-slate-900 tracking-tight text-sm sm:text-base leading-tight whitespace-nowrap">
              {language === 'hi' ? 'ऑफिस पैंट्री ट्रेनिंग' : 'Office Pantry Training'}
            </span>
            <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap hidden sm:inline">
              {language === 'hi' ? 'कार्यालय परिचालन एवं मानक' : 'Operations & Standard Guidance'}
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links (Desktop/Tablet) */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`relative px-3.5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>{language === 'hi' ? item.labelHi : item.labelEn}</span>
                {item.badge !== null && (
                  <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-bold leading-none ${
                    isActive ? 'bg-amber-400 text-slate-950' : 'bg-amber-500 text-white'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Controls (Language Toggle + User Switcher) */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* Audio Stop Button if Speaking */}
          {isSpeaking && (
            <button
              onClick={() => speechService.stop()}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-100 text-red-800 text-xs font-semibold hover:bg-red-200 transition-colors animate-pulse cursor-pointer"
              title="Stop audio playback"
            >
              <VolumeX className="w-4 h-4" />
              <span className="hidden sm:inline">{language === 'hi' ? 'आवाज़ रोकें' : 'Stop Audio'}</span>
            </button>
          )}

          {/* Language Switcher */}
          <button
            onClick={onToggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all border border-slate-200 cursor-pointer min-h-[40px]"
            title="Toggle Hindi / English"
            aria-label="Switch Language"
          >
            <Globe className="w-4 h-4 text-slate-600" />
            <span>{language === 'hi' ? 'English' : 'हिंदी'}</span>
          </button>

          {/* User Profile / Quick Switch Button */}
          <button
            onClick={onOpenLogin}
            className="flex items-center gap-2 pl-2 pr-2.5 sm:pr-3 py-1 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-slate-100 transition-all cursor-pointer min-h-[40px]"
            title="Switch User / Login"
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold ${
              currentUser?.role === 'admin' ? 'bg-amber-600' : 'bg-emerald-600'
            }`}>
              {currentUser?.role === 'admin' ? (
                <Shield className="w-4 h-4" />
              ) : (
                <UserCheck className="w-4 h-4" />
              )}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold text-slate-900 leading-tight">
                {language === 'hi' ? currentUser?.nameHi || currentUser?.name : currentUser?.name}
              </div>
              <div className="text-[10px] text-slate-500 font-medium leading-none">
                {currentUser?.role === 'admin' ? (
                  <span className="text-amber-700 font-semibold">Admin</span>
                ) : (
                  <span>{currentUser?.username}</span>
                )}
              </div>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 underline ml-0.5 sm:ml-1">
              {language === 'hi' ? 'बदलें' : 'Switch'}
            </span>
          </button>
        </div>

      </div>
    </header>
  );
};
