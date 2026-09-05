import { Routes } from '@angular/router';
import { ProductListComponent } from './components/products/product-list/product-list.component';
import { CartComponent } from './components/cart/cart.component';

import { Home } from './components/baseLayout/home/home';
import { FooterComponent } from './components/shared/footer/footer.component';
import { CheckoutComponent } from './components/checkout/checkout';
import { ProductModalComponent } from './components/products/product-modal/product-modal.component';

export const routes: Routes = [
  { path: '', component: Home },
    { path: 'home', component: Home },
{path: 'product/:id',component: ProductModalComponent},
  { path: 'products', component: ProductListComponent },
  { path: 'footer', component: FooterComponent },
  { path: 'cart', component: CartComponent },
    { path: 'checkout', component: CheckoutComponent },

  { path: '**', redirectTo: '' }
];
