
import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  Product
} from '../../../models/product.model';

import {
  MaterialModule
} from '../../../shared/AngularMaterial';

import {
  TranslatePipe
} from '@ngx-translate/core';

import {
  LanguageService
} from '../../../services/language.service';


@Component({
  selector: 'app-product-card',

  standalone: true,

  imports: [
    CommonModule,
    MaterialModule,
    TranslatePipe
  ],

  templateUrl: './product-card.component.html',

  styleUrls: [
    './product-card.component.scss'
  ]
})
export class ProductCardComponent {

  @Input({ required: true })
  product!: Product;

  @Input()
  imageApi = '';

  @Input()
  showAlreadyInCartMessage = false;

  @Input()
  showAddedCheck = false;


  @Output()
  productClicked =
    new EventEmitter<Product>();

  @Output()
  addToCartClicked =
    new EventEmitter<Product>();


  constructor(
    public languageService: LanguageService
  ) {}


  // ========================================================
  // PRODUCT NAME
  // ========================================================

  getProductName(): string {

    if (this.languageService.isArabic()) {

      return (
        this.product?.nameAr?.trim() ||
        this.product?.nameEn?.trim() ||
        'Product'
      );
    }

    return (
      this.product?.nameEn?.trim() ||
      this.product?.nameAr?.trim() ||
      'Product'
    );
  }


  // ========================================================
  // ACTIVE VARIANTS
  // ========================================================

  /**
   * Returns true when the product has at least
   * one active variant.
   *
   * stockQuantity is intentionally NOT considered.
   */
  hasActiveVariants(
    product: Product = this.product
  ): boolean {

    return (
      product?.variants?.some(
        variant => variant.isActive !== false
      ) ?? false
    );
  }


  // ========================================================
  // PRODUCT IMAGES
  // ========================================================

  /**
   * Product images are strings.
   *
   * Example:
   *
   * [
   *   "/uploads/Shop/image-one.webp",
   *   "/uploads/Shop/image-two.webp"
   * ]
   */

  getFirstImage(): string | null {

    return (
      this.product?.images?.[0] ??
      null
    );
  }


  getSecondImage(): string | null {

    return (
      this.product?.images?.[1] ??
      null
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

    const url =
      imageUrl.trim();

    if (!url) {

      return 'assets/images/product-placeholder.png';
    }

    if (
      url.startsWith('http://') ||
      url.startsWith('https://')
    ) {

      return url;
    }

    return `${this.imageApi}${url}`;
  }


  // ========================================================
  // DISCOUNT
  // ========================================================

  hasDiscount(): boolean {

    return Number(
      this.product?.discountPercentage ?? 0
    ) > 0;
  }


  getDiscountedPrice(): number {

    const price =
      Number(
        this.product?.price ?? 0
      );

    const discount =
      Number(
        this.product?.discountPercentage ?? 0
      );

    if (discount <= 0) {

      return price;
    }

    return Math.max(
      0,
      price -
      (price * discount / 100)
    );
  }


  // ========================================================
  // PRODUCT CLICK
  // ========================================================

  openDetails(): void {

    this.productClicked.emit(
      this.product
    );
  }


  // ========================================================
  // ADD TO CART
  // ========================================================

  addToCart(
    event: MouseEvent
  ): void {

    event.stopPropagation();

    // Product itself is unavailable.
    if (
      !this.product?.isInStock
    ) {

      return;
    }

    // Prevent repeated click when
    // the parent is already showing
    // the added state.
    if (this.showAddedCheck) {

      return;
    }

    /*
     * If the product has active variants,
     * the parent handles opening the
     * product details/modal.
     */
    this.addToCartClicked.emit(
      this.product
    );
  }
}
