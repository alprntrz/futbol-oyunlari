# Tiktako: para kazanma (reklam + Plus) kurulum listesi

Kod hazır (`MONETIZE` anahtarı `mobile/src/lib/features.ts`); bu listedeki hesap ve mağaza işleri
yapılmadan **hiçbir şey canlıya çıkmaz**: reklam birimi id'si yoksa reklam yüklenmez, RevenueCat
anahtarı yoksa paywall "bu sürümde kullanılamıyor" der. Hepsi global kitle için düşünüldü:
fiyatlar mağazaların bölgesel fiyat tablosuyla, onay akışı Google UMP (AB/UK/ABD eyaletleri) + iOS ATT ile.

Durum: [x] kodda hazır · [ ] senin yapman gereken

> **1.1 bunlarsız çıkıyor (19.10.2026).** "1.1 without ads and Plus" commit'i `MONETIZE`'ı kapatır, AdMob / takip
> eklentilerini app.json'dan çıkarır, `mobile/react-native.config.js` + `package.json` `expo.autolinking.exclude` ile
> AdMob, RevenueCat ve ATT'nin native kısmını build dışında tutar ve arşiv girişlerini gizler (`useArchiveOpen`).
> Tam hali `monetization-full` etiketinde. **1.2'de açmak:** o commit'i `git revert` et, sonra bu listeye devam.

## 1. Model (karar verildi, 18.10.2026)

- **Ödüllü reklam (isteğe bağlı):** antrenman XP tavanını kaldır (+150, günde 2), bozulan seriyi onar (ayda 1),
  günlük hediyeyi ikiye katla (günde 1). Hiçbiri maçın içine dokunmaz.
- **Geçiş reklamı (interstitial):** yalnızca solo oyun bitiminde, kurulumdan 3 gün sonra, oturum başına en fazla 2,
  4 dk arayla, açılıştan 3 dk önce asla, online/saatli ekranlarda asla. Plus kapatır. Banner yok.
- **Tiktako Plus:** aylık / yıllık (7 gün deneme önerisi) / ömür boyu. Reklamsız, tavansız antrenman, 30 günlük
  bulmaca arşivi, ücretsiz seri onarımı, Plus çerçevesi. Joker, can, süre, Elo: **asla**.
