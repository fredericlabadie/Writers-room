"use client";

import { useEffect } from "react";
import * as amplitude from "@amplitude/unified";

export default function AmplitudeInit() {
  useEffect(() => {
    let initialized = false;

    function initAmplitude() {
      if (initialized) return;
      initialized = true;
      amplitude.initAll("bb520ce286dcd9762c8e4360e9a3d51e", {
        serverZone: "EU",
        analytics: { autocapture: true },
        sessionReplay: { sampleRate: 0.1 },
      });
    }

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

    function syncConsent() {
      if (window.FLConsent?.hasAnalytics()) {
        initAmplitude();
        amplitude.setOptOut(false);
      } else {
        if (initialized) amplitude.setOptOut(true);
        clearAmplitudeStorage();
      }
    }

    window.addEventListener("FLConsentChanged", syncConsent);

    // Return visit: fl-consent.js already ran, check current state.
    syncConsent();

    return () => {
      window.removeEventListener("FLConsentChanged", syncConsent);
    };
  }, []);

  return null;
}
