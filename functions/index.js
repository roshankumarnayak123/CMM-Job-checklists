const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

/**
 * Scheduled Cloud Function that runs every hour to clean up expired review tokens.
 */
exports.cleanupExpiredTokens = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
  const now = admin.firestore.Timestamp.now();
  const tokensRef = db.collection('review_tokens');
  
  // Find tokens that are still pending but past their expiration time
  const snapshot = await tokensRef
    .where('status', '==', 'pending_review')
    .where('expiresAt', '<', now)
    .get();
    
  if (snapshot.empty) {
    console.log('No expired tokens to clean up.');
    return null;
  }
  
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, { status: 'expired' });
  });
  
  await batch.commit();
  console.log(`Cleaned up ${snapshot.size} expired tokens.`);
  return null;
});

/**
 * Triggered when a review token is marked as completed.
 * It copies the completed document to filled_checklists.
 */
exports.onReviewCompleted = functions.firestore.document('review_tokens/{tokenId}')
  .onUpdate(async (change, context) => {
    const newValue = change.after.data();
    const previousValue = change.before.data();
    
    if (previousValue.status === 'pending_review' && newValue.status === 'completed') {
      const payload = {
        checklistId: newValue.checklistId,
        checklistTitle: newValue.checklistTitle,
        fillerName: newValue.fillerName,
        notes: newValue.notes,
        uniqueCode: newValue.uniqueCode,
        checkpointResponses: newValue.checkpointResponses,
        signatures: {
          cmm: newValue.cmmSignature,
          amm: newValue.ammSignature
        },
        submittedAt: newValue.completedAt, // Use the completion time
        reviewMode: 'remote'
      };
      
      // Save to filled_checklists
      await db.collection('filled_checklists').add(payload);
      console.log(`Saved completed checklist ${newValue.uniqueCode} to filled_checklists.`);
    }
  });
