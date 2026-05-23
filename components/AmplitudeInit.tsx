"use client";

import { useEffect } from "react";
import * as amplitude from "@amplitude/unified";

type CookiebotWindow = Window &
  typeof globalThis & {
    Cookiebot?: {
      consent?: {
        statistics?: boolean;
      };
    };
  };

export default function AmplitudeInit() {
  useEffect(() => {
    let initialized = false;
    const cookiebotWindow = window as CookiebotWindow;

    function initAmplitude() {
      if (initialized) return;
      initialized = true;
      amplitude.initAll("bb520ce286dcd9762c8e4360e9a3d51e", {
        serverZone: "EU",
        analytics: { autocapture: true },
        sessionReplay: { sampleRate: 0.1 },
      });
    }

    function onAccept() {
      if (!cookiebotWindow.Cookiebot?.consent?.statistics) return;
      if (!initialized) {
        initAmplitude();
      } else {
        amplitude.setOptOut(false);
      }
    }

    function onDecline() {
      if (!initialized) return;
      amplitude.setOptOut(true);
    }

    window.addEventListener("CookiebotOnAccept", onAccept);
    window.addEventListener("CookiebotOnDecline", onDecline);

    // Return visit: consent already stored from a previous session
    if (cookiebotWindow.Cookiebot?.consent?.statistics) {
      initAmplitude();
    }

    return () => {
      window.removeEventListener("CookiebotOnAccept", onAccept);
      window.removeEventListener("CookiebotOnDecline", onDecline);
    };
  }, []);

  return null;
}
