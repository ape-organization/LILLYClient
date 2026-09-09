import { Category } from './category.model';
import { HeelSize } from './heel-size.model';
import { Size } from './size,model';


export interface Product {
  id: number;

  nameEn: string;
  descriptionEn?: string | null;

  nameAr: string;
  descriptionAr?: string | null;

  price: number;
  actualPrice: number;

  isInStock: boolean;
  discountPercentage?: number | null;

  // Used when the product has no variants
  stockQuantity: number;

  categoryId: number;
  category?: Category | null;

  images: ProductImage[];

  variants: ProductVariant[];
}

export interface ProductImage {
  id: number;
  imageUrl?: string | null;
  sortOrder: number;
}

export interface ProductVariant {
  id?: any;

  sizeId?: number | null;
  size?: Size | null;

  heelSizeId?: number | null;
  heelSize?: HeelSize | null;

  stockQuantity: number;
  isActive?: boolean;

heelSizeName?: string,
sizeName?: string,

}