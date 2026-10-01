"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  WALL_ITEMS,
  GALLERY_ITEMS,
  type GalleryItem,
} from "../lib/gallery-data";
import { GalleryViewer } from "./gallery-viewer";

export function HomeMovingWall() {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const trackContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Update scroll button states
  const updateScrollState = () => {
    const el = trackContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    const el = trackContainerRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, []);

  const handleCardClick = (item: GalleryItem) => {
    // If user was dragging significantly, ignore click
    if (isDragging) return;
    const globalIdx = GALLERY_ITEMS.findIndex((i) => i.id === item.id);
    setViewerIndex(globalIdx >= 0 ? globalIdx : 0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const el = trackContainerRef.current;
    if (!el) return;
    setIsDragging(false);
    setStartX(e.pageX - el.offsetLeft);
    setScrollLeft(el.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const el = trackContainerRef.current;
    if (!el || e.buttons !== 1) return;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startX) * 1.5;
    if (Math.abs(walk) > 5) {
      setIsDragging(true);
      el.scrollLeft = scrollLeft - walk;
    }
  };

  const handleMouseUp = () => {
    setTimeout(() => setIsDragging(false), 50);
  };

  const scrollByAmount = (offset: number) => {
    const el = trackContainerRef.current;
    if (!el) return;
    el.scrollBy({ left: offset, behavior: "smooth" });
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
        <div className="moving-wall-controls">
          <div
            className="moving-wall-nav-btns"
            aria-label="Showcase carousel navigation"
          >
            <button
              type="button"
              className="showcase-nav-btn"
              onClick={() => scrollByAmount(-340)}
              disabled={!canScrollLeft}
              aria-label="Scroll gallery left"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <button
              type="button"
              className="showcase-nav-btn"
              onClick={() => scrollByAmount(340)}
              disabled={!canScrollRight}
              aria-label="Scroll gallery right"
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>
          <Link href="/gallery/" className="button-secondary">
            View full gallery (19) <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      <div
        className="moving-wall-track-container"
        ref={trackContainerRef}
        tabIndex={0}
        aria-label="Scrollable gallery showcase. Drag or swipe to explore."
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div className="moving-wall-track">
          {WALL_ITEMS.map((item) => (
            <div
              key={item.id}
              className="moving-wall-card"
              role="button"
              tabIndex={0}
              aria-label={`Open ${item.title}, ${item.category} pedicure. Press Enter to view high resolution.`}
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
                  src={item.srcMed || item.src}
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
                <span className="moving-card-cat">
                  {item.category} · {item.subCategory}
                </span>
                <span className="moving-card-title">{item.title}</span>
                <span className="moving-card-finish">{item.finish}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="moving-wall-footer-note">
        <p>
          19 authentic salon works displayed · 11 additional works pending
          client curation (Target: 30) ·{" "}
          <Link href="/gallery/">Explore full gallery</Link>
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
