// src/firebase.ts
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB2X_SZWlQfeKtEhkQMOAM7g0qTqezJhmE",
  authDomain: "planplan-2335a.firebaseapp.com",
  projectId: "planplan-2335a",
  storageBucket: "planplan-2335a.firebasestorage.app",
  messagingSenderId: "1095808264337",
  appId: "1:1095808264337:web:a9eeca5352377f974b3730",
};

const app = initializeApp(firebaseConfig);

const saveToFirestore = async (lieu: any) => {
  try {
    const docRef = await addDoc(collection(db, "lieux"), lieu);
    return docRef.id;
  } catch (error) {
    console.error("Erreur:", error);
    return false;
  }
};

export const db = getFirestore(app);
