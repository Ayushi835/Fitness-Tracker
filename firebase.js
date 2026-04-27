
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


const firebaseConfig = {
apiKey: "AIzaSyAlA1c10-_q6HFLveVXCVbsI8roeHxlAro",
  authDomain: "fittrack-750f5.firebaseapp.com",
  projectId: "fittrack-750f5",
  storageBucket: "fittrack-750f5.firebasestorage.app",
  messagingSenderId: "279603786258",
  appId: "1:279603786258:web:d8eabb441a6feaadbf5ecb"
};


const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);