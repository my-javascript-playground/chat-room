import { Routes }      from '@angular/router';
import { inject }      from '@angular/core';
import { Router }      from '@angular/router';
import { SessionService } from './services/session.service';

const authGuard = () => {
  const session = inject(SessionService);
  const router  = inject(Router);
  return session.session ? true : router.createUrlTree(['/login']);
};

const loginGuard = () => {
  const session = inject(SessionService);
  const router  = inject(Router);
  return session.session ? router.createUrlTree(['/']) : true;
};

export const routes: Routes = [
  {
    path:        'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent),
    canActivate: [loginGuard],
  },
  {
    path:        '',
    loadComponent: () => import('./components/chat/chat.component').then(m => m.ChatComponent),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: '' },
];
