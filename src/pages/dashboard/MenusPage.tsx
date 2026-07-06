import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Copy, Plus, MonitorSmartphone } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { PLAN_LIMITS, type Menu } from "../../lib/types";
import { TEMPLATES } from "../../templates/MenuBoard";
import { timeAgo } from "../../lib/format";

export default function MenusPage() {
  const { restaurant } = useAuth();
  const [menus, setMenus] = useState<Menu[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!restaurant) return;
    supabase
      .from("menus")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("updated_at", { ascending: false })
      .then(({ data }) => setMenus((data as Menu[]) ?? []));
  }, [restaurant]);

  async function duplicateMenu(source: Menu) {
    if (!restaurant || busy) return;
    if ((menus?.length ?? 0) >= PLAN_LIMITS.menus) {
      setError(`Your plan includes up to ${PLAN_LIMITS.menus} saved menus.`);
      return;
    }
    setBusy(true);
    setError(null);
    const { data: copy, error: err } = await supabase
      .from("menus")
      .insert({
        restaurant_id: restaurant.id,
        name: `${source.name} (copy)`,
        template_id: source.template_id,
        template_config: source.template_config,
        orientation: source.orientation,
      })
      .select()
      .single();
    if (err || !copy) {
      setBusy(false);
      setError(err?.message ?? "Could not duplicate menu.");
      return;
    }
    const { data: sections } = await supabase
      .from("menu_sections")
      .select("*, items:menu_items(*)")
      .eq("menu_id", source.id)
      .order("sort_order");
    for (const section of sections ?? []) {
      const { data: newSection } = await supabase
        .from("menu_sections")
        .insert({ menu_id: copy.id, name: section.name, sort_order: section.sort_order })
        .select()
        .single();
      if (newSection && section.items?.length) {
        await supabase.from("menu_items").insert(
          section.items.map((i: Record<string, unknown>) => ({
            section_id: newSection.id,
            name: i.name,
            description: i.description,
            price: i.price,
            image_url: i.image_url,
            available: i.available,
            featured: i.featured ?? false,
            sort_order: i.sort_order,
          }))
        );
      }
    }
    setBusy(false);
    setMenus((m) => [copy as Menu, ...(m ?? [])]);
  }

  async function createMenu() {
    if (!restaurant || busy) return;
    if ((menus?.length ?? 0) >= PLAN_LIMITS.menus) {
      setError(`Your plan includes up to ${PLAN_LIMITS.menus} saved menus.`);
      return;
    }
    setBusy(true);
    setError(null);
    const { data: menu, error: err } = await supabase
      .from("menus")
      .insert({ restaurant_id: restaurant.id, name: "New menu" })
      .select()
      .single();
    if (err || !menu) {
      setBusy(false);
      setError(err?.message ?? "Could not create menu.");
      return;
    }
    await supabase
      .from("menu_sections")
      .insert({ menu_id: menu.id, name: "Mains", sort_order: 0 });
    setBusy(false);
    navigate(`/app/menus/${menu.id}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Menus</h1>
          <p className="mt-1 text-sm text-smoke">
            Change a price. It's on your screens in seconds.
          </p>
        </div>
        <button
          className="btn-primary"
          data-tour="new-menu"
          onClick={() => void createMenu()}
          disabled={busy}
        >
          <Plus size={16} /> New menu
        </button>
      </div>
      {error && <p className="mt-4 text-sm text-alert">{error}</p>}

      {menus === null ? (
        <p className="mt-10 text-sm text-smoke">Loading…</p>
      ) : menus.length === 0 ? (
        <div className="card mt-8 flex flex-col items-center p-14 text-center">
          <MonitorSmartphone size={36} className="text-smoke" strokeWidth={1.5} />
          <p className="mt-4 font-medium">No menus yet</p>
          <p className="mt-1 max-w-sm text-sm text-smoke">
            Create your first menu, pick a template, and it's ready for any
            screen.
          </p>
          <button className="btn-primary mt-6" onClick={() => void createMenu()}>
            <Plus size={16} /> Create a menu
          </button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {menus.map((menu) => (
            <Link
              key={menu.id}
              to={`/app/menus/${menu.id}`}
              className="card group p-5 transition-shadow duration-200 hover:shadow-md"
            >
              <div
                className="flex h-28 items-center justify-center rounded-xl text-white"
                style={{
                  background:
                    menu.template_id === "chalk" || menu.template_id === "luxe"
                      ? "#1F2933"
                      : (menu.template_config.accent as string) ?? "#FF6B2C",
                }}
              >
                <span className="font-display text-xl font-bold opacity-90">
                  {menu.name}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium group-hover:text-brand">{menu.name}</p>
                  <p className="mt-0.5 text-xs text-smoke">
                    {TEMPLATES.find((t) => t.id === menu.template_id)?.name ?? menu.template_id}
                    {" · "}
                    {menu.orientation}
                    {" · updated "}
                    {timeAgo(menu.updated_at)}
                  </p>
                </div>
                <button
                  className="btn-ghost shrink-0 px-2"
                  title="Duplicate menu"
                  onClick={(e) => {
                    e.preventDefault();
                    void duplicateMenu(menu);
                  }}
                >
                  <Copy size={15} />
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
