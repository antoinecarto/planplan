// HomeView.vue - Script
<script setup lang="ts">
import { onMounted, ref, nextTick, computed, watch } from "vue";
import L from "leaflet";
import "leaflet-control-geocoder/dist/Control.Geocoder.css";
import { useLieuxStore } from "@/stores/lieux";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useRouter } from "vue-router";

const router = useRouter();
const lieuxStore = useLieuxStore();

// Variables réactives
const map = ref<any>(null);
const currentView = ref<"carte" | "liste">("carte");
const searchQuery = ref("");
const selectedTagFilter = ref<string>("");
const showForm = ref(false);
const isEditMode = ref(false);
const editingLieuId = ref<string | null>(null);
const showTagManager = ref(false);
const newTagName = ref("");
const newTagColor = ref("#3b82f6");
const isLocating = ref(false);
const sortOrder = ref<"asc" | "desc">("desc");

// Données du formulaire
const formData = ref({
  nom: "",
  description: "",
  lat: 0,
  lng: 0,
  dateEvenement: "",
  tags: [] as string[],
});

let tempMarker: any = null;
let userLocationMarker: any = null;

// Déconnexion
const logout = async () => {
  try {
    await signOut(auth);
    router.push("/");
  } catch (err: any) {
    console.error("Erreur lors de la déconnexion :", err.message);
  }
};

// Utilitaires de formatage
const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const formatDateTime = (dateString: string) =>
  new Date(dateString).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// Propriétés calculées
const lieuxFiltres = computed(() => {
  let lieux = [...lieuxStore.lieux];

  // Filtre par tag
  if (selectedTagFilter.value) {
    lieux = lieux.filter((lieu) =>
      lieu.tags?.includes(selectedTagFilter.value)
    );
  }

  // Filtre par recherche
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    lieux = lieux.filter(
      (lieu) =>
        lieu.nom.toLowerCase().includes(q) ||
        (lieu.description?.toLowerCase().includes(q) ?? false)
    );
  }

  // Tri par date
  lieux.sort((a, b) => {
    const dateA = new Date(a.dateEnregistrement).getTime();
    const dateB = new Date(b.dateEnregistrement).getTime();
    return sortOrder.value === "desc" ? dateB - dateA : dateA - dateB;
  });

  return lieux;
});

// Gestion des tags
const addNewTag = async () => {
  const result = await lieuxStore.addTag(
    newTagName.value.trim(),
    newTagColor.value
  );
  if (result) {
    newTagName.value = "";
    newTagColor.value = "#3b82f6";
  }
};

const removeTag = async (tagName: string) => {
  if (!confirm(`Supprimer le tag "${tagName}" ?`)) return;
  await lieuxStore.deleteTag(tagName);
};

const toggleTagInForm = (tagName: string) => {
  const index = formData.value.tags.indexOf(tagName);
  if (index > -1) {
    formData.value.tags.splice(index, 1);
  } else {
    formData.value.tags.push(tagName);
  }
};

// Initialisation de la carte
const initMap = async () => {
  if (currentView.value !== "carte") return;
  await nextTick();

  if (map.value) {
    map.value.off();
    map.value.remove();
    map.value = null;
  }

  setTimeout(async () => {
    try {
      map.value = L.map("map").setView([48.8566, 2.3522], 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map.value);

      // Import dynamique du geocoder
      const LControlGeocoderModule = await import("leaflet-control-geocoder");
      const LControlGeocoder =
        LControlGeocoderModule.default || LControlGeocoderModule;

      const geocoderControl = (L.Control as any)
        .geocoder({
          geocoder: LControlGeocoder.nominatim(),
          defaultMarkGeocode: false,
        })
        .on("markgeocode", (e: any) => {
          const bbox = e.geocode.bbox;
          const poly = L.polygon([
            bbox.getSouthEast(),
            bbox.getNorthEast(),
            bbox.getNorthWest(),
            bbox.getSouthWest(),
          ]).addTo(map.value);

          map.value.fitBounds(poly.getBounds());
          setTimeout(() => map.value.removeLayer(poly), 3000);
        })
        .addTo(map.value);

      // Ajouter les marqueurs existants
      lieuxStore.lieux.forEach(addExistingMarker);

      // Écouter les clics sur la carte
      map.value.on("click", onMapClick);

      console.log("Carte initialisée avec geocoder dynamique");
    } catch (err) {
      console.error("Erreur init map:", err);
    }
  }, 150);
};

