
import {
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  MatDialog,
  MatDialogModule
} from '@angular/material/dialog';

import { MatButtonModule } from '@angular/material/button';

import {
  ActivatedRoute,
  Router
} from '@angular/router';

import {
  takeUntilDestroyed
} from '@angular/core/rxjs-interop';

import { ProductService } from '../../../services/product.service';
import { CartService } from '../../../services/cart.service';
import { CategoryService } from '../../../services/category.service';
import { LanguageService } from '../../../services/language.service';

import {
  Product
} from '../../../models/product.model';

import { ProductModalComponent } from '../product-modal/product-modal.component';

import { environment } from '../../../../environments/environment';

import { MaterialModule } from '../../../shared/AngularMaterial';

import { TranslatePipe } from '@ngx-translate/core';

import {
  ProductCardComponent
} from '../product-card.component/product-card.component';

import {
  ProductFiltersComponent
} from '../product-filters.component/product-filters.component';

import { CategoryFilter } from '../../../models/category.model';

import {
  ProductPageResponse
} from '../../../models/pagination.model';


@Component({
  selector: 'app-product-list',

  standalone: true,

  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MaterialModule,
    TranslatePipe,
    ProductCardComponent,
    ProductFiltersComponent
  ],

  templateUrl: './product-list.component.html',

  styleUrls: [
    './product-list.component.css'
  ]
})
export class ProductListComponent implements OnInit {

  // ========================================================
  // DEPENDENCIES
  // ========================================================

  private readonly productService =
    inject(ProductService);

  private readonly cartService =
    inject(CartService);

  private readonly categoryService =
    inject(CategoryService);

  private readonly dialog =
    inject(MatDialog);

  private readonly route =
    inject(ActivatedRoute);

  private readonly router =
    inject(Router);

  private readonly destroyRef =
    inject(DestroyRef);


  // ========================================================
  // SERVICES USED BY TEMPLATE
  // ========================================================

  public readonly languageService =
    inject(LanguageService);


  // ========================================================
  // PRODUCTS
  // ========================================================

  readonly allLoadedProducts =
    signal<Product[]>([]);

  readonly searchResults =
    signal<Product[]>([]);

  readonly products =
    signal<Product[]>([]);

  readonly filteredProducts =
    signal<Product[]>([]);

  readonly unfilteredTotalCount =
    signal<number>(0);


  // ========================================================
  // SEARCH
  // ========================================================

  readonly searchName =
    signal<string>('');

  readonly hasSearch =
    computed(() =>
      this.searchName().trim().length > 0
    );


  // ========================================================
  // PAGINATION
  // ========================================================

  private currentPage = 0;

  readonly hasMoreProducts =
    signal<boolean>(true);

  readonly isLoadingMore =
    signal<boolean>(false);


  // ========================================================
  // QUANTITIES
  // ========================================================

  readonly quantities =
    signal<Record<number, number>>({});


  // ========================================================
  // IMAGE API
  // ========================================================

  readonly api =
    environment.imageApiBaseUrl;


  // ========================================================
  // CATEGORIES
  // ========================================================

  readonly categories =
    signal<CategoryFilter[]>([]);


  // ========================================================
  // SELECTED CATEGORY
  // ========================================================

  readonly selectedCategoryId =
    signal<number | null>(null);


  // ========================================================
  // OFFERS
  // ========================================================

  readonly showOffers =
    signal<boolean>(false);


  // ========================================================
  // CART SUCCESS
  // ========================================================

  readonly addedToCartProductId =
    signal<number | null>(null);

  private addedToCartTimer?:
    ReturnType<typeof setTimeout>;


  // ========================================================
  // ALREADY IN CART
  // ========================================================

  readonly alreadyInCartProductId =
    signal<number | null>(null);

  private alreadyInCartMessageTimer?:
    ReturnType<typeof setTimeout>;


  // ========================================================
  // API FILTERS
  // ========================================================

  readonly hasApiFilters =
    computed(() =>
      this.selectedCategoryId() !== null ||
      this.showOffers()
    );


  // ========================================================
  // ALL PRODUCTS LOADED
  // ========================================================

