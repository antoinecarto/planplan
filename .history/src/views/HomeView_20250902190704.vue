<script setup lang="ts">
import { onMounted, ref } from "vue";
import L from "leaflet";

// Approche pragmatique : typage minimal mais efficace
const map = ref<any>(null);

onMounted(() => {
  // Initialisation simple et robuste
  map.value = L.map("map").setView([48.8566, 2.3522], 13);

  // Tuiles OpenStreetMap
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map.value);

  // Marqueur
  L.marker([48.8566, 2.3522]).bindPopup("Tour Eiffel").addTo(map.value);
});

// Fonction utilitaire typée
const addMarker = (lat: number, lng: number, popupText?: string) => {
  if (map.value) {
    const marker = L.marker([lat, lng]);
    if (popupText) {
      marker.bindPopup(popupText);
    }
    marker.addTo(map.value);
  }
};

// Exemple d'utilisation
const addTourEiffel = () => {
  addMarker(48.8584, 2.2945, "Tour Eiffel");
};
</script>

<template>
  <main>
    <div id="map" style="height: 500px; width: 100%"></div>
    <button
      @click="addTourEiffel"
      class="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
    >
      Ajouter Tour Eiffel
    </button>
  </main>
</template>

<style>
@import "leaflet/dist/leaflet.css";
</style>
