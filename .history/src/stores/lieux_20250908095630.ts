// src/stores/lieux.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  saveToFirestore,
  loadFromFirestore,
  deleteFromFirestore,
} from "@/firebase";
import { auth } from "@/firebase";
import { onAuthStateChanged } from "firebase/auth";

export interface Lieu {
  id: string;
  nom: string;
  description: string;
  lat: number;
  lng: number;
  dateEnregistrement: string;
  dateEvenement?: string;
  createdAt: string;
  userId: string; // ✅ Ajout du userId
  tags: string[];
}

interface FirestoreData {
  id: string;
  nom?: string;
  description?: string;
  lat?: number;
  lng?: number;
  dateEnregistrement?: string;
  dateEvenement?: string;
  createdAt?: string;
  userId?: string; // ✅ Ajout du userId
  [key: string]: any;
  tags: string[];
}

export const useLieuxStore = defineStore("lieux", () => {
  // État
  const lieux = ref<Lieu[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const currentUserId = ref<string | null>(null);

  // ✅ Observer l'état d'authentification
  const initAuth = () => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        currentUserId.value = user.uid;
        console.log("Utilisateur connecté:", user.uid);
        // Recharger les lieux pour le nouvel utilisateur
        loadLieux();
      } else {
        currentUserId.value = null;
        lieux.value = []; // Vider les lieux si déconnecté
        console.log("Utilisateur déconnecté");
      }
    });
  };

  // ✅ Actions modifiées
  const loadLieux = async () => {
    if (!currentUserId.value) {
      console.log("Pas d'utilisateur connecté");
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      // ✅ Charger seulement les lieux de l'utilisateur connecté
      const data = (await loadFromFirestore(
        currentUserId.value
      )) as FirestoreData[];

      lieux.value = data.map((item: FirestoreData) => ({
        id: item.id,
        nom: item.nom || "",
        description: item.description || "",
        lat: item.lat || 0,
        lng: item.lng || 0,
        dateEnregistrement: item.dateEnregistrement || new Date().toISOString(),
        dateEvenement: item.dateEvenement || undefined,
        createdAt: item.createdAt || new Date().toISOString(),
        userId: item.userId || currentUserId.value!, // ✅ S'assurer que userId existe
      }));

      console.log(
        `${lieux.value.length} lieux chargés pour l'utilisateur ${currentUserId.value}`
      );
    } catch (err: any) {
      error.value = err.message;
      console.error("Erreur chargement store:", err);
    } finally {
      loading.value = false;
    }
  };

  const addLieu = async (
    nouveLieu: Omit<Lieu, "id" | "createdAt" | "userId">
  ) => {
    if (!currentUserId.value) {
      error.value = "Utilisateur non connecté";
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const lieuComplet: Omit<Lieu, "id"> = {
        ...nouveLieu,
        createdAt: new Date().toISOString(),
        userId: currentUserId.value, // ✅ Ajouter l'userId
      };

      const id = (await saveToFirestore(lieuComplet)) as string;

      const lieuAvecId: Lieu = {
        ...lieuComplet,
        id,
      };

      lieux.value.push(lieuAvecId);
      console.log("Nouveau lieu ajouté:", lieuAvecId);
      return lieuAvecId;
    } catch (err: any) {
      error.value = err.message;
      console.error("Erreur ajout lieu:", err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateLieu = async (
    id: string,
    updates: Partial<Omit<Lieu, "id" | "createdAt" | "userId">>
  ) => {
    if (!currentUserId.value) {
      error.value = "Utilisateur non connecté";
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const index = lieux.value.findIndex((lieu) => lieu.id === id);
      if (index === -1) {
        throw new Error("Lieu introuvable");
      }

      // ✅ Vérifier que le lieu appartient à l'utilisateur
      if (lieux.value[index].userId !== currentUserId.value) {
        throw new Error("Non autorisé à modifier ce lieu");
      }

      const lieuMisAJour = { ...lieux.value[index], ...updates };
      await saveToFirestore(lieuMisAJour);

      lieux.value[index] = lieuMisAJour;
      console.log("Lieu mis à jour:", lieuMisAJour);
      return lieuMisAJour;
    } catch (err: any) {
      error.value = err.message;
      console.error("Erreur mise à jour lieu:", err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteLieu = async (id: string): Promise<boolean> => {
    if (!currentUserId.value) {
      error.value = "Utilisateur non connecté";
      return false;
    }

    loading.value = true;
    error.value = null;

    try {
      const index = lieux.value.findIndex((lieu) => lieu.id === id);

      if (index === -1) {
        throw new Error("Lieu introuvable");
      }

      // ✅ Vérifier que le lieu appartient à l'utilisateur
      if (lieux.value[index].userId !== currentUserId.value) {
        throw new Error("Non autorisé à supprimer ce lieu");
      }

      await deleteFromFirestore(id);
      lieux.value.splice(index, 1);
      console.log("Lieu supprimé:", id);
      return true;
    } catch (err: any) {
      error.value = err.message;
      console.error("Erreur suppression lieu:", err);
      return false;
    } finally {
      loading.value = false;
    }
  };

  const clearError = () => {
    error.value = null;
  };

  // ✅ Getters
  const getLieuById = (id: string): Lieu | undefined => {
    return lieux.value.find((lieu) => lieu.id === id);
  };

  const lieuxCount = computed(() => lieux.value.length);

  const lieuxParDate = computed(() => {
    return [...lieux.value].sort((a, b) => {
      const dateA = new Date(a.dateEnregistrement).getTime();
      const dateB = new Date(b.dateEnregistrement).getTime();
      return dateB - dateA;
    });
  });

  // ✅ Initialiser l'authentification au démarrage
  initAuth();

  return {
    // État
    lieux,
    loading,
    error,
    currentUserId,
    // Actions
    loadLieux,
    addLieu,
    updateLieu,
    deleteLieu,
    clearError,
    initAuth,
    // Getters
    getLieuById,
    lieuxCount,
    lieuxParDate,
  };
});
