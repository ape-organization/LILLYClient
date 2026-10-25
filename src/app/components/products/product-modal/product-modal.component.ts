import {
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  EMPTY,
  catchError,
  filter,
  map,
  switchMap,
  tap
} from 'rxjs';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';

import {
  ActivatedRoute,
  Router
} from '@angular/router';

import { TranslatePipe } from '@ngx-translate/core';

import { MaterialModule } from '../../../shared/AngularMaterial';

import { environment } from '../../../../environments/environment';

import {
  Product,
  ProductVariant
} from '../../../models/product.model';

import { CartService } from '../../../services/cart.service';
import { LanguageService } from '../../../services/language.service';
import { ProductService } from '../../../services/product.service';

import { RelativeProduct } from '../relative-product/relative-product';


@Component({
  selector: 'app-product-modal',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    MatButtonModule,
    MaterialModule,
    RelativeProduct
  ],

  templateUrl: './product-modal.component.html',
  styleUrl: './product-modal.component.css'
})
export class ProductModalComponent
  implements OnInit, OnDestroy {

  // ============================================================
  // SERVICES
  // ============================================================

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly productService = inject(ProductService);
  private readonly cartService = inject(CartService);
  private readonly destroyRef = inject(DestroyRef);

  readonly languageService =
    inject(LanguageService);

  // ============================================================
  // PRODUCT
  // ============================================================

  readonly product =
    signal<Product | null>(null);

  // ============================================================
  // QUANTITY
  // ============================================================

  readonly quantity =
    signal(1);

  // ============================================================
  // IMAGE SLIDER
  // ============================================================

  readonly selectedImageIndex =
    signal(0);

  private imageSliderInterval:
    ReturnType<typeof setInterval> | null = null;

  // ============================================================
  // VARIANT SELECTION
  // ============================================================

  readonly selectedSizeId =
    signal<number | null>(null);

  readonly selectedHeelSizeId =
    signal<number | null>(null);

  // ============================================================
  // RELATIVE PRODUCTS CART FEEDBACK
  // ============================================================

  readonly addedToCartProductId =
    signal<number | null>(null);

  readonly alreadyInCartProductId =
    signal<number | null>(null);

  private addedToCartTimer:
    ReturnType<typeof setTimeout> | null = null;

  private alreadyInCartMessageTimer:
    ReturnType<typeof setTimeout> | null = null;

  // ============================================================
  // IMAGE API
  // ============================================================

  readonly api =
    environment.imageApiBaseUrl;

  // ============================================================
  // LIFECYCLE
  // ============================================================

  ngOnInit(): void {

    /*
     * switchMap cancels the previous request when the
     * user opens another product before it returns, and
     * takeUntilDestroyed cancels it when leaving the page.
     */
    this.route.paramMap
      .pipe(
        map(params => Number(params.get('id'))),

        tap(productId => {
          if (!this.isValidProductId(productId)) {
            this.goBack();
          }
        }),

        filter(productId =>
          this.isValidProductId(productId)
        ),

        tap(() => this.stopImageSlider()),

        switchMap(productId =>
          this.productService.getProduct(productId).pipe(
            catchError(() => {
              this.goBack();
              return EMPTY;
            })
          )
        ),

        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(product => {
        this.product.set(product);

        this.selectedImageIndex.set(0);

        this.selectedSizeId.set(null);

        this.selectedHeelSizeId.set(null);

        this.setQuantity(1);

        this.startImageSlider();
      });
  }

  private isValidProductId(
    productId: number
  ): boolean {

    return (
      Number.isInteger(productId) &&
      productId > 0
    );
  }

  ngOnDestroy(): void {

    this.stopImageSlider();

    if (this.addedToCartTimer) {
      clearTimeout(
        this.addedToCartTimer
      );
    }

    if (this.alreadyInCartMessageTimer) {
      clearTimeout(
        this.alreadyInCartMessageTimer
      );
    }
  }

  // ============================================================
  // IMAGES
  // ============================================================

  get images(): any[] {

    return this.product()?.images ?? [];
  }

  get currentImageUrl(): string {

    const images = this.images;

    if (!images.length) {
      return 'assets/images/product-placeholder.svg';
    }

    const index = Math.min(
      this.selectedImageIndex(),
      images.length - 1
    );

    return this.getImageUrl(
      images[index]
    );
  }

  // ============================================================
  // IMAGE SLIDER
  // ============================================================

  // ============================================================
  // MOBILE TOUCH SLIDER
  // ============================================================

  private touchStartX = 0;
  private touchStartY = 0;

  private readonly swipeThreshold = 45;

  onTouchStart(event: TouchEvent): void {
    if (event.touches.length !== 1) {
      this.touchStartX = 0;
      this.touchStartY = 0;
      return;
    }

    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
  }

  onTouchEnd(event: TouchEvent): void {
    if (this.touchStartX === 0 && this.touchStartY === 0) {
      return;
    }

    const touch = event.changedTouches[0];

    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;

    // Reset touch coordinates.
    this.touchStartX = 0;
    this.touchStartY = 0;

    // Ignore vertical scrolling and small movements.
    if (
      Math.abs(deltaX) < this.swipeThreshold ||
      Math.abs(deltaX) <= Math.abs(deltaY)
    ) {
      return;
    }

    // Swipe left = next image.
    if (deltaX < 0) {
      this.nextImage();
    } else {
      // Swipe right = previous image.
      this.previousImage();
    }
  }

  onTouchCancel(): void {
    this.touchStartX = 0;
    this.touchStartY = 0;
  }

  private startImageSlider(): void {

    this.stopImageSlider();

    if (this.images.length <= 1) {
      return;
    }

    this.imageSliderInterval =
      setInterval(() => {

        this.nextImage(false);

      }, 4000);
  }

  private stopImageSlider(): void {

    if (!this.imageSliderInterval) {
      return;
    }

    clearInterval(
      this.imageSliderInterval
    );

    this.imageSliderInterval = null;
  }

  private restartImageSlider(): void {
    this.startImageSlider();
  }

  selectImage(index: number): void {

    if (
      index < 0 ||
      index >= this.images.length
    ) {
      return;
    }

    this.selectedImageIndex.set(index);

    this.restartImageSlider();
  }

  previousImage(
    restartSlider = true
  ): void {

    const images = this.images;

    if (images.length <= 1) {
      return;
    }

    const current =
      this.selectedImageIndex();

    this.selectedImageIndex.set(
      current === 0
        ? images.length - 1
        : current - 1
    );

    if (restartSlider) {
      this.restartImageSlider();
    }
  }

  nextImage(
    restartSlider = true
  ): void {

    const images = this.images;

    if (images.length <= 1) {
      return;
    }

    const current =
      this.selectedImageIndex();

    this.selectedImageIndex.set(
      current === images.length - 1
        ? 0
        : current + 1
    );

    if (restartSlider) {
      this.restartImageSlider();
    }
  }

  // ============================================================
  // ACTIVE VARIANTS
  // ============================================================

  /*
   * Inactive variants are never offered. This matches
   * CartService, which rejects inactive variants.
   *
   * computed() caches the result between change
   * detection runs; the getters keep the template API.
   */
  private readonly activeVariantList =
    computed(() =>
      (this.product()?.variants ?? []).filter(
        variant => variant.isActive !== false
      )
    );

  get activeVariants(): ProductVariant[] {

    return this.activeVariantList();
  }

  private isVariantInStock(
    variant: ProductVariant
  ): boolean {

    return variant.isInStock !== false;
  }

  get hasVariants(): boolean {

    return this.activeVariants.length > 0;
  }

  get hasSizes(): boolean {

    return this.activeVariants.some(
      variant =>
        variant.sizeId != null &&
        !!variant.sizeName?.trim()
    );
  }

  get hasHeelSizes(): boolean {

    return this.activeVariants.some(
      variant =>
        variant.heelSizeId != null &&
        !!variant.heelSizeName?.trim()
    );
  }

  // ============================================================
  // AVAILABLE SIZE OPTIONS
  // ============================================================

  get availableSizes(): ProductVariant[] {

    return this.availableSizeList();
  }

  /*
   * Lists every size that exists with the selected heel.
   * Out-of-stock sizes stay visible but disabled
   * (see isSizeAvailable).
   */
  private readonly availableSizeList = computed(() => {

    const seen = new Set<number>();

    return this.activeVariants.filter(
      variant => {

        const sizeId =
          variant.sizeId;

        if (
          sizeId == null ||
          !variant.sizeName?.trim()
        ) {
          return false;
        }

        if (
          !this.isSizeCompatible(sizeId)
        ) {
          return false;
        }

        if (seen.has(sizeId)) {
          return false;
        }

        seen.add(sizeId);

        return true;
      }
    );
  });

  // ============================================================
  // AVAILABLE HEEL OPTIONS
  // ============================================================

  get availableHeelSizes(): ProductVariant[] {

    return this.availableHeelSizeList();
  }

  /*
   * Lists every heel that exists with the selected size.
   * Out-of-stock heels stay visible but disabled
   * (see isHeelAvailable).
   */
  private readonly availableHeelSizeList = computed(() => {

    const seen = new Set<number>();

    return this.activeVariants.filter(
      variant => {

        const heelId =
          variant.heelSizeId;

        if (
          heelId == null ||
          !variant.heelSizeName?.trim()
        ) {
          return false;
        }

        if (
          !this.isHeelCompatible(heelId)
        ) {
          return false;
        }

        if (seen.has(heelId)) {
          return false;
        }

        seen.add(heelId);

        return true;
      }
    );
  });

  // ============================================================
  // SIZE SELECTION
  // ============================================================

  selectSize(sizeId: number): void {

    if (!this.isSizeAvailable(sizeId)) {
      return;
    }

    if (
      this.selectedSizeId() === sizeId
    ) {

      this.selectedSizeId.set(null);

    } else {

      this.selectedSizeId.set(sizeId);
    }

    this.resetInvalidHeel();

    this.setQuantity(1);
  }

  private resetInvalidHeel(): void {

    const heelId =
      this.selectedHeelSizeId();

    if (heelId == null) {
      return;
    }

    if (
      !this.isHeelAvailable(heelId)
    ) {
      this.selectedHeelSizeId.set(null);
    }
  }

  // ============================================================
  // HEEL SELECTION
  // ============================================================

  selectHeelSize(
    heelSizeId: number
  ): void {

    if (
      !this.isHeelAvailable(heelSizeId)
    ) {
      return;
    }

    if (
      this.selectedHeelSizeId() ===
      heelSizeId
    ) {

      this.selectedHeelSizeId.set(null);

    } else {

      this.selectedHeelSizeId.set(
        heelSizeId
      );
    }

    this.setQuantity(1);
  }

  // ============================================================
  // SELECTION CHECKS
  // ============================================================

  isSizeSelected(
    sizeId: number
  ): boolean {

    return (
      this.selectedSizeId() ===
      sizeId
    );
  }

  isHeelSelected(
    heelSizeId: number
  ): boolean {

    return (
      this.selectedHeelSizeId() ===
      heelSizeId
    );
  }

  // ============================================================
  // SIZE AVAILABILITY
  // ============================================================

  /**
   * True when the size exists with the selected heel
   * and at least one matching variant is in stock.
   */
  isSizeAvailable(
    sizeId: number
  ): boolean {

    return this.matchesSize(sizeId, true);
  }

  private isSizeCompatible(
    sizeId: number
  ): boolean {

    return this.matchesSize(sizeId, false);
  }

  private matchesSize(
    sizeId: number,
    requireStock: boolean
  ): boolean {

    const selectedHeel =
      this.selectedHeelSizeId();

    return this.activeVariants.some(
      variant => {

        if (
          variant.sizeId !== sizeId
        ) {
          return false;
        }

        if (
          requireStock &&
          !this.isVariantInStock(variant)
        ) {
          return false;
        }

        if (
          selectedHeel == null
        ) {
          return true;
        }

        return (
          variant.heelSizeId ===
          selectedHeel
        );
      }
    );
  }

  // ============================================================
  // HEEL AVAILABILITY
  // ============================================================

  /**
   * True when the heel exists with the selected size
   * and at least one matching variant is in stock.
   */
  isHeelAvailable(
    heelSizeId: number
  ): boolean {

    return this.matchesHeel(heelSizeId, true);
  }

  private isHeelCompatible(
    heelSizeId: number
  ): boolean {

    return this.matchesHeel(heelSizeId, false);
  }

  private matchesHeel(
    heelSizeId: number,
    requireStock: boolean
  ): boolean {

    const selectedSize =
      this.selectedSizeId();

    return this.activeVariants.some(
      variant => {

        if (
          variant.heelSizeId !==
          heelSizeId
        ) {
          return false;
        }

        if (
          requireStock &&
          !this.isVariantInStock(variant)
        ) {
          return false;
        }

        if (
          selectedSize == null
        ) {
          return true;
        }

        return (
          variant.sizeId ===
          selectedSize
        );
      }
    );
  }

  // ============================================================
  // SELECTED DATABASE VARIANT
  // ============================================================

  get selectedVariant():
    ProductVariant | null {

    return this.selectedVariantValue();
  }

  private readonly selectedVariantValue = computed((): ProductVariant | null => {

    const sizeId =
      this.selectedSizeId();

    const heelId =
      this.selectedHeelSizeId();

    if (
      this.hasSizes &&
      this.hasHeelSizes
    ) {

      if (
        sizeId == null ||
        heelId == null
      ) {
        return null;
      }

      return (
        this.activeVariants.find(
          variant =>
            variant.sizeId === sizeId &&
            variant.heelSizeId === heelId
        ) ?? null
      );
    }

    if (this.hasSizes) {

      if (sizeId == null) {
        return null;
      }

      return (
        this.activeVariants.find(
          variant =>
            variant.sizeId === sizeId
        ) ?? null
      );
    }

    if (this.hasHeelSizes) {

      if (heelId == null) {
        return null;
      }

      return (
        this.activeVariants.find(
          variant =>
            variant.heelSizeId === heelId
        ) ?? null
      );
    }

    return null;
  });

  // ============================================================
  // VARIANT SELECTION REQUIRED
  // ============================================================

  get requiresVariantSelection(): boolean {

    if (!this.hasVariants) {
      return false;
    }

    if (
      this.hasSizes &&
      this.selectedSizeId() == null
    ) {
      return true;
    }

    if (
      this.hasHeelSizes &&
      this.selectedHeelSizeId() == null
    ) {
      return true;
    }

    return false;
  }

  // ============================================================
  // SELECTED VARIANT LABEL
  // ============================================================

  get selectedVariantLabel(): string {

    const variant =
      this.selectedVariant;

    if (!variant) {
      return '';
    }

    const size =
      variant.sizeName?.trim() ?? '';

    const heel =
      variant.heelSizeName?.trim() ?? '';

    if (size && heel) {
      return `${size} · ${heel}`;
    }

    return size || heel;
  }

  // ============================================================
  // PRODUCT STOCK
  // ============================================================

  get isOutOfStock(): boolean {

    const product =
      this.product();

    if (!product) {
      return true;
    }

    return product.isInStock !== true;
  }

  // ============================================================
  // CAN ADD TO CART
  // ============================================================

  get canAddToCart(): boolean {

    const product =
      this.product();

    if (!product) {
      return false;
    }

    if (this.isOutOfStock) {
      return false;
    }

    if (this.quantity() < 1) {
      return false;
    }

    if (!this.hasVariants) {
      return true;
    }

    const variant =
      this.selectedVariant;

    return (
      !this.requiresVariantSelection &&
      variant !== null &&
      this.isVariantInStock(variant)
    );
  }

  // ============================================================
  // PRICE
  // ============================================================

  get hasDiscount(): boolean {

    return Number(
      this.product()?.discountPercentage ?? 0
    ) > 0;
  }

  get oldPrice(): number {

    return Number(
      this.product()?.price ?? 0
    );
  }

  get newPrice(): number {

    const product =
      this.product();

    if (!product) {
      return 0;
    }

    const price =
      Number(product.price ?? 0);

    const discount =
      Number(
        product.discountPercentage ?? 0
      );

    if (discount <= 0) {
      return price;
    }

    return (
      price -
      (price * discount / 100)
    );
  }

  // ============================================================
  // QUANTITY
  // ============================================================

  get maxQuantity(): number {

    const product =
      this.product();

    if (!product) {
      return 5;
    }

    return this.cartService.getMaxQuantity(
      product,
      this.selectedVariant
    );
  }

  setQuantity(
    value: number | string
  ): void {

    const maxQuantity =
      this.maxQuantity;

    let parsed =
      typeof value === 'number'
        ? value
        : Number(value);

    if (!Number.isFinite(parsed)) {
      parsed = 1;
    }

    parsed = Math.floor(parsed);

    if (parsed < 1) {
      parsed = 1;
    }

    if (parsed > maxQuantity) {
      parsed = maxQuantity;
    }

    this.quantity.set(parsed);
  }

  // ============================================================
  // ADD MAIN PRODUCT TO CART
  // ============================================================

  addToCart(): void {

    const product =
      this.product();

    if (
      !product ||
      !this.canAddToCart
    ) {
      return;
    }

    let selectedQuantity =
      this.quantity();

    const maxQuantity =
      this.maxQuantity;

    if (
      selectedQuantity >
      maxQuantity
    ) {
      selectedQuantity =
        maxQuantity;
    }

    // ----------------------------------------------------------
    // PRODUCT WITHOUT VARIANT
    // ----------------------------------------------------------

    if (!this.hasVariants) {

      const added =
        this.cartService.replaceCartItem(
          product,
          selectedQuantity
        );

      if (!added) {
        return;
      }

      this.goBack();

      return;
    }

    // ----------------------------------------------------------
    // PRODUCT WITH VARIANT
    // ----------------------------------------------------------

    const variant =
      this.selectedVariant;

    if (!variant) {
      return;
    }

    const added =
      this.cartService.replaceCartItem(
        product,
        selectedQuantity,
        variant
      );

    if (!added) {
      return;
    }

    this.goBack();
  }

  // ============================================================
  // RELATIVE PRODUCTS
  // ============================================================

  addRelativeProductToCart(
    product: Product
  ): void {

    if (product.hasVariants) {
      this.openProductDetails(product);
      return;
    }

    const added =
      this.cartService.addToCart(product);

    if (!added) {

      this.addedToCartProductId.set(
        null
      );

      this.showAlreadyInCartMessage(
        product.id
      );

      return;
    }

    this.alreadyInCartProductId.set(
      null
    );

    this.showAddedToCartSuccess(
      product.id
    );
  }

  private showAddedToCartSuccess(
    productId: number
  ): void {

    if (this.addedToCartTimer) {
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

  private showAlreadyInCartMessage(
    productId: number
  ): void {

    if (this.alreadyInCartMessageTimer) {
      clearTimeout(
        this.alreadyInCartMessageTimer
      );
    }

    this.alreadyInCartProductId.set(
      productId
    );

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

  // ============================================================
  // OPEN PRODUCT DETAILS
  // ============================================================

  openProductDetails(
    product: Product
  ): void {

    this.router.navigate([
      '/product',
      product.id
    ]);
  }

  // ============================================================
  // CATEGORY
  // ============================================================

  get CategoryId(): number | null {

    const product =
      this.product();

    const id =
      product?.category?.id;

    if (
      id == null ||
      !Number.isInteger(Number(id))
    ) {
      return null;
    }

    return Number(id);
  }

  get ProductId(): number | null {

    const product =
      this.product();

    const id =
      product?.id;

    if (
      id == null ||
      !Number.isInteger(Number(id))
    ) {
      return null;
    }

    return Number(id);
  }

  // ============================================================
  // GO BACK
  // ============================================================

  goBack(): void {

    this.router.navigate([
      '/products'
    ]);
  }

  // ============================================================
  // IMAGE URL
  // ============================================================

  getImageUrl(
    imageUrl?: string | null
  ): string {

    if (!imageUrl) {
      return 'assets/images/product-placeholder.svg';
    }

    const url =
      imageUrl.trim();

    if (!url) {
      return 'assets/images/product-placeholder.svg';
    }

    if (
      url.startsWith('http://') ||
      url.startsWith('https://')
    ) {
      return url;
    }

    return `${this.api}${url}`;
  }

  // ============================================================
  // PRODUCT NAME
  // ============================================================

  getProductName(): string {

    const product =
      this.product();

    if (!product) {
      return '';
    }

    if (
      this.languageService.isArabic()
    ) {

      return (
        product.nameAr?.trim() ||
        product.nameEn?.trim() ||
        'Product'
      );
    }

    return (
      product.nameEn?.trim() ||
      product.nameAr?.trim() ||
      'Product'
    );
  }

  // ============================================================
  // DESCRIPTION
  // ============================================================

  getProductDescription(): string {

    const product =
      this.product();

    if (!product) {
      return '';
    }

    if (
      this.languageService.isArabic()
    ) {

      return (
        product.descriptionAr?.trim() ||
        product.descriptionEn?.trim() ||
        ''
      );
    }

    return (
      product.descriptionEn?.trim() ||
      product.descriptionAr?.trim() ||
      ''
    );
  }

  // ============================================================
  // CATEGORY NAME
  // ============================================================

  getCategoryName(): string {

    const category =
      this.product()?.category;

    if (!category) {
      return '';
    }

    if (
      this.languageService.isArabic()
    ) {

      return (
        category.nameAr?.trim() ||
        category.nameEn?.trim() ||
        ''
      );
    }

    return (
      category.nameEn?.trim() ||
      category.nameAr?.trim() ||
      ''
    );
  }

  // ============================================================
  // SIZE NAME
  // ============================================================

  getSizeName(
    variant: ProductVariant
  ): string {

    return (
      variant.sizeName?.trim() ||
      ''
    );
  }

  // ============================================================
  // HEEL SIZE NAME
  // ============================================================

  getHeelSizeName(
    variant: ProductVariant
  ): string {

    return (
      variant.heelSizeName?.trim() ||
      ''
    );
  }
}