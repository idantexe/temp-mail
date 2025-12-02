import React, { useState } from 'react';
import { UserProfile } from '../types';
import { createRelationship, joinRelationship } from '../services/firebase';
import { Sparkles, Users, ArrowRight, Loader2 } from 'lucide-react';

interface Props {
  user: UserProfile;
  // onComplete dihapus, tidak diperlukan lagi
}

const OnboardingScreen: React.FC<Props> = ({ user }) => {
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setLoading(true);
    try {
      await createRelationship(user);
      // Tidak perlu redirect manual, App.tsx akan mendeteksi perubahan relationshipId
    } catch (e) {
      setError("Gagal membuat ruang baru.");
      setLoading(false); // Hanya matikan loading jika error
    }
  };

  const handleJoin = async () => {
    if (!inviteCode || inviteCode.length < 6) {
      setError("Kode harus 6 karakter.");
      return;
    }
    setLoading(true);
    try {
      await joinRelationship(user, inviteCode);
      // Tidak perlu redirect manual
    } catch (e: any) {
      setError(e.message || "Gagal bergabung.");
      setLoading(false); // Hanya matikan loading jika error
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#FDFBF7]">
      <div className="w-full max-w-md animate-in slide-in-from-bottom-8 duration-500">
        <h1 className="text-4xl font-handwriting text-[#8E6E6E] text-center mb-2">
          Halo, {user.displayName?.split(' ')[0]}!
        </h1>
        <p className="text-center text-gray-400 mb-10 text-sm font-medium">
          Satu langkah lagi menuju ruang rahasia kalian.
        </p>

        {mode === 'select' && (
          <div className="grid gap-4">
            <button 
              onClick={() => setMode('create')}
              className="bg-white p-8 rounded-[32px] shadow-sm border border-[#EBE0D0] flex flex-col items-center gap-4 hover:border-[#8E6E6E] hover:shadow-lg hover:shadow-[#8E6E6E]/10 transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#8E6E6E]/5 rounded-bl-[100px] transition-all group-hover:bg-[#8E6E6E]/10"></div>
              <div className="w-14 h-14 bg-[#8E6E6E] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#8E6E6E]/30 group-hover:scale-110 transition-transform">
                <Sparkles className="w-7 h-7" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-800">Buat Ruang Baru</h3>
                <p className="text-xs text-gray-500 mt-1">Saya ingin mengundang pasangan.</p>
              </div>
            </button>

            <button 
              onClick={() => setMode('join')}
              className="bg-white p-8 rounded-[32px] shadow-sm border border-[#EBE0D0] flex flex-col items-center gap-4 hover:border-[#B09B7A] hover:shadow-lg hover:shadow-[#B09B7A]/10 transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-24 h-24 bg-[#B09B7A]/5 rounded-br-[100px] transition-all group-hover:bg-[#B09B7A]/10"></div>
              <div className="w-14 h-14 bg-[#B09B7A] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#B09B7A]/30 group-hover:scale-110 transition-transform">
                <Users className="w-7 h-7" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-800">Masuk Ruangan</h3>
                <p className="text-xs text-gray-500 mt-1">Saya punya kode undangan.</p>
              </div>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="bg-white p-8 rounded-[32px] shadow-xl border border-gray-100 text-center">
            <h3 className="text-xl font-bold mb-2 text-gray-800">Setup Ruangan</h3>
            <p className="text-sm text-gray-400 mb-8">Kamu akan menjadi admin room ini.</p>
            <button 
              onClick={handleCreate} 
              disabled={loading}
              className="w-full bg-[#8E6E6E] text-white py-4 rounded-2xl font-bold shadow-lg shadow-[#8E6E6E]/30 flex items-center justify-center gap-2 hover:bg-[#785c5c] transition-colors"
            >
              {loading ? <Loader2 className="animate-spin" /> : "Buat Ruang Sekarang"}
            </button>
            <button onClick={() => setMode('select')} className="mt-6 text-xs text-gray-400 hover:text-gray-600">Batal</button>
          </div>
        )}

        {mode === 'join' && (
          <div className="bg-white p-8 rounded-[32px] shadow-xl border border-gray-100">
            <h3 className="text-xl font-bold mb-6 text-center text-gray-800">Input Kode Cinta</h3>
            <div className="relative mb-6">
              <input 
                type="text" 
                placeholder="000000"
                className="w-full text-center text-3xl tracking-[0.5em] uppercase font-bold border-2 border-gray-100 focus:border-[#B09B7A] rounded-2xl py-4 bg-gray-50 focus:bg-white transition-all outline-none text-gray-700 placeholder:text-gray-200"
                value={inviteCode}
                onChange={(e) => {
                  setInviteCode(e.target.value.toUpperCase());
                  setError('');
                }}
                maxLength={6}
              />
            </div>
            {error && <p className="text-red-500 text-xs text-center mb-6 bg-red-50 p-2 rounded-lg">{error}</p>}
            <button 
              onClick={handleJoin} 
              disabled={loading || inviteCode.length < 6}
              className="w-full bg-[#B09B7A] text-white py-4 rounded-2xl font-bold shadow-lg shadow-[#B09B7A]/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none hover:bg-[#968366] transition-all"
            >
               {loading ? <Loader2 className="animate-spin" /> : <>Masuk <ArrowRight className="w-5 h-5" /></>}
            </button>
            <button onClick={() => setMode('select')} className="mt-6 w-full text-center text-xs text-gray-400 hover:text-gray-600">Batal</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingScreen;