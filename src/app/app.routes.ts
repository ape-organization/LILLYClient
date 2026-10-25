import { Routes } from '@angular/router';

import { Home } from './components/baseLayout/home/home';

/*
 * Home is the landing page and stays in the initial bundle.
 * Every other page is lazy-loaded into its own chunk.
 */
export const routes: Routes = [
  { path: '', component: Home },
  { path: 'home', component: Home },
  {
    path: 'product/:id',
    loadComponent: () =>
      import('./components/products/product-modal/product-modal.component')
        .then(m => m.ProductModalComponent)
  },
  {
    path: 'products',
    loadComponent: () =>
      import('./components/products/product-list/product-list.component')
        .then(m => m.ProductListComponent)
  },
  {
    path: 'cart',
    loadComponent: () =>
      import('./components/cart/cart.component')
        .then(m => m.CartComponent)
  },
  {
    path: 'checkout',
    loadComponent: () =>
      import('./components/checkout/checkout')
        .then(m => m.CheckoutComponent)
  },

  { path: '**', redirectTo: '' }
];
