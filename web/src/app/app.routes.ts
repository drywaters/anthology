import { Routes } from '@angular/router';

import { authGuard } from './services/auth.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/items/items-page.component').then((m) => m.ItemsPageComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login-page.component').then((m) => m.LoginPageComponent),
  },
  { path: '**', redirectTo: '' },
];
