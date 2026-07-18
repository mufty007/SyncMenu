export type Orientation = "landscape" | "portrait";
export type TemplateId =
  | "classic"
  | "bold"
  | "chalk"
  | "luxe"
  | "market"
  | "spotlight"
  | "vivid"
  | "promo"
  | "custom";

export type HeadingFont =
  | "auto"
  | "poppins"
  | "grotesk"
  | "bebas"
  | "fraunces"
  | "caveat"
  | "bricolage"
  | "outfit";

export type LayoutRatio = "40-60" | "50-50" | "33-67";

/** Structured options for the "Your Design" template studio. */
export interface CustomDesign {
  headerAlign: "left" | "center";
  headerStyle: "plain" | "band" | "underline";
  sectionStyle: "columns" | "cards";
  itemStyle: "leaders" | "clean" | "pills";
  bodyFont: "poppins" | "grotesk";
  colors: {
    bg: string;
    heading: string;
    text: string;
    muted: string;
    price: string;
    card: string;
  };
}

/* ------------------------------------------------------------------ */
/* Studio: freeform drag-and-drop canvas design                        */
/* ------------------------------------------------------------------ */

export type StudioFont = "poppins" | "grotesk" | "bebas" | "fraunces" | "caveat" | "bricolage" | "outfit";

export type StudioElementType =
  | "text"
  | "shape"
  | "image"
  | "logo"
  | "menuName"
  | "restaurantName"
  | "section"
  | "video"
  | "gif"
  | "qrCode";

export interface StudioElement {
  id: string;
  type: StudioElementType;
  /** Position & size in native canvas pixels (1920x1080 / 1080x1920). */
  x: number;
  y: number;
  w: number;
  h: number;
  /* text-like elements */
  text?: string;
  fontFamily?: StudioFont;
  fontSize?: number;
  fontWeight?: 400 | 500 | 600 | 700;
  color?: string;
  align?: "left" | "center" | "right";
  /* shape / image */
  fill?: string;
  radius?: number;
  opacity?: number;
  url?: string;
  /* section block (bound to live menu data) */
  sectionId?: string;
  itemFontSize?: number;
  showTitle?: boolean;
  showDesc?: boolean;
  showPrice?: boolean;
  titleColor?: string;
  textColor?: string;
  mutedColor?: string;
  priceColor?: string;
  /* video / gif / qr */
  linkUrl?: string;
  loop?: boolean;
  muted?: boolean;
}

/** A studio design: elements painted in array order (first = back). */
export interface StudioDoc {
  elements: StudioElement[];
}

export const DEFAULT_CUSTOM_DESIGN: CustomDesign = {
  headerAlign: "center",
  headerStyle: "underline",
  sectionStyle: "columns",
  itemStyle: "leaders",
  bodyFont: "poppins",
  colors: {
    bg: "#FFFFFF",
    heading: "#1F2933",
    text: "#1F2933",
    muted: "#52606D",
    price: "#FF6B2C",
    card: "#F5F7FA",
  },
};
export type Transition = "fade" | "slide-up";

export interface TemplateConfig {
  accent: string;
  theme: "light" | "dark";
  font: "sans" | "display";
  showDescriptions: boolean;
  showImages: boolean;
  showPrices: boolean;
  showLogo: boolean;
  /** Overall content size: bigger text vs. more items on screen. */
  density: "cozy" | "standard" | "compact";
  /** Section column count; "auto" picks based on orientation & content. */
  columns: "auto" | 1 | 2 | 3;
  /** Bottom bar text (announcements, wifi, offers). Empty = hidden. */
  footerText: string;
  /** Scroll the footer bar like a news ticker. */
  footerTicker: boolean;
  /** Label shown on featured items. */
  badgeText: string;
  /** Custom background color; null = template default. */
  background: string | null;
  /** Uploaded background image URL; overrides background color. */
  backgroundImage: string | null;
  /** Darkness of the readability overlay on background images (0-80 %). */
  backgroundOverlay: number;
  /** Heading font override; "auto" = template's own font. */
  headingFont: HeadingFont;
  /** Legacy preset-based custom design (pre-studio menus). */
  custom?: CustomDesign;
  /** Freeform canvas design; when present it wins over `custom`. */
  studio?: StudioDoc;
  /** Spotlight / Promo: section that feeds the hero panel. */
  heroSectionId?: string | null;
  /** Spotlight / Promo: specific item for hero (overrides section pick). */
  heroItemId?: string | null;
  /** Vivid: per-section accent color overrides (by section index). */
  zoneColors?: string[];
  /** Spotlight split ratio. */
  layoutRatio?: LayoutRatio;
  /** Optional looping background video URL (promo template). */
  backgroundVideo?: string | null;
}

