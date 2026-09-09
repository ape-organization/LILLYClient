
import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';

import { CartService } from '../../../services/cart.service';
import { LanguageService } from '../../../services/language.service';
import { MaterialModule } from '../../../shared/AngularMaterial';

import { environment } from '../../../../environments/environment';

import { TranslatePipe } from '@ngx-translate/core';

import {
  Product,
  ProductVariant
} from '../../../models/product.model';

import {
  ActivatedRoute,
  Router
} from '@angular/router';

import { ProductService } from '../../../services/product.service';


@Component({
  selector: 'app-product-modal',
  standalone: true,

  imports: [
    TranslatePipe,
    CommonModule,
    FormsModule,
    MatButtonModule,
    MaterialModule
  ],

  templateUrl: './product-modal.component.html',
  styleUrl: './product-modal.component.css'
})
export class ProductModalComponent
  implements OnInit, OnDestroy {

  // =====================================================
  // SERVICES
  // =====================================================

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private productService = inject(ProductService);
  private cartService = inject(CartService);

  public languageService = inject(LanguageService);


  // =====================================================
  // PRODUCT
  // =====================================================

  product = signal<Product | null>(null);


  // =====================================================
  // QUANTITY
  // =====================================================

  quantity = signal(1);


  // =====================================================
  // IMAGE SLIDER
  // =====================================================

  selectedImageIndex = signal(0);

  private imageSliderInterval:
    ReturnType<typeof setInterval> | null = null;


  // =====================================================
  // OPTION SELECTION
  // =====================================================

  selectedSizeId = signal<number | null>(null);

  selectedHeelSizeId = signal<number | null>(null);


  // =====================================================
  // IMAGE API
  // =====================================================

  api = environment.imageApiBaseUrl;


  // =====================================================
  // INIT
  // =====================================================

  ngOnInit(): void {

    const productId = Number(
      this.route.snapshot.paramMap.get('id')
    );

    if (!productId) {
      this.goBack();
      return;
    }

    this.loadProduct(productId);
  }


  // =====================================================
  // DESTROY
  // =====================================================

  ngOnDestroy(): void {
    this.stopImageSlider();
  }


  // =====================================================
  // LOAD PRODUCT
  // =====================================================

  private loadProduct(id: number): void {

    this.productService.getProduct(id).subscribe({

      next: (product) => {

        this.product.set(product);

        this.selectedImageIndex.set(0);

        this.selectedSizeId.set(null);

        this.selectedHeelSizeId.set(null);

        this.setQuantity(1);

        this.startImageSlider();
      },

      error: () => {
        this.goBack();
      }

    });
  }


  // =====================================================
  // IMAGE LIST
  // =====================================================

  get images() {

    return [...(this.product()?.images ?? [])]
      .filter(image => !!image.imageUrl)
      .sort(
        (a, b) => a.sortOrder - b.sortOrder
      );
  }


  // =====================================================
  // CURRENT IMAGE
  // =====================================================

  get currentImageUrl(): string {

    const images = this.images;

    if (!images.length) {
      return 'assets/images/product-placeholder.png';
    }

    const image =
      images[this.selectedImageIndex()];

    return this.getImageUrl(
      image?.imageUrl
    );
  }


  // =====================================================
  // IMAGE SLIDER
  // =====================================================

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

    if (this.imageSliderInterval) {

      clearInterval(
        this.imageSliderInterval
      );

      this.imageSliderInterval = null;
    }
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


  // =====================================================
  // VARIANTS
  // =====================================================

  get activeVariants(): ProductVariant[] {

    return (this.product()?.variants ?? [])
      .filter(
        variant =>
          variant.isActive !== false
      );
  }


  get hasVariants(): boolean {
    return this.activeVariants.length > 0;
  }


  // =====================================================
  // HAS SIZE
  // =====================================================

  get hasSizes(): boolean {

    return this.activeVariants.some(
      variant =>
        variant.sizeId != null &&
        !!variant.sizeName
    );
  }


  // =====================================================
  // HAS HEEL SIZE
  // =====================================================

  get hasHeelSizes(): boolean {

    return this.activeVariants.some(
      variant =>
        variant.heelSizeId != null &&
        !!variant.heelSizeName
    );
  }


  // =====================================================
  // AVAILABLE SIZE OPTIONS
  // =====================================================

  get availableSizes(): ProductVariant[] {

    const seen = new Set<number>();

    return this.activeVariants.filter(
      variant => {

        if (
          variant.sizeId == null ||
          !variant.sizeName
        ) {
          return false;
        }

        if (seen.has(variant.sizeId)) {
          return false;
        }

        seen.add(variant.sizeId);

        return true;
      }
    );
  }


  // =====================================================
  // AVAILABLE HEEL OPTIONS
  // =====================================================

  get availableHeelSizes(): ProductVariant[] {

    const seen = new Set<number>();

    return this.activeVariants.filter(
      variant => {

        if (
          variant.heelSizeId == null ||
          !variant.heelSizeName
        ) {
          return false;
        }

        if (seen.has(variant.heelSizeId)) {
          return false;
        }

        seen.add(variant.heelSizeId);

        return true;
      }
    );
  }


  // =====================================================
  // SELECT SIZE
  // =====================================================

  selectSize(
    sizeId: number
  ): void {

    if (
      this.selectedSizeId() === sizeId
    ) {
      this.selectedSizeId.set(null);
    } else {

      this.selectedSizeId.set(sizeId);

      /*
       * If the currently selected heel
       * does not work with this size,
       * remove the heel selection.
       */
      const heelId =
        this.selectedHeelSizeId();

      if (
        heelId != null &&
        !this.isHeelAvailable(heelId)
      ) {
        this.selectedHeelSizeId.set(null);
      }
    }

    this.setQuantity(1);
  }


  // =====================================================
  // SELECT HEEL
  // =====================================================

  selectHeelSize(
    heelSizeId: number
  ): void {

    if (
      !this.isHeelAvailable(heelSizeId)
    ) {
      return;
    }

    if (
      this.selectedHeelSizeId() === heelSizeId
    ) {
      this.selectedHeelSizeId.set(null);
    } else {

      this.selectedHeelSizeId.set(
        heelSizeId
      );
    }

    this.setQuantity(1);
  }


  // =====================================================
  // CHECK SIZE SELECTED
  // =====================================================

  isSizeSelected(
    sizeId: number
  ): boolean {

    return this.selectedSizeId() === sizeId;
  }


  // =====================================================
  // CHECK HEEL SELECTED
  // =====================================================

  isHeelSelected(
    heelSizeId: number
  ): boolean {

    return this.selectedHeelSizeId() === heelSizeId;
  }


  // =====================================================
  // CHECK IF SIZE IS AVAILABLE
  //
  // A size is disabled when it has no available
  // combination with the currently selected heel.
  // =====================================================

  isSizeAvailable(
    sizeId: number
  ): boolean {

    return this.activeVariants.some(
      variant => {

        if (
          variant.sizeId !== sizeId
        ) {
          return false;
        }

        if (
          Number(
            variant.stockQuantity ?? 0
          ) <= 0
        ) {
          return false;
        }

        const selectedHeel =
          this.selectedHeelSizeId();

        if (selectedHeel == null) {
          return true;
        }

        return (
          variant.heelSizeId === selectedHeel
        );
      }
    );
  }


  // =====================================================
  // CHECK IF HEEL IS AVAILABLE
  //
  // A heel is disabled when it has no available
  // combination with the currently selected size.
  // =====================================================

  isHeelAvailable(
    heelSizeId: number
  ): boolean {

    return this.activeVariants.some(
      variant => {

        if (
          variant.heelSizeId !== heelSizeId
        ) {
          return false;
        }

        if (
          Number(
            variant.stockQuantity ?? 0
          ) <= 0
        ) {
          return false;
        }

        const selectedSize =
          this.selectedSizeId();

        if (selectedSize == null) {
          return true;
        }

        return (
          variant.sizeId === selectedSize
        );
      }
    );
  }


  // =====================================================
  // SELECTED REAL DATABASE VARIANT
  //
  // This is the important part:
  //
  // Size + Heel -> one actual DB variant
  // =====================================================

  get selectedVariant(): ProductVariant | null {

    const sizeId =
      this.selectedSizeId();

    const heelId =
      this.selectedHeelSizeId();


    /*
     * Product with size + heel
     */

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


    /*
     * Product with size only
     */

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


    /*
     * Product with heel only
     */

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
  }


  // =====================================================
  // VARIANT SELECTION REQUIRED
  // =====================================================

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


  // =====================================================
  // SELECTED SUMMARY
  // =====================================================

  get selectedVariantLabel(): string {

    const variant =
      this.selectedVariant;

    if (!variant) {
      return '';
    }

    const size =
      variant.sizeName?.trim() || '';

    const heel =
      variant.heelSizeName?.trim() || '';

    if (size && heel) {
      return `${size} · ${heel}`;
    }

    return size || heel;
  }


  // =====================================================
  // STOCK
  // =====================================================

  get stock(): number {

    const product =
      this.product();

    if (!product) {
      return 0;
    }


    /*
     * Product without variants
     */

    if (!this.hasVariants) {

      return Number(
        product.stockQuantity ?? 0
      );
    }


    /*
     * Product with variants
     */

    const variant =
      this.selectedVariant;

    if (!variant) {
      return 0;
    }

    return Number(
      variant.stockQuantity ?? 0
    );
  }


  // =====================================================
  // OUT OF STOCK
  // =====================================================

  get isOutOfStock(): boolean {

    const product =
      this.product();

    if (!product) {
      return true;
    }

    if (!product.isInStock) {
      return true;
    }


    /*
     * Product with variants
     */

    if (this.hasVariants) {

      /*
       * No option selected yet.
       * Do not show the entire product as
       * out of stock.
       */

      if (
        this.requiresVariantSelection
      ) {
        return false;
      }

      return this.stock <= 0;
    }


    /*
     * Product without variants
     */

    return this.stock <= 0;
  }


  // =====================================================
  // CAN ADD TO CART
  // =====================================================

  get canAddToCart(): boolean {

    const product =
      this.product();

    if (!product) {
      return false;
    }

    if (!product.isInStock) {
      return false;
    }


    /*
     * Product with variants
     */

    if (this.hasVariants) {

      const variant =
        this.selectedVariant;

      if (!variant) {
        return false;
      }

      const variantStock =
        Number(
          variant.stockQuantity ?? 0
        );

      return (
        variantStock > 0 &&
        this.quantity() <= variantStock
      );
    }


    /*
     * Product without variants
     */

    return (
      this.stock > 0 &&
      this.quantity() <= this.stock
    );
  }


  // =====================================================
  // PRICE
  // =====================================================

  get hasDiscount(): boolean {

    return Number(
      this.product()
        ?.discountPercentage ?? 0
    ) > 0;
  }


  get oldPrice(): number {

    return Number(
      this.product()?.price ?? 0
    );
  }


  get newPrice(): number {

    return Number(
      this.product()?.actualPrice ?? 0
    );
  }


  // =====================================================
  // QUANTITY
  // =====================================================

  setQuantity(
    value: number
  ): void {

    let newQuantity =
      Number(value);

    if (
      !Number.isFinite(
        newQuantity
      )
    ) {
      newQuantity = 1;
    }

    newQuantity =
      Math.floor(newQuantity);

    if (newQuantity < 1) {
      newQuantity = 1;
    }

    const maximum =
      this.stock;

    if (
      maximum > 0 &&
      newQuantity > maximum
    ) {
      newQuantity = maximum;
    }

    this.quantity.set(
      newQuantity
    );
  }


  // =====================================================
  // ADD TO CART
  // =====================================================

  addToCart(): void {

    const product =
      this.product();

    if (!product) {
      return;
    }

    if (!this.canAddToCart) {
      return;
    }

    const selectedQuantity =
      this.quantity();


    /*
     * NO VARIANTS
     */

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


    /*
     * ONE REAL DATABASE VARIANT
     */

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


  // =====================================================
  // GO BACK
  // =====================================================

  goBack(): void {

    this.router.navigate([
      '/products'
    ]);
  }


  // =====================================================
  // IMAGE URL
  // =====================================================

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


  // =====================================================
  // PRODUCT NAME
  // =====================================================

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


  // =====================================================
  // DESCRIPTION
  // =====================================================

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


  // =====================================================
  // CATEGORY
  // =====================================================

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


  // =====================================================
  // SIZE NAME
  // =====================================================

  getSizeName(
    variant: ProductVariant
  ): string {

    return (
      variant.sizeName?.trim() ||
      ''
    );
  }


  // =====================================================
  // HEEL SIZE NAME
  // =====================================================

  getHeelSizeName(
    variant: ProductVariant
  ): string {

    return (
      variant.heelSizeName?.trim() ||
      ''
    );
  }


  // =====================================================
  // VARIANT STOCK
  // =====================================================

  getVariantStock(
    variant: ProductVariant
  ): number {

    return Number(
      variant.stockQuantity ?? 0
    );
  }
}
