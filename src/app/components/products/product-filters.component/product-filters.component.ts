
import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  OnChanges,
  SimpleChanges
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MaterialModule } from '../../../shared/AngularMaterial';
import { TranslatePipe } from '@ngx-translate/core';
import { CategoryFilter } from '../../../models/category.model';
import { LanguageService } from '../../../services/language.service';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-product-filters',
  standalone: true,
  imports: [
    MatSelectModule,
    CommonModule,
    FormsModule,
    MaterialModule,
    TranslatePipe
  ],
  templateUrl: './product-filters.component.html',
  styleUrls: ['./product-filters.component.scss']
})
export class ProductFiltersComponent implements OnInit, OnChanges {

  @Input() categories: CategoryFilter[] = [];

  @Input() selectedCategoryId: number | null = null;

  @Input() showOffers = false;

  @Output() filterApplied = new EventEmitter<{
    categoryId: number | null;
    offers: boolean;
  }>();

  @Output() clearFiltersEvent = new EventEmitter<void>();

  // UI value:
  // 'all' = All Categories
  // number = actual category ID
  tempCategoryId: number | 'all' = 'all';

  tempOffers = false;

  constructor(
    public languageService: LanguageService
  ) {}

  ngOnInit(): void {
    this.syncInputs();
  }

  ngOnChanges(changes: SimpleChanges): void {

    if (
      changes['selectedCategoryId'] ||
      changes['showOffers']
    ) {
      this.syncInputs();
    }
  }

  syncInputs(): void {

    this.tempCategoryId =
      this.selectedCategoryId === null
        ? 'all'
        : this.selectedCategoryId;

    this.tempOffers = this.showOffers;
  }

  applyFilters(): void {

    this.filterApplied.emit({
      categoryId:
        this.tempCategoryId === 'all'
          ? null
          : this.tempCategoryId,

      offers: this.tempOffers
    });
  }

  clearFilters(): void {

    this.tempCategoryId = 'all';

    this.tempOffers = false;

    this.clearFiltersEvent.emit();
  }

  getCategoryName(category: CategoryFilter): string {

    if (this.languageService.isArabic()) {

      return (
        category.nameAr?.trim() ||
        category.nameEn?.trim() ||
        ''
      );

    }

    return (
      category.nameEn?.trim() ||
      category.nameAr?.trim() ||
      ''
    );
  }
}