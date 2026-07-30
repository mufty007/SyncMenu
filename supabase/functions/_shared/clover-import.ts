import {
  CloverApiClient,
  CloverIntegrationRow,
  CloverPlatformConfig,
  adminClient,
  logCloverSync,
  refreshAccessTokenIfNeeded,
} from "./clover.ts";
import { upsertEntityMap } from "./clover-sync.ts";

export interface ImportResult {
  menu_id: string;
  sections: number;
  items: number;
  skipped_multi_category: number;
}

function centsToPrice(cents: number | undefined): number {
  if (cents == null || Number.isNaN(cents)) return 0;
  return Math.round(cents) / 100;
}

export async function importCloverMenu(
  config: CloverPlatformConfig,
  integration: CloverIntegrationRow,
  options: { brandColor?: string; templateId?: string } = {}
): Promise<ImportResult> {
  const admin = adminClient();

  await admin
    .from("clover_integrations")
    .update({
      initial_import_status: "running",
      last_import_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id);

  try {
    const token = await refreshAccessTokenIfNeeded(config, integration);
    const client = new CloverApiClient(config, integration.clover_merchant_id, token);

    const [categories, items] = await Promise.all([
      client.listCategories(),
      client.listItems(),
    ]);

    const sortedCategories = [...categories].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    );

    const { data: restaurant } = await admin
      .from("restaurants")
      .select("brand_color")
      .eq("id", integration.restaurant_id)
      .maybeSingle();

    const accent =
      options.brandColor ??
      (restaurant?.brand_color as string | undefined) ??
      "#FF6B2C";

    const { data: menu, error: menuErr } = await admin
      .from("menus")
      .insert({
        restaurant_id: integration.restaurant_id,
        name: "Clover Menu",
        template_id: options.templateId ?? "spotlight",
        template_config: { accent },
      })
      .select("id")
      .single();

    if (menuErr || !menu) {
      throw new Error(menuErr?.message ?? "Failed to create menu");
    }

    const categoryToSection = new Map<string, string>();
    let sectionSort = 0;

    for (const cat of sortedCategories) {
      const { data: section, error: secErr } = await admin
        .from("menu_sections")
        .insert({
          menu_id: menu.id,
          name: cat.name || "Category",
          sort_order: sectionSort++,
        })
        .select("id")
        .single();
      if (secErr || !section) {
        throw new Error(secErr?.message ?? "Failed to create section");
      }
      categoryToSection.set(cat.id, section.id);
      await upsertEntityMap(integration.id, "category", section.id, cat.id);
    }

    // Uncategorized bucket if needed
    let uncategorizedId: string | null = null;
    async function ensureUncategorized(): Promise<string> {
      if (uncategorizedId) return uncategorizedId;
      const { data: section, error } = await admin
        .from("menu_sections")
        .insert({
          menu_id: menu.id,
          name: "Uncategorized",
          sort_order: sectionSort++,
        })
        .select("id")
        .single();
      if (error || !section) throw new Error(error?.message ?? "Failed to create Uncategorized");
      uncategorizedId = section.id;
      return section.id;
    }

    let skippedMulti = 0;
    const itemSortBySection = new Map<string, number>();
    let itemsImported = 0;

    for (const item of items) {
      if (item.hidden) continue;

      const catIds = (item.categories?.elements ?? []).map((c) => c.id).filter(Boolean);
      if (catIds.length > 1) skippedMulti += 1;

      let sectionId: string | undefined;
      for (const cid of catIds) {
        if (categoryToSection.has(cid)) {
          sectionId = categoryToSection.get(cid);
          break;
        }
      }
      if (!sectionId) {
        sectionId = await ensureUncategorized();
      }

      const sort = itemSortBySection.get(sectionId) ?? 0;
      itemSortBySection.set(sectionId, sort + 1);

      const available = item.available !== false;

      const { data: row, error: itemErr } = await admin
        .from("menu_items")
        .insert({
          section_id: sectionId,
          name: item.name || "Item",
          description: item.description ?? "",
          price: centsToPrice(item.price),
          available,
          sort_order: sort,
        })
        .select("id")
        .single();

      if (itemErr || !row) {
        throw new Error(itemErr?.message ?? "Failed to create item");
      }

      await upsertEntityMap(integration.id, "item", row.id, item.id);
      itemsImported += 1;
    }

    await admin
      .from("clover_integrations")
      .update({
        imported_menu_id: menu.id,
        initial_import_status: "done",
        last_import_at: new Date().toISOString(),
        last_import_error: null,
        status: integration.status === "pending" ? "pending" : integration.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id);

    await logCloverSync(integration.restaurant_id, "initial_import", "ok", {
      menu_id: menu.id,
      sections: sortedCategories.length + (uncategorizedId ? 1 : 0),
      items: itemsImported,
      skipped_multi_category: skippedMulti,
    });

    return {
      menu_id: menu.id,
      sections: sortedCategories.length + (uncategorizedId ? 1 : 0),
      items: itemsImported,
      skipped_multi_category: skippedMulti,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    await admin
      .from("clover_integrations")
      .update({
        initial_import_status: "error",
        last_import_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id);
    await logCloverSync(integration.restaurant_id, "initial_import", "error", {
      error: message,
    });
    throw err;
  }
}
