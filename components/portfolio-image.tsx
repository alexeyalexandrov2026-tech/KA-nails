"use client";

// A client component on purpose: server-rendered <img> elements put image
// preload hints into the RSC payload, so prefetching a page from another one
// would download its photos early. The HTML of the page itself is unchanged.
/* eslint-disable @next/next/no-img-element -- static export has no image
   optimizer; tools/process-photos.mjs pre-renders every work at 400, 750 and
   up to 1200 px, and this <img> lets the browser pick the right one. */
import React from "react";
import type { GalleryItem } from "../lib/gallery-data";

type Photo = Pick<
  GalleryItem,
  "src" | "srcMed" | "srcThumb" | "width" | "height"
>;

interface PortfolioImageProps extends Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src" | "srcSet" | "width" | "height" | "alt" | "sizes"
> {
  photo: Photo;
  alt: string;
  /** Displayed width, as for the `sizes` attribute of <img>. */
  sizes: string;
}

/**
 * Responsive portfolio photo: `-med` stays the default source, and the
 * browser chooses the 400 / 750 / full-width file that matches `sizes` and
 * the screen density.
 */
export function PortfolioImage({
  photo,
  alt,
  sizes,
  loading = "lazy",
  decoding = "async",
  ...rest
}: PortfolioImageProps) {
  const thumbWidth = Math.min(400, photo.width);
  const medWidth = Math.min(750, photo.width);
  return (
    <img
      src={photo.srcMed}
      srcSet={`${photo.srcThumb} ${thumbWidth}w, ${photo.srcMed} ${medWidth}w, ${photo.src} ${photo.width}w`}
      sizes={sizes}
      width={photo.width}
      height={photo.height}
      alt={alt}
      loading={loading}
      decoding={decoding}
      {...rest}
    />
  );
}
