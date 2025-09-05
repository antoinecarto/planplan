<template>
  <div
    class="flex flex-col items-center justify-center min-h-screen bg-gray-100"
  >
    <div class="w-full max-w-sm bg-white p-6 rounded-2xl shadow">
      <h2 class="text-2xl font-bold mb-4 text-center">
        {{ isLogin ? "Connexion" : "Inscription" }}
      </h2>

      <form @submit.prevent="handleSubmit" class="flex flex-col gap-4">
        <input
          v-model="email"
          type="email"
          placeholder="Email"
          required
          class="border rounded p-2"
        />
        <input
          v-model="password"
          type="password"
          placeholder="Mot de passe"
          required
          class="border rounded p-2"
        />
        <button
          type="submit"
          class="bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
        >
          {{ isLogin ? "Se connecter" : "S'inscrire" }}
        </button>
      </form>

      <p v-if="error" class="text-red-500 mt-2 text-sm">{{ error }}</p>

      <p class="mt-4 text-center text-sm">
        {{ isLogin ? "Pas encore de compte ?" : "Déjà un compte ?" }}
        <button class="text-blue-500 underline" @click="isLogin = !isLogin">
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

const email = ref("");
const password = ref("");
const isLogin = ref(true);
const error = ref("");

const handleSubmit = async () => {
  error.value = "";
  try {
    if (isLogin.value) {
      await signInWithEmailAndPassword(auth, email.value, password.value);
    } else {
      await createUserWithEmailAndPassword(auth, email.value, password.value);
    }
  } catch (err) {
    error.value = err.message;
  }
};
</script>
