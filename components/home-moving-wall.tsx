"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { GALLERY_ITEMS, type GalleryItem } from "../lib/gallery-data";
import { GalleryViewer } from "./gallery-viewer";

// Partition the 19 authentic salon works into 3 distinct spatial depth layers:
// LAYER 2: Foreground heroes (closer to camera, larger, faster parallax)
const FG_ITEMS: GalleryItem[] = [
  GALLERY_ITEMS[0]!, // Bordeaux Wine
  GALLERY_ITEMS[5]!, // Emerald Velvet
  GALLERY_ITEMS[9]!, // Cherry Glaze
  GALLERY_ITEMS[13]!, // Onyx Gloss
  GALLERY_ITEMS[8]!, // Frosted Chrome
];

// LAYER 1: Primary eye-level exhibition rail (center line, steady cadence)
const PRIMARY_ITEMS: GalleryItem[] = [
  GALLERY_ITEMS[1]!, // Royal Cobalt
  GALLERY_ITEMS[3]!, // Pastel Lilac
  GALLERY_ITEMS[6]!, // Crimson Luxe
  GALLERY_ITEMS[11]!, // Mocha Silk
  GALLERY_ITEMS[14]!, // Buttercup Soft
  GALLERY_ITEMS[16]!, // Sage Linen
  GALLERY_ITEMS[17]!, // Terracotta Warm
  GALLERY_ITEMS[15]!, // Pearl Shimmer
];

// LAYER 3: Background atmospheric depth (deeper in scene, smaller, slower)
const BG_ITEMS: GalleryItem[] = [
  GALLERY_ITEMS[2]!, // French Pink
  GALLERY_ITEMS[4]!, // Midnight Eclipse
  GALLERY_ITEMS[7]!, // Nude Petal
  GALLERY_ITEMS[10]!, // Amethyst Dream
  GALLERY_ITEMS[12]!, // Rose Quartz
  GALLERY_ITEMS[18]!, // Lavender Mist
];

