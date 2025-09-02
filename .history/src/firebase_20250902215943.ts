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
    console.log("Tentative de sauvegarde:", lieu);
    const docRef = await addDoc(collection(db, "lieux"), lieu);
    console.log("Document sauvegardé avec ID:", docRef.id);
    return docRef.id;
  } catch (error: any) {
    console.error("Erreur détaillée:", error);

    if (error.code === "permission-denied") {
      alert(
        "Erreur de permissions Firestore. Vérifiez les règles de sécurité."
      );
    } else if (error.code === "unavailable") {
      alert(
        "Service Firestore temporairement indisponible. Réessayez plus tard."
      );
    } else {
      alert("Erreur lors de la sauvegarde: " + error.message);
    }
    return false;
  }
};

export const loadFromFirestore = async () => {
  try {
    console.log("Chargement des données...");
    const querySnapshot = await getDocs(collection(db, "lieux"));
    const data = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    console.log("Données chargées:", data);
    return data;
  } catch (error: any) {
    console.error("Erreur lors du chargement:", error);

    if (error.code === "permission-denied") {
      console.warn("Permissions insuffisantes, utilisation du mode hors-ligne");
      return [];
    } else {
      alert("Erreur lors du chargement: " + error.message);
      return [];
    }
  }
};

export const deleteFromFirestore = async (id: string) => {
  try {
    console.log("Suppression du document:", id);
    await deleteDoc(doc(db, "lieux", id));
    console.log("Document supprimé avec succès");
    return true;
  } catch (error: any) {
    console.error("Erreur lors de la suppression:", error);

    if (error.code === "permission-denied") {
      alert("Erreur de permissions pour la suppression.");
    } else {
      alert("Erreur lors de la suppression: " + error.message);
    }
    return false;
  }
};
