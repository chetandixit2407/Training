import React, { useState, useRef } from 'react';
import { VisualGuide, Language, User } from '../types';
import { VoiceButton } from './VoiceButton';
import { StorageService, fileToDataUrl } from '../services/storageService';
import { TaskCompleteModal } from './TaskCompleteModal';
import {
  CheckCircle2,
  XCircle,
  Maximize2,
  Sparkles,
  Info,
  ChevronRight,
  Eye,
  ShieldCheck,
  Zap,
  Coffee,
  Armchair,
  Briefcase,
  Users,
  Laptop,
  Camera,
  Upload,
  Trash2,
  RefreshCw,
  LayoutGrid,
  Check,
  Clock,
  Layers,
} from 'lucide-react';

interface TrainingSectionProps {
  guides: VisualGuide[];
  language: Language;
  currentUser: User | null;
  onEditGuide?: (guide: VisualGuide) => void;
  onRefreshData?: () => void;
}

export const TrainingSection: React.FC<TrainingSectionProps> = ({
  guides,
  language,
  currentUser,
  onEditGuide,
  onRefreshData,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'detailed'>('grid');
  const [selectedGuideId, setSelectedGuideId] = useState<string>(guides[0]?.id || '');
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const [inspectMode, setInspectMode] = useState<'correct' | 'incorrect' | 'sideBySide'>('correct');
  const [uploadingForGuideId, setUploadingForGuideId] = useState<string | null>(null);
  const [quickSuccessMsg, setQuickSuccessMsg] = useState<{ id: string; text: string } | null>(null);

  // For Pantry Boy direct room proof upload
  const [proofRoomModal, setProofRoomModal] = useState<VisualGuide | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeGuideRef = useRef<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  // Selected guide for detailed view
  const currentDetailedGuide = guides.find((g) => g.id === selectedGuideId) || guides[0];

  // Trigger file upload for a specific room
  const handleTriggerUpload = (guideId: string) => {
    activeGuideRef.current = guideId;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Handle file selected
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetGuideId = activeGuideRef.current;
    if (!file || !targetGuideId) return;

    try {
      setUploadingForGuideId(targetGuideId);
      const dataUrl = await fileToDataUrl(file);
      StorageService.updateRoomReferencePhoto(targetGuideId, dataUrl, currentUser?.name || 'Admin');
      
      const targetGuide = guides.find((g) => g.id === targetGuideId);
      const roomName = targetGuide ? (language === 'hi' ? targetGuide.titleHi : targetGuide.titleEn) : '';
      
      setQuickSuccessMsg({
        id: targetGuideId,
        text: language === 'hi' ? `${roomName} का फोटो तुरंत अपडेट हो गया!` : `${roomName} photo updated!`,
      });
      setTimeout(() => setQuickSuccessMsg(null), 3000);
      onRefreshData?.();
    } catch (err) {
      console.error(err);
      alert(language === 'hi' ? 'फोटो लोड करने में त्रुटि हुई' : 'Error loading photo');
    } finally {
      setUploadingForGuideId(null);
    }
  };

  // Delete photo for a room
  const handleDeletePhoto = (guide: VisualGuide) => {
    const confirmMsg =
      language === 'hi'
        ? `क्या आप ${guide.titleHi} का संदर्भ फोटो हटाना चाहते हैं?`
        : `Are you sure you want to delete the reference photo for ${guide.titleEn}?`;

    if (window.confirm(confirmMsg)) {
      StorageService.deleteRoomReferencePhoto(guide.id);
      setQuickSuccessMsg({
        id: guide.id,
        text: language === 'hi' ? 'फोटो हटा दिया गया है' : 'Photo deleted',
      });
      setTimeout(() => setQuickSuccessMsg(null), 3000);
      onRefreshData?.();
    }
  };

  // Handle submission of pantry boy proof for a room
  const handleRoomProofSubmit = (
    taskId: string,
    proofPhotoUrl: string,
    beforePhotoUrl?: string,
    notes?: string
  ) => {
    const guide = guides.find((g) => g.id === taskId);
    if (!guide) return;

    // Save as a completed task in Tasks and History
    const newTask = {
      id: `task-room-${Date.now()}`,
      titleHi: `${guide.titleHi} - सफाई व व्यवस्था सत्यापन`,
      titleEn: `${guide.titleEn} - Inspection & Sanitization`,
      category: guide.category,
      roomNameHi: guide.titleHi,
      roomNameEn: guide.titleEn,
      scheduledTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      assignedToUserId: currentUser?.id || 'pb-101',
      referencePhotoUrl: guide.photoUrl,
      instructionsHi: guide.furnitureDetailsHi,
      instructionsEn: guide.furnitureDetailsEn,
      audioTextHi: guide.voiceScriptHi,
      audioTextEn: guide.voiceScriptEn,
      status: 'completed' as const,
      completedByUserId: currentUser?.id || 'pb-101',
      completedByName: currentUser ? (language === 'hi' ? currentUser.nameHi : currentUser.name) : 'Ramesh Kumar',
      completedAt: new Date().toISOString(),
      proofPhotoUrl,
      beforePhotoUrl,
      boyNotes: notes,
      adminStatus: 'pending_review' as const,
    };

    StorageService.addTask(newTask);
    setProofRoomModal(null);
    alert(
      language === 'hi'
        ? 'प्रमाण फोटो सफलतापूर्वक अपलोड हो गया और इतिहास में सुरक्षित हो गया!'
        : 'Proof photo uploaded and logged in History!'
    );
    onRefreshData?.();
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Hidden file input for camera/photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Top Banner with View Switcher */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">
            <Layers className="w-4 h-4" />
            <span>{language === 'hi' ? 'कार्यालय कमरे व व्यवस्था' : 'Office Rooms & Operations'}</span>
            <span>•</span>
            <span>{guides.length} {language === 'hi' ? 'कमरे' : 'Rooms'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-950">
            {language === 'hi' ? 'रूम डैशबोर्ड और संदर्भ फोटो' : 'Rooms Dashboard & Reference Photos'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
            {language === 'hi'
              ? 'प्रत्येक कमरे के फर्नीचर विवरण, वास्तविक संदर्भ फोटो देखें। एडमिन कभी भी फोटो अपलोड, बदल या हटा सकते हैं।'
              : 'Inspect furniture details and official reference photos for each room. Admin can upload, replace or delete photos anytime in real time.'}
          </p>
        </div>

        {/* View Mode Toggle: All Dashboard Cards vs Detailed Room View */}
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[40px] ${
                viewMode === 'grid'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>{language === 'hi' ? 'सभी 10 कमरे' : 'All 10 Rooms'}</span>
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[40px] ${
                viewMode === 'detailed'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>{language === 'hi' ? 'विस्तृत गाइड' : 'Detailed View'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: DASHBOARD GRID OF ALL 10 ROOMS */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {guides.map((guide, index) => {
            const hasPhoto = Boolean(guide.photoUrl && guide.photoUrl.trim());
            const isUploadingThis = uploadingForGuideId === guide.id;

            return (
              <div
                key={guide.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 transition-all shadow-xs overflow-hidden flex flex-col justify-between"
              >
                <div>
                  
                  {/* Card Header: Room Name & Furniture Badge */}
                  <div className="p-4 sm:p-5 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-6 h-6 rounded-md bg-slate-900 text-amber-400 font-black text-xs flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            OFFICE ROOM
                          </span>
                        </div>
                        <h3 className="text-base sm:text-lg font-black text-slate-950 tracking-tight">
                          {language === 'hi' ? guide.titleHi : guide.titleEn}
                        </h3>
                      </div>

                      {/* Voice Button */}
                      <VoiceButton
                        text={
                          language === 'hi'
                            ? guide.voiceScriptHi
                            : `${guide.titleEn}. ${guide.furnitureDetailsEn}. ${guide.voiceScriptEn}`
                        }
                        lang={language}
                        textId={`voice-room-${guide.id}`}
                        size="sm"
                        label={language === 'hi' ? 'ऑडियो' : 'Audio'}
                      />
                    </div>

                    {/* Furniture Details Badge (Bold, High Contrast, Prominent) */}
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200/90 rounded-xl text-amber-950 text-xs font-bold">
                      <span className="text-amber-700">🛋️ {language === 'hi' ? 'फर्नीचर:' : 'Furniture:'}</span>
                      <span className="font-extrabold text-slate-900">
                        {language === 'hi' ? guide.furnitureDetailsHi : guide.furnitureDetailsEn}
                      </span>
                    </div>
                  </div>

                  {/* Reference Photo Container */}
                  <div className="relative aspect-16/10 bg-slate-100 overflow-hidden group">
                    {hasPhoto ? (
                      <>
                        <img
                          src={guide.photoUrl}
                          alt={guide.titleEn}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-101 transition-transform duration-300"
                        />
                        <button
                          onClick={() => setZoomPhoto(guide.photoUrl)}
                          className="absolute top-2.5 right-2.5 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs transition-colors cursor-pointer"
                          title="Fullscreen Zoom"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-xs text-white text-[11px] font-bold">
                          {language === 'hi' ? 'आधिकारिक संदर्भ फोटो' : 'Official Reference Photo'}
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                        <Camera className="w-10 h-10 mb-2 text-slate-300" />
                        <span className="text-xs font-bold text-slate-600 block">
                          {language === 'hi' ? 'कोई फोटो उपलब्ध नहीं है' : 'No Reference Photo'}
                        </span>
                        <span className="text-[11px] text-slate-400 mt-0.5">
                          {isAdmin
                            ? language === 'hi'
                              ? 'नीचे दिए गए बटन से नया फोटो अपलोड करें'
                              : 'Click upload below to set official photo'
                            : language === 'hi'
                            ? 'एडमिन द्वारा फोटो अपलोड किया जाएगा'
                            : 'Admin will upload reference photo'}
                        </span>
                      </div>
                    )}

                    {/* Upload spinner overlay */}
                    {isUploadingThis && (
                      <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center text-white text-xs font-bold gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                        <span>{language === 'hi' ? 'अपलोड हो रहा है...' : 'Uploading in real-time...'}</span>
                      </div>
                    )}
                  </div>

                  {/* Quick success toast */}
                  {quickSuccessMsg?.id === guide.id && (
                    <div className="bg-emerald-600 text-white text-xs font-bold px-3 py-2 flex items-center gap-1.5 animate-in fade-in">
                      <Check className="w-4 h-4" />
                      <span>{quickSuccessMsg.text}</span>
                    </div>
                  )}

                  {/* Instructions Summary */}
                  <div className="p-4 bg-slate-50 border-t border-slate-100">
                    <p className="text-xs text-slate-700 leading-relaxed font-medium line-clamp-2">
                      {language === 'hi' ? guide.subtitleHi : guide.subtitleEn}
                    </p>
                  </div>

                </div>

                {/* Card Actions Footer: Admin vs Pantry Boy */}
                <div className="p-4 bg-white border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  
                  {/* ADMIN CONTROLS: Upload / Replace / Delete Photo */}
                  {isAdmin ? (
                    <div className="flex items-center gap-2 w-full">
                      <button
                        onClick={() => handleTriggerUpload(guide.id)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[42px] shadow-xs"
                      >
                        <Camera className="w-4 h-4" />
                        <span>
                          {hasPhoto
                            ? language === 'hi'
                              ? 'फोटो बदलें (Replace)'
                              : 'Replace Photo'
                            : language === 'hi'
                            ? 'फोटो अपलोड करें (Upload)'
                            : 'Upload Photo'}
                        </span>
                      </button>

                      {hasPhoto && (
                        <button
                          onClick={() => handleDeletePhoto(guide)}
                          className="py-2.5 px-3 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-700 font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer min-h-[42px]"
                          title="Delete reference photo"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="hidden sm:inline">{language === 'hi' ? 'हटाएं' : 'Delete'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setSelectedGuideId(guide.id);
                          setViewMode('detailed');
                        }}
                        className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center transition-colors cursor-pointer min-h-[42px]"
                        title="View inspection details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    /* PANTRY BOY CONTROLS: Upload Task Proof Photo */
                    <div className="flex items-center gap-2 w-full">
                      <button
                        onClick={() => setProofRoomModal(guide)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[42px] shadow-xs"
                      >
                        <Camera className="w-4 h-4" />
                        <span>{language === 'hi' ? 'सफाई का फोटो अपलोड करें' : 'Upload Proof Photo'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedGuideId(guide.id);
                          setViewMode('detailed');
                        }}
                        className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer min-h-[42px]"
                      >
                        <span>{language === 'hi' ? 'नियम देखें' : 'View Rules'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: DETAILED ROOM INSPECTION VIEW */}
      {viewMode === 'detailed' && currentDetailedGuide && (
        <div className="space-y-6">
          
          {/* Room Selector Pills */}
          <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {guides.map((g) => {
                const isSelected = currentDetailedGuide.id === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => {
                      setSelectedGuideId(g.id);
                      setInspectMode('correct');
                    }}
                    className={`px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 transition-all cursor-pointer min-h-[44px] ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <span>{language === 'hi' ? g.titleHi : g.titleEn}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Room Header Card */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">
                <span>{language === 'hi' ? 'विस्तृत प्रशिक्षण गाइड' : 'Detailed Room Standard'}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-950">
                {language === 'hi' ? currentDetailedGuide.titleHi : currentDetailedGuide.titleEn}
              </h2>
              
              {/* Furniture Pill */}
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg text-xs font-bold text-amber-950">
                <span>🛋️ {language === 'hi' ? 'फर्नीचर संख्या:' : 'Furniture Count:'}</span>
                <span className="font-extrabold text-slate-900">
                  {language === 'hi' ? currentDetailedGuide.furnitureDetailsHi : currentDetailedGuide.furnitureDetailsEn}
                </span>
              </div>
            </div>

            {/* Actions: Voice & Photo Upload */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <VoiceButton
                text={
                  language === 'hi'
                    ? currentDetailedGuide.voiceScriptHi
                    : `${currentDetailedGuide.titleEn}. ${currentDetailedGuide.furnitureDetailsEn}. ${currentDetailedGuide.voiceScriptEn}`
                }
                lang={language}
                textId={`detailed-audio-${currentDetailedGuide.id}`}
                label={language === 'hi' ? 'पूरा प्रशिक्षण सुनें' : 'Listen Full Guide'}
                size="md"
              />

              {isAdmin && (
                <button
                  onClick={() => handleTriggerUpload(currentDetailedGuide.id)}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-colors cursor-pointer min-h-[44px] flex items-center gap-1.5"
                >
                  <Camera className="w-4 h-4" />
                  <span>{language === 'hi' ? 'नया फोटो अपलोड करें' : 'Upload New Photo'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Photo Presentation with Correct vs Incorrect */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-4 py-2.5 bg-emerald-700 text-white text-xs font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>
                  {language === 'hi' ? 'आधिकारिक संदर्भ फोटो (Official Standard)' : 'Official Reference Standard'}
                </span>
              </div>
              {currentDetailedGuide.photoUrl && (
                <button
                  onClick={() => setZoomPhoto(currentDetailedGuide.photoUrl)}
                  className="text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-md cursor-pointer transition-colors"
                >
                  {language === 'hi' ? 'बड़ा देखें' : 'Fullscreen'}
                </button>
              )}
            </div>

            <div className="relative aspect-16/9 bg-slate-100 overflow-hidden">
              {currentDetailedGuide.photoUrl ? (
                <img
                  src={currentDetailedGuide.photoUrl}
                  alt={currentDetailedGuide.titleEn}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                  <Camera className="w-12 h-12 mb-2 text-slate-300" />
                  <span className="font-bold text-sm text-slate-600">
                    {language === 'hi' ? 'कोई फोटो उपलब्ध नहीं है' : 'No Photo Available'}
                  </span>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200">
              <p className="text-sm font-semibold text-slate-800">
                {language === 'hi' ? currentDetailedGuide.photoCaptionHi : currentDetailedGuide.photoCaptionEn}
              </p>
            </div>
          </div>

          {/* 4 Architectural Inspection Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Pillar 1: Furniture & Seating */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {language === 'hi' ? 'फर्नीचर और कुर्सी की स्थिति' : 'Furniture & Chair Alignment'}
                  </h3>
                </div>
              </div>
              <ul className="space-y-2.5">
                {(language === 'hi' ? currentDetailedGuide.furniturePlacementHi : currentDetailedGuide.furniturePlacementEn).map(
                  (item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 leading-snug">
                      <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  )
                )}
              </ul>
            </div>

            {/* Pillar 2: Water & items */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {language === 'hi' ? 'पानी की बोतल व गिलास की जगह' : 'Water, Coaster & Glass Placement'}
                  </h3>
                </div>
              </div>
              <ul className="space-y-2.5">
                {(language === 'hi' ? currentDetailedGuide.waterAndItemsHi : currentDetailedGuide.waterAndItemsEn).map(
                  (item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 leading-snug">
                      <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  )
                )}
              </ul>
            </div>

            {/* Pillar 3: Cleaning standard */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {language === 'hi' ? 'सफाई और स्वच्छता मानक' : 'Cleaning & Hygiene Standards'}
                  </h3>
                </div>
              </div>
              <ul className="space-y-2.5">
                {(language === 'hi' ? currentDetailedGuide.cleaningStandardHi : currentDetailedGuide.cleaningStandardEn).map(
                  (item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 leading-snug">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  )
                )}
              </ul>
            </div>

            {/* Pillar 4: Lights & switches */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs">
                    4
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {language === 'hi' ? 'लाइट्स, स्विच और एसी नियम' : 'Lights, AC & Switchboard Rules'}
                  </h3>
                </div>
              </div>
              <ul className="space-y-2.5">
                {(language === 'hi' ? currentDetailedGuide.lightsAndSwitchesHi : currentDetailedGuide.lightsAndSwitchesEn).map(
                  (item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 leading-snug">
                      <span className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  )
                )}
              </ul>
            </div>

          </div>

          <div className="text-center pt-2">
            <button
              onClick={() => setViewMode('grid')}
              className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              {language === 'hi' ? '← सभी 10 कमरों का डैशबोर्ड देखें' : '← Back to All 10 Rooms Dashboard'}
            </button>
          </div>

        </div>
      )}

      {/* Pantry Boy Room Completion Modal */}
      {proofRoomModal && (
        <TaskCompleteModal
          task={{
            id: proofRoomModal.id,
            titleHi: `${proofRoomModal.titleHi} - कार्य संपन्न सत्यापन`,
            titleEn: `${proofRoomModal.titleEn} - Completion Proof`,
            category: proofRoomModal.category,
            roomNameHi: proofRoomModal.titleHi,
            roomNameEn: proofRoomModal.titleEn,
            scheduledTime: 'दैनिक (Daily)',
            assignedToUserId: currentUser?.id || 'pb-101',
            referencePhotoUrl: proofRoomModal.photoUrl,
            instructionsHi: `फर्नीचर: ${proofRoomModal.furnitureDetailsHi}. ${proofRoomModal.subtitleHi}`,
            instructionsEn: `Furniture: ${proofRoomModal.furnitureDetailsEn}. ${proofRoomModal.subtitleEn}`,
            audioTextHi: proofRoomModal.voiceScriptHi,
            audioTextEn: proofRoomModal.voiceScriptEn,
            status: 'pending',
          }}
          isOpen={!!proofRoomModal}
          onClose={() => setProofRoomModal(null)}
          currentUser={currentUser}
          onComplete={handleRoomProofSubmit}
          language={language}
        />
      )}

      {/* Fullscreen Zoom Modal */}
      {Boolean(zoomPhoto && zoomPhoto.trim()) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md cursor-pointer animate-in fade-in"
          onClick={() => setZoomPhoto(null)}
        >
          <div className="relative max-w-5xl max-h-[92vh] w-full flex flex-col items-center">
            <img
              src={zoomPhoto!}
              alt="Zoomed reference"
              referrerPolicy="no-referrer"
              className="max-h-[82vh] w-auto max-w-full object-contain rounded-xl shadow-2xl"
            />
            <div className="mt-3 text-white text-xs font-semibold bg-black/60 px-4 py-2 rounded-full">
              {language === 'hi' ? 'बंद करने के लिए कहीं भी क्लिक करें' : 'Click anywhere to close preview'}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
