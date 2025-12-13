import React, { useEffect, useMemo, useRef, useState } from 'react';
import { logEvent } from '../sim/attempt';

type PinLocation = { id: number; x: number; y: number };

type ImageSceneProps = {
  imageSrc: string;
  alt: string;
  showGrid: boolean;
  allowPins: boolean;
  pinMode: boolean;
  pins: PinLocation[];
  onAddPin: (pin: { x: number; y: number }) => void;
  onRemovePin: (id: number) => void;
};

const GRID_COLUMNS = ['A', 'B', 'C', 'D', 'E'];
const GRID_ROWS = ['1', '2', '3', '4'];
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const ZOOM_STEP = 0.2;

export function ImageScene({
  imageSrc,
  alt,
  showGrid,
  allowPins,
  pinMode,
  pins,
  onAddPin,
  onRemovePin,
}: ImageSceneProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number; translateX: number; translateY: number } | null>(null);
  const [didDrag, setDidDrag] = useState(false);

  useEffect(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, [imageSrc]);

  const gridOverlay = useMemo(() => {
    if (!showGrid) return null;
    return (
      <div className="grid-overlay" aria-hidden="true">
        <div className="grid-lines" />
        <div className="grid-labels">
          {GRID_COLUMNS.map((label, index) => (
            <div key={label} className="grid-label grid-label--column" style={{ left: `${(index + 0.5) * 20}%` }}>
              {label}
            </div>
          ))}
          {GRID_ROWS.map((label, index) => (
            <div key={label} className="grid-label grid-label--row" style={{ top: `${(index + 0.5) * 25}%` }}>
              {label}
            </div>
          ))}
        </div>
      </div>
    );
  }, [showGrid]);

  function handleZoom(delta: number) {
    setScale((prev) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number((prev + delta).toFixed(2))));
      if (next !== prev) {
        logEvent('zoom_changed', { scale: next });
      }
      return next;
    });
  }

  function handleResetView() {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    logEvent('view_reset', { scale: 1, translate: { x: 0, y: 0 } });
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    handleZoom(direction);
  }

  function handleMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('.scene-pin')) return;
    dragStart.current = {
      x: event.clientX,
      y: event.clientY,
      translateX: translate.x,
      translateY: translate.y,
    };
    setDidDrag(false);
  }

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    event.preventDefault();
    const dx = event.clientX - dragStart.current.x;
    const dy = event.clientY - dragStart.current.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      setDidDrag(true);
    }
    const nextTranslate = {
      x: dragStart.current.translateX + dx,
      y: dragStart.current.translateY + dy,
    };
    setTranslate(nextTranslate);
    logEvent('pan_changed', nextTranslate);
  }

  function endDrag() {
    dragStart.current = null;
  }

  function handleViewportClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!allowPins || !pinMode) return;
    if (didDrag) {
      setDidDrag(false);
      return;
    }
    const imageRect = imageRef.current?.getBoundingClientRect();
    if (!imageRect) return;
    const x = (event.clientX - imageRect.left) / imageRect.width;
    const y = (event.clientY - imageRect.top) / imageRect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    onAddPin({ x, y });
  }

  const hasPins = allowPins && pins.length > 0;

  return (
    <div className="image-scene">
      <div className="scene-toolbar" aria-label="Scene controls">
        <div className="toolbar-group">
          <button type="button" onClick={() => handleZoom(-ZOOM_STEP)} aria-label="Zoom out">
            -
          </button>
          <button type="button" onClick={() => handleZoom(ZOOM_STEP)} aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={handleResetView} aria-label="Reset view">
            Reset view
          </button>
        </div>
      </div>
      <div
        ref={viewportRef}
        className="scene-viewport"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onClick={handleViewportClick}
        onWheel={handleWheel}
      >
        <div
          className="scene-media"
          style={{ transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})` }}
        >
          <img ref={imageRef} src={imageSrc} alt={alt} draggable={false} />
          {gridOverlay}
          {hasPins && (
            <div className="pins-layer" aria-label="Placed pins">
              {pins.map((pin, index) => (
                <button
                  key={pin.id}
                  type="button"
                  className="scene-pin"
                  style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemovePin(pin.id);
                  }}
                  aria-label={`Remove pin ${index + 1}`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImageScene;
