import {
  Component,
  HostListener,
  OnInit,
  inject,
  signal
} from '@angular/core';

import {
  CommonModule
} from '@angular/common';

import {
  Router,
  RouterModule
} from '@angular/router';

import {
  MatIconModule
} from '@angular/material/icon';

import {
  MaterialModule
} from '../../../shared/AngularMaterial';

import {
  CategoryService
} from '../../../services/category.service';



import {
  CartService
} from '../../../services/cart.service';

import {
  Category
} from '../../../models/category.model';



import {
  LanguageService
} from '../../../services/language.service';

import {
  TranslatePipe
} from '@ngx-translate/core';


// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-header',

  standalone: true,

  imports: [
    CommonModule,
    RouterModule,
    MaterialModule,
    MatIconModule,
    TranslatePipe
  ],

  templateUrl: './header.component.html',

  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit {

  // ==========================================================
  // SERVICES
  // ==========================================================

  private readonly categoryService =
    inject(CategoryService);



  private readonly cartService =
    inject(CartService);

  private readonly router =
    inject(Router);

  public readonly languageService =
    inject(LanguageService);


  // ==========================================================
  // CART
  // ==========================================================

  cartCount = signal(0);


  // ==========================================================
  // SEARCH
  // ==========================================================

  searchTerm = signal('');

  mobileSearchOpen = signal(false);


  // ==========================================================
  // MENU STATE
  // ==========================================================

  categoryMenuOpen =
    signal(false);



  expandedCategoryId =
    signal<number | null>(null);

  mobileMenuOpen =
    signal(false);


  // ==========================================================
  // CATEGORIES
  // ==========================================================

  categories =
    signal<Category[]>([]);

  isLoadingCategories =
    signal(false);

  categoryError =
    signal<string | null>(null);



  // ==========================================================
  // INIT
  // ==========================================================

  ngOnInit(): void {

    this.loadCategories();


    this.loadCartCount();

  }


  // ==========================================================
  // SEARCH
  // ==========================================================

  searchProducts(): void {

    const search =
      this.searchTerm().trim();

    this.closeAllMenus();

    if (!search) {

      this.router.navigate(
        ['/products'],
        {
          queryParams: {}
        }
      );

      return;

    }

    /*
     * Only send the search term through
     * the URL.
     *
     * ProductListComponent will call
     * the API exactly once.
     */

    this.router.navigate(
      ['/products'],
      {
        queryParams: {
          search
        }
      }
    );

    this.mobileSearchOpen.set(false);

  }


  // ==========================================================
  // MOBILE SEARCH
  // ==========================================================

  toggleMobileSearch(): void {

    this.mobileSearchOpen.update(
      open => !open
    );

  }


  closeMobileSearch(): void {

    this.mobileSearchOpen.set(false);

  }


  // ==========================================================
  // LANGUAGE
  // ==========================================================

  getCategoryName(
    category: Category
  ): string {

    if (
      this.languageService.isArabic()
    ) {

      return category.nameAr?.trim()
        ? category.nameAr
        : category.nameEn;

    }

    return category.nameEn?.trim()
      ? category.nameEn
      : category.nameAr;

  }



  // ==========================================================
  // CART
  // ==========================================================

  private loadCartCount(): void {

    this.cartService.cartCount$
      .subscribe(count => {

        this.cartCount.set(count);

      });

  }


  // ==========================================================
  // CATEGORY MENU
  // ==========================================================

  openCategoryMenu(): void {

    this.categoryMenuOpen.set(true);



  }


  closeCategoryMenu(): void {

    this.categoryMenuOpen.set(false);

  }


  toggleCategoryMenu(): void {
    const open =
      !this.categoryMenuOpen();

    this.categoryMenuOpen.set(open);

  

    if (!open) {

      this.expandedCategoryId.set(null);

    }

  }



  // ==========================================================
  // LOAD CATEGORIES
  // ==========================================================

  loadCategories(): void {

    this.isLoadingCategories.set(true);

    this.categoryError.set(null);

    this.categoryService
      .getCategoriesMenu()
      .subscribe({

        next: (response: any) => {

          const data =
            response?.data ??
            response ??
            [];

          this.categories.set(
            (data ?? []).filter(
              (category: Category) =>
                !!category
            )
          );

          this.isLoadingCategories.set(false);

        },

        error: error => {

          console.error(
            'Error loading categories:',
            error
          );

          this.categoryError.set(
            'Unable to load categories.'
          );

          this.isLoadingCategories.set(false);

        }

      });

  }




  // ==========================================================
  // CATEGORY EXPANSION
  // ==========================================================

  toggleCategory(
    categoryId: number
  ): void {
    if (
      this.expandedCategoryId() ===
      categoryId
    ) {

      this.expandedCategoryId.set(
        null
      );

      return;

    }

    this.expandedCategoryId.set(
      categoryId
    );
this.router.navigate(
      ['/products'],
      {
        queryParams: {
          category: categoryId
        }
      }
    );
  }


  // ==========================================================
  // PRODUCTS
  // ==========================================================

  selectAllProducts(): void {

    this.closeAllMenus();

    this.router.navigate([
      '/products'
    ]);

  }


  isProductsPage(): boolean {

    return this.router.url
      .split('?')[0]
      .startsWith('/products');

  }


  // ==========================================================
  // SUBCATEGORY
  // ==========================================================

  selectSubCategory(
    subCategoryId: number
  ): void {

    this.closeAllMenus();

    this.router.navigate(
      ['/products'],
      {
        queryParams: {
          subcategory: subCategoryId
        }
      }
    );

  }


  // ==========================================================
  // OFFERS
  // ==========================================================

  selectOffers(): void {

    this.closeAllMenus();

    this.router.navigate(
      ['/products'],
      {
        queryParams: {
          offers: true
        }
      }
    );

  }


 

  // ==========================================================
  // MOBILE MENU
  // ==========================================================

  openMobileMenu(): void {

    this.mobileMenuOpen.set(true);

  }


  closeMobileMenu(): void {

    this.mobileMenuOpen.set(false);

    this.categoryMenuOpen.set(false);


    this.expandedCategoryId.set(null);

  }


  // ==========================================================
  // CLOSE EVERYTHING
  // ==========================================================

  private closeAllMenus(): void {

    this.categoryMenuOpen.set(false);


    this.expandedCategoryId.set(null);

    this.mobileMenuOpen.set(false);

  }


  // ==========================================================
  // CLICK OUTSIDE
  // ==========================================================

  @HostListener(
    'document:click',
    ['$event']
  )
  onDocumentClick(
    event: MouseEvent
  ): void {

    const target =
      event.target as HTMLElement;

    const insideHeader =
      !!target.closest('.main-header');

    const insideSidebar =
      !!target.closest('.mobile-sidebar');

    const insideBottomNav =
      !!target.closest('.mobile-bottom-nav');

    if (
      !insideHeader &&
      !insideSidebar &&
      !insideBottomNav
    ) {

      this.closeAllMenus();

      this.closeMobileSearch();

    }

  }

}