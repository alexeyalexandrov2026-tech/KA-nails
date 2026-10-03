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

export interface RuPhotoLocale {
  id: string;
  slug: string;
  alt: string;
  finish: string;
  colorFamily: string;
  notes: string;
  nailShape: string;
}

export const RU_PHOTO_LOCALES: Record<string, RuPhotoLocale> = {
  "work-01": {
    id: "work-01",
    slug: "bordeaux-luxury-editorial",
    alt: "Глубокий бордовый педикюр при свечах с белой гипсофилой и золотыми украшениями",
    finish: "Глянцевый гель-лак",
    colorFamily: "Глубокий винный / Бордо",
    notes: "Студийная съемка со свечами, шелком и живыми цветочными акцентами",
    nailShape: "Аккуратный естественный контур",
  },
  "work-02": {
    id: "work-02",
    slug: "royal-cobalt-gloss",
    alt: "Яркий педикюр цвета королевский синий кобальт на светло-серой льняной ткани",
    finish: "Зеркальный гель",
    colorFamily: "Королевский кобальт",
    notes:
      "Четкий контур формы мягкий квадрат с насыщенным кобальтовым пигментом",
    nailShape: "Аккуратный естественный контур",
  },
  "work-03": {
    id: "work-03",
    slug: "pastel-lilac-bliss",
    alt: "Нежный пастельно-сиреневый педикюр на белом фактурном спа-полотенце",
    finish: "Кремовый гель-лак",
    colorFamily: "Нежная сирень / Лаванда",
    notes:
      "Аккуратная форма мягкий квадрат, чистая линия кутикулы и нежное лавандовое покрытие",
    nailShape: "Аккуратный естественный контур",
  },
  "work-04": {
    id: "work-04",
    slug: "cornflower-sky-closeup",
    alt: "Макросъемка нежно-голубого педикюра формы мягкий квадрат на мягком белом полотенце",
    finish: "Глянцевый гель-лак",
    colorFamily: "Васильковый / Небесно-голубой",
    notes: "Студийная макросъемка с идеальным бликом и четкой геометрией формы",
    nailShape: "Аккуратный естественный контур",
  },
  "work-05": {
    id: "work-05",
    slug: "french-yin-yang",
    alt: "Классический френч-педикюр с четкой белой линией улыбки на полупрозрачной нюдовой базе",
    finish: "Классический френч",
    colorFamily: "Полупрозрачный розовый / Белый",
    notes: "Тончайшая микро-линия френча на естественной полупрозрачной основе",
    nailShape: "Аккуратный естественный контур",
  },
  "work-06": {
    id: "work-06",
    slug: "french-bow-heart-art",
    alt: "Френч-педикюр с деликатными миниатюрными бантами и сердечками ручной работы на больших пальцах",
    finish: "Авторская роспись",
    colorFamily: "Белый / Натуральный розовый",
    notes: "Тонкая ручная роспись с миниатюрными бантами и акцентными деталями",
    nailShape: "Аккуратный естественный контур",
  },
  "work-07": {
    id: "work-07",
    slug: "rose-quartz-shimmer",
    alt: "Сияющий педикюр оттенка розовый кварц с многомерным микрошиммером",
    finish: "Мерцающий шиммер",
    colorFamily: "Розовый кварц / Шиммер",
    notes:
      "Высокая плотность мерцающих микрочастиц с мягким призматическим блеском",
    nailShape: "Аккуратный естественный контур",
  },
  "work-08": {
    id: "work-08",
    slug: "scarlet-red-lacquer",
    alt: "Яркий классический алый педикюр с безупречным зеркальным блеском",
    finish: "Зеркальный глянец",
    colorFamily: "Классический алый",
    notes:
      "Нестареющий классический красный лак с ультраглянцевым финишным топом",
    nailShape: "Аккуратный естественный контур",
  },
  "work-09": {
    id: "work-09",
    slug: "alabaster-pure-white",
    alt: "Чистый белоснежный педикюр на фоне драпированной льняной ткани",
    finish: "Плотный глянец",
    colorFamily: "Белоснежный алебастр",
    notes:
      "Плотное покрытие кипенно-белым гель-лаком с выверенной геометрией формы",
    nailShape: "Аккуратный естественный контур",
  },
  "work-10": {
    id: "work-10",
    slug: "midnight-onyx-gloss",
    alt: "Глянцевый черный педикюр цвета полуночный оникс на нейтральном льняном полотне",
    finish: "Глубокий зеркальный глянец",
    colorFamily: "Глубокий черный оникс",
    notes: "Глубокий плотный черный пигмент с эффектом жидкого стекла",
    nailShape: "Аккуратный естественный контур",
  },
  "work-11": {
    id: "work-11",
    slug: "champagne-platinum-glitter",
    alt: "Педикюр с плотным платиново-золотым глиттером оттенка шампань и металлическим сиянием",
    finish: "Светоотражающий глиттер",
    colorFamily: "Платина и шампань",
    notes:
      "Плотный светоотражающий шиммер платинового оттенка с чистым контуром",
    nailShape: "Аккуратный естественный контур",
  },
  "work-12": {
    id: "work-12",
    slug: "porcelain-nude-spa",
    alt: "Фарфоровый нюдовый педикюр на кремовом пледе с бахромой",
    finish: "Полупрозрачный нюд",
    colorFamily: "Фарфоровый нюд / Молочный",
    notes:
      "Сдержанный молочно-розовый нюдовый гель со здоровым естественным сиянием",
    nailShape: "Аккуратный естественный контур",
  },
  "work-13": {
    id: "work-13",
    slug: "peach-melon-cream",
    alt: "Теплый пастельный персиково-дынный педикюр на чистом белом фоне",
    finish: "Кремовый гель-лак",
    colorFamily: "Нежный персик / Коралл",
    notes:
      "Свежий пастельный персиково-коралловый оттенок с гладким равномерным нанесением",
    nailShape: "Аккуратный естественный контур",
  },
  "work-14": {
    id: "work-14",
    slug: "indigo-denim-gloss",
    alt: "Глубокий синий педикюр цвета индиго деним на одноразовой салонной простыне",
    finish: "Глянцевый гель-лак",
    colorFamily: "Глубокий деним / Индиго",
    notes:
      "Глубокий пигмент оттенка сумеречного индиго с чистой обработкой кутикулы",
    nailShape: "Аккуратный естественный контур",
  },
  "work-15": {
    id: "work-15",
    slug: "rose-shimmer-french",
    alt: "Френч-педикюр с деликатной мерцающей розовой базой и четкими белыми микро-линиями улыбки",
    finish: "Френч с шиммером",
    colorFamily: "Мерцающий розовый / Белый",
    notes: "Сияющая полупрозрачная основа с ультратонким белым френчем",
    nailShape: "Аккуратный естественный контур",
  },
  "work-16": {
    id: "work-16",
    slug: "cornflower-blue-drape",
    alt: "Нежный васильково-голубой педикюр на полупрозрачной белой драпированной ткани",
    finish: "Кремовый гель-лак",
    colorFamily: "Васильковый / Небесный",
    notes: "Пастельный васильковый оттенок на фоне мягких складок ткани",
    nailShape: "Аккуратный естественный контур",
  },
  "work-17": {
    id: "work-17",
    slug: "french-toe-ring-accent",
    alt: "Классический френч-педикюр с серебряным кольцом на пальце в качестве акцента",
    finish: "Классический френч",
    colorFamily: "Нежный румянец / Белый",
    notes:
      "Элегантный традиционный френч в сочетании с минималистичным серебряным украшением",
    nailShape: "Аккуратный естественный контур",
  },
  "work-18": {
    id: "work-18",
    slug: "deep-bordeaux-studio-portrait",
    alt: "Крупный студийный план глубокого винно-бордового педикюра с зеркальным глянцем",
    finish: "Глубокий глянец",
    colorFamily: "Винный бордо",
    notes:
      "Студийный кадр высокого разрешения с глубоким благородным винным пигментом",
    nailShape: "Аккуратный естественный контур",
  },
  "work-19": {
    id: "work-19",
    slug: "restorative-aesthetic-transformation",
    alt: "Педикюр до и после: натуральные ногти до ухода и аккуратно оформленные ногти с алым покрытием после",
    finish: "Восстановительный уход",
    colorFamily: "Алый лак / Эстетический уход",
    notes:
      "До и после: бережный восстановительный педикюр и классическое алое покрытие",
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

  if (isRu) {
    if (!ruData) {
      throw new Error(
        `[Localization Integrity Error] Missing Russian metadata for photo id: ${p.id}`,
      );
    }
    if (ruData.slug !== p.slug) {
      throw new Error(
        `[Localization Integrity Error] Photo id: ${p.id} canonical slug "${p.slug}" does not match localized slug "${ruData.slug}"`,
      );
    }
  }

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
