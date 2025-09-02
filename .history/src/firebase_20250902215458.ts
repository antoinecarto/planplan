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
export const db = getFirestore(app);

// Fonctions pour interagir avec Firestore
export const saveToFirestore = async (lieu: any) => {
  try {
    const docRef = await addDoc(collection(db, "lieux"), lieu);
    return docRef.id;
  } catch (error) {
    console.error("Erreur:", error);
    return false;
  }
};

export const loadFromFirestore = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "lieux"));
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Erreur lors du chargement:", error);
    return [];
  }
};

export const deleteFromFirestore = async (id: string) => {
  try {
    await deleteDoc(doc(db, "lieux", id));
    return true;
  } catch (error) {
    console.error("Erreur lors de la suppression:", error);
    return false;
  }
};
