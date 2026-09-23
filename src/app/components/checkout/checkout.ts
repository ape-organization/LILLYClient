import {
  CommonModule
} from '@angular/common';

import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal
} from '@angular/core';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import {
  MatButtonModule
} from '@angular/material/button';

import {
  MatDialog,
  MatDialogModule
} from '@angular/material/dialog';

import {
  MatIconModule
} from '@angular/material/icon';

import {
  MatProgressSpinnerModule
} from '@angular/material/progress-spinner';

import {
  Router,
  RouterModule
} from '@angular/router';

import {
  Subject,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  takeUntil
} from 'rxjs';

import {
  CartItem,
  CartService
} from '../../services/cart.service';

import {
  Product,
  ProductVariant
} from '../../models/product.model';

import {
  OrderService
} from '../../services/order.service';

import {
  ClientService
} from '../../services/client.service';

import {
  environment
} from '../../../environments/environment';

import {
  TranslatePipe
} from '@ngx-translate/core';

import {
  NotifyMessage
} from '../shared/notify-message/notify-message';

import {
  LanguageService
} from '../../services/language.service';


@Component({
  selector: 'app-checkout',

  standalone: true,

  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslatePipe
  ],

  templateUrl: './checkout.html',

  styleUrls: ['./checkout.scss']
})
export class CheckoutComponent
  implements OnInit, OnDestroy {

private readonly cdr = inject(ChangeDetectorRef);
  // =========================================================
  // SERVICES
  // =========================================================

  private readonly fb =
    inject(FormBuilder);

  private readonly cartService =
    inject(CartService);

  private readonly clientService =
    inject(ClientService);

  private readonly orderService =
    inject(OrderService);

  private readonly dialog =
    inject(MatDialog);

  private readonly router =
    inject(Router);

  readonly languageService =
    inject(LanguageService);


  // =========================================================
  // DESTROY
  // =========================================================

  private readonly destroy$ =
    new Subject<void>();


  // =========================================================
  // SIGNALS
  // =========================================================

  readonly isSubmitting =
    signal(false);

  readonly isSearchingClient =
    signal(false);

  readonly clientFound =
    signal(false);


  // =========================================================
  // CART
  // =========================================================

  cartItems: CartItem[] = [];

  isCartInitialized = false;

  isCartLoading = false;


  // =========================================================
  // FORM
  // =========================================================

  checkoutForm =
    this.fb.nonNullable.group({

      fullName: [
        '',
        [
          Validators.required,
          Validators.minLength(2)
        ]
      ],

      phone: [
        '',
        [
          Validators.required,
          Validators.pattern(
            /^[0-9+\-\s()]{7,20}$/
          )
        ]
      ],

      email: [
        '',
        [
          Validators.email
        ]
      ],

      address: [
        '',
        [
          Validators.required,
          Validators.minLength(5)
        ]
      ]

    });


  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {

    this.subscribeToCart();

    this.setupPhoneLookup();

  }


  // =========================================================
  // DESTROY
  // =========================================================

  ngOnDestroy(): void {

    this.destroy$.next();

    this.destroy$.complete();

  }


  // =========================================================
  // CART SUBSCRIPTION
  // =========================================================

private subscribeToCart(): void {

  combineLatest([
    this.cartService.cartItems$,
    this.cartService.cartInitialized$,
    this.cartService.cartLoading$
  ])

    .pipe(
      takeUntil(this.destroy$)
    )

    .subscribe(
      ([items, initialized, loading]) => {

        this.cartItems = items ?? [];

        this.isCartInitialized = initialized;

        this.isCartLoading = loading;

        console.log(
          '[Checkout] Cart state:',
          {
            items: this.cartItems,
            initialized: this.isCartInitialized,
            loading: this.isCartLoading
          }
        );

        this.cdr.detectChanges();

      }
    );

}


  // =========================================================
  // TOTAL ITEMS
  // =========================================================

  get totalItems(): number {

    return this.cartItems.reduce(
      (total, item) =>
        total +
        Number(
          item.quantity || 0
        ),
      0
    );

  }


  // =========================================================
  // SUBTOTAL
  // =========================================================

  get subtotal(): number {

    const total =
      this.cartItems.reduce(
        (sum, item) =>
          sum +
          this.getItemSubtotal(item),
        0
      );


    return this.roundPrice(total);

  }


  // =========================================================
  // TOTAL
  // =========================================================

  get total(): number {

    return this.roundPrice(
      this.subtotal
    );

  }


  // =========================================================
  // PHONE LOOKUP
  // =========================================================

  private setupPhoneLookup(): void {

    const phoneControl =
      this.checkoutForm.controls.phone;


    phoneControl.valueChanges

      .pipe(

        debounceTime(400),

        distinctUntilChanged(),

        takeUntil(this.destroy$)

      )

      .subscribe(phone => {

        const normalizedPhone =
          phone.trim();


        if (
          normalizedPhone.length < 7
        ) {

          this.isSearchingClient.set(
            false
          );

          this.clientFound.set(
            false
          );

          return;
        }


        if (
          phoneControl.errors?.['pattern']
        ) {

          this.isSearchingClient.set(
            false
          );

          this.clientFound.set(
            false
          );

          return;
        }


        this.searchClient(
          normalizedPhone
        );

      });

  }


  // =========================================================
  // SEARCH CLIENT
  // =========================================================

  private searchClient(
    phone: string
  ): void {

    this.isSearchingClient.set(
      true
    );

    this.clientFound.set(
      false
    );


    this.clientService
      .getByPhone(phone)

      .pipe(
        takeUntil(this.destroy$)
      )

      .subscribe({

        next: client => {

          this.isSearchingClient.set(
            false
          );


          if (!client) {

            this.clientFound.set(
              false
            );


            this.checkoutForm.patchValue(
              {
                fullName: '',
                email: '',
                address: ''
              },
              {
                emitEvent: false
              }
            );


            return;
          }


          this.clientFound.set(
            true
          );


          this.checkoutForm.patchValue(
            {

              fullName:
                client.name?.trim() ?? '',

              email:
                client.email?.trim() ?? '',

              address:
                client.address?.trim() ?? ''

            },
            {
              emitEvent: false
            }
          );

        },


        error: error => {

          console.error(
            'Client lookup error:',
            error
          );


          this.isSearchingClient.set(
            false
          );

          this.clientFound.set(
            false
          );

        }

      });

  }


  // =========================================================
  // BACK TO CART
  // =========================================================

  goBackToCart(): void {

    this.router.navigate([
      '/cart'
    ]);

  }


  // =========================================================
  // PRODUCT NAME
  // =========================================================

  getProductName(
    item: CartItem
  ): string {

    const product =
      item?.product;


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


  // =========================================================
  // SIZE NAME
  // =========================================================

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


      const value =
        nestedSize.value
          ?.toString()
          .trim();


      if (value) {
        return value;
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


  // =========================================================
  // HAS SIZE
  // =========================================================

  hasSize(
    item: CartItem
  ): boolean {

    return this.getSizeName(
      item?.variant
    ).length > 0;

  }


  // =========================================================
  // HEEL SIZE NAME
  // =========================================================

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


      const value =
        nestedHeelSize.value
          ?.toString()
          .trim();


      if (value) {
        return value;
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


  // =========================================================
  // HAS HEEL SIZE
  // =========================================================

  hasHeelSize(
    item: CartItem
  ): boolean {

    return this.getHeelSizeName(
      item?.variant
    ).length > 0;

  }


  // =========================================================
  // HAS VARIANT
  // =========================================================

  hasVariant(
    item: CartItem
  ): boolean {

    return !!item?.variant;

  }


  // =========================================================
  // DISCOUNT CHECK
  // =========================================================

  hasDiscount(
    product: Product
  ): boolean {

    return Number(
      product?.discountPercentage ?? 0
    ) > 0;

  }


  // =========================================================
  // DISCOUNT PERCENTAGE
  // =========================================================

  getDiscountPercentage(
    product: Product
  ): number {

    return Number(
      product?.discountPercentage ?? 0
    );

  }


  // =========================================================
  // DISCOUNTED PRICE
  // =========================================================

  getDiscountedPrice(
    item: CartItem
  ): number {

    if (!item?.product) {
      return 0;
    }


    return this.cartService.getFinalPrice(
      item.product
    );

  }


  // =========================================================
  // ITEM SUBTOTAL
  // =========================================================

  getItemSubtotal(
    item: CartItem
  ): number {

    if (!item) {
      return 0;
    }


    return this.roundPrice(
      this.cartService.getItemTotal(
        item
      )
    );

  }


  // =========================================================
  // FIRST IMAGE
  // =========================================================

  getFirstImage(
    product: Product
  ): string | null {

    if (!product) {
      return null;
    }


    const images =
      [...(product.images ?? [])]

        .filter(
          image =>
            !!image?.imageUrl
        )

        .sort(
          (a, b) =>
            (a.sortOrder ?? 0) -
            (b.sortOrder ?? 0)
        );


    return (
      images[0]?.imageUrl ??
      null
    );

  }


  // =========================================================
  // IMAGE URL
  // =========================================================

  getImageUrl(
    imageUrl:
      string | null | undefined
  ): string {

    if (!imageUrl) {

      return 'assets/images/product-placeholder.png';

    }


    const normalizedUrl =
      imageUrl.trim();


    if (!normalizedUrl) {

      return 'assets/images/product-placeholder.png';

    }


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
      environment.imageApiBaseUrl
        .replace(/\/+$/, '');


    const path =
      normalizedUrl
        .replace(/^\/+/, '/');


    return `${baseUrl}${path}`;
  }


  // =========================================================
  // INCREASE
  // =========================================================

  increaseQuantity(
    item: CartItem
  ): void {

    if (!item?.product?.id) {
      return;
    }


    this.cartService.increaseQuantity(
      item.product.id,
      item.variant?.id
    );

  }


  // =========================================================
  // DECREASE
  // =========================================================

  decreaseQuantity(
    item: CartItem
  ): void {

    if (
      !item?.product?.id ||
      item.quantity <= 1
    ) {

      return;
    }


    this.cartService.decreaseQuantity(
      item.product.id,
      item.variant?.id
    );

  }


  // =========================================================
  // REMOVE
  // =========================================================

  removeItem(
    item: CartItem
  ): void {

    if (!item?.product?.id) {
      return;
    }


    this.cartService.removeFromCart(
      item.product.id,
      item.variant?.id
    );

  }


  // =========================================================
  // TRACK
  // =========================================================

  trackCartItem(
    index: number,
    item: CartItem
  ): string {

    return [
      item.product.id,
      item.variant?.id ?? 'default'
    ].join('-');

  }


  // =========================================================
  // PLACE ORDER
  // =========================================================

  placeOrder(): void {

    if (this.isSubmitting()) {
      return;
    }


    /*
     * DO NOT allow checkout while the cart
     * is still being restored.
     */

    if (!this.isCartInitialized) {

      console.log(
        '[Checkout] Cart is still initializing'
      );

      return;
    }


    if (
      this.cartItems.length === 0
    ) {

      this.showError(
        'CHECKOUT.EMPTY_CART'
      );

      return;
    }


    if (
      this.checkoutForm.invalid
    ) {

      this.checkoutForm.markAllAsTouched();

      return;
    }


    if (
      this.isSearchingClient()
    ) {

      return;
    }


    const form =
      this.checkoutForm.getRawValue();


    const items =
      this.cartService.getOrderItems();


    if (
      !items ||
      items.length === 0
    ) {

      this.showError(
        'CHECKOUT.EMPTY_CART'
      );

      return;
    }


    const request = {

      client: {

        name:
          form.fullName.trim(),

        phoneNumber:
          form.phone.trim(),

        address:
          form.address.trim(),

        email:
          form.email.trim()
            ? form.email.trim()
            : null

      },

      items

    };


    console.log(
      'Create order request:',
      request
    );


    this.isSubmitting.set(
      true
    );


    this.orderService
      .createOrder(request)

      .pipe(
        takeUntil(this.destroy$)
      )

      .subscribe({

        next: response => {

          console.log(
            'Order created successfully:',
            response
          );


          this.isSubmitting.set(
            false
          );


          this.handleSuccessfulOrder();

        },


        error: error => {

          console.error(
            'Create order error:',
            error
          );


          this.isSubmitting.set(
            false
          );


          const message =
            this.extractErrorMessage(
              error
            );


          this.showError(
            message
          );

        }

      });

  }


  // =========================================================
  // ERROR MESSAGE
  // =========================================================

  private extractErrorMessage(
    error: any
  ): string {

    if (
      typeof error?.error ===
      'string'
    ) {

      return error.error;

    }


    if (
      error?.error?.message
    ) {

      return error.error.message;

    }


    if (
      error?.error?.title
    ) {

      return error.error.title;

    }


    if (
      error?.message
    ) {

      return error.message;

    }


    return 'CHECKOUT.ORDER_FAILED';
  }


  // =========================================================
  // SUCCESS
  // =========================================================

  private handleSuccessfulOrder(): void {

    this.cartService.clearCart();


    const dialogRef =
      this.dialog.open(
        NotifyMessage,
        {

          width: '400px',

          disableClose: true,

          data: {

            title:
              'ORDER.SUCCESS',

            message:
              'ORDER.SUCCESSORDER'

          }

        }
      );


    dialogRef
      .afterClosed()

      .pipe(
        takeUntil(this.destroy$)
      )

      .subscribe(() => {

        this.router.navigate([
          '/products'
        ]);

      });

  }


  // =========================================================
  // ERROR
  // =========================================================

  private showError(
    message: string
  ): void {

    this.dialog.open(
      NotifyMessage,
      {

        width: '400px',

        data: {

          title:
            'COMMON.ERROR',

          message

        }

      }
    );

  }


  // =========================================================
  // VALIDATION
  // =========================================================

  isInvalid(
    controlName: string
  ): boolean {

    const control =
      this.checkoutForm.get(
        controlName
      );


    return !!(
      control &&
      control.invalid &&
      (
        control.dirty ||
        control.touched
      )
    );

  }


  // =========================================================
  // ROUND PRICE
  // =========================================================

  private roundPrice(
    value: number
  ): number {

    return Math.round(
      (
        Number(value || 0) +
        Number.EPSILON
      ) * 100
    ) / 100;

  }

}