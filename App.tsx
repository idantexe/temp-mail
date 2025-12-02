import React, { useEffect, useState } from 'react';
import { auth, db } from './services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserProfile, Relationship } from './types';
import AuthScreen from './components/AuthScreen';
import OnboardingScreen from './components/OnboardingScreen';
import Dashboard from './components/Dashboard';
import { Loader2 } from 'lucide-react';

function App() {
  // State Data
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [relationship, setRelationship] = useState<Relationship | null>(null);

  // Loading States (Granular control)
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isRelLoading, setIsRelLoading] = useState(false);

  // 1. Auth Listener: Cek apakah user login Google/Guest
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setIsAuthLoading(false);
      if (!user) {
        // Reset state jika logout
        setUserProfile(null);
        setRelationship(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. User Profile Listener: Cek data user di Firestore
  useEffect(() => {
    if (!authUser) return;

    setIsProfileLoading(true);
    const userRef = doc(db, "users", authUser.uid);
    
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      } else {
        // Edge case: Auth sukses tapi data firestore belum dibuat (biasanya sangat cepat)
        setUserProfile(null);
      }
      setIsProfileLoading(false);
    }, (err) => {
      console.error("User Listener Error:", err);
      setIsProfileLoading(false);
    });

    return () => unsubscribe();
  }, [authUser]);

  // 3. Relationship Listener: Cek data relationship jika user punya ID-nya
  useEffect(() => {
    if (!userProfile?.relationshipId) {
      setRelationship(null);
      return;
    }

    setIsRelLoading(true);
    const relRef = doc(db, "relationships", userProfile.relationshipId);

    const unsubscribe = onSnapshot(relRef, (docSnap) => {
      if (docSnap.exists()) {
        setRelationship({ id: docSnap.id, ...docSnap.data() } as Relationship);
      } else {
        setRelationship(null);
      }
      setIsRelLoading(false);
    }, (err) => {
      console.error("Rel Listener Error:", err);
      setIsRelLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile?.relationshipId]);

  // --- RENDER LOGIC ---

  // Tampilan Loading Global
  if (isAuthLoading || (authUser && isProfileLoading) || (userProfile?.relationshipId && isRelLoading)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDFBF7] gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-[#8E6E6E]" />
        <p className="text-xs text-gray-400 font-medium animate-pulse">Menyiapkan ruang kenangan...</p>
      </div>
    );
  }

  // 1. Belum Login
  if (!authUser) {
    return <AuthScreen />;
  }

  // 2. Sudah Login, tapi Profile Firestore belum siap (Sangat jarang terjadi karena loading dicover diatas)
  if (!userProfile) {
    return null; 
  }

  // 3. Sudah punya Profile, tapi belum punya Relationship (Masuk Onboarding)
  if (!userProfile.relationshipId) {
    return <OnboardingScreen user={userProfile} />;
  }

  // 4. Punya Relationship ID tapi datanya null (Misal terhapus manual di DB)
  if (!relationship) {
     return <OnboardingScreen user={userProfile} />; // Fallback ke onboarding
  }

  // 5. Semuanya Lengkap -> Dashboard
  return <Dashboard user={userProfile} relationship={relationship} />;
}

export default App;