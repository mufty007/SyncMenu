import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  Expand,
  ImagePlus,
  Plus,
  QrCode,
  Star,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import {
  DEFAULT_TEMPLATE_CONFIG,
  DIETARY_TAGS,
  type HeadingFont,
  type Menu,
  type MenuItem,
  type MenuSection,
  type Orientation,
  type TemplateConfig,
  type TemplateId,
} from "../../lib/types";
import MenuBoard, { TEMPLATES, boardDimensions } from "../../templates/MenuBoard";
import { TAG_ICONS } from "../../templates/shared";
import ScaledFrame from "../../components/ScaledFrame";
import Toggle from "../../components/Toggle";
import { deleteMenuImageUrl, uploadMenuImage } from "../../lib/uploadImage";

type SectionWithItems = MenuSection & { items: MenuItem[] };

const ACCENT_SWATCHES = ["#FF6B2C", "#E5484D", "#22B573", "#2563EB", "#7C3AED", "#FFB020"];

export default function MenuEditorPage() {
  const { menuId } = useParams();
  const { restaurant } = useAuth();
  const navigate = useNavigate();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [sections, setSections] = useState<SectionWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const bgFileRef = useRef<HTMLInputElement>(null);

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
      setMenu((m as Menu) ?? null);
      setSections(((secs as SectionWithItems[]) ?? []).map((s) => ({
        ...s,
        items: (s.items ?? []).sort((a, b) => a.sort_order - b.sort_order),
      })));
      setLoading(false);
    })();
  }, [menuId]);

  if (loading) return <p className="text-sm text-smoke">Loading…</p>;
  if (!menu || !restaurant) {
    return (
      <div>
        <p className="text-sm text-smoke">Menu not found.</p>
        <Link to="/app/menus" className="btn-secondary mt-4">
          <ArrowLeft size={16} /> Back to menus
        </Link>
      </div>
    );
  }

  const config: TemplateConfig = { ...DEFAULT_TEMPLATE_CONFIG, ...menu.template_config };

  async function patchMenu(patch: Partial<Menu>) {
    setMenu((m) => (m ? { ...m, ...patch } : m));
    await supabase.from("menus").update(patch).eq("id", menu!.id);
  }

  function patchConfig(patch: Partial<TemplateConfig>) {
    void patchMenu({ template_config: { ...config, ...patch } });
  }

  async function uploadBackground(file: File) {
    try {
      const path = `${restaurant!.id}/board-bg-${Date.now()}.jpg`;
      const publicUrl = await uploadMenuImage(path, file);
      void deleteMenuImageUrl(config.backgroundImage);
      patchConfig({ backgroundImage: publicUrl });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function deleteMenu() {
    if (!confirm(`Delete "${menu!.name}"? Screens showing it will go blank.`)) return;
    await supabase.from("menus").delete().eq("id", menu!.id);
    navigate("/app/menus");
  }

  /* ---------------- sections ---------------- */

  async function addSection() {
    const sort = sections.length ? Math.max(...sections.map((s) => s.sort_order)) + 1 : 0;
    const { data } = await supabase
      .from("menu_sections")
      .insert({ menu_id: menu!.id, name: "New section", sort_order: sort })
      .select()
      .single();
    if (data) setSections((s) => [...s, { ...(data as MenuSection), items: [] }]);
  }

  async function renameSection(id: string, name: string) {
    setSections((s) => s.map((x) => (x.id === id ? { ...x, name } : x)));
    await supabase.from("menu_sections").update({ name }).eq("id", id);
  }

  async function deleteSection(section: SectionWithItems) {
    if (section.items.length > 0 && !confirm(`Delete "${section.name}" and its ${section.items.length} item(s)?`)) {
      return;
    }
    setSections((s) => s.filter((x) => x.id !== section.id));
    await supabase.from("menu_sections").delete().eq("id", section.id);
  }

  async function moveSection(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    const next = sections.slice();
    [next[index], next[target]] = [next[target], next[index]];
    const reordered = next.map((s, i) => ({ ...s, sort_order: i }));
    setSections(reordered);
    await Promise.all(
      reordered.map((s) =>
        supabase.from("menu_sections").update({ sort_order: s.sort_order }).eq("id", s.id)
      )
    );
  }

  /* ---------------- items ---------------- */

  function setItem(sectionId: string, itemId: string, patch: Partial<MenuItem>) {
    setSections((s) =>
      s.map((sec) =>
        sec.id === sectionId
          ? { ...sec, items: sec.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }
          : sec
      )
    );
  }

  async function addItem(section: SectionWithItems) {
    const sort = section.items.length
      ? Math.max(...section.items.map((i) => i.sort_order)) + 1
      : 0;
    const { data } = await supabase
      .from("menu_items")
      .insert({ section_id: section.id, name: "New item", price: 0, sort_order: sort })
      .select()
      .single();
    if (data) {
      setSections((s) =>
        s.map((sec) =>
          sec.id === section.id ? { ...sec, items: [...sec.items, data as MenuItem] } : sec
        )
      );
    }
  }

  async function saveItem(sectionId: string, itemId: string, patch: Partial<MenuItem>) {
    setItem(sectionId, itemId, patch);
    await supabase.from("menu_items").update(patch).eq("id", itemId);
  }

  async function deleteItem(sectionId: string, itemId: string) {
    setSections((s) =>
      s.map((sec) =>
        sec.id === sectionId ? { ...sec, items: sec.items.filter((i) => i.id !== itemId) } : sec
      )
    );
    await supabase.from("menu_items").delete().eq("id", itemId);
  }

  async function moveItem(section: SectionWithItems, index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= section.items.length) return;
    const next = section.items.slice();
    [next[index], next[target]] = [next[target], next[index]];
    const reordered = next.map((i, idx) => ({ ...i, sort_order: idx }));
    setSections((s) =>
      s.map((sec) => (sec.id === section.id ? { ...sec, items: reordered } : sec))
    );
    await Promise.all(
      reordered.map((i) =>
        supabase.from("menu_items").update({ sort_order: i.sort_order }).eq("id", i.id)
      )
    );
  }

  async function uploadItemImage(sectionId: string, itemId: string, file: File) {
    try {
      const path = `${restaurant!.id}/${itemId}-${Date.now()}.jpg`;
      const publicUrl = await uploadMenuImage(path, file);
      await saveItem(sectionId, itemId, { image_url: publicUrl });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    }
  }

  const { width, height } = boardDimensions(menu.orientation);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/app/menus" className="btn-ghost">
          <ArrowLeft size={16} />
        </Link>
        <input
          className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-1 text-2xl font-semibold outline-none transition-colors focus:border-mist focus:bg-white"
          value={menu.name}
          onChange={(e) => setMenu({ ...menu, name: e.target.value })}
          onBlur={(e) => void patchMenu({ name: e.target.value.trim() || "Untitled menu" })}
        />
        <button className="btn-secondary" onClick={() => setShowQr(true)} title="Customer QR menu">
          <QrCode size={16} /> QR menu
        </button>
        <button className="btn-secondary" onClick={() => setShowPreview(true)} title="Full-screen preview">
          <Expand size={16} /> Preview
        </button>
        <button className="btn-ghost text-alert hover:bg-alert/10 hover:text-alert" onClick={() => void deleteMenu()}>
          <Trash2 size={16} /> Delete
        </button>
      </div>

      {showPreview && (
        <PreviewModal onClose={() => setShowPreview(false)}>
          <MenuBoard
            data={{
              restaurantName: restaurant.name,
              logoUrl: restaurant.logo_url,
              currency: restaurant.currency,
              menuName: menu.name,
              sections,
            }}
            templateId={menu.template_id}
            config={config}
            orientation={menu.orientation}
          />
        </PreviewModal>
      )}
      {showQr && <QrModal menuId={menu.id} onClose={() => setShowQr(false)} />}

      <div className="mt-6 grid grid-cols-1 gap-8 xl:grid-cols-[1fr_420px]">
        {/* -------- content editor -------- */}
        <div className="space-y-5">
          {sections.map((section, si) => (
            <div key={section.id} className="card p-5">
              <div className="flex items-center gap-2">
                <input
                  className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-semibold outline-none focus:border-mist"
                  value={section.name}
                  onChange={(e) =>
                    setSections((s) =>
                      s.map((x) => (x.id === section.id ? { ...x, name: e.target.value } : x))
                    )
                  }
                  onBlur={(e) => void renameSection(section.id, e.target.value.trim() || "Section")}
                />
                <button className="btn-ghost px-2" onClick={() => void moveSection(si, -1)} disabled={si === 0} title="Move up">
                  <ArrowUp size={15} />
                </button>
                <button className="btn-ghost px-2" onClick={() => void moveSection(si, 1)} disabled={si === sections.length - 1} title="Move down">
                  <ArrowDown size={15} />
                </button>
                <button className="btn-ghost px-2 text-alert hover:bg-alert/10 hover:text-alert" onClick={() => void deleteSection(section)} title="Delete section">
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {section.items.map((item, ii) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    currency={restaurant.currency}
                    onSave={(patch) => void saveItem(section.id, item.id, patch)}
                    onDelete={() => void deleteItem(section.id, item.id)}
                    onMoveUp={ii > 0 ? () => void moveItem(section, ii, -1) : undefined}
                    onMoveDown={ii < section.items.length - 1 ? () => void moveItem(section, ii, 1) : undefined}
                    onImage={(file) => void uploadItemImage(section.id, item.id, file)}
                  />
                ))}
              </div>
              <button className="btn-ghost mt-3 text-brand hover:bg-brand/10 hover:text-brand" onClick={() => void addItem(section)}>
                <Plus size={15} /> Add item
              </button>
            </div>
          ))}
          <button className="btn-secondary w-full" onClick={() => void addSection()}>
            <Plus size={16} /> Add section
          </button>
        </div>

        {/* -------- design panel + preview -------- */}
        <div className="space-y-5 xl:sticky xl:top-8 xl:self-start">
          <div className="card overflow-hidden p-3">
            <ScaledFrame designWidth={width} designHeight={height} className="rounded-lg">
              <MenuBoard
                data={{
                  restaurantName: restaurant.name,
                  logoUrl: restaurant.logo_url,
                  currency: restaurant.currency,
                  menuName: menu.name,
                  sections,
                }}
                templateId={menu.template_id}
                config={config}
                orientation={menu.orientation}
              />
            </ScaledFrame>
          </div>

          <div className="card space-y-5 p-5">
            <div>
              <p className="label">Template</p>
              <div className="space-y-2">
                {TEMPLATES.map((t) => {
                  const current = TEMPLATES.find((x) => x.id === menu.template_id);
                  const accentUntouched =
                    config.accent.toLowerCase() ===
                    (current?.defaultAccent ?? "#ff6b2c").toLowerCase();
                  return (
                    <button
                      key={t.id}
                      onClick={() =>
                        void patchMenu({
                          template_id: t.id as TemplateId,
                          // follow the template's signature accent unless customized
                          ...(accentUntouched
                            ? { template_config: { ...config, accent: t.defaultAccent } }
                            : {}),
                        })
                      }
                      className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors ${
                        menu.template_id === t.id
                          ? "border-brand bg-brand/5"
                          : "border-mist hover:border-smoke/40"
                      }`}
                    >
                      <div className="w-[104px] shrink-0 overflow-hidden rounded-lg border border-mist/60">
                        <ScaledFrame designWidth={1920} designHeight={1080}>
                          <MenuBoard
                            data={{
                              restaurantName: restaurant.name,
                              logoUrl: restaurant.logo_url,
                              currency: restaurant.currency,
                              menuName: menu.name,
                              sections,
                            }}
                            templateId={t.id}
                            config={{
                              ...config,
                              accent: accentUntouched ? t.defaultAccent : config.accent,
                            }}
                            orientation="landscape"
                          />
                        </ScaledFrame>
                      </div>
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-semibold ${
                            menu.template_id === t.id ? "text-brand" : "text-ink"
                          }`}
                        >
                          {t.name}
                        </p>
                        <p className="mt-0.5 text-xs leading-snug text-smoke">{t.blurb}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="label">Orientation</p>
              <div className="grid grid-cols-2 gap-2">
                {(["landscape", "portrait"] as Orientation[]).map((o) => (
                  <button
                    key={o}
                    onClick={() => void patchMenu({ orientation: o })}
                    className={`rounded-xl border px-2 py-2.5 text-sm font-medium capitalize transition-colors ${
                      menu.orientation === o
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-mist text-smoke hover:border-smoke/40"
                    }`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="label">Accent color</p>
              <div className="flex items-center gap-2">
                {ACCENT_SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => patchConfig({ accent: c })}
                    className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      config.accent.toLowerCase() === c.toLowerCase()
                        ? "border-ink"
                        : "border-transparent"
                    }`}
                    style={{ background: c }}
                    aria-label={`Accent ${c}`}
                  />
                ))}
                <input
                  type="color"
                  value={config.accent}
                  onChange={(e) => patchConfig({ accent: e.target.value })}
                  className="h-8 w-8 cursor-pointer rounded-full border border-mist p-0.5"
                  aria-label="Custom accent color"
                />
              </div>
            </div>

            {(menu.template_id === "classic" || menu.template_id === "bold") && (
              <Choice
                label="Theme"
                value={config.theme}
                options={[
                  ["light", "Light"],
                  ["dark", "Dark"],
                ]}
                onChange={(v) => patchConfig({ theme: v })}
              />
            )}

            {menu.template_id === "custom" && (
              <div className="rounded-xl border border-brand/30 bg-brand/[0.03] p-4">
                <p className="text-sm font-semibold">Freeform canvas</p>
                <p className="mt-1 text-xs leading-relaxed text-smoke">
                  Design this board from scratch — drag and drop text, photos,
                  shapes, your logo and live menu sections anywhere you want.
                </p>
                <Link to={`/studio/${menu.id}`} className="btn-primary mt-3 w-full">
                  <Wand2 size={15} /> Enter Studio
                </Link>
              </div>
            )}

            <div>
              <p className="label">Heading font</p>
              <select
                className="input"
                value={config.headingFont}
                onChange={(e) => patchConfig({ headingFont: e.target.value as HeadingFont })}
              >
                <option value="auto">Template default</option>
                <option value="poppins">Poppins</option>
                <option value="grotesk">Space Grotesk</option>
                <option value="bebas">Bebas Neue — condensed</option>
                <option value="fraunces">Fraunces — serif</option>
                <option value="caveat">Caveat — handwritten</option>
              </select>
            </div>

            <div>
              <p className="label">Background</p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.background ?? "#ffffff"}
                  onChange={(e) => patchConfig({ background: e.target.value })}
                  className="h-9 w-9 cursor-pointer rounded-lg border border-mist bg-white p-0.5"
                  aria-label="Background color"
                />
                {config.background && (
                  <button className="btn-ghost px-2 py-1 text-xs" onClick={() => patchConfig({ background: null })}>
                    Reset color
                  </button>
                )}
                <button
                  className="btn-secondary ml-auto px-3 py-1.5 text-xs"
                  onClick={() => bgFileRef.current?.click()}
                >
                  <ImagePlus size={14} /> {config.backgroundImage ? "Change photo" : "Photo"}
                </button>
              </div>
              {config.backgroundImage && (
                <div className="mt-3 space-y-2">
                  <img
                    src={config.backgroundImage}
                    alt="Board background"
                    className="h-20 w-full rounded-lg object-cover"
                  />
                  <label className="flex items-center gap-3 text-xs font-medium text-smoke">
                    Dim
                    <input
                      type="range"
                      min={0}
                      max={80}
                      value={config.backgroundOverlay}
                      onChange={(e) => patchConfig({ backgroundOverlay: Number(e.target.value) })}
                      className="flex-1 accent-brand"
                    />
                    {config.backgroundOverlay}%
                  </label>
                  <button
                    className="btn-ghost w-full py-1.5 text-xs text-alert hover:bg-alert/10 hover:text-alert"
                    onClick={() => patchConfig({ backgroundImage: null })}
                  >
                    Remove photo
                  </button>
                </div>
              )}
              <input
                ref={bgFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadBackground(f);
                  e.target.value = "";
                }}
              />
            </div>

            <div>
              <p className="label">Text size</p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["cozy", "Bigger"],
                    ["standard", "Standard"],
                    ["compact", "Compact"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => patchConfig({ density: value })}
                    className={`rounded-xl border px-2 py-2.5 text-sm font-medium transition-colors ${
                      config.density === value
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-mist text-smoke hover:border-smoke/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-smoke">
                Bigger reads from further away; compact fits more items.
              </p>
            </div>

            <div>
              <p className="label">Columns</p>
              <div className="grid grid-cols-4 gap-2">
                {(["auto", 1, 2, 3] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => patchConfig({ columns: c })}
                    className={`rounded-xl border px-2 py-2.5 text-sm font-medium capitalize transition-colors ${
                      config.columns === c
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-mist text-smoke hover:border-smoke/40"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Toggle
                label="Show descriptions"
                checked={config.showDescriptions}
                onChange={(v) => patchConfig({ showDescriptions: v })}
              />
              <Toggle
                label="Show item photos"
                checked={config.showImages}
                onChange={(v) => patchConfig({ showImages: v })}
              />
              <Toggle
                label="Show prices"
                checked={config.showPrices}
                onChange={(v) => patchConfig({ showPrices: v })}
              />
              <Toggle
                label="Show logo"
                checked={config.showLogo}
                onChange={(v) => patchConfig({ showLogo: v })}
              />
            </div>

            <div>
              <p className="label">Bottom bar</p>
              <input
                className="input"
                placeholder="e.g. Free wifi: BigBite — Ask about our meal deals!"
                defaultValue={config.footerText}
                onBlur={(e) => {
                  if (e.target.value !== config.footerText) {
                    patchConfig({ footerText: e.target.value });
                  }
                }}
              />
              <div className="mt-3">
                <Toggle
                  label="Scroll like a ticker"
                  checked={config.footerTicker}
                  onChange={(v) => patchConfig({ footerTicker: v })}
                />
              </div>
            </div>

            <div>
              <p className="label">Featured badge text</p>
              <input
                className="input"
                placeholder="Popular"
                defaultValue={config.badgeText}
                onBlur={(e) => {
                  if (e.target.value !== config.badgeText) {
                    patchConfig({ badgeText: e.target.value });
                  }
                }}
              />
              <p className="mt-1.5 text-xs text-smoke">
                Star an item in the list to feature it on the board.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(([v, l]) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`flex-1 rounded-xl border px-2 py-2 text-sm font-medium transition-colors ${
              value === v
                ? "border-brand bg-brand/10 text-brand"
                : "border-mist text-smoke hover:border-smoke/40"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function PreviewModal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black" onClick={onClose}>
      <PreviewScaler vp={vp}>{children}</PreviewScaler>
      <button
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
        onClick={onClose}
        title="Close (Esc)"
      >
        <X size={20} />
      </button>
    </div>
  );
}

function PreviewScaler({
  vp,
  children,
}: {
  vp: { w: number; h: number };
  children: React.ReactNode;
}) {
  // the child MenuBoard renders at native board resolution; measure it via its orientation
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1920, h: 1080 });

  useEffect(() => {
    const el = ref.current?.firstElementChild as HTMLElement | null;
    if (el) setSize({ w: el.offsetWidth, h: el.offsetHeight });
  }, [children]);

  const scale = Math.min(vp.w / size.w, vp.h / size.h);
  return (
    <div
      ref={ref}
      style={{ transform: `scale(${scale})`, transformOrigin: "center", flexShrink: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

function QrModal({ menuId, onClose }: { menuId: string; onClose: () => void }) {
  const url = `${window.location.origin}/m/${menuId}`;
  const [copied, setCopied] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-6"
      onClick={onClose}
    >
      <div className="card w-full max-w-sm p-7 text-center" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Customer QR menu</h2>
        <p className="mt-1 text-sm text-smoke">
          Print this for tables or the counter — customers scan it to browse
          this menu on their phone. It always shows the latest version.
        </p>
        <div className="mx-auto mt-5 w-fit rounded-2xl border-4 border-brand bg-white p-4">
          <QRCodeSVG value={url} size={180} />
        </div>
        <button
          className="btn-secondary mt-5 w-full"
          onClick={() => {
            void navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          <Copy size={15} /> {copied ? "Copied!" : "Copy link"}
        </button>
        <button className="btn-ghost mt-2 w-full" onClick={onClose}>
          Close
        </button>
        <p className="mt-3 border-t border-mist pt-3 text-xs text-smoke">
          Want one QR for your whole restaurant — all menus, ordering links and
          socials?{" "}
          <Link to="/app/public" className="font-medium text-brand">
            Set up your public page
          </Link>
        </p>
      </div>
    </div>
  );
}

function ItemRow({
  item,
  currency,
  onSave,
  onDelete,
  onMoveUp,
  onMoveDown,
  onImage,
}: {
  item: MenuItem;
  currency: string;
  onSave: (patch: Partial<MenuItem>) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onImage: (file: File) => void;
}) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description);
  const [price, setPrice] = useState(String(item.price));
  const [calories, setCalories] = useState(item.calories != null ? String(item.calories) : "");
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-mist/70 p-3 transition-opacity ${
        item.available ? "" : "opacity-50"
      }`}
    >
      <button
        className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-mist bg-cloud"
        onClick={() => fileRef.current?.click()}
        title="Upload photo"
      >
        {item.image_url ? (
          <img src={item.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImagePlus size={18} className="mx-auto text-smoke" />
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImage(f);
          e.target.value = "";
        }}
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex gap-2">
          <input
            className="input py-1.5"
            value={name}
            placeholder="Item name"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name !== item.name && onSave({ name: name.trim() || "Item" })}
          />
          <div className="relative w-24 shrink-0">
            <input
              className="input py-1.5 text-right"
              value={price}
              inputMode="decimal"
              onChange={(e) => setPrice(e.target.value)}
              onBlur={() => {
                const parsed = parseFloat(price.replace(",", "."));
                const value = Number.isFinite(parsed) ? Math.max(0, parsed) : item.price;
                setPrice(String(value));
                if (value !== item.price) onSave({ price: value });
              }}
              aria-label={`Price (${currency})`}
            />
          </div>
          <div className="w-24 shrink-0">
            <input
              className="input py-1.5 text-right"
              value={calories}
              inputMode="numeric"
              placeholder="kcal"
              onChange={(e) => setCalories(e.target.value)}
              onBlur={() => {
                const parsed = parseInt(calories, 10);
                const value = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
                setCalories(value != null ? String(value) : "");
                if (value !== (item.calories ?? null)) onSave({ calories: value });
              }}
              aria-label="Calories per serving"
              title="Calories per serving (optional)"
            />
          </div>
        </div>
        <input
          className="input py-1.5 text-sm"
          value={description}
          placeholder="Description (optional)"
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== item.description && onSave({ description })}
        />
        <div className="flex flex-wrap gap-1 pt-0.5">
          {DIETARY_TAGS.map((tag) => {
            const active = (item.tags ?? []).includes(tag.id);
            const Icon = TAG_ICONS[tag.id];
            return (
              <button
                key={tag.id}
                type="button"
                title={tag.label}
                onClick={() =>
                  onSave({
                    tags: active
                      ? (item.tags ?? []).filter((t) => t !== tag.id)
                      : [...(item.tags ?? []), tag.id],
                  })
                }
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  active
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-mist text-smoke/70 hover:border-smoke/40"
                }`}
              >
                {Icon && <Icon size={11} strokeWidth={2.4} />}
                {tag.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Toggle
          label=""
          checked={item.available}
          onChange={(v) => onSave({ available: v })}
        />
        <div className="flex">
          <button
            className={`btn-ghost px-1.5 py-1 ${item.featured ? "text-amber hover:text-amber" : ""}`}
            onClick={() => onSave({ featured: !item.featured })}
            title={item.featured ? "Remove from featured" : "Feature this item"}
          >
            <Star size={14} className={item.featured ? "fill-amber" : ""} />
          </button>
          {onMoveUp && (
            <button className="btn-ghost px-1.5 py-1" onClick={onMoveUp} title="Move up">
              <ArrowUp size={14} />
            </button>
          )}
          {onMoveDown && (
            <button className="btn-ghost px-1.5 py-1" onClick={onMoveDown} title="Move down">
              <ArrowDown size={14} />
            </button>
          )}
          <button
            className="btn-ghost px-1.5 py-1 text-alert hover:bg-alert/10 hover:text-alert"
            onClick={onDelete}
            title="Delete item"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
