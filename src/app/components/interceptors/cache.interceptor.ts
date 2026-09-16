import {
  HttpContextToken,
  HttpEvent,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';

import {
  Observable,
  of,
  finalize,
  shareReplay,
  tap
} from 'rxjs';


// ============================================================
// OPTIONAL CACHE FLAG
// ============================================================

export const CACHE_REQUEST =
  new HttpContextToken<boolean>(() => false);


// ============================================================
// CACHE
// ============================================================

interface CacheEntry {
  response: HttpResponse<unknown>;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

const activeRequests =
  new Map<string, Observable<HttpEvent<unknown>>>();


// ============================================================
// CACHE SETTINGS
// ============================================================

const CACHE_TTL = 30 * 60 * 1000;


// ============================================================
// CACHEABLE ENDPOINTS
// ============================================================

const CACHEABLE_ENDPOINTS = [
  '/products/new',
  '/categories',
  '/products/best-sellers'
];


// ============================================================
// INTERCEPTOR
// ============================================================

export const cacheInterceptor: HttpInterceptorFn =
  (req, next) => {

    const method = req.method.toUpperCase();


    // ========================================================
    // MUTATIONS
    // ========================================================

    if (
      method === 'POST' ||
      method === 'PUT' ||
      method === 'PATCH' ||
      method === 'DELETE'
    ) {

      return next(req).pipe(

        tap(() => {
          invalidate(req.url);
        })

      );

    }


    // ========================================================
    // ONLY GET REQUESTS ARE CACHEABLE
    // ========================================================

    if (method !== 'GET') {
      return next(req);
    }


    // ========================================================
    // CHECK CACHEABLE
    // ========================================================

    const cacheable =
      req.context.get(CACHE_REQUEST) ||
      isCacheable(req.url);


    if (!cacheable) {
      return next(req);
    }


    // ========================================================
    // CACHE KEY
    // ========================================================

    const key =
      req.urlWithParams;


    // ========================================================
    // CACHE HIT
    // ========================================================

    const cached =
      cache.get(key);

    if (
      cached &&
      cached.expiresAt > Date.now()
    ) {

      return of(cached.response);

    }


    // Remove expired entry

    if (cached) {
      cache.delete(key);
    }


    // ========================================================
    // REQUEST ALREADY RUNNING
    // ========================================================

    const active =
      activeRequests.get(key);

    if (active) {
      return active;
    }


    // ========================================================
    // HTTP REQUEST
    // ========================================================

    const request$ =
      next(req).pipe(

        tap(event => {

          if (
            event instanceof HttpResponse
          ) {

            cache.set(
              key,
              {
                response: event,
                expiresAt:
                  Date.now() + CACHE_TTL
              }
            );

          }

        }),


        finalize(() => {

          activeRequests.delete(key);

        }),


        shareReplay({
          bufferSize: 1,
          refCount: false
        })

      );


    activeRequests.set(
      key,
      request$
    );


    return request$;
  };


// ============================================================
// CHECK CACHEABLE ENDPOINT
// ============================================================

function isCacheable(
  url: string
): boolean {

  const path =
    url
      .toLowerCase()
      .split('?')[0];

  return CACHEABLE_ENDPOINTS.some(
    endpoint =>
      path.endsWith(endpoint) ||
      path.includes(`${endpoint}/`)
  );

}


// ============================================================
// INVALIDATE
// ============================================================

function invalidate(
  url: string
): void {

  const path =
    url
      .toLowerCase()
      .split('?')[0];


  // ----------------------------------------------------------
  // products/best-sellers
  // ----------------------------------------------------------

  if (isResource(path, '/products/best-sellers')) {

    clearResource('/products/best-sellers');

    return;
  }


  // ----------------------------------------------------------
  // products/new
  // ----------------------------------------------------------

  if (isResource(path, '/products/new')) {

    clearResource('/products/new');

    return;
  }


  // ----------------------------------------------------------
  // CATEGORIES
  // ----------------------------------------------------------

  if (isResource(path, '/categories')) {

    clearResource('/categories');
    clearResource('/products/new');

  }

}


// ============================================================
// RESOURCE CHECK
// ============================================================

function isResource(
  url: string,
  resource: string
): boolean {

  return (
    url.endsWith(resource) ||
    url.includes(`${resource}/`)
  );

}


// ============================================================
// CLEAR RESOURCE
// ============================================================

function clearResource(
  resource: string
): void {

  for (
    const key of cache.keys()
  ) {

    const url =
      key
        .toLowerCase()
        .split('?')[0];

    if (
      isResource(url, resource)
    ) {

      cache.delete(key);

    }

  }

}