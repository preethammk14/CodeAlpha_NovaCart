import type { Product } from '../types';
import { ACCESSORIES_PRODUCTS } from './departments/accessories.ts';
import { BEAUTY_PRODUCTS } from './departments/beauty.ts';
import { ELECTRONICS_PRODUCTS } from './departments/electronics.ts';
import { FASHION_PRODUCTS } from './departments/fashion.ts';
import { HOME_PRODUCTS } from './departments/home.ts';
import { SPORTS_PRODUCTS } from './departments/sports.ts';

export const HERO_BANNER_IMAGE = '/src/assets/images/hero_novacart_showcase_1795615888270.jpg';

export const SEED_PRODUCTS: Product[] = [
  ...ELECTRONICS_PRODUCTS,
  ...FASHION_PRODUCTS,
  ...HOME_PRODUCTS,
  ...BEAUTY_PRODUCTS,
  ...ACCESSORIES_PRODUCTS,
  ...SPORTS_PRODUCTS,
];
