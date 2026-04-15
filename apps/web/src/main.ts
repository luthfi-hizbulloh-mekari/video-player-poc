import { createPinia } from 'pinia';
import { createApp } from 'vue';

import App from './App.vue';
import { router } from './router';
import 'plyr/dist/plyr.css';
import './style.css';
import './styles/videojs.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.mount('#app');
