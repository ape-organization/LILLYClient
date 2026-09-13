import {
  CommonModule
} from '@angular/common';

import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  SimpleChanges,
  inject,
  signal
} from '@angular/core';

import {
  takeUntilDestroyed
} from '@angular/core/rxjs-interop';

import {
  TranslatePipe
} from '@ngx-translate/core';

import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';
import { environment } from '../../../../environments/environment';
import { ProductCardComponent } from '../product-card.component/product-card.component';


@Component({
  selector: 'app-relative-product',
  standalone: true,

  imports: [
    CommonModule,
    TranslatePipe,
    ProductCardComponent
  ],

  templateUrl: './relative-product.html',
  styleUrl: './relative-product.scss'
})
export class RelativeProduct  {

  private readonly productService = inject(ProductService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() addedToCartProductId: number | null = null;
  @Input() alreadyInCartProductId: number | null = null;
  @Input() CategoryId: number | null = null;
  @Input() ProductId: number | null = null;

  @Output() readonly productClicked =
    new EventEmitter<Product>();

  @Output() readonly addToCartClicked =
    new EventEmitter<Product>();

  readonly products = signal<Product[]>([]);
    readonly relativeProducts = signal<Product[]>([]);

  readonly isLoading = signal(false);

  readonly api = environment.imageApiBaseUrl;

 /*  ngOnInit(): void {
    this.loadProducts();
  } */
 ngOnChanges(changes: SimpleChanges): void {

    if (
      changes['CategoryId'] ||
      changes['ProductId']
    ) {
      if (
        this.CategoryId &&
        this.ProductId
      ) {
        this.loadProducts();
      }
    }
  }


  private loadProducts(): void {

    const CategoryId = this.CategoryId;
const productId=this.ProductId;
    if (
      CategoryId === null ||
      CategoryId <= 0
    ) {
      this.products.set([]);
      return;
    }
  if (
      productId === null ||
      productId <= 0
    ) {
      this.products.set([]);
      return;
    }
    this.isLoading.set(true);
    this.productService
      .getProductsbyCatID(CategoryId,productId)
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (products) => {
          this.products.set(products ?? []);
          this.isLoading.set(false);
        },

        error: (error) => {
          console.error(
            'Failed to load relative products:',
            error
          );

          this.products.set([]);
          this.isLoading.set(false);
        }
      });
  }

  trackByProductId(
    index: number,
    product: Product
  ): number {
    return product.id;
  }

  onProductClicked(product: Product): void {
    this.productClicked.emit(product);
  }

  onAddToCartClicked(product: Product): void {
    this.addToCartClicked.emit(product);
  }
}