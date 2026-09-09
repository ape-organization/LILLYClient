import { SubCategory, SubCategoryFilter } from "./subCategory.model";

export interface Category {
  id: number;
  nameEn: string;
  nameAr: string;
  imageUrl?: string;
    subCategories?: SubCategory[];

}
export interface CategoryFilter {
  id: number;
  nameEn: string;
  nameAr: string;
}