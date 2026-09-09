import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

import { CartItem, CartService } from '../../services/cart.service';
import { Product, ProductVariant } from '../../models/product.model';
import { LanguageService } from '../../services/language.service';
import { environment } from '../../../environments/environment';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    TranslatePipe
  ],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css']
})
export class CartComponent implements OnInit, OnDestroy {

  cartItems: CartItem[] = [];
  cartTotal = 0;

  api = environment.imageApiBaseUrl;

  isLoading = false;

  private destroy$ = new Subject<void>();

  constructor(
    private router:Router,
    private cartService: CartService,
    public languageService: LanguageService
  ) {}

  // ============================================================
  // LIFECYCLE
  // ============================================================

  ngOnInit(): void {

    this.cartService.cartItems$
      .pipe(takeUntil(this.destroy$))
      .subscribe(items => {

        this.cartItems = items;

        this.calculateCartTotal();
      });

    this.cartService.cartLoading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {

        this.isLoading = loading;
      });
  }

  ngOnDestroy(): void {

    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================
  // PRODUCT
  // ============================================================

  getProductName(product: Product): string {

    if (!product) {
      return '';
    }

    if (this.languageService.isArabic()) {

      return (
        product.nameAr?.trim() ||
        product.nameEn?.trim() ||
        ''
      );
    }

    return (
      product.nameEn?.trim() ||
      product.nameAr?.trim() ||
      ''
    );
  }

  getProductDescription(product: Product): string {

    if (!product) {
      return '';
    }

    if (this.languageService.isArabic()) {

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
  // VARIANT
  // ============================================================

  /**
   * Returns the selected variant.
   *
   * The cart contains ONE exact variant.
   * Example:
   *
   * Size: 38
   * Heel: 3 cm
   *
   * We never display all available variants here.
   */
  getVariant(item: CartItem): ProductVariant | undefined {

    return item?.variant;
  }

  /**
   * Get size name.
   *
   * Supports both:
   *
   * 1. Nested:
   *    variant.size.name
   *
   * 2. Flattened:
   *    variant.sizeName
   *
   * Also supports:
   *
   *    size.nameAr
   *    size.nameEn
   */
  getSizeName(variant?: ProductVariant): string {

    if (!variant) {
      return '';
    }

    const v = variant as any;

    // ----------------------------------------------------------
    // Nested object
    // ----------------------------------------------------------

    const nestedSize = v.size;

    if (nestedSize) {

      if (this.languageService.isArabic()) {

        const arabicName =
          nestedSize.nameAr?.toString().trim();

        if (arabicName) {
          return arabicName;
        }
      }

      const englishName =
        nestedSize.nameEn?.toString().trim();

      if (englishName) {
        return englishName;
      }

      const normalName =
        nestedSize.name?.toString().trim();

      if (normalName) {
        return normalName;
      }
    }

    // ----------------------------------------------------------
    // Flattened property
    // ----------------------------------------------------------

    const sizeName =
      v.sizeName?.toString().trim();

    if (sizeName) {
      return sizeName;
    }

    // ----------------------------------------------------------
    // Other possible API naming
    // ----------------------------------------------------------

    const sizeValue =
      v.sizeValue?.toString().trim();

    if (sizeValue) {
      return sizeValue;
    }

    return '';
  }

  /**
   * Get heel size name.
   *
   * Supports both:
   *
   * 1. Nested:
   *    variant.heelSize.name
   *
   * 2. Flattened:
   *    variant.heelSizeName
   */
  getHeelSizeName(variant?: ProductVariant): string {

    if (!variant) {
      return '';
    }

    const v = variant as any;

    // ----------------------------------------------------------
    // Nested object
    // ----------------------------------------------------------

    const nestedHeelSize = v.heelSize;

    if (nestedHeelSize) {

      if (this.languageService.isArabic()) {

        const arabicName =
          nestedHeelSize.nameAr?.toString().trim();

        if (arabicName) {
          return arabicName;
        }
      }

      const englishName =
        nestedHeelSize.nameEn?.toString().trim();

      if (englishName) {
        return englishName;
      }

      const normalName =
        nestedHeelSize.name?.toString().trim();

      if (normalName) {
        return normalName;
      }
    }

    // ----------------------------------------------------------
    // Flattened property
    // ----------------------------------------------------------

    const heelSizeName =
      v.heelSizeName?.toString().trim();

    if (heelSizeName) {
      return heelSizeName;
    }

    // ----------------------------------------------------------
    // Other possible API naming
    // ----------------------------------------------------------

    const heelValue =
      v.heelSizeValue?.toString().trim();

    if (heelValue) {
      return heelValue;
    }

    return '';
  }

  hasVariant(item: CartItem): boolean {

    return !!item?.variant;
  }

  hasSize(item: CartItem): boolean {

    return this.getSizeName(item?.variant).length > 0;
  }

  hasHeelSize(item: CartItem): boolean {

    return this.getHeelSizeName(item?.variant).length > 0;
  }

  // ============================================================
  // PRICE
  // ============================================================

  getOldPrice(product: Product): number {

    return Number(product?.price ?? 0);
  }

  getDiscountPercentage(product: Product): number {

    return Number(product?.discountPercentage ?? 0);
  }

  hasDiscount(product: Product): boolean {

    return this.getDiscountPercentage(product) > 0;
  }

  getNewPrice(product: Product): number {

    return this.cartService.getFinalPrice(product);
  }

  getItemSubtotal(item: CartItem): number {

    return this.cartService.getItemTotal(item);
  }

  // ============================================================
  // QUANTITY
  // ============================================================

  getTotalQuantity(): number {

    return this.cartItems.reduce(
      (total, item) => total + item.quantity,
      0
    );
  }

  updateQuantity(
    item: CartItem,
    quantity: number
  ): void {

    if (!item) {
      return;
    }

    quantity = Number(quantity);

    if (!Number.isFinite(quantity)) {
      return;
    }

    quantity = Math.floor(quantity);

    if (quantity < 1) {
      quantity = 1;
    }

    this.cartService.updateQuantity(
      item.product.id,
      quantity,
      item.variant?.id
    );
  }

  increaseQuantity(item: CartItem): void {

    if (!item) {
      return;
    }

    this.cartService.increaseQuantity(
      item.product.id,
      item.variant?.id
    );
  }

  decreaseQuantity(item: CartItem): void {

    if (!item || item.quantity <= 1) {
      return;
    }

    this.cartService.decreaseQuantity(
      item.product.id,
      item.variant?.id
    );
  }

  // ============================================================
  // CART
  // ============================================================

  removeFromCart(item: CartItem): void {

    if (!item) {
      return;
    }

    this.cartService.removeFromCart(
      item.product.id,
      item.variant?.id
    );
  }

  clearCart(): void {

    this.cartService.clearCart();
  }

  calculateCartTotal(): void {

    this.cartTotal = this.cartService.getCartTotal();
  }

  getCartTotal(): number {

    return this.cartTotal;
  }

  // ============================================================
  // CHECKOUT / NAVIGATION
  // ============================================================

 checkout(): void {

  if (!this.cartItems.length) {
    return;
  }

  this.router.navigate(['/checkout']);
}

  back(): void {

    window.history.back();
  }

  // ============================================================
  // IMAGE
  // ============================================================

  getFirstImage(product: Product): string | null {

    const images = [...(product?.images ?? [])]
      .filter(image => !!image?.imageUrl)
      .sort(
        (a, b) =>
          Number(a.sortOrder ?? 0) -
          Number(b.sortOrder ?? 0)
      );

    return images[0]?.imageUrl ?? null;
  }

  getImageUrl(imageUrl?: string | null): string {

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

  // ============================================================
  // TRACK BY
  // ============================================================

  trackByCartItem(
    index: number,
    item: CartItem
  ): string {

    return `${item.product.id}-${item.variant?.id ?? 'default'}`;
  }
}