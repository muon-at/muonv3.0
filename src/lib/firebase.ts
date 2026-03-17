import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
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


