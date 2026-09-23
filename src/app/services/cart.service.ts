import { Injectable } from '@angular/core';

import {
  BehaviorSubject,
  Observable,
  of,
  timeout
} from 'rxjs';

import {
  catchError,
  finalize,
  map,
  tap
} from 'rxjs/operators';

import {
  Product,
  ProductVariant
} from '../models/product.model';

import {
  ProductService
} from './product.service';


export interface StoredCartItem {

  productId: number;

  quantity: number;

  variantId?: number | null;
}


export interface CartItem {

  product: Product;

  quantity: number;

  variant?: ProductVariant;
}


export interface OrderItemRequest {

  productId: number;

  quantity: number;

  productVariantId?: number | null;
}


@Injectable({
  providedIn: 'root'
})
export class CartService {


  // ============================================================
  // STORAGE
  // ============================================================

  private readonly CART_STORAGE_KEY = 'cart';


  // ============================================================
  // INITIALIZATION
  // ============================================================

  private readonly cartInitialized =
    new BehaviorSubject<boolean>(false);

  public readonly cartInitialized$ =
    this.cartInitialized.asObservable();


  // ============================================================
  // CART ITEMS
  // ============================================================

  private readonly cartItems =
    new BehaviorSubject<CartItem[]>([]);

  public readonly cartItems$ =
    this.cartItems.asObservable();


  // ============================================================
  // CART COUNT
  // ============================================================

  private readonly cartCount =
    new BehaviorSubject<number>(0);

  public readonly cartCount$ =
    this.cartCount.asObservable();


  // ============================================================
  // CART LOADING
  // ============================================================

  private readonly cartLoading =
    new BehaviorSubject<boolean>(false);

  public readonly cartLoading$ =
    this.cartLoading.asObservable();


  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(
    private readonly productService: ProductService
  ) {

    this.initializeCart();

  }


  // ============================================================
  // INITIALIZE CART
  // ============================================================

  private initializeCart(): void {

    const storedItems =
      this.readStoredCart();


    console.log(
      '[CartService] Initializing cart:',
      storedItems
    );


    /*
     * No saved cart.
     *
     * We can immediately consider the cart initialized.
     */

    if (storedItems.length === 0) {

      this.cartItems.next([]);

      this.updateCartCount();

      this.cartInitialized.next(true);

      console.log(
        '[CartService] Cart initialized - empty'
      );

      return;
    }


    /*
     * Saved cart exists.
     *
     * Restore products from the API.
     */

    this.refreshCartFromApi()
      .pipe(
        finalize(() => {

          /*
           * VERY IMPORTANT:
           *
           * Initialization must always finish,
           * whether API succeeds, fails, or times out.
           */

          this.cartInitialized.next(true);

          console.log(
            '[CartService] Cart initialization finished'
          );

        })
      )
      .subscribe({
        next: items => {

          console.log(
            '[CartService] Cart refresh result:',
            items
          );

        },

        error: error => {

          /*
           * This should normally not be reached because
           * refreshCartFromApi handles its own errors.
           */

          console.error(
            '[CartService] Cart initialization error:',
            error
          );

        }
      });

  }


  // ============================================================
  // ADD TO CART
  // ============================================================

  addToCart(
    product: Product,
    quantity: number = 1,
    variant?: ProductVariant
  ): boolean {

    if (!product?.id) {
      return false;
    }


    if (product.isInStock !== true) {
      return false;
    }


    quantity =
      this.normalizeQuantity(quantity);


    if (quantity <= 0) {
      return false;
    }


    const hasActiveVariants =
      this.hasActiveVariants(product);


    if (hasActiveVariants) {

      if (!variant) {
        return false;
      }


      if (variant.isActive === false) {
        return false;
      }

    } else {

      variant = undefined;

    }


    const currentCart =
      [...this.cartItems.value];


    const existingItem =
      currentCart.find(item =>
        this.isSameCartItem(
          item,
          product,
          variant
        )
      );


    if (existingItem) {
      return false;
    }


    currentCart.push({

      product,

      quantity,

      variant

    });


    this.setCart(currentCart);

    return true;
  }


  // ============================================================
  // REPLACE CART ITEM
  // ============================================================

  replaceCartItem(
    product: Product,
    quantity: number,
    variant?: ProductVariant
  ): boolean {

    if (!product?.id) {
      return false;
    }


    if (product.isInStock !== true) {
      return false;
    }


    quantity =
      this.normalizeQuantity(quantity);


    if (quantity <= 0) {
      return false;
    }


    const hasActiveVariants =
      this.hasActiveVariants(product);


    if (hasActiveVariants) {

      if (!variant) {
        return false;
      }


      if (variant.isActive === false) {
        return false;
      }

    } else {

      variant = undefined;

    }


    const currentCart =
      this.cartItems.value.filter(item =>
        !this.isSameCartItem(
          item,
          product,
          variant
        )
      );


    currentCart.push({

      product,

      quantity,

      variant

    });


    this.setCart(currentCart);

    return true;
  }


