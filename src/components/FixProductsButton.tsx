import { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';

export function FixProductsButton() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const fixProducts = async () => {
    setLoading(true);
    try {
      const productsRef = collection(db, 'allente_products');
      const snap = await getDocs(productsRef);
      const batch = writeBatch(db);
      let count = 0;

      snap.forEach(docSnap => {
        const oldId = docSnap.id;
        const newId = oldId
          .replace(/måneder/g, 'mneder')
          .replace(/måned/g, 'mned');
        
        if (oldId !== newId) {
          batch.delete(doc(db, 'allente_products', oldId));
          batch.set(doc(db, 'allente_products', newId), docSnap.data());
          count++;
          console.log(`✅ ${count}: ${oldId} → ${newId}`);
        }
      });

      await batch.commit();
      console.log(`✅ FERDIG! ${count} produkter oppdatert`);
      setDone(true);
    } catch (err: any) {
      console.error('❌ Error:', err);
      alert('Error: ' + (err?.message || 'Unknown error'));
    }
    setLoading(false);
  };

  if (done) {
    return <div className="p-4 bg-green-900 text-green-100 rounded">✅ Produkter fikset!</div>;
  }

  return (
    <button
      onClick={fixProducts}
      disabled={loading}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
    >
      {loading ? 'Fikser...' : '🔧 FIX PRODUCTS (måneder → mneder)'}
    </button>
  );
}
