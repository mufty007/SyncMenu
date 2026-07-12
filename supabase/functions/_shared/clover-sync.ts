import {
  CloverApiClient,
  CloverIntegrationRow,
  CloverPlatformConfig,
  adminClient,
  logCloverSync,
  priceToCents,
  refreshAccessTokenIfNeeded,
} from "./clover.ts";

export interface MenuSection {
  id: string;
  menu_id: string;
  name: string;
  sort_order: number;
}

export interface MenuItem {
  id: string;
  section_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  available: boolean;
  sort_order: number;
}

export async function getEntityMap(integrationId: string) {
  const admin = adminClient();
  const { data } = await admin
    .from("clover_entity_map")
    .select("*")
    .eq("integration_id", integrationId);
  return (data ?? []) as {
    id: string;
    entity_type: "category" | "item";
    syncmenu_id: string;
    clover_id: string;
  }[];
}

export async function upsertEntityMap(
  integrationId: string,
  entityType: "category" | "item",
  syncmenuId: string,
  cloverId: string
) {
  const admin = adminClient();
  await admin.from("clover_entity_map").upsert(
    {
      integration_id: integrationId,
      entity_type: entityType,
      syncmenu_id: syncmenuId,
      clover_id: cloverId,
    },
    { onConflict: "integration_id,entity_type,syncmenu_id" }
  );
}

export async function removeEntityMap(
  integrationId: string,
  entityType: "category" | "item",
  syncmenuId: string
) {
  const admin = adminClient();
  await admin
    .from("clover_entity_map")
    .delete()
    .eq("integration_id", integrationId)
    .eq("entity_type", entityType)
    .eq("syncmenu_id", syncmenuId);
}

async function loadDeliveryMenu(menuId: string) {
  const admin = adminClient();
  const { data: sections } = await admin
    .from("menu_sections")
    .select("*")
    .eq("menu_id", menuId)
    .order("sort_order");
  const sectionList = (sections ?? []) as MenuSection[];
  const sectionIds = sectionList.map((s) => s.id);
  let items: MenuItem[] = [];
  if (sectionIds.length) {
    const { data: itemRows } = await admin
      .from("menu_items")
      .select("*")
      .in("section_id", sectionIds)
      .order("sort_order");
    items = (itemRows ?? []) as MenuItem[];
  }
  return { sections: sectionList, items };
}

async function syncSection(
  client: CloverApiClient,
  integration: CloverIntegrationRow,
  section: MenuSection,
  mapBySyncId: Map<string, string>
) {
  let cloverId = mapBySyncId.get(`category:${section.id}`);
  if (cloverId) {
    await client.updateCategory(cloverId, section.name);
  } else {
    const created = await client.createCategory(section.name);
    cloverId = created.id;
    await upsertEntityMap(integration.id, "category", section.id, cloverId);
    mapBySyncId.set(`category:${section.id}`, cloverId);
  }
  return cloverId;
}

async function syncItem(
  client: CloverApiClient,
  integration: CloverIntegrationRow,
  item: MenuItem,
  categoryCloverId: string,
  mapBySyncId: Map<string, string>
) {
  const payload: Record<string, unknown> = {
    name: item.name,
    price: priceToCents(item.price),
    priceType: "FIXED",
    defaultTaxRates: true,
  };
  if (item.description?.trim()) payload.alternateName = item.description.trim();
  if (item.image_url) payload.imageUrl = item.image_url;

  let cloverItemId = mapBySyncId.get(`item:${item.id}`);
  if (cloverItemId) {
    await client.updateItem(cloverItemId, payload);
  } else {
    const created = await client.createItem(payload);
    cloverItemId = created.id;
    await upsertEntityMap(integration.id, "item", item.id, cloverItemId);
    mapBySyncId.set(`item:${item.id}`, cloverItemId);
    await client.linkItemToCategory(categoryCloverId, cloverItemId);
  }

  await client.setItemStock(cloverItemId, item.available);
}

