import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import {
  DEFAULT_PLATFORM_CONFIG,
  mergePlatformConfig,
  plansFromConfig,
  type PlatformConfig,
} from "./platformConfig";
import type { Plan } from "./types";

let cachedConfig: PlatformConfig | null = null;
let cachePromise: Promise<PlatformConfig> | null = null;

async function fetchPlatformConfig(): Promise<PlatformConfig> {
  if (cachedConfig) return cachedConfig;
  if (!cachePromise) {
    cachePromise = (async () => {
      const { data, error } = await supabase.rpc("get_platform_settings");
      if (error) return DEFAULT_PLATFORM_CONFIG;
      cachedConfig = mergePlatformConfig(data);
      return cachedConfig;
    })();
  }
  return cachePromise;
}

export function invalidatePlatformSettingsCache() {
  cachedConfig = null;
  cachePromise = null;
}

export function usePlatformSettings() {
  const [config, setConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);
  const [plans, setPlans] = useState<Plan[]>(() => plansFromConfig(DEFAULT_PLATFORM_CONFIG));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void fetchPlatformConfig().then((merged) => {
      setConfig(merged);
      setPlans(plansFromConfig(merged));
      setLoaded(true);
    });
  }, []);

  return { config, plans, loaded };
}
