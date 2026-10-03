"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { getHeroGalleryTiles } from "../lib/gallery-data";
import { getDictionary, getLocalizedPath, type Locale } from "../lib/locales";

interface HeroCollageProps {
  locale?: Locale;
}

export function HeroCollage({ locale = "en" }: HeroCollageProps) {
  const dict = getDictionary(locale).hero;
  const [tile1, tile2, tile4, tile3] = getHeroGalleryTiles(locale);
  const visualColRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Pointer parallax writes two CSS variables on the stage; the tilt and the
  // per-tile depth offsets are computed in CSS. The loop only runs while the
  // pointer moves and stops once the spring settles, so the hero is idle (no
  // re-renders, no DOM writes) when nobody interacts with it.
  useEffect(() => {
    const col = visualColRef.current;
    const stage = stageRef.current;
    if (!col || !stage) return;

    const finePointerMotion = window.matchMedia(
      "(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)",
    );
    if (!finePointerMotion.matches) return;

    let rafId = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const step = () => {
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      const settled =
        Math.abs(targetX - currentX) < 0.001 &&
        Math.abs(targetY - currentY) < 0.001;
      if (settled) {
        currentX = targetX;
        currentY = targetY;
      }
      stage.style.setProperty("--px", currentX.toFixed(3));
      stage.style.setProperty("--py", currentY.toFixed(3));
      rafId = settled ? 0 : requestAnimationFrame(step);
    };

    const kick = () => {
      if (!rafId) rafId = requestAnimationFrame(step);
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = col.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      // Normalized coordinates: -1 to 1
      targetX = Math.max(
        -1,
        Math.min(1, (e.clientX - centerX) / (rect.width / 2)),
      );
      targetY = Math.max(
        -1,
        Math.min(1, (e.clientY - centerY) / (rect.height / 2)),
      );
      kick();
    };

    const handlePointerLeave = () => {
      targetX = 0;
      targetY = 0;
      kick();
    };

    col.addEventListener("pointermove", handlePointerMove);
    col.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      col.removeEventListener("pointermove", handlePointerMove);
      col.removeEventListener("pointerleave", handlePointerLeave);
      cancelAnimationFrame(rafId);
    };
  }, []);

  const bookHref = getLocalizedPath("/book/", locale);
  const galleryHref = getLocalizedPath("/gallery/", locale);

  return (
    <section className="hero-studio" aria-label={dict.eyebrow}>
      {/* Editorial Text Column */}
      <div className="hero-text-col">
        <p className="eyebrow">{dict.eyebrow}</p>
        <h1 className="hero-heading">
          {dict.headingLine1}
          <br />
          {dict.headingLine2}
        </h1>
        <p className="hero-description">{dict.description}</p>

        <div className="hero-action-group">
          <Link href={bookHref} className="button hero-btn-primary">
            {dict.bookCta} <span aria-hidden="true">↗</span>
          </Link>
          <Link
            href={galleryHref}
            className="button-secondary hero-btn-secondary"
          >
            {dict.galleryCta} <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="hero-studio-badges">
          <div className="studio-badge-item">
            <span className="badge-bullet" aria-hidden="true">
              ✦
            </span>
            <span>{dict.badge1}</span>
          </div>
          <div className="studio-badge-item">
            <span className="badge-bullet" aria-hidden="true">
              ✦
            </span>
            <span>{dict.badge2}</span>
          </div>
          <div className="studio-badge-item">
            <span className="badge-bullet" aria-hidden="true">
              ✦
            </span>
            <span>{dict.badge3}</span>
          </div>
        </div>
      </div>

      {/* Asymmetric 3D Perspective Art-Board Collage */}
      <div
        className="hero-visual-col"
        aria-label={dict.collageAriaLabel}
        ref={visualColRef}
      >
        <div className="hero-collage-stage" ref={stageRef}>
          {/* Main Logo Anchor Tile (Base Layer): a resized copy of the
              original logo (tools/make-logo-derivatives.mjs). */}
          <div className="collage-tile tile-logo" data-layer="base">
            <Image
              src="/assets/ka-nails-logo-640.webp"
              alt="KA Nails"
              width={640}
              height={640}
              loading="eager"
              fetchPriority="high"
              unoptimized
              className="collage-logo-img"
            />
          </div>

          {/* Floating Tile 1: Top-Right Lead Editorial */}
          {tile1 && (
            <div className="collage-tile tile-drift-1" data-layer="top">
              <Link
                href={`${galleryHref}#${tile1.id}`}
                tabIndex={-1}
                aria-label={dict.tileAriaLabel(
                  tile1.title,
                  tile1.categoryLabel || tile1.category,
                )}
              >
                <Image
                  src={tile1.srcMed}
                  alt={tile1.alt}
                  width={tile1.width}
                  height={tile1.height}
                  loading="eager"
                  unoptimized
                  className="collage-artwork-img"
                />
                <span className="tile-micro-label">
                  {tile1.colorFamily} · {tile1.finish}
                </span>
              </Link>
            </div>
          )}

          {/* Floating Tile 2: Center-Right Royal Cobalt */}
          {tile2 && (
            <div className="collage-tile tile-drift-2" data-layer="mid">
              <Link
                href={`${galleryHref}#${tile2.id}`}
                tabIndex={-1}
                aria-label={dict.tileAriaLabel(
                  tile2.title,
                  tile2.categoryLabel || tile2.category,
                )}
              >
                <Image
                  src={tile2.srcMed}
                  alt={tile2.alt}
                  width={tile2.width}
                  height={tile2.height}
                  loading="eager"
                  unoptimized
                  className="collage-artwork-img"
                />
                <span className="tile-micro-label">
                  {locale === "ru" ? (
                    <span lang="en">{tile2.title}</span>
                  ) : (
                    tile2.title
                  )}{" "}
                  · {tile2.finish}
                </span>
              </Link>
            </div>
          )}

          {/* Floating Tile 3: Bottom-Left Cornflower */}
          {tile3 && (
            <div className="collage-tile tile-drift-3" data-layer="accent">
              <Link
                href={`${galleryHref}#${tile3.id}`}
                tabIndex={-1}
                aria-label={dict.tileAriaLabel(
                  tile3.title,
                  tile3.categoryLabel || tile3.category,
                )}
              >
                <Image
                  src={tile3.srcMed}
                  alt={tile3.alt}
                  width={tile3.width}
                  height={tile3.height}
                  loading="eager"
                  unoptimized
                  className="collage-artwork-img"
                />
                <span className="tile-micro-label">
                  {locale === "ru" ? (
                    <span lang="en">{tile3.title}</span>
                  ) : (
                    tile3.title
                  )}{" "}
                  · {tile3.categoryLabel || tile3.category}
                </span>
              </Link>
            </div>
          )}

          {/* Floating Tile 4: Bottom-Right Pastel Lilac */}
          {tile4 && (
            <div className="collage-tile tile-drift-4" data-layer="foreground">
              <Link
                href={`${galleryHref}#${tile4.id}`}
                tabIndex={-1}
                aria-label={dict.tileAriaLabel(
                  tile4.title,
                  tile4.categoryLabel || tile4.category,
                )}
              >
                <Image
                  src={tile4.srcMed}
                  alt={tile4.alt}
                  width={tile4.width}
                  height={tile4.height}
                  loading="eager"
                  unoptimized
                  className="collage-artwork-img"
                />
                <span className="tile-micro-label">
                  {locale === "ru" ? (
                    <span lang="en">{tile4.title}</span>
                  ) : (
                    tile4.title
                  )}{" "}
                  · {tile4.finish}
                </span>
              </Link>
            </div>
          )}

          {/* Studio.Design Style Compact Status Badge */}
          <div className="hero-reservation-badge" aria-hidden="true">
            <span className="reservation-pulse" />
            <span className="reservation-text">{dict.badgeText}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
