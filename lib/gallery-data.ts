import {
  SALON_PHOTOS,
  PHOTO_INVENTORY_METRICS,
  type SalonPhoto,
} from "./photo-inventory";
import type { Locale } from "./locales/types";

export type GalleryCategory =
  "All" | "Classic" | "Color" | "French" | "Glitter / Detail" | "Restorative";

export interface GalleryItem {
  id: string;
  slug: string;
  title: string;
  category: "Classic" | "Color" | "French" | "Glitter / Detail" | "Restorative";
  categoryLabel: string;
  subCategory: string;
  src: string;
  srcMed: string;
  srcThumb: string;
  srcJpg: string;
  alt: string;
  aspect: "portrait" | "landscape" | "square";
  width: number;
  height: number;
  finish: string;
  colorFamily: string;
  notes: string;
  featured: boolean;
  heroEligible: boolean;
  heroRole: string;
  isTransformation: boolean;
  nailShape: string;
  technique: string;
}

export const GALLERY_CATEGORIES: GalleryCategory[] = [
  "All",
  "Classic",
  "Color",
  "French",
  "Glitter / Detail",
  "Restorative",
];

const RU_PHOTO_LOCALES: Record<
  string,
  {
    alt: string;
    finish: string;
    colorFamily: string;
    notes: string;
    nailShape: string;
  }
> = {
  "work-01": {
    alt: "Глубокий бордовый педикюр при свечах с белой гипсофилой и золотыми украшениями",
    finish: "Глянцевый гель-лак",
    colorFamily: "Глубокий винный / Бордо",
    notes: "Студийная съемка со свечами, шелком и живыми цветочными акцентами",
    nailShape: "Аккуратный естественный контур",
  },
  "work-02": {
    alt: "Глянцевый педикюр цвета королевский синий на фактурной белой ткани с кольцом",
    finish: "Глянцевое покрытие",
    colorFamily: "Королевский кобальтовый синий",
    notes: "Насыщенный глубокий синий с зеркальным глянцем",
    nailShape: "Аккуратный естественный контур",
  },
  "work-03": {
    alt: "Классический френч-педикюр с микро-линией улыбки на полупрозрачной нюдовой базе",
    finish: "Глянцевый топ с ультратонким френчем",
    colorFamily: "Нюд / Прозрачно-розовый",
    notes: "Изящная микро-линия френча на естественной розовой базе",
    nailShape: "Аккуратный естественный контур",
  },
  "work-04": {
    alt: "Нежный сиреневый педикюр на белом льне с золотыми и жемчужными украшениями",
    finish: "Кремовый лак",
    colorFamily: "Нежная сирень / Лаванда",
    notes: "Нежный пастельный оттенок с гладким равномерным покрытием",
    nailShape: "Аккуратный естественный контур",
  },
  "work-05": {
    alt: "Темно-синий педикюр с демонстрацией оттенка на нейтральном фоне",
    finish: "Глубокий глянец",
    colorFamily: "Глубокий индиго / Темная морская волна",
    notes: "Богатый темный пигмент при естественном дневном освещении",
    nailShape: "Аккуратный естественный контур",
  },
  "work-06": {
    alt: "Педикюр цвета глубокий изумруд с глянцевым финишем на фоне драпировки",
    finish: "Глянцевый гель-лак",
    colorFamily: "Глубокий изумрудный",
    notes: "Насыщенный благородный зеленый с зеркальным отражением",
    nailShape: "Аккуратный естественный контур",
  },
  "work-07": {
    alt: "Яркий алый педикюр с безупречно чистой линией кутикулы",
    finish: "Глянцевый гель-лак",
    colorFamily: "Классический алый",
    notes: "Яркий красный цвет с безупречным контуром и глянцевым топом",
    nailShape: "Аккуратный естественный контур",
  },
  "work-08": {
    alt: "Чистый фарфоровый нюдовый педикюр на фактурной нейтральной ткани",
    finish: "Мягкий нюдовый глянец",
    colorFamily: "Фарфоровый нюд",
    notes: "Сдержанная роскошь с идеальным подбором под оттенок кожи",
    nailShape: "Аккуратный естественный контур",
  },
  "work-09": {
    alt: "Жемчужный педикюр с тонким бантом и жемчужными акцентами",
    finish: "Жемчужная втирка и бант",
    colorFamily: "Перламутровый жемчуг / Белый",
    notes: "Изящный бант ручной работы с перламутровым переливом",
    nailShape: "Аккуратный естественный контур",
  },
  "work-10": {
    alt: "Насыщенный вишневый педикюр на драпированной ткани с серебряным кольцом",
    finish: "Зеркальный глянцевый гель",
    colorFamily: "Спелая вишня / Ягодный",
    notes: "Глубокий ягодный оттенок с безупречным бликом",
    nailShape: "Аккуратный естественный контур",
  },
  "work-11": {
    alt: "Яркий аметистовый педикюр на чистом минималистичном фоне",
    finish: "Кремовый глянец",
    colorFamily: "Аметистовый / Фиолетовый",
    notes: "Насыщенный фиолетовый цвет с гладким стеклянным финишем",
    nailShape: "Аккуратный естественный контур",
  },
  "work-12": {
    alt: "Теплый оттенок мокко на структурированной белой студийной поверхности",
    finish: "Кремовый лак",
    colorFamily: "Мокко / Теплый тауп",
    notes: "Благородный нейтральный оттенок с глубиной кофе со сливками",
    nailShape: "Аккуратный естественный контур",
  },
  "work-13": {
    alt: "Нежный полупрозрачный розовый педикюр со здоровым сиянием",
    finish: "Полупрозрачный глянец",
    colorFamily: "Нежно-розовый",
    notes:
      "Чистый эстетический уход, подчеркивающий естественную красоту ногтей",
    nailShape: "Аккуратный естественный контур",
  },
  "work-14": {
    alt: "Глянцевый черный педикюр с золотым кольцом на студийной поверхности",
    finish: "Глубокий черный глянец",
    colorFamily: "Глубокий черный",
    notes: "Контрастный черный цвет с безупречным натяжением блика",
    nailShape: "Аккуратный естественный контур",
  },
  "work-15": {
    alt: "Нежный пастельно-желтый педикюр при ярком дневном свете",
    finish: "Пастельный крем",
    colorFamily: "Нежный сливочно-желтый",
    notes: "Теплый пастельный оттенок с равномерной плотностью покрытия",
    nailShape: "Аккуратный естественный контур",
  },
  "work-16": {
    alt: "Педикюр цвета шампань с деликатным микрошиммером на шелке",
    finish: "Тонкий жемчужный шиммер",
    colorFamily: "Шампань / Перламутр",
    notes: "Сияющее покрытие с микрочастицами, мягко отражающими свет",
    nailShape: "Аккуратный естественный контур",
  },
  "work-17": {
    alt: "Приглушенный шалфейно-зеленый педикюр в современной эстетике",
    finish: "Бархатистый крем",
    colorFamily: "Приглушенный шалфей",
    notes:
      "Спокойный растительный оттенок, вдохновленный натуральными текстурами",
    nailShape: "Аккуратный естественный контур",
  },
  "work-18": {
    alt: "Насыщенный терракотовый педикюр на теплой нейтральной поверхности",
    finish: "Глянцевый гель-лак",
    colorFamily: "Теплая терракота / Сиена",
    notes: "Теплый терракотовый оттенок с мягким сиянием и глянцем",
    nailShape: "Аккуратный естественный контур",
  },
  "work-19": {
    alt: "Прохладный лавандовый педикюр с чистыми контурами на льне",
    finish: "Кремовый лак",
    colorFamily: "Прохладная лаванда / Фиалковый",
    notes: "Спокойный фиалковый оттенок для элегантного образа",
    nailShape: "Аккуратный естественный контур",
  },
};

