import blazerImg from '../assets/images/garment_tailored_blazer_1794696356235.jpg';
import overshirtImg from '../assets/images/garment_linen_overshirt_1794696357327.jpg';
import poloImg from '../assets/images/garment_merino_polo_1794696357208.jpg';
import trousersImg from '../assets/images/garment_pleated_trousers_1794696357447.jpg';
import bomberImg from '../assets/images/garment_leather_bomber_1794696357876.jpg';
import boutiqueImg from '../assets/images/boutique_kairouan_atelier_1794696358129.jpg';

export const MEDIA_ASSETS: Record<string, string> = {
  garment_tailored_blazer: blazerImg,
  garment_linen_overshirt: overshirtImg,
  garment_merino_polo: poloImg,
  garment_pleated_trousers: trousersImg,
  garment_leather_bomber: bomberImg,
  boutique_kairouan_atelier: boutiqueImg,
};

export function resolveProductImage(imageKey: string): string {
  return MEDIA_ASSETS[imageKey] || blazerImg;
}
