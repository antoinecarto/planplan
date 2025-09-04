<script setup lang="ts">
import { onMounted, ref, nextTick, computed } from "vue";
import L from "leaflet";
import "leaflet-control-geocoder/dist/Control.Geocoder.css";
import { useLieuxStore } from "@/stores/lieux";

const lieuxStore = useLieuxStore();
const map = ref<any>(null);
const currentView = ref<"carte" | "liste">("carte");
const searchQuery = ref("");

// Variables pour le formulaire
const showForm = ref(false);
const isEditMode = ref(false);
const editingLieuId = ref<string | null>(null);
const formData = ref({
  nom: "",
  description: "",
  lat: 0,
  lng: 0,
  dateEvenement: "",
});
let tempMarker: any = null;

// Variables pour la géolocalisation
const isLocating = ref(false);
const userLocationMarker = ref<any>(null);

// Variables pour le tri
const sortOrder = ref<"asc" | "desc">("desc");

// Utilitaire pour formater les dates
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Fonction de recherche filtrée avec tri
const lieuxFiltres = computed(() => {
  let lieux = lieuxStore.lieux;

  // Filtrage par recherche
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim();
    lieux = lieux.filter(
      (lieu) =>
        lieu.nom.toLowerCase().includes(query) ||
        (lieu.description && lieu.description.toLowerCase().includes(query))
    );
  }

  // Tri par date d'événement
  return lieux.sort((a, b) => {
    // Les lieux avec date d'événement en premier
    const aHasDate = a.dateEvenement && a.dateEvenement.trim() !== "";
    const bHasDate = b.dateEvenement && b.dateEvenement.trim() !== "";

    if (aHasDate && !bHasDate) return -1;
    if (!aHasDate && bHasDate) return 1;

    if (aHasDate && bHasDate) {
      // Ici TS sait que les deux ne sont pas undefined → on peut utiliser !
      const dateA = new Date(a.dateEvenement!);
      const dateB = new Date(b.dateEvenement!);
      return sortOrder.value === "desc"
        ? dateB.getTime() - dateA.getTime()
        : dateA.getTime() - dateB.getTime();
    }

    // Si aucun n'a de date d'événement, tri par date d'enregistrement
    // On protège avec ?? car dateEnregistrement peut aussi être undefined
    const dateA = new Date(a.dateEnregistrement ?? 0);
    const dateB = new Date(b.dateEnregistrement ?? 0);
    return sortOrder.value === "desc"
      ? dateB.getTime() - dateA.getTime()
      : dateA.getTime() - dateB.getTime();
  });
});

// Charger les lieux au démarrage de l'application
onMounted(async () => {
  await lieuxStore.loadLieux();
  initMap();
});

const initMap = async () => {
  if (currentView.value === "carte") {
    await nextTick();

    // Nettoyer la carte existante proprement
    if (map.value) {
      map.value.off();
      map.value.remove();
      map.value = null;
    }

    setTimeout(() => {
      try {
        map.value = L.map("map").setView([48.8566, 2.3522], 12);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map.value);

        // Ajouter le contrôle de géocodage
        const geocoderControl = (L.Control as any)
          .geocoder({
            geocoder: (L.Control as any).Geocoder.nominatim(),
            defaultMarkGeocode: false,
          })
          .on("markgeocode", function (e: any) {
            const bbox = e.geocode.bbox;
            const poly = L.polygon([
              bbox.getSouthEast(),
              bbox.getNorthEast(),
              bbox.getNorthWest(),
              bbox.getSouthWest(),
            ]).addTo(map.value);
            map.value.fitBounds(poly.getBounds());

            // Supprimer le polygone après un délai
            setTimeout(() => {
              map.value.removeLayer(poly);
            }, 3000);
          })
          .addTo(map.value);

        // Ajouter les marqueurs existants
        lieuxStore.lieux.forEach((lieu) => {
          addExistingMarker(lieu);
        });

        // Écouter les clics sur la carte
        map.value.on("click", onMapClick);
      } catch (error) {
        console.error("Erreur lors de l'initialisation de la carte:", error);
      }
    }, 150);
  }
};

const customIcon = L.icon({
  iconUrl: "pin.svg",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const addExistingMarker = (lieu: any) => {
  if (map.value) {
    const marker = L.marker([lieu.lat, lieu.lng], { icon: customIcon });

    const popupContent = `
      <div style="min-width: 250px; font-family: system-ui;">
        <h3 style="margin-bottom: 8px; color: #1f2937; font-size: 16px;">${
          lieu.nom
        }</h3>
        <p style="margin-bottom: 8px; color: #6b7280; font-size: 13px; line-height: 1.4;">${
          lieu.description
        }</p>
        <div style="font-size: 11px; color: #9ca3af; margin-bottom: 10px;">
          <div>📅 Enregistré: ${formatDateTime(lieu.dateEnregistrement)}</div>
          ${
            lieu.dateEvenement
              ? `<div>🗓️ Événement: ${formatDate(lieu.dateEvenement)}</div>`
              : ""
          }
        </div>
        <div style="display: flex; gap: 8px;">
          <button onclick="window.editMarkerFromMap('${lieu.id}')" 
                  style="background: #3b82f6; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; flex: 1;">
            ✏️ Modifier
          </button>
          <button onclick="window.deleteMarkerFromMap('${lieu.id}')" 
                  style="background: #ef4444; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; flex: 1;">
            🗑️ Supprimer
          </button>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent);
    marker.addTo(map.value);
  }
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

// Fonction pour inverser l'ordre de tri
const toggleSortOrder = () => {
  sortOrder.value = sortOrder.value === "desc" ? "asc" : "desc";
};
</script>

<template>
  <div class="app-container">
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

        <!-- Formulaire flottant -->
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
      </div>

      <!-- Vue Liste -->
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

          <!-- Barre de recherche -->
          <div class="search-container">
            <div class="search-input-container">
              <span class="search-icon">🔍</span>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Rechercher un lieu..."
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

        <div
          v-else-if="lieuxFiltres.length === 0 && searchQuery"
          class="empty-state"
        >
          <div class="empty-icon">🔍</div>
          <h3>Aucun résultat</h3>
          <p>Aucun lieu ne correspond à votre recherche "{{ searchQuery }}"</p>
          <button @click="clearSearch" class="clear-search-btn">
            Effacer la recherche
          </button>
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

.stats {
  color: #6b7280;
  font-size: 14px;
  margin-bottom: 16px;
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

.clear-search-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  margin-top: 16px;
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

  .search-input {
    font-size: 16px; /* Évite le zoom sur iOS */
  }
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

  .delete-btn-list {
    align-self: flex-end;
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

  .lieu-click-indicator {
    font-size: 10px;
  }

  .click-arrow {
    font-size: 12px;
  }
}
</style>
