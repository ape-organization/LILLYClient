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
  shareReplay,
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
   displayedUnitPrice?: number | null;
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
  // REFRESH STATE
  // ============================================================

  /*
   * Keeps the current API refresh request.
   *
   * This prevents CartComponent and CheckoutComponent
   * from creating two simultaneous API requests when
   * both ask for a refresh at nearly the same time.
   */
  private refreshInProgress$:
    Observable<CartItem[]> | null = null;


  /*
   * Stored items that could not be restored because the
   * API refresh failed.
   *
   * They are kept in localStorage on every save so a failed
   * refresh followed by an add-to-cart never wipes the saved
   * cart. The next successful refresh restores them.
   */
  private unrestoredItems: StoredCartItem[] = [];


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

    if (storedItems.length === 0) {

      this.cartItems.next([]);

      this.updateCartCount();

      this.cartInitialized.next(true);

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

        })
      )
      .subscribe({
        next: items => {
        },

        error: error => {
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

      quantity: Math.min(
        quantity,
        this.getMaxQuantity(product, variant)
      ),

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

      quantity: Math.min(
        quantity,
        this.getMaxQuantity(product, variant)
      ),

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


    const itemIndex =
      currentCart.findIndex(cartItem =>
        cartItem.product.id === productId &&
        this.isSameVariant(
          cartItem.variant,
          variantId
        )
      );


    if (itemIndex === -1) {
      return;
    }


    const item =
      currentCart[itemIndex];


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


    /*
     * Replace the item instead of mutating it so
     * subscribers see a new reference.
     */
    currentCart[itemIndex] = {
      ...item,
      quantity: Math.min(
        quantity,
        this.getMaxQuantity(
          item.product,
          item.variant
        )
      )
    };

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

    this.unrestoredItems = [];

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
  return this.cartItems
  .getValue()
    .map(item => ({
      productId: item.product.id,

      quantity:
        this.normalizeQuantity(
          item.quantity
        ),

      productVariantId:
        item.variant?.id ?? null,

      displayedUnitPrice:
        this.getFinalPrice(
          item.product
        )
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

  public refreshCartFromApi():
    Observable<CartItem[]> {

    /*
     * If another refresh is already running,
     * return the same observable instead of
     * starting another HTTP request.
     */
    if (this.refreshInProgress$) {

      return this.refreshInProgress$;

    }


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


    /*
     * Keys of the items this refresh is restoring.
     *
     * Anything added while the request is running
     * is not in this set and must be kept.
     */
    const refreshedKeys =
      new Set(
        storedItems.map(item =>
          this.getStoredKey(
            item.productId,
            item.variantId
          )
        )
      );


    this.cartLoading.next(true);


    const refresh$ =
      this.productService
        .getProductsByIds(productIds)

        .pipe(

          /*
           * Prevent infinite loading if the API request
           * never completes.
           */

          timeout(10000),


          map(products => {

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


          map(validCart => {

            /*
             * Apply any add/remove/quantity change the user
             * made while the request was running.
             */
            const cart =
              this.mergeRefreshedCart(
                validCart,
                refreshedKeys
              );


            this.unrestoredItems = [];

            this.cartItems.next(
              cart
            );


            this.updateCartCount();


            /*
             * Save the cleaned cart.
             */

            this.saveCartToStorage(
              cart
            );


            return cart;

          }),


          catchError(error => {

            /*
             * Keep every stored item that is not in memory
             * so the next save does not drop it.
             */
            const loadedKeys =
              new Set(
                this.cartItems.value.map(item =>
                  this.getCartItemKey(item)
                )
              );

            this.unrestoredItems =
              this.readStoredCart().filter(item =>
                !loadedKeys.has(
                  this.getStoredKey(
                    item.productId,
                    item.variantId
                  )
                )
              );

            return of(
              this.cartItems.value
            );

          }),


          finalize(() => {

            /*
             * Loading must ALWAYS stop.
             */

            this.cartLoading.next(false);

            /*
             * Allow the next cart/checkout entry
             * to perform a fresh API request.
             */

            this.refreshInProgress$ = null;

          }),

          /*
           * Share the same HTTP request with any
           * simultaneous callers.
           */
          shareReplay({
            bufferSize: 1,
            refCount: false
          })

        );


    this.refreshInProgress$ =
      refresh$;


    return refresh$;
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


    /*
     * Never drop items that failed to restore.
     */
    const savedKeys =
      new Set(
        storedItems.map(item =>
          this.getStoredKey(
            item.productId,
            item.variantId
          )
        )
      );

    for (const item of this.unrestoredItems) {

      if (
        !savedKeys.has(
          this.getStoredKey(
            item.productId,
            item.variantId
          )
        )
      ) {
        storedItems.push(item);
      }

    }


    try {

      localStorage.setItem(
        this.CART_STORAGE_KEY,
        JSON.stringify(
          storedItems
        )
      );

    } catch (error) {
    }
  }


  // ============================================================
  // MERGE REFRESHED CART
  // ============================================================

  /*
   * Combines the refreshed products with the current
   * localStorage state, which reflects anything the user
   * changed while the refresh request was running:
   *
   * - removed items stay removed
   * - updated quantities are kept
   * - items added during the refresh are kept
   */
  private mergeRefreshedCart(
    validCart: CartItem[],
    refreshedKeys: Set<string>
  ): CartItem[] {

    const currentStored =
      new Map(
        this.readStoredCart().map(item => [
          this.getStoredKey(
            item.productId,
            item.variantId
          ),
          item
        ])
      );


    const merged: CartItem[] = [];

    for (const item of validCart) {

      const stored =
        currentStored.get(
          this.getCartItemKey(item)
        );

      if (!stored) {
        continue;
      }

      merged.push({
        ...item,
        quantity: Math.min(
          stored.quantity,
          this.getMaxQuantity(
            item.product,
            item.variant
          )
        )
      });

    }


    for (const item of this.cartItems.value) {

      const key =
        this.getCartItemKey(item);

      if (
        !refreshedKeys.has(key) &&
        currentStored.has(key)
      ) {
        merged.push(item);
      }

    }


    return merged;
  }


  // ============================================================
  // CART ITEM KEYS
  // ============================================================

  private getStoredKey(
    productId: number,
    variantId?: number | null
  ): string {

    return `${productId}-${variantId ?? 'default'}`;
  }


  private getCartItemKey(
    item: CartItem
  ): string {

    return this.getStoredKey(
      item.product.id,
      item.variant?.id
    );
  }


  // ============================================================
  // MAX QUANTITY
  // ============================================================

  /**
   * Maximum quantity allowed for a product/variant.
   *
   * Uses the variant stock when a variant is selected,
   * otherwise the product stock. When no stock is
   * recorded (0), the limit is 5.
   */
  getMaxQuantity(
    product: Product,
    variant?: ProductVariant | null
  ): number {

    const stockQuantity =
      Number(
        variant
          ? variant.stockQuantity ?? 0
          : product?.stockQuantity ?? 0
      );

    return stockQuantity > 0
      ? Math.floor(stockQuantity)
      : 5;
  }


  // ============================================================
  // READ CART FROM LOCAL STORAGE
  // ============================================================

  private readStoredCart():
    StoredCartItem[] {

    let saved: string | null = null;

    try {

      saved =
        localStorage.getItem(
          this.CART_STORAGE_KEY
        );

    } catch (error) {

      return [];

    }


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
    }
  }


  // ============================================================
  // REMOVE STORAGE
  // ============================================================

  private removeCartFromStorage(): void {

    try {

      localStorage.removeItem(
        this.CART_STORAGE_KEY
      );

    } catch (error) {
    }
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