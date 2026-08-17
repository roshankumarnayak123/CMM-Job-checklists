import fs from 'fs';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc, deleteField } from "firebase/firestore";

// Basic .env parser
const env = fs.readFileSync('.env', 'utf-8').split('\n').reduce((acc, line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) acc[match[1].trim()] = match[2].trim();
  return acc;
}, {});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clean() {
  console.log("Cleaning filled_checklists...");
  const filledSnap = await getDocs(collection(db, 'filled_checklists'));
  let count = 0;
  for (const d of filledSnap.docs) {
    const data = d.data();
    let updates = {};
    if (data.signatures?.cmm?.signatureDataUrl) {
      updates['signatures.cmm.signatureDataUrl'] = deleteField();
    }
    if (data.signatures?.amm?.signatureDataUrl) {
      updates['signatures.amm.signatureDataUrl'] = deleteField();
    }
    if (Object.keys(updates).length > 0) {
      await updateDoc(doc(db, 'filled_checklists', d.id), updates);
      count++;
    }
  }
  console.log(`Cleaned ${count} filled_checklists documents.`);

  console.log("Cleaning review_tokens...");
  const tokensSnap = await getDocs(collection(db, 'review_tokens'));
  let tCount = 0;
  for (const d of tokensSnap.docs) {
    const data = d.data();
    let updates = {};
    if (data.cmmSignature?.signatureDataUrl) {
      updates['cmmSignature.signatureDataUrl'] = deleteField();
    }
    if (data.ammSignature?.signatureDataUrl) {
      updates['ammSignature.signatureDataUrl'] = deleteField();
    }
    if (Object.keys(updates).length > 0) {
      await updateDoc(doc(db, 'review_tokens', d.id), updates);
      tCount++;
    }
  }
  console.log(`Cleaned ${tCount} review_tokens documents.`);
  process.exit(0);
}

clean().catch(err => {
  console.error(err);
  process.exit(1);
});
