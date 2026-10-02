"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  type GalleryCategory,
  GALLERY_CATEGORIES,
  GALLERY_METRICS,
  getGalleryItems,
  getGalleryCategories,
} from "../lib/gallery-data";
import { GalleryViewer } from "./gallery-viewer";
import { getDictionary, getLocalizedPath, type Locale } from "../lib/locales";

interface GalleryArchiveProps {
  locale?: Locale;
}

export function GalleryArchive({ locale = "en" }: GalleryArchiveProps) {
  const dict = getDictionary(locale).galleryPage;
  const [selectedCategory, setSelectedCategory] =
    useState<GalleryCategory>("All");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const items = useMemo(() => getGalleryItems(locale), [locale]);
  const categories = useMemo(() => getGalleryCategories(locale), [locale]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === "All") {
      return items;
    }
    return items.filter((item) => item.category === selectedCategory);
  }, [selectedCategory, items]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: items.length,
    };
    for (const cat of GALLERY_CATEGORIES) {
      if (cat !== "All") {
        counts[cat] = items.filter((i) => i.category === cat).length;
      }
    }
    return counts;
  }, [items]);

  const openLightbox = (indexInFiltered: number) => {
    setViewerIndex(indexInFiltered);
  };

  const bookHref = getLocalizedPath("/book/", locale);

  return (
    <section className="gallery-section" aria-label={dict.title}>
      {/* Category Filter Controls */}
      <div
        className="gallery-filter-bar"
        role="toolbar"
        aria-label={dict.filterAriaLabel}
      >
        {categories.map((category) => {
          const isSelected = selectedCategory === category.key;
          return (
            <button
              key={category.key}
              type="button"
              onClick={() => setSelectedCategory(category.key)}
              className={`filter-pill ${isSelected ? "active" : ""}`}
              aria-pressed={isSelected}
            >
              <span>{category.label}</span>
              <span className="pill-count">
                {categoryCounts[category.key] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Honest Inventory & Status Banner */}
      <div className="gallery-inventory-banner" role="status">
        <span className="inventory-badge">{dict.inventoryBadge}</span>
        <span className="inventory-text">
          {dict.inventoryText(
            GALLERY_METRICS.uniquePhotos,
            GALLERY_METRICS.additionalPhotosNeededForMinimum,
            GALLERY_METRICS.minimumTarget,
          )}
        </span>
      </div>

      {/* Results Announcement */}
      <p className="gallery-status-text" aria-live="polite">
        {dict.statusText(
          filteredItems.length,
          selectedCategory === "All"
            ? "All"
            : (categories.find((c) => c.key === selectedCategory)?.label ??
                selectedCategory),
        )}
      </p>

      {/* Asymmetric Gallery Grid */}
      <div className="gallery-grid">
        {filteredItems.map((item, index) => {
          const isLandscape = item.aspect === "landscape";
          const isSquare = item.aspect === "square";
          const gridSpanClass = isLandscape
            ? "grid-span-wide"
            : isSquare
              ? "grid-span-square"
              : "grid-span-tall";

          return (
            <article
              key={item.id}
              id={item.id}
              className={`gallery-card ${gridSpanClass}`}
              tabIndex={0}
              role="button"
              aria-label={dict.cardAriaLabel(
                item.title,
                item.categoryLabel || item.category,
              )}
              onClick={() => openLightbox(index)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openLightbox(index);
                }
              }}
            >
              <div className="gallery-card-media gallery-media-wrapper">
                <Image
                  src={item.srcMed || item.src}
                  alt={item.alt}
                  width={item.width}
                  height={item.height}
                  unoptimized
                  loading={index < 8 ? "eager" : "lazy"}
                  className="gallery-card-image"
                />
                <div className="gallery-card-overlay">
                  <span className="card-zoom-badge" aria-hidden="true">
                    {dict.expandLabel}
                  </span>
                </div>
              </div>

              <div className="gallery-card-info">
                <div className="card-header-row">
                  <span className="card-category">
                    {item.categoryLabel || item.category}
                  </span>
                  <span className="card-shape">{item.colorFamily}</span>
                </div>
                <h3 className="card-title">
                  {locale === "ru" ? (
                    <span lang="en">{item.title}</span>
                  ) : (
                    item.title
                  )}
                </h3>
                <p className="card-technique">{item.notes}</p>
                <div className="card-footer-row">
                  <span className="card-finish">{item.finish}</span>
                  <span className="card-view-link">{dict.viewDetailLabel}</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Bottom Conversion Band */}
      <div className="gallery-cta-band">
        <div className="gallery-cta-content">
          <p className="eyebrow">{dict.ctaEyebrow}</p>
          <h2>{dict.ctaTitle}</h2>
          <p className="lead">{dict.ctaLead}</p>
          <div className="cta-actions">
            <Link href={bookHref} className="button">
              {dict.ctaBookBtn} <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Lightbox Viewer */}
      <GalleryViewer
        items={filteredItems}
        currentIndex={viewerIndex}
        onClose={() => setViewerIndex(null)}
        onNavigate={(newIdx) => setViewerIndex(newIdx)}
        locale={locale}
      />
    </section>
  );
}
