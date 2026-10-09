# ⚽ Futbol Oyunları

Futbol temalı iki bulmaca oyunu içeren bir web uygulaması: **Eksik 11** (tarihi
maçların ilk 11'ini tahmin et) ve **Tiki Taka Toe** (kulüp/ülke/başarı
kriterlerini sağlayan futbolcuyu bul, 3×3 tic-tac-toe). Arayüz Türkçe + İngilizce.

**Teknolojiler:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 ·
Socket.IO (online yarış için custom Node sunucusu).

---

## Devralan için: önce bunu oku

**Durum (Ekim 2026):** İki oyun da çalışır durumda ve tarayıcıda uçtan uca test
edildi. Eksik 11'de **901 gerçek maç**, Tiki Taka Toe'da **~16.400 futbolcu** var.
`npx tsc --noEmit` ve `npm run lint` hatasız geçiyor (lint'te 9 bilinçli uyarı
var, aşağıda açıklandı).

**Henüz yapılmamış olanlar ve bekleyen kararlar:**

1. **İnternette yayında değil.** Site şimdiye kadar sadece geliştiricinin Mac'inde
   çalıştı. Yayına almak için kalıcı bir Node sunucusu gerekir (aşağıda
   "Yayına alma").
2. **Veri lisansı.** Maç kadrolarının ve futbolcu listesinin çoğu Transfermarkt'tan
   otomatik toplandı. Transfermarkt'ın kullanım şartları otomatik veri toplamayı ve
   ticari kullanımı yasaklıyor; AB'de veritabanları ayrıca korunuyor. Ücretsiz,
   kişisel bir site için risk düşük; **gelir getiren bir ürün için yayından önce
   karar verilmeli** (Wikipedia/Wikidata ile yeniden doğrulama ya da lisanslı bir
   futbol veri API'si).
3. **Mobil uygulama planı.** Hedef, aynı kodu Capacitor ile App Store / Google Play
   uygulamasına çevirmek; uygulamada tarayıcı arayüzü (adres çubuğu vb.) görünmemeli.
   Kabaca: sunucuyu yayına almak → statik export'a uyum (`/eksik-11/oda/[code]`
   dinamik rotası `?code=` parametresine dönmeli) → mobil cila (seçim/zoom/
   pull-to-refresh kapatma, safe-area, splash, haptik) → mağaza hazırlığı.

İlk gün yapılacaklar: aşağıdaki "Hızlı başlangıç"ı çalıştır, iki oyunu da bir tur
oyna, sonra "Proje yapısı" ve "Veri modeli" bölümlerini oku.

---

## Hızlı başlangıç

Gereksinim: **Node.js 22.18 veya üstü** (24 LTS önerilir; `.nvmrc` var →
`nvm use`). Uygulamanın kendisi Node 20.9+ ile de çalışır, ama `scripts/` altındaki
veri scriptleri doğrudan `.ts` dosyası import ettiği için 22.18+ ister.

```bash
git clone https://github.com/alprntrz/futbol-oyunlari.git
cd futbol-oyunlari
npm ci
npm run dev      # http://localhost:3000  (node server.js — Next + Socket.IO)
```

Depo gizli: erişim için depo sahibinin sizi *Settings → Collaborators* üzerinden
eklemesi gerekir. Her push ve pull request'te GitHub Actions `tsc`, `lint` ve
`build` çalıştırır (`.github/workflows/ci.yml`). Claude Code kullanıyorsanız proje
notları `CLAUDE.md`'de.

Production:

```bash
npm run build
npm start        # NODE_ENV=production node server.js  (port: PORT env, varsayılan 3000)
```

