import React from 'react';
import { BookOpen, FileCheck, CheckSquare, Camera, Shield } from 'lucide-react';
import { Language } from '../types';

interface MobileBottomNavProps {
  currentTab: 'training' | 'sops' | 'tasks' | 'history' | 'admin';
  setCurrentTab: (tab: 'training' | 'sops' | 'tasks' | 'history' | 'admin') => void;
  language: Language;
  pendingTasksCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  setCurrentTab,
  language,
  pendingTasksCount,
}) => {
  const tabs = [
    {
      id: 'training' as const,
      labelHi: 'गाइड्स',
      labelEn: 'Guides',
      icon: BookOpen,
      badge: null,
    },
    {
      id: 'sops' as const,
      labelHi: 'SOPs',
      labelEn: 'SOPs',
      icon: FileCheck,
      badge: null,
    },
    {
      id: 'tasks' as const,
      labelHi: 'कार्य',
      labelEn: 'Tasks',
      icon: CheckSquare,
      badge: pendingTasksCount > 0 ? pendingTasksCount : null,
    },
    {
      id: 'history' as const,
      labelHi: 'प्रूफ',
      labelEn: 'Proofs',
      icon: Camera,
      badge: null,
    },
    {
      id: 'admin' as const,
      labelHi: 'एडमिन',
      labelEn: 'Admin',
      icon: Shield,
      badge: null,
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg safe-bottom">
      <div className="grid grid-cols-5 items-center h-16 max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`flex flex-col items-center justify-center h-full relative cursor-pointer min-h-[44px] transition-colors ${
                isActive ? 'text-amber-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.5]' : 'stroke-2'}`} />
                {tab.badge !== null && (
                  <span className="absolute -top-1.5 -right-2.5 px-1 py-0.2 bg-amber-500 text-white text-[10px] font-extrabold rounded-full leading-none">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] font-bold mt-1 tracking-tight ${
                isActive ? 'text-amber-700' : 'text-slate-600'
              }`}>
                {language === 'hi' ? tab.labelHi : tab.labelEn}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-6 h-1 bg-amber-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
