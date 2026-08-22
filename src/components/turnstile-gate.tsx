"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import { useState } from "react";
import { useThemeScheme } from "@/components/theme-switch";
import { turnstileSiteKey } from "@/lib/abuse/turnstile-public";

export type ChallengeStatus = "idle" | "ready" | "failed" | "expired" | "blocked" | "missing";

type Props = {
  onToken: (token: string | null) => void;
  disabled?: boolean;
  purpose?: "publish" | "react";
};

export function TurnstileGate({ onToken, disabled, purpose = "publish" }: Props) {
  const siteKey = turnstileSiteKey();
  const scheme = useThemeScheme();
  const [status, setStatus] = useState<ChallengeStatus>(siteKey ? "idle" : "missing");
  const [widgetKey, setWidgetKey] = useState(0);

  function retry() {
    onToken(null);
    setStatus("idle");
    setWidgetKey((value) => value + 1);
  }

  if (!siteKey) {
    return (
      <p className="text-sm text-mist" role="status">
        {purpose === "react"
          ? "This browser needs a check before more 🔥. You can keep reading the wall."
          : "Verification is unavailable, so publishing is paused. You can still read the wall."}
      </p>
    );
  }

  return (
    <div>
      <Turnstile
        key={`${widgetKey}-${scheme}`}
        siteKey={siteKey}
        onSuccess={(token) => {
          setStatus("ready");
          onToken(token);
        }}
        onExpire={() => {
          setStatus("expired");
          onToken(null);
        }}
        onTimeout={() => {
          setStatus("failed");
          onToken(null);
        }}
        onError={() => {
          setStatus("failed");
          onToken(null);
        }}
        onUnsupported={() => {
          setStatus("blocked");
          onToken(null);
        }}
        options={{
          theme: scheme,
          size: "flexible",
          appearance: "always",
        }}
      />
      {status === "failed" || status === "expired" ? (
        <div className="mt-3" role="alert">
          <p className="text-sm text-paper">
            {status === "expired"
              ? "Verification expired. Try the check again."
              : "Verification failed. You can keep reading the wall."}
          </p>
          <button
            type="button"
            onClick={retry}
            disabled={disabled}
            className="btn-ghost mt-2 text-ember hover:text-paper"
          >
            Retry check
          </button>
        </div>
      ) : null}
      {status === "blocked" ? (
        <p className="mt-3 text-sm text-mist" role="status">
          {purpose === "react"
            ? "This browser blocked the verification widget. You can keep reading the wall."
            : "This browser blocked the verification widget. Publishing needs it; reading does not."}
        </p>
      ) : null}
    </div>
  );
}
