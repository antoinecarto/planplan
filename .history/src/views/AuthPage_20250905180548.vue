<template>
  <h1 class="text-4xl font-bold text-blue-500">Hello Tailwind sans config !</h1>

  <div class="flex items-center justify-center min-h-screen bg-blue-400 px-4">
    <div class="w-full max-w-md bg-white p-8 rounded-3xl shadow-lg">
      <h2 class="text-2xl font-bold mb-6 text-center text-blue-700 uppercase">
        Connexion au compte
      </h2>

      <form @submit.prevent="handleSubmit" class="flex flex-col gap-4">
        <input
          v-model="email"
          type="email"
          placeholder="Enter your Email"
          required
          class="w-full border border-gray-300 rounded-xl p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
        />
        <input
          v-model="password"
          type="password"
          placeholder="Enter your Password"
          required
          class="w-full border border-gray-300 rounded-xl p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
        />

        <div class="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" id="remember" class="w-4 h-4" />
          <label for="remember">Remember me</label>
        </div>

        <button
          type="submit"
          class="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-md"
        >
          Connexion
        </button>
      </form>

      <div class="flex justify-between mt-4 text-sm text-blue-600">
        <button @click="isLogin = false" class="hover:underline">
          Vous n'avez pas de compte ?
        </button>
        <button class="hover:underline">Mot de passe oublié ?</button>
      </div>

      <p v-if="error" class="text-red-600 mt-4 text-center font-medium">
        {{ error }}
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
const error = ref("");
const isLogin = ref(true);
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
    error.value = err.message;
  }
};
</script>