  // ============================================================
  // PRODUCT / VARIANT CART CHECKS
  // ============================================================

  isProductInCart(
    productId: number
  ): boolean {

    return this.cartItems.value.some(item =>
      item.product.id === productId &&
      !item.variant
    );
  }


  isVariantInCart(
    productId: number,
    variantId: number
  ): boolean {

    return this.cartItems.value.some(item =>
      item.product.id === productId &&
      item.variant?.id === variantId
    );
  }


  isInCart(
    productId: number,
    variantId?: number | null
  ): boolean {

    return this.cartItems.value.some(item =>
      item.product.id === productId &&
      (item.variant?.id ?? null) ===
      (variantId ?? null)
    );
  }


  // ============================================================
  // REMOVE FROM CART
  // ============================================================

  removeFromCart(
    productId: number,
    variantId?: number | null
  ): void {

    const updatedCart =
      this.cartItems.value.filter(item => {

        if (item.product.id !== productId) {
          return true;
        }


        if (
          variantId !== undefined &&
          variantId !== null
        ) {

          return item.variant?.id !== variantId;

        }


        return !!item.variant;

      });


    this.setCart(updatedCart);
  }


  // ============================================================
  // UPDATE QUANTITY
  // ============================================================

  updateQuantity(
    productId: number,
    quantity: number,
    variantId?: number | null
  ): void {

    quantity =
      this.normalizeQuantity(quantity);


    if (quantity <= 0) {

      this.removeFromCart(
        productId,
        variantId
      );

      return;
    }


    const currentCart =
      [...this.cartItems.value];


    const item =
      currentCart.find(cartItem =>
        cartItem.product.id === productId &&
        this.isSameVariant(
          cartItem.variant,
          variantId
        )
      );


    if (!item) {
      return;
    }


    if (item.product.isInStock !== true) {

      this.removeFromCart(
        productId,
        variantId
      );

      return;
    }


    if (
      item.variant &&
      item.variant.isActive === false
    ) {

      this.removeFromCart(
        productId,
        variantId
      );

      return;
    }


    item.quantity = quantity;

    this.setCart(currentCart);
  }


  // ============================================================
  // INCREASE QUANTITY
  // ============================================================

  increaseQuantity(
    productId: number,
    variantId?: number | null
  ): void {

    const item =
      this.cartItems.value.find(cartItem =>
        cartItem.product.id === productId &&
        this.isSameVariant(
          cartItem.variant,
          variantId
        )
      );


    if (!item) {
      return;
    }


    this.updateQuantity(
      productId,
      item.quantity + 1,
      variantId
    );
  }


  // ============================================================
  // DECREASE QUANTITY
  // ============================================================

  decreaseQuantity(
    productId: number,
    variantId?: number | null
  ): void {

    const item =
      this.cartItems.value.find(cartItem =>
        cartItem.product.id === productId &&
        this.isSameVariant(
          cartItem.variant,
          variantId
        )
      );


    if (!item) {
      return;
    }


    this.updateQuantity(
      productId,
      item.quantity - 1,
      variantId
    );
  }


  // ============================================================
  // CLEAR CART
  // ============================================================

  clearCart(): void {

    this.cartItems.next([]);

    this.updateCartCount();

    this.removeCartFromStorage();
  }


  // ============================================================
  // GETTERS
  // ============================================================

  getCartItems(): CartItem[] {

    return [
      ...this.cartItems.value
    ];
  }


  getProductIds(): number[] {

    return this.cartItems.value
      .map(item =>
        item.product.id
      )
      .filter(id => id > 0);
  }


  // ============================================================
  // ORDER ITEMS
  // ============================================================

  getOrderItems(): OrderItemRequest[] {

    return this.cartItems.value

      .map(item => ({

        productId:
          item.product.id,

        quantity:
          this.normalizeQuantity(
            item.quantity
          ),

        productVariantId:
          item.variant?.id ?? null

      }))

      .filter(item =>
        item.productId > 0 &&
        item.quantity > 0
      );
  }


  // ============================================================
  // CART TOTAL
  // ============================================================

  getCartTotal(): number {

    const total =
      this.cartItems.value.reduce(
        (total, item) => {

          const price =
            this.getFinalPrice(
              item.product
            );

          return total +
            price * item.quantity;

        },
        0
      );


    return this.roundPrice(total);
  }


