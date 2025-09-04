// src/stores/lieux.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  saveToFirestore,
  loadFromFirestore,
  deleteFromFirestore,
} from "@/firebase";

export interface Lieu {
  id: string;
  nom: string;
  description: string;
  lat: number;
  lng: number;
  dateEnregistrement: string; // Date du clic/enregistrement
  dateEvenement?: string; // Date optionnelle de l'événement
  createdAt: string;
}

// Type pour les données brutes de Firestore
interface FirestoreData {
  id: string;
  nom?: string;
  description?: string;
  lat?: number;
  lng?: number;
  dateEnregistrement?: string;
  dateEvenement?: string;
  createdAt?: string;
  [key: string]: any; // Pour toute propriété supplémentaire
}

export const useLieuxStore = defineStore("lieux", () => {
  // État
  const lieux = ref<Lieu[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Actions
  const loadLieux = async () => {
    loading.value = true;
    error.value = null;

    try {
      const data = (await loadFromFirestore()) as FirestoreData[];
      lieux.value = data.map((item: FirestoreData) => ({
        id: item.id,
        nom: item.nom || "",
        description: item.description || "",
        lat: item.lat || 0,
        lng: item.lng || 0,
        dateEnregistrement: item.dateEnregistrement || new Date().toISOString(),
        dateEvenement: item.dateEvenement || undefined,
        createdAt: item.createdAt || new Date().toISOString(),
      }));
      console.log(`${lieux.value.length} lieux chargés`);
    } catch (err: any) {
      error.value = err.message;
      console.error("Erreur chargement store:", err);
    } finally {
      loading.value = false;
    }
  };

  const addLieu = async (nouveLieu: Omit<Lieu, "id" | "createdAt">) => {
    loading.value = true;
    error.value = null;

    try {
      const lieuComplet: Omit<Lieu, "id"> = {
        ...nouveLieu,
        createdAt: new Date().toISOString(),
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
    updates: Partial<Omit<Lieu, "id" | "createdAt">>
  ) => {
    loading.value = true;
    error.value = null;

    try {
      const index = lieux.value.findIndex((lieu) => lieu.id === id);
      if (index === -1) {
        throw new Error("Lieu introuvable");
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
    loading.value = true;
    error.value = null;

    try {
      await deleteFromFirestore(id);
      const index = lieux.value.findIndex((lieu) => lieu.id === id);

      if (index !== -1) {
        lieux.value.splice(index, 1);
        console.log("Lieu supprimé:", id);
      }
      return true;
    } catch (err: any) {
      error.value = err.message;
      console.error("Erreur suppression lieu:", err);
      return false;
    } finally {
      loading.value = false;
    }
  };

  // Méthode pour effacer les erreurs
  const clearError = () => {
    error.value = null;
  };

  // Getters
  const getLieuById = (id: string): Lieu | undefined => {
    return lieux.value.find((lieu) => lieu.id === id);
  };

  const lieuxCount = computed(() => lieux.value.length);

  const lieuxParDate = computed(() => {
    return [...lieux.value].sort((a, b) => {
      const dateA = new Date(a.dateEnregistrement).getTime();
      const dateB = new Date(b.dateEnregistrement).getTime();
      return dateB - dateA; // Plus récent en premier
    });
  });

  // Retourner l'état et les actions
  return {
    // État
    lieux,
    loading,
    error,
    // Actions
    loadLieux,
    addLieu,
    updateLieu,
    deleteLieu,
    clearError,
    // Getters
    getLieuById,
    lieuxCount,
    lieuxParDate,
  };
});
