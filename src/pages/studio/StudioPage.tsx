import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BringToFront,
  Check,
  Copy,
  Film,
  Heading1,
  ImagePlus,
  LayoutList,
  Loader2,
  Minus,
  Plus,
  QrCode,
  SendToBack,
  Square,
  Store,
  Trash2,
  Type,
  UtensilsCrossed,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import {
  DEFAULT_TEMPLATE_CONFIG,
  type Menu,
  type MenuItem,
  type MenuSection,
  type StudioDoc,
  type StudioElement,
  type StudioFont,
  type TemplateConfig,
  type TemplateId,
} from "../../lib/types";
import { boardDimensions } from "../../templates/shared";
import { StudioElementView, scaffoldFromTemplate, scaffoldStudio } from "../../templates/StudioBoard";
import Toggle from "../../components/Toggle";
import { deleteMenuImageUrl, uploadMenuImage } from "../../lib/uploadImage";
import { uploadMenuMedia } from "../../lib/uploadMedia";

type SectionWithItems = MenuSection & { items: MenuItem[] };

const FONT_OPTIONS: [StudioFont, string][] = [
  ["poppins", "Poppins"],
  ["grotesk", "Space Grotesk"],
  ["bebas", "Bebas Neue"],
  ["fraunces", "Fraunces"],
  ["caveat", "Caveat"],
  ["bricolage", "Bricolage Grotesque"],
  ["outfit", "Outfit"],
];

const TEMPLATE_STARTERS: { id: TemplateId; label: string }[] = [
  { id: "spotlight", label: "Spotlight" },
  { id: "vivid", label: "Vivid Zones" },
  { id: "promo", label: "Promo Hero" },
];

