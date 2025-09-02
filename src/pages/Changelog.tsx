import React from 'react';

interface ChangelogEntry {
  version: string;
  date: string;
  type: 'feature' | 'improvement' | 'bugfix' | 'breaking';
  title: string;
  description: string;
  items?: string[];
}

const changelogData: ChangelogEntry[] = [
  {
    version: '2.1.0',
    date: '2 Eylül 2025',
    type: 'feature',
    title: 'HTML Export Tam Expanded Format',
    description: 'Test raporu HTML export\'u tamamen yeniden tasarlandı ve genişletildi.',
    items: [
      'Kategori bazında detaylı rapor (Token Alma, Ödeme, İptal, İade)',
      'Request/Response code blocks ile syntax highlighting',
      'XML/SOAP body extraction ve formatlama',
      'Professional dark theme layout',
      'Responsive design ve print-friendly styling'
    ]
  },
  {
    version: '2.0.5',
    date: '1 Eylül 2025',
    type: 'improvement',
    title: 'Dashboard ve Metrik API Ayrımı',
    description: 'Dashboard ve Kanal Kontrol Bot metrik API\'leri ayrıldı.',
    items: [
      'Son 5 ödeme, iptal, iade işlemi listesi',
      'Detay modal\'ları ile işlem özeti',
      'API fallback mekanizması',
      'Scale küçültme ve kompakt tasarım'
    ]
  },
  {
    version: '2.0.4',
    date: '31 Ağustos 2025',
    type: 'improvement',
    title: 'İkon Sadeleştirmesi',
    description: 'Renkli emoji ikonlar kaldırıldı, basit SVG ikonlar kullanıldı.',
    items: [
      'Timeline\'da sadece ✓, ✗, ⟳ ikonları',
      'Professional görünüm için minimal icon set',
      'Performans iyileştirmesi'
    ]
  },
  {
    version: '2.0.3',
    date: '30 Ağustos 2025',
    type: 'feature',
    title: 'Test Summary Report Kategorileri',
    description: 'Test adımları 4 ana kategoriye gruplandırıldı.',
    items: [
      'Token Alma, Ödeme, İptal, İade kategorileri',
      'Expandable kategori detayları',
      'Copy ve Format butonları',
      'XML/JSON formatlama'
    ]
  },
  {
    version: '2.0.2',
    date: '29 Ağustos 2025',
    type: 'feature',
    title: 'Live Steps Timeline',
    description: 'Canlı adımlar için timeline ve animasyon sistemi.',
    items: [
      'Timeline görünümü',
      'Status iconları ve progress bar',
      'Hover efektleri',
      'Hazırlık adımları filtreleme'
    ]
  },
  {
    version: '2.0.1',
    date: '28 Ağustos 2025',
    type: 'improvement',
    title: 'PDF/HTML Export ve Kart Maskeleme',
    description: 'Export fonksiyonları ve güvenlik iyileştirmeleri.',
    items: [
      'jsPDF ve html2canvas entegrasyonu',
      'Kart numarası maskeleme (maskPan)',
      'Responsive layout düzeltmeleri',
      'Polling ve terminal state detection'
    ]
  },
  {
    version: '2.0.0',
    date: '27 Ağustos 2025',
    type: 'breaking',
    title: 'Proje Yeniden Yapılandırması',
    description: 'Ana UI tamamen yeniden tasarlandı.',
    items: [
      'Modern React + TypeScript + Vite stack',
      'Tailwind CSS ile responsive design',
      'Component-based architecture',
      'Dashboard ve wizard sayfaları',
      'Test sonuçları ve canlı takip'
    ]
  }
];

const getTypeIcon = (type: ChangelogEntry['type']) => {
  switch (type) {
    case 'feature':
      return '✨';
    case 'improvement':
      return '⚡';
    case 'bugfix':
      return '🐛';
    case 'breaking':
      return '💥';
    default:
      return '📝';
  }
};

const getTypeColor = (type: ChangelogEntry['type']) => {
  switch (type) {
    case 'feature':
      return 'text-green-400 bg-green-500/20 border-green-500/30';
    case 'improvement':
      return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
    case 'bugfix':
      return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
    case 'breaking':
      return 'text-red-400 bg-red-500/20 border-red-500/30';
    default:
      return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
  }
};

const getTypeLabel = (type: ChangelogEntry['type']) => {
  switch (type) {
    case 'feature':
      return 'Yeni Özellik';
    case 'improvement':
      return 'İyileştirme';
    case 'bugfix':
      return 'Hata Düzeltmesi';
    case 'breaking':
      return 'Breaking Change';
    default:
      return 'Güncelleme';
  }
};

export default function Changelog() {
  return (
    <main className="p-6">
      <div className="space-y-6 px-4 sm:px-0">
        {/* Header */}
        <div className="card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-base-100 mb-2">
                📋 Changelog
              </h1>
              <p className="text-sm text-base-400">
                Kanal Kontrol Bot UI güncellemeleri ve yeni özellikler
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => window.history.back()} 
                className="btn btn-outline btn-sm"
              >
                Geri Dön
              </button>
            </div>
          </div>
        </div>

        {/* Changelog Timeline */}
        <div className="space-y-4">
          {changelogData.map((entry, index) => (
            <div 
              key={`${entry.version}-${index}`}
              className="card p-6 hover:shadow-lg transition-shadow duration-200"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getTypeIcon(entry.type)}</span>
                    <div>
                      <h2 className="text-xl font-bold text-base-100">
                        v{entry.version}
                      </h2>
                      <p className="text-sm text-base-400">{entry.date}</p>
                    </div>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getTypeColor(entry.type)}`}>
                  {getTypeLabel(entry.type)}
                </div>
              </div>

              {/* Content */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-base-100 mb-2">
                    {entry.title}
                  </h3>
                  <p className="text-base-300">
                    {entry.description}
                  </p>
                </div>

                {/* Items List */}
                {entry.items && entry.items.length > 0 && (
                  <div className="bg-base-900/50 rounded-lg p-4 border border-base-700">
                    <h4 className="text-sm font-medium text-base-200 mb-3">
                      Değişiklikler:
                    </h4>
                    <ul className="space-y-2">
                      {entry.items.map((item, itemIndex) => (
                        <li 
                          key={itemIndex}
                          className="flex items-start gap-3 text-sm text-base-300"
                        >
                          <span className="text-green-400 mt-1 flex-shrink-0">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Divider */}
              {index < changelogData.length - 1 && (
                <div className="mt-6 pt-6 border-t border-base-700">
                  <div className="w-full h-px bg-gradient-to-r from-transparent via-base-600 to-transparent"></div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="card p-6 text-center">
          <p className="text-sm text-base-400">
            💡 Önerileriniz ve geri bildirimleriniz için iletişime geçebilirsiniz.
          </p>
        </div>
      </div>
    </main>
  );
}
