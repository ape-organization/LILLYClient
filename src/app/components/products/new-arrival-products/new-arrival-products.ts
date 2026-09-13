import { Component, DestroyRef, EventEmitter, inject, Input, Output, signal } from '@angular/core';
import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';
import { environment } from '../../../../environments/environment';
import { ProductCardComponent } from '../product-card.component/product-card.component';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-new-arrival-products',
  imports: [ProductCardComponent,CommonModule,TranslatePipe],
  templateUrl: './new-arrival-products.html',
  styleUrl: './new-arrival-products.scss',
})
export class NewArrivalProducts {

  private readonly productService = inject(ProductService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() addedToCartProductId: number | null = null;
  @Input() alreadyInCartProductId: number | null = null;

  @Output() productClicked = new EventEmitter<Product>();
  @Output() addToCartClicked = new EventEmitter<Product>();

  readonly products = signal<Product[]>([]);
  readonly isLoading = signal(false);

  api = environment.imageApiBaseUrl;

  ngOnInit(): void {
    this.newArrivalProducts();
  }

  private newArrivalProducts(): void {
    this.isLoading.set(true);

    this.productService.newArrivalProducts().subscribe({
      next: (products) => {
        this.products.set(products ?? []);
        this.isLoading.set(false);
      },

      error: (error) => {
        console.error('Failed to load best sellers:', error);
        this.products.set([]);
        this.isLoading.set(false);
      }
    });
  }

  onProductClicked(product: Product): void {
    this.productClicked.emit(product);
  }

  onAddToCartClicked(product: Product): void {
    this.addToCartClicked.emit(product);
  }
}