import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, User as UserIcon, Trash2, History, ShieldCheck, Maximize2, FileText, RotateCcw } from 'lucide-react';
import { Language, User, RoomPhotoItem, CompletionPhotoItem, DeletionAuditLog } from '../types';
import { AITrainingService } from '../services/aiTrainingService';
import { CloudPhotoService } from '../services/cloudPhotoService';
import { ReferenceImage } from './ReferenceImage';
import { DeletePhotoConfirmModal } from './DeletePhotoConfirmModal';

interface DateHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'room' | 'task';
  roomId?: string;
  roomLabel?: string;
  taskId?: string;
  taskLabel?: string;
  currentUser: User | null;
  language: Language;
  onDeleted?: () => void;
}

type DateFilterKey = 'all' | 'today' | 'yesterday' | '7days' | '30days' | 'custom';

export const DateHistoryModal: React.FC<DateHistoryModalProps> = ({
  isOpen,
  onClose,
  mode,
  roomId,
  roomLabel,
  taskId,
  taskLabel,
  currentUser,
  language,
  onDeleted,
}) => {
  const [dateFilter, setDateFilter] = useState<DateFilterKey>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeTab, setActiveTab] = useState<'photos' | 'audit'>('photos');
  const [roomPhotos, setRoomPhotos] = useState<RoomPhotoItem[]>([]);
  const [taskProofs, setTaskProofs] = useState<CompletionPhotoItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<DeletionAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    url: string;
    fileName: string;
    storagePath: string;
    assetId?: string;
    roomId?: string;
    taskId?: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  const handleRestorePhoto = async (p: RoomPhotoItem) => {
    if (!isAdmin) return;
    setIsRestoring(true);
    setDeleteError(null);
    try {
      await AITrainingService.restoreRoomPhotoItem({
        category: p.roomId || roomId || '',
        photoId: p.id,
        photoUrl: p.url,
        user: currentUser,
      });
      setRestoreMsg(
        language === 'hi'
          ? 'फोटो को वर्तमान संदर्भ मानक के रूप में सफलतापूर्वक पुनर्स्थापित किया गया!'
          : 'Photo restored as current standard reference photo!'
      );
      setTimeout(() => setRestoreMsg(null), 3500);
      await loadHistory();
      if (onDeleted) onDeleted();
    } catch (err: any) {
      console.error('Failed to restore photo:', err);
      setDeleteError(err.message || 'Failed to restore photo');
    } finally {
      setIsRestoring(false);
    }
  };

  const loadHistory = async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      if (activeTab === 'audit' && isAdmin) {
        const logs = await AITrainingService.getDeletionAuditLogs(currentUser);
        setAuditLogs(logs);
      } else if (mode === 'room') {
        const res = await AITrainingService.getRoomPhotoHistory({
          roomId: roomId || 'all',
          filter: dateFilter,
          startDate,
          endDate,
        });
        setRoomPhotos(res.photos || []);
      } else {
        const res = await AITrainingService.getTaskProofHistory({
          taskId: taskId || 'all',
          filter: dateFilter,
          startDate,
          endDate,
        });
        setTaskProofs(res.photos || []);
      }
    } catch (err) {
      console.error('Error loading date-wise history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, mode, roomId, taskId, dateFilter, startDate, endDate, activeTab]);

  if (!isOpen) return null;

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !isAdmin) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      if (mode === 'room') {
        await AITrainingService.deleteRoomPhotoItem(
          deleteTarget.roomId || roomId || '',
          deleteTarget.id,
          currentUser,
          deleteTarget.url
        );
        await CloudPhotoService.adminDeleteHistoricalPhoto({
          targetType: 'room_reference',
          targetId: deleteTarget.id,
          roomId: deleteTarget.roomId || roomId,
          fileName: deleteTarget.fileName,
          storagePath: deleteTarget.storagePath,
          assetId: deleteTarget.assetId,
          deletedBy: currentUser?.name || 'Admin',
        });
      } else {
        await AITrainingService.deleteCompletionPhoto({
          photoId: deleteTarget.id,
          taskId: deleteTarget.taskId || taskId || '',
          user: currentUser,
        });
        await CloudPhotoService.adminDeleteHistoricalPhoto({
          targetType: 'task_proof',
          targetId: deleteTarget.id,
          taskId: deleteTarget.taskId || taskId,
          fileName: deleteTarget.fileName,
          storagePath: deleteTarget.storagePath,
          assetId: deleteTarget.assetId,
          deletedBy: currentUser?.name || 'Admin',
        });
      }
      setDeleteTarget(null);
      await loadHistory();
      if (onDeleted) onDeleted();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to permanently delete photo');
    } finally {
      setIsDeleting(false);
    }
  };

  const filterButtons: Array<{ key: DateFilterKey; labelEn: string; labelHi: string }> = [
    { key: 'all', labelEn: 'All Dates', labelHi: 'सभी तिथियाँ' },
    { key: 'today', labelEn: 'Today', labelHi: 'आज' },
    { key: 'yesterday', labelEn: 'Yesterday', labelHi: 'कल' },
    { key: '7days', labelEn: 'Last 7 Days', labelHi: 'पिछले 7 दिन' },
    { key: '30days', labelEn: 'Last 30 Days', labelHi: 'पिछले 30 दिन' },
    { key: 'custom', labelEn: 'Custom Range', labelHi: 'कस्टम तिथि' },
  ];

  const itemsCount = mode === 'room' ? roomPhotos.length : taskProofs.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wide">
              <History className="w-4 h-4" />
              <span>
                {mode === 'room'
                  ? language === 'hi'
                    ? 'दिनांक-वार संदर्भ फोटो इतिहास'
                    : 'Date-Wise Reference Photo History'
                  : language === 'hi'
                  ? 'दिनांक-वार कार्य प्रमाण इतिहास'
                  : 'Date-Wise Task Proof History'}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-extrabold mt-0.5">
              {mode === 'room'
                ? roomLabel || (language === 'hi' ? 'सभी कमरे' : 'All Rooms')
                : taskLabel || (language === 'hi' ? 'सभी कार्य प्रमाण' : 'All Task Proofs')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs & Date Filter Bar */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('photos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  activeTab === 'photos' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700'
                }`}
              >
                {language === 'hi' ? `फोटो इतिहास (${itemsCount})` : `Photo History (${itemsCount})`}
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveTab('audit')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                    activeTab === 'audit' ? 'bg-rose-700 text-white' : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{language === 'hi' ? 'डिलीट ऑडिट लॉग' : 'Deletion Audit Log'}</span>
                </button>
              )}
            </div>
          </div>

          {activeTab === 'photos' && (
            <div className="flex flex-wrap items-center gap-2">
              {filterButtons.map((fb) => (
                <button
                  key={fb.key}
                  type="button"
                  onClick={() => setDateFilter(fb.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    dateFilter === fb.key
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {language === 'hi' ? fb.labelHi : fb.labelEn}
                </button>
              ))}

              {dateFilter === 'custom' && (
                <div className="flex items-center gap-2 ml-auto">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-medium bg-white"
                  />
                  <span className="text-xs text-slate-500">→</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-medium bg-white"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {restoreMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{restoreMsg}</span>
            </div>
          )}
          {deleteError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center justify-between">
              <span>{deleteError}</span>
              <button type="button" onClick={() => setDeleteError(null)} className="text-red-600 hover:text-red-800 font-bold ml-2">✕</button>
            </div>
          )}
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500 font-semibold">
              {language === 'hi' ? 'इतिहास लोड हो रहा है...' : 'Loading permanent history...'}
            </div>
          ) : activeTab === 'audit' ? (
            auditLogs.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                {language === 'hi' ? 'कोई स्थायी डिलीट लॉग नहीं है।' : 'No permanent deletions recorded in audit log.'}
              </div>
            ) : (
              <div className="space-y-2.5">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold uppercase text-[10px] mr-2">
                        {log.targetType}
                      </span>
                      <span className="font-bold text-slate-900">{log.fileName}</span>
                      <div className="text-slate-500 font-mono text-[11px] mt-0.5">{log.storagePath}</div>
                    </div>
                    <div className="text-right text-slate-600">
                      <div className="font-bold text-slate-800">Deleted by: {log.deletedBy}</div>
                      <div className="text-[11px]">{new Date(log.deletedAt).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : itemsCount === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              {language === 'hi'
                ? 'चुनी गई तिथि सीमा में कोई फोटो नहीं मिली।'
                : 'No photos found for the selected date filter.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mode === 'room'
                ? roomPhotos.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs flex flex-col"
                    >
                      <div
                        className="relative aspect-4/3 bg-slate-900 cursor-pointer group"
                        onClick={() => setZoomUrl(p.url)}
                      >
                        <ReferenceImage src={p.url} alt={p.captionEn || p.roomId || 'Room'} language={language} className="w-full h-full object-cover" />
                        <div className="absolute top-2 left-2 flex items-center gap-1">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              p.isCurrent !== false ? 'bg-emerald-600 text-white' : 'bg-slate-800/90 text-amber-300'
                            }`}
                          >
                            {p.isCurrent !== false ? 'Current Standard' : 'Archived Version'}
                          </span>
                        </div>
                        <div className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <Maximize2 className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <div className="p-3 text-xs space-y-1 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="font-bold text-slate-900 uppercase">{(p.roomId || '').replace(/_/g, ' ')}</div>
                          <div className="text-slate-600 line-clamp-1">{language === 'hi' ? p.captionHi : p.captionEn}</div>
                          <div className="flex items-center gap-1.5 text-slate-500 mt-1">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(p.uploadedAt).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <UserIcon className="w-3 h-3" />
                            <span>{p.uploadedBy || 'Admin'}</span>
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                            {p.isCurrent === false ? (
                              <button
                                type="button"
                                disabled={isRestoring}
                                onClick={() => handleRestorePhoto(p)}
                                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>{language === 'hi' ? 'पुनर्स्थापित करें' : 'Restore'}</span>
                              </button>
                            ) : (
                              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>{language === 'hi' ? 'सक्रिय मानक' : 'Active Standard'}</span>
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  id: p.id,
                                  url: p.url,
                                  fileName: p.fileName || p.id,
                                  storagePath: p.storagePath || p.url,
                                  assetId: p.assetId,
                                  roomId: p.roomId,
                                })
                              }
                              className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer ml-auto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{language === 'hi' ? 'स्थायी हटाएं' : 'Delete'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                : taskProofs.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs flex flex-col"
                    >
                      <div
                        className="relative aspect-4/3 bg-slate-900 cursor-pointer group"
                        onClick={() => setZoomUrl(p.url)}
                      >
                        <ReferenceImage src={p.url} alt={p.taskTitle} language={language} className="w-full h-full object-cover" />
                        <div className="absolute top-2 left-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              p.isLatest !== false ? 'bg-emerald-600 text-white' : 'bg-slate-800/90 text-amber-300'
                            }`}
                          >
                            {p.isLatest !== false ? 'Latest Proof' : 'Previous Proof'}
                          </span>
                        </div>
                      </div>
                      <div className="p-3 text-xs space-y-1 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="font-bold text-slate-900">{p.taskTitle}</div>
                          <div className="text-slate-600">{p.roomName}</div>
                          <div className="flex items-center gap-1.5 text-slate-500 mt-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(p.uploadedAt).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <UserIcon className="w-3 h-3" />
                            <span>{p.pantryBoyName}</span>
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="pt-2 mt-2 border-t border-slate-100 flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  id: p.id,
                                  url: p.url,
                                  fileName: p.fileName || p.id,
                                  storagePath: p.storagePath || p.url,
                                  assetId: p.assetId,
                                  taskId: p.taskId,
                                })
                              }
                              className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{language === 'hi' ? 'स्थायी हटाएं' : 'Delete Permanently'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
            </div>
          )}
        </div>

        {/* Lightbox */}
        {zoomUrl && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 cursor-pointer"
            onClick={() => setZoomUrl(null)}
          >
            <img src={zoomUrl} alt="Full size history" className="max-h-[88vh] max-w-full object-contain rounded-xl" />
          </div>
        )}

        {/* Admin-only Delete Confirmation */}
        <DeletePhotoConfirmModal
          isOpen={deleteTarget !== null}
          onClose={() => {
            if (!isDeleting) {
              setDeleteTarget(null);
              setDeleteError(null);
            }
          }}
          onConfirm={handleConfirmDelete}
          isDeleting={isDeleting}
          language={language}
          photoUrl={deleteTarget?.url}
          roomName={deleteTarget?.roomId || deleteTarget?.taskId}
          error={deleteError}
        />
      </div>
    </div>
  );
};
