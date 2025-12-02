import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { 
  getFirestore, collection, doc, getDoc, setDoc, updateDoc, 
  deleteDoc, query, where, getDocs, addDoc, onSnapshot, 
  orderBy, serverTimestamp, arrayUnion, Timestamp, writeBatch, arrayRemove
} from "firebase/firestore";
import { UserProfile, Relationship } from "../types";

// --- KONFIGURASI FIREBASE ---
// PENTING: Jika muncul error "auth/unauthorized-domain",
// Masukkan domain Vercel kamu (contoh: idantmail.vercel.app)
// ke Firebase Console -> Authentication -> Settings -> Authorized Domains
const firebaseConfig = {
  apiKey: "AIzaSyDiMfLbiUlgyMh69hFr4-SLmfqwZ4vsZsU", 
  authDomain: "couplewishlist.firebaseapp.com",
  projectId: "couplewishlist",
  storageBucket: "couplewishlist.firebasestorage.app",
  messagingSenderId: "434649850608",
  appId: "1:434649850608:web:a53171152a78b1467a5835"
};

// Initialize
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// --- AUTH SERVICE ---

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // Create or update user profile in Firestore
    const userRef = doc(db, "users", result.user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: result.user.uid,
        displayName: result.user.displayName,
        email: result.user.email,
        photoURL: result.user.photoURL,
        relationshipId: null,
        createdAt: serverTimestamp()
      });
    }
    return result.user;
  } catch (error) {
    console.error("Error signing in", error);
    throw error;
  }
};

export const logout = () => signOut(auth);

// --- RELATIONSHIP / PAIRING SERVICE ---

// Generate random 6 character code
const generateInviteCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const createRelationship = async (user: UserProfile) => {
  const code = generateInviteCode();
  const batch = writeBatch(db);
  
  // 1. Create Relationship Doc
  const newRelRef = doc(collection(db, "relationships"));
  const newRel: Relationship = {
    id: newRelRef.id,
    code: code,
    createdAt: Date.now(),
    startDate: new Date().toISOString().split('T')[0],
    partnerIds: [user.uid]
  };
  batch.set(newRelRef, newRel);

  // 2. Update User Doc
  const userRef = doc(db, "users", user.uid);
  batch.update(userRef, { relationshipId: newRel.id });

  await batch.commit();
  return newRel;
};

export const joinRelationship = async (user: UserProfile, code: string) => {
  const relsRef = collection(db, "relationships");
  const q = query(relsRef, where("code", "==", code.toUpperCase()));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    throw new Error("Kode invite tidak ditemukan.");
  }

  const relDoc = querySnapshot.docs[0];
  const relData = relDoc.data() as Relationship;

  if (relData.partnerIds.includes(user.uid)) {
    // Already in it
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, { relationshipId: relData.id });
    return relData;
  }

  if (relData.partnerIds.length >= 2) {
    throw new Error("Hubungan ini sudah penuh (max 2 orang).");
  }

  const batch = writeBatch(db);

  // 1. Add user to relationship
  const relRef = doc(db, "relationships", relData.id);
  batch.update(relRef, { partnerIds: arrayUnion(user.uid) });

  // 2. Update user
  const userRef = doc(db, "users", user.uid);
  batch.update(userRef, { relationshipId: relData.id });

  await batch.commit();

  return { ...relData, partnerIds: [...relData.partnerIds, user.uid] };
};

export const leaveRelationship = async (userId: string, relationshipId: string) => {
  const batch = writeBatch(db);

  // 1. Remove user from relationship partnerIds
  const relRef = doc(db, "relationships", relationshipId);
  batch.update(relRef, { 
    partnerIds: arrayRemove(userId) 
  });

  // 2. Set user's relationshipId to null
  const userRef = doc(db, "users", userId);
  batch.update(userRef, { 
    relationshipId: null 
  });

  await batch.commit();
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  return snap.exists() ? snap.data() as UserProfile : null;
};