import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';
import { environment } from '../../../../environments/environment';
import { ProductCardComponent } from '../../products/product-card.component/product-card.component';

@Component({
  selector: 'app-best-sellers',
  standalone: true,
  imports: [
    CommonModule,
    TranslatePipe,
    ProductCardComponent
  ],
  templateUrl: './best-sellers.component.html',
  styleUrls: ['./best-sellers.component.scss']
})
export class BestSellers implements OnInit {

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
    this.loadBestSellers();
  }

  private loadBestSellers(): void {
    this.isLoading.set(true);

    this.productService.getBestSellerProducts(10).subscribe({
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