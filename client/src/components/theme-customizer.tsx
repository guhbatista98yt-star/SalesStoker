import { useEffect, useRef } from "react";
import { Settings, Sun, Moon, X, PanelLeft, PanelRight, Eye, EyeOff } from "lucide-react";
import { useTheme } from "@/lib/theme-provider";
import { cn } from "@/lib/utils";
import { useState } from "react";

/* ── Logo theme definitions ─────────────────────────────────────────────── */
const LOGO_THEMES = [
  { id: "original"    as const, label: "Original – Roxo Berry",       colors: ["#2342A6","#008FD6","#15B9C8","#78C943"] },
  { id: "blue-tech"   as const, label: "Blue Tech – Azul digital",     colors: ["#061B83","#0069FF","#00B7FF","#9BFAFF"] },
  { id: "green-stock" as const, label: "Green Stock – Verde esmeralda",colors: ["#063F3D","#009C7C","#00D49A","#A8F04B"] },
  { id: "orange-ops"  as const, label: "Orange Ops – Laranja operação",colors: ["#FF3D2E","#FF7A1A","#FFB21A","#FFD36B"] },
  { id: "black-gold"  as const, label: "Black Gold – Preto dourado",   colors: ["#111820","#545B62","#C98C1A","#F4D999"] },
] as const;

type LogoThemeId = (typeof LOGO_THEMES)[number]["id"];

/* ── Drag helpers ────────────────────────────────────────────────────────── */
function getDefaultPos() {
  return { x: window.innerWidth - 60, y: Math.round(window.innerHeight / 2) - 22 };
}
function loadPos() {
  try { const s = localStorage.getItem("wms:gear-pos"); if (s) return JSON.parse(s); } catch {}
  return getDefaultPos();
}
function clampPos(pos: { x: number; y: number }) {
  return {
    x: Math.max(4, Math.min(window.innerWidth - 48, pos.x)),
    y: Math.max(4, Math.min(window.innerHeight - 48, pos.y)),
  };
}

