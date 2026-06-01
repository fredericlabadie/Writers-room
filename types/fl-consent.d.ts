export {};

declare global {
  interface Window {
    FLConsent?: {
      get: () => {
        version: string;
        analytics: boolean;
        updatedAt: string;
        source: string;
      } | null;
      hasAnalytics: () => boolean;
      open?: () => void;
      setAnalytics?: (granted: boolean, source?: string) => void;
      reset?: () => void;
    };
    FLConsentConfig?: Record<string, string>;
  }
}
