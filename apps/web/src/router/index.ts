import { createRouter, createWebHistory } from 'vue-router';

import PlayerComparisonPage from '../pages/PlayerComparisonPage.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'comparison',
      component: PlayerComparisonPage
    }
  ]
});