  readonly allUnfilteredProductsLoaded =
    computed(() => {

      const total =
        this.unfilteredTotalCount();

      const loaded =
        this.allLoadedProducts().length;

      if (total <= 0) {
        return false;
      }

      return loaded >= total;
    });


  // ========================================================
  // ACTIVE FILTER COUNT
  // ========================================================

  readonly activeFilterCount =
    computed(() => {

      let count = 0;

      if (
        this.selectedCategoryId() !== null
      ) {
        count++;
      }

      if (
        this.showOffers()
      ) {
        count++;
      }

      if (
        this.hasSearch()
      ) {
        count++;
      }

      return count;
    });


  // ========================================================
  // LOADING
  // ========================================================

  readonly isLoading =
    signal<boolean>(true);

  readonly isLoadingCategories =
    signal<boolean>(true);


  // ========================================================
  // REQUEST VERSION
  // ========================================================

  private requestVersion = 0;


  // ========================================================
  // INIT
  // ========================================================

  ngOnInit(): void {

    this.loadCategories();

    this.route.queryParams
      .pipe(
        takeUntilDestroyed(
          this.destroyRef
        )
      )
      .subscribe(params => {

        const newSearch =
          String(
            params['search'] ?? ''
          ).trim();

        const previousSearch =
          this.searchName().trim();


        // --------------------------------------------------
        // CATEGORY
        // --------------------------------------------------

        this.selectedCategoryId.set(
          this.parseId(
            params['category']
          )
        );


        // --------------------------------------------------
        // OFFERS
        // --------------------------------------------------

        this.showOffers.set(
          params['offers'] === 'true'
        );


        // --------------------------------------------------
        // SEARCH
        // --------------------------------------------------

        this.searchName.set(
          newSearch
        );


        // --------------------------------------------------
        // SEARCH CHANGED
        // --------------------------------------------------

        if (
          newSearch !== previousSearch
        ) {

          this.loadProducts();

          return;
        }


        // --------------------------------------------------
        // SEARCH ACTIVE
        // --------------------------------------------------

        if (
          newSearch
        ) {

          this.applyCurrentLocalFilters();

          return;
        }


        // --------------------------------------------------
        // NORMAL MODE
        // --------------------------------------------------

        this.loadProducts();

      });
  }


  // ========================================================
  // CATEGORY NAME
  // ========================================================

  getCategoryName(
    category: CategoryFilter
  ): string {

    if (
      this.languageService.isArabic()
    ) {

      return (
        category.nameAr?.trim() ||
        category.nameEn ||
        ''
      );
    }

    return (
      category.nameEn?.trim() ||
      category.nameAr ||
      ''
    );
  }


  // ========================================================
  // PARSE ID
  // ========================================================

  private parseId(
    value: unknown
  ): number | null {

    if (
      value === undefined ||
      value === null ||
      value === ''
    ) {
      return null;
    }

    const id =
      Number(value);

    return Number.isNaN(id)
      ? null
      : id;
  }


  // ========================================================
  // LOAD CATEGORIES
  // ========================================================

  private loadCategories(): void {

    this.isLoadingCategories.set(
      true
    );

    this.categoryService
      .getCategoriesMenu()
      .pipe(
        takeUntilDestroyed(
          this.destroyRef
        )
      )
      .subscribe({

        next: (response: any) => {

          const data =
            response?.data ??
            response ??
            [];

          const mappedCategories:
            CategoryFilter[] =
            (data as any[]).map(
              (category: any) => {

                return {

                  id:
                    Number(
                      category.id
                    ),

                  nameEn:
                    category.nameEn ??
                    '',

                  nameAr:
                    category.nameAr ??
                    ''
                };

              }
            );

          this.categories.set(
            mappedCategories
          );

          this.isLoadingCategories.set(
            false
          );
        },

        error: () => {

          this.categories.set([]);

          this.isLoadingCategories.set(
            false
          );
        }

      });
  }


  // ========================================================
  // LOAD PRODUCTS
  // ========================================================

