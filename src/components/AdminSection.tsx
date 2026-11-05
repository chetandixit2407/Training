import React, { useState, useRef } from 'react';
import { User, VisualGuide, DailyTask, RoomCategory, Language } from '../types';
import { StorageService, fileToDataUrl } from '../services/storageService';
import {
  Shield,
  UserPlus,
  Trash2,
  Edit3,
  Camera,
  Upload,
  PlusCircle,
  RotateCcw,
  CheckCircle2,
  Users,
  Image as ImageIcon,
  CheckSquare,
  Lock,
  Clock,
} from 'lucide-react';

interface AdminSectionProps {
  users: User[];
  guides: VisualGuide[];
  tasks: DailyTask[];
  currentUser: User | null;
  language: Language;
  onRefreshData: () => void;
  onSelectGuideForEdit?: (guide: VisualGuide) => void;
}

export const AdminSection: React.FC<AdminSectionProps> = ({
  users,
  guides,
  tasks,
  currentUser,
  language,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'guides' | 'users' | 'create_task'>('guides');

  // User form state
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPin, setNewUserPin] = useState('1234');
  const [newUserShift, setNewUserShift] = useState('Morning (8:30 AM - 5:30 PM)');
  const [userSuccessMsg, setUserSuccessMsg] = useState<string | null>(null);

  // Guide editor state
  const [selectedGuideId, setSelectedGuideId] = useState<string>(() => guides[0]?.id || '');
  const editingGuide = guides.find((g) => g.id === selectedGuideId) || guides[0];
  const [editTitleHi, setEditTitleHi] = useState(() => editingGuide?.titleHi || '');
  const [editTitleEn, setEditTitleEn] = useState(() => editingGuide?.titleEn || '');
  const [editFurnitureHi, setEditFurnitureHi] = useState(() => editingGuide?.furnitureDetailsHi || '');
  const [editFurnitureEn, setEditFurnitureEn] = useState(() => editingGuide?.furnitureDetailsEn || '');
  const [editPhotoUrl, setEditPhotoUrl] = useState(() => editingGuide?.photoUrl || '');
  const [editIncorrectPhotoUrl, setEditIncorrectPhotoUrl] = useState(() => editingGuide?.incorrectPhotoUrl || '');
  const [editVoiceHi, setEditVoiceHi] = useState(() => editingGuide?.voiceScriptHi || '');
  const [editVoiceEn, setEditVoiceEn] = useState(() => editingGuide?.voiceScriptEn || '');
  const [guideSuccessMsg, setGuideSuccessMsg] = useState<string | null>(null);

  // Task Creator state
  const [taskTitleHi, setTaskTitleHi] = useState('');
  const [taskTitleEn, setTaskTitleEn] = useState('');
  const [taskCategory, setTaskCategory] = useState<RoomCategory>('reception');
  const [taskRoomHi, setTaskRoomHi] = useState('RECEPTION AREA');
  const [taskRoomEn, setTaskRoomEn] = useState('RECEPTION AREA');
  const [taskTime, setTaskTime] = useState('11:00 AM');
  const [taskAssignedUser, setTaskAssignedUser] = useState<string>('pb-101');
  const [taskInstructionsHi, setTaskInstructionsHi] = useState('');
  const [taskInstructionsEn, setTaskInstructionsEn] = useState('');
  const [taskPhotoUrl, setTaskPhotoUrl] = useState('');
  const [taskSuccessMsg, setTaskSuccessMsg] = useState<string | null>(null);

  const guidePhotoInputRef = useRef<HTMLInputElement>(null);
  const guideIncorrectInputRef = useRef<HTMLInputElement>(null);
  const taskPhotoInputRef = useRef<HTMLInputElement>(null);

  // Sync guide editor fields when selected guide changes
  React.useEffect(() => {
    if (editingGuide) {
      setEditTitleHi(editingGuide.titleHi);
      setEditTitleEn(editingGuide.titleEn);
      setEditFurnitureHi(editingGuide.furnitureDetailsHi || '');
      setEditFurnitureEn(editingGuide.furnitureDetailsEn || '');
      setEditPhotoUrl(editingGuide.photoUrl);
      setEditIncorrectPhotoUrl(editingGuide.incorrectPhotoUrl || '');
      setEditVoiceHi(editingGuide.voiceScriptHi);
      setEditVoiceEn(editingGuide.voiceScriptEn);
      setGuideSuccessMsg(null);
    }
  }, [selectedGuideId, editingGuide]);

  // Handle Add User
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserUsername.trim() || !newUserPin.trim()) return;

    const newUser: User = {
      id: `pb-${Date.now()}`,
      name: newUserName.trim(),
      nameHi: newUserName.trim(),
      username: newUserUsername.trim().toUpperCase(),
      pin: newUserPin.trim(),
      role: 'pantry_boy',
      shift: newUserShift,
      shiftHi: newUserShift.includes('Morning') ? 'सुबह की शिफ्ट' : 'शाम की शिफ्ट',
      avatarColor: 'bg-teal-600',
    };

    StorageService.addUser(newUser);
    setNewUserName('');
    setNewUserUsername('');
    setNewUserPin('1234');
    setUserSuccessMsg(language === 'hi' ? 'नया पैंट्री बॉय सफलतापूर्वक जोड़ा गया!' : 'New pantry boy added successfully!');
    onRefreshData();
    setTimeout(() => setUserSuccessMsg(null), 3000);
  };

  const handleDeleteUser = (userId: string) => {
    if (window.confirm(language === 'hi' ? 'क्या आप इस उपयोगकर्ता को हटाना चाहते हैं?' : 'Are you sure you want to delete this user?')) {
      StorageService.deleteUser(userId);
      onRefreshData();
    }
  };

  // Handle Guide Save
  const handleSaveGuide = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGuide) return;

    const updated: VisualGuide = {
      ...editingGuide,
      titleHi: editTitleHi,
      titleEn: editTitleEn,
      furnitureDetailsHi: editFurnitureHi,
      furnitureDetailsEn: editFurnitureEn,
      photoUrl: editPhotoUrl,
      incorrectPhotoUrl: editIncorrectPhotoUrl || undefined,
      voiceScriptHi: editVoiceHi,
      voiceScriptEn: editVoiceEn,
      updatedAt: new Date().toISOString(),
    };

    StorageService.updateVisualGuide(updated);
    setGuideSuccessMsg(
      language === 'hi'
        ? 'गाइड और फोटो सफलतापूर्वक अपडेट कर दी गई हैं!'
        : 'Guide and photos updated successfully!'
    );
    onRefreshData();
    setTimeout(() => setGuideSuccessMsg(null), 3000);
  };

  const handleGuidePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, isIncorrect = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      if (isIncorrect) {
        setEditIncorrectPhotoUrl(dataUrl);
      } else {
        setEditPhotoUrl(dataUrl);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Task Create
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitleHi.trim() || !taskInstructionsHi.trim()) return;

    const chosenPhoto = taskPhotoUrl || editingGuide?.photoUrl || '/src/assets/images/office_pantry_setup_1793614167563.jpg';

    const newTask: DailyTask = {
      id: `task-${Date.now()}`,
      titleHi: taskTitleHi.trim(),
      titleEn: taskTitleEn.trim() || taskTitleHi.trim(),
      category: taskCategory,
      roomNameHi: taskRoomHi.trim(),
      roomNameEn: taskRoomEn.trim() || taskRoomHi.trim(),
      scheduledTime: taskTime,
      assignedToUserId: taskAssignedUser,
      referencePhotoUrl: chosenPhoto,
      instructionsHi: taskInstructionsHi.trim(),
      instructionsEn: taskInstructionsEn.trim() || taskInstructionsHi.trim(),
      audioTextHi: `${taskTitleHi}. ${taskInstructionsHi}`,
      audioTextEn: `${taskTitleEn}. ${taskInstructionsEn}`,
      status: 'pending',
    };

    StorageService.addTask(newTask);
    setTaskTitleHi('');
    setTaskTitleEn('');
    setTaskInstructionsHi('');
    setTaskInstructionsEn('');
    setTaskPhotoUrl('');
    setTaskSuccessMsg(language === 'hi' ? 'नया कार्य सफलतापूर्वक असाइन किया गया!' : 'Task created and assigned successfully!');
    onRefreshData();
    setTimeout(() => setTaskSuccessMsg(null), 3000);
  };

  const handleResetDefaults = () => {
    if (
      window.confirm(
        language === 'hi'
          ? 'क्या आप संपूर्ण ऐप का डेटा मूल डिफ़ॉल्ट पर रीसेट करना चाहते हैं? सभी टेस्ट फोटो रीसेट हो जाएंगे।'
          : 'Reset all application data back to default realistic office state?'
      )
    ) {
      StorageService.resetAllToDefault();
      onRefreshData();
    }
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Admin Header */}
      <div className="bg-slate-900 text-white p-5 sm:p-6 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wide mb-1">
            <Shield className="w-4 h-4" />
            <span>{language === 'hi' ? 'प्रशासनिक नियंत्रण कक्ष' : 'Administrative Management'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black">
            {language === 'hi' ? 'एडमिन कंट्रोल्स (Admin Panel)' : 'Admin Operations Control'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            {language === 'hi'
              ? 'वास्तविक ऑफिस फोटो अपलोड करें, प्रशिक्षण निर्देश बदलें, नए पैंट्री बॉय जोड़ें और कार्य असाइन करें।'
              : 'Upload actual office photos, customize training instructions, manage staff, and assign tasks.'}
          </p>
        </div>

        {/* Reset App Button */}
        <button
          onClick={handleResetDefaults}
          className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 text-amber-400" />
          <span>{language === 'hi' ? 'डिफ़ॉल्ट डेटा रीसेट करें' : 'Reset to Defaults'}</span>
        </button>
      </div>

      {/* Admin Subtabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-xl overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('guides')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[40px] ${
            activeTab === 'guides' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ImageIcon className="w-4 h-4 text-slate-950" />
          <span>{language === 'hi' ? 'फोटो व प्रशिक्षण संपादक' : 'Guides & Photos Editor'}</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[40px] ${
            activeTab === 'users' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4 text-blue-600" />
          <span>{language === 'hi' ? 'स्टाफ प्रबंधन (Users)' : 'Staff Management'}</span>
        </button>

        <button
          onClick={() => setActiveTab('create_task')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[40px] ${
            activeTab === 'create_task' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CheckSquare className="w-4 h-4 text-emerald-600" />
          <span>{language === 'hi' ? 'नया कार्य असाइन करें' : 'Create & Assign Task'}</span>
        </button>
      </div>

      {/* TAB 1: GUIDES & PHOTOS EDITOR */}
      {activeTab === 'guides' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-slate-950 text-base sm:text-lg">
                {language === 'hi' ? 'कमरा या सेक्शन चुनें' : 'Select Room or Section to Edit'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'hi'
                  ? 'असली ऑफिस के फोटो अपलोड करें और हिंदी निर्देश/ऑडियो आवाज अपडेट करें'
                  : 'Upload real office photographs and customize voice text'}
              </p>
            </div>

            <select
              value={selectedGuideId}
              onChange={(e) => setSelectedGuideId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              {guides.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.titleHi} ({g.titleEn})
                </option>
              ))}
            </select>
          </div>

          {guideSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{guideSuccessMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveGuide} className="space-y-5">
            {/* Titles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'hi' ? 'शीर्षक (हिंदी)' : 'Title (Hindi)'}
                </label>
                <input
                  type="text"
                  value={editTitleHi}
                  onChange={(e) => setEditTitleHi(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'hi' ? 'शीर्षक (English)' : 'Title (English)'}
                </label>
                <input
                  type="text"
                  value={editTitleEn}
                  onChange={(e) => setEditTitleEn(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Furniture Details Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'hi' ? 'फर्नीचर विवरण (हिंदी, उदा. 4 कुर्सियां, 1 टेबल)' : 'Furniture Details (Hindi)'}
                </label>
                <input
                  type="text"
                  value={editFurnitureHi}
                  onChange={(e) => setEditFurnitureHi(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'hi' ? 'फर्नीचर विवरण (English, e.g. 4 chairs, 1 table)' : 'Furniture Details (English)'}
                </label>
                <input
                  type="text"
                  value={editFurnitureEn}
                  onChange={(e) => setEditFurnitureEn(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Photo Uploaders (Correct vs Incorrect) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              
              {/* Correct Target Photo */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                  <span>{language === 'hi' ? '1. सही मानक फोटो (Correct Target Photo)' : '1. Correct Target Photo'}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => guidePhotoInputRef.current?.click()}
                      className="text-xs text-amber-700 hover:underline font-bold"
                    >
                      {editPhotoUrl ? (language === 'hi' ? 'फोटो बदलें' : 'Replace Photo') : (language === 'hi' ? 'अपलोड करें' : 'Upload')}
                    </button>
                    {editPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(language === 'hi' ? 'क्या आप इस फोटो को हटाना चाहते हैं?' : 'Delete this photo?')) {
                            setEditPhotoUrl('');
                          }
                        }}
                        className="text-xs text-rose-600 hover:underline font-bold"
                      >
                        {language === 'hi' ? 'हटाएं' : 'Delete'}
                      </button>
                    )}
                  </div>
                </div>

                <input
                  ref={guidePhotoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleGuidePhotoUpload(e, false)}
                />

                <div
                  className="aspect-16/10 rounded-xl overflow-hidden border-2 border-emerald-500 bg-slate-100 relative cursor-pointer group"
                  onClick={() => guidePhotoInputRef.current?.click()}
                >
                  {editPhotoUrl ? (
                    <img
                      src={editPhotoUrl}
                      alt="Target reference"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-101 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                      <Camera className="w-8 h-8 mb-1" />
                      <span className="text-xs font-bold">{language === 'hi' ? 'मानक फोटो अपलोड करें' : 'Upload target photo'}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                    <Camera className="w-4 h-4" />
                    <span>{language === 'hi' ? 'नया फोटो अपलोड करें' : 'Upload New Photo'}</span>
                  </div>
                </div>
              </div>

              {/* Incorrect Mistakes Photo */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-rose-800 flex items-center justify-between">
                  <span>{language === 'hi' ? '2. गलत उदाहरण फोटो (Avoid / Mistakes Photo)' : '2. Mistake / Avoid Photo'}</span>
                  <button
                    type="button"
                    onClick={() => guideIncorrectInputRef.current?.click()}
                    className="text-xs text-amber-700 hover:underline font-bold"
                  >
                    {language === 'hi' ? 'फोटो बदलें' : 'Change Photo'}
                  </button>
                </label>

                <input
                  ref={guideIncorrectInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleGuidePhotoUpload(e, true)}
                />

                <div
                  className="aspect-16/10 rounded-xl overflow-hidden border-2 border-rose-500 bg-slate-100 relative cursor-pointer group"
                  onClick={() => guideIncorrectInputRef.current?.click()}
                >
                  {editIncorrectPhotoUrl ? (
                    <img
                      src={editIncorrectPhotoUrl}
                      alt="Mistake reference"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-101 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                      <Camera className="w-8 h-8 mb-1" />
                      <span className="text-xs font-bold">{language === 'hi' ? 'गलत उदाहरण फोटो जोड़ें' : 'Add mistake example photo'}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                    <Camera className="w-4 h-4" />
                    <span>{language === 'hi' ? 'फोटो अपलोड करें' : 'Upload Photo'}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Voice Script Hindi */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'hi'
                  ? 'ऑडियो आवाज स्क्रिप्ट (हिंदी - स्पीकर बटन दबाने पर यह बोला जाएगा)'
                  : 'Voice Audio Script (Hindi)'}
              </label>
              <textarea
                rows={3}
                value={editVoiceHi}
                onChange={(e) => setEditVoiceHi(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            {/* Voice Script English */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'hi'
                  ? 'ऑडियो आवाज स्क्रिप्ट (English Voice Script)'
                  : 'Voice Audio Script (English)'}
              </label>
              <textarea
                rows={2}
                value={editVoiceEn}
                onChange={(e) => setEditVoiceEn(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm min-h-[44px]"
            >
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>{language === 'hi' ? 'गाइड और फोटो सहेजें (Save Changes)' : 'Save Guide Changes'}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: STAFF USERS MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-6">
          <div>
            <h3 className="font-extrabold text-slate-950 text-base sm:text-lg">
              {language === 'hi' ? 'कर्मचारी और पैंट्री बॉय सूची' : 'Pantry Staff & Admin Accounts'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'hi'
                ? 'प्रत्येक पैंट्री बॉय का अपना अलग आईडी और पिन होता है।'
                : 'Each pantry boy has an individual ID and PIN to track their proofs.'}
            </p>
          </div>

          {userSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{userSuccessMsg}</span>
            </div>
          )}

          {/* Users Table / Cards */}
          <div className="space-y-2">
            {users.map((u) => {
              const isAdmin = u.role === 'admin';
              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                      isAdmin ? 'bg-amber-600' : 'bg-emerald-600'
                    }`}>
                      {isAdmin ? <Shield className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="font-extrabold text-slate-900 text-sm">
                        {u.name} ({u.nameHi})
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-700">ID: {u.username}</span>
                        <span>•</span>
                        <span className="font-mono">PIN: {u.pin}</span>
                        <span>•</span>
                        <span>{u.shift}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {!isAdmin ? (
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                        Admin
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add User Form */}
          <div className="pt-4 border-t border-slate-100">
            <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-600" />
              <span>{language === 'hi' ? 'नया पैंट्री बॉय जोड़ें' : 'Add New Pantry Boy'}</span>
            </h4>

            <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {language === 'hi' ? 'नाम (Name)' : 'Full Name'}
                </label>
                <input
                  type="text"
                  placeholder="उदा. Amit Verma"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {language === 'hi' ? 'यूजर आईडी (ID)' : 'User ID'}
                </label>
                <input
                  type="text"
                  placeholder="उदा. PB103"
                  value={newUserUsername}
                  onChange={(e) => setNewUserUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-1 focus:ring-amber-500 focus:outline-none uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {language === 'hi' ? 'पिन (PIN)' : 'PIN (4 digits)'}
                </label>
                <input
                  type="text"
                  placeholder="1234"
                  value={newUserPin}
                  onChange={(e) => setNewUserPin(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs min-h-[38px]"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{language === 'hi' ? 'जोड़ें (Add)' : 'Add User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: CREATE & ASSIGN TASK */}
      {activeTab === 'create_task' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-6">
          <div>
            <h3 className="font-extrabold text-slate-950 text-base sm:text-lg">
              {language === 'hi' ? 'नया दैनिक कार्य बनाएं और असाइन करें' : 'Create & Assign Daily Task'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'hi'
                ? 'समय निर्धारित करें, निर्देश दें और संदर्भ फोटो जोड़ें।'
                : 'Set schedule, detailed instructions, and attach reference photos.'}
            </p>
          </div>

          {taskSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{taskSuccessMsg}</span>
            </div>
          )}

          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'hi' ? 'कार्य शीर्षक (हिंदी) *' : 'Task Title (Hindi) *'}
                </label>
                <input
                  type="text"
                  placeholder="उदा. दोपहर 1:30: पैंट्री सिंक व काउंटर सफाई"
                  value={taskTitleHi}
                  onChange={(e) => setTaskTitleHi(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'hi' ? 'कार्य शीर्षक (English)' : 'Task Title (English)'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Afternoon 1:30: Pantry Sink & Counter Sanitization"
                  value={taskTitleEn}
                  onChange={(e) => setTaskTitleEn(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'hi' ? 'कमरा चुनें (Select Room)' : 'Select Room'}
                </label>
                <select
                  value={taskRoomHi}
                  onChange={(e) => {
                    const selected = guides.find((g) => g.titleHi === e.target.value);
                    if (selected) {
                      setTaskRoomHi(selected.titleHi);
                      setTaskRoomEn(selected.titleEn);
                      setTaskCategory(selected.category);
                      setTaskPhotoUrl(selected.photoUrl);
                    } else {
                      setTaskRoomHi(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:ring-1 focus:ring-amber-500 focus:outline-none bg-slate-50 cursor-pointer"
                >
                  {guides.map((g) => (
                    <option key={g.id} value={g.titleHi}>
                      {g.titleHi} ({g.furnitureDetailsEn})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'hi' ? 'समय (Scheduled Time)' : 'Scheduled Time'}
                </label>
                <input
                  type="text"
                  value={taskTime}
                  onChange={(e) => setTaskTime(e.target.value)}
                  placeholder="उदा. 11:30 AM"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'hi' ? 'किसे सौंपें (Assign To)' : 'Assign To'}
                </label>
                <select
                  value={taskAssignedUser}
                  onChange={(e) => setTaskAssignedUser(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:ring-1 focus:ring-amber-500 focus:outline-none bg-slate-50 cursor-pointer"
                >
                  <option value="ALL">{language === 'hi' ? 'सभी पैंट्री स्टाफ (All Staff)' : 'All Staff'}</option>
                  {users
                    .filter((u) => u.role !== 'admin')
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.username})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'hi' ? 'विस्तृत निर्देश (हिंदी) *' : 'Instructions (Hindi) *'}
              </label>
              <textarea
                rows={3}
                placeholder="उदा. सभी कप धोएं, काउंटर सूखा करें, ड्रिप ट्रे खाली करें और फोटो खींचकर अपलोड करें।"
                value={taskInstructionsHi}
                onChange={(e) => setTaskInstructionsHi(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm min-h-[44px]"
            >
              <CheckSquare className="w-4 h-4 text-emerald-400" />
              <span>{language === 'hi' ? 'कार्य बनाएं व असाइन करें (Assign Task)' : 'Assign Daily Task'}</span>
            </button>
          </form>
        </div>
      )}

    </div>
  );
};
