import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { Img } from "./Img";
import { useReducedMotionSafe } from "@/lib/motion";

const WIDTHS = [800, 1200, 1600, 2000, 2400];
/** object-position of the photo, so the fog lines up with it exactly */
const POS_X = 0.4;
const POS_Y = 0.5;

type Pt = { x: number; y: number };

/** A window-cleaner's squeegee: rubber blade, steel channel, yellow handle. */
function Squeegee() {
  return (
    <svg viewBox="0 0 150 200" className="h-full w-auto drop-shadow-xl" aria-hidden="true">
      <rect x="96" y="0" width="22" height="200" rx="5" fill="#cfd8e6" />
      <rect x="114" y="3" width="12" height="194" rx="4" fill="#14213d" />
      <rect x="74" y="80" width="26" height="40" rx="6" fill="#9aa8bf" />
      <rect x="0" y="86" width="80" height="28" rx="14" fill="#ffd23f" />
      <rect x="8" y="94" width="56" height="4" rx="2" fill="#fff" opacity="0.5" />
    </svg>
  );
}

/**
 * The opening photo behind steamed-up, grimy glass. A squeegee wipes it
 * clean in stripes, left to right and back; then it's yours — move the mouse
 * (or drag a finger) over the glass to wipe it. Leave it alone and the fog
 * slowly creeps back and the squeegee comes round again. A canvas with the
 * fogged photo drawn on it; wiping cuts it away. Reduced motion: clean glass.
 */