  loadProducts(): void {

    const requestVersion =
      ++this.requestVersion;

    const search =
      this.searchName().trim();


    // ======================================================
    // SEARCH MODE
    // ======================================================

    if (search) {

      this.loadSearchResults(
        search,
        requestVersion
      );

      return;
    }


    // ======================================================
    // NORMAL MODE
    // ======================================================

    this.searchResults.set([]);


    // ------------------------------------------------------
    // FILTER ACTIVE + ALL PRODUCTS LOADED
    // ------------------------------------------------------

    if (
      this.hasApiFilters() &&
      this.allUnfilteredProductsLoaded()
    ) {

      this.applyLocalApiFilters();

      this.isLoading.set(false);

      return;
    }


    // ------------------------------------------------------
    // FILTER ACTIVE
    // ------------------------------------------------------

    if (
      this.hasApiFilters()
    ) {

      this.loadFilteredProductsFromApi(
        requestVersion
      );

      return;
    }


    // ------------------------------------------------------
    // CACHE EXISTS
    // ------------------------------------------------------

    if (
      this.allLoadedProducts().length > 0
    ) {

      const cachedProducts =
        this.allLoadedProducts();

      this.products.set(
        cachedProducts
      );

      this.filteredProducts.set(
        cachedProducts
      );

      this.resetQuantities(
        cachedProducts
      );

      this.isLoading.set(false);

      return;
    }


    // ------------------------------------------------------
    // FIRST LOAD
    // ------------------------------------------------------

    this.loadFirstPage(
      requestVersion
    );
  }


  // ========================================================
  // LOAD SEARCH RESULTS
  // ========================================================

  private loadSearchResults(
    search: string,
    requestVersion: number
  ): void {

    this.isLoading.set(true);

    this.isLoadingMore.set(false);

    this.productService
      .getProductsByName(search)
      .pipe(
        takeUntilDestroyed(
          this.destroyRef
        )
      )
      .subscribe({

        next: (
          response: Product[]
        ) => {

          if (
            requestVersion !==
            this.requestVersion
          ) {
            return;
          }

          const results =
            response ?? [];

          this.searchResults.set(
            results
          );

          this.hasMoreProducts.set(
            false
          );

          this.currentPage = 0;

          this.applyCurrentLocalFilters();

          this.isLoading.set(false);

        },

        error: () => {

          if (
            requestVersion !==
            this.requestVersion
          ) {
            return;
          }

          this.searchResults.set([]);

          this.products.set([]);

          this.filteredProducts.set([]);

          this.quantities.set({});

          this.hasMoreProducts.set(false);

          this.isLoading.set(false);

          this.isLoadingMore.set(false);
        }

      });
  }


  // ========================================================
  // LOAD FIRST PAGE
  // ========================================================

  private loadFirstPage(
    requestVersion: number
  ): void {

    this.isLoading.set(true);

    this.isLoadingMore.set(false);

    this.currentPage = 1;

    this.productService
      .getProducts(
        1,
        null,
        false
      )
      .pipe(
        takeUntilDestroyed(
          this.destroyRef
        )
      )
      .subscribe({

        next: (
          response: ProductPageResponse
        ) => {

          if (
            requestVersion !==
            this.requestVersion
          ) {
            return;
          }

          const loadedProducts =
            response.items ?? [];

          this.allLoadedProducts.set(
            loadedProducts
          );

          this.unfilteredTotalCount.set(
            response.totalCount ??
            loadedProducts.length
          );

          this.currentPage =
            response.page ?? 1;

          this.hasMoreProducts.set(
            response.hasMore === true
          );

          this.products.set(
            loadedProducts
          );

          this.filteredProducts.set(
            loadedProducts
          );

          this.resetQuantities(
            loadedProducts
          );

          this.isLoading.set(false);
        },

        error: () => {

          if (
            requestVersion !==
            this.requestVersion
          ) {
            return;
          }

          this.products.set([]);

          this.filteredProducts.set([]);

          this.allLoadedProducts.set([]);

          this.unfilteredTotalCount.set(0);

          this.quantities.set({});

          this.hasMoreProducts.set(false);

          this.isLoading.set(false);

          this.isLoadingMore.set(false);
        }

      });
  }


  // ========================================================
  // LOAD NEXT PAGE
  // ========================================================