> **Not:** `dev`/`start` düz `next` yerine `server.js`'i çalıştırır, çünkü online
> yarış Socket.IO gerektirir. Bu yüzden uygulama **serverless (Vercel/Netlify)
> ile çalışmaz.** Tek kişilik modların hepsi sunucusuz da çalışır; sadece
> "Online Yarış" canlı sunucu ister.
>
> **Dev modu uzun süre açık bırakılmamalı:** Next.js dev sunucusu (HMR) saatler
> içinde birkaç GB belleğe çıkıp çökebiliyor. Sürekli açık kalacak her kurulum
> için `npm run build && npm start` kullanın.

---

## Oyunlar

### 1) Eksik 11 (Missing XI) — `/eksik-11`
Tarihi bir maçın ilk 11'i sahada forma olarak dizilir; her forma bir mini-Wordle:
oyuncunun soyadını harf harf tahmin edersin (yeşil = doğru yer, sarı = var ama
başka yerde, gri = yok). Normal: oyuncu başına 6 hak, 3 yanlıştan sonra ilk harf
ipucu. Zor: 4 hak, ipucu yok. Gol atanların formasında top işareti var.

- **Günün Kadrosu** (`/eksik-11`): gün numarasından deterministik seçilen maç (tüm
  `MATCHES`). İlerleme, seri ve istatistik `localStorage`'da; emoji ile paylaşım.
- **Pratik** (`/eksik-11/pratik`): rastgele **global** maç (2005+, Türk-etiketsiz).
- **Türk Takımları** (`/eksik-11/turkiye`): sadece `tags:["turkiye"]` maçlar.
- **Online Yarış** (`/eksik-11/oda`): 5 karakterli oda kodu, en fazla 2 oyuncu,
  aynı kadroyu yarışarak çözerler. Kazanan: önce 11'i bilen → daha çok bilen → daha
  az tahmin → berabere.

### 2) Tiki Taka Toe — `/tiki-taka-toe`
3×3 ızgara; her satır/sütun bir kriter (**kulüp**, **ülke** veya **başarı rozeti**).
Boş kareye o satır ve sütunun ikisini de sağlayan bir futbolcu yazılır. İki oyuncu
aynı cihazda (X / O) sırayla oynar, **hamle başına 45 sn**; 3'ü yan yana getiren
kazanır. Her futbolcu bir kez kullanılır; yanlış tahmin ya da süre bitimi sırayı
geçirir. Yazdıkça canlı arama önerileri çıkar. Izgara üretici her karenin
çözülebilir olduğunu garanti eder (ülke×ülke yok, en fazla 2 rozet). Kulüp armaları
yerine renkli rozet (kısa kod + kulüp renkleri), oyuncu fotoğrafı yerine baş harfli
avatar kullanılır.

---

## Proje yapısı

```
server.js                      # Custom Next + Socket.IO sunucu (oda/yarış, bellekte)
src/
  app/                         # App Router sayfaları
    page.tsx                   #   ana menü (iki oyun kartı)
    eksik-11/                  #   Eksik 11 rotaları (page, pratik, turkiye, oda, oda/[code])
    tiki-taka-toe/page.tsx     #   Tiki Taka Toe sayfası
    layout.tsx, globals.css
  components/                  # React bileşenleri (MissingXIGame, GuessModal, TikiTakaToe, ...)
  lib/
    types.ts                   # Match / LineupPlayer / FormationKey tipleri
    formations.ts              # 13 formasyonun saha koordinatları (slot sırası = lineup sırası)
    daily.ts                   # günlük seçim + globalMatches() / turkishMatches() havuzları
    wordle.ts                  # tahmin değerlendirme + normalizeAnswer
    i18n.tsx                   # TR/EN sözlük (yeni metin iki dile de eklenmeli)
    tiki.ts                    # Tiki Taka kriterleri (CLUBS/COUNTRIES/BADGES) + ızgara/arama
    socket.ts, stats.ts
  data/                        # OYUN VERİSİ (aşağıya bak)
scripts/                       # veri toplama / üretme scriptleri (aşağıya bak)
  lib/tm.mjs, lib/leagues.mjs  #   Transfermarkt yardımcıları + lig/derbi yapılandırması
  .cache/raw-squads.json       #   Tiki Taka kadro önbelleği (commit'li)
data-drafts/league-*.json      # lig/derbi maçlarının ham taslakları (commit'li, aşağıya bak)
```

