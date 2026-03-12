import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDJTDdfmF7L2j7HGJKzGVK4_5_jGZo8uMQ",
  authDomain: "brukerstats-dashboard.firebaseapp.com",
  projectId: "brukerstats-dashboard",
  storageBucket: "brukerstats-dashboard.appspot.com",
  messagingSenderId: "963395894435",
  appId: "1:963395894435:web:a7d5b2f5c8e0f1a2b3c4d5e6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Enable offline persistence for Firestore (caches data for offline use)
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled in one tab at a time
    console.warn('Firestore offline persistence: Multiple tabs detected');
  } else if (err.code === 'unimplemented') {
    // Browser doesn't support persistence
    console.warn('Firestore offline persistence: Not supported in this browser');
  }
});
