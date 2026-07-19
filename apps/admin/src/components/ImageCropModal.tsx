import React, { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@pageant/ui/components/dialog";
import { Button } from "@pageant/ui/components/button";
import { ZoomIn, ZoomOut, RotateCcw, Crop, Check, X } from "lucide-react";

interface ImageCropModalProps {
  open: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onCropComplete: (croppedFile: File, previewUrl: string) => void;
}

export function ImageCropModal({ open, imageSrc, onClose, onCropComplete }: ImageCropModalProps) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgDims, setImgDims] = useState<{ width: number; height: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset offset and zoom when modal opens
  useEffect(() => {
    if (open) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [open, imageSrc]);

  const handleImageLoad = () => {
    if (!imageRef.current) return;
    setImgDims({
      width: imageRef.current.naturalWidth,
      height: imageRef.current.naturalHeight,
    });
  };

  // Helper to clamp offsets so image always completely covers the 280x280 crop area
  const clampOffset = useCallback(
    (x: number, y: number, currentZoom: number) => {
      if (!imgDims) return { x: 0, y: 0 };
      const viewportSize = 280;
      const coverScale = Math.max(viewportSize / imgDims.width, viewportSize / imgDims.height);
      const dispW = imgDims.width * coverScale * currentZoom;
      const dispH = imgDims.height * coverScale * currentZoom;

      const maxOffsetX = Math.max(0, (dispW - viewportSize) / 2);
      const maxOffsetY = Math.max(0, (dispH - viewportSize) / 2);

      return {
        x: Math.min(Math.max(x, -maxOffsetX), maxOffsetX),
        y: Math.min(Math.max(y, -maxOffsetY), maxOffsetY),
      };
    },
    [imgDims]
  );

  // Handle Mouse / Touch drag to pan (clamped)
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX - offset.x, y: clientY - offset.y });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const rawX = clientX - dragStart.x;
      const rawY = clientY - dragStart.y;
      setOffset(clampOffset(rawX, rawY, zoom));
    },
    [isDragging, dragStart, zoom, clampOffset]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleMouseMove);
      window.addEventListener("touchend", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleMouseMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Mouse wheel zoom support
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.min(Math.max(1, zoom + delta), 3.5);
    setZoom(newZoom);
    setOffset((prev) => clampOffset(prev.x, prev.y, newZoom));
  };

  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom);
    setOffset((prev) => clampOffset(prev.x, prev.y, newZoom));
  };

  // Generate cropped image on high resolution canvas & export Blob/File
  const handleSaveCrop = () => {
    if (!imageRef.current || !containerRef.current || !imgDims) return;

    const img = imageRef.current;
    const viewportSize = 280;
    const outputSize = 500;
    const ratio = outputSize / viewportSize;

    // Cover scale factor (ensures 100% viewport coverage, no empty edges)
    const coverScale = Math.max(viewportSize / imgDims.width, viewportSize / imgDims.height);
    const displayedWidth = imgDims.width * coverScale;
    const displayedHeight = imgDims.height * coverScale;

    // Final dimensions on output canvas
    const renderWidth = displayedWidth * zoom * ratio;
    const renderHeight = displayedHeight * zoom * ratio;

    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Ensure clamped offset is applied
    const clamped = clampOffset(offset.x, offset.y, zoom);
    const centerX = (outputSize / 2) + (clamped.x * ratio);
    const centerY = (outputSize / 2) + (clamped.y * ratio);

    ctx.drawImage(
      img,
      centerX - (renderWidth / 2),
      centerY - (renderHeight / 2),
      renderWidth,
      renderHeight
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "candidate-photo.jpg", { type: "image/jpeg" });
        const previewUrl = URL.createObjectURL(blob);
        onCropComplete(file, previewUrl);
        onClose();
      },
      "image/jpeg",
      0.92
    );
  };

  if (!open || !imageSrc) return null;

  // Calculate cover dimensions for image display inside 280x280 box
  const viewportSize = 280;
  let imgStyleWidth = 280;
  let imgStyleHeight = 280;
  if (imgDims) {
    const coverScale = Math.max(viewportSize / imgDims.width, viewportSize / imgDims.height);
    imgStyleWidth = imgDims.width * coverScale;
    imgStyleHeight = imgDims.height * coverScale;
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-lg p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Crop className="w-5 h-5 text-primary" />
            Crop & Position Image
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-4 my-2">
          {/* Crop Area Viewport (280x280) */}
          <div
            ref={containerRef}
            className="relative w-70 h-70 rounded-xl overflow-hidden bg-black/90 border-2 border-primary/50 shadow-2xl cursor-grab active:cursor-grabbing select-none"
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
            onWheel={handleWheel}
          >
            {/* Image display layer */}
            <div
              className="absolute transition-transform duration-75 ease-out"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transformOrigin: "center center",
                top: "50%",
                left: "50%",
              }}
            >
              <img
                ref={imageRef}
                src={imageSrc}
                crossOrigin="anonymous"
                alt="Crop preview"
                className="max-w-none pointer-events-none -translate-x-1/2 -translate-y-1/2"
                style={{
                  width: `${imgStyleWidth}px`,
                  height: `${imgStyleHeight}px`,
                  objectFit: "cover",
                }}
                onLoad={handleImageLoad}
              />
            </div>

            {/* 3x3 Grid Overlay (Rule of Thirds + Center Guide) */}
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/30">
              {/* Top Row */}
              <div className="border-r border-b border-white/30" />
              <div className="border-r border-b border-white/30" />
              <div className="border-b border-white/30" />

              {/* Middle Row (Center target highlighted) */}
              <div className="border-r border-b border-white/30" />
              <div className="border-r border-b border-white/50 bg-primary/10 relative flex items-center justify-center">
                {/* Center Target Indicator */}
                <div className="w-3 h-3 rounded-full border border-primary/80" />
                <div className="absolute w-5 h-px bg-primary/60" />
                <div className="absolute h-5 w-px bg-primary/60" />
              </div>
              <div className="border-b border-white/30" />

              {/* Bottom Row */}
              <div className="border-r border-white/30" />
              <div className="border-r border-white/30" />
              <div className="" />
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Drag photo to adjust position • Align face inside center grid
          </p>

          {/* Controls Bar */}
          <div className="w-full space-y-3 bg-card p-4 rounded-xl border border-border">
            <div className="flex items-center gap-3">
              <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="range"
                min="1"
                max="3.5"
                step="0.05"
                value={zoom}
                onChange={(e) => handleZoomChange(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
              <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-xs font-mono font-bold w-12 text-right">{zoom.toFixed(1)}x</span>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => {
                  setZoom(1);
                  setOffset({ x: 0, y: 0 });
                }}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset Position
              </Button>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose}>
            <X className="w-4 h-4 mr-1" /> Cancel
          </Button>
          <Button type="button" onClick={handleSaveCrop} className="gap-1.5">
            <Check className="w-4 h-4" /> Save Crop
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
