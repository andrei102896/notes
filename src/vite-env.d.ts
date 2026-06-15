/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** ExtensionPay extension id from extensionpay.com settings. */
  readonly VITE_EXTPAY_EXTENSION_ID?: string;
  /** "prod" = 7-day free trial; anything else = 7-minute trial (dev). */
  readonly VITE_TRIAL_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
