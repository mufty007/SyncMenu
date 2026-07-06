import { useMemo, useState } from "react";
import { Search, Star } from "lucide-react";
import { formatPrice } from "../lib/format";
import { TAG_ICONS } from "../templates/shared";
import { DIETARY_TAGS, type MenuItem, type MenuSection } from "../lib/types";

type SectionWithItems = MenuSection & { items: MenuItem[] };

/**
 * Customer-facing menu list with search, dietary-tag filters, and section
 * jump chips. Shared by the per-menu page (/m/:id) and the hub (/r/:id).
 */
export default function CustomerMenuList({
  sections,
  accent,
  currency,
  badgeText = "Popular",
}: {
  sections: SectionWithItems[];
  accent: string;
  currency: string;
  badgeText?: string;
}) {
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const prepared = useMemo(
    () =>
      sections
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((s) => ({
          ...s,
          items: s.items
            .filter((i) => i.available)
            .sort((a, b) => a.sort_order - b.sort_order),
        }))
        .filter((s) => s.items.length > 0),
    [sections]
  );

  // only offer tags that actually exist somewhere on this menu
  const availableTags = useMemo(() => {
    const present = new Set(prepared.flatMap((s) => s.items.flatMap((i) => i.tags ?? [])));
    return DIETARY_TAGS.filter((t) => present.has(t.id));
  }, [prepared]);

  const q = query.trim().toLowerCase();
  const filtered = prepared
    .map((s) => ({
      ...s,
      items: s.items.filter((i) => {
        const textMatch =
          !q || i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q);
        const tagMatch = activeTags.every((t) => (i.tags ?? []).includes(t));
        return textMatch && tagMatch;
      }),
    }))
    .filter((s) => s.items.length > 0);

  function toggleTag(id: string) {
    setActiveTags((tags) => (tags.includes(id) ? tags.filter((t) => t !== id) : [...tags, id]));
  }

  const filtering = q.length > 0 || activeTags.length > 0;

  return (
    <div>
      {/* filter bar */}
      <div className="sticky top-0 z-10 -mx-5 border-b border-mist/60 bg-white/95 px-5 py-3 backdrop-blur">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-smoke/60" />
          <input
            className="input pl-9"
            placeholder="Search the menu…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {availableTags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {availableTags.map((t) => {
              const active = activeTags.includes(t.id);
              const Icon = TAG_ICONS[t.id];
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTag(t.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                  style={
                    active
                      ? { background: accent, borderColor: accent, color: "#fff" }
                      : { borderColor: "#E4E7EB", color: "#52606D" }
                  }
                >
                  {Icon && <Icon size={12} strokeWidth={2.4} />}
                  {t.label}
                </button>
              );
            })}
          </div>
        )}
        {!filtering && filtered.length > 1 && (
          <div className="scrollbar-none mt-2.5 flex gap-1.5 overflow-x-auto">
            {filtered.map((s) => (
              <a
                key={s.id}
                href={`#sec-${s.id}`}
                className="shrink-0 rounded-full bg-cloud px-3 py-1 text-xs font-medium text-smoke"
              >
                {s.name}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* sections */}
      <div className="space-y-8 pt-6">
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-smoke">
            Nothing matches — try clearing the search or filters.
          </p>
        )}
        {filtered.map((section) => (
          <section key={section.id} id={`sec-${section.id}`} className="scroll-mt-36">
            <h2 className="mb-3 flex items-center gap-3 text-lg font-semibold">
              {section.name}
              <span className="h-0.5 flex-1 rounded-full" style={{ background: `${accent}33` }} />
            </h2>
            <div className="space-y-3">
              {section.items.map((item) => (
                <div key={item.id} className="flex gap-3 rounded-2xl border border-mist/70 p-3">
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-xl object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-medium">
                        {item.name}
                        {(item.tags ?? []).map((tagId) => {
                          const tag = DIETARY_TAGS.find((t) => t.id === tagId);
                          const Icon = TAG_ICONS[tagId];
                          return tag && Icon ? (
                            <span
                              key={tagId}
                              title={tag.label}
                              className="ml-1.5 inline-flex align-middle text-smoke"
                            >
                              <Icon size={14} strokeWidth={2.2} />
                            </span>
                          ) : null;
                        })}
                        {item.featured && (
                          <span
                            className="ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 align-middle text-[11px] font-semibold text-white"
                            style={{ background: accent }}
                          >
                            <Star size={10} fill="#fff" strokeWidth={0} />
                            {badgeText}
                          </span>
                        )}
                      </p>
                      <p className="shrink-0 font-semibold" style={{ color: accent }}>
                        {formatPrice(item.price, currency)}
                      </p>
                    </div>
                    {item.description && (
                      <p className="mt-0.5 text-sm leading-snug text-smoke">{item.description}</p>
                    )}
                    {item.calories != null && (
                      <p className="mt-0.5 text-xs font-medium text-smoke/80">
                        {item.calories} kcal
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
