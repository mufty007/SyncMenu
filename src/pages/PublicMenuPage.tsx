import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Logo from "../components/Logo";
import CustomerMenuList from "../components/CustomerMenuList";
import { supabase } from "../lib/supabase";
import type { MenuItem, MenuSection, TemplateConfig } from "../lib/types";

interface PublicMenu {
  status: "ok" | "not_found";
  restaurant?: {
    name: string;
    logo_url: string | null;
    brand_color: string;
    currency: string;
  };
  menu?: {
    name: string;
    template_config: Partial<TemplateConfig>;
    sections: (MenuSection & { items: MenuItem[] })[];
  };
}

/** Mobile customer menu — reached by scanning a per-menu QR code. */
export default function PublicMenuPage() {
  const { menuId } = useParams();
  const [data, setData] = useState<PublicMenu | null>(null);

  useEffect(() => {
    if (!menuId) return;
    supabase
      .rpc("get_public_menu", { p_menu: menuId })
      .then(({ data: d }) => setData((d as PublicMenu) ?? { status: "not_found" }));
  }, [menuId]);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-mist border-t-brand" />
      </div>
    );
  }

  if (data.status !== "ok" || !data.menu || !data.restaurant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
        <Logo size={30} />
        <p className="mt-6 font-medium">This menu isn't available.</p>
        <p className="mt-1 text-sm text-smoke">
          It may have been removed — ask the staff for a fresh QR code.
        </p>
      </div>
    );
  }

  const { restaurant, menu } = data;
  const accent = menu.template_config?.accent ?? restaurant.brand_color ?? "#FF6B2C";

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-white pb-16 shadow-sm">
      <header className="px-6 pb-6 pt-10 text-center" style={{ background: `${accent}12` }}>
        {restaurant.logo_url && (
          <img
            src={restaurant.logo_url}
            alt=""
            className="mx-auto mb-3 h-16 w-16 rounded-2xl object-contain"
          />
        )}
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em]"
          style={{ color: accent }}
        >
          {restaurant.name}
        </p>
        <h1 className="font-display mt-1 text-3xl font-bold">{menu.name}</h1>
      </header>

      <div className="px-5">
        <CustomerMenuList
          sections={menu.sections}
          accent={accent}
          currency={restaurant.currency}
          badgeText={menu.template_config?.badgeText?.trim() || "Popular"}
        />
      </div>

      <footer className="mt-12 flex justify-center opacity-60">
        <Logo size={18} />
      </footer>
    </div>
  );
}