  private loadNextPage(): void {

    if (
      this.hasSearch()
    ) {
      return;
    }

    if (
      this.isLoading() ||
      this.isLoadingMore() ||
      !this.hasMoreProducts()
    ) {
      return;
    }

    if (
      this.hasApiFilters()
    ) {
      return;
    }

    const nextPage =
      this.currentPage + 1;

    this.isLoadingMore.set(true);

    this.productService
      .getProducts(
        nextPage,
        null,
        false
      )
      .pipe(
        takeUntilDestroyed(
          this.destroyRef
        )
      )
      .subscribe({

        next: (
          response: ProductPageResponse
        ) => {

          const newProducts =
            response.items ?? [];

          const existingProducts =
            this.allLoadedProducts();

          const existingIds =
            new Set(
              existingProducts.map(
                product =>
                  product.id
              )
            );

          const uniqueProducts =
            newProducts.filter(
              product =>
                !existingIds.has(
                  product.id
                )
            );


          if (
            uniqueProducts.length > 0
          ) {

            const updatedProducts = [
              ...existingProducts,
              ...uniqueProducts
            ];

            this.allLoadedProducts.set(
              updatedProducts
            );

            this.products.set(
              updatedProducts
            );

            this.filteredProducts.set(
              updatedProducts
            );

            this.addQuantities(
              uniqueProducts
            );
          }


          this.currentPage =
            response.page ??
            nextPage;

          this.unfilteredTotalCount.set(
            response.totalCount ??
            this.unfilteredTotalCount()
          );

          this.hasMoreProducts.set(
            response.hasMore === true
          );

          this.isLoadingMore.set(false);
        },

        error: () => {

          this.isLoadingMore.set(false);
        }

      });
  }


  // ========================================================
  // LOAD FILTERED PRODUCTS
  // ========================================================

  private loadFilteredProductsFromApi(
    requestVersion: number
  ): void {

    this.isLoading.set(true);

    this.isLoadingMore.set(false);

    this.productService
      .getProducts(
        1,
        this.selectedCategoryId(),
        this.showOffers()
      )
      .pipe(
        takeUntilDestroyed(
          this.destroyRef
        )
      )
      .subscribe({

        next: (
          response: ProductPageResponse
        ) => {

          if (
            requestVersion !==
            this.requestVersion
          ) {
            return;
          }

          const filtered =
            response.items ?? [];

          this.products.set(
            filtered
          );

          this.filteredProducts.set(
            filtered
          );

          this.resetQuantities(
            filtered
          );

          this.isLoading.set(false);
        },

        error: () => {

          if (
            requestVersion !==
            this.requestVersion
          ) {
            return;
          }

          this.products.set([]);

          this.filteredProducts.set([]);

          this.quantities.set({});

          this.isLoading.set(false);

          this.isLoadingMore.set(false);
        }

      });
  }


  // ========================================================
  // APPLY LOCAL API FILTERS
  // ========================================================

  private applyLocalApiFilters(): void {

    const filtered =
      this.filterProducts(
        this.allLoadedProducts()
      );

    this.products.set(
      filtered
    );

    this.filteredProducts.set(
      filtered
    );

    this.resetQuantities(
      filtered
    );

    this.isLoading.set(false);
  }


  // ========================================================
  // APPLY SEARCH FILTERS
  // ========================================================

  private applyCurrentLocalFilters(): void {

    const source =
      this.searchResults();

    const filtered =
      this.filterProducts(
        source
      );

    this.products.set(
      source
    );

    this.filteredProducts.set(
      filtered
    );

    this.resetQuantities(
      filtered
    );

    this.isLoading.set(false);
  }


  // ========================================================
  // LOCAL FILTER LOGIC
  // ========================================================

  private filterProducts(
    source: Product[]
  ): Product[] {

    const categoryId =
      this.selectedCategoryId();

    const offers =
      this.showOffers();

    return source.filter(
      product => {

        // --------------------------------------------------
        // CATEGORY
        // --------------------------------------------------

        if (
          categoryId !== null
        ) {

          // Keep your actual category
          // relation/property here.

          const productCategoryId =
            Number(
              (product as any).categoryId
            );

          if (
            productCategoryId !==
            categoryId
          ) {

            return false;
          }
        }


        // --------------------------------------------------
        // OFFERS
        // --------------------------------------------------

        if (
          offers &&
          Number(
            product.discountPercentage ?? 0
          ) <= 0
        ) {

          return false;
        }

        return true;
      }
    );
  }


