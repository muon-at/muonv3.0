/**
 * Post record breaks to Discord Allente channel
 * Uses environment variable VITE_DISCORD_WEBHOOK_URL
 */

export const postRecordToDiscord = async (message: string): Promise<boolean> => {
  try {
    const webhookUrl = import.meta.env.VITE_DISCORD_WEBHOOK_URL;
    
    if (!webhookUrl) {
      console.warn('⚠️ Discord webhook URL not configured');
      return false;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: message,
        allowed_mentions: { parse: [] }, // Don't ping anyone
      }),
    });

    if (!response.ok) {
      console.error('Discord webhook error:', response.status, response.statusText);
      return false;
    }

    console.log('✅ Record posted to Discord');
    return true;
  } catch (err) {
    console.error('Error posting to Discord:', err);
    return false;
  }
};
