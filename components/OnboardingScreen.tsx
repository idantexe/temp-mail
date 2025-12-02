import React, { useState } from 'react';
import { UserProfile } from '../types';
import { createRelationship, joinRelationship } from '../services/firebase';
import { Sparkles, Users, ArrowRight, Loader2 } from 'lucide-react';

interface Props {
  user: UserProfile;
  onComplete: () => void;
}

const OnboardingScreen: React.FC<Props> = ({ user, onComplete }) => {
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setLoading(true);
    try {
      await createRelationship(user);
      onComplete(); // Trigger refresh in parent
    } catch (e) {
      setError("Gagal membuat ruang baru.");
    } finally {
      setLoading(false);
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
      onComplete();
    } catch (e: any) {
      setError(e.message || "Gagal bergabung.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-handwriting text-primary text-center mb-2">Halo, {user.displayName?.split(' ')[0]}!</h1>
        <p className="text-center text-gray-500 mb-8 text-sm">Mari mulai mencatat perjalanan cintamu.</p>

        {mode === 'select' && (
          <div className="grid gap-4">
            <button 
              onClick={() => setMode('create')}
              className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-3 hover:border-primary/30 transition-all group"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-gray-800">Buat Ruang Baru</h3>
                <p className="text-xs text-gray-400 mt-1">Dapatkan kode invite untuk pasanganmu.</p>
              </div>
            </button>

            <button 
              onClick={() => setMode('join')}
              className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-3 hover:border-secondary/30 transition-all group"
            >
              <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                <Users className="w-6 h-6 text-secondary" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-gray-800">Gabung via Kode</h3>
                <p className="text-xs text-gray-400 mt-1">Masukkan kode yang diberikan pasangan.</p>
              </div>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
            <h3 className="text-lg font-semibold mb-2">Membuat Ruang...</h3>
            <p className="text-sm text-gray-500 mb-6">Kamu akan menjadi admin pertama di hubungan ini.</p>
            <button 
              onClick={handleCreate} 
              disabled={loading}
              className="w-full bg-primary text-white py-3 rounded-xl font-medium shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" /> : "Buat Sekarang"}
            </button>
            <button onClick={() => setMode('select')} className="mt-4 text-xs text-gray-400 underline">Kembali</button>
          </div>
        )}

        {mode === 'join' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4 text-center">Masukkan Kode</h3>
            <input 
              type="text" 
              placeholder="Contoh: AB12CD"
              className="w-full text-center text-2xl tracking-widest uppercase font-bold border-b-2 border-gray-200 focus:border-primary outline-none py-2 mb-6 bg-transparent placeholder:text-gray-200"
              value={inviteCode}
              onChange={(e) => {
                setInviteCode(e.target.value.toUpperCase());
                setError('');
              }}
              maxLength={6}
            />
            {error && <p className="text-red-500 text-xs text-center mb-4">{error}</p>}
            <button 
              onClick={handleJoin} 
              disabled={loading || inviteCode.length < 6}
              className="w-full bg-secondary text-white py-3 rounded-xl font-medium shadow-lg shadow-secondary/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
               {loading ? <Loader2 className="animate-spin" /> : <>Gabung <ArrowRight className="w-4 h-4" /></>}
            </button>
            <button onClick={() => setMode('select')} className="mt-4 w-full text-center text-xs text-gray-400 underline">Kembali</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingScreen;