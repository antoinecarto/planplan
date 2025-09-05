<template>
  <div
    class="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex flex-col items-center justify-center px-4 py-8"
  >
    <!-- Titre principal -->
    <h1
      class="text-4xl sm:text-5xl font-extrabold text-gray-800 mb-8 tracking-tight drop-shadow-sm"
    >
      PlanPlan
    </h1>

    <!-- Carte de connexion/inscription -->
    <div class="w-full max-w-md bg-white p-6 sm:p-8 rounded-3xl shadow-2xl">
      <h2 class="text-2xl sm:text-3xl font-bold mb-6 text-center text-gray-800">
        {{ isLogin ? "Connexion" : "Inscription" }}
      </h2>

      <form @submit.prevent="handleSubmit" class="flex flex-col gap-4 sm:gap-5">
        <input
          v-model="email"
          type="email"
          placeholder="Email"
          required
          class="w-full border border-gray-300 rounded-xl p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-300 outline-none transition text-base sm:text-lg"
        />
        <input
          v-model="password"
          type="password"
          placeholder="Mot de passe"
          required
          class="w-full border border-gray-300 rounded-xl p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-300 outline-none transition text-base sm:text-lg"
        />
        <button
          type="submit"
          class="w-full bg-blue-500 text-white py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors shadow-md text-base sm:text-lg"
        >
          {{ isLogin ? "Se connecter" : "S'inscrire" }}
        </button>
      </form>

      <!-- Message d'erreur -->
      <p
        v-if="error"
        class="text-red-600 mt-4 text-center font-medium text-sm sm:text-base"
      >
        {{ error }}
      </p>

      <!-- Lien de bascule -->
      <p class="mt-6 text-center text-gray-600 text-sm sm:text-base">
        {{ isLogin ? "Pas encore de compte ?" : "Déjà un compte ?" }}
        <button
          class="text-blue-500 font-semibold hover:underline ml-1"
          @click="isLogin = !isLogin"
        >
          {{ isLogin ? "Inscription" : "Connexion" }}
        </button>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { auth } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useRouter } from "vue-router";

const email = ref("");
const password = ref("");
const isLogin = ref(true);
const error = ref("");
const router = useRouter();

const handleSubmit = async () => {
  error.value = "";
  try {
    let userCredential;
    if (isLogin.value) {
      userCredential = await signInWithEmailAndPassword(
        auth,
        email.value,
        password.value
      );
    } else {
      userCredential = await createUserWithEmailAndPassword(
        auth,
        email.value,
        password.value
      );
    }
    console.log("Connecté :", userCredential.user.email);
    router.push("/home");
  } catch (err) {
    console.error("Erreur Firebase:", err);
    error.value = err.message;
  }
};
</script>