export function FogWindow({ go, onWiped }: { go: boolean; onWiped?: (v: boolean) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const fogImg = useRef<HTMLImageElement>(null);
  const tool = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionSafe();
  const [drawn, setDrawn] = useState(false);
  const wiped = useRef(onWiped);
  wiped.current = onWiped;
  const api = useRef<{ user: (p: Pt) => void; leave: () => void } | null>(null);

  useEffect(() => {
    if (reduce || !go) return undefined;
    const el = wrap.current;
    const c = cv.current;
    const img = fogImg.current?.querySelector("img") ?? null;
    if (!el || !c || !img) return undefined;
    const ctx = c.getContext("2d");
    if (!ctx) return undefined;

    let W = 0;
    let H = 0;
    let B = 0;
    let path: Pt[] = [];
    let lens: number[] = [];
    let total = 0;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);

    const drawFog = (alpha = 1) => {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      if (!iw) return;
      const s = Math.max(W / iw, H / ih);
      const dw = iw * s;
      const dh = ih * s;
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, (W - dw) * POS_X, (H - dh) * POS_Y, dw, dh);
      ctx.globalAlpha = 1;
    };
    const size = () => {
      W = el.clientWidth;
      H = el.clientHeight;
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // the squeegee's route: stripes down the glass, turning outside the frame
      B = Math.max(80, H * 0.25);
      const step = B * 0.9;
      const out = B * 0.45;
      path = [];
      let row = 0;
      for (let y = B / 2; y < H * 0.9; y += step, row++) {
        const [a, b] = row % 2 ? [W + out, -out] : [-out, W + out];
        path.push({ x: a, y }, { x: b, y });
      }
      lens = [0];
      for (let i = 1; i < path.length; i++)
        lens.push(
          lens[i - 1]! + Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y),
        );
      total = lens.at(-1) ?? 0;
      drawFog();
    };
    const at = (d: number): Pt & { dir: number } => {
      let i = 1;
      while (i < lens.length - 1 && lens[i]! < d) i++;
      const a = path[i - 1]!;
      const b = path[i]!;
      const k = Math.min(1, Math.max(0, (d - lens[i - 1]!) / Math.max(1, lens[i]! - lens[i - 1]!)));
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, dir: Math.sign(b.x - a.x) || 1 };
    };
    const wipe = (a: Pt, b: Pt, w: number, cap: CanvasLineCap) => {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = w;
      ctx.lineCap = cap;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x + (a.x === b.x && a.y === b.y ? 0.1 : 0), b.y);
      ctx.stroke();
    };
    const showTool = (p: (Pt & { dir: number }) | null) => {
      const t = tool.current;
      if (!t) return;
      if (!p) {
        t.style.opacity = "0";
        return;
      }
      t.style.opacity = "1";
      t.style.height = `${B * 1.04}px`;
      t.style.transformOrigin = "74% 50%";
      t.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-74%, -50%) scaleX(${p.dir > 0 ? 1 : -1})`;
    };

    type Phase = "wait" | "wipe" | "hold" | "refog" | "user";
    let phase: Phase = "wait";
    let t0 = performance.now();
    let wait = 250;
    let prev: Pt | null = null;
    let lastUser = 0;
    let raf = 0;
    let visible = true;
    const DUR = 2900;

    const loop = (now: number) => {
      raf = 0;
      if (!visible) return;
      if (phase === "wait" && now - t0 > wait) {
        phase = "wipe";
        t0 = now;
        prev = null;
      }
      if (phase === "wipe") {
        const k = Math.min(1, (now - t0) / DUR);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const p = at(e * total);
        if (prev) wipe(prev, p, B, "butt");
        prev = p;
        showTool(p);
        if (k >= 1) {
          phase = "hold";
          t0 = now;
          showTool(null);
          wiped.current?.(true);
        }
      } else if (phase === "hold" && now - t0 > 4800) {
        phase = "refog";
        t0 = now;
        wiped.current?.(false);
      } else if (phase === "refog") {
        drawFog(0.07);
        if (now - t0 > 1100) {
          drawFog();
          phase = "wait";
          t0 = now;
          wait = 700;
        }
      } else if (phase === "user" && now - lastUser > 2600) {
        phase = "hold";
        t0 = now;
      }
      raf = requestAnimationFrame(loop);
    };
    const kick = () => {
      if (!raf && visible) raf = requestAnimationFrame(loop);
    };

    let last: Pt | null = null;
    let lastT = 0;
    api.current = {
      user: (p) => {
        const now = performance.now();
        if (phase === "wipe") showTool(null);
        phase = "user";
        lastUser = now;
        const brush = Math.max(46, Math.min(W, H) * 0.13);
        wipe(last && now - lastT < 120 ? last : p, p, brush, "round");
        last = p;
        lastT = now;
        wiped.current?.(true);
        kick();
      },
      leave: () => {
        last = null;
      },
    };

    const io = new IntersectionObserver(([en]) => {
      visible = !!en?.isIntersecting;
      kick();
    });
    io.observe(el);
    let w0 = 0;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === w0) return;
      w0 = el.clientWidth;
      size();
    });
    const start = () => {
      w0 = el.clientWidth;
      size();
      setDrawn(true);
      ro.observe(el);
      kick();
    };
    if (img.complete && img.naturalWidth) start();
    else img.addEventListener("load", start, { once: true });
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      img.removeEventListener("load", start);
      api.current = null;
    };
  }, [go, reduce]);

  const point = (e: RPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div
      ref={wrap}
      className="absolute inset-0 touch-pan-y"
      data-cursor="Wipe"
      onPointerMove={(e) => {
        if (e.pointerType === "mouse" || e.buttons) api.current?.user(point(e));
      }}
      onPointerDown={(e) => api.current?.user(point(e))}
      onPointerLeave={() => api.current?.leave()}
    >
      <Img
        name="kitchen2"
        widths={WIDTHS}
        sizes="(min-width:1024px) 56vw, 100vw"
        alt="A bright, spotless kitchen with a marble island, timber stools and tall windows"
        priority
        className="absolute inset-0 h-full w-full object-cover object-[40%_50%]"
      />
      {/* the fogged glass: shown as a photo until the canvas has it */}
      {!reduce && (
        <div
          ref={fogImg}
          className="absolute inset-0"
          style={{ visibility: drawn ? "hidden" : "visible" }}
          aria-hidden="true"
        >
          <Img
            name="kitchen2-fog"
            widths={WIDTHS}
            sizes="(min-width:1024px) 56vw, 100vw"
            alt=""
            priority
            className="h-full w-full object-cover object-[40%_50%]"
          />
        </div>
      )}
      {!reduce && (
        <canvas
          ref={cv}
          className="absolute inset-0 h-full w-full"
          data-qa="layered"
          aria-hidden="true"
        />
      )}
      {!reduce && (
        <div
          ref={tool}
          className="pointer-events-none absolute left-0 top-0 opacity-0 transition-opacity duration-300 will-change-transform"
          aria-hidden="true"
        >
          <Squeegee />
        </div>
      )}
    </div>
  );
}
