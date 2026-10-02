"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { HERO_ITEMS } from "../lib/gallery-data";

export function HeroCollage() {
  const [tile1, tile2, tile4, tile3] = HERO_ITEMS; // Lead: work-01, work-02, work-04, work-03
  const stageRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    let rafId: number;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = stage.getBoundingClientRect();
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
    };

    const handleMouseEnter = () => setIsHovered(true);
    const handleMouseLeave = () => {
      setIsHovered(false);
      targetX = 0;
      targetY = 0;
    };

    const animate = () => {
      // Smooth spring lerp
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;

      setMousePos({
        x: Math.round(currentX * 1000) / 1000,
        y: Math.round(currentY * 1000) / 1000,
      });

      rafId = requestAnimationFrame(animate);
    };

    stage.addEventListener("mousemove", handleMouseMove);
    stage.addEventListener("mouseenter", handleMouseEnter);
    stage.addEventListener("mouseleave", handleMouseLeave);
    rafId = requestAnimationFrame(animate);

    return () => {
      stage.removeEventListener("mousemove", handleMouseMove);
      stage.removeEventListener("mouseenter", handleMouseEnter);
      stage.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Compute 3D rotation degrees for the perspective artboard
  const rotateX = -mousePos.y * 6; // Max 6 deg tilt
  const rotateY = mousePos.x * 6;

  return (
    <section className="hero-studio" aria-label="Welcome to KA Nails">
      {/* Editorial Text Column */}
      <div className="hero-text-col">
        <p className="eyebrow">KA Nails · Nail Studio</p>
        <h1 className="hero-heading">
          A little care.
          <br />A moment of pure artistry.
        </h1>
        <p className="hero-description">
          Carefully crafted nail and pedicure artistry. Explore our verified
          portfolio of authentic salon works while online booking preparation is
          underway.
        </p>

        <div className="hero-action-group">
          <Link href="/book/" className="button hero-btn-primary">
            Book an appointment <span aria-hidden="true">↗</span>
          </Link>
          <Link
            href="/gallery/"
            className="button-secondary hero-btn-secondary"
          >
            Explore gallery (19) <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="hero-studio-badges">
          <div className="studio-badge-item">
            <span className="badge-bullet" aria-hidden="true">
              ✦
            </span>
            <span>Curated Pedicure Artistry</span>
          </div>
          <div className="studio-badge-item">
            <span className="badge-bullet" aria-hidden="true">
              ✦
            </span>
            <span>Authentic Salon Portfolio</span>
          </div>
          <div className="studio-badge-item">
            <span className="badge-bullet" aria-hidden="true">
              ✦
            </span>
            <span>Attentive Care</span>
          </div>
        </div>
      </div>

      {/* Asymmetric 3D Perspective Art-Board Collage */}
      <div
        className="hero-visual-col"
        aria-label="Visual salon collage with authentic photography"
        ref={stageRef}
      >
        <div
          className="hero-collage-stage"
          style={{
            transform: `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
            transition: isHovered
              ? "none"
              : "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Main Logo Anchor Tile (Base Layer) */}
          <div className="collage-tile tile-logo" data-layer="base">
            <Image
              src="/assets/ka-nails-logo.png"
              alt="KA Nails Nail Studio"
              width={1254}
              height={1254}
              priority
              unoptimized
              className="collage-logo-img"
              sizes="(max-width: 767px) 80vw, 36vw"
            />
          </div>

          {/* Floating Tile 1: Top-Right Lead Editorial (Bordeaux Wine) */}
          {tile1 && (
            <div
              className="collage-tile tile-drift-1"
              data-layer="top"
              style={{
                transform: `translateZ(35px) translate3d(${mousePos.x * 12}px, ${mousePos.y * 12}px, 0)`,
              }}
            >
              <Link
                href={`/gallery/#${tile1.id}`}
                tabIndex={-1}
                aria-label={`${tile1.title} — ${tile1.category}`}
              >
                <Image
                  src={tile1.src}
                  alt={tile1.alt}
                  width={tile1.width}
                  height={tile1.height}
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
            <div
              className="collage-tile tile-drift-2"
              data-layer="mid"
              style={{
                transform: `translateZ(55px) translate3d(${mousePos.x * 20}px, ${mousePos.y * 20}px, 0)`,
              }}
            >
              <Link
                href={`/gallery/#${tile2.id}`}
                tabIndex={-1}
                aria-label={`${tile2.title} — ${tile2.category}`}
              >
                <Image
                  src={tile2.src}
                  alt={tile2.alt}
                  width={tile2.width}
                  height={tile2.height}
                  unoptimized
                  className="collage-artwork-img"
                />
                <span className="tile-micro-label">
                  {tile2.title} · {tile2.finish}
                </span>
              </Link>
            </div>
          )}

          {/* Floating Tile 3: Bottom-Left French Pink */}
          {tile3 && (
            <div
              className="collage-tile tile-drift-3"
              data-layer="accent"
              style={{
                transform: `translateZ(25px) translate3d(${mousePos.x * -10}px, ${mousePos.y * -10}px, 0)`,
              }}
            >
              <Link
                href={`/gallery/#${tile3.id}`}
                tabIndex={-1}
                aria-label={`${tile3.title} — ${tile3.category}`}
              >
                <Image
                  src={tile3.src}
                  alt={tile3.alt}
                  width={tile3.width}
                  height={tile3.height}
                  unoptimized
                  className="collage-artwork-img"
                />
                <span className="tile-micro-label">
                  {tile3.title} · {tile3.category}
                </span>
              </Link>
            </div>
          )}

          {/* Floating Tile 4: Bottom-Right Pastel Lilac */}
          {tile4 && (
            <div
              className="collage-tile tile-drift-4"
              data-layer="foreground"
              style={{
                transform: `translateZ(45px) translate3d(${mousePos.x * 16}px, ${mousePos.y * 16}px, 0)`,
              }}
            >
              <Link
                href={`/gallery/#${tile4.id}`}
                tabIndex={-1}
                aria-label={`${tile4.title} — ${tile4.category}`}
              >
                <Image
                  src={tile4.src}
                  alt={tile4.alt}
                  width={tile4.width}
                  height={tile4.height}
                  unoptimized
                  className="collage-artwork-img"
                />
                <span className="tile-micro-label">
                  {tile4.title} · {tile4.finish}
                </span>
              </Link>
            </div>
          )}

          {/* Studio.Design Style Compact Status Badge */}
          <div className="hero-reservation-badge" aria-hidden="true">
            <span className="reservation-pulse" />
            <span className="reservation-text">
              Studio Portfolio · 19 Verified Works
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
