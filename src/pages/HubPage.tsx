import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Facebook,
  Globe,
  Instagram,
  MapPin,
  Music2,
  Phone,
  Twitter,
} from "lucide-react";
import Logo from "../components/Logo";
import CustomerMenuList from "../components/CustomerMenuList";
import { supabase } from "../lib/supabase";
import {
  LINK_DEFS,
  type MenuItem,
  type MenuSection,
  type RestaurantLinks,
  type TemplateConfig,
} from "../lib/types";

interface HubData {
  status: "ok" | "not_found";
  restaurant?: {
    id: string;
    name: string;
    logo_url: string | null;
    brand_color: string;
    currency: string;
    links: RestaurantLinks;
    about: string;
  };
  menus?: {
    id: string;
    name: string;
    template_config: Partial<TemplateConfig>;
    sections: (MenuSection & { items: MenuItem[] })[];
  }[];
}

const ORDER_COLORS: Record<string, string> = {
  ubereats: "#06C167",
  doordash: "#FF3008",
  grubhub: "#F63440",
  deliveroo: "#00CCBC",
  justeat: "#FF8000",
};

const SOCIAL_ICONS: Record<string, React.ComponentType<{ size?: number | string }>> = {
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Music2,
  x: Twitter,
  google_maps: MapPin,
};

function externalHref(raw: string) {
  const value = raw.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

/** Customer landing page — reached from the printed restaurant QR code. */
export default function HubPage() {
  const { restaurantId } = useParams();
  const [data, setData] = useState<HubData | null>(null);
  const [menuIndex, setMenuIndex] = useState(0);

  useEffect(() => {
    if (!restaurantId) return;
    supabase
      .rpc("get_restaurant_hub", { p_restaurant: restaurantId })
      .then(({ data: d }) => setData((d as HubData) ?? { status: "not_found" }));
  }, [restaurantId]);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-mist border-t-brand" />
      </div>
    );
  }

  if (data.status !== "ok" || !data.restaurant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
        <Logo size={30} />
        <p className="mt-6 font-medium">This page isn't available.</p>
        <p className="mt-1 text-sm text-smoke">Ask the staff for a fresh QR code.</p>
      </div>
    );
  }

  const { restaurant } = data;
  const menus = data.menus ?? [];
  const accent = restaurant.brand_color || "#FF6B2C";
  const links = restaurant.links ?? {};
  const menu = menus[Math.min(menuIndex, Math.max(0, menus.length - 1))];

  const orderLinks = LINK_DEFS.filter(
    (def) => def.kind === "order" && (links[def.id] ?? "").trim()
  );
  const socialLinks = LINK_DEFS.filter(
    (def) => def.kind === "social" && (links[def.id] ?? "").trim()
  );
  const phone = (links.phone ?? "").trim();
  const website = (links.website ?? "").trim();

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-white pb-16 shadow-sm">
      {/* header */}
      <header className="px-5 pb-5 pt-10 text-center" style={{ background: `${accent}12` }}>
        {restaurant.logo_url && (
          <img
            src={restaurant.logo_url}
            alt=""
            className="mx-auto mb-3 h-18 w-18 max-h-20 rounded-2xl object-contain"
          />
        )}
        <h1 className="font-display text-3xl font-bold">{restaurant.name}</h1>
        {restaurant.about && <p className="mt-1.5 text-sm text-smoke">{restaurant.about}</p>}

        {(orderLinks.length > 0 || phone || website) && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {orderLinks.map((def) => {
              const href = externalHref(links[def.id]!);
              if (!href) return null;
              return (
                <a
                  key={def.id}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-mist bg-white px-4 py-2 text-sm font-semibold shadow-sm transition-transform active:scale-95"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: ORDER_COLORS[def.id] ?? accent }}
                  />
                  {def.label}
                </a>
              );
            })}
            {phone && (
              <a
                href={`tel:${phone.replace(/[^+\d]/g, "")}`}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform active:scale-95"
                style={{ background: accent }}
              >
                <Phone size={14} /> Call
              </a>
            )}
            {website && (
              <a
                href={externalHref(website)!}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-mist bg-white px-4 py-2 text-sm font-semibold shadow-sm transition-transform active:scale-95"
              >
                <Globe size={14} /> Website
              </a>
            )}
          </div>
        )}

        {socialLinks.length > 0 && (
          <div className="mt-4 flex justify-center gap-3">
            {socialLinks.map((def) => {
              const Icon = SOCIAL_ICONS[def.id] ?? Globe;
              const href = externalHref(links[def.id]!);
              if (!href) return null;
              return (
                <a
                  key={def.id}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  title={def.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-smoke shadow-sm transition-colors hover:text-ink"
                >
                  <Icon size={16} />
                </a>
              );
            })}
          </div>
        )}
      </header>

      {/* menu tabs */}
      {menus.length > 1 && (
        <div className="scrollbar-none flex gap-2 overflow-x-auto border-b border-mist/60 px-5 py-3">
          {menus.map((m, i) => (
            <button
              key={m.id}
              onClick={() => setMenuIndex(i)}
              className="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
              style={
                i === menuIndex
                  ? { background: accent, color: "#fff" }
                  : { background: "#F5F7FA", color: "#52606D" }
              }
            >
              {m.name}
            </button>
          ))}
        </div>
      )}

      {/* menu content */}
      <div className="px-5">
        {menu ? (
          <CustomerMenuList
            sections={menu.sections}
            accent={accent}
            currency={restaurant.currency}
            badgeText={menu.template_config?.badgeText?.trim() || "Popular"}
          />
        ) : (
          <p className="py-14 text-center text-sm text-smoke">No menus published yet.</p>
        )}
      </div>

      <footer className="mt-12 flex justify-center opacity-60">
        <Logo size={18} />
      </footer>
    </div>
  );
}
