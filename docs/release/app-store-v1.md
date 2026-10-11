# Tiktako: App Store v1 kontrol listesi

Durum işaretleri: [x] yapıldı · [ ] senin yapman gereken · [~] karar bekliyor

## 1. Hesaplar ve kimlik

- [ ] **Apple Developer Program** üyeliği (yıllık 99 $). Bireysel ya da şirket; şirket olursa D-U-N-S numarası gerekir ve onay birkaç gün sürer.
- [ ] **App Store Connect**'te yeni uygulama: platform iOS, dil Türkçe (ikinci dil İngilizce), bundle ID `com.alprntrz.tiktako` (app.json'da hazır; ilk yüklemeden sonra değişmez, kullanıcı görmez).
- [ ] **Expo hesabı** + `npx eas login`, ardından `cd mobile && npx eas init` (projeye EAS id'si yazılır).
- [x] **Uygulama adı**: Tiktako (bkz. §9 riskler). Alt başlık ve metinler: `metadata.md`.

## 2. Sunucu (en kritik madde)

Online modlar (Hat-trick online/rastgele, Bilgi Yarışı, Possession) `server.js`'e bağlanıyor. Şu an sadece bilgisayarında çalışıyor. **İnceleme ekibi online moda girdiğinde sunucu açık olmalı**, yoksa "çalışmıyor" diye reddedilir (Guideline 2.1).

- [x] Kurulum hazır: `Dockerfile` + `fly.toml` (Frankfurt, tek makine, hiç uyumaz, 512 MB, 1 GB kalıcı disk `tiktako_data`; Bilgi Yarışı puanları diskte). Yerelde aynı dosyalarla build + çalıştırma + WebSocket testi geçti. Aylık ~4 $.
- [x] `flyctl` kurulu (`~/.fly/bin/flyctl`).
- [x] **Canlı**: https://tiktako.fly.dev (Fly app `tiktako`, makine `fra`, disk `/data`). HTTPS + WebSocket dışarıdan test edildi.
- Güncelleme: `server.js` değişince repo kökünde `~/.fly/bin/flyctl deploy --remote-only --ha=false` (main'e push otomatik deploy etmez). Loglar: `flyctl logs -a tiktako`.
- [x] `mobile/eas.json` → `https://tiktako.fly.dev`.

## 3. Build

- [x] `eas.json` (development / preview / production profilleri)
- [x] `ITSAppUsesNonExemptEncryption: false` (sadece HTTPS; ihracat uyumluluk sorusu otomatik geçer)
- [x] Mikrofon / arka plan ses izni kapalı (expo-audio)
- [x] Onboarding v1'de kapalı (`mobile/src/lib/features.ts`)
- [x] EAS projesi `@alperenterzi/tiktako`, sertifika/profil EAS'ta, App Store Connect uygulaması `6821740252`, gönderim anahtarı EAS'ta.
- [x] Build 3 (1.0.0) TestFlight'a yüklendi. Yeni build: `cd mobile && npx eas-cli build -p ios --profile production --auto-submit --non-interactive` (build numarasını EAS artırır).
- [ ] TestFlight'ta kendi telefonunda bir tur: her oyunu aç, online maçı iki telefonla dene.

## 4. Mağaza sayfası

- [x] **Ekran görüntüleri** (6.9", 1320×2868, RGB, şeffaflık yok): yüklenecek son hali `store/tr/` ve `store/en/`, dosya adı sırasıyla. Ham çekimler `screenshots/`, üretim promptları `screenshot-prompts.md`; `store/*/validation.json` her görseldeki ekranın ham çekimle piksel piksel aynı olduğunu kaydeder (Guideline 2.3.3).
  - [ ] App Store Connect → iOS → 6.9" Display: `store/tr` Türkçe sayfaya, `store/en` İngilizce sayfaya.
- [ ] **Açıklama** (TR + EN), **anahtar kelimeler** (100 karakter), **tanıtım metni** (170 karakter, inceleme gerektirmeden değişir).
- [ ] **Uygulama ikonu** 1024×1024: `mobile/assets/brand/app-icon.png` hazır (şeffaflık olmamalı, kontrol et).
- [ ] **Kategori**: Oyunlar → Bilgi Yarışması (Trivia); ikinci kategori Spor.
- [ ] **Yaş derecelendirmesi** anketi: şiddet/kumar yok. "Kullanıcılar arası etkileşim" sorusuna **evet** (takma adlar başkalarına görünüyor). Sonuç büyük ihtimalle 4+ veya 9+.
- [ ] **Telif**: "© 2026 <adın>".

## 5. Gizlilik

- [x] **Gizlilik politikası**: `site/privacy.html` → https://alprntrz.github.io/futbol-oyunlari/privacy.html
- [x] **Destek sayfası**: `site/support.html` → https://alprntrz.github.io/futbol-oyunlari/support.html
- [x] GitHub Pages açık (Source: GitHub Actions); `main`'e her push'ta `.github/workflows/pages.yml` yayımlar. Linkler canlı.
- [x] Uygulama içinde: Ayarlar → Gizlilik politikası / Destek / **Verilerimi sil** (telefon + sunucu kaydı)
- [x] Commit yazar e-postaları GitHub noreply adresine çevrildi; repoda kişisel bilgi, anahtar ya da `.env` yok.
- [ ] **App Privacy (beslenme etiketi)** soruları, doğru cevaplar:
  - Takip (tracking): **Hayır**. Reklam yok, analitik SDK yok.
  - Toplanan veri: **Kullanıcı İçeriği → Oyun içeriği** (takma ad, maç sonuçları), **Tanımlayıcılar → Kullanıcı Kimliği** (rastgele cihaz kimliği). İkisi de "uygulama işlevselliği" için, kimliğe bağlı değil, takip için değil.
  - Konum, kişiler, sağlık, ödeme vb.: hiçbiri.

## 6. İnceleme notları (App Review Information)

Kopyala-yapıştır taslağı:

> No login is required. All games work offline except the online modes (Hat-trick online/random opponent, Football Quiz, Possession Play online), which connect to our game server. When no other player is searching, the random-opponent modes match the player with a computer opponent so the game can always be played. Nicknames are filtered for offensive words on the server. There are no purchases or ads in this version.

- [ ] **İletişim bilgisi** (ad, telefon, e-posta) inceleme ekibi için.
- [~] **Bot rakipler**: Rastgele modda bot olduğu belli olmayan rakipler var. Apple "yanıltıcı davranış" (Guideline 2.3/5.6) açısından bunu sorun yapabilir. Not içinde açıkça söylemek riski azaltır. Daha güvenli seçenek: botları "CPU" etiketiyle göstermek. Karar senin.

## 7. Bilinen riskler

- **İsim çakışması (önemli)**: App Store'da "Tiki Taka Toe" (Digital Football Games Ltd.) var ve çekirdek oyunu bizim Hat-trick ile aynı. "Tiktako" hem bu isme hem TikTok'un "Tako" asistanına çok yakın. Apple 4.1 (taklit) ve 5.2 (marka) gerekçesiyle reddedebilir ya da hak sahibi itiraz edebilir. İsim tek yerden değişiyor: `mobile/app.json` (`name`, `CFBundleDisplayName`), `src/lib/strings.ts` (`appName`), `site/*.html`.

- **Veri lisansı (Guideline 5.2.1)**: Oyuncu/maç verisi Transfermarkt kaynaklı. İlk incelemede genellikle sorun çıkmaz (logo yok, gerçek fotoğraf yok, sadece isim ve renkler). Lisansı yayından sonra almak planın; bir hak sahibi itiraz ederse Apple uygulamayı kaldırabilir, o yüzden ertelememek iyi olur.
- **Kulüp isimleri / formalar**: Arma yok, renkler genel; bu kabul edilen bir uygulama. Mağaza görsellerinde gerçek arma, oyuncu fotoğrafı ya da "resmi" ibaresi kullanma.
- **Minimum işlevsellik (4.2)**: Sorun değil, 7 oyun var.
- **Expo Go'daki mavi dişli** sadece geliştirme menüsü, gerçek build'de görünmez.

## 8. v2'ye bırakılanlar

- Onboarding (`lib/features.ts` → `ONBOARDING = true`)
- Adapty ile paywall / abonelik (StoreKit ürünleri App Store Connect'te tanımlanır; Adapty SDK native modül olduğu için yeni build gerekir)
- Kombine (match-3)
- Lisanslı veri + Wikidata geçişi
