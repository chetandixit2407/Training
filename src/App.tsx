import React, { useState, useEffect } from 'react';
import { User, VisualGuide, SOP, DailyTask, Language } from './types';
import { StorageService } from './services/storageService';
import { Header } from './components/Header';
import { MobileBottomNav } from './components/MobileBottomNav';
import { LoginModal } from './components/LoginModal';
import { TrainingSection } from './components/TrainingSection';
import { SOPsSection } from './components/SOPsSection';
import { TasksSection } from './components/TasksSection';
import { HistorySection } from './components/HistorySection';
import { AdminSection } from './components/AdminSection';
import { AIAssistantSection } from './components/AIAssistantSection';
import {
  Sparkles,
  BookOpen,
  FileCheck,
  CheckSquare,
  Camera,
  Shield,
  HelpCircle,
  Bot,
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => StorageService.getCurrentUser());
  const [language, setLanguage] = useState<Language>(() => StorageService.getLanguage());
  const [currentTab, setCurrentTab] = useState<'training' | 'assistant' | 'sops' | 'tasks' | 'history' | 'admin'>('training');
  
  const [users, setUsers] = useState<User[]>(() => StorageService.getUsers());
  const [guides, setGuides] = useState<VisualGuide[]>(() => StorageService.getVisualGuides());
  const [sops, setSops] = useState<SOP[]>(() => StorageService.getSOPs());
  const [tasks, setTasks] = useState<DailyTask[]>(() => StorageService.getTasks());

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Sync data on changes
  const refreshAllData = () => {
    setUsers(StorageService.getUsers());
    setGuides(StorageService.getVisualGuides());
    setSops(StorageService.getSOPs());
    setTasks(StorageService.getTasks());
    setCurrentUser(StorageService.getCurrentUser());
  };

  // Real-time synchronization listener
  useEffect(() => {
    StorageService.init().then(() => {
      refreshAllData();
    });
    const unsubscribe = StorageService.subscribe(() => {
      refreshAllData();
    });
    return () => unsubscribe();
  }, []);

  const handleToggleLanguage = () => {
    const nextLang = language === 'hi' ? 'en' : 'hi';
    setLanguage(nextLang);
    StorageService.setLanguage(nextLang);
  };

  const handleSelectUser = (user: User) => {
    setCurrentUser(user);
    StorageService.setCurrentUser(user);
    // If selecting admin and currently on a restricted tab, go to admin or training
    if (user.role === 'admin') {
      // Allow full access
    }
  };

  const handleUpdateTask = (updatedTask: DailyTask) => {
    StorageService.updateTask(updatedTask);
    setTasks(StorageService.getTasks());
  };

  const pendingTasksCount = tasks.filter((t) => {
    if (t.status === 'completed') return false;
    if (currentUser && currentUser.role !== 'admin' && t.assignedToUserId !== 'ALL' && t.assignedToUserId !== currentUser.id) {
      return false;
    }
    return true;
  }).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans selection:bg-amber-100 selection:text-amber-900">
      
      {/* Top Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        currentUser={currentUser}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        language={language}
        onToggleLanguage={handleToggleLanguage}
        pendingTasksCount={pendingTasksCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 pt-5">
        {currentTab === 'training' && (
          <TrainingSection
            guides={guides}
            language={language}
            currentUser={currentUser}
            onEditGuide={() => setCurrentTab('admin')}
            onRefreshData={refreshAllData}
          />
        )}

        {currentTab === 'assistant' && (
          <AIAssistantSection
            currentUser={currentUser}
            language={language}
          />
        )}

        {currentTab === 'sops' && (
          <SOPsSection
            sops={sops}
            language={language}
          />
        )}

        {currentTab === 'tasks' && (
          <TasksSection
            tasks={tasks}
            currentUser={currentUser}
            language={language}
            onUpdateTask={handleUpdateTask}
            onOpenCreateTask={() => setCurrentTab('admin')}
          />
        )}

        {currentTab === 'history' && (
          <HistorySection
            tasks={tasks}
            currentUser={currentUser}
            language={language}
            onUpdateTask={handleUpdateTask}
          />
        )}

        {currentTab === 'admin' && (
          <AdminSection
            users={users}
            guides={guides}
            tasks={tasks}
            currentUser={currentUser}
            language={language}
            onRefreshData={refreshAllData}
          />
        )}
      </main>

      {/* Floating AI Coach Button (Visible when not on Assistant tab) */}
      {currentTab !== 'assistant' && (
        <button
          onClick={() => setCurrentTab('assistant')}
          className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-30 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-extrabold px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2 cursor-pointer border-2 border-white group animate-bounce-subtle"
          title="Open AI Trainer Bhaiya"
        >
          <div className="w-7 h-7 rounded-full bg-slate-950 text-white flex items-center justify-center">
            <Bot className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <span className="text-xs sm:text-sm font-black whitespace-nowrap">
            {language === 'hi' ? 'AI ट्रेनर भैया से पूछें' : 'Ask AI Trainer'}
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        </button>
      )}

      {/* Mobile Bottom Navigation Bar (Smartphones & Tablets) */}
      <MobileBottomNav
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        language={language}
        pendingTasksCount={pendingTasksCount}
      />

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        currentUser={currentUser}
        onSelectUser={handleSelectUser}
        language={language}
      />

    </div>
  );
}
