import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  signal
} from '@angular/core';

import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

import { CategoryService } from '../../../services/category.service';
import { LanguageService } from '../../../services/language.service';

import { environment } from '../../../../environments/environment';
import { Category } from '../../../models/category.model';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    TranslatePipe
  ],
  templateUrl: './categories.html',
  styleUrl: './categories.scss'
})
export class Categories
  implements OnInit, AfterViewInit, OnDestroy {

  // =====================================================
  // CATEGORIES
  // =====================================================

  categories = signal<Category[]>([]);

  isLoadingCategories = signal(true);

  // =====================================================
  // API
  // =====================================================

  readonly api = environment.imageApiBaseUrl;

  // =====================================================
  // CAROUSEL STATE
  // =====================================================

  /**
   * True when categories are wider than the visible area.
   */
  hasCategoryOverflow = signal(false);

  /**
   * True when the carousel is at the beginning.
   */
  isAtStart = signal(true);

  /**
   * True when the carousel is at the end.
   */
  isAtEnd = signal(true);

  // =====================================================
  // CATEGORY TRACK
  // =====================================================

  @ViewChild('categoryTrack')
  categoryTrack?: ElementRef<HTMLDivElement>;

  // =====================================================
  // RESIZE OBSERVER
  // =====================================================

  private resizeObserver?: ResizeObserver;

  // =====================================================
  // ANIMATION FRAME
  // =====================================================

  private scrollUpdateFrame?: number;

  // =====================================================
  // CONSTRUCTOR
  // =====================================================

  constructor(
    private readonly categoryService: CategoryService,
    private readonly router: Router,
    public readonly languageService: LanguageService
  ) {}

  // =====================================================
  // INIT
  // =====================================================

  ngOnInit(): void {
    this.loadCategories();
  }

  // =====================================================
  // VIEW INIT
  // =====================================================

  ngAfterViewInit(): void {
    this.initializeCarouselObserver();

    this.scheduleCarouselUpdate();
  }

  // =====================================================
  // DESTROY
  // =====================================================

  ngOnDestroy(): void {

    this.resizeObserver?.disconnect();

    const track =
      this.categoryTrack?.nativeElement;

    if (track) {
      track.removeEventListener(
        'scroll',
        this.handleTrackScroll
      );
    }

    if (this.scrollUpdateFrame) {
      cancelAnimationFrame(
        this.scrollUpdateFrame
      );
    }
  }

  // =====================================================
  // WINDOW RESIZE
  // =====================================================

  @HostListener('window:resize')
  onWindowResize(): void {
    this.scheduleCarouselUpdate();
  }

  // =====================================================
  // CATEGORY NAME
  // =====================================================

  getCategoryName(category: Category): string {
    if (this.languageService.isArabic()) {

      return category.nameAr?.trim()
        ? category.nameAr
        : category.nameEn;
    }

    return category.nameEn?.trim()
      ? category.nameEn
      : category.nameAr;
  }

  // =====================================================
  // CATEGORY IMAGE
  // =====================================================

  getCategoryImage(category: Category): string {

    if (
      !category.imageUrl ||
      category.imageUrl.trim() === ''
    ) {
      return 'assets/images/category-placeholder.svg';
    }

    return this.api + category.imageUrl;
  }

  // =====================================================
  // CATEGORY SCROLL
  // =====================================================

  scrollCategories(
    direction: 'left' | 'right'
  ): void {

    const track =
      this.categoryTrack?.nativeElement;

    if (
      !track ||
      !this.hasCategoryOverflow()
    ) {
      return;
    }

    /*
     * Scroll approximately 80% of the
     * visible carousel width.
     */
    const scrollAmount = Math.max(
      track.clientWidth * 0.8,
      200
    );

    const maxScrollLeft =
      track.scrollWidth -
      track.clientWidth;

    const currentScrollLeft =
      track.scrollLeft;

    let targetScrollLeft: number;

    if (direction === 'left') {

      targetScrollLeft =
        currentScrollLeft -
        scrollAmount;

    } else {

      targetScrollLeft =
        currentScrollLeft +
        scrollAmount;
    }

    /*
     * Prevent scrolling beyond the
     * beginning or end.
     */
    targetScrollLeft = Math.max(
      0,
      Math.min(
        targetScrollLeft,
        maxScrollLeft
      )
    );

    track.scrollTo({
      left: targetScrollLeft,
      behavior: 'smooth'
    });

    this.scheduleCarouselUpdate();
  }

  // =====================================================
  // CATEGORY SELECT
  // =====================================================

  selectCategory(category: Category): void {

    if (!category?.id) {
      return;
    }

    this.router.navigate(
      ['/products'],
      {
        queryParams: {
          category: category.id
        }
      }
    );
  }

  // =====================================================
  // LOAD CATEGORIES
  // =====================================================

  private loadCategories(): void {

    this.isLoadingCategories.set(true);

    this.categoryService
      .getAllCategories()
      .subscribe({

        next: (response: any) => {

          const data =
            response?.data ??
            response ??
            [];

          const categories =
            (data ?? []).filter(
              (category: Category) =>
                !!category
            );

          this.categories.set(
            categories
          );

          this.isLoadingCategories.set(false);

          /*
           * Wait for Angular to render the
           * categories before checking overflow.
           */
          this.scheduleCarouselUpdate();
        },

        error: (error) => {
 this.categories.set([]);

          this.isLoadingCategories.set(false);

          this.scheduleCarouselUpdate();
        }
      });
  }

  // =====================================================
  // INITIALIZE CAROUSEL OBSERVER
  // =====================================================

  private initializeCarouselObserver(): void {

    const track =
      this.categoryTrack?.nativeElement;

    if (!track) {
      return;
    }

    /*
     * Detect changes to the actual carousel size.
     */
    this.resizeObserver =
      new ResizeObserver(() => {
        this.scheduleCarouselUpdate();
      });

    this.resizeObserver.observe(track);

    /*
     * Detect manual scrolling from:
     * - mouse
     * - touch
     * - trackpad
     */
    track.addEventListener(
      'scroll',
      this.handleTrackScroll,
      {
        passive: true
      }
    );
  }

  // =====================================================
  // TRACK SCROLL
  // =====================================================

  private readonly handleTrackScroll = (): void => {
    this.scheduleCarouselUpdate();
  };

  // =====================================================
  // UPDATE CAROUSEL STATE
  // =====================================================

  private updateCarousel(): void {

    const track =
      this.categoryTrack?.nativeElement;

    if (!track) {
      return;
    }

    /*
     * Check the actual rendered dimensions.
     *
     * scrollWidth = complete content width
     * clientWidth = visible width
     */
    const hasOverflow =
      track.scrollWidth >
      track.clientWidth + 1;

    this.hasCategoryOverflow.set(
      hasOverflow
    );

    /*
     * If the categories fit:
     *
     *     [ 1  2  3  4 ]
     *
     * center them.
     *
     * If they overflow:
     *
     *     [ 1  2  3  4  5  6 ... ]
     *
     * start from the beginning so the
     * carousel can scroll naturally.
     */
    track.style.justifyContent =
      hasOverflow
        ? 'flex-start'
        : 'center';

    /*
     * If there is no overflow,
     * there is nowhere to scroll.
     */
    if (!hasOverflow) {

      this.isAtStart.set(true);
      this.isAtEnd.set(true);

      if (track.scrollLeft !== 0) {
        track.scrollLeft = 0;
      }

      return;
    }

    const maxScrollLeft =
      track.scrollWidth -
      track.clientWidth;

    const currentScrollLeft =
      track.scrollLeft;

    const tolerance = 2;

    this.isAtStart.set(
      currentScrollLeft <= tolerance
    );

    this.isAtEnd.set(
      currentScrollLeft >=
      maxScrollLeft - tolerance
    );
  }

  // =====================================================
  // SCHEDULE CAROUSEL UPDATE
  // =====================================================

  private scheduleCarouselUpdate(): void {

    if (this.scrollUpdateFrame) {
      cancelAnimationFrame(
        this.scrollUpdateFrame
      );
    }

    this.scrollUpdateFrame =
      requestAnimationFrame(() => {

        this.scrollUpdateFrame =
          undefined;

        this.updateCarousel();
      });
  }
}