export async function runFullPush(
  config: CloverPlatformConfig,
  integration: CloverIntegrationRow
): Promise<void> {
  if (!integration.delivery_menu_id) {
    throw new Error("No delivery menu selected");
  }

  const token = await refreshAccessTokenIfNeeded(config, integration);
  const client = new CloverApiClient(config, integration.clover_merchant_id, token);
  const { sections, items } = await loadDeliveryMenu(integration.delivery_menu_id);

  const maps = await getEntityMap(integration.id);
  const mapBySyncId = new Map<string, string>();
  for (const m of maps) {
    mapBySyncId.set(`${m.entity_type}:${m.syncmenu_id}`, m.clover_id);
  }

  const sectionCloverIds = new Map<string, string>();
  for (const section of sections) {
    const cloverCategoryId = await syncSection(client, integration, section, mapBySyncId);
    sectionCloverIds.set(section.id, cloverCategoryId);
  }

  const liveItemIds = new Set(items.map((i) => i.id));
  for (const item of items) {
    const categoryId = sectionCloverIds.get(item.section_id);
    if (!categoryId) continue;
    await syncItem(client, integration, item, categoryId, mapBySyncId);
  }

  // Hide removed items still in map
  for (const m of maps) {
    if (m.entity_type === "item" && !liveItemIds.has(m.syncmenu_id)) {
      try {
        await client.hideItem(m.clover_id);
      } catch {
        // item may already be gone in Clover
      }
      await removeEntityMap(integration.id, "item", m.syncmenu_id);
    }
  }

  const liveSectionIds = new Set(sections.map((s) => s.id));
  for (const m of maps) {
    if (m.entity_type === "category" && !liveSectionIds.has(m.syncmenu_id)) {
      try {
        await client.deleteCategory(m.clover_id);
      } catch {
        // category may have dependencies
      }
      await removeEntityMap(integration.id, "category", m.syncmenu_id);
    }
  }

  const admin = adminClient();
  await admin
    .from("clover_integrations")
    .update({
      status: "active",
      last_full_sync_at: new Date().toISOString(),
      last_push_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id);

  await logCloverSync(integration.restaurant_id, "full_push", "ok", {
    sections: sections.length,
    items: items.length,
  });
}

export async function runItemUpsert(
  config: CloverPlatformConfig,
  integration: CloverIntegrationRow,
  itemId: string
): Promise<void> {
  const admin = adminClient();
  const { data: item } = await admin.from("menu_items").select("*").eq("id", itemId).maybeSingle();
  if (!item) return;

  const { data: section } = await admin
    .from("menu_sections")
    .select("*")
    .eq("id", item.section_id)
    .maybeSingle();
  if (!section || section.menu_id !== integration.delivery_menu_id) return;

  const token = await refreshAccessTokenIfNeeded(config, integration);
  const client = new CloverApiClient(config, integration.clover_merchant_id, token);
  const maps = await getEntityMap(integration.id);
  const mapBySyncId = new Map<string, string>();
  for (const m of maps) {
    mapBySyncId.set(`${m.entity_type}:${m.syncmenu_id}`, m.clover_id);
  }

  let categoryCloverId = mapBySyncId.get(`category:${section.id}`);
  if (!categoryCloverId) {
    categoryCloverId = await syncSection(
      client,
      integration,
      section as MenuSection,
      mapBySyncId
    );
  }

  await syncItem(
    client,
    integration,
    item as MenuItem,
    categoryCloverId,
    mapBySyncId
  );

  await admin
    .from("clover_integrations")
    .update({
      last_push_at: new Date().toISOString(),
      last_error: null,
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id);
}

export async function runItemDelete(
  config: CloverPlatformConfig,
  integration: CloverIntegrationRow,
  itemId: string
): Promise<void> {
  const maps = await getEntityMap(integration.id);
  const mapped = maps.find((m) => m.entity_type === "item" && m.syncmenu_id === itemId);
  if (!mapped) return;

  const token = await refreshAccessTokenIfNeeded(config, integration);
  const client = new CloverApiClient(config, integration.clover_merchant_id, token);
  await client.hideItem(mapped.clover_id);
  await removeEntityMap(integration.id, "item", itemId);

  const admin = adminClient();
  await admin
    .from("clover_integrations")
    .update({
      last_push_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id);
}

export async function runSectionUpsert(
  config: CloverPlatformConfig,
  integration: CloverIntegrationRow,
  sectionId: string
): Promise<void> {
  const admin = adminClient();
  const { data: section } = await admin
    .from("menu_sections")
    .select("*")
    .eq("id", sectionId)
    .maybeSingle();
  if (!section || section.menu_id !== integration.delivery_menu_id) return;

  const token = await refreshAccessTokenIfNeeded(config, integration);
  const client = new CloverApiClient(config, integration.clover_merchant_id, token);
  const maps = await getEntityMap(integration.id);
  const mapBySyncId = new Map<string, string>();
  for (const m of maps) {
    mapBySyncId.set(`${m.entity_type}:${m.syncmenu_id}`, m.clover_id);
  }
  await syncSection(client, integration, section as MenuSection, mapBySyncId);

  await admin
    .from("clover_integrations")
    .update({
      last_push_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id);
}

export async function runSectionDelete(
  config: CloverPlatformConfig,
  integration: CloverIntegrationRow,
  sectionId: string
): Promise<void> {
  const maps = await getEntityMap(integration.id);
  const mapped = maps.find((m) => m.entity_type === "category" && m.syncmenu_id === sectionId);
  if (!mapped) return;

  const token = await refreshAccessTokenIfNeeded(config, integration);
  const client = new CloverApiClient(config, integration.clover_merchant_id, token);
  try {
    await client.deleteCategory(mapped.clover_id);
  } catch {
    // may fail if items still linked
  }
  await removeEntityMap(integration.id, "category", sectionId);
}

export async function processSyncJob(
  config: CloverPlatformConfig,
  integration: CloverIntegrationRow,
  jobType: string,
  payload: Record<string, unknown>
): Promise<void> {
  switch (jobType) {
    case "full_push":
      await runFullPush(config, integration);
      break;
    case "item_upsert":
      await runItemUpsert(config, integration, String(payload.item_id));
      break;
    case "item_delete":
      await runItemDelete(config, integration, String(payload.item_id));
      break;
    case "section_upsert":
      await runSectionUpsert(config, integration, String(payload.section_id));
      break;
    case "section_delete":
      await runSectionDelete(config, integration, String(payload.section_id));
      break;
    default:
      throw new Error(`Unknown job type: ${jobType}`);
  }
}
