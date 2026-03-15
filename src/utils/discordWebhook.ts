import { Firestore, collection, addDoc } from 'firebase/firestore';

/**
 * Post record breaks to Allente Chat channel in Firestore
 */
export const postRecordToChat = async (db: Firestore, message: string): Promise<boolean> => {
  try {
    const channelId = 'project-allente'; // Allente Chat channel
    const messagesRef = collection(db, 'chat_channels', channelId, 'messages');

    await addDoc(messagesRef, {
      sender: 'SYSTEM', // System message
      content: message,
      timestamp: Date.now(),
      isSystemMessage: true, // Flag to identify system messages
    });

    console.log('✅ Record posted to Allente Chat');
    return true;
  } catch (err) {
    console.error('Error posting to Allente Chat:', err);
    return false;
  }
};

/**
 * Post record breaks to Discord (deprecated - use postRecordToChat instead)
 */
export const postRecordToDiscord = async (): Promise<boolean> => {
  console.warn('⚠️ Discord posting deprecated - use postRecordToChat instead');
  return true;
};
