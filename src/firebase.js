import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCpyNEWg7EHml2n-Y1wQE90ACN5ndQfCyY",
  authDomain: "cmm-job-checklists-app.firebaseapp.com",
  projectId: "cmm-job-checklists-app",
  storageBucket: "cmm-job-checklists-app.firebasestorage.app",
  messagingSenderId: "347998682073",
  appId: "1:347998682073:web:124c5b172707382488f7c8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
