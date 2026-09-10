import { Component, HostListener, inject, signal } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/shared/header/header.component';
import { FooterComponent } from './components/shared/footer/footer.component';
import { TranslatePipe } from '@ngx-translate/core';
import { MatIconModule } from '@angular/material/icon';
import { routes } from './app.routes';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent,TranslatePipe
    ,MatIconModule,RouterModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('pharmacy-store');
  private readonly router=inject(Router);
   sendToWhatsApp() {
    

    const message = "الاستفسار";
    const phoneNumber = '1211849330';
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  }
  // ==========================================================
  // MOBILE BOTTOM NAV
  // ==========================================================

  showBottomNav = signal(true);
    // ==========================================================


  // ==========================================================
  // PRODUCTS
  // ==========================================================

// ==========================================================
  // OFFERS
  // ==========================================================

isProductsPage(): boolean {
  const url = this.router.url;

  if (!url.split('?')[0].startsWith('/products')) {
    return false;
  }

  return !url.includes('offers=true');
}

isOffersPage(): boolean {
  const url = this.router.url;

  return (
    url.split('?')[0].startsWith('/products') &&
    url.includes('offers=true')
  );
}

selectAllProducts(): void {
  this.router.navigate(['/products']);
}

selectOffers(): void {
  this.router.navigate(
    ['/products'],
    {
      queryParams: {
        offers: true
      }
    }
  );
}



}
