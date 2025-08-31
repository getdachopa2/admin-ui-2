export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
        <h1 className="mb-2 text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-neutral-400">
          Genel durum, son çalıştırmalar ve özet raporlar. (CTA kaldırıldı — Sihirbaz sadece Kanal Kontrol sayfasında.)
        </p>
      </div>

      {/* Örnek kartlar */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Bugünkü Koşular" value="—" />
        <Card title="Başarılı Ödeme" value="—" />
        <Card title="Hata Oranı" value="—" />
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
      <div className="text-xs text-neutral-400">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
