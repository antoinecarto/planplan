<template>
  <div
    class="min-h-screen bg-gradient-to-br from-indigo-300 via-purple-200 to-pink-200 flex items-center justify-center px-4 py-10"
  >
    <div
      class="w-full max-w-md bg-white/80 backdrop-blur-xl border border-white/30 rounded-3xl shadow-2xl p-8"
    >
      <!-- Titre principal -->
      <div class="text-center mb-8">
        <h1
          class="text-5xl font-extrabold text-gray-800 tracking-tight drop-shadow-sm"
        >
          PlanPlan
        </h1>
        <p class="text-sm text-gray-600 italic mt-2">
          Organise ta vie, simplement.
        </p>
      </div>

      <!-- Sous-titre -->
      <h2 class="text-2xl sm:text-3xl font-bold mb-6 text-center text-gray-800">
        {{ isLogin ? "Connexion" : "Inscription" }}
      </h2>

      <!-- Formulaire -->
      <form @submit.prevent="handleSubmit" class="space-y-5">
        <div class="relative">
          <input
            v-model="email"
            type="email"
            placeholder="Email"
            required
            class="w-full bg-white border border-gray-300 rounded-xl p-3 pl-10 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-300 outline-none transition text-base"
          />
          <span class="absolute left-3 top-3 text-gray-400 text-xl">📧</span>
        </div>

        <div class="relative">
          <input
            v-model="password"
            type="password"
            placeholder="Mot de passe"
            required
            class="w-full bg-white border border-gray-300 rounded-xl p-3 pl-10 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-300 outline-none transition text-base"
          />
          <span class="absolute left-3 top-3 text-gray-400 text-xl">🔒</span>
        </div>

        <button
          type="submit"
          class="w-full bg-indigo-500 text-white py-3 rounded-xl font-semibold hover:bg-indigo-600 transition-all shadow-md active:scale-95"
        >
          {{ isLogin ? "Se connecter" : "S'inscrire" }}
        </button>
      </form>

      <!-- Message d'erreur -->
      <p v-if="error" class="text-red-600 mt-4 text-center font-medium text-sm">
        {{ error }}
      </p>

      <!-- Lien de bascule -->
      <p class="mt-6 text-center text-gray-700 text-sm">
        {{ isLogin ? "Pas encore de compte ?" : "Déjà un compte ?" }}
        <button
          class="text-indigo-600 font-semibold hover:underline ml-1"
          @click="isLogin = !isLogin"
        >
          {{ isLogin ? "Inscription" : "Connexion" }}
        </button>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
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
  } catch (err: any) {
    console.error("Erreur Firebase:", err);
    error.value = err.message;
  }
};
</script>
