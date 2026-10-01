"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { GALLERY_ITEMS, type GalleryItem } from "../lib/gallery-data";
import { GalleryViewer } from "./gallery-viewer";

export function HomeMovingWall() {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // Curate 10 distinct showcase items for the homepage moving wall
  const showcaseItems = GALLERY_ITEMS.slice(0, 10);
  // Double array for seamless infinite marquee loop
  const marqueeItems = [...showcaseItems, ...showcaseItems];

  const handleCardClick = (item: GalleryItem) => {
    const globalIdx = GALLERY_ITEMS.findIndex((i) => i.id === item.id);
    setViewerIndex(globalIdx >= 0 ? globalIdx : 0);
  };

  return (
    <section
      className="moving-wall-section"
      aria-label="Curated Studio Work Preview"
    >
      <div className="moving-wall-header">
        <div>
          <p className="eyebrow">02 / The Studio Exhibition</p>
          <h2 className="section-title">Selected Works</h2>
        </div>
        <div className="moving-wall-header-action">
          <Link href="/gallery/" className="button-secondary">
            View full gallery (36) <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      <div
        className="moving-wall-track-container"
        tabIndex={0}
        aria-label="Scrollable gallery preview. Hover to pause."
      >
        <div className="moving-wall-track">
          {marqueeItems.map((item, idx) => (
            <div
              key={`${item.id}-${idx}`}
              className="moving-wall-card"
              role="button"
              tabIndex={0}
              aria-label={`Open ${item.title}, ${item.category} nail art`}
              onClick={() => handleCardClick(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleCardClick(item);
                }
              }}
            >
              <div className="moving-card-media">
                <Image
                  src={item.src}
                  alt={item.alt}
                  width={item.width}
                  height={item.height}
                  unoptimized
                  className="moving-card-image"
                />
                <div className="moving-card-overlay">
                  <span className="moving-card-expand">Expand ↗</span>
                </div>
              </div>
              <div className="moving-card-caption">
                <span className="moving-card-cat">{item.category}</span>
                <span className="moving-card-title">{item.title}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="moving-wall-footer-note">
        <p>
          Swipe or hover to pause · Click any artwork for high-resolution
          details ·{" "}
          <Link href="/gallery/">Explore all 36 archived designs</Link>
        </p>
      </div>

      {/* Lightbox Viewer */}
      <GalleryViewer
        items={GALLERY_ITEMS}
        currentIndex={viewerIndex}
        onClose={() => setViewerIndex(null)}
        onNavigate={(newIdx) => setViewerIndex(newIdx)}
      />
    </section>
  );
}
