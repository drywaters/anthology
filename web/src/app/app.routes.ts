import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/items/items-page.component').then((m) => m.ItemsPageComponent),
  },
  { path: '**', redirectTo: '' },
];
