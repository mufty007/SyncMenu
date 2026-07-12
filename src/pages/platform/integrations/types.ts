export type IntegrationTab = "clover";

export interface CloverAdminSettings {
  app_id: string;
  app_secret_masked: string | null;
  app_secret_set: boolean;
  environment: "sandbox" | "production";
  oauth_state_secret_set: boolean;
  enabled: boolean;
  oauth_redirect_uri: string;
  configured: boolean;
  ready: boolean;
}
