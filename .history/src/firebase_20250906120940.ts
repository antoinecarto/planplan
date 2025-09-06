// src/firebase.ts
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB2X_SZWlQfeKtEhkQMOAM7g0qTqezJhmE",
  authDomain: "planplan-2335a.firebaseapp.com",
  projectId: "planplan-2335a",
  storageBucket: "planplan-2335a.firebasestorage.app",
  messagingSenderId: "1095808264337",
  appId: "1:1095808264337:web:a9eeca5352377f974b3730",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ✅ Fonction modifiée pour sauvegarder avec userId
export const saveToFirestore = async (lieu: any, docId?: string) => {
  try {
    console.log("Tentative de sauvegarde:", lieu);

    if (docId) {
      // Mise à jour d'un document existant
      await updateDoc(doc(db, "lieux", docId), lieu);
      console.log("Document mis à jour avec ID:", docId);
      return docId;
    } else {
      // Création d'un nouveau document
      const docRef = await addDoc(collection(db, "lieux"), lieu);
      console.log("Document sauvegardé avec ID:", docRef.id);
      return docRef.id;
    }
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
    throw error;
  }
};

// ✅ Fonction modifiée pour charger seulement les lieux de l'utilisateur connecté
export const loadFromFirestore = async (userId: string) => {
  try {
    console.log("Chargement des données pour utilisateur:", userId);

    // ✅ Requête filtrée par userId
    const q = query(collection(db, "lieux"), where("userId", "==", userId));

    const querySnapshot = await getDocs(q);
    const data = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(
      `${data.length} lieux chargés pour l'utilisateur ${userId}:`,
      data
    );
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

// ✅ Fonction de suppression inchangée (mais avec plus de sécurité côté store)
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
    throw error;
  }
};
