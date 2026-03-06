import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDJTDdfmF7L2j7HGJKzGVK4_5_jGZo8uMQ',
  authDomain: 'brukerstats-dashboard.firebaseapp.com',
  projectId: 'brukerstats-dashboard',
  storageBucket: 'brukerstats-dashboard.appspot.com',
  messagingSenderId: '969643127889',
  appId: '1:969643127889:web:cf6e5d1e3d0fb40e9532d8',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function renameChannel() {
  try {
    const channelsRef = collection(db, 'chat_channels');
    const snapshot = await getDocs(channelsRef);
    
    snapshot.forEach(async (docSnapshot) => {
      const data = docSnapshot.data();
      if (data.name === 'krs-team') {
        await updateDoc(doc(db, 'chat_channels', docSnapshot.id), {
          name: 'Teamledere',
        });
        console.log(`✅ Renamed "krs-team" to "Teamledere"`);
      }
    });
  } catch (err) {
    console.error('Error renaming channel:', err);
  }
}

renameChannel();
