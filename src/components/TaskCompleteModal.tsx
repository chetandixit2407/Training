import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DailyTask, User, Language } from '../types';
import { VoiceButton } from './VoiceButton';
import { ReferenceImage } from './ReferenceImage';
import {
  X,
  Camera,
  CheckCircle2,
  Clock,
  MapPin,
  Image as ImageIcon,
  AlertCircle,
  Plus,
  Trash2,
  ShieldCheck,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';

export interface CompletionPhotoDraft {
  id: string;
  photoBase64: string;
  angleLabel: string;
  caption?: string;
}

interface TaskCompleteModalProps {
  task: DailyTask | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onComplete: (
    taskId: string,
    proofPhotos: Array<{ photoBase64: string; angleLabel?: string; caption?: string }>,
    primaryPhotoUrl: string,
    beforePhotoUrl?: string,
    notes?: string
  ) => void;
  language: Language;
}

export const TaskCompleteModal: React.FC<TaskCompleteModalProps> = ({
  task,
  isOpen,
  onClose,
  currentUser,
  onComplete,
  language,
}) => {
  const [completionPhotos, setCompletionPhotos] = useState<CompletionPhotoDraft[]>([]);
  const [beforePhoto, setBeforePhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState<string | null>(null);

  // Live Camera (getUserMedia) state
  const [cameraTarget, setCameraTarget] = useState<'proof' | 'before' | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(
    async (mode: 'environment' | 'user') => {
      stopCameraStream();
      setCameraError(null);
      setCapturedPreview(null);
      setIsStartingCamera(true);

      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsStartingCamera(false);
        setCameraError(
          language === 'hi'
            ? 'इस ब्राउज़र या डिवाइस में लाइव कैमरा उपलब्ध नहीं है।'
            : 'Live camera (getUserMedia) is not supported on this browser or device.'
        );
        return;
      }

      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: mode },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch {
          // Fallback to any available video device
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err: any) {
        const msg = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
          ? language === 'hi'
            ? 'कैमरा अनुमति अस्वीकृत है। कृपया ब्राउज़र सेटिंग्स में कैमरा अनुमति दें और पुनः प्रयास करें।'
            : 'Camera permission was denied. Please allow camera access in your browser and try again.'
          : err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError'
          ? language === 'hi'
            ? 'कोई कैमरा डिवाइस नहीं मिला।'
            : 'No camera device found on this device.'
          : language === 'hi'
            ? 'कैमरा शुरू करने में समस्या आई। कृपया पुनः प्रयास करें।'
            : `Unable to start camera: ${err?.message || 'Permission or hardware error'}`;
        setCameraError(msg);
      } finally {
        setIsStartingCamera(false);
      }
    },
    [language, stopCameraStream]
  );

  useEffect(() => {
    if (!isOpen) {
      stopCameraStream();
      setCameraTarget(null);
      setCapturedPreview(null);
      setCameraError(null);
    }
    return () => {
      stopCameraStream();
    };
  }, [isOpen, stopCameraStream]);

  const handleOpenCamera = (target: 'proof' | 'before') => {
    setError(null);
    setCameraTarget(target);
    startCamera(facingMode);
  };

  const handleCloseCamera = () => {
    stopCameraStream();
    setCameraTarget(null);
    setCapturedPreview(null);
    setCameraError(null);
  };

  const handleSwitchCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  };

  const handleCaptureFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError(
        language === 'hi'
          ? 'कैमरा फ्रेम अभी तैयार नहीं है। कृपया एक सेकंड प्रतीक्षा करें।'
          : 'Camera feed is not ready yet. Please wait a moment.'
      );
      return;
    }

    const maxDim = 1200;
    let width = video.videoWidth;
    let height = video.videoHeight;
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    stopCameraStream();
    setCapturedPreview(dataUrl);
  };

  const handleRetake = () => {
    setCapturedPreview(null);
    startCamera(facingMode);
  };

  const handleConfirmCapturedPhoto = () => {
    if (!capturedPreview) return;

    if (cameraTarget === 'before') {
      setBeforePhoto(capturedPreview);
    } else {
      const angleNum = completionPhotos.length + 1;
      setCompletionPhotos((prev) => [
        ...prev,
        {
          id: `draft_cam_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          photoBase64: capturedPreview,
          angleLabel:
            language === 'hi'
              ? `लाइव कैमरा एंगल #${angleNum}`
              : `Live Camera Angle #${angleNum}`,
          caption: '',
        },
      ]);
    }

    handleCloseCamera();
  };

  if (!isOpen || !task) return null;

  const currentBoyName = currentUser
    ? language === 'hi'
      ? currentUser.nameHi
      : currentUser.name
    : 'Pantry Boy';
  const currentBoyId = currentUser?.id || 'pb-101';
  const currentTimeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const removePhotoDraft = (id: string) => {
    setCompletionPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePhotoLabel = (id: string, angleLabel: string) => {
    setCompletionPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, angleLabel } : p))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (completionPhotos.length === 0) {
      setError(
        language === 'hi'
          ? 'कृपया लाइव कैमरा से कम से कम 1 प्रमाण फोटो (Proof Photo) खींचें।'
          : 'Please capture at least 1 live camera proof photo.'
      );
      return;
    }

    const payloadPhotos = completionPhotos.map((p) => ({
      photoBase64: p.photoBase64,
      angleLabel: p.angleLabel,
      caption: p.caption,
    }));

    const primaryPhotoUrl = completionPhotos[0]?.photoBase64 || '';
    stopCameraStream();
    onComplete(task.id, payloadPhotos, primaryPhotoUrl, beforePhoto || undefined, notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{task.scheduledTime}</span>
              <span>•</span>
              <MapPin className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? task.roomNameHi : task.roomNameEn}</span>
              <span>•</span>
              <span className="text-slate-300">Staff: {currentBoyName}</span>
            </div>
            <h3 className="text-base sm:text-lg font-black mt-0.5">
              {language === 'hi' ? task.titleHi : task.titleEn}
            </h3>
          </div>
          <button
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Instructions + Audio */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-extrabold text-amber-900 uppercase tracking-wide">
                {language === 'hi' ? 'कार्य निर्देश (Instructions)' : 'Instructions'}
              </span>
              <VoiceButton
                text={language === 'hi' ? (task.audioTextHi || task.instructionsHi) : task.instructionsEn}
                lang={language}
                textId={`task-modal-${task.id}`}
                size="sm"
                label={language === 'hi' ? 'निर्देश सुनें' : 'Listen'}
              />
            </div>
            <p className="text-sm text-slate-800 leading-relaxed font-medium">
              {language === 'hi' ? task.instructionsHi : task.instructionsEn}
            </p>
          </div>

          {/* Reference Photo Comparison Box */}
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
              {language === 'hi' ? 'मानक संदर्भ फोटो (Official Standard Target):' : 'Official Target Reference Standard:'}
            </label>
            <div className="aspect-16/9 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 relative group">
              {task.referencePhotoUrl ? (
                <ReferenceImage
                  src={task.referencePhotoUrl}
                  alt="Reference standard"
                  language={language}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <Camera className="w-8 h-8" />
                </div>
              )}
              <div className="absolute top-2 left-2 px-2.5 py-1 bg-black/75 backdrop-blur-xs text-white rounded-md text-[11px] font-bold z-20">
                {language === 'hi' ? 'ऑफिस मानक लक्ष्य' : 'Official Target Standard'}
              </div>
            </div>
          </div>

          {/* 40-Day Retention Policy Notice Badge */}
          <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-start gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-lg shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-xs text-emerald-950">
              <div className="font-extrabold flex items-center gap-1">
                <span>{language === 'hi' ? 'केवल लाइव कैमरा प्रमाण (40-दिवसीय संग्रह)' : 'Live Camera-Only Proof (40-Day Retention)'}</span>
                <span className="px-1.5 py-0.2 bg-emerald-200 text-emerald-900 rounded font-black text-[10px]">
                  LIVE CAMERA
                </span>
              </div>
              <p className="text-emerald-800 mt-0.5 leading-relaxed">
                {language === 'hi'
                  ? `प्रमाण केवल लाइव कैमरा से खींचा जा सकता है (गैलरी अपलोड बंद है)। हर फोटो आपके नाम (${currentBoyName}) और समय (${currentTimeString}) के साथ सर्वर पर सुरक्षित रहेगी।`
                  : `Proof photos must be captured in real time using your device camera (gallery uploads disabled). Archived with your identity (${currentBoyName}) and timestamp (${currentTimeString}).`}
              </p>
            </div>
          </div>

          {/* Live Camera Viewfinder (when active) */}
          {cameraTarget !== null && (
            <div className="bg-slate-950 rounded-2xl border-2 border-emerald-500 overflow-hidden shadow-lg">
              <div className="px-4 py-2.5 bg-slate-900 flex items-center justify-between text-white">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>
                    {cameraTarget === 'before'
                      ? (language === 'hi' ? 'लाइव कैमरा: सफाई से पहले की फोटो' : 'Live Camera: Before Cleaning Photo')
                      : (language === 'hi' ? 'लाइव कैमरा: कार्य प्रमाण फोटो' : 'Live Camera: Task Proof Photo')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!capturedPreview && !cameraError && (
                    <button
                      type="button"
                      onClick={handleSwitchCamera}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>{language === 'hi' ? 'कैमरा बदलें' : 'Switch'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCloseCamera}
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="relative aspect-16/10 bg-black flex items-center justify-center">
                {cameraError ? (
                  <div className="p-6 text-center text-white space-y-3 max-w-md">
                    <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
                    <p className="text-xs font-semibold text-rose-200">{cameraError}</p>
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                    >
                      {language === 'hi' ? 'कैमरा पुनः प्रयास करें' : 'Retry Camera'}
                    </button>
                  </div>
                ) : capturedPreview ? (
                  <img src={capturedPreview} alt="Captured preview" className="w-full h-full object-contain" />
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {isStartingCamera && (
                      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white text-xs font-bold gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                        <span>{language === 'hi' ? 'कैमरा शुरू हो रहा है...' : 'Starting live camera...'}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {!cameraError && (
                <div className="p-3 bg-slate-900 flex items-center justify-center gap-3">
                  {capturedPreview ? (
                    <>
                      <button
                        type="button"
                        onClick={handleRetake}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>{language === 'hi' ? 'दोबारा खींचें (Retake)' : 'Retake'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmCapturedPhoto}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{language === 'hi' ? 'फोटो जोड़ें (Use Photo)' : 'Use This Photo'}</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCaptureFrame}
                      disabled={isStartingCamera}
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black flex items-center gap-2 cursor-pointer shadow-md"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{language === 'hi' ? 'फोटो खींचें (Capture)' : 'Capture Photo'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Multiple Completion Photos Section (Camera-only) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-emerald-600" />
                <span>
                  {language === 'hi'
                    ? `लाइव कैमरा प्रमाण फोटो * (${completionPhotos.length} संलग्न)`
                    : `Live Camera Proof Photos * (${completionPhotos.length} Captured)`}
                </span>
              </label>

              {completionPhotos.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCompletionPhotos([])}
                  className="text-xs text-red-600 hover:underline font-semibold cursor-pointer"
                >
                  {language === 'hi' ? 'सभी हटाएं' : 'Clear All'}
                </button>
              )}
            </div>

            {completionPhotos.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {completionPhotos.map((photo, idx) => (
                    <div
                      key={photo.id}
                      className="border-2 border-emerald-500 rounded-xl overflow-hidden bg-slate-900 relative group shadow-sm flex flex-col"
                    >
                      <div
                        className="aspect-4/3 relative cursor-pointer overflow-hidden"
                        onClick={() => setPreviewZoom(photo.photoBase64)}
                      >
                        <img
                          src={photo.photoBase64}
                          alt={`Proof angle ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-103 transition-transform"
                        />
                        <div className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-black/80 backdrop-blur-xs text-white rounded text-[10px] font-bold">
                          #{idx + 1}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePhotoDraft(photo.id);
                          }}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-red-600/90 hover:bg-red-700 text-white flex items-center justify-center cursor-pointer transition-colors shadow-xs"
                          title="Remove photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="p-1.5 bg-slate-900 border-t border-slate-800">
                        <input
                          type="text"
                          value={photo.angleLabel}
                          onChange={(e) => updatePhotoLabel(photo.id, e.target.value)}
                          placeholder="Angle description..."
                          className="w-full bg-slate-800 text-white text-[11px] px-2 py-1 rounded border border-slate-700 focus:outline-none focus:border-emerald-500 font-medium"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {cameraTarget === null && (
                  <button
                    type="button"
                    onClick={() => handleOpenCamera('proof')}
                    className="w-full py-2.5 px-3 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors min-h-[40px]"
                  >
                    <Camera className="w-4 h-4 text-emerald-700" />
                    <span>{language === 'hi' ? '+ लाइव कैमरा से और फोटो खींचें' : '+ Capture Another Angle (Live Camera)'}</span>
                  </button>
                )}
              </div>
            ) : (
              cameraTarget !== 'proof' && (
                <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/20 rounded-2xl p-6 text-center transition-all flex flex-col items-center justify-center min-h-[160px]">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3 shadow-xs">
                    <Camera className="w-7 h-7" />
                  </div>
                  <span className="font-black text-sm text-slate-900 block">
                    {language === 'hi'
                      ? 'लाइव कैमरा से कार्य पूरा होने की फोटो खींचें'
                      : 'Capture Live Camera Proof Photos'}
                  </span>
                  <span className="text-xs text-slate-500 mt-1 max-w-md">
                    {language === 'hi'
                      ? 'गैलरी या पुरानी फोटो की अनुमति नहीं है। केवल लाइव कैमरा से फोटो खींचकर जमा करें।'
                      : 'Gallery uploads are disabled. Capture real-time photos directly using your device camera.'}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleOpenCamera('proof')}
                    className="mt-4 py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors min-h-[42px]"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{language === 'hi' ? 'लाइव कैमरा खोलें' : 'Open Live Camera'}</span>
                  </button>
                </div>
              )
            )}
          </div>

          {/* Optional Before Photo (Camera-only) */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                <span>{language === 'hi' ? 'सफाई से पहले का फोटो (वैकल्पिक लाइव कैमरा)' : 'Optional Before Cleaning Photo (Live Camera)'}</span>
              </label>
              {beforePhoto && (
                <button
                  type="button"
                  onClick={() => setBeforePhoto(null)}
                  className="text-[11px] text-red-600 hover:underline font-semibold cursor-pointer"
                >
                  {language === 'hi' ? 'हटाएं' : 'Remove'}
                </button>
              )}
            </div>

            {beforePhoto ? (
              <div className="h-24 w-36 rounded-lg overflow-hidden border border-slate-300 relative">
                <img src={beforePhoto} alt="Before" className="w-full h-full object-cover" />
                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/70 text-white text-[9px] font-bold rounded">
                  Before
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleOpenCamera('before')}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{language === 'hi' ? 'लाइव कैमरा से Before फोटो लें' : 'Capture Before Photo'}</span>
              </button>
            )}
          </div>

          {/* Optional Notes */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {language === 'hi' ? 'टिप्पणी (वैकल्पिक Staff Note):' : 'Optional Notes:'}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                language === 'hi'
                  ? 'उदा. टेबल सैनिटाइज की, 2 फ्रेश बोतलें रखीं, डस्टबिन बदला'
                  : 'e.g. Table sanitized, 2 fresh bottles placed, bin replaced'
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer min-h-[44px]"
          >
            {language === 'hi' ? 'रद्द करें' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={completionPhotos.length === 0}
            className={`flex-1 py-3 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[48px] shadow-sm ${
              completionPhotos.length > 0
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>
              {language === 'hi'
                ? `प्रमाण जमा करें (${completionPhotos.length} फोटो)`
                : `Submit Proof & Complete (${completionPhotos.length} Photo${completionPhotos.length > 1 ? 's' : ''})`}
            </span>
          </button>
        </div>
      </div>

      {/* Zoom Modal */}
      {previewZoom && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-pointer animate-in fade-in"
          onClick={() => setPreviewZoom(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <img
              src={previewZoom}
              alt="Zoomed preview"
              className="max-h-[80vh] w-auto max-w-full object-contain rounded-xl shadow-2xl"
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
