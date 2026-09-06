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
import { BrandService } from '../../../services/brand.service';
import { LanguageService } from '../../../services/language.service';

import {
  Product,
  ProductFilterValue
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
import { SubCategoryFilter } from '../../../models/subCategory.model';
import { BrandFilter } from '../../../models/brand.model';
import { ProductPageResponse } from '../../../models/pagination.model';


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

  private readonly productService = inject(ProductService);
  private readonly cartService = inject(CartService);
  private readonly categoryService = inject(CategoryService);
  private readonly brandService = inject(BrandService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
private readonly destroyRef = inject(DestroyRef);

  // ========================================================
  // SERVICES USED BY TEMPLATE
  // ========================================================

  public readonly languageService = inject(LanguageService);

  // ========================================================
  // PRODUCTS
  // ========================================================

  /**
   * Normal catalog products already loaded from the API.
   *
   * This is used as the local cache for the normal catalog.
   */
  readonly allLoadedProducts =
    signal<Product[]>([]);

  /**
   * Products returned by /products/by-name.
   *
   * While a search is active, all filters are applied
   * locally against this array.
   */
  readonly searchResults =
    signal<Product[]>([]);

  /**
   * Current product source.
   */
  readonly products =
    signal<Product[]>([]);

  /**
   * Final products displayed after local filtering.
   */
  readonly filteredProducts =
    signal<Product[]>([]);

  /**
   * Total number of products in the normal,
   * unfiltered catalog.
   */
  readonly unfilteredTotalCount =
    signal<number>(0);

  // ========================================================
  // SEARCH
  // ========================================================

  /**
   * Current search term.
   *
   * This is populated from the URL:
   *
   * /products?search=lipstick
   */
  readonly searchName =
    signal<string>('');

  /**
   * Whether the current page is in search mode.
   */
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

  readonly subCategories =
    signal<SubCategoryFilter[]>([]);

  // ========================================================
  // BRANDS
  // ========================================================

  readonly brands =
    signal<BrandFilter[]>([]);

  // ========================================================
  // SELECTED FILTERS
  // ========================================================

  readonly selectedCategoryId =
    signal<number | null>(null);

  readonly selectedSubCategoryId =
    signal<number | null>(null);

  readonly selectedBrandId =
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
  // NORMAL API FILTERS ACTIVE
  // ========================================================

  /**
   * These filters are still used by the normal catalog.
   *
   * IMPORTANT:
   *
   * When search is active, these filters are NOT sent
   * to the API. They are applied locally to searchResults.
   */
  readonly hasApiFilters =
    computed(() =>
      this.selectedCategoryId() !== null ||
      this.selectedSubCategoryId() !== null ||
      this.selectedBrandId() !== null ||
      this.showOffers()
    );

  // ========================================================
  // ALL NORMAL PRODUCTS LOADED
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
        this.selectedSubCategoryId() !== null
      ) {
        count++;
      }

      if (
        this.selectedBrandId() !== null
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

  readonly isLoadingBrands =
    signal<boolean>(true);

  // ========================================================
  // REQUEST VERSION
  // ========================================================

  /**
   * Prevents an old response from replacing newer data.
   *
   * Example:
   *
   * Search "cream"
   * Search "lipstick"
   * Clear search
   *
   * An old "cream" response will be ignored.
   */
  private requestVersion = 0;

  // ========================================================
  // CART MESSAGE
  // ========================================================

  readonly alreadyInCartProductId =
    signal<number | null>(null);

  private alreadyInCartMessageTimer?:
    ReturnType<typeof setTimeout>;

  // ========================================================
  // CONSTRUCTOR
  // ========================================================

  constructor() {}

  // ========================================================
  // INIT
  // ========================================================

  ngOnInit(): void {

    this.loadCategories();

    this.loadBrands();

    this.route.queryParams
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(params => {

        const newSearch =
          String(
            params['search'] ?? ''
          ).trim();

        const previousSearch =
          this.searchName().trim();

        // --------------------------------------------------
        // READ FILTERS FROM URL
        // --------------------------------------------------

        this.selectedCategoryId.set(
          this.parseId(
            params['category']
          )
        );

        this.selectedSubCategoryId.set(
          this.parseId(
            params['subcategory']
          )
        );

        this.selectedBrandId.set(
          this.parseId(
            params['brand']
          )
        );

        this.showOffers.set(
          params['offers'] === 'true'
        );

        // --------------------------------------------------
        // READ SEARCH FROM URL
        // --------------------------------------------------

        this.searchName.set(
          newSearch
        );

        this.updateSubCategories();

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
        // SEARCH IS ACTIVE BUT ONLY FILTER CHANGED
        // --------------------------------------------------
        //
        // IMPORTANT:
        //
        // No API call here.
        //
        // The already downloaded searchResults are filtered
        // locally.
        //
        // --------------------------------------------------

        if (
          newSearch
        ) {

          this.applyCurrentLocalFilters();

          return;
        }

        // --------------------------------------------------
        // NORMAL PRODUCT MODE
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
  // SUBCATEGORY NAME
  // ========================================================

  getSubCategoryName(
    subCategory: SubCategoryFilter
  ): string {

    if (
      this.languageService.isArabic()
    ) {

      return (
        subCategory.nameAr?.trim() ||
        subCategory.nameEn ||
        ''
      );
    }

    return (
      subCategory.nameEn?.trim() ||
      subCategory.nameAr ||
      ''
    );
  }

  // ========================================================
  // BRAND NAME
  // ========================================================

  getBrandName(
    brand: BrandFilter
  ): string {

    if (
      this.languageService.isArabic()
    ) {

      return (
        brand.nameAr?.trim() ||
        brand.nameEn ||
        ''
      );
    }

    return (
      brand.nameEn?.trim() ||
      brand.nameAr ||
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

    this.isLoadingCategories.set(true);

    this.categoryService
      .getCategoriesMenu()
      .pipe(
        takeUntilDestroyed(this.destroyRef)
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

                const subCategories:
                  SubCategoryFilter[] =
                  (
                    category.subCategories ??
                    category.subcategories ??
                    []
                  ).map(
                    (subCategory: any) => ({

                      id:
                        Number(
                          subCategory.id
                        ),

                      nameEn:
                        subCategory.nameEn ??
                        '',

                      nameAr:
                        subCategory.nameAr ??
                        '',

                      categoryId:
                        subCategory.categoryId != null
                          ? Number(
                              subCategory.categoryId
                            )
                          : Number(
                              category.id
                            )
                    })
                  );

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
                    '',

                  subCategories
                };
              }
            );

          this.categories.set(
            mappedCategories
          );

          this.updateSubCategories();

          this.isLoadingCategories.set(
            false
          );
        },

        error: error => {

       

          this.categories.set([]);

          this.subCategories.set([]);

          this.isLoadingCategories.set(
            false
          );
        }
      });
  }

  // ========================================================
  // LOAD BRANDS
  // ========================================================

  private loadBrands(): void {

    this.isLoadingBrands.set(true);

    this.brandService
      .getBrands()
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({

        next: (response: any) => {

          const data =
            response?.data ??
            response ??
            [];

          const mappedBrands:
            BrandFilter[] =
            (data as any[]).map(
              (brand: any) => ({

                id:
                  Number(
                    brand.id
                  ),

                nameEn:
                  brand.nameEn ??
                  '',

                nameAr:
                  brand.nameAr ??
                  '',

                imageUrl:
                  brand.imageUrl ??
                  null
              })
            );

          this.brands.set(
            mappedBrands
          );

          this.isLoadingBrands.set(
            false
          );
        },

        error: error => {

       
          this.brands.set([]);

          this.isLoadingBrands.set(
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
    //
    // ONE API CALL.
    //
    // Filters are applied locally after the response.
    //
    // ======================================================

    if (
      search
    ) {

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
    // FILTER ACTIVE + ALL NORMAL PRODUCTS LOADED
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
    // FILTER ACTIVE + NOT ALL PRODUCTS LOADED
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
    // NO FILTERS + CACHE EXISTS
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
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({

        next: (response: Product[]) => {

          if (
            requestVersion !==
            this.requestVersion
          ) {
            return;
          }

          const results =
            response ?? [];

          // ------------------------------------------------
          // STORE SEARCH RESULTS
          // ------------------------------------------------

          this.searchResults.set(
            results
          );

          // ------------------------------------------------
          // SEARCH DOES NOT USE PAGINATION
          // ------------------------------------------------

          this.hasMoreProducts.set(false);

          this.currentPage = 0;

          // ------------------------------------------------
          // APPLY CATEGORY / BRAND / OFFERS LOCALLY
          // ------------------------------------------------

          this.applyCurrentLocalFilters();

          this.isLoading.set(false);

        },

        error: error => {

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
        null,
        null,
        false
      )
      .pipe(
        takeUntilDestroyed(this.destroyRef)
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

        error: error => {

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

    // ------------------------------------------------------
    // SEARCH RESULTS DO NOT USE NORMAL PAGINATION
    // ------------------------------------------------------

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

    // ------------------------------------------------------
    // FILTERED RESULTS DON'T USE NORMAL INFINITE SCROLL
    // ------------------------------------------------------

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
        null,
        null,
        false
      )
      .pipe(
        takeUntilDestroyed(this.destroyRef)
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

        error: error => {

         
          this.isLoadingMore.set(false);
        }
      });
  }

  // ========================================================
  // LOAD FILTERED PRODUCTS FROM API
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
        this.selectedSubCategoryId(),
        this.selectedBrandId(),
        this.showOffers()
      )
      .pipe(
        takeUntilDestroyed(this.destroyRef)
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

        error: error => {

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
  // APPLY LOCAL FILTERS TO NORMAL PRODUCTS
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
  // APPLY LOCAL FILTERS TO SEARCH RESULTS
  // ========================================================

  /**
   * This is the important part of the new architecture.
   *
   * Once /by-name has returned:
   *
   * Category
   * Subcategory
   * Brand
   * Offers
   *
   * are all handled here without another API request.
   */
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
  // SHARED LOCAL FILTER LOGIC
  // ========================================================

  private filterProducts(
    source: Product[]
  ): Product[] {

    const categoryId =
      this.selectedCategoryId();

    const subCategoryId =
      this.selectedSubCategoryId();

    const brandId =
      this.selectedBrandId();

    const offers =
      this.showOffers();

    return source.filter(
      product => {

        // --------------------------------------------------
        // CATEGORY
        // --------------------------------------------------

        if (
          categoryId !== null &&
          !product.subCategories?.some(
            subCategory =>
              Number(
                subCategory.categoryId
              ) === categoryId
          )
        ) {

          return false;
        }

        // --------------------------------------------------
        // SUBCATEGORY
        // --------------------------------------------------

        if (
          subCategoryId !== null &&
          !product.subCategories?.some(
            subCategory =>
              Number(
                subCategory.id
              ) === subCategoryId
          )
        ) {

          return false;
        }

        // --------------------------------------------------
        // BRAND
        // --------------------------------------------------

        if (
          brandId !== null &&
          Number(
            product.brandId
          ) !== brandId
        ) {

          return false;
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
    filters: ProductFilterValue
  ): void {

    this.selectedCategoryId.set(
      filters.categoryId
    );

    this.selectedSubCategoryId.set(
      filters.subCategoryId
    );

    this.selectedBrandId.set(
      filters.brandId
    );

    this.showOffers.set(
      filters.offers
    );

    this.updateSubCategories();

    // ------------------------------------------------------
    // IMPORTANT
    // ------------------------------------------------------
    //
    // Navigation keeps the URL synchronized.
    //
    // If search is active, the query-param subscription
    // detects that the search term did not change and
    // applies the filters locally.
    //
    // NO SEARCH API CALL.
    //
    // ------------------------------------------------------

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

    component.subCategories =
      this.subCategories();

    component.brands =
      this.brands();

    component.selectedCategoryId =
      this.selectedCategoryId();

    component.selectedSubCategoryId =
      this.selectedSubCategoryId();

    component.selectedBrandId =
      this.selectedBrandId();

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
        takeUntilDestroyed(this.destroyRef)
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

    this.selectedSubCategoryId.set(null);

    this.updateSubCategories();

    this.navigateWithCurrentFilters();
  }

  // ========================================================
  // CLEAR SUBCATEGORY
  // ========================================================

  clearSubCategory(): void {

    this.selectedSubCategoryId.set(null);

    this.updateSubCategories();

    this.navigateWithCurrentFilters();
  }

  // ========================================================
  // CLEAR BRAND
  // ========================================================

  clearBrand(): void {

    this.selectedBrandId.set(null);

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

  /**
   * Removes only the search term.
   *
   * Existing category / brand / offer filters remain.
   *
   * After the URL changes, the component leaves search mode
   * and returns to the normal product API flow.
   */
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

    // ------------------------------------------------------
    // SEARCH MODE
    // ------------------------------------------------------

    if (
      this.hasSearch()
    ) {
      return;
    }

    // ------------------------------------------------------
    // FILTERED MODE
    // ------------------------------------------------------

    if (
      this.hasApiFilters()
    ) {
      return;
    }

    // ------------------------------------------------------
    // LOADING
    // ------------------------------------------------------

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
  // SUBCATEGORIES
  // ========================================================

  private updateSubCategories(): void {

    const categoryId =
      this.selectedCategoryId();

    const subCategoryId =
      this.selectedSubCategoryId();

    // ------------------------------------------------------
    // NO CATEGORY
    // ------------------------------------------------------

    if (
      categoryId === null
    ) {

      if (
        subCategoryId !== null
      ) {

        for (
          const category of
          this.categories()
        ) {

          const found =
            category.subCategories.some(
              subCategory =>
                Number(
                  subCategory.id
                ) === subCategoryId
            );

          if (
            found
          ) {

            this.subCategories.set(
              category.subCategories
            );

            return;
          }
        }
      }

      this.subCategories.set([]);

      return;
    }

    // ------------------------------------------------------
    // CATEGORY SELECTED
    // ------------------------------------------------------

    const selectedCategory =
      this.categories().find(
        category =>
          Number(
            category.id
          ) === categoryId
      );

    const availableSubCategories =
      selectedCategory?.subCategories ??
      [];

    this.subCategories.set(
      availableSubCategories
    );

    // ------------------------------------------------------
    // INVALID SUBCATEGORY
    // ------------------------------------------------------

    if (
      subCategoryId !== null &&
      !availableSubCategories.some(
        subCategory =>
          Number(
            subCategory.id
          ) === subCategoryId
      )
    ) {

      this.selectedSubCategoryId.set(
        null
      );
    }
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

    if (
      search
    ) {

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
    // SUBCATEGORY
    // ------------------------------------------------------

    const subCategoryId =
      this.selectedSubCategoryId();

    if (
      subCategoryId !== null
    ) {

      queryParams['subcategory'] =
        String(subCategoryId);
    }

    // ------------------------------------------------------
    // BRAND
    // ------------------------------------------------------

    const brandId =
      this.selectedBrandId();

    if (
      brandId !== null
    ) {

      queryParams['brand'] =
        String(brandId);
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
  // CLEAR ALL FILTERS + SEARCH
  // ========================================================

  clearFilters(): void {

    this.selectedCategoryId.set(
      null
    );

    this.selectedSubCategoryId.set(
      null
    );

    this.selectedBrandId.set(
      null
    );

    this.showOffers.set(
      false
    );

    this.searchName.set('');

    this.searchResults.set([]);

    this.subCategories.set([]);

    // ------------------------------------------------------
    // SHOW NORMAL CACHE IMMEDIATELY
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
    // REMOVE ALL QUERY PARAMETERS
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

    if (
      !category
    ) {

      return '';
    }

    return this.getCategoryName(
      category
    );
  }

  // ========================================================
  // SELECTED SUBCATEGORY NAME
  // ========================================================

  get selectedSubCategoryName(): string {

    const id =
      this.selectedSubCategoryId();

    if (
      id === null
    ) {

      return '';
    }

    for (
      const category of
      this.categories()
    ) {

      const subCategory =
        category.subCategories.find(
          sub =>
            Number(
              sub.id
            ) === id
        );

      if (
        subCategory
      ) {

        return this.getSubCategoryName(
          subCategory
        );
      }
    }

    return '';
  }

  // ========================================================
  // SELECTED BRAND NAME
  // ========================================================

  get selectedBrandName(): string {

    const id =
      this.selectedBrandId();

    if (
      id === null
    ) {

      return '';
    }

    const brand =
      this.brands().find(
        brand =>
          Number(
            brand.id
          ) === id
      );

    if (
      !brand
    ) {

      return '';
    }

    return this.getBrandName(
      brand
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
  // CART
  // ========================================================

// ========================================================
// CART
// ========================================================

addToCart(
  product: Product
): void {

  const alreadyExists =
    this.cartService.addToCart(
      product
    );

  // ------------------------------------------------------
  // PRODUCT ALREADY EXISTS
  // ------------------------------------------------------
  if (!alreadyExists) {

    this.addedToCartProductId.set(null);

    this.showAlreadyInCartMessage(
      product.id
    );

    return;
  }

  // ------------------------------------------------------
  // PRODUCT SUCCESSFULLY ADDED
  // ------------------------------------------------------

  this.alreadyInCartProductId.set(null);

  this.showAddedToCartSuccess(
    product.id
  );
}


// ========================================================
// ADDED TO CART SUCCESS
// ========================================================

private showAddedToCartSuccess(
  productId: number
): void {

  // Clear previous timer
  if (this.addedToCartTimer) {

    clearTimeout(
      this.addedToCartTimer
    );
  }

  // Only THIS product shows the check
  this.addedToCartProductId.set(
    productId
  );

  // Return to shopping-cart icon
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

 /*  openProductDetails(
    product: Product
  ): void {

    this.dialog.open(
      ProductModalComponent,
      {

        width: '800px',

        maxWidth: '95vw',

        data: product,

        disableClose: false
      }
    );
  } */

    openProductDetails(product: Product): void {
  this.router.navigate(['/product', product.id]);
}
  // ========================================================
  // IMAGE URL
  // ========================================================

  getImageUrl(
    imageUrl?: string | null
  ): string {

    if (
      !imageUrl
    ) {

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