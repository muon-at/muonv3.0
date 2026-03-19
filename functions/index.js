const admin = require('firebase-admin');
const webpush = require('web-push');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');

// Initialize Firebase Admin
admin.initializeApp();

// VAPID keys for Web Push (from environment variables)
const VAPID_PUBLIC = 'BBo0I4DuK1Sk-MExUGj7UrgE2y4HTgAGO6nisAQxJu4TFYUiPb1IEOwRk0ZYr4YmtEx_Ag256ogjznbuKLw9NtU';
const VAPID_PRIVATE = '3gHCHUteClu_hhlViIDfcU0zoowtupJR5d-15OhKDiU';

// Set VAPID details for web-push
webpush.setVapidDetails(
  'mailto:post@atventilasjon.no',
  VAPID_PUBLIC,
  VAPID_PRIVATE
);

/**
 * Cloud Function: Handle new chat message
 * 1. Increment channel unread count
 * 2. Send push notification to all users
 * Triggered by: Firestore write to chat_channels/{channelId}/messages/{messageId}
 */
exports.sendChatNotification = onDocumentCreated(
  'chat_channels/{channelId}/messages/{messageId}',
  async (event) => {
    try {
      const snap = event.data;
      const { channelId } = event.params;
      const message = snap.data();
      
      console.log(`📨 New message in ${channelId} from ${message.sender}`);

      // Step 1: Increment channel unread count
      await admin.firestore().collection('chat_channels').doc(channelId).update({
        unread: admin.firestore.FieldValue.increment(1),
        lastMessageTime: admin.firestore.Timestamp.now(),
      });
      console.log(`📈 Incremented unread count for ${channelId}`);

      // Step 2: Get channel info to find receivers
      const channelDoc = await admin.firestore().collection('chat_channels').doc(channelId).get();
      const channelData = channelDoc.data();
      
      if (!channelData) {
        console.log('❌ Channel not found:', channelId);
        return;
      }

      // Get all push subscriptions (all active users)
      const subscriptionsSnap = await admin.firestore().collection('push_subscriptions').get();
      
      if (subscriptionsSnap.empty) {
        console.log('⚠️ No push subscriptions found');
        return;
      }

      // Prepare notification payload
      const notificationPayload = {
        title: `New message from ${message.sender}`,
        body: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
        tag: `chat-${channelId}`,
        icon: '/manifest.json',
        badge: '/manifest.json',
      };

      // Send push to all subscribers (except sender)
      const sendPromises = [];
      subscriptionsSnap.forEach((doc) => {
        const userId = doc.id;
        const subscriptionData = doc.data();

        // Don't send to message sender
        if (userId === message.senderId) {
          return;
        }

        // Send push notification
        if (subscriptionData.subscription) {
          const promise = webpush
            .sendNotification(subscriptionData.subscription, JSON.stringify(notificationPayload))
            .then(() => {
              console.log(`✅ Push sent to ${userId}`);
            })
            .catch((error) => {
              if (error.statusCode === 410) {
                // Subscription expired - delete it
                console.log(`🗑️ Deleting expired subscription for ${userId}`);
                return admin.firestore().collection('push_subscriptions').doc(userId).delete();
              }
              console.error(`❌ Error sending push to ${userId}:`, error.message);
              return null;
            });

          sendPromises.push(promise);
        }
      });

      // Wait for all pushes to complete
      await Promise.all(sendPromises);
      console.log(`📨 Notifications sent for message in ${channelId}`);
      
    } catch (error) {
      console.error('❌ Error in sendChatNotification:', error);
      throw error;
    }
  });

/**
 * Helper: Convert user name to user.id by looking up in employees collection
 */
async function getUserIdByName(name) {
  try {
    console.log(`🔍 Looking up user.id for name: "${name}"`);
    
    // Try exact match on externalName first
    let employeesSnap = await admin.firestore().collection('employees').where('externalName', '==', name).limit(1).get();
    
    if (!employeesSnap.empty) {
      const employeeDoc = employeesSnap.docs[0];
      console.log(`✅ Found user.id via externalName: ${employeeDoc.id}`);
      return employeeDoc.id;
    }
    
    // If not found, try matching on 'name' field
    employeesSnap = await admin.firestore().collection('employees').where('name', '==', name).limit(1).get();
    
    if (!employeesSnap.empty) {
      const employeeDoc = employeesSnap.docs[0];
      console.log(`✅ Found user.id via name field: ${employeeDoc.id}`);
      return employeeDoc.id;
    }
    
    // If still not found, log all employee names for debugging
    const allEmployees = await admin.firestore().collection('employees').get();
    const allNames = allEmployees.docs.map(doc => {
      const data = doc.data();
      return `${data.externalName} (${doc.id})`;
    }).join(', ');
    console.log(`⚠️ Employee "${name}" not found. Available: [${allNames}]`);
    
    return null;
  } catch (error) {
    console.error(`❌ Error looking up user.id for ${name}:`, error);
    return null;
  }
}

