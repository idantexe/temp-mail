import React, { useState } from 'react';
import { Heart, Loader2, AlertCircle, Sparkles, User } from 'lucide-react';
import { signInWithGoogle, signInAsGuest } from '../services/firebase';

const AuthScreen: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Login Error:", err);
      if(err.code === 'auth/popup-closed-by-user') {
        setError('Login dibatalkan.');
      } else if (err.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname;
        setError(`DOMAIN BLOCKED: Domain '${domain}' belum didaftarkan. Buka Firebase Console > Authentication > Settings > Authorized Domains, lalu tambahkan: ${domain}`);
      } else {
        setError(`Gagal login: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInAsGuest();
    } catch (err: any) {
      console.error("Guest Login Error:", err);
      setError(`Gagal login tamu: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-[#8E6E6E] via-[#B09B7A] to-[#D4Bcb8] relative overflow-hidden text-white">
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-black/10 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2"></div>

      <div className="relative z-10 w-full max-w-sm bg-white/20 backdrop-blur-xl p-8 rounded-[40px] shadow-2xl border border-white/30 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 bg-white rounded-3xl rotate-3 flex items-center justify-center mx-auto mb-8 shadow-lg">
          <Heart className="w-10 h-10 text-[#8E6E6E] fill-[#8E6E6E]" />
        </div>
        
        <h1 className="text-4xl font-bold mb-2 font-handwriting">Our Journey</h1>
        <p className="text-white/80 mb-10 text-sm font-medium leading-relaxed">
          Ruang digital privat untuk merangkai mimpi, <br/>rencana, dan kenangan berdua.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 text-white text-xs rounded-2xl border border-red-500/30 flex gap-2 items-start text-left backdrop-blur-md">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-semibold">{error}</span>
          </div>
        )}

        <div className="space-y-3">
          <button 
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white text-[#8E6E6E] font-bold py-4 px-4 rounded-2xl hover:bg-gray-50 transition-all shadow-lg shadow-black/5 active:scale-95 disabled:opacity-70 group"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-yellow-500 group-hover:rotate-12 transition-transform" />
                <span>Mulai dengan Google</span>
              </>
            )}
          </button>

          <button 
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-white/10 text-white font-semibold py-3 px-4 rounded-2xl hover:bg-white/20 transition-all border border-white/30 active:scale-95 disabled:opacity-70"
          >
            <User className="w-4 h-4" />
            <span>Masuk sebagai Tamu</span>
          </button>
        </div>

        <p className="mt-8 text-[10px] text-white/50 uppercase tracking-widest">
          Secure • Private • Forever
        </p>
      </div>
    </div>
  );
};

export default AuthScreen;