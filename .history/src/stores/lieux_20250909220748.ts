// src/stores/lieux.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  saveToFirestore,
  loadFromFirestore,
  deleteFromFirestore,
} from "@/firebase";
import { auth, db } from "@/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";

export interface Lieu {
  id: string;
  nom: string;
  description: string;
  lat: number;
  lng: number;
  dateEnregistrement: string;
  dateEvenement?: string;
  createdAt: string;
  userId: string;
  tags?: string[];
}

export interface Tag {
  id?: string;
  name: string;
  color: string;
  userId?: string;
  localOnly?: boolean;
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
  userId?: string;
  tags?: string[];
  [key: string]: any;
}

export const useLieuxStore = defineStore("lieux", () => {
  // État
  const lieux = ref<Lieu[]>([]);
  const tags = ref<Tag[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const currentUserId = ref<string | null>(null);

  // Constantes
  const TAGS_LOCAL_KEY = "lieux:tags_v1";

  // Observer l'état d'authentification
  const initAuth = () => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        currentUserId.value = user.uid;
        console.log("Utilisateur connecté:", user.uid);
        // Recharger les données pour le nouvel utilisateur
        loadAllData();
      } else {
        currentUserId.value = null;
        lieux.value = [];
        tags.value = [];
        console.log("Utilisateur déconnecté");
      }
    });
  };

  // Charger toutes les données (lieux + tags)
  const loadAllData = async () => {
    await Promise.all([loadLieux(), loadTags()]);
  };

  // === GESTION DES LIEUX ===
  const loadLieux = async () => {
    if (!currentUserId.value) {
      console.log("Pas d'utilisateur connecté");
      return;
    }

    loading.value = true;
    error.value = null;

    try {
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
        userId: item.userId || currentUserId.value!,
        tags: item.tags ?? [],
      }));

      console.log(
        `${lieux.value.length} lieux chargés pour l'utilisateur ${currentUserId.value}`
      );
    } catch (err: any) {
      error.value = err.message;
      console.error("Erreur chargement lieux:", err);
    } finally {
      loading.value = false;
    }
  };

  const addLieu = async (
    nouveLieu: Omit<Lieu, "id" | "createdAt" | "userId">
  ) => {
    if (!currentUserId.value) {
      error.value = "Utilisateur non connecté";
      return null;
    }

    loading.value = true;
    error.value = null;

    try {
      const lieuComplet: Omit<Lieu, "id"> = {
        ...nouveLieu,
        createdAt: new Date().toISOString(),
        userId: currentUserId.value,
      };

      // Vérifier si le lieu existe déjà
      const existe = lieux.value.some(
        (lieu) =>
          lieu.nom === lieuComplet.nom &&
          lieu.lat === lieuComplet.lat &&
          lieu.lng === lieuComplet.lng
      );

      if (existe) {
        console.warn("Lieu déjà existant, non ajouté :", lieuComplet);
        return null;
      }

      const id = (await saveToFirestore(lieuComplet)) as string;

      const lieuAvecId: Lieu = {
        ...lieuComplet,
        id,
      };

      // Mettre à jour le store local
      lieux.value.push(lieuAvecId);

      // Nettoyage des doublons
      lieux.value = Array.from(
        new Map(
          lieux.value.map((lieu) => [
            `${lieu.nom}-${lieu.lat}-${lieu.lng}`,
            lieu,
          ])
        ).values()
      );

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
      return null;
    }

    loading.value = true;
    error.value = null;

    try {
      const index = lieux.value.findIndex((lieu) => lieu.id === id);
      if (index === -1) {
        throw new Error("Lieu introuvable");
      }

      // Vérifier que le lieu appartient à l'utilisateur
      if (lieux.value[index].userId !== currentUserId.value) {
        throw new Error("Non autorisé à modifier ce lieu");
      }

      const lieuMisAJour = { ...lieux.value[index], ...updates };
      await saveToFirestore(lieuMisAJour, id);

      // Mettre à jour le store local
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

      // Vérifier que le lieu appartient à l'utilisateur
      if (lieux.value[index].userId !== currentUserId.value) {
        throw new Error("Non autorisé à supprimer ce lieu");
      }

      await deleteFromFirestore(id);

      // Mettre à jour le store local
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

  // === GESTION DES TAGS ===
  const loadTags = async () => {
    // Charger d'abord depuis localStorage (synchrone)
    loadTagsLocal();

    // Si utilisateur connecté, synchroniser avec Firestore
    if (currentUserId.value) {
      try {
        const q = query(
          collection(db, "tags"),
          where("userId", "==", currentUserId.value)
        );
        const snapshot = await getDocs(q);

        const firestoreTags: Tag[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as { name: string; color: string; userId: string }),
        }));

        // Fusionner avec les tags locaux
        const merged: Tag[] = [...firestoreTags];
        const namesFs = new Set(firestoreTags.map((t) => t.name));

        tags.value.forEach((localTag) => {
          if (!namesFs.has(localTag.name)) {
            merged.push({ ...localTag, localOnly: true });
          }
        });

        tags.value = merged;
        saveTagsLocal();
      } catch (err) {
        console.error(
          "Erreur lors du chargement des tags depuis Firestore:",
          err
        );
      }
    }
  };

  const loadTagsLocal = () => {
    const raw = localStorage.getItem(TAGS_LOCAL_KEY);
    if (raw) {
      try {
        tags.value = JSON.parse(raw) as Tag[];
      } catch (e) {
        console.error("Erreur parsing tags locaux:", e);
        tags.value = [];
        localStorage.removeItem(TAGS_LOCAL_KEY);
      }
    }
  };

  const saveTagsLocal = () => {
    try {
      localStorage.setItem(TAGS_LOCAL_KEY, JSON.stringify(tags.value));
    } catch (err) {
      console.error("Erreur sauvegarde tags localStorage:", err);
    }
  };

  const addTag = async (name: string, color: string): Promise<Tag | null> => {
    const nameTrim = name.trim();
    if (!nameTrim) return null;

    // Vérifier si le tag existe déjà
    if (tags.value.find((t) => t.name === nameTrim)) {
      return null;
    }

    // Créer le tag avec un id temporaire
    const tempId = `local_${Date.now()}`;
    const newTag: Tag = {
      id: tempId,
      name: nameTrim,
      color,
      localOnly: true,
    };

    // Ajout optimiste local
    tags.value.push(newTag);
    saveTagsLocal();

    // Si utilisateur connecté, tenter la sauvegarde sur Firestore
    if (currentUserId.value) {
      try {
        const docRef = await addDoc(collection(db, "tags"), {
          name: nameTrim,
          color,
          userId: currentUserId.value,
        });

        // Remplacer le tag temporaire par le tag Firestore
        const idx = tags.value.findIndex((t) => t.id === tempId);
        if (idx !== -1) {
          tags.value[idx] = {
            id: docRef.id,
            name: nameTrim,
            color,
            userId: currentUserId.value,
          };
          saveTagsLocal();
        }
      } catch (err) {
        console.warn(
          "Impossible d'enregistrer le tag sur Firestore - sauvegardé localement.",
          err
        );
      }
    }

    return newTag;
  };

  const deleteTag = async (tagName: string): Promise<boolean> => {
    const tagIndex = tags.value.findIndex((t) => t.name === tagName);
    if (tagIndex === -1) return false;

    const tag = tags.value[tagIndex];

    // Si le tag a un id Firestore, tenter la suppression côté serveur
    if (tag.id && !tag.id.startsWith("local_") && currentUserId.value) {
      try {
        await deleteDoc(doc(db, "tags", tag.id));
      } catch (err) {
        // Rechercher par nom si l'id ne fonctionne pas
        try {
          const q = query(
            collection(db, "tags"),
            where("name", "==", tagName),
            where("userId", "==", currentUserId.value)
          );
          const snapshot = await getDocs(q);

          if (!snapshot.empty) {
            await deleteDoc(doc(db, "tags", snapshot.docs[0].id));
          }
        } catch (err2) {
          console.warn(
            "Erreur suppression tag sur Firestore - suppression locale réalisée.",
            err2
          );
        }
      }
    }

    // Suppression locale
    tags.value.splice(tagIndex, 1);
    saveTagsLocal();

    // Nettoyer les tags des lieux existants
    lieux.value.forEach((lieu) => {
      if (lieu.tags?.includes(tagName)) {
        lieu.tags = lieu.tags.filter((t) => t !== tagName);
        // Mettre à jour sur Firestore si possible
        if (currentUserId.value) {
          updateLieu(lieu.id, { tags: lieu.tags }).catch(console.error);
        }
      }
    });

    console.log("Tag supprimé:", tagName);
    return true;
  };

  // === GETTERS ===
  const getLieuById = (id: string): Lieu | undefined => {
    return lieux.value.find((lieu) => lieu.id === id);
  };

  const getTagColor = (tagName: string): string => {
    const tag = tags.value.find((t) => t.name === tagName);
    return tag ? tag.color : "#6b7280";
  };

  const lieuxCount = computed(() => lieux.value.length);
  const tagsCount = computed(() => tags.value.length);

  const lieuxParDate = computed(() => {
    return [...lieux.value].sort((a, b) => {
      const dateA = new Date(a.dateEnregistrement).getTime();
      const dateB = new Date(b.dateEnregistrement).getTime();
      return dateB - dateA;
    });
  });

  const usedTags = computed(() => {
    const usedTagsSet = new Set<string>();
    lieux.value.forEach((lieu) => {
      if (lieu.tags) {
        lieu.tags.forEach((tag) => usedTagsSet.add(tag));
      }
    });
    return Array.from(usedTagsSet).sort();
  });

  // Utilitaires
  const clearError = () => {
    error.value = null;
  };

  // Initialiser l'authentification au démarrage
  initAuth();

  return {
    // État
    lieux,
    tags,
    loading,
    error,
    currentUserId,

    // Actions - Lieux
    loadLieux,
    addLieu,
    updateLieu,
    deleteLieu,

    // Actions - Tags
    loadTags,
    addTag,
    deleteTag,

    // Actions - Général
    loadAllData,
    clearError,
    initAuth,

    // Getters
    getLieuById,
    getTagColor,
    lieuxCount,
    tagsCount,
    lieuxParDate,
    usedTags,
  };
});