/**
 * Cloud Function: Handle new DM message
 * 1. Increment DM unread count for receiver
 * 2. Send push notification
 * Triggered by: Firestore write to chat_dms/{dmId}/messages/{messageId}
 */
exports.sendDMNotification = onDocumentCreated(
  'chat_dms/{dmId}/messages/{messageId}',
  async (event) => {
    try {
      const snap = event.data;
      const { dmId } = event.params;
      const message = snap.data();

      console.log(`💬 New DM from ${message.sender}`);

      // Step 1: Get DM thread to find receiver
      const dmDoc = await admin.firestore().collection('chat_dms').doc(dmId).get();
      const dmData = dmDoc.data();

      if (!dmData || !dmData.participants) {
        console.log('❌ DM not found:', dmId);
        return;
      }

      // Find receiver (the other participant)
      const receiverName = dmData.participants.find((p) => p !== message.sender);
      if (!receiverName) {
        console.log('❌ Receiver not found in DM');
        return;
      }

      // Convert receiver name to user.id
      const receiverId = await getUserIdByName(receiverName);
      if (!receiverId) {
        console.log(`❌ Could not convert receiver name ${receiverName} to user.id`);
        return;
      }

      // Step 2: Increment DM unread count for receiver (use name as key in unread object)
      const unreadKey = `unread.${receiverName}`;
      await admin.firestore().collection('chat_dms').doc(dmId).update({
        [unreadKey]: admin.firestore.FieldValue.increment(1),
        lastMessageTime: admin.firestore.Timestamp.now(),
      });
      console.log(`📈 Incremented DM unread count for ${receiverName}`);

      // Get receiver's push subscription using user.id
      const subscriptionDoc = await admin.firestore().collection('push_subscriptions').doc(receiverId).get();
      
      if (!subscriptionDoc.exists) {
        console.log(`⚠️ No subscription found for ${receiverName} (user.id: ${receiverId})`);
        return;
      }

      const subscriptionData = subscriptionDoc.data();

      // Prepare notification payload
      const notificationPayload = {
        title: `Message from ${message.sender}`,
        body: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
        tag: `dm-${dmId}`,
        icon: '/manifest.json',
        badge: '/manifest.json',
      };

      // Send push notification
      await webpush.sendNotification(subscriptionData.subscription, JSON.stringify(notificationPayload));
      console.log(`✅ DM notification sent to ${receiverName} (user.id: ${receiverId})`);

    } catch (error) {
      if (error.statusCode === 410) {
        // Subscription expired - delete it
        console.log(`🗑️ Deleting expired subscription`);
        return;
      }
      console.error('❌ Error in sendDMNotification:', error);
      throw error;
    }
  });

/**
 * Cloud Function: Auto-detect emoji counts from Allente chat messages
 * Listens for new messages in chat_channels/allente-chat/messages
 * Counts 🔔, 💎, 🎁 emojis and updates emoji_counts_daily
 * Triggered by: New message in Allente chat (both mobile and PC)
 */
exports.countEmojiFromChat = onDocumentCreated(
  'chat_channels/allente-chat/messages/{messageId}',
  async (event) => {
    try {
      const snap = event.data;
      const message = snap.data();
      
      const senderName = message.sender || '';
      const messageContent = message.content || '';
      
      console.log(`🔔 New Allente message from ${senderName}`);
      
      // Count emojis in message
      const bellCount = (messageContent.match(/🔔/g) || []).length;
      const gemCount = (messageContent.match(/💎/g) || []).length;
      const giftCount = (messageContent.match(/🎁/g) || []).length;
      
      if (bellCount === 0 && gemCount === 0 && giftCount === 0) {
        console.log('⏭️ No emojis in message, skipping');
        return;
      }
      
      console.log(`📊 Found emojis: 🔔=${bellCount}, 💎=${gemCount}, 🎁=${giftCount}`);
      
      // Get today's date (local time, not UTC)
      const now = new Date();
      const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      console.log(`📅 Updating emoji_counts_daily for date: ${dateKey}`);
      
      // Update emoji_counts_daily/{dateKey}
      const emojiRef = admin.firestore().collection('emoji_counts_daily').doc(dateKey);
      const emojiDoc = await emojiRef.get();
      
      let updatedCounts = {};
      
      if (emojiDoc.exists()) {
        // Document exists - update counts
        const data = emojiDoc.data();
        updatedCounts = data.counts || {};
        
        if (!updatedCounts[senderName]) {
          updatedCounts[senderName] = { '🔔': 0, '💎': 0, '🎁': 0 };
        }
        
        updatedCounts[senderName]['🔔'] = (updatedCounts[senderName]['🔔'] || 0) + bellCount;
        updatedCounts[senderName]['💎'] = (updatedCounts[senderName]['💎'] || 0) + gemCount;
        updatedCounts[senderName]['🎁'] = (updatedCounts[senderName]['🎁'] || 0) + giftCount;
      } else {
        // Document doesn't exist - create it
        updatedCounts[senderName] = {
          '🔔': bellCount,
          '💎': gemCount,
          '🎁': giftCount
        };
      }
      
      // Write to Firestore
      await emojiRef.set({ counts: updatedCounts }, { merge: true });
      
      console.log(`✅ Updated emoji_counts_daily/${dateKey}:`, updatedCounts[senderName]);
      
    } catch (error) {
      console.error('❌ Error in countEmojiFromChat:', error);
      throw error;
    }
  });