  // ============================================================
  // FINAL PRODUCT PRICE
  // ============================================================

  getFinalPrice(
    product: Product
  ): number {

    const price =
      Number(
        product.price ?? 0
      );


    const discount =
      Number(
        product.discountPercentage ?? 0
      );


    if (discount <= 0) {

      return this.roundPrice(
        price
      );

    }


    const finalPrice =
      Math.max(
        0,
        price -
        (price * discount / 100)
      );


    return this.roundPrice(
      finalPrice
    );
  }


  // ============================================================
  // ITEM TOTAL
  // ============================================================

  getItemTotal(
    item: CartItem
  ): number {

    const price =
      this.getFinalPrice(
        item.product
      );


    return this.roundPrice(
      price * item.quantity
    );
  }


  // ============================================================
  // REFRESH CART FROM API
  // ============================================================

  /*
   * PUBLIC because CartComponent can manually request
   * a refresh if needed.
   *
   * However, the CartComponent below no longer needs
   * to call this on initialization.
   */

  public refreshCartFromApi():
    Observable<CartItem[]> {

    const storedItems =
      this.readStoredCart();


    if (storedItems.length === 0) {

      this.cartItems.next([]);

      this.updateCartCount();

      return of([]);
    }


    const productIds = [
      ...new Set(
        storedItems.map(
          item => item.productId
        )
      )
    ];


    console.log(
      '[CartService] Refreshing product IDs:',
      productIds
    );


    this.cartLoading.next(true);


    return this.productService
      .getProductsByIds(productIds)

      .pipe(

        /*
         * IMPORTANT:
         *
         * Prevent infinite loading if the API request
         * never completes.
         *
         * 10 seconds is enough for a normal API call.
         */

        timeout(10000),


        map(products => {

          console.log(
            '[CartService] Products returned:',
            products
          );


          const validCart: CartItem[] = [];


          for (
            const storedItem of storedItems
          ) {

            const product =
              products.find(
                p =>
                  p.id ===
                  storedItem.productId
              );


            if (!product) {
              continue;
            }


            if (
              product.isInStock !== true
            ) {

              continue;

            }


            const hasActiveVariants =
              this.hasActiveVariants(
                product
              );


            // --------------------------------------------------
            // PRODUCT HAS ACTIVE VARIANTS
            // --------------------------------------------------

            if (hasActiveVariants) {

              if (
                storedItem.variantId ===
                  null ||
                storedItem.variantId ===
                  undefined
              ) {

                continue;

              }


              const variant =
                product.variants?.find(
                  v =>
                    v.id ===
                      storedItem.variantId &&
                    v.isActive !== false
                );


              if (!variant) {
                continue;
              }


              const quantity =
                this.normalizeQuantity(
                  storedItem.quantity
                );


              if (quantity <= 0) {
                continue;
              }


              validCart.push({

                product,

                quantity,

                variant

              });


              continue;
            }


            // --------------------------------------------------
            // PRODUCT WITHOUT ACTIVE VARIANTS
            // --------------------------------------------------

            const quantity =
              this.normalizeQuantity(
                storedItem.quantity
              );


            if (quantity <= 0) {
              continue;
            }


            validCart.push({

              product,

              quantity

            });

          }


          return validCart;

        }),


        tap(validCart => {

          console.log(
            '[CartService] Valid cart:',
            validCart
          );


          this.cartItems.next(
            validCart
          );


          this.updateCartCount();


          /*
           * Save the cleaned cart.
           */

          this.saveCartToStorage(
            validCart
          );

        }),


        catchError(error => {

          console.error(
            '[CartService] Failed to refresh cart:',
            error
          );


          /*
           * IMPORTANT:
           *
           * Do NOT delete localStorage if the API
           * temporarily fails.
           *
           * Also return the current cart so the
           * observable completes normally.
           */

          return of(
            this.cartItems.value
          );

        }),


        finalize(() => {

          /*
           * Loading must ALWAYS stop.
           */

          this.cartLoading.next(false);

        })

      );
  }


  // ============================================================
  // SET CART
  // ============================================================

  private setCart(
    items: CartItem[]
  ): void {

    const cart =
      [...items];


    this.cartItems.next(
      cart
    );


    this.updateCartCount();


    this.saveCartToStorage(
      cart
    );
  }


  // ============================================================
  // SAVE CART TO LOCAL STORAGE
  // ============================================================

  private saveCartToStorage(
    items: CartItem[]
  ): void {

    const storedItems:
      StoredCartItem[] =
      items.map(item => ({

        productId:
          item.product.id,

        quantity:
          item.quantity,

        variantId:
          item.variant?.id ?? null

      }));


    try {

      localStorage.setItem(
        this.CART_STORAGE_KEY,
        JSON.stringify(
          storedItems
        )
      );

    } catch (error) {

      console.error(
        'Error saving cart:',
        error
      );

    }
  }


