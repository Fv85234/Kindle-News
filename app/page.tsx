import { HistoryList } from "@/components/history-list";
import { SettingsForm } from "@/components/settings-form";
import { readAppData } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await readAppData();
  const { settings, deliveryHistory } = data;

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <h1>Kindle News Daily Digest</h1>
        </div>
        <div className="hero-card">
          <p className="metric-label">Daily schedule</p>
          <p className="metric-value">{settings.deliveryHour}:00</p>
          <p className="metric-copy">{settings.timezone}</p>
          <div className="metric-divider" />
          <p className="metric-label">Edition size</p>
          <p className="metric-value">{settings.storyTarget}</p>
          <p className="metric-copy">top stories from the previous day</p>
        </div>
      </section>
      <SettingsForm initialSettings={settings} />
      <HistoryList history={deliveryHistory} />
    </main>
  );
}
