import { createApp } from "vue";
import { createPinia } from "pinia";

import App from "./App.vue";
import router from "./router";

// IMPORTANT : Tailwind en dernier pour qu'il ait la priorité
import "./assets/main.css"; // Styles de base de Vue
import "./assets/index.css"; // Tailwind CSS

const app = createApp(App);

app.use(createPinia());
app.use(router);

app.mount("#app");
