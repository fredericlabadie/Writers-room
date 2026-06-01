"use client";

import { useEffect } from "react";

export default function AmplitudeInit() {
  useEffect(() => {
    let initialized = false;
    let amp: typeof import("@amplitude/unified") | null = null;

    function clearAmplitudeStorage() {
      try {
        const pat = /^(AMP_|amplitude_)/i;
        Object.keys(localStorage)
          .filter((k) => pat.test(k))
          .forEach((k) => localStorage.removeItem(k));
        Object.keys(sessionStorage)
          .filter((k) => pat.test(k))
          .forEach((k) => sessionStorage.removeItem(k));
      } catch {
        // storage access denied — ignore
      }
    }

    async function syncConsent() {
      if (window.FLConsent?.hasAnalytics()) {
        if (!initialized) {
          initialized = true;
          amp = await import("@amplitude/unified");
          amp.initAll("bb520ce286dcd9762c8e4360e9a3d51e", {
            serverZone: "EU",
            analytics: { autocapture: true },
            sessionReplay: { sampleRate: 0.1 },
          });
        }
        amp?.setOptOut(false);
      } else {
        amp?.setOptOut(true);
        clearAmplitudeStorage();
      }
    }

    window.addEventListener("FLConsentChanged", syncConsent);
    syncConsent();

    return () => {
      window.removeEventListener("FLConsentChanged", syncConsent);
    };
  }, []);

  return null;
}