export function HomeMovingWall() {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);

  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const bgTrackRef = useRef<HTMLDivElement>(null);
  const primaryTrackRef = useRef<HTMLDivElement>(null);
  const fgTrackRef = useRef<HTMLDivElement>(null);

  // Independent position accumulators for each 3D depth layer
  const bgXRef = useRef(0);
  const primaryXRef = useRef(0);
  const fgXRef = useRef(0);

  // Velocity and physics refs
  const baseVelocityRef = useRef(0.65);
  const velocityRef = useRef(0.65);

  // Pointer tracking & spring lerp
  const targetMouseXRef = useRef(0);
  const targetMouseYRef = useRef(0);
  const mouseLerpXRef = useRef(0);
  const mouseLerpYRef = useRef(0);

  // Drag interaction
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragDistanceRef = useRef(0);
  const dragVelocityRef = useRef(0);

  // State flags
  const isVisibleRef = useRef(false);
  const isHoveredRef = useRef(false);
  const isMobileRef = useRef(false);
  const isReducedMotionRef = useRef(false);

  // Measured loop widths for seamless infinite wrapping
  const bgLoopWidthRef = useRef(2000);
  const primaryLoopWidthRef = useRef(2600);
  const fgLoopWidthRef = useRef(2200);

  // Double duplicate sets ensure complete infinite continuity with minimal DOM/GPU footprint
  const infiniteBg = [...BG_ITEMS, ...BG_ITEMS];
  const infinitePrimary = [...PRIMARY_ITEMS, ...PRIMARY_ITEMS];
  const infiniteFg = [...FG_ITEMS, ...FG_ITEMS, ...FG_ITEMS];

  // Measure loop widths accurately
  const measureLoopWidths = useCallback(() => {
    if (bgTrackRef.current) {
      const cards =
        bgTrackRef.current.querySelectorAll<HTMLElement>(".moving-wall-card");
      if (cards.length >= BG_ITEMS.length * 2) {
        const c0 = cards[0];
        const cN = cards[BG_ITEMS.length];
        if (c0 && cN) {
          const dist = cN.offsetLeft - c0.offsetLeft;
          if (dist > 0) bgLoopWidthRef.current = dist;
        }
      }
    }
    if (primaryTrackRef.current) {
      const cards =
        primaryTrackRef.current.querySelectorAll<HTMLElement>(
          ".moving-wall-card",
        );
      if (cards.length >= PRIMARY_ITEMS.length * 2) {
        const c0 = cards[0];
        const cN = cards[PRIMARY_ITEMS.length];
        if (c0 && cN) {
          const dist = cN.offsetLeft - c0.offsetLeft;
          if (dist > 0) primaryLoopWidthRef.current = dist;
        }
      }
    }
    if (fgTrackRef.current) {
      const cards =
        fgTrackRef.current.querySelectorAll<HTMLElement>(".moving-wall-card");
      if (cards.length >= FG_ITEMS.length * 2) {
        const c0 = cards[0];
        const cN = cards[FG_ITEMS.length];
        if (c0 && cN) {
          const dist = cN.offsetLeft - c0.offsetLeft;
          if (dist > 0) fgLoopWidthRef.current = dist;
        }
      }
    }
  }, []);

  useEffect(() => {
    // Check prefers-reduced-motion
    const mqlReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    isReducedMotionRef.current = mqlReduced.matches;
    const handleReducedChange = (e: MediaQueryListEvent) => {
      isReducedMotionRef.current = e.matches;
    };
    mqlReduced.addEventListener("change", handleReducedChange);

    // Responsive mobile check
    const checkMobile = () => {
      isMobileRef.current = window.innerWidth <= 768;
      baseVelocityRef.current = isMobileRef.current ? 0.35 : 0.65;
      measureLoopWidths();
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);

    // IntersectionObserver to pause RAF loop when outside viewport
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisibleRef.current = entry.isIntersecting;
        });
      },
      { threshold: 0.05 },
    );
    observer.observe(section);

    // Scroll coupling: scrolling down imparts a gentle velocity surge
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      if (!isVisibleRef.current || isReducedMotionRef.current) return;
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY;
      lastScrollY = currentScrollY;

      const impulse = Math.max(-5, Math.min(5, -delta * 0.06));
      velocityRef.current += impulse;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Multi-layer 60fps RequestAnimationFrame Loop
    let rafId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(32, now - lastTime);
      lastTime = now;

      if (!isReducedMotionRef.current && isVisibleRef.current) {
        const targetBaseVel = isHoveredRef.current
          ? baseVelocityRef.current * 0.4
          : baseVelocityRef.current;

        // Physics step: spring velocity decay back to targetBaseVel
        if (!isDraggingRef.current) {
          velocityRef.current += (targetBaseVel - velocityRef.current) * 0.04;

          const step = velocityRef.current * (dt / 16.667);

          // LAYER 3 (Background): moves at 0.52x speed
          bgXRef.current += step * 0.52;
          // LAYER 1 (Primary): moves at 0.90x speed
          primaryXRef.current += step * 0.9;
          // LAYER 2 (Foreground): moves at 1.35x speed
          fgXRef.current += step * 1.35;
        }

        // Modulo wrap-arounds for each independent layer loop
        const bgLoop = bgLoopWidthRef.current || 2000;
        if (bgXRef.current >= bgLoop) bgXRef.current -= bgLoop;
        else if (bgXRef.current < 0) bgXRef.current += bgLoop;

        const primaryLoop = primaryLoopWidthRef.current || 2600;
        if (primaryXRef.current >= primaryLoop)
          primaryXRef.current -= primaryLoop;
        else if (primaryXRef.current < 0) primaryXRef.current += primaryLoop;

        const fgLoop = fgLoopWidthRef.current || 2200;
        if (fgXRef.current >= fgLoop) fgXRef.current -= fgLoop;
        else if (fgXRef.current < 0) fgXRef.current += fgLoop;

        // Mouse pointer spring lerp & 3D tilt
        const isMouseActive =
          isHoveredRef.current ||
          isDraggingRef.current ||
          Math.abs(mouseLerpXRef.current) > 0.002 ||
          Math.abs(mouseLerpYRef.current) > 0.002;

        if (isMouseActive) {
          mouseLerpXRef.current +=
            (targetMouseXRef.current - mouseLerpXRef.current) * 0.08;
          mouseLerpYRef.current +=
            (targetMouseYRef.current - mouseLerpYRef.current) * 0.08;

          if (viewportRef.current) {
            const maxTiltY = isMobileRef.current ? 1.5 : 3.5;
            const maxTiltX = isMobileRef.current ? 1.2 : 2.5;
            const rotY = (mouseLerpXRef.current * maxTiltY).toFixed(2);
            const rotX = (-mouseLerpYRef.current * maxTiltX).toFixed(2);
            viewportRef.current.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
          }

          if (stageRef.current) {
            stageRef.current.style.setProperty(
              "--mouse-x",
              mouseLerpXRef.current.toFixed(4),
            );
            stageRef.current.style.setProperty(
              "--mouse-y",
              mouseLerpYRef.current.toFixed(4),
            );
          }
        }

        // Update GPU translate3d on all 3 tracks directly
        if (bgTrackRef.current) {
          bgTrackRef.current.style.transform = `translate3d(${-bgXRef.current.toFixed(2)}px, 0, 0)`;
        }
        if (primaryTrackRef.current) {
          primaryTrackRef.current.style.transform = `translate3d(${-primaryXRef.current.toFixed(2)}px, 0, 0)`;
        }
        if (fgTrackRef.current) {
          fgTrackRef.current.style.transform = `translate3d(${-fgXRef.current.toFixed(2)}px, 0, 0)`;
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("scroll", handleScroll);
      mqlReduced.removeEventListener("change", handleReducedChange);
    };
  }, [measureLoopWidths]);

  const isPointerDownRef = useRef(false);

  const stageRectRef = useRef<DOMRect | null>(null);

  // Pointer interaction: drag & 3D tilt
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (stageRef.current)
      stageRectRef.current = stageRef.current.getBoundingClientRect();
    isPointerDownRef.current = true;
    isDraggingRef.current = false;
    dragStartXRef.current = e.clientX;
    dragDistanceRef.current = 0;
    dragVelocityRef.current = 0;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const stage = stageRef.current;
    if (!stage) return;

    if (isPointerDownRef.current) {
      const deltaX = e.clientX - dragStartXRef.current;
      dragDistanceRef.current += Math.abs(deltaX);

      if (dragDistanceRef.current > 6) {
        isDraggingRef.current = true;
        dragVelocityRef.current = -deltaX * 0.8;
        dragStartXRef.current = e.clientX;

        // Drag moves all 3 layers with relative depth parallax
        bgXRef.current -= deltaX * 0.6;
        primaryXRef.current -= deltaX * 1.0;
        fgXRef.current -= deltaX * 1.4;
        return;
      }
    }

    const rect =
      stageRectRef.current ||
      (stageRectRef.current = stage.getBoundingClientRect());
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    targetMouseXRef.current = Math.max(
      -1,
      Math.min(1, (e.clientX - cx) / (rect.width / 2)),
    );
    targetMouseYRef.current = Math.max(
      -1,
      Math.min(1, (e.clientY - cy) / (rect.height / 2)),
    );
  };

  const handlePointerUp = () => {
    isPointerDownRef.current = false;
    if (isDraggingRef.current) {
      setTimeout(() => {
        isDraggingRef.current = false;
        dragDistanceRef.current = 0;
      }, 60);

      if (Math.abs(dragVelocityRef.current) > 0.5) {
        velocityRef.current = Math.max(
          -10,
          Math.min(10, dragVelocityRef.current),
        );
      }
    } else {
      dragDistanceRef.current = 0;
    }
  };

  const handleMouseEnter = () => {
    isHoveredRef.current = true;
    if (stageRef.current)
      stageRectRef.current = stageRef.current.getBoundingClientRect();
  };

  const handleMouseLeave = () => {
    isHoveredRef.current = false;
    stageRectRef.current = null;
    targetMouseXRef.current = 0;
    targetMouseYRef.current = 0;
  };

  const handleCardClick = (item: GalleryItem) => {
    if (isDraggingRef.current) return;
    const globalIdx = GALLERY_ITEMS.findIndex((i) => i.id === item.id);
    setViewerIndex(globalIdx >= 0 ? globalIdx : 0);
  };

  const handleManualNudge = (offset: number) => {
    velocityRef.current += offset > 0 ? 6 : -6;
  };

  return (
    <section
      className="moving-wall-section"
      aria-label="Curated Studio Work Preview"
      ref={sectionRef}
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
              onClick={() => handleManualNudge(-340)}
              aria-label="Scroll gallery left"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <button
              type="button"
              className="showcase-nav-btn"
              onClick={() => handleManualNudge(340)}
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

      {/* Multi-Layer 3D Exhibition Spatial Stage */}
      <div
        className={`moving-wall-stage ${
          hoveredCardId !== null ? "has-hovered-card" : ""
        }`}
        ref={stageRef}
        tabIndex={0}
        aria-label="Interactive 3D multi-layer exhibition wall. Drag or swipe horizontally to navigate, select a photograph to expand."
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="moving-wall-viewport" ref={viewportRef}>
          {/* LAYER 1: PRIMARY EYE-LEVEL EXHIBITION RAIL (center line, steady cadence) */}
          <div className="moving-layer moving-layer-primary">
            <div
              className="moving-wall-track moving-track-primary"
              ref={primaryTrackRef}
            >
              {infinitePrimary.map((item, index) => {
                const uniqueKey = `prim-${item.id}-${index}`;
                const isHovered = hoveredCardId === uniqueKey;
                const isFocused = focusedCardId === uniqueKey;

                return (
                  <div
                    key={uniqueKey}
                    className={`moving-wall-card moving-card-layer-mid ${
                      isHovered ? "is-hovered" : ""
                    } ${isFocused ? "is-focused" : ""}`}
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
                    onMouseEnter={() => setHoveredCardId(uniqueKey)}
                    onMouseLeave={() => setHoveredCardId(null)}
                    onFocus={() => {
                      setFocusedCardId(uniqueKey);
                      setHoveredCardId(uniqueKey);
                    }}
                    onBlur={() => {
                      setFocusedCardId(null);
                      setHoveredCardId(null);
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
                        sizes="(max-width: 767px) 210px, 285px"
                      />
                      <div className="moving-card-glare" aria-hidden="true" />
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
                );
              })}
            </div>
          </div>

          {/* LAYER 2: FOREGROUND HEROES (closer to camera, larger, faster parallax) */}
          <div className="moving-layer moving-layer-fg">
            <div className="moving-wall-track moving-track-fg" ref={fgTrackRef}>
              {infiniteFg.map((item, index) => {
                const uniqueKey = `fg-${item.id}-${index}`;
                const isHovered = hoveredCardId === uniqueKey;
                const isFocused = focusedCardId === uniqueKey;

                return (
                  <div
                    key={uniqueKey}
                    className={`moving-wall-card moving-card-layer-fg ${
                      isHovered ? "is-hovered" : ""
                    } ${isFocused ? "is-focused" : ""}`}
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
                    onMouseEnter={() => setHoveredCardId(uniqueKey)}
                    onMouseLeave={() => setHoveredCardId(null)}
                    onFocus={() => {
                      setFocusedCardId(uniqueKey);
                      setHoveredCardId(uniqueKey);
                    }}
                    onBlur={() => {
                      setFocusedCardId(null);
                      setHoveredCardId(null);
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
                        sizes="(max-width: 767px) 250px, 330px"
                      />
                      <div className="moving-card-glare" aria-hidden="true" />
                      <div className="moving-card-overlay">
                        <span className="moving-card-expand">Expand ↗</span>
                      </div>
                    </div>
                    <div className="moving-card-caption">
                      <span className="moving-card-cat">
                        Featured · {item.finish}
                      </span>
                      <span className="moving-card-title">{item.title}</span>
                      <span className="moving-card-finish">
                        {item.colorFamily}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* LAYER 3: BACKGROUND ATMOSPHERIC (deeper in scene, smaller, slower) */}
          <div className="moving-layer moving-layer-bg" aria-hidden="true">
            <div className="moving-wall-track moving-track-bg" ref={bgTrackRef}>
              {infiniteBg.map((item, index) => {
                const uniqueKey = `bg-${item.id}-${index}`;
                return (
                  <div
                    key={uniqueKey}
                    className="moving-wall-card moving-card-layer-bg"
                    tabIndex={-1}
                    onClick={() => handleCardClick(item)}
                  >
                    <div className="moving-card-media">
                      <Image
                        src={item.srcMed || item.src}
                        alt=""
                        width={item.width}
                        height={item.height}
                        unoptimized
                        className="moving-card-image"
                        sizes="(max-width: 767px) 170px, 230px"
                      />
                      <div className="moving-card-glare" />
                    </div>
                    <div className="moving-card-caption">
                      <span className="moving-card-cat">{item.category}</span>
                      <span className="moving-card-title">{item.title}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
