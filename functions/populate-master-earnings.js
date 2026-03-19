const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

/**
 * Triggered on:
 * 1. Contract upload (from allente_kontraktsarkiv write)
 * 2. Sales post (from livefeed_sales write)
 * 3. Daily job (04:00) to refresh today's earnings from posts
 * 
 * Purpose: Populate master_earnings collection with:
 * - Ansatt (employee name)
 * - Produkt (product name from contract)
 * - Dato (date from contract)
 * - Provisjon (from Admin Produkter lookup)
 * - Lønn (in NOK - null for contracts, filled from livefeed posts for today)
 * - Type (contract | post)
 * - Timestamp (for sorting)
 */

exports.populateMasterEarnings = functions.pubsub
  .schedule('0 3 * * *') // 03:00 daily (before 04:00 cleanup)
  .timeZone('Europe/Oslo')
  .onRun(async (context) => {
    console.log('🔄 Populating master_earnings collection...');

    try {
      // Load all products with provisjoner
      const produktSnapshot = await db.collection('allente_produkter').get();
      const produktMap = {};

      produktSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const produktNavn = (data.produkt || data.navn || '').toLowerCase().trim();
        const provisjon = parseInt(data.provisjon) || 1000;
        produktMap[produktNavn] = provisjon;
        console.log(`📦 Product: "${produktNavn}" => ${provisjon}kr`);
      });

      // Load all contracts
      const contractsSnapshot = await db.collection('allente_kontraktsarkiv').get();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let processedContracts = 0;
      let existingContracts = 0;
      let newContracts = 0;

      // For each contract, create/update master_earnings entry
      for (const contractDoc of contractsSnapshot.docs) {
        const data = contractDoc.data();
        const ansatt = data.selger || '';
        const produktNavn = (data.produkt || '').toLowerCase().trim();
        const dato = data.dato || '';
        const contractId = contractDoc.id;

        if (!ansatt || !dato) {
          console.log(`⚠️ Skipping contract ${contractId}: missing ansatt or dato`);
          continue;
        }

        // Look up provisjon
        let provisjon = produktMap[produktNavn] || 1000;
        if (!produktMap[produktNavn]) {
          // Try partial match
          for (const [key, value] of Object.entries(produktMap)) {
            if (produktNavn.includes(key) || key.includes(produktNavn)) {
              provisjon = value;
              console.log(`✅ Partial match: "${produktNavn}" => "${key}" = ${provisjon}kr`);
              break;
            }
          }
        }

        // Create unique ID for this earning event
        const earningId = `${ansatt.toLowerCase()}_${dato.replace(/\//g, '-')}_${contractId.substring(0, 8)}`;

        // Check if already exists
        const earningDoc = await db.collection('master_earnings').doc(earningId).get();
        
        if (!earningDoc.exists) {
          // NEW contract entry
          await db.collection('master_earnings').doc(earningId).set({
            ansatt: ansatt.trim(),
            produkt: produktNavn,
            dato: dato,
            provisjon: provisjon,
            lønn: null, // Will be filled from livefeed posts if today
            type: 'contract',
            contractId: contractId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          newContracts++;
          console.log(`✅ Created: ${earningId} (${ansatt} | ${produktNavn} | ${provisjon}kr)`);
        } else {
          // Contract already exists - update only if needed
          existingContracts++;
        }

        processedContracts++;
      }

      // NOW: Process today's livefeed posts (for lønn in dag)
      const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
      const livefeedSnapshot = await db.collection('livefeed_sales').get();

      let processedPosts = 0;
      
      for (const postDoc of livefeedSnapshot.docs) {
        const data = postDoc.data();
        const userName = data.userName || '';
        const product = (data.product || '').toLowerCase().trim();
        const timestamp = data.timestamp?.toDate?.() || new Date();
        const postDate = timestamp.toISOString().split('T')[0];

        if (postDate === todayStr && userName && product) {
          // Look up provisjon for today's post
          let provisjon = produktMap[product] || 1000;
          if (!produktMap[product]) {
            for (const [key, value] of Object.entries(produktMap)) {
              if (product.includes(key) || key.includes(product)) {
                provisjon = value;
                break;
              }
            }
          }

          // Get date in DD/MM/YYYY format for consistency
          const dateStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
          
          // Create ID for this post
          const postId = `${userName.toLowerCase()}_${dateStr.replace(/\//g, '-')}_post_${postDoc.id.substring(0, 8)}`;

          // Check if already exists
          const earningDoc = await db.collection('master_earnings').doc(postId).get();
          
          if (!earningDoc.exists) {
            // NEW post entry
            await db.collection('master_earnings').doc(postId).set({
              ansatt: userName.trim(),
              produkt: product,
              dato: dateStr,
              provisjon: provisjon,
              lønn: provisjon, // Today's post has lønn value
              type: 'post',
              postId: postDoc.id,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            processedPosts++;
            console.log(`✅ Posted earnings: ${postId} (${userName} | ${product} | ${provisjon}kr)`);
          }
        }
      }

      console.log(`✅ Master earnings populated:
        - Contracts processed: ${processedContracts} (${newContracts} new, ${existingContracts} existing)
        - Posts processed: ${processedPosts}
      `);

      return null;
    } catch (error) {
      console.error('❌ Error populating master_earnings:', error);
      throw error;
    }
  });

/**
 * Manual trigger function (call via HTTP or scheduler)
 * POST https://us-central1-YOUR_PROJECT.cloudfunctions.net/populateMasterEarningsNow
 */
exports.populateMasterEarningsNow = functions.https.onRequest(async (req, res) => {
  console.log('🔄 Manual trigger: Populating master_earnings...');

  try {
    // Load all products
    const produktSnapshot = await db.collection('allente_produkter').get();
    const produktMap = {};

    produktSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const produktNavn = (data.produkt || data.navn || '').toLowerCase().trim();
      const provisjon = parseInt(data.provisjon) || 1000;
      produktMap[produktNavn] = provisjon;
    });

    // Load all contracts
    const contractsSnapshot = await db.collection('allente_kontraktsarkiv').get();
    let newCount = 0;

    for (const contractDoc of contractsSnapshot.docs) {
      const data = contractDoc.data();
      const ansatt = data.selger || '';
      const produktNavn = (data.produkt || '').toLowerCase().trim();
      const dato = data.dato || '';
      const contractId = contractDoc.id;

      if (!ansatt || !dato) continue;

      let provisjon = produktMap[produktNavn] || 1000;
      if (!produktMap[produktNavn]) {
        for (const [key, value] of Object.entries(produktMap)) {
          if (produktNavn.includes(key) || key.includes(produktNavn)) {
            provisjon = value;
            break;
          }
        }
      }

      const earningId = `${ansatt.toLowerCase()}_${dato.replace(/\//g, '-')}_${contractId.substring(0, 8)}`;
      const earningDoc = await db.collection('master_earnings').doc(earningId).get();

      if (!earningDoc.exists) {
        await db.collection('master_earnings').doc(earningId).set({
          ansatt: ansatt.trim(),
          produkt: produktNavn,
          dato: dato,
          provisjon: provisjon,
          lønn: null,
          type: 'contract',
          contractId: contractId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        newCount++;
      }
    }

    res.json({ 
      success: true, 
      message: `Master earnings populated. ${newCount} new contracts added.`,
      kontrakterProcessert: contractsSnapshot.size,
      nyeEarnings: newCount,
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
