"use client";

import { ChangeEvent, useState, useTransition } from "react";

import { DigestSettings } from "@/lib/types";

type Props = {
  initialSettings: DigestSettings;
};

type SaveState =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

function listToText(values: string[]): string {
  return values.join(", ");
}

export function SettingsForm({ initialSettings }: Props) {
  const [formValues, setFormValues] = useState({
    interests: listToText(initialSettings.interests),
    keywords: listToText(initialSettings.keywords),
    exclusions: listToText(initialSettings.exclusions),
    preferredRegions: listToText(initialSettings.preferredRegions),
    preferredLanguages: listToText(initialSettings.preferredLanguages),
    kindleEmail: initialSettings.kindleEmail,
    senderEmail: initialSettings.senderEmail,
    storyTarget: String(initialSettings.storyTarget),
    timezone: initialSettings.timezone,
    deliveryHour: String(initialSettings.deliveryHour)
  });
  const [saveState, setSaveState] = useState<SaveState>({ type: "idle" });
  const [isPending, startTransition] = useTransition();

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = event.target;
    setFormValues((current) => ({
      ...current,
      [name]: value
    }));
  }

  async function handleSubmit(formData: FormData) {
    const payload = {
      interests: String(formData.get("interests") ?? ""),
      keywords: String(formData.get("keywords") ?? ""),
      exclusions: String(formData.get("exclusions") ?? ""),
      preferredRegions: String(formData.get("preferredRegions") ?? ""),
      preferredLanguages: String(formData.get("preferredLanguages") ?? ""),
      kindleEmail: String(formData.get("kindleEmail") ?? ""),
      senderEmail: String(formData.get("senderEmail") ?? ""),
      storyTarget: Number(formData.get("storyTarget") ?? 10),
      timezone: String(formData.get("timezone") ?? "Europe/Madrid"),
      deliveryHour: Number(formData.get("deliveryHour") ?? 11)
    };

    startTransition(async () => {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setSaveState({
          type: "error",
          message: data.error ?? "Unable to save settings."
        });
        return;
      }

      setSaveState({
        type: "success",
        message: "Settings saved."
      });
    });
  }

  async function handleDryRun() {
    setSaveState({ type: "idle" });
    startTransition(async () => {
      const response = await fetch("/api/digest/run", {
        method: "POST"
      });
      const data = (await response.json()) as {
        error?: string;
        message?: string;
        record?: { reason?: string };
      };

      if (!response.ok) {
        setSaveState({
          type: "error",
          message: data.error ?? data.record?.reason ?? data.message ?? "Dry run failed."
        });
        return;
      }

      setSaveState({
        type: "success",
        message: data.message ?? "Digest run finished."
      });
    });
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Profile</p>
          <h2>Digest settings</h2>
        </div>
        <button className="secondary-button" type="button" onClick={handleDryRun} disabled={isPending}>
          {isPending ? "Working..." : "Run dry delivery"}
        </button>
      </div>

      <form
        className="settings-grid"
        action={async (formData) => {
          await handleSubmit(formData);
        }}
      >
        <label>
          Interests
          <textarea name="interests" value={formValues.interests} onChange={handleChange} rows={3} />
        </label>
        <label>
          Keywords
          <textarea name="keywords" value={formValues.keywords} onChange={handleChange} rows={3} />
        </label>
        <label>
          Exclusions
          <textarea name="exclusions" value={formValues.exclusions} onChange={handleChange} rows={3} />
        </label>
        <label>
          Preferred regions
          <input name="preferredRegions" value={formValues.preferredRegions} onChange={handleChange} />
        </label>
        <label>
          Preferred languages
          <input name="preferredLanguages" value={formValues.preferredLanguages} onChange={handleChange} />
        </label>
        <label>
          Kindle email
          <input name="kindleEmail" type="email" value={formValues.kindleEmail} onChange={handleChange} />
        </label>
        <label>
          Sender email
          <input name="senderEmail" type="email" value={formValues.senderEmail} onChange={handleChange} />
        </label>
        <label>
          Stories per edition
          <input name="storyTarget" type="number" min={8} max={12} value={formValues.storyTarget} onChange={handleChange} />
        </label>
        <label>
          Timezone
          <input name="timezone" value={formValues.timezone} onChange={handleChange} />
        </label>
        <label>
          Delivery hour
          <input name="deliveryHour" type="number" min={0} max={23} value={formValues.deliveryHour} onChange={handleChange} />
        </label>
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save preferences"}
          </button>
          {saveState.type !== "idle" ? (
            <p className={saveState.type === "error" ? "feedback error" : "feedback success"}>
              {saveState.message}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}
