import ExtPay from "extpay";

export type ExtPayUser = {
  paid?: boolean;
  trialStartedAt?: Date | null;
  email?: string | null;
};

type ExtPayClient = {
  startBackground: () => void;
  getUser: () => Promise<ExtPayUser>;
  openTrialPage: (displayText?: string) => void;
  openPaymentPage: (planNickname?: string) => void;
  openLoginPage: () => void;
  onPaid: {
    addListener: (cb: (user: ExtPayUser) => void) => void;
  };
};

const extPayExtensionId =
  import.meta.env.VITE_EXTPAY_EXTENSION_ID?.trim() ?? "";
export const EXTPAY_EXTENSION_ID = extPayExtensionId;

export const isExtPayConfigured = extPayExtensionId.length > 0;

const EXTPAY_HOST = "https://extensionpay.com";
export const EXTPAY_EXTENSION_URL = `${EXTPAY_HOST}/extension/${extPayExtensionId}`;

let extPaySingleton: ExtPayClient | null = null;

export function getExtPayClient(): ExtPayClient {
  if (!isExtPayConfigured) {
    throw new Error(
      "ExtPay is not configured. Set VITE_EXTPAY_EXTENSION_ID in your .env file.",
    );
  }

  if (extPaySingleton !== null) {
    return extPaySingleton;
  }

  const createExtPay = ExtPay as unknown as (
    extensionId: string,
  ) => ExtPayClient;
  extPaySingleton = createExtPay(extPayExtensionId);
  return extPaySingleton;
}