  // ============================================================
  // READ CART FROM LOCAL STORAGE
  // ============================================================

  private readStoredCart():
    StoredCartItem[] {

    const saved =
      localStorage.getItem(
        this.CART_STORAGE_KEY
      );


    if (!saved) {
      return [];
    }


    try {

      const parsed =
        JSON.parse(saved);


      if (!Array.isArray(parsed)) {

        this.removeCartFromStorage();

        return [];

      }


      // --------------------------------------------------------
      // NEW FORMAT
      // --------------------------------------------------------

      const newFormat =
        parsed.every(
          item =>
            item &&
            typeof item.productId === 'number'
        );


      if (newFormat) {

        return parsed

          .map(item => ({

            productId:
              Number(
                item.productId
              ),

            quantity:
              this.normalizeQuantity(
                item.quantity
              ),

            variantId:
              item.variantId !==
                undefined &&
              item.variantId !==
                null

                ? Number(
                    item.variantId
                  )

                : null

          }))

          .filter(item =>
            item.productId > 0 &&
            item.quantity > 0
          );
      }


      // --------------------------------------------------------
      // OLD FORMAT MIGRATION
      // --------------------------------------------------------

      const oldFormat =
        parsed.every(
          item =>
            item &&
            item.product &&
            typeof item.product.id ===
              'number'
        );


      if (oldFormat) {

        const migrated:
          StoredCartItem[] =

          parsed

            .map(item => ({

              productId:
                Number(
                  item.product.id
                ),

              quantity:
                this.normalizeQuantity(
                  item.quantity
                ),

              variantId:
                null

            }))

            .filter(item =>
              item.productId > 0 &&
              item.quantity > 0
            );


        this.saveStoredCart(
          migrated
        );


        return migrated;
      }


      this.removeCartFromStorage();

      return [];

    } catch (error) {

      console.error(
        'Error reading cart:',
        error
      );


      this.removeCartFromStorage();

      return [];

    }
  }


  // ============================================================
  // SAVE MIGRATED STORAGE
  // ============================================================

  private saveStoredCart(
    items: StoredCartItem[]
  ): void {

    try {

      localStorage.setItem(
        this.CART_STORAGE_KEY,
        JSON.stringify(items)
      );

    } catch (error) {

      console.error(
        'Error saving migrated cart:',
        error
      );

    }
  }


  // ============================================================
  // REMOVE STORAGE
  // ============================================================

  private removeCartFromStorage(): void {

    localStorage.removeItem(
      this.CART_STORAGE_KEY
    );
  }


  // ============================================================
  // CART COUNT
  // ============================================================

  private updateCartCount(): void {

    const count =
      this.cartItems.value.reduce(
        (total, item) =>
          total + item.quantity,
        0
      );


    this.cartCount.next(
      count
    );
  }


  // ============================================================
  // ACTIVE VARIANT CHECK
  // ============================================================

  private hasActiveVariants(
    product: Product
  ): boolean {

    return (
      product.variants?.some(
        variant =>
          variant.isActive !== false
      ) ?? false
    );
  }


  // ============================================================
  // SAME CART ITEM
  // ============================================================

  private isSameCartItem(
    item: CartItem,
    product: Product,
    variant?: ProductVariant
  ): boolean {

    if (
      item.product.id !==
      product.id
    ) {

      return false;

    }


    return this.isSameVariant(
      item.variant,
      variant?.id ?? null
    );
  }


  // ============================================================
  // SAME VARIANT
  // ============================================================

  private isSameVariant(
    itemVariant:
      ProductVariant | undefined,

    variantId:
      number | null | undefined
  ): boolean {

    const itemVariantId =
      itemVariant?.id ?? null;


    const requestedVariantId =
      variantId ?? null;


    return (
      itemVariantId ===
      requestedVariantId
    );
  }


  // ============================================================
  // NORMALIZE QUANTITY
  // ============================================================

  private normalizeQuantity(
    value: number
  ): number {

    const quantity =
      Number(value);


    if (
      !Number.isFinite(
        quantity
      )
    ) {

      return 0;

    }


    if (quantity <= 0) {
      return 0;
    }


    return Math.floor(
      quantity
    );
  }


  // ============================================================
  // ROUND PRICE
  // ============================================================

  private roundPrice(
    value: number
  ): number {

    return Math.round(
      (
        Number(value) +
        Number.EPSILON
      ) * 100
    ) / 100;
  }

}