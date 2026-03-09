const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.updateAllProductProvisjon = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const db = admin.firestore();
  const products = [
    { name: '"Flex 2 with ads - 50,- rabatt i 6 måneder (6)"', prov: 600 },
    { name: '"Flex 2 without ads - 50,- rabatt i 6 måneder (6)"', prov: 600 },
    { name: '"Flex Basic - 50,- rabatt i 6 måneder (6)"', prov: 500 },
    { name: '"Basic - 4 frimåneder (12)"', prov: 500 },
    { name: '"Basic - 1 frimåned (12)"', prov: 500 },
    { name: '"Standard - 1 frimåned (12)"', prov: 800 },
    { name: '"Standard - 2 frimåneder (12)"', prov: 800 },
    { name: '"Standard - 4 frimåneder (12)"', prov: 800 },
    { name: '"Large - 100% Discount 1 month + 200 nok discount 11 months (12)"', prov: 1000 }
  ];

  let updated = 0;
  const batch = db.batch();

  for (const p of products) {
    const docRef = db.collection('allente_products').doc(p.name);
    batch.set(docRef, { provisjon: p.prov });
    updated++;
  }

  await batch.commit();
  return { success: true, updated, message: `Updated ${updated} products` };
});
