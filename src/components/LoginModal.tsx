import React, { useState } from 'react';
import { User, Language } from '../types';
import { StorageService } from '../services/storageService';
import { Lock, UserCheck, Shield, X, AlertCircle } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSelectUser: (user: User) => void;
  language: Language;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectUser,
  language,
}) => {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const users = StorageService.getUsers();

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const found = users.find(
      (u) =>
        u.username.trim().toLowerCase() === username.trim().toLowerCase() &&
        u.pin.trim() === pin.trim()
    );

    if (found) {
      onSelectUser(found);
      onClose();
    } else {
      setError(
        language === 'hi'
          ? 'गलत यूजर आईडी या पिन/पासवर्ड दर्ज किया गया है।'
          : 'Invalid User ID or PIN/Password.'
      );
    }
  };

  const handleQuickSwitch = (user: User) => {
    onSelectUser(user);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">
              {language === 'hi' ? 'लॉगिन / कर्मचारी चयन' : 'Staff Login & Switch'}
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              {language === 'hi'
                ? 'कृपया अपनी आईडी चुनें या पासवर्ड डालें'
                : 'Select your profile or enter credentials'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* Quick 1-Tap Select for Pantry Staff & Admin */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
              {language === 'hi' ? 'त्वरित 1-टैप लॉगिन (Quick Select)' : 'Quick 1-Tap Login'}
            </label>
            <div className="space-y-2">
              {users.map((user) => {
                const isCurrent = currentUser?.id === user.id;
                const isAdmin = user.role === 'admin';
                return (
                  <button
                    key={user.id}
                    onClick={() => handleQuickSwitch(user)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isCurrent
                        ? 'border-amber-500 bg-amber-50/70 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                        isAdmin ? 'bg-amber-600' : 'bg-emerald-600'
                      }`}>
                        {isAdmin ? <Shield className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">
                          {language === 'hi' ? user.nameHi : user.name}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5">
                          <span className="font-mono font-semibold text-slate-700">{user.username}</span>
                          <span>•</span>
                          <span>{language === 'hi' ? user.shiftHi : user.shift}</span>
                        </div>
                      </div>
                    </div>
                    {isCurrent ? (
                      <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-md">
                        {language === 'hi' ? 'सक्रिय' : 'Active'}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-600 hover:text-slate-900">
                        {language === 'hi' ? 'लॉगिन करें →' : 'Login →'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="shrink-0 mx-3 text-xs text-slate-400 font-medium">
              {language === 'hi' ? 'या आईडी और पिन दर्ज करें' : 'Or Enter ID & PIN'}
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Form */}
          <form onSubmit={handleManualLogin} className="space-y-3.5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'hi' ? 'यूजर आईडी (User ID)' : 'User ID'}
              </label>
              <input
                type="text"
                placeholder={language === 'hi' ? 'उदा. PB101 या ADMIN01' : 'e.g. PB101 or ADMIN01'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'hi' ? 'पिन / पासवर्ड (PIN / Password)' : 'PIN / Password'}
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder={language === 'hi' ? 'पिन दर्ज करें (उदा. 1234)' : 'Enter PIN (e.g. 1234)'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-medium pr-10"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px] shadow-sm"
            >
              {language === 'hi' ? 'लॉगिन करें (Sign In)' : 'Sign In'}
            </button>
          </form>

        </div>

      </div>
    </div>
  );
};
