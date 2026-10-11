# Tiktako: App Store v1 kontrol listesi

Durum işaretleri: [x] yapıldı · [ ] senin yapman gereken · [~] karar bekliyor

## 1. Hesaplar ve kimlik

- [ ] **Apple Developer Program** üyeliği (yıllık 99 $). Bireysel ya da şirket; şirket olursa D-U-N-S numarası gerekir ve onay birkaç gün sürer.
- [ ] **App Store Connect**'te yeni uygulama: platform iOS, dil Türkçe (ikinci dil İngilizce), bundle ID `com.alprntrz.tiktako` (app.json'da hazır; ilk yüklemeden sonra değişmez, kullanıcı görmez).
- [ ] **Expo hesabı** + `npx eas login`, ardından `cd mobile && npx eas init` (projeye EAS id'si yazılır).
- [x] **Uygulama adı**: Tiktako (bkz. §9 riskler). Alt başlık ve metinler: `metadata.md`.

## 2. Sunucu (en kritik madde)

Online modlar (Hat-trick online/rastgele, Bilgi Yarışı, Possession) `server.js`'e bağlanıyor. Şu an sadece bilgisayarında çalışıyor. **İnceleme ekibi online moda girdiğinde sunucu açık olmalı**, yoksa "çalışmıyor" diye reddedilir (Guideline 2.1).

- [ ] `server.js`'i bir yere kur: Render, Railway, Fly.io (hepsinde Node + WebSocket çalışır, aylık ~5-7 $). HTTPS zorunlu.
- [ ] Bilgi Yarışı seviye/puan durumu `data/quiz-stats.json` dosyasına yazılıyor; sunucuda **kalıcı disk** gerekir (Render "Disk", Railway "Volume"), yoksa her deploy'da sıfırlanır.
- [ ] `mobile/eas.json` içindeki `https://REPLACE-WITH-SERVER-URL` adresini gerçek adresle değiştir.

## 3. Build

- [x] `eas.json` (development / preview / production profilleri)
- [x] `ITSAppUsesNonExemptEncryption: false` (sadece HTTPS; ihracat uyumluluk sorusu otomatik geçer)
- [x] Mikrofon / arka plan ses izni kapalı (expo-audio)
- [x] Onboarding v1'de kapalı (`mobile/src/lib/features.ts`)
- [ ] `npx eas build -p ios --profile production` → `npx eas submit -p ios`
- [ ] TestFlight'ta kendi telefonunda bir tur: her oyunu aç, online maçı iki telefonla dene.

## 4. Mağaza sayfası

- [~] **Ekran görüntüleri**: 6.9" (1320×2868) zorunlu. Ham setler hazır: `screenshots/tr/` ve `screenshots/en/` (8'er ekran). Başlık + çerçeve için ChatGPT promptları: `screenshot-prompts.md`.
- [ ] **Açıklama** (TR + EN), **anahtar kelimeler** (100 karakter), **tanıtım metni** (170 karakter, inceleme gerektirmeden değişir).
- [ ] **Uygulama ikonu** 1024×1024: `mobile/assets/brand/app-icon.png` hazır (şeffaflık olmamalı, kontrol et).
- [ ] **Kategori**: Oyunlar → Bilgi Yarışması (Trivia); ikinci kategori Spor.
- [ ] **Yaş derecelendirmesi** anketi: şiddet/kumar yok. "Kullanıcılar arası etkileşim" sorusuna **evet** (takma adlar başkalarına görünüyor). Sonuç büyük ihtimalle 4+ veya 9+.
- [ ] **Telif**: "© 2026 <adın>".

## 5. Gizlilik

- [x] **Gizlilik politikası**: `site/privacy.html` → https://alprntrz.github.io/futbol-oyunlari/privacy.html
- [x] **Destek sayfası**: `site/support.html` → https://alprntrz.github.io/futbol-oyunlari/support.html
- [ ] GitHub → Settings → Pages → Source: **GitHub Actions**; `main`'e merge edilince `.github/workflows/pages.yml` yayımlar. Linkler açılmadan incelemeye gönderme.
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
