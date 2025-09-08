<script setup lang="ts">
import { onMounted, ref, nextTick, computed } from "vue";
import L from "leaflet";
import "leaflet-control-geocoder/dist/Control.Geocoder.css"; // CSS seulement
import { useLieuxStore } from "@/stores/lieux";

const lieuxStore = useLieuxStore();
const map = ref<any>(null);
const currentView = ref<"carte" | "liste">("carte");
const searchQuery = ref("");

// Système de tags
const availableTags = ref([
  { name: "Restaurant", color: "#ef4444" },
  { name: "Musée", color: "#3b82f6" },
  { name: "Parc", color: "#10b981" },
  { name: "Monument", color: "#f59e0b" },
  { name: "Shopping", color: "#8b5cf6" },
  { name: "Hôtel", color: "#06b6d4" },
  { name: "Transport", color: "#6b7280" },
  { name: "Autre", color: "#ec4899" },
]);
const selectedTagFilter = ref<string>(""); // Pour le filtre dans la liste
const showTagManager = ref(false);
const newTagName = ref("");
const newTagColor = ref("#3b82f6");

// Formulaire
const showForm = ref(false);
const isEditMode = ref(false);
const editingLieuId = ref<string | null>(null);
const formData = ref({
  nom: "",
  description: "",
  lat: 0,
  lng: 0,
  dateEvenement: "",
  tags: [] as string[], // Nouveau champ pour les tags
});
let tempMarker: any = null;

// Géolocalisation
const isLocating = ref(false);
const userLocationMarker = ref<any>(null);

// Tri
const sortOrder = ref<"asc" | "desc">("desc");

// Format date
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

// Fonction pour obtenir les couleurs des tags
const getTagColor = (tagName: string) => {
  const tag = availableTags.value.find((t) => t.name === tagName);
  return tag ? tag.color : "#6b7280";
};

// Lieux filtrés avec recherche et tags
const lieuxFiltres = computed(() => {
  let lieux = lieuxStore.lieux;

  // Filtre par recherche
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim();
    lieux = lieux.filter(
      (l) =>
        l.nom.toLowerCase().includes(query) ||
        (l.description && l.description.toLowerCase().includes(query)) ||
        (l.tags &&
          l.tags.some((tag: string) => tag.toLowerCase().includes(query)))
    );
  }

  // Filtre par tag sélectionné
  if (selectedTagFilter.value) {
    lieux = lieux.filter(
      (l) => l.tags && l.tags.includes(selectedTagFilter.value)
    );
  }

  return lieux.sort((a, b) => {
    const aHasDate = a.dateEvenement?.trim() !== "";
    const bHasDate = b.dateEvenement?.trim() !== "";
    if (aHasDate && !bHasDate) return -1;
    if (!aHasDate && bHasDate) return 1;
    if (aHasDate && bHasDate) {
      const dateA = new Date(a.dateEvenement!);
      const dateB = new Date(b.dateEvenement!);
      return sortOrder.value === "desc"
        ? dateB.getTime() - dateA.getTime()
        : dateA.getTime() - dateB.getTime();
    }
    const dateA = new Date(a.dateEnregistrement ?? 0);
    const dateB = new Date(b.dateEnregistrement ?? 0);
    return sortOrder.value === "desc"
      ? dateB.getTime() - dateA.getTime()
      : dateA.getTime() - dateB.getTime();
  });
});

// Tags utilisés (pour le filtre)
const usedTags = computed(() => {
  const tags = new Set<string>();
  lieuxStore.lieux.forEach((lieu) => {
    if (lieu.tags) {
      lieu.tags.forEach((tag: string) => tags.add(tag));
    }
  });
  return Array.from(tags).sort();
});

// Gestion des tags
const addNewTag = () => {
  if (
    newTagName.value.trim() &&
    !availableTags.value.find((t) => t.name === newTagName.value.trim())
  ) {
    availableTags.value.push({
      name: newTagName.value.trim(),
      color: newTagColor.value,
    });
    newTagName.value = "";
    newTagColor.value = "#3b82f6";
  }
};

