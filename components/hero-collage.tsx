"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { getHeroGalleryTiles } from "../lib/gallery-data";

export function HeroCollage() {
  const heroTiles = getHeroGalleryTiles();
  const [tile1, tile2, tile3, tile4] = heroTiles;

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
          Bespoke nail architecture, precision Russian &amp; Japanese e-file
          manicures, and hand-painted fine art. An intimate studio experience
          tailored to the health and beauty of your natural nails.
        </p>

        <div className="hero-action-group">
          <Link href="/book/" className="button hero-btn-primary">
            Book an appointment <span aria-hidden="true">↗</span>
          </Link>
          <Link
            href="/gallery/"
            className="button-secondary hero-btn-secondary"
          >
            Explore gallery (36) <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="hero-studio-badges">
          <div className="studio-badge-item">
            <span className="badge-bullet" aria-hidden="true">
              ✦
            </span>
            <span>Russian E-File Precision</span>
          </div>
          <div className="studio-badge-item">
            <span className="badge-bullet" aria-hidden="true">
              ✦
            </span>
            <span>Japanese Structured BIAB</span>
          </div>
          <div className="studio-badge-item">
            <span className="badge-bullet" aria-hidden="true">
              ✦
            </span>
            <span>Hospital-Grade Autoclave</span>
          </div>
        </div>
      </div>

      {/* Asymmetric Overlapping Visual Collage */}
      <div className="hero-visual-col" aria-label="Visual salon collage">
        <div className="hero-collage-stage">
          {/* Main Logo Anchor Tile */}
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

          {/* Floating Tile 1: Top-Right Chrome French */}
          {tile1 && (
            <div className="collage-tile tile-drift-1" data-layer="top">
              <Link href="/gallery/#work-001" tabIndex={-1} aria-hidden="true">
                <Image
                  src={tile1.src}
                  alt={tile1.alt}
                  width={tile1.width}
                  height={tile1.height}
                  unoptimized
                  className="collage-artwork-img"
                />
                <span className="tile-micro-label">Micro Chrome French</span>
              </Link>
            </div>
          )}

          {/* Floating Tile 2: Center-Right Gold Leaf Nude */}
          {tile2 && (
            <div className="collage-tile tile-drift-2" data-layer="mid">
              <Link href="/gallery/#work-002" tabIndex={-1} aria-hidden="true">
                <Image
                  src={tile2.src}
                  alt={tile2.alt}
                  width={tile2.width}
                  height={tile2.height}
                  unoptimized
                  className="collage-artwork-img"
                />
                <span className="tile-micro-label">24K Gold Leaf</span>
              </Link>
            </div>
          )}

          {/* Floating Tile 3: Bottom-Left Amber Tortoiseshell */}
          {tile3 && (
            <div className="collage-tile tile-drift-3" data-layer="accent">
              <Link href="/gallery/#work-003" tabIndex={-1} aria-hidden="true">
                <Image
                  src={tile3.src}
                  alt={tile3.alt}
                  width={tile3.width}
                  height={tile3.height}
                  unoptimized
                  className="collage-artwork-img"
                />
                <span className="tile-micro-label">Amber Tortoiseshell</span>
              </Link>
            </div>
          )}

          {/* Floating Tile 4: Bottom-Right Glazed Pearl */}
          {tile4 && (
            <div className="collage-tile tile-drift-4" data-layer="foreground">
              <Link href="/gallery/#work-004" tabIndex={-1} aria-hidden="true">
                <Image
                  src={tile4.src}
                  alt={tile4.alt}
                  width={tile4.width}
                  height={tile4.height}
                  unoptimized
                  className="collage-artwork-img"
                />
                <span className="tile-micro-label">Glazed Donut Pearl</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
