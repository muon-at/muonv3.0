# Firestore TTL (Time To Live) Setup - Auto-Delete Chat Messages

## Overview

Chat messages automatically delete after **90 days** using Firestore's native TTL feature.

- **Auto-delete Date:** Each message stored with `deleteAt` timestamp (90 days from creation)
- **No Manual Cleanup Needed:** Firestore handles deletion automatically
- **No Cost:** TTL deletion is free (included in Firestore pricing)

---

## Setup Instructions

You need to enable TTL on the `deleteAt` field in two collections:

### Step 1: Enable TTL for Channel Messages

1. Go to **Firebase Console**: https://console.firebase.google.com/
2. Select project: **brukerstats-dashboard**
3. Go to **Firestore Database**
4. In left menu, click **Data > Databases**
5. Select the default database
6. In left menu, find **Indexes** (or search for "TTL")
7. Click **TTL** tab
8. Click **Create Policy**
9. Fill in:
   - **Collection:** `chat_channels`
   - **Field:** `messages.deleteAt` (or just create for the subcollection directly)
   - **Database:** Default
10. Click **Create**

### Step 2: Enable TTL for DM Messages

Repeat Step 1, but use:
- **Collection:** `chat_dms`
- **Field:** `messages.deleteAt`

---

## Alternative: Firestore UI Method

If you prefer the UI:

1. Go to **Firestore > Databases > brukerstats-dashboard**
2. In left sidebar, look for **Policies** or **Data Protection**
3. Find **TTL Policies**
4. Add policy for `chat_channels` collection field `deleteAt`
5. Add policy for `chat_dms` collection field `deleteAt`

---

## Verification

After enabling TTL:

1. Send a chat message
2. Open Firebase Console
3. View the document - you should see `deleteAt` field with a date ~90 days in future
4. After 90 days, Firestore automatically deletes the message

---

## FAQ

**Q: Will DM conversations be deleted?**
A: No, only the individual messages. The DM thread itself stays forever.

**Q: Can I change the 90-day window?**
A: Yes, edit `src/pages/Chat.tsx` and change `90 * 24 * 60 * 60 * 1000` to desired days.

**Q: What if I enable TTL but forget to deploy the code?**
A: Nothing happens - code needs to set `deleteAt` field for TTL to work. Code already includes it.

**Q: Is TTL retroactive?**
A: No, only new messages (after code deployment) will have `deleteAt`. Old messages stay forever.

---

## Important Notes

⚠️ **Firestore Console vs Firebase Console:** They're different!
- Use **Firebase Console** (console.firebase.google.com)
- NOT Firestore Console (firestore.googleapis.com)

⚠️ **Collection Path:** 
- `chat_channels/{channelId}/messages` (subcollection)
- `chat_dms/{dmId}/messages` (subcollection)

Some TTL interfaces may require full path or subcollection selection.

---

## When to Expect Deletions

Firestore typically deletes documents within **24 hours** of the TTL date.
- Not guaranteed to be exactly at the time
- Could be anywhere from TTL date to +24 hours

---

**Status:** ✅ Code ready. Just enable TTL policies and you're done!
