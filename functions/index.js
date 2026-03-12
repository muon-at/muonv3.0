const functions = require('firebase-functions');
const admin = require('firebase-admin');
const webpush = require('web-push');

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
exports.sendChatNotification = functions.firestore
  .document('chat_channels/{channelId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    try {
      const message = snap.data();
      const { channelId } = context.params;
      
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
 * Cloud Function: Handle new DM message
 * 1. Increment DM unread count for receiver
 * 2. Send push notification
 * Triggered by: Firestore write to chat_dms/{dmId}/messages/{messageId}
 */
exports.sendDMNotification = functions.firestore
  .document('chat_dms/{dmId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    try {
      const message = snap.data();
      const { dmId } = context.params;

      console.log(`💬 New DM from ${message.sender}`);

      // Step 1: Get DM thread to find receiver
      const dmDoc = await admin.firestore().collection('chat_dms').doc(dmId).get();
      const dmData = dmDoc.data();

      if (!dmData || !dmData.participants) {
        console.log('❌ DM not found:', dmId);
        return;
      }

      // Find receiver (the other participant)
      const receiver = dmData.participants.find((p) => p !== message.sender);
      if (!receiver) {
        console.log('❌ Receiver not found in DM');
        return;
      }

      // Step 2: Increment DM unread count for receiver
      const unreadKey = `unread.${receiver}`;
      await admin.firestore().collection('chat_dms').doc(dmId).update({
        [unreadKey]: admin.firestore.FieldValue.increment(1),
        lastMessageTime: admin.firestore.Timestamp.now(),
      });
      console.log(`📈 Incremented DM unread count for ${receiver}`);

      // Get receiver's push subscription
      const subscriptionDoc = await admin.firestore().collection('push_subscriptions').doc(receiver).get();
      
      if (!subscriptionDoc.exists) {
        console.log(`⚠️ No subscription found for ${receiver}`);
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
      console.log(`✅ DM notification sent to ${receiver}`);

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
 * HTTP Function: Get VAPID public key (for frontend)
 */
exports.getVapidKey = functions.https.onRequest((req, res) => {
  res.json({ vapidPublicKey: VAPID_PUBLIC });
});