Statik görsel eklenecekse kökte bir `public/` klasörü açılır (şu an yok).

---

## Veri modeli

### Eksik 11 — maçlar (901)
`src/data/matches.ts` içindeki `MATCHES`, tüm veri dosyalarını birleştirir:

| Dosya | Maç | İçerik | Nasıl üretildi |
|---|---|---|---|
| `matches.ts` (MATCHES_BASE) + `matches-extra.ts` + `matches-batch3.ts` | 15 + 22 + 17 | DK/ŞL/EURO/Copa finalleri, 1970–2025 | Wikipedia (`fetch-lineup.mjs`) + elle düzenleme |
| `matches-global.ts` | 15 | 2005+ UEFA Kupası/Avrupa Ligi finalleri ve seçmeler | Wikipedia + elle |
| `matches-knockouts.ts` | 185 | 2005+ ŞL/DK çeyrek-yarı, EL/UEFA Kupası yarı finalleri | Transfermarkt, tek seferlik script (repoda yok) |
| `matches-turkiye.ts` | 19 | Milli takım + Türk kulüplerinin seçme maçları | elle |
| `matches-turkiye-kupasi.ts` | 20 | 2005–2024 Türkiye Kupası finalleri | Transfermarkt, tek seferlik script (repoda yok) |
| `matches-derbiler.ts` | 153 | GS/FB/BJK derbileri, 2005–2026 | `build-league-derbies.mjs derbiler` → `leagues-to-ts.mjs` |
| `matches-ligler.ts` | 455 | La Liga / Premier Lig / Serie A / Bundesliga derbileri ve dev maçları + Trabzonspor–3 büyükler | `build-league-derbies.mjs` → `leagues-to-ts.mjs` |

"Repoda yok" olan dosyalar artık elle bakımı yapılan veri olarak düşünülmeli;
yeniden üretilmeleri gerekirse `scripts/lib/tm.mjs` aynı işin yapı taşlarını içerir.

`Match` tipi `src/lib/types.ts`'te. Her maçta **kazanan takımın** ilk 11'i sorulur
(beraberlikte ev sahibinin). **Önemli konvansiyon:** `lineup` dizisi GK'den başlar ve
`FORMATIONS[formation]` slot sırasına göre dizilir; **dörtlü savunmada sıra
[GK, RB, RCB, LCB, LB] = sağ→sol** (takımın sağı ekranın sağı). `answer` büyük harf
ASCII'dir; çok kelimeli soyadlarda boşluk içerir (`"DI MARIA"`) ve ekranda harf
grupları arasında boşluk olarak görünür.

**Havuzlar** (`src/lib/daily.ts`): `turkishMatches()` = `tags:["turkiye"]` (249 maç);
`globalMatches()` = Türk-etiketsiz **ve** yıl ≥ 2005 (638 maç). Pratik
`globalMatches()`, Türk Takımları `turkishMatches()`, Günün Kadrosu tüm `MATCHES`
kullanır. **Dikkat:** günlük maç `MATCHES[hash(gün) % MATCHES.length]` ile
seçildiği için maç eklemek/çıkarmak o günden sonraki günlük sırayı değiştirir
(o günün kayıtlı ilerlemesi `matchId` kontrolüyle korunur).

### Tiki Taka Toe — futbolcular
`src/data/players.ts` (**~16.400 futbolcu, ÜRETİLMİŞ dosya — elle düzenleme**).
`GridPlayer` = `{ name, country, clubs[], badges?, aliases?, photo? }`. Transfermarkt
kulüp kadrolarından (1950–2025) çekilip elle küratörlü set (rozetler) ile
birleştirildi; tanınırlığa göre sıralı (arama yıldızları önce getirir).
Kriter tanımları `src/lib/tiki.ts` (31 kulüp, 34 ülke, 4 rozet: wc/ucl/ballon/euro).

