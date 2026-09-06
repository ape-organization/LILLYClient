import {
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';

import { Categories } from '../categories/categories';
import { Brands } from '../brands/brands';
import { BestSellers } from '../best-sellers.component/best-sellers.component';

import { SliderService } from '../../../services/slider.service';
import { CartService } from '../../../services/cart.service';

import { Product } from '../../../models/product.model';

import { environment } from '../../../../environments/environment';

import { TranslatePipe } from '@ngx-translate/core';

import { ProductModalComponent } from '../../products/product-modal/product-modal.component';

interface HomeSlide {
  id: number;
  imageUrl: string;
}

@Component({
  selector: 'app-home',
  standalone: true,

  imports: [
    CommonModule,
    MatIconModule,
    Categories,
    Brands,
    TranslatePipe,
    BestSellers
  ],

  templateUrl: './home.html',

  styleUrls: [
    './home.scss'
  ]
})
export class Home implements OnInit, OnDestroy {

  // =====================================================
  // SERVICES
  // =====================================================

  private readonly sliderService =
    inject(SliderService);

  private readonly dialog =
    inject(MatDialog);

  private readonly cartService =
    inject(CartService);


  // =====================================================
  // ROUTER
  // =====================================================

  constructor(
    private router: Router
  ) {}


  // =====================================================
  // CART STATE
  // =====================================================

  readonly addedToCartProductId =
    signal<number | null>(null);

  private addedToCartTimer?:
    ReturnType<typeof setTimeout>;


  readonly alreadyInCartProductId =
    signal<number | null>(null);

  private alreadyInCartMessageTimer?:
    ReturnType<typeof setTimeout>;


  // =====================================================
  // ADD TO CART
  // =====================================================

  addToCart(product: Product): void {

    const alreadyExists =
      this.cartService.addToCart(product);


    // ---------------------------------------------------
    // PRODUCT ALREADY EXISTS
    // ---------------------------------------------------

    if (!alreadyExists) {

      // Remove check mark
      this.addedToCartProductId.set(null);

      this.showAlreadyInCartMessage(
        product.id
      );

      return;
    }


    // ---------------------------------------------------
    // PRODUCT ADDED SUCCESSFULLY
    // ---------------------------------------------------

    // Remove already-in-cart message
    this.alreadyInCartProductId.set(null);

    this.showAddedToCartSuccess(
      product.id
    );
  }


  // =====================================================
  // SHOW ADDED SUCCESS
  // =====================================================

  private showAddedToCartSuccess(
    productId: number
  ): void {

    // Clear previous timer
    if (this.addedToCartTimer) {

      clearTimeout(
        this.addedToCartTimer
      );
    }


    // Show check mark
    this.addedToCartProductId.set(
      productId
    );


    // Hide after 1.5 seconds
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


  // =====================================================
  // SHOW ALREADY IN CART
  // =====================================================

  private showAlreadyInCartMessage(
    productId: number
  ): void {

    // Clear previous timer
    if (this.alreadyInCartMessageTimer) {

      clearTimeout(
        this.alreadyInCartMessageTimer
      );
    }


    // Show message
    this.alreadyInCartProductId.set(
      productId
    );


    // Hide after 3 seconds
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


  // =====================================================
  // PRODUCT DETAILS
  // =====================================================

  openProductDetails(
    product: Product
  ): void {

   /*  this.dialog.open(
      ProductModalComponent,
      {
        width: '800px',
        maxWidth: '95vw',
        data: product,
        disableClose: false
      }
    ); */
  
  this.router.navigate(['/product', product.id]);

  }


  // =====================================================
  // SLIDER
  // =====================================================

  currentSlide =
    signal(0);

  slides =
    signal<HomeSlide[]>([]);

  private sliderInterval:
    ReturnType<typeof setInterval> | null = null;

  api =
    environment.imageApiBaseUrl;


  // =====================================================
  // INIT
  // =====================================================

  ngOnInit(): void {

    this.loadSliders();
  }


  // =====================================================
  // LOAD SLIDERS
  // =====================================================

  private loadSliders(): void {

    this.sliderService
      .getSliders()
      .subscribe({

        next: (
          response: HomeSlide[]
        ) => {

          this.slides.set(
            response ?? []
          );

          // Reset current slide
          this.currentSlide.set(0);

          // Start automatic slider
          this.startSlider();
        },

        error: (error) => {

          this.slides.set([]);
        }

      });
  }


  // =====================================================
  // GET IMAGE
  // =====================================================

  getCategoryImage(
    slider: HomeSlide
  ): string {

    if (
      !slider.imageUrl ||
      slider.imageUrl.trim() === ''
    ) {

      return 'assets/images/category-placeholder.jpg';
    }

    return this.api +
      slider.imageUrl;
  }


  // =====================================================
  // START SLIDER
  // =====================================================

  private startSlider(): void {

    // Stop existing timer first
    this.stopSlider();

    // No need for timer with 0 or 1 slide
    if (
      this.slides().length <= 1
    ) {

      return;
    }

    this.sliderInterval =
      setInterval(() => {

        this.nextSlide(false);

      }, 4000);
  }


  // =====================================================
  // STOP SLIDER
  // =====================================================

  private stopSlider(): void {

    if (
      this.sliderInterval !== null
    ) {

      clearInterval(
        this.sliderInterval
      );

      this.sliderInterval = null;
    }
  }


  // =====================================================
  // NEXT SLIDE
  // =====================================================

  nextSlide(
    restartTimer: boolean = true
  ): void {

    const slides =
      this.slides();

    if (
      slides.length <= 1
    ) {

      return;
    }

    const next =
      (
        this.currentSlide() + 1
      ) % slides.length;

    this.currentSlide.set(
      next
    );

    if (restartTimer) {

      this.startSlider();
    }
  }


  // =====================================================
  // PREVIOUS SLIDE
  // =====================================================

  previousSlide(): void {

    const slides =
      this.slides();

    if (
      slides.length <= 1
    ) {

      return;
    }

    const previous =
      this.currentSlide() === 0
        ? slides.length - 1
        : this.currentSlide() - 1;

    this.currentSlide.set(
      previous
    );

    this.startSlider();
  }


  // =====================================================
  // GO TO SLIDE
  // =====================================================

  goToSlide(
    index: number
  ): void {

    const slides =
      this.slides();

    if (
      index < 0 ||
      index >= slides.length
    ) {

      return;
    }

    this.currentSlide.set(
      index
    );

    this.startSlider();
  }


  // =====================================================
  // SHOP NOW
  // =====================================================

  shopNow(): void {

    this.router.navigate([
      '/products'
    ]);
  }


  // =====================================================
  // DESTROY
  // =====================================================

  ngOnDestroy(): void {

    this.stopSlider();


    // Clear check-mark timer
    if (this.addedToCartTimer) {

      clearTimeout(
        this.addedToCartTimer
      );
    }


    // Clear already-in-cart timer
    if (
      this.alreadyInCartMessageTimer
    ) {

      clearTimeout(
        this.alreadyInCartMessageTimer
      );
    }
  }
}