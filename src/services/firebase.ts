import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, setDoc, serverTimestamp, collection, onSnapshot, query, addDoc, deleteDoc, where } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { useState, useEffect } from 'react';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Data structure models
export interface OfferData {
  serviceId: string;
  offerText: string;
}

export interface CatalogData {
  id: string;
  serviceId: string;
  title: string;
  imageUrl: string;
  createdAt?: any;
}

// Offer Hooks
export function useOffers() {
  const [offers, setOffers] = useState<Record<string, string>>({});
  useEffect(() => {
    const q = query(collection(db, 'offers'));
    const unsub = onSnapshot(q, (snap) => {
      const data: Record<string, string> = {};
      snap.forEach(d => { data[d.id] = d.data().offerText; });
      setOffers(data);
    });
    return () => unsub();
  }, []);
  return offers;
}

export const saveOffer = async (serviceId: string, offerText: string) => {
  await setDoc(doc(db, 'offers', serviceId), { offerText });
};

export const clearOffer = async (serviceId: string) => {
  await deleteDoc(doc(db, 'offers', serviceId));
};

// Catalog Hooks
export function useCatalogs(filterByServiceId?: string) {
  const [catalogs, setCatalogs] = useState<CatalogData[]>([]);
  useEffect(() => {
    let q = query(collection(db, 'catalogs'));
    if (filterByServiceId) {
      q = query(collection(db, 'catalogs'), where('serviceId', '==', filterByServiceId));
    }
    const unsub = onSnapshot(q, (snap) => {
      setCatalogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as CatalogData)));
    });
    return () => unsub();
  }, [filterByServiceId]);
  return catalogs;
}

export const addCatalogItem = async (serviceId: string, title: string, imageUrl: string) => {
  await addDoc(collection(db, 'catalogs'), {
    serviceId,
    title,
    imageUrl,
    createdAt: serverTimestamp()
  });
};

export const deleteCatalogItem = async (catalogId: string) => {
  await deleteDoc(doc(db, 'catalogs', catalogId));
};

export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // Check if user already exists
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDocFromServer(userDocRef).catch(() => null);
    
    if (!userDocSnap || !userDocSnap.exists()) {
      // Create public user profile
      await setDoc(userDocRef, {
        displayName: user.displayName || 'Unknown',
        createdAt: serverTimestamp()
      });
      
      // Create private user info
      await setDoc(doc(db, `users/${user.uid}/private/info`), {
        email: user.email || ''
      });
    } else {
      // If the user exists, we might want to update the displayName if it changed, 
      // but only if we conform to the update security rules.
      // The rules allow updating displayName, but require ONLY displayName in the affected keys
      // and createdAt MUST equal existing createdAt
      const currentData = userDocSnap.data();
      const currentDisplayName = currentData?.displayName;
      const newDisplayName = user.displayName || 'Unknown';
      if (currentDisplayName !== newDisplayName) {
        await setDoc(userDocRef, {
          displayName: newDisplayName
        }, { merge: true });
      }
    }
    
    return user;
  } catch (error) {
    console.error("Login failed", error);
    throw error;
  }
};

export const saveTryOn = async (userId: string, serviceType: string, referenceBase64: string, targetBase64: string, resultBase64: string) => {
  // To avoid 1MB document limit, we omit the giant base64s from Firestore in this demo
  const newRef = doc(db, 'tryons', crypto.randomUUID());
  await setDoc(newRef, {
    userId,
    serviceType,
    referenceImageUrl: 'base64_data_omitted_for_size',
    targetImageUrl: 'base64_data_omitted_for_size',
    resultImageUrl: 'base64_data_omitted_for_size', // Omitting result base64 due to 1MB document limits
    createdAt: serverTimestamp(),
    status: 'completed'
  });
  return newRef.id;
};

export const logout = () => signOut(auth);

// Test connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      console.log('Firebase connection successful (permission denied as expected).');
    } else if (error?.code === 'unavailable') {
      console.warn('Firebase connection unavailable (could be offline or blocked by adblocker).');
    } else {
      console.error('Firebase connection error:', error);
    }
  }
}
testConnection();

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  return { user, loading };
}
