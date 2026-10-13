"use client";
import { useEffect, useState } from "react";

const DESIGN_W = 1440;
const DESIGN_H = 1024;

interface Transform {
  scale: number;
  ml: number;
  mt: number;
}

export default function LoginScaleWrapper({ children }: { children: React.ReactNode }) {
  const [transform, setTransform] = useState<Transform | null>(null);

  useEffect(() => {
    function compute() {
      const scale = Math.min(
        window.innerWidth / DESIGN_W,
        window.innerHeight / DESIGN_H
      );
      const ml = Math.max(0, (window.innerWidth - DESIGN_W * scale) / 2);
      const mt = Math.max(0, (window.innerHeight - DESIGN_H * scale) / 2);
      setTransform({ scale, ml, mt });
    }

    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  // Block every browser zoom pathway
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        ["+", "-", "=", "_", "0"].includes(e.key)
      ) {
        e.preventDefault();
      }
    };
    // Block pinch-to-zoom on touch devices
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };

    // Must be non-passive to call preventDefault()
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey, { passive: false });
    document.addEventListener("touchstart", onTouch, { passive: false });
    document.addEventListener("touchmove", onTouch, { passive: false });

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("touchstart", onTouch);
      document.removeEventListener("touchmove", onTouch);
    };
  }, []);

  return (
    // position:fixed so no scroll ever appears, background fills full screen
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: "linear-gradient(180deg, #212121 0%, #000000 100%)",
      }}
    >
      {/* Canvas: hidden (opacity 0) until scale is computed to prevent full-size flash */}
      <div
        style={{
          width: `${DESIGN_W}px`,
          height: `${DESIGN_H}px`,
          position: "absolute",
          transformOrigin: "top left",
          transform: transform ? `scale(${transform.scale})` : "scale(1)",
          left: transform ? `${transform.ml}px` : 0,
          top: transform ? `${transform.mt}px` : 0,
          opacity: transform ? 1 : 0,
          transition: "opacity 120ms ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}