---

## Veriyi yeniden üretme / genişletme (`scripts/`)

Hepsi bağımlılıksız Node scriptleri (**Node 22.18+**), proje kökünden çalıştırılır.
Transfermarkt'a istekler arası en az ~2,2 sn beklenerek gidilir (`TM_GAP_MS`; uzun
koşularda 2600 kullanıldı). TM yaklaşık her 15 istekte bir 403/429 verir; scriptler
bekleyip kendileri devam eder.

**Lig ve derbi maçları (ana yol):**

```bash
node scripts/build-league-derbies.mjs laliga premier seriea bundesliga superlig derbiler
node scripts/leagues-to-ts.mjs
```

- `build-league-derbies.mjs` her eşleşme için Transfermarkt'ın karşılaşma
  listesinden maçları alır, `take` kadarını **2005'ten bugüne yıllara eşit
  yayarak** seçer ve `data-drafts/league-<lig>.json`'a yazar. Takımlar (TM id, isim,
  forma renkleri), eşleşmeler ve yarışma adları `scripts/lib/leagues.mjs`'te; yeni
  bir derbi için oraya bir `{a, b, take, derby}` satırı eklemek yeter. Çekilen maç
  kağıtları `scripts/.cache/tm/`'de önbelleklenir (git'e girmez). Env:
  `PAIR=rma_fcb` (tek eşleşme), `TAKE=5`, `YMIN=2005`, `TM_GAP_MS=2600`. Tam koşu
(~600 maç) önbellek boşken birkaç saat sürer.
- **Oyuncu yerleşimi:** TM maç sayfasındaki diziliş grafiğinden her oyuncunun x/y
  konumu okunur ve `src/lib/formations.ts`'teki şablonlara en iyi oturan eşleşme
  (Macar algoritması) seçilir (`arrangeByPitch`). Grafiği olmayan eski maçlarda
  mevki etiketlerinden tahmin edilir (`arrange`). Stoperlerin sağ/sol sırası bu
  sayede doğru gelir.
- **Cevaplar** (`answerFor`): soyad; "De Bruyne" → `DE BRUYNE`, "Vinícius Júnior" →
  `VINICIUS`, lakaplar `ANSWER_OVERRIDES` ile (`SOKRATIS`, `KEPA`), aynı kadroda iki
  aynı soyad → `ERIC GARCIA`.
- `leagues-to-ts.mjs` taslakları `src/data/matches-ligler.ts` ve
  `src/data/matches-derbiler.ts`'e çevirir: diğer veri dosyalarıyla aynı tarih+takım
  çakışmalarını eler, hedef başına en fazla 12 adet 0-0 bırakır. **Bir hedefin
  taslaklarından biri eksikse o dosyaya dokunmaz** (yarım veriyle üzerine yazmamak
  için). Taslaklar commit'li olduğu için temiz bir kopyada çalıştırmak aynı
  dosyaları birebir üretir.

**Diğer Eksik 11 araçları:**
- `node scripts/fetch-lineup.mjs "2005 UEFA Champions League final"` — Wikipedia maç
  sayfasından ilk 11 (finaller için).
- `node scripts/fetch-tm.mjs <maçId>` — tek bir Transfermarkt maç kağıdını JSON
  olarak yazdırır (hata ayıklama için).

**Tiki Taka Toe futbolcu havuzu (2 adım):**
1. `node scripts/tiki-scrape-squads.mjs` — 31 kulübün kadrolarını çeker
   → `scripts/.cache/raw-squads.json` (kaldığı yerden devam eder; `FROM=1950 TO=2025`).
2. `node scripts/tiki-build-players.mjs` — kadro önbelleği + `scripts/tiki-curated.json`
   (elle rozet/alias seti) → `src/data/players.ts`.

