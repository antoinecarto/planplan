<script setup lang="ts">
import { onMounted, ref, nextTick } from "vue";
import L from "leaflet";
import {
  saveToFirestore,
  loadFromFirestore,
  deleteFromFirestore,
} from "./firebase";

const map = ref<any>(null);
const currentView = ref<"carte" | "liste">("carte");

// Liste des lieux stockés
const lieux = ref<
  Array<{
    id: string;
    nom: string;
    lat: number;
    lng: number;
    description: string;
  }>
>([]);

// Variables pour le formulaire
const showForm = ref(false);
const formData = ref({
  nom: "",
  description: "",
  lat: 0,
  lng: 0,
});
let tempMarker: any = null;

// Charger les lieux au démarrage
onMounted(async () => {
  try {
    const data = await loadFromFirestore();
    lieux.value = data as any[];
    console.log("Lieux chargés:", lieux.value.length);
  } catch (error) {
    console.error("Erreur lors du chargement initial:", error);
    // Continuer sans données si erreur
  }
  initMap();
});

const initMap = async () => {
  if (currentView.value === "carte") {
    await nextTick();

    // Nettoyer la carte existante proprement
    if (map.value) {
      map.value.off(); // Supprimer tous les event listeners
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
        lieux.value.forEach((lieu) => {
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
    marker.bindPopup(`
      <div style="min-width: 200px;">
        <h3 style="margin-bottom: 8px; color: #1f2937;">${lieu.nom}</h3>
        <p style="margin-bottom: 10px; color: #6b7280; font-size: 13px;">${lieu.description}</p>
        <button onclick="window.deleteMarker('${lieu.id}')" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">🗑️ Supprimer</button>
      </div>
    `);
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

  // Ouvrir le formulaire
  formData.value = {
    nom: "",
    description: "",
    lat: lat,
    lng: lng,
  };
  showForm.value = true;
};

const saveNewMarker = async () => {
  if (!formData.value.nom.trim()) {
    alert("Le nom est obligatoire");
    return;
  }

  // Afficher un indicateur de chargement
  const saveBtn = document.querySelector(".save-btn") as HTMLButtonElement;
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "⏳ Sauvegarde...";
  }

  const nouveauLieu = {
    nom: formData.value.nom.trim(),
    description: formData.value.description.trim(),
    lat: formData.value.lat,
    lng: formData.value.lng,
    createdAt: new Date().toISOString(),
  };

  const id = await saveToFirestore(nouveauLieu);

  // Restaurer le bouton
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.textContent = "💾 Sauvegarder";
  }

  if (id) {
    // Ajouter à la liste locale
    lieux.value.push({ ...nouveauLieu, id: id as string });

    // Supprimer le marqueur temporaire
    if (tempMarker) {
      map.value.removeLayer(tempMarker);
      tempMarker = null;
    }

    // Ajouter le marqueur permanent
    addExistingMarker({ ...nouveauLieu, id });

    // Fermer le formulaire
    showForm.value = false;

    // Réinitialiser le formulaire
    formData.value = { nom: "", description: "", lat: 0, lng: 0 };

    console.log("Lieu ajouté avec succès!");
  }
};

const cancelNewMarker = () => {
  if (tempMarker) {
    map.value.removeLayer(tempMarker);
    tempMarker = null;
  }
  showForm.value = false;
  formData.value = { nom: "", description: "", lat: 0, lng: 0 };
};

// Fonction globale pour supprimer (appelée depuis les popups)
(window as any).deleteMarker = async (id: string) => {
  if (confirm("Êtes-vous sûr de vouloir supprimer ce lieu ?")) {
    const success = await deleteFromFirestore(id);

    if (success) {
      // Supprimer de la liste locale
      lieux.value = lieux.value.filter((lieu) => lieu.id !== id);

      // Recharger la carte
      if (map.value) {
        // Supprimer tous les marqueurs
        map.value.eachLayer((layer: any) => {
          if (layer instanceof L.Marker) {
            map.value.removeLayer(layer);
          }
        });

        // Ré-ajouter tous les marqueurs
        lieux.value.forEach((lieu) => {
          addExistingMarker(lieu);
        });
      }
    }
  }
};

const switchToMap = () => {
  currentView.value = "carte";
  showForm.value = false;
  setTimeout(() => {
    initMap();
  }, 50);
};

const switchToList = () => {
  currentView.value = "liste";
  showForm.value = false;
  if (map.value) {
    map.value.remove();
    map.value = null;
  }
};

// Fonction pour supprimer depuis la liste
const deleteLieu = async (id: string) => {
  if (confirm("Êtes-vous sûr de vouloir supprimer ce lieu ?")) {
    const success = await deleteFromFirestore(id);

    if (success) {
      lieux.value = lieux.value.filter((lieu) => lieu.id !== id);
    }
  }
};
</script>

<template>
  <div class="app-container">
    <!-- Contenu principal -->
    <main class="main-content">
      <!-- Vue Carte -->
      <div v-if="currentView === 'carte'" class="carte-view">
        <div id="map" class="map-container"></div>

        <!-- Formulaire flottant -->
        <div v-if="showForm" class="form-overlay">
          <div class="form-modal">
            <h3>Nouveau lieu</h3>
            <div class="form-group">
              <input
                v-model="formData.nom"
                type="text"
                placeholder="Nom du lieu"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <textarea
                v-model="formData.description"
                placeholder="Description"
                class="form-textarea"
              ></textarea>
            </div>
            <div class="form-actions">
              <button @click="saveNewMarker" class="save-btn">
                💾 Sauvegarder
              </button>
              <button @click="cancelNewMarker" class="cancel-btn">
                ❌ Annuler
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Vue Liste -->
      <div v-else class="liste-container">
        <h1 class="titre">Mes lieux ({{ lieux.length }})</h1>
        <div v-if="lieux.length === 0" class="empty-state">
          <p>Aucun lieu enregistré</p>
          <p>
            Cliquez sur "Carte" et tapez sur la carte pour ajouter des lieux
          </p>
        </div>
        <div class="lieu-item" v-for="lieu in lieux" :key="lieu.id">
          <h3 class="lieu-nom">{{ lieu.nom }}</h3>
          <p class="lieu-description">{{ lieu.description }}</p>
          <p class="lieu-coords">
            📍 {{ lieu.lat.toFixed(4) }}, {{ lieu.lng.toFixed(4) }}
          </p>
          <button @click="deleteLieu(lieu.id)" class="delete-btn-list">
            🗑️ Supprimer
          </button>
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

/* Supprimer tous les logos et éléments Vue par défaut */
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

/* Formulaire flottant */
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
  padding: 20px;
  min-width: 300px;
  max-width: 90vw;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.form-modal h3 {
  margin-bottom: 16px;
  color: #1f2937;
  font-size: 18px;
  text-align: center;
}

.form-group {
  margin-bottom: 12px;
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
}

.form-textarea {
  height: 80px;
  resize: vertical;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
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

.save-btn:active {
  background-color: #059669;
  transform: scale(0.98);
}

.cancel-btn {
  background-color: #6b7280;
  color: white;
}

.cancel-btn:active {
  background-color: #4b5563;
  transform: scale(0.98);
}

/* Styles pour la liste */
.liste-container {
  height: 100%;
  overflow-y: auto;
  padding: 20px 16px;
  background-color: #f8f9fa;
}

.titre {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 20px;
  color: #333;
  text-align: center;
}

.empty-state {
  text-align: center;
  color: #6b7280;
  margin-top: 50px;
}

.empty-state p {
  margin-bottom: 10px;
}

.lieu-item {
  background: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #3b82f6;
  position: relative;
}

.lieu-nom {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 8px;
}

.lieu-description {
  color: #6b7280;
  margin-bottom: 6px;
  line-height: 1.5;
}

.lieu-coords {
  font-size: 12px;
  color: #9ca3af;
  font-family: monospace;
  margin-bottom: 10px;
}

.delete-btn-list {
  background-color: #ef4444;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.delete-btn-list:active {
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
    min-width: 280px;
  }

  .liste-container {
    padding: 16px 12px;
  }

  .lieu-item {
    padding: 12px;
    margin-bottom: 10px;
  }

  .lieu-nom {
    font-size: 16px;
  }
}

/* Support pour les très petits écrans */
@media (max-width: 480px) {
  .form-modal {
    min-width: 260px;
    padding: 16px;
  }

  .form-input,
  .form-textarea {
    font-size: 16px; /* Évite le zoom sur iOS */
  }
}
</style>
