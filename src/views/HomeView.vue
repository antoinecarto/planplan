<script setup lang="ts">
import { onMounted, ref, nextTick } from "vue";
import L from "leaflet";
import { useLieuxStore } from "@/stores/lieux";

const lieuxStore = useLieuxStore();
const map = ref<any>(null);
const currentView = ref<"carte" | "liste">("carte");

// Variables pour le formulaire
const showForm = ref(false);
const formData = ref({
  nom: "",
  description: "",
  lat: 0,
  lng: 0,
  dateEvenement: "",
});
let tempMarker: any = null;

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

// Dans la section script setup, après la déclaration du store
console.log("lieuxStore:", lieuxStore);
console.log("addLieu:", lieuxStore.addLieu);

// Charger les lieux au démarrage
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

const addExistingMarker = (lieu: any) => {
  if (map.value) {
    const marker = L.marker([lieu.lat, lieu.lng]);

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
        <button onclick="window.deleteMarkerFromMap('${lieu.id}')" 
                style="background: #ef4444; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; width: 100%;">
          🗑️ Supprimer
        </button>
      </div>
    `;

    marker.bindPopup(popupContent);
    marker.addTo(map.value);
  }
};

const onMapClick = (e: any) => {
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
  showForm.value = true;
};

const saveNewMarker = async () => {
  if (!formData.value.nom.trim()) {
    alert("Le nom est obligatoire");
    return;
  }

  const nouveauLieu = {
    nom: formData.value.nom.trim(),
    description: formData.value.description.trim(),
    lat: formData.value.lat,
    lng: formData.value.lng,
    dateEnregistrement: new Date().toISOString(), // Date du clic
    dateEvenement: formData.value.dateEvenement || undefined, // Date de l'événement (optionnelle)
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
};

// Fonction globale pour supprimer depuis la carte
(window as any).deleteMarkerFromMap = async (id: string) => {
  if (confirm("Êtes-vous sûr de vouloir supprimer ce lieu ?")) {
    const success = await lieuxStore.deleteLieu(id);

    if (success) {
      // Recharger la carte
      if (map.value) {
        map.value.eachLayer((layer: any) => {
          if (layer instanceof L.Marker) {
            map.value.removeLayer(layer);
          }
        });

        lieuxStore.lieux.forEach((lieu) => {
          addExistingMarker(lieu);
        });
      }
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

// Fonction pour supprimer depuis la liste
const deleteLieuFromList = async (id: string) => {
  if (confirm("Êtes-vous sûr de vouloir supprimer ce lieu ?")) {
    await lieuxStore.deleteLieu(id);
  }
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

        <!-- Indicateur de chargement -->
        <div v-if="lieuxStore.loading" class="loading-overlay">
          <div class="loading-spinner">⏳ Chargement...</div>
        </div>

        <!-- Formulaire flottant -->
        <div v-if="showForm" class="form-overlay">
          <div class="form-modal">
            <h3>📍 Nouveau lieu</h3>

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
                {{ lieuxStore.loading ? "⏳ Sauvegarde..." : "💾 Sauvegarder" }}
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
          <div class="stats">
            {{ lieuxStore.lieuxCount }} lieu{{
              lieuxStore.lieuxCount > 1 ? "x" : ""
            }}
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

        <div v-else class="lieux-list">
          <div
            class="lieu-item"
            v-for="lieu in lieuxStore.lieuxParDate"
            :key="lieu.id"
          >
            <div class="lieu-header">
              <h3 class="lieu-nom">{{ lieu.nom }}</h3>
              <button
                @click="deleteLieuFromList(lieu.id)"
                class="delete-btn-list"
                :disabled="lieuxStore.loading"
              >
                🗑️
              </button>
            </div>

            <p v-if="lieu.description" class="lieu-description">
              {{ lieu.description }}
            </p>

            <div class="lieu-meta">
              <div class="meta-item">
                📍 {{ lieu.lat.toFixed(4) }}, {{ lieu.lng.toFixed(4) }}
              </div>
              <div class="meta-item">
                📅 Enregistré: {{ formatDateTime(lieu.dateEnregistrement) }}
              </div>
              <div v-if="lieu.dateEvenement" class="meta-item">
                🗓️ Événement: {{ formatDate(lieu.dateEvenement) }}
              </div>
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
        <span class="nav-icon">🗺️</span>
        <span class="nav-text">Carte</span>
      </button>
      <button
        @click="switchToList"
        :class="['nav-button', currentView === 'liste' ? 'active' : '']"
      >
        <span class="nav-icon">📝</span>
        <span class="nav-text">Liste</span>
      </button>
    </footer>
  </div>
</template>

<style>
@import "leaflet/dist/leaflet.css";

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
  color: #dc2626;
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
  color: #dc2626;
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
}

.lieu-description {
  color: #6b7280;
  margin-bottom: 12px;
  line-height: 1.5;
  font-size: 14px;
  overflow-y: auto;
}

.lieu-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-item {
  font-size: 12px;
  color: #9ca3af;
  display: flex;
  align-items: center;
  gap: 4px;
}

.delete-btn-list {
  background-color: #ef4444;
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
}

.delete-btn-list:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

.delete-btn-list:not(:disabled):active {
  background-color: #dc2626;
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
  background-color: #3b82f6;
  color: white;
}

.nav-button.active:active {
  background-color: #2563eb;
}

.nav-icon {
  font-size: 22px;
  line-height: 1;
}

.nav-text {
  font-size: 13px;
  font-weight: 600;
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
}
</style>
