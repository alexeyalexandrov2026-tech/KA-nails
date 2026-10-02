"use client";

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { getGalleryItems, type GalleryItem } from "../lib/gallery-data";
import { GalleryViewer } from "./gallery-viewer";
import { getDictionary, getLocalizedPath, type Locale } from "../lib/locales";

interface HomeMovingWallProps {
  locale?: Locale;
}

export function HomeMovingWall({ locale = "en" }: HomeMovingWallProps) {
  const dict = getDictionary(locale).section02;
  const allItems = useMemo(() => getGalleryItems(locale), [locale]);

  // Partition the 19 authentic salon works into 3 distinct spatial depth layers:
  // LAYER 2: Foreground heroes (closer to camera, larger, faster parallax)
  const fgItems = useMemo(
    () => [
      allItems[0]!, // Bordeaux Wine
      allItems[5]!, // Emerald Velvet
      allItems[9]!, // Cherry Glaze
      allItems[13]!, // Onyx Gloss
      allItems[8]!, // Frosted Chrome
    ],
    [allItems],
  );

  // LAYER 1: Primary eye-level exhibition rail (center line, steady cadence)
  const primaryItems = useMemo(
    () => [
      allItems[1]!, // Royal Cobalt
      allItems[3]!, // Pastel Lilac
      allItems[6]!, // Crimson Luxe
      allItems[11]!, // Mocha Silk
      allItems[14]!, // Buttercup Soft
      allItems[16]!, // Sage Linen
      allItems[17]!, // Terracotta Warm
      allItems[15]!, // Pearl Shimmer
    ],
    [allItems],
  );

  // LAYER 3: Background atmospheric depth (deeper in scene, smaller, slower)
  const bgItems = useMemo(
    () => [
      allItems[2]!, // French Pink
      allItems[4]!, // Midnight Eclipse
      allItems[7]!, // Nude Petal
      allItems[10]!, // Amethyst Dream
      allItems[12]!, // Rose Quartz
      allItems[18]!, // Lavender Mist
    ],
    [allItems],
  );

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
  const infiniteBg = useMemo(() => [...bgItems, ...bgItems], [bgItems]);
  const infinitePrimary = useMemo(
    () => [...primaryItems, ...primaryItems],
    [primaryItems],
  );
  const infiniteFg = useMemo(
    () => [...fgItems, ...fgItems, ...fgItems],
    [fgItems],
  );

  // Measure loop widths accurately
  const measureLoopWidths = useCallback(() => {
    if (bgTrackRef.current) {
      const cards =
        bgTrackRef.current.querySelectorAll<HTMLElement>(".moving-wall-card");
      if (cards.length >= bgItems.length * 2) {
        const c0 = cards[0];
        const cN = cards[bgItems.length];
        if (c0 && cN) {
          const dist = cN.offsetLeft - c0.offsetLeft;
          if (dist > 100) bgLoopWidthRef.current = dist;
        }
      }
    }
    if (primaryTrackRef.current) {
      const cards =
        primaryTrackRef.current.querySelectorAll<HTMLElement>(
          ".moving-wall-card",
        );
      if (cards.length >= primaryItems.length * 2) {
        const c0 = cards[0];
        const cN = cards[primaryItems.length];
        if (c0 && cN) {
          const dist = cN.offsetLeft - c0.offsetLeft;
          if (dist > 100) primaryLoopWidthRef.current = dist;
        }
      }
    }
    if (fgTrackRef.current) {
      const cards =
        fgTrackRef.current.querySelectorAll<HTMLElement>(".moving-wall-card");
      if (cards.length >= fgItems.length * 2) {
        const c0 = cards[0];
        const cN = cards[fgItems.length];
        if (c0 && cN) {
          const dist = cN.offsetLeft - c0.offsetLeft;
          if (dist > 100) fgLoopWidthRef.current = dist;
        }
      }
    }
  }, [bgItems.length, primaryItems.length, fgItems.length]);

  useEffect(() => {
    measureLoopWidths();
    window.addEventListener("resize", measureLoopWidths);
    return () => window.removeEventListener("resize", measureLoopWidths);
  }, [measureLoopWidths]);

  // Main 3D multi-layer animation loop
  useEffect(() => {
    isMobileRef.current = window.innerWidth <= 768;
    isReducedMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (isReducedMotionRef.current) return;

    let rafId: number;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry?.isIntersecting ?? false;
      },
      { threshold: 0.05 },
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    const onScroll = () => {
      if (!isVisibleRef.current) return;
      const scrollDiff = Math.abs(window.scrollY - lastScrollY);
      lastScrollY = window.scrollY;
      velocityRef.current = Math.min(
        3.5,
        baseVelocityRef.current + scrollDiff * 0.035,
      );
    };

    let lastScrollY = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });

    const tick = () => {
      if (isVisibleRef.current) {
        // Recover to base drift velocity smoothly
        if (!isDraggingRef.current) {
          if (Math.abs(dragVelocityRef.current) > 0.05) {
            velocityRef.current = dragVelocityRef.current;
            dragVelocityRef.current *= 0.94; // Inertia decay
          } else {
            dragVelocityRef.current = 0;
            velocityRef.current +=
              (baseVelocityRef.current - velocityRef.current) * 0.05;
          }
        }

        const v = velocityRef.current;

        // LAYER VELOCITY HIERARCHY:
        // Foreground travels ~1.5x faster (closest to viewer)
        // Primary travels ~1.0x (main focal rail)
        // Background travels ~0.58x slower (deep in the background)
        const fgSpeed = v * 1.5;
        const primSpeed = v * 1.0;
        const bgSpeed = v * 0.58;

        fgXRef.current += fgSpeed;
        primaryXRef.current += primSpeed;
        bgXRef.current += bgSpeed;

        // Seamless modular infinite loop wrap
        const fgW = fgLoopWidthRef.current;
        const primW = primaryLoopWidthRef.current;
        const bgW = bgLoopWidthRef.current;

        if (fgXRef.current >= fgW) fgXRef.current %= fgW;
        if (fgXRef.current < 0)
          fgXRef.current = fgW - (Math.abs(fgXRef.current) % fgW);

        if (primaryXRef.current >= primW) primaryXRef.current %= primW;
        if (primaryXRef.current < 0)
          primaryXRef.current = primW - (Math.abs(primaryXRef.current) % primW);

        if (bgXRef.current >= bgW) bgXRef.current %= bgW;
        if (bgXRef.current < 0)
          bgXRef.current = bgW - (Math.abs(bgXRef.current) % bgW);

        // Render hardware-accelerated transforms directly to GPU compositor layers
        if (fgTrackRef.current) {
          fgTrackRef.current.style.transform = `translate3d(${-fgXRef.current}px, 0, 0)`;
        }
        if (primaryTrackRef.current) {
          primaryTrackRef.current.style.transform = `translate3d(${-primaryXRef.current}px, 0, 0)`;
        }
        if (bgTrackRef.current) {
          bgTrackRef.current.style.transform = `translate3d(${-bgXRef.current}px, 0, 0)`;
        }

        // Pointer-reactive 3D perspective stage tilt
        if (!isMobileRef.current) {
          mouseLerpXRef.current +=
            (targetMouseXRef.current - mouseLerpXRef.current) * 0.07;
          mouseLerpYRef.current +=
            (targetMouseYRef.current - mouseLerpYRef.current) * 0.07;

          const tiltX = -mouseLerpYRef.current * 4.5;
          const tiltY = mouseLerpXRef.current * 5.5;

          if (stageRef.current) {
            stageRef.current.style.transform = `perspective(1200px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

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
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const stage = stageRef.current;
    if (!stage) return;

    if (isPointerDownRef.current) {
      const deltaX = e.clientX - dragStartXRef.current;
      dragDistanceRef.current += Math.abs(deltaX);

      if (Math.abs(deltaX) > 4) {
        if (!isDraggingRef.current) {
          try {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          } catch {}
        }
        isDraggingRef.current = true;
        // Differentiated drag travel across depth layers
        primaryXRef.current -= deltaX * 1.0;
        fgXRef.current -= deltaX * 1.45;
        bgXRef.current -= deltaX * 0.6;
        dragVelocityRef.current = -deltaX * 0.35;
        dragStartXRef.current = e.clientX;
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

  const handlePointerUp = (e: React.PointerEvent) => {
    isPointerDownRef.current = false;
    stageRectRef.current = null;
    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {}

    setTimeout(() => {
      isDraggingRef.current = false;
      dragDistanceRef.current = 0;
    }, 40);
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

  // Card click opens full-resolution lightbox viewer
  const handleCardClick = (item: GalleryItem) => {
    if (isDraggingRef.current || dragDistanceRef.current > 8) return;
    const idx = allItems.findIndex((x) => x.id === item.id);
    if (idx !== -1) {
      setViewerIndex(idx);
    }
  };

  // Manual arrow navigation nudges
  const handleManualNudge = (deltaPx: number) => {
    primaryXRef.current += deltaPx;
    fgXRef.current += deltaPx * 1.45;
    bgXRef.current += deltaPx * 0.6;
    velocityRef.current = deltaPx > 0 ? 2.5 : -2.5;
  };

  const galleryHref = getLocalizedPath("/gallery/", locale);

  return (
    <section
      className="moving-wall-section"
      aria-label={dict.eyebrow}
      ref={sectionRef}
    >
      <div className="moving-wall-header">
        <div>
          <p className="eyebrow">{dict.eyebrow}</p>
          <h2 className="section-title">{dict.title}</h2>
        </div>
        <div className="moving-wall-controls">
          <div
            className="moving-wall-nav-btns"
            aria-label={
              locale === "ru"
                ? "Навигация по выставке"
                : "Showcase carousel navigation"
            }
          >
            <button
              type="button"
              className="showcase-nav-btn"
              onClick={() => handleManualNudge(-340)}
              aria-label={dict.scrollLeftAria}
            >
              <span aria-hidden="true">‹</span>
            </button>
            <button
              type="button"
              className="showcase-nav-btn"
              onClick={() => handleManualNudge(340)}
              aria-label={dict.scrollRightAria}
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>
          <Link href={galleryHref} className="button-secondary">
            {dict.viewFullGallery} <span aria-hidden="true">→</span>
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
        aria-label={dict.stageAriaLabel}
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
                    aria-label={dict.cardAriaLabel(
                      item.title,
                      item.categoryLabel || item.category,
                    )}
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
                        priority={index < 4}
                        loading={index < 4 ? "eager" : "lazy"}
                        className="moving-card-image"
                        sizes="(max-width: 767px) 210px, 280px"
                      />
                      <div className="moving-card-glare" />
                    </div>
                    <div className="moving-card-caption">
                      <span className="moving-card-cat">
                        {item.categoryLabel || item.category}
                      </span>
                      <span className="moving-card-title">
                        {locale === "ru" ? (
                          <span lang="en">{item.title}</span>
                        ) : (
                          item.title
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* LAYER 2: FOREGROUND HEROES (closest to camera, larger, faster parallax) */}
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
                    aria-label={dict.cardAriaLabel(
                      item.title,
                      item.categoryLabel || item.category,
                    )}
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
                        priority={index < 2}
                        loading={index < 2 ? "eager" : "lazy"}
                        className="moving-card-image"
                        sizes="(max-width: 767px) 260px, 340px"
                      />
                      <div className="moving-card-glare" />
                      <div className="moving-card-tag-badge">
                        <span>
                          {locale === "ru" ? "Избранное" : "Featured"}
                        </span>
                      </div>
                    </div>
                    <div className="moving-card-caption">
                      <span className="moving-card-cat">
                        {item.categoryLabel || item.category}
                      </span>
                      <span className="moving-card-title">
                        {locale === "ru" ? (
                          <span lang="en">{item.title}</span>
                        ) : (
                          item.title
                        )}
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
                      <span className="moving-card-cat">
                        {item.categoryLabel || item.category}
                      </span>
                      <span className="moving-card-title">
                        {locale === "ru" ? (
                          <span lang="en">{item.title}</span>
                        ) : (
                          item.title
                        )}
                      </span>
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
          {locale === "ru" ? (
            <>
              19 подлинных работ студии · 11 дополнительных работ на этапе
              отбора (цель: 30) ·{" "}
              <Link href={galleryHref}>Вся галерея работ</Link>
            </>
          ) : (
            <>
              19 authentic salon works displayed · 11 additional works pending
              client curation (Target: 30) ·{" "}
              <Link href={galleryHref}>Explore full gallery</Link>
            </>
          )}
        </p>
      </div>

      {/* Lightbox Viewer */}
      <GalleryViewer
        items={allItems}
        currentIndex={viewerIndex}
        onClose={() => setViewerIndex(null)}
        onNavigate={(newIdx) => setViewerIndex(newIdx)}
        locale={locale}
      />
    </section>
  );
}
