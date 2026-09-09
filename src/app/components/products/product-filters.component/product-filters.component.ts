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


@Component({
  selector: 'app-product-filters',

  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    TranslatePipe
  ],

  templateUrl: './product-filters.component.html',

  styleUrls: [
    './product-filters.component.scss'
  ]
})
export class ProductFiltersComponent
  implements OnInit, OnChanges {


  // ========================================================
  // INPUTS
  // ========================================================

  @Input()
  categories: CategoryFilter[] = [];


  @Input()
  selectedCategoryId: number | null = null;

 

  @Input()
  showOffers = false;


  // ========================================================
  // OUTPUTS
  // ========================================================

  @Output()
  filterApplied =
    new EventEmitter<any>();

  @Output()
  clearFiltersEvent =
    new EventEmitter<void>();


  // ========================================================
  // TEMPORARY VALUES
  // ========================================================

  tempCategoryId: number | null = null;



  tempOffers = false;


  // ========================================================
  // CONSTRUCTOR
  // ========================================================

  constructor(
    public languageService: LanguageService
  ) {}
//=====================================
onCategoryChange()
{}

  // ========================================================
  // INIT
  // ========================================================

  ngOnInit(): void {

    this.syncInputs();

  }


  // ========================================================
  // INPUT CHANGES
  // ========================================================

  ngOnChanges(
    changes: SimpleChanges
  ): void {

    if (
      changes['selectedCategoryId'] ||

      changes['showOffers']
    ) {

      this.syncInputs();

    }

  }


  // ========================================================
  // SYNC INPUTS
  // ========================================================

  syncInputs(): void {

    this.tempCategoryId =
      this.selectedCategoryId;

   

    this.tempOffers =
      this.showOffers;

  }


 


  // ========================================================
  // APPLY FILTERS
  // ========================================================

  applyFilters(): void {

    this.filterApplied.emit({

      categoryId:
        this.tempCategoryId,

    

    

      offers:
        this.tempOffers

    });

  }


  // ========================================================
  // CLEAR FILTERS
  // ========================================================

  clearFilters(): void {

    this.tempCategoryId = null;

  

    this.tempOffers = false;

    this.clearFiltersEvent.emit();

  }




  // ========================================================
  // CATEGORY NAME
  // ========================================================

  getCategoryName(
    category: CategoryFilter
  ): string {

    if (
      this.languageService.isArabic()
    ) {

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