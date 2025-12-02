import React, { useEffect, useState } from 'react';
import { auth, db } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserProfile, Relationship } from './types';
import AuthScreen from './components/AuthScreen';
import OnboardingScreen from './components/OnboardingScreen';
import Dashboard from './components/Dashboard';
import { Loader2 } from 'lucide-react';

function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // 1. Listen to Auth State
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // 2. If Logged in, listen to User Profile changes
        const userRef = doc(db, "users", firebaseUser.uid);
        const unsubUser = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as UserProfile;
            setUser(userData);
            
            // 3. If User has a relationship, listen to it
            if (userData.relationshipId) {
              const relRef = doc(db, "relationships", userData.relationshipId);
              // We don't unsubscribe from this inner listener easily in this simplified useEffect
              // In production, manage subscriptions with useRef or separate effects
              onSnapshot(relRef, (relSnap) => {
                if (relSnap.exists()) {
                  setRelationship({ id: relSnap.id, ...relSnap.data() } as Relationship);
                }
                setLoading(false);
              });
            } else {
              setRelationship(null);
              setLoading(false);
            }
          } else {
            // New user not in DB yet (edge case handled in signIn)
            setLoading(false);
          }
        });
        return () => unsubUser();
      } else {
        setUser(null);
        setRelationship(null);
        setLoading(false);
      }
      setAuthChecked(true);
    });

    return () => unsubscribeAuth();
  }, []);

  if (!authChecked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
        <Loader2 className="w-10 h-10 animate-spin text-[#8E6E6E]" />
      </div>
    );
  }

  // State 1: Not Logged In
  if (!user) {
    return <AuthScreen />;
  }

  // State 2: Logged In, but No Relationship (Needs Invite/Create)
  if (!relationship) {
    return <OnboardingScreen user={user} onComplete={() => setLoading(true)} />;
  }

  // State 3: Fully Authorized
  return <Dashboard user={user} relationship={relationship} />;
}

export default App;