- Sayılar: `src/lib/plus.ts` (`AD_RULES`, `ARCHIVE_DAYS`, ürün id'leri).

## 2. AdMob

- [x] AdMob hesabı açıldı; iOS uygulaması "Tiktako" eklendi (19.10.2026, mağazaya henüz bağlı değil, onay durumu
      "İnceleme gerekli"): App ID `ca-app-pub-2321803679128648~7767345693`. 1.0 yayınlanınca AdMob → Uygulama ayarları →
      Uygulama mağazası ayrıntıları → Ekle ile App Store'a bağla (Google incelemesi ancak o zaman başlar).
- [ ] Android uygulamasını ekle (Play hesabı doğrulanınca). App ID'leri
      `mobile/app.json` → `react-native-google-mobile-ads` eklentisine yaz (şimdikiler Google'ın **test** app id'leri;
      yayınlanan build'de test id kalırsa reklam gelmez).
- [ ] Reklam birimleri: her platform için **Rewarded** ve **Interstitial** birer tane. Id'leri `mobile/eas.json` →
      `EXPO_PUBLIC_ADMOB_REWARDED_IOS/ANDROID`, `EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS/ANDROID` (production ve preview).
      Boşken dev build Google'ın test birimlerini kullanır, mağaza build'i hiç reklam göstermez.
- [ ] AdMob → Gizlilik ve mesajlaşma: **GDPR** mesajı (AB/UK), **ABD eyalet** mesajı, **IDFA açıklama** mesajı; hepsini
      yayımla. Uygulama `AdsConsent.gatherConsent()` ile bunları gösterir; Ayarlar → "Reklam gizlilik seçenekleri"
      formu yalnızca gereken bölgelerde çıkar.
- [ ] Reklam içerik derecesi kodda **PG** (`maxAdContentRating`), yaş derecelendirmesi 4+/9+ ile uyumlu.
- [ ] app.json'daki `skAdNetworkItems` listesini Google'ın güncel listesinden kontrol et
      (https://developers.google.com/admob/ios/ios14#skadnetwork). Eksik id zarar vermez, fazlası da; ama liste eskiyse
      iOS atıf gelirini düşürür.
- [x] app-ads.txt yayında: https://alprntrz.github.io/app-ads.txt (`google.com, pub-2321803679128648, DIRECT, f08c47fec0942fa0`),
      ayrı depo `alprntrz/alprntrz.github.io` (alan adının kökü; kök sayfa Tiktako sitesine yönlendirir). Mağaza sayfalarındaki
      geliştirici / pazarlama sitesi `alprntrz.github.io` altında kalmalı ki AdMob dosyayı bulsun. AdMob uygulamayı mağazaya
      bağladıktan sonra "app-ads.txt" sekmesinde doğrulamayı kontrol et.

## 3. RevenueCat + mağaza ürünleri

- [ ] App Store Connect → Abonelikler: grup "Tiktako Plus"; ürünler `tiktako_plus_monthly` (1 ay), `tiktako_plus_yearly`
      (1 yıl, **7 gün ücretsiz deneme** tanıtım teklifi); tüketilmeyen ürün `tiktako_plus_lifetime`. Fiyat: "fiyat
      tablosundan" bölgesel eşitleme (önerilen taban: aylık 3,99 $, yıllık 24,99 $, ömür boyu 59,99 $; Türkiye için
      Apple'ın tablo karşılığı ~ 79 / 399 / 999 TL; istersen TR'yi elle düşür).
- [ ] Google Play Console → aynı id'lerle abonelikler (temel planlar aylık/yıllık, yıllıkta 7 gün deneme teklifi) ve tek
      seferlik ürün. Play'de "tüm ülkeler" + bölgesel fiyat düzenleme açık.
- [ ] RevenueCat projesi: iki uygulama (App Store, Play), ürünleri bağla, entitlement **`plus`** (kodda
      `PLUS_ENTITLEMENT`), bir Offering (current) içinde `$rc_monthly`, `$rc_annual`, `$rc_lifetime` paketleri.
- [ ] Public API anahtarları → `mobile/eas.json` `EXPO_PUBLIC_RC_IOS_KEY`, `EXPO_PUBLIC_RC_ANDROID_KEY`.
- [ ] Sunucu: Fly secrets `REVENUECAT_SECRET` (RevenueCat **secret** API key, v1) ve `REVENUECAT_WEBHOOK_AUTH`
      (uydurduğun uzun bir değer). RevenueCat → Integrations → Webhooks: URL `https://tiktako.fly.dev/api/rc/webhook`,
      Authorization header = aynı değer. Sunucu entitlement'ı yalnızca RevenueCat'e sorarak yazar
      (`server-accounts.js` `/api/account/plus/sync`, `handleRcWebhook`); telefonun beyanına inanmaz.
- [ ] App Store Connect → Uygulama bilgileri → **Paid Apps** sözleşmesi imzalı, vergi/banka bilgileri tamam (yoksa
      sandbox'ta bile ürün gelmez).

## 4. Gizlilik ve mağaza etiketleri (reklam açılmadan önce)

- [x] `site/privacy.html`: reklam (AdMob), onay, satın alma (RevenueCat) bölümleri; "reklam yok" sözü kaldırıldı.
- [ ] App Store **App Privacy**: Takip = **Evet** (ATT izin verirse IDFA reklam için kullanılır). Toplanan: Tanımlayıcılar →
      Cihaz Kimliği, Kullanım Verisi → Reklam Verisi, Satın Alma → Satın alma geçmişi (RevenueCat), ayrıca eskiden
      olanlar. Üçüncü taraf reklam amacı işaretli.
- [ ] Play **Veri güvenliği** formu: Cihaz veya diğer kimlikler, Uygulama etkileşimleri / reklam, Satın alma geçmişi;
      "Reklam içerir" = evet; mağaza sayfasında "Uygulama içi satın alma" otomatik gelir.
- [ ] İnceleme notu güncelle (`app-store-v1.md` §6'daki "no purchases or ads" artık yanlış):
      "Optional rewarded ads and a 'Tiktako Plus' subscription (monthly/yearly/lifetime). Purchases never affect
      matches. Sandbox tester: <hesap>."

## 5. Build ve yayın

- Native modül eklendi (`react-native-google-mobile-ads`, `react-native-purchases`, `expo-tracking-transparency`):
  **mağaza build'i şart**, OTA yetmez. iOS: `EXPO_NO_CAPABILITY_SYNC=1 npx eas-cli build -p ios --profile production`.
  Build 23+'tan sonraki ilk sürüm: `MIN_APP_VERSION`'ı yükseltme (eski sürümler reklamsız çalışmaya devam eder, sorun değil).
- [ ] TestFlight'ta: ödüllü reklam (test birimi), interstitial kuralları (ilk 3 gün çıkmaz: `ads-v1` kaydını silip
      test et), sandbox satın alma, geri yükle, hesaba giriş sonrası Plus çerçevesinin sıralamada görünmesi, "Verilerimi sil"
      sonrası Plus'ın geri yüklenebilmesi.
- [ ] Gelir izleme: AdMob raporu (eCPM ülke bazlı), RevenueCat Charts (trial → paid dönüşümü). Hedefler:
      ARPDAU TR 0,01–0,03 $, AB 0,05–0,10 $; Plus dönüşümü aktiflerin %1–3'ü.

## 6. Kapsam dışı (bilerek)

- Sanal para / sandık / satın alınan joker: yok (adalet + App Store loot box riski).
- Banner: yok. Açılış reklamı (app open): yok.
- Sezonluk kozmetik pass: DAU yeterli olunca, ayrı bir iş.
