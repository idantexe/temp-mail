import React, { useState } from 'react';
import { Heart, Loader2, AlertCircle } from 'lucide-react';
import { signInWithGoogle } from '../services/firebase';

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
      
      // Handle specific Firebase errors
      if(err.code === 'auth/popup-closed-by-user') {
        setError('Login dibatalkan.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('DOMAIN BELUM DIIZINKAN. Buka Firebase Console > Authentication > Settings > Authorized Domains, lalu tambahkan domain aplikasi ini.');
      } else if (err.code === 'auth/configuration-not-found') {
        setError('Config Firebase Auth belum diatur di Console.');
      } else {
        setError(`Gagal login: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
      {/* Decoration */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-secondary/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>

      <div className="relative z-10 w-full max-w-sm bg-surface p-8 rounded-[32px] shadow-xl border border-white/50 backdrop-blur-sm text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Heart className="w-8 h-8 text-primary fill-primary/20" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-2 font-sans">Our Journey</h1>
        <p className="text-gray-500 mb-8 text-sm">
          Simpan kenangan, rencanakan impian, dan wujudkan harapan bersama pasanganmu.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 flex gap-2 items-start text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <button 
          onClick={handleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-700 font-semibold py-3.5 px-4 rounded-xl hover:bg-gray-50 transition-all shadow-sm active:scale-95 disabled:opacity-70"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          ) : (
            <>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="G" />
              <span>Masuk dengan Google</span>
            </>
          )}
        </button>

        <p className="mt-6 text-xs text-gray-400">
          Aman & Terenkripsi. Dibuat dengan cinta.
        </p>
      </div>
    </div>
  );
};

export default AuthScreen;