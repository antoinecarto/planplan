// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB2X_SZWlQfeKtEhkQMOAM7g0qTqezJhmE",
  authDomain: "planplan-2335a.firebaseapp.com",
  projectId: "planplan-2335a",
  storageBucket: "planplan-2335a.firebasestorage.app",
  messagingSenderId: "1095808264337",
  appId: "1:1095808264337:web:a9eeca5352377f974b3730",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