const removeTag = (index: number) => {
  if (confirm("Êtes-vous sûr de vouloir supprimer ce tag ?")) {
    availableTags.value.splice(index, 1);
  }
};

const toggleTagInForm = (tagName: string) => {
  const index = formData.value.tags.indexOf(tagName);
  if (index > -1) {
    formData.value.tags.splice(index, 1);
  } else {
    formData.value.tags.push(tagName);
  }
};

// Init
onMounted(async () => {
  await lieuxStore.loadLieux();
  initMap();
});

// --- Init map avec geocoder dynamique ---
const initMap = async () => {
  if (currentView.value !== "carte") return;
  await nextTick();

  // Nettoyer la carte existante
  if (map.value) {
    map.value.off();
    map.value.remove();
    map.value = null;
  }

  setTimeout(async () => {
    try {
      // Créer la carte
      map.value = L.map("map").setView([48.8566, 2.3522], 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map.value);

      // Import dynamique pour le geocoder
      const LControlGeocoderModule = await import("leaflet-control-geocoder");
      const LControlGeocoder =
        LControlGeocoderModule.default || LControlGeocoderModule;

      // Ajouter le contrôle de géocodage
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

          // Supprimer le polygone après 3s
          setTimeout(() => map.value.removeLayer(poly), 3000);
        })
        .addTo(map.value);

      // Ajouter les marqueurs existants
      lieuxStore.lieux.forEach(addExistingMarker);

      // Écouter les clics sur la carte
      map.value.on("click", onMapClick);

      console.log("Carte initialisée avec geocoder dynamique ✅");
    } catch (err) {
      console.error("Erreur init map:", err);
    }
  }, 150);
};

