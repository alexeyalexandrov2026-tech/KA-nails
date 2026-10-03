"use client";

import React, { useEffect, useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import type { GalleryItem } from "../lib/gallery-data";
import { whatsappLookLink } from "../lib/booking-message";
import { studioFacts } from "../lib/studio-facts";
import { getDictionary, getLocalizedPath, type Locale } from "../lib/locales";

interface GalleryViewerProps {
  items: GalleryItem[];
  currentIndex: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
  locale?: Locale;
}

export function GalleryViewer({
  items,
  currentIndex,
  onClose,
  onNavigate,
  locale = "en",
}: GalleryViewerProps) {
  const dict = getDictionary(locale).lightbox;
  const bookingDict = getDictionary(locale).bookingRequest;
  const dialogRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchDeltaXRef = useRef<number>(0);
  const [copiedNotification, setCopiedNotification] = useState(false);

  const isOpen =
    currentIndex !== null && currentIndex >= 0 && currentIndex < items.length;
  const currentItem = isOpen ? items[currentIndex] : null;

  const handlePrev = useCallback(() => {
    if (currentIndex === null) return;
    const prevIndex = (currentIndex - 1 + items.length) % items.length;
    onNavigate(prevIndex);
  }, [currentIndex, items.length, onNavigate]);

  const handleNext = useCallback(() => {
    if (currentIndex === null) return;
    const nextIndex = (currentIndex + 1) % items.length;
    onNavigate(nextIndex);
  }, [currentIndex, items.length, onNavigate]);

  // Latest handlers for the key listener, so the open/close effect below runs
  // only when the dialog opens or closes (not on every navigation, which used
  // to send focus back to the page behind the dialog).
  const handlersRef = useRef({ onClose, handlePrev, handleNext });
  useEffect(() => {
    handlersRef.current = { onClose, handlePrev, handleNext };
  });

  // Open/close lifecycle: focus, scroll lock, inert background, key handling.
  useEffect(() => {
    if (!isOpen) return;

    const trigger = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // The dialog is rendered straight into <body>; everything else becomes
    // inert while it is open, so neither focus nor clicks reach the page.
    const dialog = dialogRef.current;
    const inerted: Element[] = [];
    for (const el of Array.from(document.body.children)) {
      if (el === dialog || el.tagName === "SCRIPT" || el.hasAttribute("inert"))
        continue;
      el.setAttribute("inert", "");
      inerted.push(el);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const { onClose, handlePrev, handleNext } = handlersRef.current;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "Tab") {
        // Focus trap
        if (!dialogRef.current) return;
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (first && last) {
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // Initial focus on dialog close button
    dialog?.querySelector<HTMLButtonElement>(".lightbox-close-btn")?.focus();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      for (const el of inerted) el.removeAttribute("inert");

      // Restore focus to the invoking card/control if still in the page
      if (trigger && typeof trigger.focus === "function") {
        setTimeout(() => {
          if (document.contains(trigger)) {
            trigger.focus();
          }
        }, 0);
      }
    };
  }, [isOpen]);

  // Touch swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartXRef.current = touch.clientX;
    touchDeltaXRef.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touch = e.touches[0];
    if (!touch) return;
    touchDeltaXRef.current = touch.clientX - touchStartXRef.current;
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current === null) return;
    const threshold = 50; // min swipe distance in px
    if (touchDeltaXRef.current > threshold) {
      handlePrev();
    } else if (touchDeltaXRef.current < -threshold) {
      handleNext();
    }
    touchStartXRef.current = null;
    touchDeltaXRef.current = 0;
  };

  const handleShare = async () => {
    if (!currentItem) return;
    // Link straight to this artwork in the gallery of the current language.
    const url = new URL(
      `${getLocalizedPath("/gallery/", locale)}#${currentItem.id}`,
      window.location.origin,
    ).toString();
    try {
      if (navigator.share) {
        await navigator.share({
          title: currentItem.title,
          text: currentItem.notes,
          url,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopiedNotification(true);
        setTimeout(() => setCopiedNotification(false), 2000);
      }
    } catch {
      // User cancelled or unsupported
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopiedNotification(true);
        setTimeout(() => setCopiedNotification(false), 2000);
      }
    }
  };

  if (!isOpen || !currentItem) {
    return null;
  }

  const bookHref = getLocalizedPath("/book/", locale);
  // Shown only once the studio publishes a WhatsApp number in studio facts.
  const whatsappHref = whatsappLookLink(studioFacts.channels, locale, [
    { id: currentItem.id, title: currentItem.title },
  ]);
  const categoryLabel = currentItem.categoryLabel || currentItem.category;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={dict.dialogAriaLabel(
        currentItem.title,
        currentIndex + 1,
        items.length,
      )}
      ref={dialogRef}
      className="lightbox-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="lightbox-container">
        {/* Top Control Bar */}
        <header className="lightbox-top-bar">
          <div className="lightbox-counter" aria-live="polite">
            <span className="current-num">{currentIndex + 1}</span>
            <span className="counter-sep">/</span>
            <span className="total-num">{items.length}</span>
            <span className="counter-category">· {categoryLabel}</span>
          </div>

          <div className="lightbox-actions">
            <button
              type="button"
              onClick={handleShare}
              className="lightbox-action-btn"
              aria-label={dict.copyLinkAria}
            >
              {copiedNotification ? dict.linkCopied : dict.share}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="lightbox-close-btn"
              aria-label={dict.closeAria}
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        </header>

        {/* Center Stage Media */}
        <div className="lightbox-stage">
          <button
            type="button"
            onClick={handlePrev}
            className="lightbox-nav-btn prev"
            aria-label={dict.prevAria}
          >
            <span aria-hidden="true">‹</span>
          </button>

          <div className="lightbox-media-wrapper">
            <Image
              src={currentItem.src}
              alt={currentItem.alt}
              width={currentItem.width}
              height={currentItem.height}
              unoptimized
              priority
              className="lightbox-image"
            />
          </div>

          <button
            type="button"
            onClick={handleNext}
            className="lightbox-nav-btn next"
            aria-label={dict.nextAria}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>

        {/* Bottom Details Bar */}
        <footer className="lightbox-footer">
          <div className="lightbox-meta">
            <p className="lightbox-eyebrow">
              {currentItem.colorFamily} · {currentItem.finish}
            </p>
            <h2 className="lightbox-title">
              {locale === "ru" ? (
                <span lang="en">{currentItem.title}</span>
              ) : (
                currentItem.title
              )}
            </h2>
            <p className="lightbox-technique">{currentItem.notes}</p>
          </div>

          <div className="lightbox-booking-action">
            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="lightbox-whatsapp-btn"
                aria-label={bookingDict.lookOnWhatsAppAria(currentItem.title)}
              >
                {bookingDict.lookOnWhatsApp} <span aria-hidden="true">↗</span>
              </a>
            )}
            <Link
              href={bookHref}
              onClick={onClose}
              className="lightbox-book-btn"
              aria-label={dict.bookBtnAria(currentItem.title)}
            >
              {dict.bookBtn} <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
