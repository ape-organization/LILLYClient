import {
  CommonModule
} from '@angular/common';

import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';

import {
  FormsModule
} from '@angular/forms';

import {
  Subject,
  takeUntil
} from 'rxjs';

import {
  MatButtonModule
} from '@angular/material/button';

import {
  MatIconModule
} from '@angular/material/icon';

import {
  TranslatePipe
} from '@ngx-translate/core';

import {
  CartItem,
  CartService
} from '../../services/cart.service';

import {
  Product,
  ProductVariant
} from '../../models/product.model';

import {
  LanguageService
} from '../../services/language.service';

import {
  environment
} from '../../../environments/environment';

import {
  Router
} from '@angular/router';


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
export class CartComponent
  implements OnInit, OnDestroy {


  // ============================================================
  // CART
  // ============================================================

  cartItems: CartItem[] = [];

  cartTotal = 0;

  api =
    environment.imageApiBaseUrl;

  isLoading = false;


  // ============================================================
  // SERVICES
  // ============================================================

  private readonly router =
    inject(Router);

  private readonly cartService =
    inject(CartService);

  private readonly cdr =
    inject(ChangeDetectorRef);

  public readonly languageService =
    inject(LanguageService);


  // ============================================================
  // DESTROY
  // ============================================================

  private readonly destroy$ =
    new Subject<void>();


  // ============================================================
  // INIT
  // ============================================================

  ngOnInit(): void {

    /*
     * CartService is responsible for restoring
     * the cart from localStorage/API.
     *
     * We ONLY listen here.
     */

    this.cartService
      .cartItems$

      .pipe(
        takeUntil(
          this.destroy$
        )
      )

      .subscribe(items => {

        this.cartItems =
          items ?? [];

        this.calculateCartTotal();

        this.cdr.detectChanges();

      });


    this.cartService
      .cartLoading$

      .pipe(
        takeUntil(
          this.destroy$
        )
      )

      .subscribe(loading => {

        this.isLoading =
          loading;

        this.cdr.detectChanges();

      });

  }


  // ============================================================
  // DESTROY
  // ============================================================

  ngOnDestroy(): void {

    this.destroy$.next();

    this.destroy$.complete();

  }


  // ============================================================
  // PRODUCT
  // ============================================================

  getProductName(
    product: Product
  ): string {

    if (!product) {
      return '';
    }


    if (
      this.languageService.isArabic()
    ) {

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


  getProductDescription(
    product: Product
  ): string {

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
  // VARIANT
  // ============================================================

  getVariant(
    item: CartItem
  ): ProductVariant | undefined {

    return item?.variant;

  }


  getSizeName(
    variant?: ProductVariant
  ): string {

    if (!variant) {
      return '';
    }


    const v =
      variant as any;


    const nestedSize =
      v.size;


    if (nestedSize) {

      if (
        this.languageService.isArabic()
      ) {

        const arabicName =
          nestedSize.nameAr
            ?.toString()
            .trim();


        if (arabicName) {
          return arabicName;
        }

      }


      const englishName =
        nestedSize.nameEn
          ?.toString()
          .trim();


      if (englishName) {
        return englishName;
      }


      const normalName =
        nestedSize.name
          ?.toString()
          .trim();


      if (normalName) {
        return normalName;
      }

    }


    if (
      this.languageService.isArabic()
    ) {

      const arabicName =
        v.sizeNameAr
          ?.toString()
          .trim();


      if (arabicName) {
        return arabicName;
      }

    }


    const sizeName =
      v.sizeName
        ?.toString()
        .trim();


    if (sizeName) {
      return sizeName;
    }


    const sizeValue =
      v.sizeValue
        ?.toString()
        .trim();


    if (sizeValue) {
      return sizeValue;
    }


    return '';

  }


  getHeelSizeName(
    variant?: ProductVariant
  ): string {

    if (!variant) {
      return '';
    }


    const v =
      variant as any;


    const nestedHeelSize =
      v.heelSize;


    if (nestedHeelSize) {

      if (
        this.languageService.isArabic()
      ) {

        const arabicName =
          nestedHeelSize.nameAr
            ?.toString()
            .trim();


        if (arabicName) {
          return arabicName;
        }

      }


      const englishName =
        nestedHeelSize.nameEn
          ?.toString()
          .trim();


      if (englishName) {
        return englishName;
      }


      const normalName =
        nestedHeelSize.name
          ?.toString()
          .trim();


      if (normalName) {
        return normalName;
      }

    }


    if (
      this.languageService.isArabic()
    ) {

      const arabicName =
        v.heelSizeNameAr
          ?.toString()
          .trim();


      if (arabicName) {
        return arabicName;
      }

    }


    const heelSizeName =
      v.heelSizeName
        ?.toString()
        .trim();


    if (heelSizeName) {
      return heelSizeName;
    }


    const heelValue =
      v.heelSizeValue
        ?.toString()
        .trim();


    if (heelValue) {
      return heelValue;
    }


    return '';

  }


  hasVariant(
    item: CartItem
  ): boolean {

    return !!item?.variant;

  }


  hasSize(
    item: CartItem
  ): boolean {

    return this.getSizeName(
      item?.variant
    ).length > 0;

  }


  hasHeelSize(
    item: CartItem
  ): boolean {

    return this.getHeelSizeName(
      item?.variant
    ).length > 0;

  }


  // ============================================================
  // PRICE
  // ============================================================

  getOldPrice(
    product: Product
  ): number {

    return Number(
      product?.price ?? 0
    );

  }


  getDiscountPercentage(
    product: Product
  ): number {

    return Number(
      product?.discountPercentage ?? 0
    );

  }


  hasDiscount(
    product: Product
  ): boolean {

    return (
      this.getDiscountPercentage(
        product
      ) > 0
    );

  }


  getNewPrice(
    product: Product
  ): number {

    return this.cartService
      .getFinalPrice(
        product
      );

  }


  getItemSubtotal(
    item: CartItem
  ): number {

    return this.cartService
      .getItemTotal(
        item
      );

  }


  // ============================================================
  // QUANTITY
  // ============================================================

  getTotalQuantity(): number {

    return this.cartItems.reduce(
      (total, item) =>
        total +
        item.quantity,
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


    quantity =
      Number(quantity);


    if (
      !Number.isFinite(
        quantity
      )
    ) {

      return;

    }


    quantity =
      Math.floor(quantity);


    if (quantity < 1) {
      quantity = 1;
    }


    this.cartService.updateQuantity(
      item.product.id,
      quantity,
      item.variant?.id
    );

  }


  increaseQuantity(
    item: CartItem
  ): void {

    if (!item) {
      return;
    }


    this.cartService.increaseQuantity(
      item.product.id,
      item.variant?.id
    );

  }


  decreaseQuantity(
    item: CartItem
  ): void {

    if (
      !item ||
      item.quantity <= 1
    ) {

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

  removeFromCart(
    item: CartItem
  ): void {

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

    this.cartTotal =
      this.cartService.getCartTotal();

  }


  getCartTotal(): number {

    return this.cartTotal;

  }


  // ============================================================
  // CHECKOUT
  // ============================================================

  checkout(): void {

    /*
     * Do not navigate while the cart is
     * still being restored.
     */

    if (
      !this.cartItems.length
    ) {

      return;

    }


    this.router.navigate([
      '/checkout'
    ]);

  }


  // ============================================================
  // BACK
  // ============================================================

  back(): void {

    window.history.back();

  }


  // ============================================================
  // IMAGE
  // ============================================================

  getFirstImage(
    product: Product
  ): string | null {

    const images =
      [...(product?.images ?? [])]

        .filter(
          image =>
            !!image?.imageUrl
        )

        .sort(
          (a, b) =>
            Number(
              a.sortOrder ?? 0
            ) -
            Number(
              b.sortOrder ?? 0
            )
        );


    return (
      images[0]?.imageUrl ??
      null
    );

  }


  getImageUrl(
    imageUrl?: string | null
  ): string {

    if (!imageUrl) {

      return 'assets/images/product-placeholder.png';

    }


    const normalizedUrl =
      imageUrl.trim();


    if (
      normalizedUrl.startsWith(
        'http://'
      ) ||
      normalizedUrl.startsWith(
        'https://'
      )
    ) {

      return normalizedUrl;

    }


    const baseUrl =
      this.api.replace(
        /\/+$/,
        ''
      );


    const path =
      normalizedUrl.replace(
        /^\/+/,
        '/'
      );


    return `${baseUrl}${path}`;

  }


  // ============================================================
  // TRACK BY
  // ============================================================

  trackByCartItem(
    index: number,
    item: CartItem
  ): string {

    return [
      item.product.id,
      item.variant?.id ?? 'default'
    ].join('-');

  }

}