// Configuration des icônes
const customIcon = L.icon({
  iconUrl: "pin.svg",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Ajouter un marqueur existant
const addExistingMarker = (lieu: any) => {
  if (!map.value) return;
  const marker = L.marker([lieu.lat, lieu.lng], { icon: customIcon });

  const tagsHtml =
    lieu.tags && lieu.tags.length > 0
      ? `<div style="margin-bottom:8px;">${lieu.tags
          .map(
            (tag: string) =>
              `<span style="background:${lieuxStore.getTagColor(
                tag
              )};color:white;padding:2px 6px;border-radius:12px;font-size:10px;margin-right:4px;display:inline-block;">${tag}</span>`
          )
          .join("")}</div>`
      : "";

  const popupContent = `
    <div style="min-width:250px;font-family:system-ui;">
      <h3 style="margin-bottom:8px;color:#1f2937;font-size:16px;">${
        lieu.nom
      }</h3>
      ${tagsHtml}
      <p style="margin-bottom:8px;color:#6b7280;font-size:13px;line-height:1.4;">${
        lieu.description || ""
      }</p>
      <div style="font-size:11px;color:#9ca3af;margin-bottom:10px;">
        <div>📅 Enregistré: ${formatDateTime(lieu.dateEnregistrement)}</div>
        ${
          lieu.dateEvenement
            ? `<div>🗓️ Événement: ${formatDate(lieu.dateEvenement)}</div>`
            : ""
        }
      </div>
      <div style="display:flex;gap:8px;">
        <button onclick="window.editMarkerFromMap('${
          lieu.id
        }')" style="flex:1;background:#3b82f6;color:white;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:11px;">✏️ Modifier</button>
        <button onclick="window.deleteMarkerFromMap('${
          lieu.id
        }')" style="flex:1;background:#ef4444;color:white;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:11px;">🗑️ Supprimer</button>
      </div>
    </div>
  `;
  marker.bindPopup(popupContent).addTo(map.value);
};

// Gestion des clics sur la carte
const onMapClick = (e: any) => {
  if (showForm.value) return;

  const { lat, lng } = e.latlng;

  if (tempMarker) {
    map.value.removeLayer(tempMarker);
  }

  tempMarker = L.marker([lat, lng]).addTo(map.value);

  const maintenant = new Date();
  formData.value = {
    nom: "",
    description: "",
    lat: lat,
    lng: lng,
    dateEvenement: maintenant.toISOString().split("T")[0],
    tags: [],
  };
  isEditMode.value = false;
  editingLieuId.value = null;
  showForm.value = true;
};

// Géolocalisation
const centerOnUserLocation = () => {
  if (!navigator.geolocation) {
    alert("La géolocalisation n'est pas supportée par votre navigateur");
    return;
  }

  isLocating.value = true;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;

      if (map.value) {
        map.value.setView([latitude, longitude], 16);

        if (userLocationMarker) {
          map.value.removeLayer(userLocationMarker);
        }

        const userIcon = L.divIcon({
          html: '<div style="background: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>',
          className: "user-location-marker",
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        userLocationMarker = L.marker([latitude, longitude], { icon: userIcon })
          .addTo(map.value)
          .bindPopup("📍 Votre position actuelle");
      }

      isLocating.value = false;
    },
    (error) => {
      console.error("Erreur de géolocalisation:", error);
      let message = "Impossible d'obtenir votre position";

      switch (error.code) {
        case error.PERMISSION_DENIED:
          message =
            "Géolocalisation refusée. Veuillez autoriser l'accès à votre position.";
          break;
        case error.POSITION_UNAVAILABLE:
          message = "Position non disponible";
          break;
        case error.TIMEOUT:
          message = "Délai d'attente dépassé pour la géolocalisation";
          break;
      }

      alert(message);
      isLocating.value = false;
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    }
  );
};

// Sauvegarde du marqueur
const saveNewMarker = async () => {
  if (!formData.value.nom.trim()) {
    alert("Le nom est obligatoire");
    return;
  }

  if (isEditMode.value && editingLieuId.value) {
    const updates = {
      nom: formData.value.nom.trim(),
      description: formData.value.description.trim(),
      lat: formData.value.lat,
      lng: formData.value.lng,
      dateEvenement: formData.value.dateEvenement || undefined,
      tags: formData.value.tags,
    };

    const result = await lieuxStore.updateLieu(editingLieuId.value, updates);

    if (result) {
      refreshMapMarkers();
      showForm.value = false;
      resetForm();
      console.log("Lieu modifié avec succès!");
    }
  } else {
    const nouveauLieu = {
      nom: formData.value.nom.trim(),
      description: formData.value.description.trim(),
      lat: formData.value.lat,
      lng: formData.value.lng,
      dateEnregistrement: new Date().toISOString(),
      dateEvenement: formData.value.dateEvenement || undefined,
      tags: formData.value.tags,
    };

    const result = await lieuxStore.addLieu(nouveauLieu);

    if (result) {
      if (tempMarker) {
        map.value.removeLayer(tempMarker);
        tempMarker = null;
      }

      addExistingMarker(result);
      showForm.value = false;
      resetForm();
      console.log("Lieu ajouté avec succès!");
    }
  }
};

const cancelNewMarker = () => {
  if (tempMarker) {
    map.value.removeLayer(tempMarker);
    tempMarker = null;
  }
  showForm.value = false;
  resetForm();
};

const resetForm = () => {
  formData.value = {
    nom: "",
    description: "",
    lat: 0,
    lng: 0,
    dateEvenement: "",
    tags: [],
  };
  isEditMode.value = false;
  editingLieuId.value = null;
};

const refreshMapMarkers = () => {
  if (map.value) {
    map.value.eachLayer((layer: any) => {
      if (layer instanceof L.Marker && layer !== userLocationMarker) {
        map.value.removeLayer(layer);
      }
    });

    lieuxStore.lieux.forEach((lieu) => {
      addExistingMarker(lieu);
    });
  }
};

// Fonctions globales pour les popups
(window as any).editMarkerFromMap = async (id: string) => {
  const lieu = lieuxStore.getLieuById(id);
  if (!lieu) return;

  formData.value = {
    nom: lieu.nom,
    description: lieu.description || "",
    lat: lieu.lat,
    lng: lieu.lng,
    dateEvenement: lieu.dateEvenement || "",
    tags: lieu.tags || [],
  };

  isEditMode.value = true;
  editingLieuId.value = id;
  showForm.value = true;

  if (tempMarker) {
    map.value.removeLayer(tempMarker);
  }
  tempMarker = L.marker([lieu.lat, lieu.lng], { icon: customIcon }).addTo(
    map.value
  );
};

(window as any).deleteMarkerFromMap = async (id: string) => {
  if (confirm("Êtes-vous sûr de vouloir supprimer ce lieu ?")) {
    const success = await lieuxStore.deleteLieu(id);
    if (success) {
      refreshMapMarkers();
    }
  }
};

// Navigation entre vues
const switchToMap = () => {
  currentView.value = "carte";
  showForm.value = false;
  lieuxStore.clearError();
  setTimeout(() => {
    initMap();
  }, 50);
};

const switchToList = () => {
  currentView.value = "liste";
  showForm.value = false;
  lieuxStore.clearError();
  if (map.value) {
    map.value.off();
    map.value.remove();
    map.value = null;
  }
};

// Navigation depuis la liste vers la carte
const goToLieuOnMap = (lieu: any) => {
  currentView.value = "carte";

  setTimeout(async () => {
    await initMap();
    setTimeout(() => {
      if (map.value) {
        map.value.setView([lieu.lat, lieu.lng], 16);

        map.value.eachLayer((layer: any) => {
          if (layer instanceof L.Marker) {
            const latLng = layer.getLatLng();
            if (
              Math.abs(latLng.lat - lieu.lat) < 0.00001 &&
              Math.abs(latLng.lng - lieu.lng) < 0.00001
            ) {
              layer.openPopup();
            }
          }
        });
      }
    }, 200);
  }, 100);
};

// Fonctions pour la liste
const editLieuFromList = (lieu: any) => {
  console.log("Édition du lieu:", lieu); // Debug

  // S'assurer que tous les champs sont correctement copiés
  formData.value = {
    nom: lieu.nom || "",
    description: lieu.description || "",
    lat: lieu.lat || 0,
    lng: lieu.lng || 0,
    dateEvenement: lieu.dateEvenement || "",
    tags: Array.isArray(lieu.tags) ? [...lieu.tags] : [],
  };

  // Activer le mode édition
  isEditMode.value = true;
  editingLieuId.value = lieu.id;

  // Basculer vers la vue carte ET afficher le formulaire
  currentView.value = "carte";

  // Utiliser nextTick pour s'assurer que la vue carte est rendue
  nextTick(() => {
    showForm.value = true;

    // Optionnel : centrer la carte sur le lieu à éditer
    if (map.value && lieu.lat && lieu.lng) {
      map.value.setView([lieu.lat, lieu.lng], 16);
    }
  });
};

const deleteLieuFromList = async (id: string) => {
  if (confirm("Êtes-vous sûr de vouloir supprimer ce lieu ?")) {
    await lieuxStore.deleteLieu(id);
  }
};

// Utilitaires de filtrage et tri
const clearSearch = () => {
  searchQuery.value = "";
};

const clearTagFilter = () => {
  selectedTagFilter.value = "";
};

const toggleSortOrder = () => {
  sortOrder.value = sortOrder.value === "desc" ? "asc" : "desc";
};

// Initialisation
onMounted(async () => {
  await lieuxStore.loadAllData();
  initMap();
});
</script>

<template>
  <div class="app-container darkMode">
    <header class="header">
      <button
        @click="logout"
        class="w-full bg-slate-600 text-white py-3 font-semibold hover:brightness-110 transition-all shadow-md"
      >
        Se déconnecter
      </button>
    </header>

    <!-- Message d'erreur global -->
    <div v-if="lieuxStore.error" class="error-banner">
      ⚠️ {{ lieuxStore.error }}
      <button @click="lieuxStore.clearError()" class="error-close">×</button>
    </div>

    <!-- Contenu principal -->
    <main class="main-content">
      <!-- Vue Carte -->
      <div v-if="currentView === 'carte'" class="carte-view">
        <div id="map" class="map-container"></div>

        <!-- Bouton de géolocalisation -->
        <button
          @click="centerOnUserLocation"
          :disabled="isLocating"
          class="location-btn"
          title="Centrer sur ma position"
        >
          <span v-if="isLocating">⏳</span>
          <span v-else>🎯</span>
        </button>

        <!-- Indicateur de chargement -->
        <div v-if="lieuxStore.loading" class="loading-overlay">
          <div class="loading-spinner">⏳ Chargement...</div>
        </div>

        <!-- Formulaire flottant avec tags -->
        <div v-if="showForm" class="form-overlay">
          <div class="form-modal">
            <h3>
              {{ isEditMode ? "✏️ Modifier le lieu" : "📍 Nouveau lieu" }}
            </h3>

            <div class="form-group">
              <label class="form-label">Nom du lieu *</label>
              <input
                v-model="formData.nom"
                type="text"
                placeholder="Ex: Restaurant, Monument..."
                class="form-input"
                maxlength="100"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea
                v-model="formData.description"
                placeholder="Détails, notes personnelles..."
                class="form-textarea"
                maxlength="500"
              ></textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Tags</label>
              <div class="tags-selector">
                <div
                  v-for="tag in lieuxStore.tags"
                  :key="tag.name"
                  @click="toggleTagInForm(tag.name)"
                  :class="[
                    'tag-option',
                    { selected: formData.tags.includes(tag.name) },
                  ]"
                  :style="{
                    backgroundColor: formData.tags.includes(tag.name)
                      ? tag.color
                      : '#f3f4f6',
                  }"
                >
                  {{ tag.name }}
                </div>
              </div>
              <!-- ✅ Bouton discret -->
              <button
                @click="showTagManager = true"
                type="button"
                class="tag-button"
              >
                ➕ Ajouter/Gérer les tags
              </button>
            </div>

            <div class="form-group">
              <label class="form-label">Date de l'événement (optionnel)</label>
              <input
                v-model="formData.dateEvenement"
                type="date"
                class="form-input"
              />
              <small class="form-hint"
                >Laissez vide si pas d'événement spécifique</small
              >
            </div>

            <div class="form-info">
              📍 Position: {{ formData.lat.toFixed(4) }},
              {{ formData.lng.toFixed(4) }}
            </div>

            <div class="form-actions">
              <button
                @click="saveNewMarker"
                class="save-btn"
                :disabled="lieuxStore.loading || !formData.nom.trim()"
              >
                {{
                  lieuxStore.loading
                    ? "⏳ Sauvegarde..."
                    : isEditMode
                    ? "💾 Modifier"
                    : "💾 Sauvegarder"
                }}
              </button>
              <button
                @click="cancelNewMarker"
                class="cancel-btn"
                :disabled="lieuxStore.loading"
              >
                ❌ Annuler
              </button>
            </div>
          </div>
        </div>

        <!-- Gestionnaire de tags -->
        <div v-if="showTagManager" class="form-overlay">
          <div class="form-modal">
            <h3>🏷️ Gestion des tags</h3>

            <div class="form-group">
              <label class="form-label">Tags existants</label>
              <div class="existing-tags">
                <div
                  v-for="(tag, index) in lieuxStore.tags"
                  :key="tag.name"
                  class="existing-tag"
                  :style="{ backgroundColor: tag.color }"
                >
                  {{ tag.name }}
                  <button @click="removeTag(tag.name)" class="tag-remove-btn">
                    ×
                  </button>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Ajouter un nouveau tag</label>
              <div class="new-tag-form">
                <input
                  v-model="newTagName"
                  type="text"
                  placeholder="Nom du tag"
                  class="form-input"
                  maxlength="20"
                />
                <input v-model="newTagColor" type="color" class="color-input" />
                <button
                  @click="addNewTag"
                  class="add-tag-btn"
                  :disabled="!newTagName.trim()"
                >
                  ➕
                </button>
              </div>
            </div>

            <div class="form-actions">
              <button @click="showTagManager = false" class="save-btn">
                ✅ Terminé
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Vue Liste avec filtre par tag -->
      <div v-else class="liste-container">
        <div class="liste-header">
          <h1 class="titre">Mes lieux</h1>
          <div class="stats-and-sort">
            <div class="stats">
              {{ lieuxFiltres.length }} / {{ lieuxStore.lieuxCount }} lieu{{
                lieuxStore.lieuxCount > 1 ? "x" : ""
              }}
            </div>
            <button
              @click="toggleSortOrder"
              class="sort-btn"
              title="Changer l'ordre de tri"
            >
              📅
              {{
                sortOrder === "desc" ? "↓ Récent → Ancien" : "↑ Ancien → Récent"
              }}
            </button>
          </div>

          <!-- Filtre par tag -->
          <div v-if="lieuxStore.usedTags.length > 0" class="tag-filter">
            <div class="tag-filter-header">
              <span class="filter-label">Filtrer par tag :</span>
              <button
                v-if="selectedTagFilter"
                @click="clearTagFilter"
                class="clear-filter-btn"
                title="Effacer le filtre"
              >
                ❌ Effacer
              </button>
            </div>
            <div class="tag-filter-options">
              <button
                v-for="tag in lieuxStore.usedTags"
                :key="tag"
                @click="
                  selectedTagFilter = selectedTagFilter === tag ? '' : tag
                "
                :class="[
                  'tag-filter-btn',
                  { active: selectedTagFilter === tag },
                ]"
                :style="{
                  backgroundColor:
                    selectedTagFilter === tag
                      ? lieuxStore.getTagColor(tag)
                      : '#f3f4f6',
                  color: selectedTagFilter === tag ? 'white' : '#374151',
                }"
              >
                {{ tag }}
              </button>
            </div>
          </div>

          <!-- Barre de recherche -->
          <div class="search-container">
            <div class="search-input-container">
              <span class="search-icon">🔍</span>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Rechercher un lieu ou un tag..."
                class="search-input"
              />
              <button
                v-if="searchQuery"
                @click="clearSearch"
                class="search-clear"
                title="Effacer la recherche"
              >
                ❌
              </button>
            </div>
          </div>
        </div>

        <div v-if="lieuxStore.loading" class="loading-center">
          <div class="loading-spinner">⏳ Chargement...</div>
        </div>

        <div v-else-if="lieuxStore.lieux.length === 0" class="empty-state">
          <div class="empty-icon">📍</div>
          <h3>Aucun lieu enregistré</h3>
          <p>
            Cliquez sur "Carte" et tapez sur la carte pour ajouter des lieux
          </p>
        </div>

        <div v-else-if="lieuxFiltres.length === 0" class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3>Aucun résultat</h3>
          <p v-if="searchQuery && selectedTagFilter">
            Aucun lieu ne correspond à votre recherche "{{ searchQuery }}" avec
            le tag "{{ selectedTagFilter }}"
          </p>
          <p v-else-if="searchQuery">
            Aucun lieu ne correspond à votre recherche "{{ searchQuery }}"
          </p>
          <p v-else-if="selectedTagFilter">
            Aucun lieu avec le tag "{{ selectedTagFilter }}"
          </p>
          <div class="empty-actions">
            <button
              v-if="searchQuery"
              @click="clearSearch"
              class="clear-search-btn"
            >
              Effacer la recherche
            </button>
            <button
              v-if="selectedTagFilter"
              @click="clearTagFilter"
              class="clear-search-btn"
            >
              Effacer le filtre
            </button>
          </div>
        </div>

        <div v-else class="lieux-list">
          <div class="lieu-item" v-for="lieu in lieuxFiltres" :key="lieu.id">
            <div class="lieu-header">
              <h3
                class="lieu-nom dark:text-white"
                @click.stop="goToLieuOnMap(lieu)"
              >
                {{ lieu.nom }}
              </h3>
              <div class="lieu-actions">
                <button
                  @click.stop="editLieuFromList(lieu)"
                  class="edit-btn-list"
                  :disabled="lieuxStore.loading"
                  title="Modifier ce lieu"
                >
                  ✏️
                </button>
                <button
                  @click.stop="deleteLieuFromList(lieu.id)"
                  class="delete-btn-list"
                  :disabled="lieuxStore.loading"
                  title="Supprimer ce lieu"
                >
                  🗑️
                </button>
              </div>
            </div>

            <!-- Tags du lieu -->
            <div
              v-if="lieu.tags && lieu.tags.length > 0"
              class="lieu-tags"
              @click.stop="goToLieuOnMap(lieu)"
            >
              <span
                v-for="tag in lieu.tags"
                :key="tag"
                class="lieu-tag"
                :style="{ backgroundColor: lieuxStore.getTagColor(tag) }"
              >
                {{ tag }}
              </span>
            </div>

            <p
              v-if="lieu.description"
              class="lieu-description"
              @click.stop="goToLieuOnMap(lieu)"
            >
              {{ lieu.description }}
            </p>

            <div class="lieu-meta" @click.stop="goToLieuOnMap(lieu)">
              <div class="meta-item">
                📍 {{ lieu.lat.toFixed(4) }}, {{ lieu.lng.toFixed(4) }}
              </div>
              <div class="meta-item">
                📅 Enregistré: {{ formatDateTime(lieu.dateEnregistrement) }}
              </div>
              <div v-if="lieu.dateEvenement" class="meta-item event-date">
                🗓️ Événement: {{ formatDate(lieu.dateEvenement) }}
              </div>
            </div>

            <!-- Indicateur visuel que l'élément est cliquable -->
            <div class="lieu-click-indicator" @click.stop="goToLieuOnMap(lieu)">
              <span class="click-text">👆 Cliquer pour voir sur la carte</span>
              <span class="click-arrow">🗺️</span>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer Navigation -->
    <footer class="footer">
      <button
        @click="switchToMap"
        :class="['nav-button', currentView === 'carte' ? 'active' : '']"
      >
        <span class="nav-text">Carte</span>
      </button>
      <button
        @click="switchToList"
        :class="['nav-button', currentView === 'liste' ? 'active' : '']"
      >
        <span class="nav-text">Liste</span>
      </button>
    </footer>
  </div>
</template>

<style>
@import "leaflet/dist/leaflet.css";
@import "leaflet-control-geocoder/dist/Control.Geocoder.css";

/* Reset et layout principal */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  height: 100%;
  overflow: hidden;
  margin: 0;
  padding: 0;
}

#app {
  padding: 0 !important;
  margin: 0 !important;
}

.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  position: relative;
  margin: 0;
  padding: 0;
}
.logout {
  background-color: #e56977;
}

/* Banner d'erreur */
.error-banner {
  background-color: #fee2e2;
  color: #e56977;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #fecaca;
  font-size: 14px;
}

.error-close {
  background: none;
  border: none;
  color: #e56977;
  font-size: 18px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
}

/* Supprimer tous les logos Vue */
img[src*="vue"],
img[alt*="Vue"],
[class*="logo"] {
  display: none !important;
}

.main-content {
  flex: 1;
  overflow: hidden;
  margin-bottom: 70px;
  position: relative;
}

.carte-view {
  height: 100%;
  position: relative;
}

/* Carte sans marges */
.map-container {
  height: 100%;
  width: 100vw;
  margin: 0;
  padding: 0;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

#map {
  height: 100% !important;
  width: 100% !important;
  margin: 0;
  padding: 0;
}

/* Styles pour le contrôle de géocodage */
.leaflet-control-geocoder {
  background: white !important;
  border-radius: 6px !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
}

.leaflet-control-geocoder-form input {
  border: 1px solid #d1d5db !important;
  border-radius: 4px !important;
  padding: 8px 12px !important;
  font-size: 14px !important;
}

/* Bouton de géolocalisation */
.location-btn {
  position: absolute;
  bottom: 20px;
  right: 20px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #e56977;
  color: white;
  border: none;
  font-size: 20px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  transition: all 0.3s ease;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.location-btn:hover:not(:disabled) {
  background: #e56977;
  transform: scale(1.1);
}

.location-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.location-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  animation: pulse 1.5s infinite;
}

/* Bouton de gestion des tags */
.tag-manager-btn {
  position: absolute;
  bottom: 80px;
  right: 20px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #8b5cf6;
  color: white;
  border: none;
  font-size: 20px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
  transition: all 0.3s ease;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tag-manager-btn:hover {
  background: #7c3aed;
  transform: scale(1.1);
}

.tag-manager-btn:active {
  transform: scale(0.95);
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}

/* Overlay de chargement */
.loading-overlay {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.95);
  padding: 10px 16px;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.loading-center {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.loading-spinner {
  font-size: 16px;
  color: #6b7280;
}

/* Styles pour les tags */
.tags-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 120px;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background-color: #fff;
}

.tag-option {
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
  user-select: none;
}

.tag-option:not(.selected) {
  color: #374151;
  border-color: #d1d5db;
}

.tag-option.selected {
  color: white;
  transform: scale(1.05);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.tag-option:hover {
  transform: scale(1.05);
}

/* Gestionnaire de tags */
.existing-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  max-height: 120px;
  overflow-y: auto;
}

.existing-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 16px;
  color: white;
  font-size: 12px;
  font-weight: 500;
}

.tag-remove-btn {
  background: rgba(255, 255, 255, 0.3);
  border: none;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 10px;
  color: white;
  transition: background-color 0.2s;
}

.tag-remove-btn:hover {
  background: rgba(255, 255, 255, 0.5);
}

.new-tag-form {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 8px;
}

.color-input {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  outline: none;
}

.add-tag-btn {
  background: #10b981;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.2s;
}

.add-tag-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.add-tag-btn:not(:disabled):hover {
  background: #059669;
}

/* Tags dans la liste */
.lieu-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
  cursor: pointer;
}

.lieu-tag {
  padding: 2px 8px;
  border-radius: 12px;
  color: white;
  font-size: 11px;
  font-weight: 500;
  display: inline-block;
}
.tag-button {
  text-decoration: none; /* Enlève le soulignement */
  display: inline-block; /* Pour appliquer padding et bordure */
  padding: 10px 20px; /* Ajuste la taille du bouton */
  background-color: #4caf50; /* Couleur de fond du bouton */
  color: white; /* Couleur du texte */
  border: 2px solid #4caf50; /* Bordure du même ton que le fond */
  border-radius: 5px; /* Coins arrondis */
  font-weight: bold; /* Texte en gras */
  cursor: pointer; /* Curseur main au survol */
  transition: background-color 0.3s, color 0.3s; /* Animation hover */
}

.tag-button:hover {
  background-color: white; /* Inverse les couleurs au survol */
  color: #4caf50;
}
/* Filtre par tag */
.tag-filter {
  margin: 16px 0;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.tag-filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.filter-label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.clear-filter-btn {
  background: #6b7280;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  transition: background-color 0.2s;
}

.clear-filter-btn:hover {
  background: #4b5563;
}

.tag-filter-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-filter-btn {
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #d1d5db;
  background: #f3f4f6;
}

.tag-filter-btn:hover {
  transform: scale(1.05);
}

.tag-filter-btn.active {
  transform: scale(1.05);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  border-color: transparent;
}

/* Formulaire flottant amélioré */
.form-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}

.form-modal {
  background: white;
  border-radius: 12px;
  padding: 24px;
  min-width: 320px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.form-modal h3 {
  margin-bottom: 20px;
  color: #1f2937;
  font-size: 18px;
  text-align: center;
  font-weight: 600;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  margin-bottom: 6px;
  color: #374151;
  font-size: 14px;
  font-weight: 500;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 16px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}

.form-input:focus,
.form-textarea:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
  height: 80px;
  resize: vertical;
}

.form-hint {
  display: block;
  margin-top: 4px;
  color: #6b7280;
  font-size: 12px;
}

.form-info {
  background: #f3f4f6;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 16px;
  font-family: monospace;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.tag-link-btn {
  margin-top: 6px;
  background: none;
  border: none;
  color: #2563eb; /* bleu style lien */
  cursor: pointer;
  font-size: 0.9rem;
  text-decoration: underline;
  padding: 0;
}

.tag-link-btn:hover {
  color: #1d4ed8; /* bleu plus foncé */
}

.save-btn,
.cancel-btn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.save-btn {
  background-color: #10b981;
  color: white;
}

.save-btn:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

.save-btn:not(:disabled):active {
  background-color: #059669;
  transform: scale(0.98);
}

.cancel-btn {
  background-color: #6b7280;
  color: white;
}

.cancel-btn:not(:disabled):active {
  background-color: #4b5563;
  transform: scale(0.98);
}

/* Styles pour la liste */
.liste-container {
  height: 100%;
  overflow-y: auto;
  padding: 0;
  background-color: #f8f9fa;
}

.liste-header {
  background: white;
  padding: 20px 16px;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 10;
}

.titre {
  font-size: 24px;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 4px;
}

.stats-and-sort {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.stats {
  color: #6b7280;
  font-size: 14px;
}

.sort-btn {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.sort-btn:hover {
  background: #e5e7eb;
}

/* Barre de recherche */
.search-container {
  margin-top: 16px;
}

.search-input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: #6b7280;
  font-size: 16px;
  z-index: 1;
}

.search-input {
  width: 100%;
  padding: 12px 16px 12px 40px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  background: #f9fafb;
}

.search-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  background: white;
}

.search-clear {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  color: #6b7280;
  font-size: 14px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.search-clear:hover {
  background-color: #f3f4f6;
}

.empty-state {
  text-align: center;
  color: #6b7280;
  margin-top: 80px;
  padding: 0 20px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h3 {
  margin-bottom: 8px;
  color: #374151;
}

.empty-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  margin-top: 16px;
}

.clear-search-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.clear-search-btn:hover {
  background: #2563eb;
}

.lieux-list {
  padding: 16px;
}

.lieu-item {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #f3f4f6;
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
}

.lieu-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
  border-color: #3b82f6;
}

.lieu-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.lieu-nom {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
  flex: 1;
  line-height: 1.4;
  cursor: pointer;
  transition: color 0.2s;
}

.lieu-nom:hover {
  color: #3b82f6;
}

.lieu-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.logout-button {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 3001; /* Plus élevé que .form-overlay */
  padding: 10px 16px;
  border-radius: 8px;
  font-weight: bold;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.edit-btn-list,
.delete-btn-list {
  border: none;
  padding: 8px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 10;
}

.edit-btn-list {
  background-color: #3b82f6;
  color: white;
}

.edit-btn-list:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

.edit-btn-list:not(:disabled):hover {
  background-color: #2563eb;
}

.edit-btn-list:not(:disabled):active {
  background-color: #1d4ed8;
  transform: scale(0.95);
}

.lieu-description {
  color: #6b7280;
  margin-bottom: 12px;
  line-height: 1.5;
  font-size: 14px;
  overflow-y: auto;
  cursor: pointer;
}

.lieu-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
}

.meta-item {
  font-size: 12px;
  color: #9ca3af;
  display: flex;
  align-items: center;
  gap: 4px;
}

.lieu-click-indicator {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid #f3f4f6;
  opacity: 0.7;
  font-size: 11px;
  color: #6b7280;
  transition: opacity 0.2s;
}

.lieu-item:hover .lieu-click-indicator {
  opacity: 1;
}

.click-text {
  font-style: italic;
}

.click-arrow {
  font-size: 14px;
}
.darkMode {
  background-color: #f5f5f5 !important;
  color: black !important;
}

.delete-btn-list {
  background-color: #e56977;
  color: white;
  border: none;
  padding: 8px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}

.delete-btn-list:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

.delete-btn-list:not(:disabled):hover {
  background-color: #e56977;
}

.delete-btn-list:not(:disabled):active {
  background-color: #e56977;
  transform: scale(0.95);
}

/* Footer Navigation */
.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background-color: #ffffff;
  border-top: 1px solid #e5e7eb;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  height: 70px;
  min-height: 70px;
}

.nav-button {
  flex: 1;
  border: none;
  background-color: #ffffff;
  color: #6b7280;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 70px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.nav-button:active {
  background-color: #f3f4f6;
  transform: scale(0.98);
}

.nav-button.active {
  background-color: #e56977;
  color: white;
}

.nav-button.active:active {
  background-color: #e56977;
}

.nav-icon {
  font-size: 22px;
  line-height: 1;
}

.nav-text {
  font-size: 13px;
  font-weight: 600;
}

/* Styles pour le marqueur de position utilisateur */
.user-location-marker {
  background: transparent !important;
  border: none !important;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .form-modal {
    min-width: 300px;
    padding: 20px;
    max-height: 85vh;
  }

  .liste-header {
    padding: 16px 12px;
  }

  .lieux-list {
    padding: 12px;
  }

  .lieu-item {
    padding: 14px;
    margin-bottom: 10px;
  }

  .lieu-nom {
    font-size: 16px;
  }

  .location-btn {
    bottom: 90px;
    right: 16px;
    width: 45px;
    height: 45px;
    font-size: 18px;
  }

  .tag-manager-btn {
    bottom: 140px;
    right: 12px;
    width: 42px;
    height: 42px;
    font-size: 16px;
  }

  .lieu-click-indicator {
    font-size: 10px;
  }

  .click-arrow {
    font-size: 12px;
  }

  .tags-selector {
    gap: 6px;
  }

  .tag-option {
    padding: 4px 8px;
    font-size: 11px;
  }

  .lieu-tags {
    gap: 3px;
    margin-bottom: 6px;
  }

  .lieu-tag {
    font-size: 10px;
    padding: 2px 6px;
  }

  .new-tag-form {
    flex-direction: column;
    gap: 8px;
  }

  .color-input {
    width: 100%;
    height: 40px;
  }

  .stats-and-sort {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }

  .sort-btn {
    font-size: 11px;
    padding: 4px 8px;
  }
}

/* Support pour les écrans encore plus petits */
@media (max-width: 360px) {
  .form-modal {
    min-width: 260px;
    padding: 12px;
  }

  .location-btn,
  .tag-manager-btn {
    width: 38px;
    height: 38px;
    font-size: 14px;
  }

  .tag-manager-btn {
    bottom: 130px;
  }

  .location-btn {
    bottom: 80px;
  }

  .tag-filter {
    padding: 8px;
  }

  .tag-filter-btn {
    padding: 3px 6px;
    font-size: 10px;
  }

  .lieu-item {
    padding: 12px;
  }

  .lieu-nom {
    font-size: 15px;
  }

  .meta-item {
    font-size: 10px;
  }
}

/* Améliorations pour l'accessibilité */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Mode sombre (si supporté) */
@media (prefers-color-scheme: dark) {
  .darkMode {
    background-color: #1f2937;
    color: #f9fafb;
  }

  .liste-container {
    background-color: #111827;
  }

  .liste-header {
    background: #1f2937;
    border-bottom-color: #374151;
  }

  .lieu-item {
    background: #1f2937;
    border-color: #374151;
  }

  .lieu-item:hover {
    border-color: #3b82f6;
  }

  .search-input {
    background: #374151;
    border-color: #4b5563;
    color: #f9fafb;
  }

  .search-input:focus {
    background: #374151;
  }

  .form-modal {
    background: #1f2937;
    color: #f9fafb;
  }

  .form-input,
  .form-textarea {
    background: #374151;
    border-color: #4b5563;
    color: #f9fafb;
  }

  .form-info {
    background: #374151;
    color: #9ca3af;
  }

  .tag-filter {
    background: #374151;
    border-color: #4b5563;
  }

  .tag-filter-btn {
    background: #4b5563;
    border-color: #6b7280;
    color: #f9fafb;
  }
}

/* Animation pour les tags */
@keyframes tagPop {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}

.tag-option.selected {
  animation: tagPop 0.3s ease;
}

/* Effet hover amélioré pour les lieux */
.lieu-item {
  position: relative;
  overflow: hidden;
}

.lieu-item::before {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(59, 130, 246, 0.1),
    transparent
  );
  transition: left 0.5s ease;
}

.lieu-item:hover::before {
  left: 100%;
}

/* Styles pour les messages de feedback */
.success-message {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #10b981;
  color: white;
  padding: 12px 16px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  z-index: 3000;
  animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes fadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

/* Focus améliore pour les éléments interactifs */
.tag-option:focus,
.tag-filter-btn:focus,
.nav-button:focus,
.location-btn:focus,
.tag-manager-btn:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Amélioration des transitions */
.lieu-item,
.tag-option,
.tag-filter-btn,
.nav-button {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Optimisation des performances pour les listes longues */
.lieux-list {
  contain: layout style paint;
}

.lieu-item {
  contain: layout style paint;
  will-change: transform, box-shadow;
}

/* Support pour les écrans très larges */
@media (min-width: 1200px) {
  .form-modal {
    min-width: 400px;
    max-width: 500px;
  }

  .lieux-list {
    padding: 20px;
    max-width: 800px;
    margin: 0 auto;
  }

  .liste-header {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  }
}
.tag-manager-btn {
  bottom: 145px;
  right: 16px;
  width: 45px;
  height: 45px;
  font-size: 18px;
}

.search-input {
  font-size: 16px; /* Évite le zoom sur iOS */
}

.tag-filter {
  padding: 12px;
}

.tag-filter-options {
  gap: 4px;
}

.tag-filter-btn {
  padding: 4px 8px;
  font-size: 11px;
}

/* Support pour les très petits écrans */
@media (max-width: 480px) {
  .form-modal {
    min-width: 280px;
    padding: 16px;
  }

  .form-input,
  .form-textarea {
    font-size: 16px; /* Évite le zoom sur iOS */
  }

  .lieu-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .lieu-actions {
    align-self: flex-end;
  }

  .delete-btn-list,
  .edit-btn-list {
    width: 32px;
    height: 32px;
    font-size: 12px;
  }

  .meta-item {
    font-size: 11px;
  }

  .location-btn {
    bottom: 85px;
    right: 12px;
    width: 42px;
    height: 42px;
    font-size: 16px;
  }
}
</style>