/* ── Main component ──────────────────────────────────────────────────────── */
export function ThemeCustomizer() {
  const { theme, setTheme, logoTheme, setLogoTheme, customizerOpen, openCustomizer, closeCustomizer } = useTheme();

  const [gearVisible, setGearVisible] = useState(() => localStorage.getItem("wms:gear-visible") !== "false");
  const [pos, setPos] = useState<{ x: number; y: number }>(loadPos);
  const [sidebarSide, setSidebarSide] = useState<"left" | "right">(
    () => (localStorage.getItem("wms:sidebar-side") as "left" | "right") || "left"
  );

  /* pos ref — prevents stale closure in drag handler */
  const posRef = useRef(pos);
  useEffect(() => { posRef.current = pos; }, [pos]);

  const btnRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, originX: 0, originY: 0 });

  useEffect(() => { localStorage.setItem("wms:gear-visible", gearVisible ? "true" : "false"); }, [gearVisible]);
  useEffect(() => {
    const onResize = () => setPos(p => clampPos(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ── Drag ── */
  function handleDragStart(e: React.MouseEvent | React.TouchEvent) {
    const isTouch = "touches" in e;
    const clientX = isTouch ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = isTouch ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;

    dragRef.current = { dragging: false, startX: clientX, startY: clientY, originX: posRef.current.x, originY: posRef.current.y };
    const threshold = isTouch ? 10 : 4;

    function onMove(ev: MouseEvent | TouchEvent) {
      const cx = "touches" in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const cy = "touches" in ev ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY;
      const dx = cx - dragRef.current.startX;
      const dy = cy - dragRef.current.startY;
      if (!dragRef.current.dragging && Math.hypot(dx, dy) > threshold) {
        dragRef.current.dragging = true;
        if (btnRef.current) btnRef.current.style.cursor = "grabbing";
      }
      if (dragRef.current.dragging) {
        if ("touches" in ev) ev.preventDefault();
        setPos(clampPos({ x: dragRef.current.originX + dx, y: dragRef.current.originY + dy }));
      }
    }

    function onEnd() {
      if (btnRef.current) btnRef.current.style.cursor = "grab";
      if (dragRef.current.dragging) {
        /* use posRef.current — captures actual latest pos, not stale closure */
        localStorage.setItem("wms:gear-pos", JSON.stringify(posRef.current));
      } else {
        openCustomizer();
      }
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onMove as EventListener);
      document.removeEventListener("touchend", onEnd);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onMove as EventListener, { passive: false });
    document.addEventListener("touchend", onEnd);
  }

  return (
    <>
      {/* ── Floating gear ── */}
      {gearVisible && (
        <button
          ref={btnRef}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 1300 }}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md select-none touch-none cursor-grab"
          aria-label="Personalizar tema"
          title="Personalizar tema"
        >
          <Settings className="gear-spin h-5 w-5" strokeWidth={1.8} />
        </button>
      )}

      {/* ── Backdrop ── */}
      {customizerOpen && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/40 z-[1400]" onClick={closeCustomizer} />
      )}

      {/* ── Sliding panel ── */}
      {customizerOpen && (
        <div className={cn(
          "theme-panel-in fixed top-0 right-0 bottom-0 z-[1500]",
          "w-full sm:w-[300px] bg-card border-l border-border flex flex-col overflow-y-auto",
        )}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" strokeWidth={1.8} />
              <span className="font-semibold text-sm text-foreground">Personalizar</span>
            </div>
            <button onClick={closeCustomizer} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 px-5 py-5 space-y-6">

            {/* Aparência */}
            <div className="space-y-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">Aparência</p>
              <div className="flex gap-2">
                {(["light", "dark"] as const).map(mode => (
                  <button key={mode} onClick={() => setTheme(mode)}
                    className={cn("flex-1 flex flex-col items-center gap-2 py-3 rounded-xl border text-xs font-medium transition-all",
                      theme === mode ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:bg-secondary/50"
                    )}>
                    {mode === "light" ? <Sun className="h-5 w-5" strokeWidth={1.5} /> : <Moon className="h-5 w-5" strokeWidth={1.5} />}
                    {mode === "light" ? "Claro" : "Escuro"}
                  </button>
                ))}
              </div>
            </div>

            {/* Cor do sistema */}
            <div className="space-y-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">Cor do sistema</p>
              <div className="flex flex-wrap gap-3">
                {LOGO_THEMES.map(t => (
                  <button key={t.id} onClick={() => setLogoTheme(t.id as LogoThemeId)} title={t.label}
                    className="relative w-10 h-10 rounded-full transition-transform hover:scale-110 active:scale-95"
                    style={{
                      background: `conic-gradient(${t.colors[0]} 0deg 90deg, ${t.colors[1]} 90deg 180deg, ${t.colors[2]} 180deg 270deg, ${t.colors[3]} 270deg 360deg)`,
                      boxShadow: logoTheme === t.id ? `0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--primary))` : undefined,
                    }}>
                    {logoTheme === t.id && (
                      <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="w-3 h-3 rounded-full bg-white/90 shadow" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {LOGO_THEMES.find(t => t.id === logoTheme)?.label ?? ""}
              </p>
            </div>

            {/* Posição da sidebar */}
            <div className="space-y-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">Posição da barra lateral</p>
              <div className="flex gap-2">
                {(["left", "right"] as const).map(side => (
                  <button key={side}
                    onClick={() => {
                      setSidebarSide(side);
                      localStorage.setItem("wms:sidebar-side", side);
                      window.dispatchEvent(new CustomEvent("wms:sidebar-side-changed", { detail: { side } }));
                    }}
                    className={cn("flex-1 flex flex-col items-center gap-2 py-3 rounded-xl border text-xs font-medium transition-all",
                      sidebarSide === side ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:bg-secondary/50"
                    )}>
                    {side === "left" ? <PanelLeft className="h-5 w-5" strokeWidth={1.5} /> : <PanelRight className="h-5 w-5" strokeWidth={1.5} />}
                    {side === "left" ? "Esquerda" : "Direita"}
                  </button>
                ))}
              </div>
            </div>

            {/* Visibilidade da engrenagem */}
            <div className="space-y-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">Botão flutuante</p>
              <button
                onClick={() => setGearVisible(v => !v)}
                className={cn("w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-medium transition-all",
                  gearVisible
                    ? "border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive hover:bg-destructive/5"
                    : "border-primary/40 text-primary bg-primary/5 hover:bg-primary/10"
                )}>
                {gearVisible ? <><EyeOff className="h-4 w-4" /> Ocultar engrenagem</> : <><Eye className="h-4 w-4" /> Mostrar engrenagem</>}
              </button>
              {!gearVisible && (
                <p className="text-[11px] text-muted-foreground text-center leading-snug">
                  Acesse este painel pelo botão ⚙ na barra do topo.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── TopBar trigger (shown when gear is hidden, always accessible) ─────── */
export function ThemeCustomizerTrigger() {
  const { openCustomizer, gearVisible } = useThemeCustomizerState();
  if (gearVisible) return null;
  return (
    <button
      onClick={openCustomizer}
      title="Personalizar tema"
      className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
    >
      <Settings className="h-4 w-4" />
    </button>
  );
}

/* ── Hook for trigger (reads gear visible from localStorage) ─────────────── */
function useThemeCustomizerState() {
  const { openCustomizer } = useTheme();
  const [gearVisible, setGearVisible] = useState(() => localStorage.getItem("wms:gear-visible") !== "false");
  useEffect(() => {
    const handler = () => setGearVisible(localStorage.getItem("wms:gear-visible") !== "false");
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
  return { openCustomizer, gearVisible };
}
