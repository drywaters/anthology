import { Routes } from '@angular/router';

import { authGuard } from './services/auth.guard';

export const routes: Routes = [
    {
        path: '',
        canActivate: [authGuard],
        loadComponent: () => import('./components/app-shell/app-shell.component').then((m) => m.AppShellComponent),
        children: [
            {
                path: '',
                loadComponent: () => import('./pages/items/items-page.component').then((m) => m.ItemsPageComponent),
            },
            {
                path: 'items/add',
                loadComponent: () => import('./pages/add-item/add-item-page.component').then((m) => m.AddItemPageComponent),
            },
            {
                path: 'items/:id/edit',
                loadComponent: () => import('./pages/edit-item/edit-item-page.component').then((m) => m.EditItemPageComponent),
            },
        ],
    },
    {
        path: 'login',
        loadComponent: () => import('./pages/login/login-page.component').then((m) => m.LoginPageComponent),
    },
    { path: '**', redirectTo: '' },
];
