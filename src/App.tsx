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
import {
  Sparkles,
  BookOpen,
  FileCheck,
  CheckSquare,
  Camera,
  Shield,
  HelpCircle,
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => StorageService.getCurrentUser());
  const [language, setLanguage] = useState<Language>(() => StorageService.getLanguage());
  const [currentTab, setCurrentTab] = useState<'training' | 'sops' | 'tasks' | 'history' | 'admin'>('training');
  
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 pt-5 pb-20 md:pb-8">
        {currentTab === 'training' && (
          <TrainingSection
            guides={guides}
            language={language}
            currentUser={currentUser}
            onEditGuide={() => setCurrentTab('admin')}
            onRefreshData={refreshAllData}
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