export const DEFAULT_TEMPLATE_CONFIG: TemplateConfig = {
  accent: "#FF6B2C",
  theme: "light",
  font: "sans",
  showDescriptions: true,
  showImages: true,
  showPrices: true,
  showLogo: true,
  density: "standard",
  columns: "auto",
  footerText: "",
  footerTicker: false,
  badgeText: "Popular",
  background: null,
  backgroundImage: null,
  backgroundOverlay: 40,
  headingFont: "auto",
  heroSectionId: null,
  heroItemId: null,
  zoneColors: [],
  layoutRatio: "40-60",
  backgroundVideo: null,
};

export interface RestaurantLinks {
  ubereats?: string;
  doordash?: string;
  grubhub?: string;
  deliveroo?: string;
  justeat?: string;
  website?: string;
  phone?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  x?: string;
  google_maps?: string;
}

export type LinkKind = "order" | "contact" | "social";

/** Drives both the owner-facing links form and the customer hub buttons. */
export const LINK_DEFS: {
  id: keyof RestaurantLinks;
  label: string;
  kind: LinkKind;
  placeholder: string;
}[] = [
  { id: "ubereats", label: "Uber Eats", kind: "order", placeholder: "https://www.ubereats.com/store/…" },
  { id: "doordash", label: "DoorDash", kind: "order", placeholder: "https://www.doordash.com/store/…" },
  { id: "grubhub", label: "Grubhub", kind: "order", placeholder: "https://www.grubhub.com/restaurant/…" },
  { id: "deliveroo", label: "Deliveroo", kind: "order", placeholder: "https://deliveroo.co.uk/menu/…" },
  { id: "justeat", label: "Just Eat", kind: "order", placeholder: "https://www.just-eat.co.uk/restaurants-…" },
  { id: "phone", label: "Phone", kind: "contact", placeholder: "+1 555 123 4567" },
  { id: "website", label: "Website", kind: "contact", placeholder: "https://yourshop.com" },
  { id: "instagram", label: "Instagram", kind: "social", placeholder: "https://instagram.com/yourshop" },
  { id: "tiktok", label: "TikTok", kind: "social", placeholder: "https://tiktok.com/@yourshop" },
  { id: "facebook", label: "Facebook", kind: "social", placeholder: "https://facebook.com/yourshop" },
  { id: "x", label: "X (Twitter)", kind: "social", placeholder: "https://x.com/yourshop" },
  { id: "google_maps", label: "Google Maps", kind: "social", placeholder: "https://maps.app.goo.gl/…" },
];

/** Icons for these live in `templates/shared.tsx` (TAG_ICONS). */
export const DIETARY_TAGS: { id: string; label: string }[] = [
  { id: "vegetarian", label: "Veggie" },
  { id: "vegan", label: "Vegan" },
  { id: "halal", label: "Halal" },
  { id: "spicy", label: "Spicy" },
  { id: "gluten-free", label: "Gluten-free" },
];

export interface Restaurant {
  id: string;
  owner_id: string;
  name: string;
  logo_url: string | null;
  brand_color: string;
  currency: string;
  trial_ends_at: string;
  created_at: string;
  links?: RestaurantLinks;
  about?: string;
  status?: "active" | "suspended";
  suspended_at?: string | null;
  suspended_reason?: string | null;
}

export interface Menu {
  id: string;
  restaurant_id: string;
  name: string;
  template_id: TemplateId;
  template_config: Partial<TemplateConfig>;
  orientation: Orientation;
  created_at: string;
  updated_at: string;
  show_on_hub?: boolean;
}

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
  featured?: boolean;
  tags?: string[];
  calories?: number | null;
  sort_order: number;
}

