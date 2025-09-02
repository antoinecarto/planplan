// src/stores/lieux.ts
import { defineStore } from "pinia";
import { ref } from "vue";
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

  const addLieu = async (lieuData: Omit<Lieu, "id" | "createdAt">) => {
    loading.value = true;
    error.value = null;

    try {
      const newLieu = {
        ...lieuData,
        createdAt: new Date().toISOString(),
      };

      const id = await saveToFirestore(newLieu);

      if (id) {
        const lieuAvecId = { ...newLieu, id: id as string };
        lieux.value.push(lieuAvecId);
        console.log("Lieu ajouté:", lieuAvecId.nom);
        return lieuAvecId;
      }
      throw new Error("Échec de sauvegarde");
    } catch (err: any) {
      error.value = err.message;
      console.error("Erreur ajout lieu:", err);
      return null;
    } finally {
      loading.value = false;
    }
  };

  const deleteLieu = async (id: string) => {
    loading.value = true;
    error.value = null;

    try {
      const success = await deleteFromFirestore(id);

      if (success) {
        const index = lieux.value.findIndex((lieu) => lieu.id === id);
        if (index > -1) {
          const nom = lieux.value[index].nom;
          lieux.value.splice(index, 1);
          console.log("Lieu supprimé:", nom);
        }
        return true;
      }
      throw new Error("Échec de suppression");
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

  // Getters
  const lieuxCount = computed(() => lieux.value.length);
  const lieuxParDate = computed(() => {
    return [...lieux.value].sort(
      (a, b) =>
        new Date(b.dateEnregistrement).getTime() -
        new Date(a.dateEnregistrement).getTime()
    );
  });

  return {
    // État
    lieux,
    loading,
    error,

    // Actions
    loadLieux,
    addLieu,
    deleteLieu,
    clearError,

    // Getters
    lieuxCount,
    lieuxParDate,
  };
});

import { computed } from "vue";
