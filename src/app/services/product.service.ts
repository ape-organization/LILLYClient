import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpParams
} from '@angular/common/http';
import { Observable } from 'rxjs';

import { Product } from '../models/product.model';
import { PagedResponse } from '../models/PagedResponse.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProductService {

  private readonly apiUrl = environment.apiBaseUrl;

  constructor(
    private readonly http: HttpClient
  ) {}

  // =====================================================
  // GET PRODUCTS - PAGINATED
  // =====================================================

  getProducts(
    page: number = 1,
    categoryId: number | null = null,
 
    offers: boolean = false
  ): Observable<PagedResponse<Product>> {

    let params = new HttpParams()
      .set('page', page);

    if (categoryId !== null) {
      params = params.set(
        'categoryId',
        categoryId
      );
    }


    if (offers) {
      params = params.set(
        'offers',
        'true'
      );
    }

    return this.http.get<PagedResponse<Product>>(
      `${this.apiUrl}/products`,
      { params }
    );
  }

  // =====================================================
  // SEARCH PRODUCTS BY NAME
  // =====================================================
  //
  // ONE API CALL when the user submits a search.
  //
  // The returned products are stored by ProductListComponent
  // and all subsequent filters are applied locally.
  //
  // Example:
  // /products/by-name?name=lipstick
  //
  // =====================================================

  getProductsByName(
    name: string
  ): Observable<Product[]> {

    const searchTerm = name.trim();

    if (!searchTerm) {
      return new Observable<Product[]>(subscriber => {
        subscriber.next([]);
        subscriber.complete();
      });
    }

    const params = new HttpParams()
      .set('name', searchTerm);

    return this.http.get<Product[]>(
      `${this.apiUrl}/products/by-name`,
      { params }
    );
  }

  // =====================================================
  // GET SINGLE PRODUCT
  // =====================================================

  getProduct(
    id: number
  ): Observable<Product> {

    return this.http.get<Product>(
      `${this.apiUrl}/products/${id}`
    );
  }

  // =====================================================
  // ADD PRODUCT
  // =====================================================

  addProduct(
    product: FormData
  ): Observable<Product> {

    return this.http.post<Product>(
      this.apiUrl,
      product
    );
  }

  // =====================================================
  // UPDATE PRODUCT
  // =====================================================

  updateProduct(
    id: number,
    product: FormData
  ): Observable<void> {

    return this.http.put<void>(
      `${this.apiUrl}/${id}`,
      product
    );
  }

  // =====================================================
  // DELETE PRODUCT
  // =====================================================

  deleteProduct(
    id: number
  ): Observable<void> {

    return this.http.delete<void>(
      `${this.apiUrl}/${id}`
    );
  }

  // =====================================================
  // GET PRODUCTS BY IDS
  // =====================================================

  getProductsByIds(
    productIds: number[]
  ): Observable<Product[]> {

    return this.http.post<Product[]>(
      `${this.apiUrl}/products/cart`,
      {
        productIds
      }
    );
  }
  getBestSellerProducts(
  count: number = 10
): Observable<Product[]> {

  return this.http.get<Product[]>(
    `${environment.apiBaseUrl}/products/best-sellers`,
    {
      params: {
        count: count.toString()
      }
    }
  );
}
}