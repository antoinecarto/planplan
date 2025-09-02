<script setup lang="ts">
import { onMounted, ref } from "vue";
import L from "leaflet";

const map = ref<any>(null);
const currentView = ref<"carte" | "liste">("carte");

// Liste des lieux (exemple)
const lieux = ref([
  {
    id: 1,
    nom: "Tour Eiffel",
    lat: 48.8584,
    lng: 2.2945,
    description: "Monument emblématique de Paris",
  },
  {
    id: 2,
    nom: "Louvre",
    lat: 48.8606,
    lng: 2.3376,
    description: "Musée d'art célèbre",
  },
  {
    id: 3,
    nom: "Notre-Dame",
    lat: 48.853,
    lng: 2.3499,
    description: "Cathédrale gothique",
  },
]);

onMounted(() => {
  initMap();
});

const initMap = () => {
  if (currentView.value === "carte") {
    // Attendre que l'élément soit dans le DOM
    setTimeout(() => {
      map.value = L.map("map").setView([48.8566, 2.3522], 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map.value);

      // Ajouter tous les marqueurs
      lieux.value.forEach((lieu) => {
        L.marker([lieu.lat, lieu.lng])
          .bindPopup(`<b>${lieu.nom}</b><br>${lieu.description}`)
          .addTo(map.value);
      });
    }, 100);
  }
};

const switchToMap = () => {
  currentView.value = "carte";
  // Réinitialiser la carte après changement de vue
  setTimeout(() => {
    initMap();
  }, 50);
};

const switchToList = () => {
  currentView.value = "liste";
  // Détruire la carte si elle existe
  if (map.value) {
    map.value.remove();
    map.value = null;
  }
};
</script>

<template>
  <div class="app-container">
    <!-- Contenu principal -->
    <main class="main-content">
      <!-- Vue Carte -->
      <div v-if="currentView === 'carte'" id="map" class="map-container"></div>

      <!-- Vue Liste -->
      <div v-else class="liste-container">
        <h1 class="titre">Liste des lieux</h1>
        <div class="lieu-item" v-for="lieu in lieux" :key="lieu.id">
          <h3 class="lieu-nom">{{ lieu.nom }}</h3>
          <p class="lieu-description">{{ lieu.description }}</p>
          <p class="lieu-coords">Coordonnées: {{ lieu.lat }}, {{ lieu.lng }}</p>
        </div>
      </div>
    </main>

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
}

.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  position: relative;
}

/* Supprimer tous les logos et éléments Vue par défaut */
#app {
  padding: 0 !important;
  margin: 0 !important;
}

/* Cacher tout logo Vue potentiel */
img[src*="vue"],
img[alt*="Vue"],
[class*="logo"] {
  display: none !important;
}

.main-content {
  flex: 1;
  overflow: hidden;
  margin-bottom: 60px; /* Espace pour le footer fixe */
}

/* Carte sans marges */
.map-container {
  height: 100%;
  width: 100vw;
  margin: 0;
  padding: 0;
}

#map {
  height: 100%;
  width: 100%;
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
}

.lieu-item {
  background: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #3b82f6;
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
  height: 60px;
  min-height: 60px;
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
  min-height: 60px;
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
  font-size: 20px;
  line-height: 1;
}

.nav-text {
  font-size: 12px;
  font-weight: 600;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .footer {
    height: 70px;
  }

  .main-content {
    margin-bottom: 70px;
  }

  .nav-button {
    min-height: 70px;
    gap: 6px;
  }

  .nav-icon {
    font-size: 22px;
  }

  .nav-text {
    font-size: 13px;
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
  .nav-text {
    font-size: 11px;
  }

  .nav-icon {
    font-size: 20px;
  }
}
</style>