  // ========================================================
  // FILTER APPLIED
  // ========================================================

  onFilterApplied(
    filters: any
  ): void {

    this.selectedCategoryId.set(
      filters.categoryId
    );

    this.showOffers.set(
      filters.offers
    );

    this.navigateWithCurrentFilters();
  }


  // ========================================================
  // MOBILE FILTER DIALOG
  // ========================================================

  openMobileFilters(): void {

    const dialogRef =
      this.dialog.open(
        ProductFiltersComponent,
        {
          width: '95vw',
          maxWidth: '500px',
          maxHeight: '90vh',
          autoFocus: false,
          panelClass:
            'product-filter-dialog'
        }
      );

    const component =
      dialogRef.componentInstance;

    component.categories =
      this.categories();

    component.selectedCategoryId =
      this.selectedCategoryId();

    component.showOffers =
      this.showOffers();

    component.syncInputs();


    const filterSubscription =
      component.filterApplied.subscribe(
        filters => {

          this.onFilterApplied(
            filters
          );

          dialogRef.close();
        }
      );


    const clearSubscription =
      component.clearFiltersEvent.subscribe(
        () => {

          this.clearFilters();

          dialogRef.close();
        }
      );


    dialogRef.afterClosed()
      .pipe(
        takeUntilDestroyed(
          this.destroyRef
        )
      )
      .subscribe(() => {

        filterSubscription.unsubscribe();

        clearSubscription.unsubscribe();
      });
  }


  // ========================================================
  // CLEAR CATEGORY
  // ========================================================

  clearCategory(): void {

    this.selectedCategoryId.set(null);

    this.navigateWithCurrentFilters();
  }


  // ========================================================
  // CLEAR OFFERS
  // ========================================================

  clearOffers(): void {

    this.showOffers.set(false);

    this.navigateWithCurrentFilters();
  }


  // ========================================================
  // CLEAR SEARCH
  // ========================================================

  clearSearch(): void {

    this.searchName.set('');

    this.searchResults.set([]);

    this.navigateWithCurrentFilters();
  }


  // ========================================================
  // INFINITE SCROLL
  // ========================================================

  @HostListener('window:scroll')
  onWindowScroll(): void {

    if (
      this.hasSearch()
    ) {
      return;
    }

    if (
      this.hasApiFilters()
    ) {
      return;
    }

    if (
      this.isLoading() ||
      this.isLoadingMore() ||
      !this.hasMoreProducts()
    ) {
      return;
    }

    const scrollPosition =
      window.innerHeight +
      window.scrollY;

    const pageHeight =
      document.documentElement.scrollHeight;

    if (
      scrollPosition >=
      pageHeight - 500
    ) {

      this.loadNextPage();
    }
  }


  // ========================================================
  // QUANTITIES
  // ========================================================

  private resetQuantities(
    products: Product[]
  ): void {

    const quantityMap:
      Record<number, number> = {};

    products.forEach(
      product => {

        quantityMap[
          product.id
        ] = 0;

      }
    );

    this.quantities.set(
      quantityMap
    );
  }


  // ========================================================
  // ADD QUANTITIES
  // ========================================================

  private addQuantities(
    products: Product[]
  ): void {

    this.quantities.update(
      current => {

        const updated = {
          ...current
        };

        products.forEach(
          product => {

            if (
              updated[
                product.id
              ] === undefined
            ) {

              updated[
                product.id
              ] = 0;

            }

          }
        );

        return updated;
      }
    );
  }


  // ========================================================
  // NAVIGATION
  // ========================================================

  private navigateWithCurrentFilters(): void {

    const queryParams:
      Record<string, string> = {};


    // ------------------------------------------------------
    // SEARCH
    // ------------------------------------------------------

    const search =
      this.searchName().trim();

    if (search) {

      queryParams['search'] =
        search;
    }


    // ------------------------------------------------------
    // CATEGORY
    // ------------------------------------------------------

    const categoryId =
      this.selectedCategoryId();

    if (
      categoryId !== null
    ) {

      queryParams['category'] =
        String(categoryId);
    }


    // ------------------------------------------------------
    // OFFERS
    // ------------------------------------------------------

    if (
      this.showOffers()
    ) {

      queryParams['offers'] =
        'true';
    }


    this.router.navigate(
      ['/products'],
      {
        queryParams,
        replaceUrl: true
      }
    );
  }


