import { db, auth, storage } from '../firebase';
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { signInWithEmailAndPassword, sendPasswordResetEmail, updatePassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, uploadBytes, uploadString, getDownloadURL } from 'firebase/storage';

export const firebaseService = {
  getServerTimestamp: () => serverTimestamp(),
  // Checklists
  subscribeToChecklists: (callback, onError) => {
    return onSnapshot(collection(db, 'checklists'), snapshot => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, onError);
  },
  createChecklist: async (data) => await addDoc(collection(db, 'checklists'), data),
  updateChecklist: async (id, data) => await updateDoc(doc(db, 'checklists', id), data),
  deleteChecklist: async (id) => await deleteDoc(doc(db, 'checklists', id)),
  
  // Filled Checklists
  subscribeToSubmissions: (callback, onError, limitCount = 500) => {
    const q = query(collection(db, 'filled_checklists'), orderBy('submittedAt', 'desc'), limit(limitCount));
    return onSnapshot(q, snapshot => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, onError);
  },
  subscribeToSubmissionsByChecklist: (checklistId, callback, onError, limitCount = 500) => {
    // Note: since we query by checklistId and order by submittedAt, this requires a composite index.
    // If not present, Firebase will log an error with a link to create it.
    // However, since we don't have a composite index, we can just fetch and filter client-side for now,
    // or we can remove the orderBy and let the client sort. We will fetch without orderBy to avoid index requirement.
    const q = query(collection(db, 'filled_checklists'), limit(limitCount));
    return onSnapshot(q, snapshot => {
      let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs = docs.filter(d => d.checklistId === checklistId);
      docs.sort((a, b) => (b.submittedAt?.toMillis?.() || 0) - (a.submittedAt?.toMillis?.() || 0));
      callback(docs);
    }, onError);
  },
  submitChecklist: async (data) => await addDoc(collection(db, 'filled_checklists'), data),
  getSubmission: async (id) => await getDoc(doc(db, 'filled_checklists', id)),
  updateSubmission: async (id, data) => await updateDoc(doc(db, 'filled_checklists', id), data),
  deleteSubmission: async (id) => await deleteDoc(doc(db, 'filled_checklists', id)),
  
  // Review Tokens
  subscribeToTokens: (callback, onError) => {
    const q = query(collection(db, 'review_tokens'), orderBy('createdAt', 'desc'), limit(500));
    return onSnapshot(q, snapshot => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, onError);
  },
  subscribeToTokensByChecklist: (checklistId, callback, onError) => {
    const q = query(collection(db, 'review_tokens'), limit(500));
    return onSnapshot(q, snapshot => {
      let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs = docs.filter(d => d.checklistId === checklistId);
      docs.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      callback(docs);
    }, onError);
  },
  getReviewToken: async (id) => await getDoc(doc(db, 'review_tokens', id)),
  updateReviewToken: async (id, data) => await updateDoc(doc(db, 'review_tokens', id), data),
  createReviewToken: async (data) => await addDoc(collection(db, 'review_tokens'), data),
  
  // Areas
  subscribeToAreas: (callback, onError) => {
    const q = query(collection(db, 'areas'), orderBy('name', 'asc'));
    return onSnapshot(q, snapshot => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, onError);
  },
  createArea: async (data) => await addDoc(collection(db, 'areas'), data),
  deleteArea: async (id) => await deleteDoc(doc(db, 'areas', id)),
  
  // Auth
  login: async (email, password) => await signInWithEmailAndPassword(auth, email, password),
  logout: async () => await signOut(auth),
  onAuthStateChanged: (callback) => onAuthStateChanged(auth, callback),
  resetPassword: async (email) => await sendPasswordResetEmail(auth, email),
  updateUserPassword: async (user, newPassword) => await updatePassword(user, newPassword),
  
  // Audit Logs
  logEvent: async (action, details, user = null) => {
    try {
      await addDoc(collection(db, 'audit_logs'), {
        action,
        details,
        user: user || (auth.currentUser ? auth.currentUser.email : 'Anonymous Technician'),
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error("Failed to log event:", e);
    }
  },
  subscribeToAuditLogs: (callback, onError) => {
    const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100));
    return onSnapshot(q, snapshot => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, onError);
  },

  // Utils — image upload helpers
  uploadImage: async (blob, path) => {

    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob, { contentType: blob.type || 'image/jpeg' });
    return await getDownloadURL(storageRef);
  },
  uploadImageBase64: async (dataUrl, path) => {
    const storageRef = ref(storage, path);
    await uploadString(storageRef, dataUrl, 'data_url');
    return await getDownloadURL(storageRef);
  },
};
