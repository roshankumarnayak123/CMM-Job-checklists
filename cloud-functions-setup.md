# Cloud Function Setup for Automatic Cleanup

This document outlines the code for setting up a Firebase Cloud Function to handle the automatic deletion of expired review links.

Currently, the application checks for expired tokens on the client-side, but it's best practice to automate this on the backend using Firebase Cloud Functions (or Google Cloud Run Functions).

## Instructions

1. Ensure you have the Firebase CLI installed: `npm install -g firebase-tools`
2. Initialize Cloud Functions in your project: `firebase init functions`
3. Choose **Node.js** or **TypeScript**.
4. Replace the contents of `functions/index.js` (or `functions/src/index.ts`) with the code below.
5. Deploy the function: `firebase deploy --only functions`

## Cloud Function Code (Node.js)

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

/**
 * Scheduled function that runs every hour to clean up expired share tokens.
 * This ensures that links that have passed their 1-hour validity window
 * are permanently removed from the database to enhance security.
 */
exports.cleanupExpiredTokens = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    
    console.log(`Starting cleanup of expired tokens at ${now.toDate().toISOString()}`);

    try {
        // Query for tokens where expiresAt is less than the current time
        const expiredTokensQuery = db.collection('pending_reviews')
            .where('expiresAt', '<', now)
            .where('status', '==', 'pending');

        const snapshot = await expiredTokensQuery.get();

        if (snapshot.empty) {
            console.log('No expired tokens found.');
            return null;
        }

        const batch = db.batch();
        let deletedCount = 0;

        snapshot.forEach((doc) => {
            // Update the status to expired, or completely delete the document
            // Option 1: Delete completely (More secure)
            batch.delete(doc.ref);
            
            // Option 2: Mark as expired (Keep for records)
            // batch.update(doc.ref, { status: 'expired' });
            
            deletedCount++;
        });

        await batch.commit();
        console.log(`Successfully deleted ${deletedCount} expired tokens.`);
        
        // Optional: Log this administrative action to your activity_logs collection
        await db.collection('activity_logs').add({
            action: 'System Cleanup',
            details: `Deleted ${deletedCount} expired share tokens.`,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            performedBy: 'System'
        });

        return null;
    } catch (error) {
        console.error('Error cleaning up expired tokens:', error);
        return null;
    }
});
```

## Considerations
* **Billing**: Using scheduled functions requires your Firebase project to be on the **Blaze (Pay as you go)** plan.
* **Cron syntax**: The `'every 1 hours'` syntax uses App Engine cron syntax. You can customize this (e.g., `'0 0 * * *'` for daily at midnight).
