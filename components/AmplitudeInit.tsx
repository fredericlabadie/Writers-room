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
        sessionReplay: { sampleRate: 1 },
      });
    }

    function onAccept() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(window as any).Cookiebot?.consent?.statistics) return;
      if (!initialized) {
        initAmplitude();
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (amplitude as any).setOptOut(false);
      }
    }

    function onDecline() {
      if (!initialized) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (amplitude as any).setOptOut(true);
    }

    window.addEventListener("CookiebotOnAccept", onAccept);
    window.addEventListener("CookiebotOnDecline", onDecline);

    // Return visit: consent already stored from a previous session
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).Cookiebot?.consent?.statistics) {
      initAmplitude();
    }

    return () => {
      window.removeEventListener("CookiebotOnAccept", onAccept);
      window.removeEventListener("CookiebotOnDecline", onDecline);
    };
  }, []);

  return null;
}