// Icon custom
const customIcon = L.icon({
  iconUrl: "pin.svg",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Ajouter un marker avec tags
const addExistingMarker = (lieu: any) => {
  if (!map.value) return;
  const marker = L.marker([lieu.lat, lieu.lng], { icon: customIcon });

  // Générer les tags HTML
  const tagsHtml =
    lieu.tags && lieu.tags.length > 0
      ? `<div style="margin-bottom:8px;">${lieu.tags
          .map(
            (tag: string) =>
              `<span style="background:${getTagColor(
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

const onMapClick = (e: any) => {
  if (showForm.value) return; // Empêcher l'ouverture si un formulaire est déjà ouvert

  const { lat, lng } = e.latlng;

  // Supprimer le marqueur temporaire précédent
  if (tempMarker) {
    map.value.removeLayer(tempMarker);
  }

  // Créer un nouveau marqueur temporaire
  tempMarker = L.marker([lat, lng]).addTo(map.value);

  // Préparer le formulaire avec la date actuelle
  const maintenant = new Date();
  formData.value = {
    nom: "",
    description: "",
    lat: lat,
    lng: lng,
    dateEvenement: maintenant.toISOString().split("T")[0], // Format YYYY-MM-DD
    tags: [],
  };
  isEditMode.value = false;
  editingLieuId.value = null;
  showForm.value = true;
};

// Fonction de géolocalisation
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
        // Centrer la carte sur la position de l'utilisateur
        map.value.setView([latitude, longitude], 16);

        // Supprimer l'ancien marqueur de position utilisateur s'il existe
        if (userLocationMarker.value) {
          map.value.removeLayer(userLocationMarker.value);
        }

        // Créer un marqueur spécial pour la position de l'utilisateur
        const userIcon = L.divIcon({
          html: '<div style="background: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>',
          className: "user-location-marker",
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        userLocationMarker.value = L.marker([latitude, longitude], {
          icon: userIcon,
        })
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

const saveNewMarker = async () => {
  if (!formData.value.nom.trim()) {
    alert("Le nom est obligatoire");
    return;
  }

  if (isEditMode.value && editingLieuId.value) {
    // Mode modification - adaptation pour votre API existante
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
      // Recharger la carte
      refreshMapMarkers();
      showForm.value = false;
      resetForm();
      console.log("Lieu modifié avec succès!");
    }
  } else {
    // Mode création
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
      // Supprimer le marqueur temporaire
      if (tempMarker) {
        map.value.removeLayer(tempMarker);
        tempMarker = null;
      }

      // Ajouter le marqueur permanent
      addExistingMarker(result);

      // Fermer le formulaire
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
      if (layer instanceof L.Marker && layer !== userLocationMarker.value) {
        map.value.removeLayer(layer);
      }
    });

    lieuxStore.lieux.forEach((lieu) => {
      addExistingMarker(lieu);
    });
  }
};

// Fonction globale pour éditer depuis la carte
(window as any).editMarkerFromMap = async (id: string) => {
  const lieu = lieuxStore.lieux.find((l) => l.id === id);
  if (!lieu) return;

  // Remplir le formulaire avec les données existantes
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

  // Créer un marqueur temporaire pour la modification (optionnel)
  if (tempMarker) {
    map.value.removeLayer(tempMarker);
  }
  tempMarker = L.marker([lieu.lat, lieu.lng], {
    icon: L.icon({
      iconUrl: "pin.svg",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    }),
  }).addTo(map.value);
};

// Fonction globale pour supprimer depuis la carte
(window as any).deleteMarkerFromMap = async (id: string) => {
  if (confirm("Êtes-vous sûr de vouloir supprimer ce lieu ?")) {
    const success = await lieuxStore.deleteLieu(id);

    if (success) {
      refreshMapMarkers();
    }
  }
};

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

// Fonction pour aller à un lieu depuis la liste
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

// Fonction pour modifier depuis la liste
const editLieuFromList = (lieu: any) => {
  formData.value = {
    nom: lieu.nom,
    description: lieu.description || "",
    lat: lieu.lat,
    lng: lieu.lng,
    dateEvenement: lieu.dateEvenement || "",
    tags: lieu.tags || [],
  };

  isEditMode.value = true;
  editingLieuId.value = lieu.id;
  showForm.value = true;
};

// Fonction pour supprimer depuis la liste
const deleteLieuFromList = async (id: string) => {
  if (confirm("Êtes-vous sûr de vouloir supprimer ce lieu ?")) {
    await lieuxStore.deleteLieu(id);
  }
};

// Fonction pour effacer la recherche
const clearSearch = () => {
  searchQuery.value = "";
};

// Fonction pour effacer le filtre de tag
const clearTagFilter = () => {
  selectedTagFilter.value = "";
};

// Fonction pour inverser l'ordre de tri
const toggleSortOrder = () => {
  sortOrder.value = sortOrder.value === "desc" ? "asc" : "desc";
};
</script>

<template>
  <div class="app-container darkMode">
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

        <!-- Bouton de gestion des tags -->
        <button
          @click="showTagManager = true"
          class="tag-manager-btn"
          title="Gérer les tags"
        >
          🏷️
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
                  v-for="tag in availableTags"
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
                  v-for="(tag, index) in availableTags"
                  :key="tag.name"
                  class="existing-tag"
                  :style="{ backgroundColor: tag.color }"
                >
                  {{ tag.name }}
                  <button @click="removeTag(index)" class="tag-remove-btn">
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
          <div v-if="usedTags.length > 0" class="tag-filter">
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
                v-for="tag in usedTags"
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
                    selectedTagFilter === tag ? getTagColor(tag) : '#f3f4f6',
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
              <h3 class="lieu-nom" @click.stop="goToLieuOnMap(lieu)">
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
                :style="{ backgroundColor: getTagColor(tag) }"
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

/* Support pour les écrans très larges */ @media (min-width: 1200px) {
.form-modal { min-width: 400px; max-width: 500px; } .lieux-list { padding: 20px;
max-width: 800px; margin: 0 auto; } .liste-header { max-width: 800px; margin: 0
auto; padding: 20px; } .tag-manager-btn { bottom: 145px; right: 16px; width:
45px; height: 45px; font-size: 18px; } .search-input { font-size: 16px; /* Évite
le zoom sur iOS */ } .tag-filter { padding: 12px; } .tag-filter-options { gap:
4px; } .tag-filter-btn { padding: 4px 8px; font-size: 11px; } }