export default function StudioPage() {
  const { menuId } = useParams();
  const { restaurant } = useAuth();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [sections, setSections] = useState<SectionWithItems[]>([]);
  const [config, setConfig] = useState<TemplateConfig | null>(null);
  const [doc, setDoc] = useState<StudioDoc | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fitScale, setFitScale] = useState(0.4);
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [guides, setGuides] = useState({ v: false, h: false });
  const [loading, setLoading] = useState(true);

  const saveTimer = useRef<number | undefined>(undefined);
  const docRef = useRef<StudioDoc | null>(null);
  const cfgRef = useRef<TemplateConfig | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgFileRef = useRef<HTMLInputElement>(null);
  const mediaFileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);
  docRef.current = doc;
  cfgRef.current = config;

  /* ------------------------------ load ------------------------------ */

  useEffect(() => {
    if (!menuId) return;
    (async () => {
      const [{ data: m }, { data: secs }] = await Promise.all([
        supabase.from("menus").select("*").eq("id", menuId).maybeSingle(),
        supabase
          .from("menu_sections")
          .select("*, items:menu_items(*)")
          .eq("menu_id", menuId)
          .order("sort_order"),
      ]);
      const loadedMenu = m as Menu | null;
      const loadedSections = ((secs as SectionWithItems[]) ?? []).map((s) => ({
        ...s,
        items: (s.items ?? []).sort((a, b) => a.sort_order - b.sort_order),
      }));
      setMenu(loadedMenu);
      setSections(loadedSections);
      if (loadedMenu) {
        const cfg: TemplateConfig = { ...DEFAULT_TEMPLATE_CONFIG, ...loadedMenu.template_config };
        setConfig(cfg);
        if (cfg.studio?.elements?.length) {
          setDoc(cfg.studio);
        } else {
          const scaffold = scaffoldStudio(loadedMenu.orientation, loadedSections, cfg.accent);
          setDoc(scaffold);
          await supabase
            .from("menus")
            .update({
              template_config: { ...cfg, studio: scaffold },
              template_id: "custom",
            })
            .eq("id", loadedMenu.id);
        }
      }
      setLoading(false);
    })();
  }, [menuId]);

  /* ------------------------------ save ------------------------------ */

  const scheduleSave = useCallback(() => {
    setSaveState("saving");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      if (!cfgRef.current || !docRef.current) return;
      await supabase
        .from("menus")
        .update({
          template_config: { ...cfgRef.current, studio: docRef.current },
          template_id: "custom",
        })
        .eq("id", menuId);
      setSaveState("saved");
    }, 600);
  }, [menuId]);

  const mutateDoc = useCallback(
    (fn: (d: StudioDoc) => StudioDoc, save = true) => {
      setDoc((d) => (d ? fn(d) : d));
      if (save) scheduleSave();
    },
    [scheduleSave]
  );

  function updateEl(id: string, patch: Partial<StudioElement>, save = true) {
    mutateDoc((d) => ({ elements: d.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) }), save);
  }

  function patchCfg(patch: Partial<TemplateConfig>) {
    setConfig((c) => (c ? { ...c, ...patch } : c));
    scheduleSave();
  }

  /* --------------------------- fit / zoom --------------------------- */

  const { width, height } = boardDimensions(menu?.orientation ?? "landscape");

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () =>
      setFitScale(Math.min((el.clientWidth - 80) / width, (el.clientHeight - 80) / height));
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, [width, height, loading]);

  const scale = fitScale * zoom;

  /* --------------------------- keyboard ----------------------------- */

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }
      if (!selectedId) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        mutateDoc((d) => ({ elements: d.elements.filter((el) => el.id !== selectedId) }));
        setSelectedId(null);
      } else if (e.key === "Escape") {
        setSelectedId(null);
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 20 : 4;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        mutateDoc((d) => ({
          elements: d.elements.map((el) =>
            el.id === selectedId ? { ...el, x: el.x + dx, y: el.y + dy } : el
          ),
        }));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, mutateDoc]);

  /* ------------------------- add elements --------------------------- */

  function addElement(partial: Omit<StudioElement, "id">) {
    const el: StudioElement = { ...partial, id: crypto.randomUUID() };
    mutateDoc((d) => ({ elements: [...d.elements, el] }));
    setSelectedId(el.id);
  }

  function addText(heading: boolean) {
    addElement({
      type: "text",
      text: heading ? "Heading" : "Write something…",
      x: width / 2 - 300,
      y: height / 2 - (heading ? 50 : 30),
      w: 600,
      h: heading ? 100 : 60,
      fontSize: heading ? 64 : 28,
      fontWeight: heading ? 700 : 500,
      fontFamily: heading ? "bebas" : "poppins",
      color: "#1F2933",
      align: "center",
    });
  }

  async function uploadStudioImage(file: File, forBackground = false) {
    try {
      const path = `${restaurant!.id}/studio-${Date.now()}.jpg`;
      const publicUrl = await uploadMenuImage(path, file);
      if (forBackground) void deleteMenuImageUrl(config?.backgroundImage);
      return publicUrl;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
      return null;
    }
  }

  /* ------------------------------ render ---------------------------- */

  if (loading || !menu || !config || !doc || !restaurant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#22282F]">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/20 border-t-brand" />
      </div>
    );
  }

  const data = {
    restaurantName: restaurant.name,
    logoUrl: restaurant.logo_url,
    currency: restaurant.currency,
    menuName: menu.name,
    sections,
  };
  const selected = doc.elements.find((e) => e.id === selectedId) ?? null;
  const selectedIndex = selected ? doc.elements.findIndex((e) => e.id === selected.id) : -1;

  function moveLayer(dir: 1 | -1) {
    if (!selected) return;
    mutateDoc((d) => {
      const i = d.elements.findIndex((e) => e.id === selected.id);
      const j = i + dir;
      if (j < 0 || j >= d.elements.length) return d;
      const next = d.elements.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return { elements: next };
    });
  }

  function duplicateSelected() {
    if (!selected) return;
    addElement({ ...selected, x: selected.x + 32, y: selected.y + 32 });
  }

  function deleteSelected() {
    if (!selected) return;
    mutateDoc((d) => ({ elements: d.elements.filter((e) => e.id !== selected.id) }));
    setSelectedId(null);
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#22282F] text-ink">
      {/* top bar */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-[#1A2026] px-4 text-white">
        <Link to={`/app/menus/${menu.id}`} className="btn-ghost text-white/80 hover:bg-white/10 hover:text-white">
          <ArrowLeft size={16} /> Editor
        </Link>
        <p className="min-w-0 truncate font-medium">
          {menu.name} <span className="text-white/40">— Studio</span>
        </p>
        <span className="flex items-center gap-1.5 text-xs text-white/50">
          {saveState === "saving" ? (
            <>
              <Loader2 size={13} className="animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Check size={13} className="text-live" /> Saved
            </>
          )}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button className="btn-ghost px-2 text-white/80 hover:bg-white/10 hover:text-white" onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.15).toFixed(2)))}>
            <Minus size={15} />
          </button>
          <button className="btn-ghost px-2 text-xs text-white/80 hover:bg-white/10 hover:text-white" onClick={() => setZoom(1)} title="Fit to window">
            {Math.round(scale * 100)}%
          </button>
          <button className="btn-ghost px-2 text-white/80 hover:bg-white/10 hover:text-white" onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))}>
            <Plus size={15} />
          </button>
        </div>
        <Link to={`/app/menus/${menu.id}`} className="btn-primary py-2">
          Done
        </Link>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* left panel: add elements */}
        <aside className="w-60 shrink-0 space-y-5 overflow-y-auto border-r border-white/10 bg-[#1A2026] p-4 text-white">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
              Template starters
            </p>
            <div className="space-y-1.5">
              {TEMPLATE_STARTERS.map((t) => (
                <button
                  key={t.id}
                  className="w-full rounded-lg border border-white/10 px-3 py-2 text-left text-sm text-white/80 transition-colors hover:border-brand hover:text-white"
                  onClick={() => {
                    if (!confirm(`Replace canvas with the ${t.label} starter layout?`)) return;
                    const next = scaffoldFromTemplate(t.id, menu!.orientation, sections, config!.accent);
                    setDoc(next);
                    void supabase
                      .from("menus")
                      .update({ template_config: { ...config, studio: next } })
                      .eq("id", menu!.id);
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
              Layers
            </p>
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {[...doc.elements].reverse().map((el, revIdx) => {
                const idx = doc.elements.length - 1 - revIdx;
                return (
                  <button
                    key={el.id}
                    onClick={() => setSelectedId(el.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                      el.id === selectedId
                        ? "bg-brand/20 text-white"
                        : "text-white/60 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="w-4 text-white/30">{idx + 1}</span>
                    <span className="truncate">{labelFor(el.type)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
              Elements
            </p>
            <div className="grid grid-cols-2 gap-2">
              <StudioAddButton icon={Heading1} label="Heading" onClick={() => addText(true)} />
              <StudioAddButton icon={Type} label="Text" onClick={() => addText(false)} />
              <StudioAddButton
                icon={Square}
                label="Shape"
                onClick={() =>
                  addElement({
                    type: "shape",
                    x: width / 2 - 160,
                    y: height / 2 - 80,
                    w: 320,
                    h: 160,
                    fill: config.accent,
                    radius: 16,
                    opacity: 100,
                  })
                }
              />
              <StudioAddButton icon={ImagePlus} label="Photo" onClick={() => imgFileRef.current?.click()} />
              <StudioAddButton icon={Film} label="GIF" onClick={() => mediaFileRef.current?.click()} />
              <StudioAddButton icon={Film} label="Video" onClick={() => videoFileRef.current?.click()} />
              <StudioAddButton
                icon={QrCode}
                label="QR code"
                onClick={() =>
                  addElement({
                    type: "qrCode",
                    linkUrl: "",
                    x: width - 200,
                    y: height - 200,
                    w: 160,
                    h: 160,
                    radius: 12,
                  })
                }
              />
              <StudioAddButton
                icon={Store}
                label="Logo"
                onClick={() =>
                  addElement({ type: "logo", x: width / 2 - 70, y: 48, w: 140, h: 140 })
                }
              />
              <StudioAddButton
                icon={UtensilsCrossed}
                label="Menu title"
                onClick={() =>
                  addElement({
                    type: "menuName",
                    x: width / 2 - 420,
                    y: 90,
                    w: 840,
                    h: 110,
                    fontSize: 84,
                    fontWeight: 700,
                    fontFamily: "grotesk",
                    color: "#1F2933",
                    align: "center",
                  })
                }
              />
            </div>
            <input
              ref={imgFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                const url = await uploadStudioImage(f);
                if (url) {
                  addElement({
                    type: "image",
                    url,
                    x: width / 2 - 240,
                    y: height / 2 - 160,
                    w: 480,
                    h: 320,
                    radius: 16,
                    opacity: 100,
                  });
                }
              }}
            />
            <input
              ref={mediaFileRef}
              type="file"
              accept="image/gif"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f || !restaurant) return;
                try {
                  const uploaded = await uploadMenuMedia(restaurant.id, f);
                  addElement({
                    type: "gif",
                    url: uploaded.url,
                    x: width / 2 - 240,
                    y: height / 2 - 160,
                    w: 480,
                    h: 320,
                    radius: 16,
                    opacity: 100,
                  });
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Upload failed");
                }
              }}
            />
            <input
              ref={videoFileRef}
              type="file"
              accept="video/mp4,video/webm"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f || !restaurant) return;
                try {
                  const uploaded = await uploadMenuMedia(restaurant.id, f);
                  addElement({
                    type: "video",
                    url: uploaded.url,
                    loop: true,
                    muted: true,
                    x: 0,
                    y: 0,
                    w: width,
                    h: height,
                    radius: 0,
                    opacity: 100,
                  });
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Upload failed");
                }
              }}
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
              Menu sections
            </p>
            <div className="space-y-1.5">
              {sections.map((s) => (
                <button
                  key={s.id}
                  className="flex w-full items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-left text-sm text-white/80 transition-colors hover:border-brand hover:text-white"
                  onClick={() =>
                    addElement({
                      type: "section",
                      sectionId: s.id,
                      x: width / 2 - 280,
                      y: height / 2 - 200,
                      w: 560,
                      h: 420,
                      itemFontSize: 28,
                      titleColor: config.accent,
                      textColor: "#1F2933",
                      mutedColor: "#52606D",
                      priceColor: "#1F2933",
                      showTitle: true,
                      showDesc: true,
                      showPrice: true,
                      fontFamily: "poppins",
                    })
                  }
                >
                  <LayoutList size={14} className="shrink-0 text-brand" />
                  <span className="truncate">{s.name}</span>
                  <Plus size={13} className="ml-auto shrink-0 text-white/40" />
                </button>
              ))}
              {sections.length === 0 && (
                <p className="text-xs text-white/40">No sections yet — add them in the editor.</p>
              )}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-white/35">
              Section blocks stay linked to your menu — prices and items update
              live on screens.
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
              Background
            </p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.background ?? "#ffffff"}
                onChange={(e) => patchCfg({ background: e.target.value })}
                className="h-8 w-8 cursor-pointer rounded-lg border border-white/20 bg-transparent p-0.5"
              />
              {config.background && (
                <button className="btn-ghost px-2 py-1 text-xs text-white/60 hover:bg-white/10 hover:text-white" onClick={() => patchCfg({ background: null })}>
                  Reset
                </button>
              )}
              <button
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-white/80 transition-colors hover:border-brand"
                onClick={() => bgFileRef.current?.click()}
              >
                <ImagePlus size={13} /> Photo
              </button>
            </div>
            {config.backgroundImage && (
              <div className="mt-2 space-y-2">
                <img src={config.backgroundImage} alt="" className="h-16 w-full rounded-lg object-cover" />
                <label className="flex items-center gap-2 text-[11px] text-white/60">
                  Dim
                  <input
                    type="range"
                    min={0}
                    max={80}
                    value={config.backgroundOverlay}
                    onChange={(e) => patchCfg({ backgroundOverlay: Number(e.target.value) })}
                    className="flex-1 accent-brand"
                  />
                  {config.backgroundOverlay}%
                </label>
                <button className="w-full rounded-lg py-1 text-xs text-alert hover:bg-alert/10" onClick={() => patchCfg({ backgroundImage: null })}>
                  Remove photo
                </button>
              </div>
            )}
            <input
              ref={bgFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                const url = await uploadStudioImage(f, true);
                if (url) patchCfg({ backgroundImage: url });
              }}
            />
          </div>
        </aside>

        {/* canvas */}
        <div ref={stageRef} className="min-w-0 flex-1 overflow-auto">
          <div
            className="flex min-h-full items-center justify-center p-10"
            onPointerDown={() => setSelectedId(null)}
          >
            <div
              className="relative shrink-0 shadow-2xl"
              style={{ width: width * scale, height: height * scale }}
            >
              <div
                style={{
                  width,
                  height,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  position: "absolute",
                  inset: 0,
                  background: config.backgroundImage ? "#111" : (config.background ?? "#FFFFFF"),
                  overflow: "hidden",
                }}
              >
                {config.backgroundImage && (
                  <>
                    <img
                      src={config.backgroundImage}
                      alt=""
                      draggable={false}
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: `rgba(10,13,18,${config.backgroundOverlay / 100})`,
                      }}
                    />
                  </>
                )}
                {doc.elements.map((el) => (
                  <ElementFrame
                    key={el.id}
                    el={el}
                    data={data}
                    scale={scale}
                    canvasW={width}
                    canvasH={height}
                    selected={el.id === selectedId}
                    onSelect={() => setSelectedId(el.id)}
                    onDrag={(patch) => updateEl(el.id, patch, false)}
                    onCommit={() => scheduleSave()}
                    onGuides={setGuides}
                    onDoubleClick={() => {
                      if (el.type === "text") {
                        requestAnimationFrame(() =>
                          (document.getElementById("studio-text") as HTMLTextAreaElement | null)?.focus()
                        );
                      }
                    }}
                  />
                ))}
                {guides.v && (
                  <div
                    style={{
                      position: "absolute",
                      left: width / 2,
                      top: 0,
                      bottom: 0,
                      width: 2 / scale,
                      background: "#FF6B2C",
                    }}
                  />
                )}
                {guides.h && (
                  <div
                    style={{
                      position: "absolute",
                      top: height / 2,
                      left: 0,
                      right: 0,
                      height: 2 / scale,
                      background: "#FF6B2C",
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* right panel: properties */}
        <aside className="w-72 shrink-0 overflow-y-auto border-l border-white/10 bg-[#1A2026] p-4 text-white">
          {!selected ? (
            <div className="mt-8 text-center text-sm text-white/40">
              <p className="font-medium text-white/60">Nothing selected</p>
              <p className="mt-2 leading-relaxed">
                Click an element to edit it. Drag to move, pull the handles to
                resize, arrow keys to nudge, Delete to remove.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                  {labelFor(selected.type)}
                </p>
                <div className="flex gap-1">
                  <PanelIcon icon={SendToBack} title="Send backward" disabled={selectedIndex <= 0} onClick={() => moveLayer(-1)} />
                  <PanelIcon icon={BringToFront} title="Bring forward" disabled={selectedIndex >= doc.elements.length - 1} onClick={() => moveLayer(1)} />
                  <PanelIcon icon={Copy} title="Duplicate" onClick={duplicateSelected} />
                  <PanelIcon icon={Trash2} title="Delete" danger onClick={deleteSelected} />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    ["x", "X"],
                    ["y", "Y"],
                    ["w", "W"],
                    ["h", "H"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="text-[10px] font-medium uppercase text-white/40">
                    {label}
                    <input
                      type="number"
                      className="mt-0.5 w-full rounded-lg border border-white/15 bg-transparent px-1.5 py-1 text-xs text-white outline-none focus:border-brand"
                      value={Math.round(selected[key])}
                      onChange={(e) => updateEl(selected.id, { [key]: Number(e.target.value) || 0 })}
                    />
                  </label>
                ))}
              </div>

              {selected.type === "text" && (
                <label className="block text-xs font-medium text-white/60">
                  Text
                  <textarea
                    id="studio-text"
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-transparent px-2 py-1.5 text-sm text-white outline-none focus:border-brand"
                    value={selected.text ?? ""}
                    onChange={(e) => updateEl(selected.id, { text: e.target.value })}
                  />
                </label>
              )}

              {(selected.type === "text" ||
                selected.type === "menuName" ||
                selected.type === "restaurantName" ||
                selected.type === "section") && (
                <label className="block text-xs font-medium text-white/60">
                  Font
                  <select
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#1A2026] px-2 py-1.5 text-sm text-white outline-none focus:border-brand"
                    value={selected.fontFamily ?? "poppins"}
                    onChange={(e) => updateEl(selected.id, { fontFamily: e.target.value as StudioFont })}
                  >
                    {FONT_OPTIONS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {(selected.type === "text" ||
                selected.type === "menuName" ||
                selected.type === "restaurantName") && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs font-medium text-white/60">
                      Size
                      <input
                        type="number"
                        className="mt-1 w-full rounded-lg border border-white/15 bg-transparent px-2 py-1.5 text-sm text-white outline-none focus:border-brand"
                        value={selected.fontSize ?? 28}
                        onChange={(e) => updateEl(selected.id, { fontSize: Number(e.target.value) || 12 })}
                      />
                    </label>
                    <label className="text-xs font-medium text-white/60">
                      Weight
                      <select
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#1A2026] px-2 py-1.5 text-sm text-white outline-none focus:border-brand"
                        value={selected.fontWeight ?? 500}
                        onChange={(e) =>
                          updateEl(selected.id, { fontWeight: Number(e.target.value) as 400 | 500 | 600 | 700 })
                        }
                      >
                        {[400, 500, 600, 700].map((w) => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <ColorField label="Color" value={selected.color ?? "#1F2933"} onChange={(v) => updateEl(selected.id, { color: v })} />
                    <div className="ml-auto flex gap-1">
                      {(["left", "center", "right"] as const).map((a) => (
                        <button
                          key={a}
                          onClick={() => updateEl(selected.id, { align: a })}
                          className={`rounded-lg px-2 py-1 text-xs capitalize ${
                            (selected.align ?? "left") === a
                              ? "bg-brand text-white"
                              : "text-white/50 hover:bg-white/10"
                          }`}
                        >
                          {a[0].toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {selected.type === "shape" && (
                <>
                  <ColorField label="Fill" value={selected.fill ?? "#FF6B2C"} onChange={(v) => updateEl(selected.id, { fill: v })} />
                  <RangeField label="Corner radius" min={0} max={200} value={selected.radius ?? 16} onChange={(v) => updateEl(selected.id, { radius: v })} />
                  <RangeField label="Opacity" min={5} max={100} value={selected.opacity ?? 100} onChange={(v) => updateEl(selected.id, { opacity: v })} suffix="%" />
                </>
              )}

              {selected.type === "image" && (
                <>
                  <RangeField label="Corner radius" min={0} max={200} value={selected.radius ?? 12} onChange={(v) => updateEl(selected.id, { radius: v })} />
                  <RangeField label="Opacity" min={5} max={100} value={selected.opacity ?? 100} onChange={(v) => updateEl(selected.id, { opacity: v })} suffix="%" />
                </>
              )}

              {(selected.type === "gif" || selected.type === "video") && (
                <>
                  <RangeField label="Corner radius" min={0} max={200} value={selected.radius ?? 12} onChange={(v) => updateEl(selected.id, { radius: v })} />
                  <RangeField label="Opacity" min={5} max={100} value={selected.opacity ?? 100} onChange={(v) => updateEl(selected.id, { opacity: v })} suffix="%" />
                  {selected.type === "video" && (
                    <>
                      <Toggle dark label="Loop" checked={selected.loop !== false} onChange={(v) => updateEl(selected.id, { loop: v })} />
                      <Toggle dark label="Muted" checked={selected.muted !== false} onChange={(v) => updateEl(selected.id, { muted: v })} />
                    </>
                  )}
                </>
              )}

              {selected.type === "qrCode" && (
                <label className="block text-xs font-medium text-white/60">
                  Link URL
                  <input
                    className="mt-1 w-full rounded-lg border border-white/15 bg-transparent px-2 py-1.5 text-sm text-white outline-none focus:border-brand"
                    placeholder="https://your-order-link.com"
                    value={selected.linkUrl ?? ""}
                    onChange={(e) => updateEl(selected.id, { linkUrl: e.target.value })}
                  />
                </label>
              )}

              {selected.type === "section" && (
                <>
                  <label className="block text-xs font-medium text-white/60">
                    Linked section
                    <select
                      className="mt-1 w-full rounded-lg border border-white/15 bg-[#1A2026] px-2 py-1.5 text-sm text-white outline-none focus:border-brand"
                      value={selected.sectionId ?? ""}
                      onChange={(e) => updateEl(selected.id, { sectionId: e.target.value })}
                    >
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-white/60">
                    Item size
                    <input
                      type="number"
                      className="mt-1 w-full rounded-lg border border-white/15 bg-transparent px-2 py-1.5 text-sm text-white outline-none focus:border-brand"
                      value={selected.itemFontSize ?? 28}
                      onChange={(e) => updateEl(selected.id, { itemFontSize: Number(e.target.value) || 16 })}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <ColorField label="Title" value={selected.titleColor ?? "#FF6B2C"} onChange={(v) => updateEl(selected.id, { titleColor: v })} />
                    <ColorField label="Items" value={selected.textColor ?? "#1F2933"} onChange={(v) => updateEl(selected.id, { textColor: v })} />
                    <ColorField label="Details" value={selected.mutedColor ?? "#52606D"} onChange={(v) => updateEl(selected.id, { mutedColor: v })} />
                    <ColorField label="Prices" value={selected.priceColor ?? "#1F2933"} onChange={(v) => updateEl(selected.id, { priceColor: v })} />
                  </div>
                  <div className="space-y-2">
                    <Toggle dark label="Section title" checked={selected.showTitle ?? true} onChange={(v) => updateEl(selected.id, { showTitle: v })} />
                    <Toggle dark label="Descriptions" checked={selected.showDesc ?? true} onChange={(v) => updateEl(selected.id, { showDesc: v })} />
                    <Toggle dark label="Prices" checked={selected.showPrice ?? true} onChange={(v) => updateEl(selected.id, { showPrice: v })} />
                  </div>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Canvas element wrapper: drag, resize, snap                          */
/* ------------------------------------------------------------------ */

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type Handle = (typeof HANDLES)[number];

const CURSORS: Record<Handle, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
};

function ElementFrame({
  el,
  data,
  scale,
  canvasW,
  canvasH,
  selected,
  onSelect,
  onDrag,
  onCommit,
  onGuides,
  onDoubleClick,
}: {
  el: StudioElement;
  data: Parameters<typeof StudioElementView>[0]["data"];
  scale: number;
  canvasW: number;
  canvasH: number;
  selected: boolean;
  onSelect: () => void;
  onDrag: (patch: Partial<StudioElement>) => void;
  onCommit: () => void;
  onGuides: (g: { v: boolean; h: boolean }) => void;
  onDoubleClick: () => void;
}) {
  function start(e: React.PointerEvent, mode: "move" | Handle) {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    const origin = { px: e.clientX, py: e.clientY, x: el.x, y: el.y, w: el.w, h: el.h };
    const snapAt = 10;

    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - origin.px) / scale;
      const dy = (ev.clientY - origin.py) / scale;
      let { x, y, w, h } = origin;
      if (mode === "move") {
        x += dx;
        y += dy;
        let gv = false;
        let gh = false;
        if (Math.abs(x + w / 2 - canvasW / 2) < snapAt) {
          x = canvasW / 2 - w / 2;
          gv = true;
        }
        if (Math.abs(y + h / 2 - canvasH / 2) < snapAt) {
          y = canvasH / 2 - h / 2;
          gh = true;
        }
        if (Math.abs(x) < snapAt) x = 0;
        if (Math.abs(y) < snapAt) y = 0;
        if (Math.abs(x + w - canvasW) < snapAt) x = canvasW - w;
        if (Math.abs(y + h - canvasH) < snapAt) y = canvasH - h;
        onGuides({ v: gv, h: gh });
      } else {
        if (mode.includes("e")) w = Math.max(40, origin.w + dx);
        if (mode.includes("s")) h = Math.max(24, origin.h + dy);
        if (mode.includes("w")) {
          w = Math.max(40, origin.w - dx);
          x = origin.x + (origin.w - w);
        }
        if (mode.includes("n")) {
          h = Math.max(24, origin.h - dy);
          y = origin.y + (origin.h - h);
        }
      }
      onDrag({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      onGuides({ v: false, h: false });
      onCommit();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const hs = 12 / scale;
  const half = hs / 2;
  const pos: Record<Handle, React.CSSProperties> = {
    nw: { left: -half, top: -half },
    n: { left: "50%", top: -half, marginLeft: -half },
    ne: { right: -half, top: -half },
    e: { right: -half, top: "50%", marginTop: -half },
    se: { right: -half, bottom: -half },
    s: { left: "50%", bottom: -half, marginLeft: -half },
    sw: { left: -half, bottom: -half },
    w: { left: -half, top: "50%", marginTop: -half },
  };

  return (
    <div
      style={{
        position: "absolute",
        left: el.x,
        top: el.y,
        width: el.w,
        height: el.h,
        cursor: "move",
        outline: selected ? `${2 / scale}px solid #FF6B2C` : undefined,
        outlineOffset: 2 / scale,
      }}
      onPointerDown={(e) => start(e, "move")}
      onDoubleClick={onDoubleClick}
    >
      <StudioElementView el={el} data={data} editing />
      {selected &&
        HANDLES.map((handle) => (
          <div
            key={handle}
            onPointerDown={(e) => start(e, handle)}
            style={{
              position: "absolute",
              width: hs,
              height: hs,
              background: "#FFFFFF",
              border: `${1.5 / scale}px solid #FF6B2C`,
              borderRadius: 3 / scale,
              cursor: CURSORS[handle],
              ...pos[handle],
            }}
          />
        ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small panel widgets                                                  */
/* ------------------------------------------------------------------ */

function labelFor(type: StudioElement["type"]) {
  switch (type) {
    case "text":
      return "Text";
    case "shape":
      return "Shape";
    case "image":
      return "Photo";
    case "logo":
      return "Logo";
    case "menuName":
      return "Menu title";
    case "restaurantName":
      return "Shop name";
    case "section":
      return "Menu section";
    case "gif":
      return "GIF";
    case "video":
      return "Video";
    case "qrCode":
      return "QR code";
  }
}

function StudioAddButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 px-2 py-3 text-xs text-white/70 transition-colors hover:border-brand hover:text-white"
    >
      <Icon size={18} className="text-brand" />
      {label}
    </button>
  );
}

function PanelIcon({
  icon: Icon,
  title,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ComponentType<{ size?: number | string }>;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg p-1.5 transition-colors disabled:opacity-30 ${
        danger ? "text-alert hover:bg-alert/15" : "text-white/60 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon size={15} />
    </button>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-white/60">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-7 cursor-pointer rounded-md border border-white/20 bg-transparent p-0.5"
      />
      {label}
    </label>
  );
}

function RangeField({
  label,
  min,
  max,
  value,
  onChange,
  suffix = "",
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <label className="block text-xs font-medium text-white/60">
      {label}
      <span className="float-right text-white/40">
        {value}
        {suffix}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-brand"
      />
    </label>
  );
}

