import {
  Component,
  inject,
  OnInit,
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

import { Product } from '../../../models/product.model';
import { SubCategory } from '../../../models/subCategory.model';

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
export class ProductModalComponent implements OnInit {

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
  // IMAGE API
  // =====================================================

  api = environment.imageApiBaseUrl;


  // =====================================================
  // INIT
  // =====================================================

  ngOnInit(): void {
console.log("**************")
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
  // LOAD PRODUCT
  // =====================================================

  private loadProduct(id: number): void {

    this.productService.getProduct(id).subscribe({

      next: (product) => {

        this.product.set(product);

      },

      error: () => {

        this.goBack();

      }

    });

  }


  // =====================================================
  // STOCK
  // =====================================================

  get stock(): number {

    return Number(
      this.product()?.stockQuantity ?? 0
    );

  }


  get isOutOfStock(): boolean {

    return this.product()?.isInStock !== true;

  }


  get canAddToCart(): boolean {
    return (
      this.product()?.isInStock === true &&
      this.quantity() > 0
    );

  }


  // =====================================================
  // PRICE
  // =====================================================

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

    if (!this.hasDiscount) {

      return this.oldPrice;

    }

    const discount = Number(
      this.product()?.discountPercentage ?? 0
    );

    return Math.max(
      0,
      this.oldPrice -
      (this.oldPrice * discount / 100)
    );

  }


  // =====================================================
  // QUANTITY
  // =====================================================

setQuantity(value: number): void {

  let newQuantity = Number(value);

  if (!Number.isFinite(newQuantity)) {
    newQuantity = 1;
  }

  newQuantity = Math.floor(newQuantity);

  if (newQuantity < 1) {
    newQuantity = 1;
  }



  this.quantity.set(newQuantity);
}

  validateQuantity(): void {

    this.setQuantity(
      this.quantity()
    );

  }


  // =====================================================
  // ADD TO CART
  // =====================================================

  addToCart(): void {

    const product = this.product();

    if (!product?.isInStock) {

      return;

    }

    this.validateQuantity();

    const selectedQuantity = this.quantity();

    if (selectedQuantity <= 0) {

      return;

    }

    const added = this.cartService.replaceCartItem(
      product,
      selectedQuantity
    );

    if (!added) {

      return;

    }
this.goBack()
  }


  // =====================================================
  // GO BACK
  // =====================================================

  goBack(): void {

    this.router.navigate(['/products']);

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

    const product = this.product();

    if (!product) {

      return '';

    }

    if (this.languageService.isArabic()) {

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
  // PRODUCT DESCRIPTION
  // =====================================================

  getProductDescription(): string {

    const product = this.product();

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


  // =====================================================
  // CATEGORY NAME
  // =====================================================

  getCategoryName(): string {

    const product = this.product();

    const subCategory =
      product?.subCategories?.[0];

    if (!subCategory) {

      return '';

    }

    if (this.languageService.isArabic()) {

      return (
        subCategory.categoryNameAr?.trim() ||
        subCategory.categoryNameEn?.trim() ||
        ''
      );

    }

    return (
      subCategory.categoryNameEn?.trim() ||
      subCategory.categoryNameAr?.trim() ||
      ''
    );

  }


  // =====================================================
  // SUBCATEGORY NAME
  // =====================================================

  getSubCategoryName(
    subCategory: SubCategory
  ): string {

    if (this.languageService.isArabic()) {

      return (
        subCategory?.nameAr?.trim() ||
        subCategory?.nameEn?.trim() ||
        ''
      );

    }

    return (
      subCategory?.nameEn?.trim() ||
      subCategory?.nameAr?.trim() ||
      ''
    );

  }


  // =====================================================
  // BRAND NAME
  // =====================================================

  getBrandName(): string {

    const brand =
      this.product()?.brand;

    if (!brand) {

      return '';

    }

    if (this.languageService.isArabic()) {

      return (
        brand.nameAr?.trim() ||
        brand.nameEn?.trim() ||
        ''
      );

    }

    return (
      brand.nameEn?.trim() ||
      brand.nameAr?.trim() ||
      ''
    );

  }

}