  // ========================================================
  // CLEAR ALL FILTERS
  // ========================================================

  clearFilters(): void {

    this.selectedCategoryId.set(null);

    this.showOffers.set(false);

    this.searchName.set('');

    this.searchResults.set([]);


    // ------------------------------------------------------
    // SHOW CACHE IMMEDIATELY
    // ------------------------------------------------------

    if (
      this.allLoadedProducts().length > 0
    ) {

      const cached =
        this.allLoadedProducts();

      this.products.set(
        cached
      );

      this.filteredProducts.set(
        cached
      );

      this.resetQuantities(
        cached
      );

      this.isLoading.set(false);
    }


    // ------------------------------------------------------
    // REMOVE QUERY PARAMETERS
    // ------------------------------------------------------

    this.router.navigate(
      ['/products'],
      {
        queryParams: {},
        replaceUrl: true
      }
    );
  }


  // ========================================================
  // SELECTED CATEGORY NAME
  // ========================================================

  get selectedCategoryName(): string {

    const id =
      this.selectedCategoryId();

    if (
      id === null
    ) {

      return '';
    }

    const category =
      this.categories().find(
        category =>
          Number(
            category.id
          ) === id
      );

    if (!category) {

      return '';
    }

    return this.getCategoryName(
      category
    );
  }


  // ========================================================
  // DISCOUNTED PRICE
  // ========================================================

  getDiscountedPrice(
    product: Product
  ): number {

    const price =
      Number(
        product.price || 0
      );

    const discount =
      Number(
        product.discountPercentage ?? 0
      );

    if (
      discount <= 0
    ) {

      return price;
    }

    return Math.max(
      0,
      price -
      (
        price *
        discount /
        100
      )
    );
  }


  // ========================================================
  // HAS DISCOUNT
  // ========================================================

  hasDiscount(
    product: Product
  ): boolean {

    return Number(
      product.discountPercentage ?? 0
    ) > 0;
  }


  // ========================================================
  // QUANTITY
  // ========================================================

  setQuantity(
    productId: number,
    value: number | string
  ): void {

    let quantity =
      Number(value);

    if (
      Number.isNaN(quantity) ||
      quantity < 0
    ) {

      quantity = 0;
    }

    quantity =
      Math.floor(quantity);

    this.quantities.update(
      current => ({

        ...current,

        [productId]:
          quantity

      })
    );
  }


  // ========================================================
  // GET QUANTITY
  // ========================================================

  getQuantity(
    productId: number
  ): number {

    return (
      this.quantities()[productId] ??
      0
    );
  }


  // ========================================================
  // ADD TO CART
  // ========================================================

  addToCart(
    product: Product
  ): void {

    // ======================================================
    // CHECK PRODUCT VARIANTS
    // ======================================================

    const hasSizes =
      Array.isArray(
        (product as any).sizes
      ) &&
      (product as any).sizes.length > 0;


    const hasHeelSizes =
      Array.isArray(
        (product as any).heelSizes
      ) &&
      (product as any).heelSizes.length > 0;


    // ======================================================
    // NO SIZE + NO HEEL SIZE
    // → ADD DIRECTLY
    // ======================================================

    if (
      !hasSizes &&
      !hasHeelSizes
    ) {

      this.addProductDirectlyToCart(
        product
      );

      return;
    }


    // ======================================================
    // HAS SIZE OR HEEL SIZE
    // → OPEN MODAL
    // ======================================================

    this.openProductModal(
      product
    );
  }


  // ========================================================
  // DIRECT CART ADD
  // ========================================================