const RU_CATEGORY_LABELS: Record<GalleryCategory, string> = {
  All: "Все",
  Classic: "Классика",
  Color: "Цвет",
  French: "Френч",
  "Glitter / Detail": "Шиммер и детали",
  Restorative: "Эстетический уход",
};

function aspectFromRatio(ratio: string): "portrait" | "landscape" | "square" {
  if (ratio === "1:1") return "square";
  if (ratio === "3:4" || ratio === "4:5") return "portrait";
  return "landscape";
}

function buildGalleryItem(p: SalonPhoto, locale: Locale = "en"): GalleryItem {
  const isRu = locale === "ru";
  const ruData = RU_PHOTO_LOCALES[p.id];

  const alt = isRu && ruData ? ruData.alt : p.alt;
  const finish = isRu && ruData ? ruData.finish : p.finish;
  const colorFamily = isRu && ruData ? ruData.colorFamily : p.colorFamily;
  const notes = isRu && ruData ? ruData.notes : p.notes;
  const nailShape =
    isRu && ruData ? ruData.nailShape : "Precision Square / Natural Contour";
  const categoryLabel = isRu ? RU_CATEGORY_LABELS[p.category] : p.category;

  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    category: p.category,
    categoryLabel,
    subCategory: p.subCategory,
    src: p.src,
    srcMed: p.srcMed,
    srcThumb: p.srcThumb,
    srcJpg: p.srcJpg,
    alt,
    aspect: aspectFromRatio(p.aspectRatio),
    width: p.width,
    height: p.height,
    finish,
    colorFamily,
    notes,
    featured: p.featured,
    heroEligible: p.heroEligible,
    heroRole: p.heroRole,
    isTransformation: p.isTransformation,
    nailShape,
    technique: finish,
  };
}

export function getGalleryItems(locale: Locale = "en"): GalleryItem[] {
  return SALON_PHOTOS.map((p) => buildGalleryItem(p, locale));
}

export function getGalleryCategories(locale: Locale = "en"): {
  key: GalleryCategory;
  label: string;
}[] {
  return GALLERY_CATEGORIES.map((cat) => ({
    key: cat,
    label: locale === "ru" ? RU_CATEGORY_LABELS[cat] : cat,
  }));
}

// Backward-compatible default English exports
export const GALLERY_ITEMS: GalleryItem[] = getGalleryItems("en");
export const HERO_ITEMS = GALLERY_ITEMS.filter((item) => item.heroEligible);
export const WALL_ITEMS = GALLERY_ITEMS;
export const GALLERY_METRICS = PHOTO_INVENTORY_METRICS;

export function getHeroGalleryTiles(locale: Locale = "en"): GalleryItem[] {
  const items = getGalleryItems(locale).filter((item) => item.heroEligible);
  return items.slice(0, 4);
}