> Kulüp/ülke kriteri **eklemek** için: `src/lib/tiki.ts`'teki CLUBS/COUNTRIES'e
> ekle; kulüp için `scripts/tiki-scrape-squads.mjs`'e TM kulüp id'sini ekleyip iki
> scripti tekrar çalıştır. Rozet **eklemek/düzeltmek** için sadece
> `scripts/tiki-curated.json`'ı düzenleyip `tiki-build-players.mjs`'i çalıştır
> (önbellek commit'li olduğu için yeniden toplamaya gerek yok).

**Gerçek arma/foto (opsiyonel, telif sorumluluğu kullanana ait):** görseli `public/`
altına koy; kulüp için `tiki.ts` CLUBS'ta `crest:"/..."`, oyuncu için
`tiki-curated.json`'da `photo:"/..."` alanını doldur. Boşsa renkli rozet/avatar
gösterilir.

---

## Doğrulama

```bash
npx tsc --noEmit     # tip kontrolü — 0 hata
npm run lint         # 0 hata, 9 uyarı (aşağıda)
npm run build        # production derleme
```

Lint uyarıları bilinçli: istemci bileşenleri `localStorage` / `navigator` değerini
mount effect'inde okuyup state'e yazar (render sırasında okumak sunucu HTML'i ile
ilk istemci render'ını farklılaştırır). Bu yüzden `react-hooks/set-state-in-effect`
`eslint.config.mjs`'te uyarıya çekildi. Kalan 2 uyarı opsiyonel oyuncu fotoğrafı
için kullanılan `<img>`.

Otomatik test yok; değişiklikten sonra iki oyunu tarayıcıda bir tur oynayarak
kontrol edin (özellikle günlük ilerlemenin sayfa yenilenince geri gelmesi ve iki
sekmeyle online yarış).

---

## Yayına alma (deploy)

Kalıcı bir Node süreci gereken her yer olur: Railway, Render, Fly.io, bir VPS (PM2
ile), Docker.

- Build komutu: `npm ci && npm run build`
- Start komutu: `npm start` (servisin verdiği `PORT` ortam değişkenini kullanır)
- Tek örnek (instance) çalıştırın: online odalar sunucu belleğinde tutulur; birden
  fazla örnek ya da yeniden başlatma odaları böler/sıfırlar.

**Bir Mac'te sürekli çalıştırma (opsiyonel):** geliştirme sırasında site bir macOS
LaunchAgent ile çalıştırıldı (`~/Library/LaunchAgents/<label>.plist`: `node server.js`,
`WorkingDirectory` = proje klasörü, `NODE_ENV=production`, `RunAtLoad` ve `KeepAlive`
açık). Kod değişince `npm run build` ve
`launchctl kickstart -k gui/$(id -u)/<label>`.

---

## Bilinen sınırlar / yol haritası

- Elle girilen ilk dönem maçlarında (`matches.ts`, `matches-extra.ts`,
  `matches-batch3.ts`, `matches-turkiye.ts`) iki stoperin sağ/sol sırası maç maç
  doğrulanmadı; otomatik üretilen 600+ maçta sorun yok.
- `src/data/players.ts` ~1,1 MB. Tek rotada (`/tiki-taka-toe`) code-split olur ve
  gzip ile küçülür; ileride ayrı bir JSON'a alınıp çalışma anında yüklenebilir.
- Tiki Taka Toe: tek kişilik mod, online 1v1 (Socket.IO altyapısı hazır), günlük
  ızgara yok. Rozetler yalnızca küratörlü ~175 oyuncuda.
- Eksik 11: geçmiş günlerin arşivi yok; istatistikler cihaza bağlı (hesap yok).
- Online odalar bellekte; sunucu yeniden başlayınca açık odalar kapanır.
- Kaptanlar çoğu maçta gösterilmez (Transfermarkt maç kağıtlarında işaretli değil).
