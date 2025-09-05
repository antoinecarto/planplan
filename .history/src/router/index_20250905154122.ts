import { createRouter, createWebHistory } from "vue-router";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

// Pages
import AuthPage from "../views/AuthPage.vue";
import HomeView from "../views/HomeView.vue";

const routes = [
  {
    path: "/auth",
    name: "Auth",
    component: AuthPage,
    meta: { requiresAuth: false },
  },
  {
    path: "/",
    name: "home",
    component: HomeView,
    meta: { requiresAuth: true },
  },

  {
    path: "/:pathMatch(.*)*",
    redirect: "/auth", // fallback
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Garde de navigation (protection des routes)
let isAuthResolved = false;
let currentUser: any = null;

// On attend que Firebase dise si un user est connecté avant de résoudre les routes
const getCurrentUser = () =>
  new Promise((resolve) => {
    if (isAuthResolved) {
      resolve(currentUser);
    } else {
      onAuthStateChanged(auth, (user) => {
        isAuthResolved = true;
        currentUser = user;
        resolve(user);
      });
    }
  });

router.beforeEach(async (to) => {
  const user = await getCurrentUser();

  if (to.meta.requiresAuth && !user) {
    return { name: "Auth" };
  }

  if (to.path === "/auth" && user) {
    return { name: "home" };
  }
});

export default router;
