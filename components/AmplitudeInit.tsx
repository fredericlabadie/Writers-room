"use client";

import { useEffect } from "react";
import * as amplitude from "@amplitude/unified";

export default function AmplitudeInit() {
  useEffect(() => {
    amplitude.initAll("bb520ce286dcd9762c8e4360e9a3d51e", {
      serverZone: "EU",
      analytics: { autocapture: true },
      sessionReplay: { sampleRate: 1 },
    });
  }, []);

  return null;
}