  private addProductDirectlyToCart(
    product: Product
  ): void {

    const alreadyExists =
      this.cartService.addToCart(
        product
      );


    // ------------------------------------------------------
    // ALREADY EXISTS
    // ------------------------------------------------------

    if (!alreadyExists) {

      this.addedToCartProductId.set(
        null
      );

      this.showAlreadyInCartMessage(
        product.id
      );

      return;
    }


    // ------------------------------------------------------
    // SUCCESS
    // ------------------------------------------------------

    this.alreadyInCartProductId.set(
      null
    );

    this.showAddedToCartSuccess(
      product.id
    );
  }


  // ========================================================
  // OPEN PRODUCT MODAL
  // ========================================================

  private openProductModal(
    product: Product
  ): void {

    const dialogRef =
      this.dialog.open(
        ProductModalComponent,
        {

          width: '800px',

          maxWidth: '95vw',

          maxHeight: '90vh',

          data: product,

          disableClose: false

        }
      );


    // ======================================================
    // MODAL CLOSED
    // ======================================================

    dialogRef.afterClosed()
      .pipe(
        takeUntilDestroyed(
          this.destroyRef
        )
      )
      .subscribe(
        result => {

          // User closed modal
          // without adding anything.

          if (!result) {
            return;
          }


          // ------------------------------------------------
          // MODAL RETURNS PRODUCT
          // ------------------------------------------------

          this.addSelectedProductToCart(
            result
          );

        }
      );
  }


  // ========================================================
  // ADD SELECTED VARIANT
  // ========================================================

  private addSelectedProductToCart(
    result: any
  ): void {

    /*
     * The modal can return either:
     *
     * 1. Product directly
     *
     * OR
     *
     * 2. {
     *      product: product,
     *      size: selectedSize,
     *      heelSize: selectedHeelSize
     *    }
     *
     * We support both.
     */

    const product =
      result.product ??
      result;


    if (!product) {
      return;
    }


    // ------------------------------------------------------
    // Add selected product/variant
    // ------------------------------------------------------

    const alreadyExists =
      this.cartService.addToCart(
        result.product
          ? result
          : product
      );


    // ------------------------------------------------------
    // ALREADY IN CART
    // ------------------------------------------------------

    if (!alreadyExists) {

      this.addedToCartProductId.set(
        null
      );

      this.showAlreadyInCartMessage(
        product.id
      );

      return;
    }


    // ------------------------------------------------------
    // SUCCESS
    // ------------------------------------------------------

    this.alreadyInCartProductId.set(
      null
    );

    this.showAddedToCartSuccess(
      product.id
    );
  }


  // ========================================================
  // SUCCESS MESSAGE
  // ========================================================

  private showAddedToCartSuccess(
    productId: number
  ): void {

    if (
      this.addedToCartTimer
    ) {

      clearTimeout(
        this.addedToCartTimer
      );
    }


    this.addedToCartProductId.set(
      productId
    );


    this.addedToCartTimer =
      setTimeout(() => {

        if (
          this.addedToCartProductId() ===
          productId
        ) {

          this.addedToCartProductId.set(
            null
          );
        }

      }, 1500);
  }


  // ========================================================
  // ALREADY IN CART MESSAGE
  // ========================================================

  private showAlreadyInCartMessage(
    productId: number
  ): void {

    this.alreadyInCartProductId.set(
      productId
    );


    if (
      this.alreadyInCartMessageTimer
    ) {

      clearTimeout(
        this.alreadyInCartMessageTimer
      );
    }


    this.alreadyInCartMessageTimer =
      setTimeout(() => {

        if (
          this.alreadyInCartProductId() ===
          productId
        ) {

          this.alreadyInCartProductId.set(
            null
          );
        }

      }, 3000);
  }


  // ========================================================
  // PRODUCT DETAILS
  // ========================================================

  openProductDetails(
    product: Product
  ): void {

    this.router.navigate(
      [
        '/product',
        product.id
      ]
    );
  }


  // ========================================================
  // IMAGE URL
  // ========================================================

  getImageUrl(
    imageUrl?: string | null
  ): string {

    if (!imageUrl) {

      return 'assets/images/product-placeholder.png';
    }


    if (
      imageUrl.startsWith('http://') ||
      imageUrl.startsWith('https://')
    ) {

      return imageUrl;
    }


    return `${this.api}${imageUrl}`;
  }

}