/**
 * HTTP Function: Get VAPID public key (for frontend)
 */
exports.getVapidKey = onRequest((req, res) => {
  res.json({ vapidPublicKey: VAPID_PUBLIC });
});

// =====================================================
// MASTER EARNINGS COLLECTION - EARNINGS DATA PIPELINE
// =====================================================

/**
 * Daily scheduled function: Populate master_earnings collection
 * Runs at 03:00 daily (before 04:00 livefeed cleanup)
 * 
 * Populates master_earnings with:
 * - All contracts from allente_kontraktsarkiv
 * - Today's posts from livefeed_sales
 * - Provisjon rates from Admin Produkter
 * 
 * Structure:
 * {
 *   ansatt: string (employee name)
 *   produkt: string (product name)
 *   dato: string (DD/MM/YYYY)
 *   provisjon: number (from Admin Produkter)
 *   lønn: number | null (filled from livefeed posts for today)
 *   type: string ('contract' | 'post')
 *   contractId / postId: string
 *   createdAt: ISO string
 *   updatedAt: ISO string
 * }
 */
exports.populateMasterEarnings = onSchedule(
  {
    schedule: '0 3 * * *',
    timeZone: 'Europe/Oslo',
  },
  async (context) => {
    console.log('🔄 [03:00] Populating master_earnings collection...');

    try {
      const db = admin.firestore();
      
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

      let newContracts = 0;
      let existingContracts = 0;

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

        // Create unique ID for this earning event (sanitize to remove invalid chars)
        const sanitizedAnsatt = ansatt.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        const sanitizedDato = dato.replace(/\//g, '-');
        const earningId = `${sanitizedAnsatt}_${sanitizedDato}_${contractId.substring(0, 8)}`;

        // Check if already exists
        const earningDoc = await db.collection('master_earnings').doc(earningId).get();
        
        if (!earningDoc.exists) {
          // NEW contract entry
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
          newContracts++;
          console.log(`✅ Created: ${earningId} (${ansatt} | ${produktNavn} | ${provisjon}kr)`);
        } else {
          existingContracts++;
        }
      }

      // NOW: Process today's livefeed posts (for lønn in dag)
      const livefeedSnapshot = await db.collection('livefeed_sales').get();
      let newPosts = 0;
      
      for (const postDoc of livefeedSnapshot.docs) {
        const data = postDoc.data();
        const userName = data.userName || '';
        const product = (data.product || '').toLowerCase().trim();
        const timestamp = data.timestamp?.toDate?.() || new Date();
        const postDate = timestamp.toISOString().split('T')[0];

        const todayStr = today.toISOString().split('T')[0];

        if (postDate === todayStr && userName && product) {
          // Look up provisjon
          let provisjon = produktMap[product] || 1000;
          if (!produktMap[product]) {
            for (const [key, value] of Object.entries(produktMap)) {
              if (product.includes(key) || key.includes(product)) {
                provisjon = value;
                break;
              }
            }
          }

          // Get date in DD/MM/YYYY format
          const dateStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
          
          // Create ID for this post (sanitize to remove invalid chars)
          const sanitizedUser = userName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
          const sanitizedDate = dateStr.replace(/\//g, '-');
          const postId = `${sanitizedUser}_${sanitizedDate}_post_${postDoc.id.substring(0, 8)}`;

          // Check if already exists
          const earningDoc = await db.collection('master_earnings').doc(postId).get();
          
          if (!earningDoc.exists) {
            // NEW post entry
            await db.collection('master_earnings').doc(postId).set({
              ansatt: userName.trim(),
              produkt: product,
              dato: dateStr,
              provisjon: provisjon,
              lønn: provisjon,
              type: 'post',
              postId: postDoc.id,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            newPosts++;
            console.log(`✅ Posted: ${postId} (${userName} | ${product} | ${provisjon}kr)`);
          }
        }
      }

      console.log(`✅ Master earnings populated:
        - Contracts: ${newContracts} new, ${existingContracts} existing
        - Posts: ${newPosts} new
      `);

      return null;
    } catch (error) {
      console.error('❌ Error populating master_earnings:', error);
      throw error;
    }
  });

/**
 * HTTP Function: Manual trigger to populate master_earnings
 * POST https://us-central1-PROJECT.cloudfunctions.net/populateMasterEarningsNow
 */
exports.populateMasterEarningsNow = onRequest(async (req, res) => {
  console.log('🔄 Manual trigger: Populating master_earnings...');

  try {
    const db = admin.firestore();
    
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

      const sanitizedAnsatt = ansatt.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const sanitizedDato = dato.replace(/\//g, '-');
      const earningId = `${sanitizedAnsatt}_${sanitizedDato}_${contractId.substring(0, 8)}`;
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
      message: `Master earnings populated. ${newCount} new entries added.`,
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
