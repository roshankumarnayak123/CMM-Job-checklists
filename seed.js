import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCpyNEWg7EHml2n-Y1wQE90ACN5ndQfCyY",
  authDomain: "cmm-job-checklists-app.firebaseapp.com",
  projectId: "cmm-job-checklists-app",
  storageBucket: "cmm-job-checklists-app.firebasestorage.app",
  messagingSenderId: "347998682073",
  appId: "1:347998682073:web:124c5b172707382488f7c8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const mockChecklists = [
  { title: 'Daily Maintenance', description: 'Routine checks for equipment.' },
  { title: 'Safety Inspection', description: 'Monthly safety protocol verification.' },
  { title: 'Pre-Flight Checklist', description: 'Mandatory checks before drone operation.' },
  { title: 'Server Audit', description: 'Quarterly server health and security audit.' },
  { title: 'Vehicle Handover', description: 'Inspection report for fleet vehicles.' },
];

async function seed() {
  console.log("Starting seeding...");
  
  // Login first to bypass default firestore rules
  // Replace these with the actual credentials you just created
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'admin321';
  
  try {
    await signInWithEmailAndPassword(auth, email, password);
    console.log("Logged in successfully.");
  } catch (error) {
    console.error("Failed to log in. Make sure your user exists in Authentication:", error.message);
    process.exit(1);
  }

  const colRef = collection(db, 'checklists');
  for (const item of mockChecklists) {
    await addDoc(colRef, item);
    console.log("Added", item.title);
  }
  console.log("Seeding complete.");
  process.exit(0);
}

seed();
