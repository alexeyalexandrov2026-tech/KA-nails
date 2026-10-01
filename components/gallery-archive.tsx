"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  type GalleryCategory,
  GALLERY_ITEMS,
  GALLERY_CATEGORIES,
  GALLERY_METRICS,
} from "../lib/gallery-data";
import { GalleryViewer } from "./gallery-viewer";

export function GalleryArchive() {
  const [selectedCategory, setSelectedCategory] =
    useState<GalleryCategory>("All");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const filteredItems = useMemo(() => {
    if (selectedCategory === "All") {
      return GALLERY_ITEMS;
    }
    return GALLERY_ITEMS.filter((item) => item.category === selectedCategory);
  }, [selectedCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: GALLERY_ITEMS.length,
    };
    for (const cat of GALLERY_CATEGORIES) {
      if (cat !== "All") {
        counts[cat] = GALLERY_ITEMS.filter((i) => i.category === cat).length;
      }
    }
    return counts;
  }, []);

  const openLightbox = (indexInFiltered: number) => {
    setViewerIndex(indexInFiltered);
  };

  return (
    <section
      className="gallery-section"
      aria-label="Nail Art Gallery Portfolio"
    >
      {/* Category Filter Controls */}
      <div
        className="gallery-filter-bar"
        role="toolbar"
        aria-label="Filter gallery by technique"
      >
        {GALLERY_CATEGORIES.map((category) => {
          const isSelected = selectedCategory === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`filter-pill ${isSelected ? "active" : ""}`}
              aria-pressed={isSelected}
            >
              <span>{category}</span>
              <span className="pill-count">
                {categoryCounts[category] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Honest Inventory & Status Banner */}
      <div className="gallery-inventory-banner" role="status">
        <span className="inventory-badge">Authentic Studio Archive</span>
        <span className="inventory-text">
          {GALLERY_METRICS.uniquePhotos} authentic salon works displayed •{" "}
          {GALLERY_METRICS.additionalPhotosNeededForMinimum} additional works
          pending client curation (Target: {GALLERY_METRICS.minimumTarget})
        </span>
      </div>

      {/* Results Announcement */}
      <p className="gallery-status-text" aria-live="polite">
        Showing {filteredItems.length}{" "}
        {selectedCategory === "All"
          ? "curated styles"
          : `${selectedCategory} designs`}
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
              aria-label={`View ${item.title}, ${item.category} pedicure. Press Enter or click to open full-screen.`}
              onClick={() => openLightbox(index)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openLightbox(index);
                }
              }}
            >
              <div className="gallery-card-media">
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
                    Expand ↗
                  </span>
                </div>
              </div>

              <div className="gallery-card-info">
                <div className="card-header-row">
                  <span className="card-category">{item.category}</span>
                  <span className="card-shape">{item.colorFamily}</span>
                </div>
                <h3 className="card-title">{item.title}</h3>
                <p className="card-technique">{item.notes}</p>
                <div className="card-footer-row">
                  <span className="card-finish">{item.finish}</span>
                  <span className="card-view-link">View detail →</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Bottom Conversion Band */}
      <div className="gallery-cta-band">
        <div className="gallery-cta-content">
          <p className="eyebrow">Studio Appointments</p>
          <h2>Bring your inspiration to life.</h2>
          <p className="lead">
            Every set in our gallery is customized to your natural nail health,
            skin tone, and personal aesthetic.
          </p>
          <div className="cta-actions">
            <Link href="/book/" className="button">
              Book your appointment <span aria-hidden="true">↗</span>
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
      />
    </section>
  );
}