export interface Screen {
  id: string;
  restaurant_id: string;
  name: string;
  orientation: Orientation;
  assigned_menu_id: string | null;
  assigned_playlist_id: string | null;
  paired_at: string;
  last_seen_at: string | null;
}

export interface Playlist {
  id: string;
  restaurant_id: string;
  name: string;
  created_at: string;
}

export interface PlaylistSlide {
  id: string;
  playlist_id: string;
  slide_type: SlideType;
  menu_id: string | null;
  media_id: string | null;
  duration_seconds: number;
  transition: Transition;
  sort_order: number;
}

export type SlideType = "menu" | "media";
export type MediaKind = "image" | "gif" | "video";

export interface MediaAsset {
  id: string;
  restaurant_id: string;
  name: string;
  kind: MediaKind;
  url: string;
  mime_type: string;
  file_size_bytes: number;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  link_url: string | null;
  show_qr: boolean;
  created_at: string;
}

export interface MediaSlidePayload {
  id: string;
  name: string;
  kind: MediaKind;
  url: string;
  thumbnail_url: string | null;
  link_url: string | null;
  show_qr: boolean;
}

/** Shape returned by the get_screen_content RPC for the kiosk player. */
export interface ScreenContent {
  status: "ok" | "revoked" | "suspended" | "trial_expired";
  screen?: { id: string; name: string; orientation: Orientation };
  restaurant?: {
    name: string;
    logo_url: string | null;
    brand_color: string;
    currency: string;
  };
  slides?: SlidePayload[];
}

export interface MenuSlidePayload {
  slide_type: "menu";
  duration_seconds: number;
  transition: Transition;
  menu: {
    id: string;
    name: string;
    template_id: TemplateId;
    template_config: Partial<TemplateConfig>;
    orientation: Orientation;
    sections: (MenuSection & { items: MenuItem[] })[];
  };
}

export interface MediaSlideContent {
  slide_type: "media";
  duration_seconds: number;
  transition: Transition;
  media: MediaSlidePayload;
}

export type SlidePayload = MenuSlidePayload | MediaSlideContent;

export const PLAN_LIMITS = {
  screens: 5,
  menus: 10,
  templates: 5,
  storageMb: 100,
};

/** Per-plan limits — keep in sync with SQL in migration 0007. */
export const PLAN_LIMITS_BY_PLAN: Record<string, { screens: number; menus: number; storageMb: number }> = {
  starter: { screens: 1, menus: 5, storageMb: 50 },
  growth: { screens: 5, menus: 10, storageMb: 100 },
  pro: { screens: 10, menus: 999, storageMb: 500 },
  trial: { screens: 5, menus: 10, storageMb: 100 },
};

export interface Subscription {
  restaurant_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_id: string | null;
  price_id: string | null;
  status: string | null;
  current_period_end: string | null;
  updated_at: string;
}

export interface SubscriptionAddon {
  restaurant_id: string;
  addon_id: "clover";
  stripe_subscription_id: string;
  stripe_subscription_item_id: string;
  price_id: string;
  status: string;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: string;
  name: string;
  tagline: string;
  monthly: number;
  annualMonthly: number;
  popular?: boolean;
  perks: string[];
}

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "One screen, done right",
    monthly: 15,
    annualMonthly: 12,
    perks: [
      "1 screen",
      "5 saved menus",
      "All templates + design studio",
      "Real-time sync",
      "Customer QR menus",
      "50 MB image storage",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "For the counter, kitchen & window",
    monthly: 30,
    annualMonthly: 25,
    popular: true,
    perks: [
      "Up to 5 screens",
      "10 saved menus",
      "All templates + design studio",
      "Playlists & timed rotation",
      "Ticker bar & featured items",
      "Customer QR menus",
      "100 MB image storage",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Every screen in the shop",
    monthly: 99,
    annualMonthly: 82,
    perks: [
      "Up to 10 screens",
      "Unlimited saved menus",
      "Everything in Growth",
      "Priority support",
      "500 MB image storage",
      "Early access to new features",
    ],
  },
];
