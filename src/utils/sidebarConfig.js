import { sidebarConfigAPI } from "../services/api";

const cacheKey = (portalId) => `sidebar_config_${portalId}`;

export const getCachedSidebarConfig = (portalId) => {
  try {
    const raw = localStorage.getItem(cacheKey(portalId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const setCachedSidebarConfig = (portalId, config) => {
  try {
    localStorage.setItem(cacheKey(portalId), JSON.stringify(config));
  } catch {}
};

export const fetchSidebarConfig = async (portalId) => {
  const res = await sidebarConfigAPI.getByPortalId(portalId);
  if (!res?.success) return null;
  return res.data;
};

export const loadSidebarConfig = async (portalId) => {
  const cached = getCachedSidebarConfig(portalId);
  if (cached) return cached;
  const cfg = await fetchSidebarConfig(portalId);
  if (cfg) setCachedSidebarConfig(portalId, cfg);
  return cfg;
};

export const flattenSidebarItems = (config) => {
  if (!config?.groups) return [];
  return config.groups
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .flatMap((g) => (g.items || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0)));
};

export const matchSidebarItemByPath = (config, pathname) => {
  const items = flattenSidebarItems(config);
  let best = null;
  for (const item of items) {
    if (!item?.path) continue;
    if (item.end) {
      if (pathname === item.path) {
        if (!best || item.path.length > best.path.length) best = item;
      }
    } else {
      if (pathname === item.path || pathname.startsWith(item.path + "/")) {
        if (!best || item.path.length > best.path.length) best = item;
      }
      if (pathname.startsWith(item.path) && item.path !== "/") {
        if (!best || item.path.length > best.path.length) best = item;
      }
    }
  }
  return best;
};
