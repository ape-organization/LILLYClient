import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, finalize, map, tap } from 'rxjs/operators';

import { Product, ProductVariant } from '../models/product.model';
import { ProductService } from './product.service';

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

  private readonly CART_STORAGE_KEY = 'cart';

  private cartItems = new BehaviorSubject<CartItem[]>([]);
  public cartItems$ = this.cartItems.asObservable();

  private cartCount = new BehaviorSubject<number>(0);
  public cartCount$ = this.cartCount.asObservable();

  private cartLoading = new BehaviorSubject<boolean>(false);
  public cartLoading$ = this.cartLoading.asObservable();


  constructor(
    private productService: ProductService
  ) {
    this.initializeCart();
  }


  // ============================================================
  // INITIALIZE CART
  // ============================================================

  private initializeCart(): void {

    const storedItems = this.readStoredCart();

    if (storedItems.length === 0) {

      this.cartItems.next([]);

      this.updateCartCount();

      return;
    }

    this.refreshCartFromApi().subscribe();
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

    quantity = this.normalizeQuantity(quantity);

    if (quantity <= 0) {
      return false;
    }


    // ------------------------------------------------------------
    // Product has variants
    // ------------------------------------------------------------

    if (product.variants?.length > 0) {

      if (!variant) {
        return false;
      }

      if (variant.isActive === false) {
        return false;
      }

      if (variant.stockQuantity <= 0) {
        return false;
      }

      if (quantity > variant.stockQuantity) {
        quantity = variant.stockQuantity;
      }

      if (quantity <= 0) {
        return false;
      }
    }


    const currentCart = [...this.cartItems.value];


    // ------------------------------------------------------------
    // Check if exactly the same product + variant exists
    // ------------------------------------------------------------

    const existingItem = currentCart.find(item =>
      this.isSameCartItem(item, product, variant)
    );


    if (existingItem) {

      const newQuantity =
        existingItem.quantity + quantity;


      // ----------------------------------------------------------
      // Respect variant stock
      // ----------------------------------------------------------

      if (variant) {

        if (newQuantity > variant.stockQuantity) {

          existingItem.quantity =
            variant.stockQuantity;

        } else {

          existingItem.quantity =
            newQuantity;
        }

      } else {

        existingItem.quantity =
          newQuantity;
      }


      this.setCart(currentCart);

      return true;
    }


    // ------------------------------------------------------------
    // Add new cart item
    // ------------------------------------------------------------

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

    quantity = this.normalizeQuantity(quantity);

    if (quantity <= 0) {
      return false;
    }


    // ------------------------------------------------------------
    // Product has variants
    // ------------------------------------------------------------

    if (product.variants?.length > 0) {

      if (!variant) {
        return false;
      }

      if (variant.isActive === false) {
        return false;
      }

      if (variant.stockQuantity <= 0) {
        return false;
      }

      if (quantity > variant.stockQuantity) {
        quantity = variant.stockQuantity;
      }

      if (quantity <= 0) {
        return false;
      }
    }


    const currentCart =
      this.cartItems.value.filter(item =>
        !this.isSameCartItem(item, product, variant)
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
  // REMOVE FROM CART
  // ============================================================

  removeFromCart(
    productId: number,
    variantId?: number | null
  ): void {

    const updatedCart =
      this.cartItems.value.filter(item => {

        // Different product -> keep it
        if (item.product.id !== productId) {
          return true;
        }


        // --------------------------------------------------------
        // If variantId was supplied, remove only that variant
        // --------------------------------------------------------

        if (variantId !== undefined && variantId !== null) {

          return item.variant?.id !== variantId;
        }


        // --------------------------------------------------------
        // No variantId:
        // remove the product without a variant
        // --------------------------------------------------------

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

    quantity = this.normalizeQuantity(quantity);


    // ------------------------------------------------------------
    // Quantity <= 0 -> remove item
    // ------------------------------------------------------------

    if (quantity <= 0) {

      this.removeFromCart(
        productId,
        variantId
      );

      return;
    }


    const currentCart = [...this.cartItems.value];


    const item = currentCart.find(cartItem =>
      cartItem.product.id === productId &&
      this.isSameVariant(
        cartItem.variant,
        variantId
      )
    );


    if (!item) {
      return;
    }


    // ------------------------------------------------------------
    // Product must still be in stock
    // ------------------------------------------------------------

    if (item.product.isInStock !== true) {

      this.removeFromCart(
        productId,
        variantId
      );

      return;
    }


    // ------------------------------------------------------------
    // Respect variant stock
    // ------------------------------------------------------------

    if (item.variant) {

      if (item.variant.isActive === false) {

        this.removeFromCart(
          productId,
          variantId
        );

        return;
      }

      if (item.variant.stockQuantity <= 0) {

        this.removeFromCart(
          productId,
          variantId
        );

        return;
      }

      if (quantity > item.variant.stockQuantity) {

        quantity =
          item.variant.stockQuantity;
      }
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

    const item = this.cartItems.value.find(cartItem =>
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

    const item = this.cartItems.value.find(cartItem =>
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
  // GET CART ITEMS
  // ============================================================

  getCartItems(): CartItem[] {

    return [
      ...this.cartItems.value
    ];
  }


  // ============================================================
  // GET PRODUCT IDS
  // ============================================================

  getProductIds(): number[] {

    return this.cartItems.value
      .map(item => item.product.id)
      .filter(id => id > 0);
  }


  // ============================================================
  // GET ORDER ITEMS
  // ============================================================

 // ============================================================
// GET ORDER ITEMS
// ============================================================

getOrderItems(): OrderItemRequest[] {

  return this.cartItems.value

    .map(item => ({
      productId: item.product.id,

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
  // GET CART TOTAL
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
  // GET FINAL PRODUCT PRICE
  // ============================================================

  getFinalPrice(
    product: Product
  ): number {

    const price =
      Number(product.price ?? 0);

    const discount =
      Number(
        product.discountPercentage ?? 0
      );


    if (discount <= 0) {

      return this.roundPrice(price);
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
  // GET ITEM TOTAL
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

  refreshCartFromApi(): Observable<CartItem[]> {

    const storedItems =
      this.readStoredCart();


    if (storedItems.length === 0) {

      this.cartItems.next([]);

      this.updateCartCount();

      return of([]);
    }


    const productIds =
      storedItems.map(
        item => item.productId
      );


    this.cartLoading.next(true);


    return this.productService
      .getProductsByIds(productIds)

      .pipe(

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


            // ----------------------------------------------------
            // Product no longer exists
            // ----------------------------------------------------

            if (!product) {
              continue;
            }


            // ----------------------------------------------------
            // Product no longer available
            // ----------------------------------------------------

            if (product.isInStock !== true) {
              continue;
            }

// ----------------------------------------------------
// Product now has variants but cart has no variant
// ----------------------------------------------------

if (
  product.variants?.length > 0 &&
  (
    storedItem.variantId === undefined ||
    storedItem.variantId === null
  )
) {
  continue;
}
            let quantity =
              this.normalizeQuantity(
                storedItem.quantity
              );


            if (quantity <= 0) {
              continue;
            }


            // ----------------------------------------------------
            // Restore variant
            // ----------------------------------------------------

            let variant:
              ProductVariant | undefined;


            if (
              storedItem.variantId !== undefined &&
              storedItem.variantId !== null
            ) {

              variant =
                product.variants?.find(
                  v =>
                    v.id ===
                    storedItem.variantId
                );


              // --------------------------------------------------
              // Variant no longer exists
              // --------------------------------------------------

              if (!variant) {
                continue;
              }


              // --------------------------------------------------
              // Variant inactive
              // --------------------------------------------------

              if (
                variant.isActive === false
              ) {
                continue;
              }


              // --------------------------------------------------
              // Variant out of stock
              // --------------------------------------------------

              if (
                variant.stockQuantity <= 0
              ) {
                continue;
              }


              // --------------------------------------------------
              // Fix quantity if stock changed
              // --------------------------------------------------

              if (
                quantity >
                variant.stockQuantity
              ) {

                quantity =
                  variant.stockQuantity;
              }
            }


            if (quantity <= 0) {
              continue;
            }


            validCart.push({

              product,

              quantity,

              variant
            });
          }


          return validCart;
        }),


        tap(validCart => {

          this.cartItems.next(
            validCart
          );

          this.updateCartCount();

          this.saveCartToStorage(
            validCart
          );
        }),


        catchError(error => {

          console.error(
            'Error refreshing cart:',
            error
          );


          return of(
            this.cartItems.value
          );
        }),


        finalize(() => {

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


      // ----------------------------------------------------------
      // NEW FORMAT
      //
      // {
      //   productId: 1,
      //   quantity: 2,
      //   variantId: 5
      // }
      // ----------------------------------------------------------

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
              item.variantId !== undefined &&
              item.variantId !== null
                ? Number(item.variantId)
                : null

          }))

          .filter(item =>
            item.productId > 0 &&
            item.quantity > 0
          );
      }


      // ----------------------------------------------------------
      // OLD FORMAT
      //
      // {
      //   product: {
      //     id: 1
      //   },
      //   quantity: 2
      // }
      // ----------------------------------------------------------

      const oldFormat =
        parsed.every(
          item =>
            item &&
            item.product &&
            typeof item.product.id === 'number'
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


      // ----------------------------------------------------------
      // Invalid format
      // ----------------------------------------------------------

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
  // SAVE MIGRATED CART
  // ============================================================

  private saveStoredCart(
    items: StoredCartItem[]
  ): void {

    try {

      localStorage.setItem(
        this.CART_STORAGE_KEY,

        JSON.stringify(
          items
        )
      );

    } catch (error) {

      console.error(
        'Error saving migrated cart:',
        error
      );
    }
  }


  // ============================================================
  // REMOVE CART FROM STORAGE
  // ============================================================

  private removeCartFromStorage(): void {

    localStorage.removeItem(
      this.CART_STORAGE_KEY
    );
  }


  // ============================================================
  // UPDATE CART COUNT
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
  // CHECK SAME CART ITEM
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
  // CHECK SAME VARIANT
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


    if (!Number.isFinite(quantity)) {
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