# ⚽ Futbol Oyunları

Futbol temalı iki bulmaca oyunu içeren bir web uygulaması: **Eksik 11** (tarihi
maçların ilk 11'ini tahmin et) ve **Tiki Taka Toe** (kulüp/ülke/başarı
kriterlerini sağlayan futbolcuyu bul, 3×3 tic-tac-toe).

**Teknolojiler:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 ·
Socket.IO (online mod için custom sunucu). Arayüz TR + EN.

---

## Hızlı başlangıç

Gereksinim: **Node.js 18+** (20+ önerilir).

```bash
npm install
npm run dev      # http://localhost:3000  (node server.js — Next + Socket.IO)
```

Prod:

```bash
npm run build
npm start        # NODE_ENV=production node server.js  (PORT env ile port ayarlanır)
```

> **Not:** `dev`/`start` komutları düz `next` yerine `server.js`'i çalıştırır,
> çünkü online yarış modu Socket.IO gerektirir. Bu yüzden uygulama **serverless
> (Vercel/Netlify) ile çalışmaz** — kalıcı bir Node sunucusu gerekir (Railway,
> Render, Fly.io, bir VPS + PM2, Docker vb.). Tiki Taka Toe ve Eksik 11'in
> tekil modları sunucu olmadan da çalışır; sadece "Online Yarış" Socket.IO ister.

---

## Oyunlar

### 1) Eksik 11 (Missing XI) — `/eksik-11`
Tarihi bir maçın ilk 11'i sahada forma olarak dizilir; her forma bir mini-Wordle:
oyuncunun adını harf harf tahmin edersin.
- **Günün Kadrosu** (`/eksik-11`): gün numarasından deterministik seçilen maç.
  Normal/Zor zorluk, seri & istatistik (localStorage), emoji paylaşım.
- **Pratik** (`/eksik-11/pratik`): rastgele **global** maçlar (2005+; Türk-etiketli
  maçlar hariç).
- **Türk Takımları** (`/eksik-11/turkiye`): sadece `tags:["turkiye"]` maçlar.
- **Online Yarış** (`/eksik-11/oda`): oda koduyla aynı kadroyu yarışarak çöz (Socket.IO).

### 2) Tiki Taka Toe — `/tiki-taka-toe`
3×3 ızgara; her satır/sütun bir kriter (**kulüp**, **ülke** veya **başarı rozeti**).
Boş kareye, o satır ve sütunun ikisini de sağlayan bir futbolcu yazarsın.
İki oyuncu (aynı cihaz, X vs O) sırayla oynar, **tur başına 45 sn**; 3'ü yan yana
getiren kazanır. Her futbolcu bir kez kullanılır; yanlış tahmin sırayı geçirir.
Yazdıkça **canlı arama** önerileri çıkar. Kulüp armaları = renkli rozet (short
kod + renk); oyuncu görselleri = baş harfli avatar (gerçek görsel isteğe bağlı,
aşağıya bak).

---

## Proje yapısı

```
server.js                      # Custom Next + Socket.IO sunucu (oda/yarış, in-memory)
src/
  app/                         # App Router sayfaları
    page.tsx                   #   ana menü (iki oyun kartı)
    eksik-11/                  #   Eksik 11 rotaları (page, pratik, turkiye, oda/[code])
    tiki-taka-toe/page.tsx     #   Tiki Taka Toe sayfası
    layout.tsx, globals.css
  components/                  # React bileşenleri (MissingXIGame, TikiTakaToe, ...)
  lib/
    types.ts                   # Match/LineupPlayer/FormationKey tipleri
    formations.ts              # formasyon başına saha koordinatları
    daily.ts                   # günlük seçim + globalMatches()/turkishMatches() havuzları
    wordle.ts                  # tahmin değerlendirme + normalizeAnswer
    i18n.tsx                   # TR/EN sözlük (yeni metin iki dile de eklenmeli)
    tiki.ts                    # Tiki Taka kriterleri (CLUBS/COUNTRIES/BADGES) + ızgara/arama
    socket.ts, stats.ts
  data/                        # OYUN VERİSİ (aşağıya bak)
scripts/                       # veri üretme/çekme scriptleri (aşağıya bak)
public/                        # statik dosyalar (görseller buraya)
```

---

## Veri modeli

### Eksik 11 — maçlar
`src/data/matches.ts` içindeki `MATCHES`, tüm veri dosyalarını birleştirir:

| Dosya | İçerik |
|---|---|
| `matches.ts` (MATCHES_BASE) + `matches-extra.ts` + `matches-batch3.ts` | Küratörlü DK/ŞL/EURO/Copa finalleri (Wikipedia) |
| `matches-global.ts` | 2005+ CL/Avrupa Ligi finalleri |
| `matches-knockouts.ts` | 2005+ CL/DK çeyrek-yarı, EL/UEFA Kupası yarı finalleri (Transfermarkt) |
| `matches-turkiye.ts` | Milli takım + Avrupa geceleri |
| `matches-derbiler.ts` + `matches-derbiler-eski.ts` | GS/FB/BJK derbileri (2005–2026) |
| `matches-turkiye-kupasi.ts` | 2005–2024 Türkiye Kupası finalleri |
| `matches-ligler.ts` | La Liga / Premier Lig / Serie A / Bundesliga derbileri + dev maçları ve Trabzonspor–3 büyükler (2005+, TM; Süper Lig kayıtları `turkiye` etiketli) |

`Match` tipi `src/lib/types.ts`'te. **Önemli konvansiyon:** `lineup` dizisi
GK'den başlar ve formasyon slot sırasına göre dizilir; **dörtlü savunmada sıra
[GK, RB, RCB, LCB, LB] = sağ→sol** (render'da slot 2 görsel sağ, slot 3 görsel
sol). Formasyon koordinatları `src/lib/formations.ts`.

**Havuzlar** (`src/lib/daily.ts`): `turkishMatches()` = `tags:["turkiye"]`;
`globalMatches()` = Türk-etiketsiz **ve** yıl ≥ 2005. Pratik `globalMatches()`,
Türk Takımları `turkishMatches()`, Günün Kadrosu tüm `MATCHES` kullanır.

### Tiki Taka Toe — futbolcular
`src/data/players.ts` (**~16.400 futbolcu, ÜRETİLMİŞ dosya — elle düzenleme**).
`GridPlayer` = `{ name, country, clubs[], badges?, aliases?, photo? }`. Transfermarkt
kulüp kadrolarından (1950–2025) çekilip elle küratörlü set (rozetler) ile
birleştirildi; tanınırlığa göre sıralı (arama yıldızları önce getirir).
Kriter tanımları `src/lib/tiki.ts` (31 kulüp, 34 ülke, 4 rozet: wc/ucl/ballon/euro).

---

## Veriyi yeniden üretme / genişletme (`scripts/`)

Hepsi bağımlılıksız Node scriptleri (Transfermarkt/Wikipedia'ya `fetch`;
User-Agent header yeterli, ~1.3–1.8 sn arayla).

**Eksik 11 maçları:**
- `node scripts/fetch-lineup.mjs "2005 UEFA Champions League final"` — Wikipedia'dan ilk 11.
- `node scripts/build-derbies.mjs` — GS/FB/BJK derbilerini TM maç kağıtlarından üretir
  (env: `TAKE`, `YMIN`, `YMAX` ile aralık; kazananın 11'i, dörtlü savunmada CB sırası düzeltilir).
- `fetch-tm.mjs`, `derbies-to-ts.mjs`, `list-derbies.mjs` — yardımcılar.
- `node scripts/build-league-derbies.mjs [laliga premier seriea bundesliga superlig]` —
  4 büyük lig + Trabzonspor eşleşmelerini TM'den üretir → `data-drafts/league-<lig>.json`.
  Çiftler/takımlar/formalar/yarışma adları `scripts/lib/leagues.mjs`'te (yeni derbi eklemek
  için oraya bir `{a, b, take, derby}` satırı yeter). Her çift, 2005'ten bugüne **yıllara
  eşit yayılmış** `take` maç seçer. Çekilen maç kâğıtları `scripts/.cache/tm/`'de
  önbelleklenir (yeniden çalıştırmak ucuz); TM ~15 istekte bir 403 verir, script bekleyip
  devam eder (`TM_GAP_MS` ile istek aralığı). Env: `PAIR=rma_fcb`, `TAKE=5`, `YMIN=2005`.
  Ardından `node scripts/leagues-to-ts.mjs` → `src/data/matches-ligler.ts` (mevcut
  maçlarla aynı tarih+takım çakışmalarını eler, en fazla 3 adet 0-0 bırakır).
- `scripts/lib/tm.mjs` — iki derbi script'inin ortak kodu (TM fetch, maç kâğıdı parser'ı,
  formasyon eşleyici `arrange`, cevap üretimi `answerFor`: "De Bruyne" → `DE BRUYNE`,
  "Vinicius Junior" → `VINICIUS`, aynı kadroda iki García → `ERIC GARCIA`).
- `fetch-tm.mjs`, `derbies-to-ts.mjs`, `list-derbies.mjs` — yardımcılar.

**Tiki Taka Toe futbolcu havuzu (2 adım):**
1. `node scripts/tiki-scrape-squads.mjs` — 31 kulübün kadrolarını çeker
   → `scripts/.cache/raw-squads.json` (resumable; `FROM=1950 TO=2025` env ile aralık).
2. `node scripts/tiki-build-players.mjs` — kadro cache'i + `scripts/tiki-curated.json`
   (elle rozet/alias seti) birleştirir → `src/data/players.ts`.

> Kulüp/ülke kriteri **eklemek** için: `src/lib/tiki.ts`'teki CLUBS/COUNTRIES'e
> ekle; kulüp için `scripts/tiki-scrape-squads.mjs`'e TM kulüp id'sini ekleyip
> iki scripti tekrar çalıştır. Rozet **eklemek/düzeltmek** için sadece
> `scripts/tiki-curated.json`'ı düzenleyip `tiki-build-players.mjs`'i çalıştır
> (cache commit'li olduğu için yeniden kazımaya gerek yok).

**Gerçek arma/foto (opsiyonel, telif sorumluluğu kullanıcıda):** görseli
`public/` altına koy; kulüp için `tiki.ts` CLUBS'ta `crest:"/..."`, oyuncu için
`players.ts`/`tiki-curated.json`'da `photo:"/..."` alanını doldur. Boşsa
otomatik olarak renkli rozet/avatar gösterilir.

---

## Doğrulama

```bash
npx tsc --noEmit                     # tip kontrolü (0 hata beklenir)
npm run build                        # prod derleme
```

---

## Bilinen sınırlar / yol haritası

- `src/data/players.ts` ~1.1 MB (16k futbolcu). Tek rotada (`/tiki-taka-toe`)
  code-split olur ve gzip ile küçülür, ama prod için veriyi ayrı JSON'a alıp
  runtime `fetch` ile yüklemek daha ideal.
- Rozetler yalnızca küratörlü ~175 setten gelir; kupa/şampiyonluk listeleri
  çekilerek genişletilebilir.
- Tiki Taka Toe: tek-kişilik "grid doldur" modu, online 1v1 (Socket.IO altyapısı
  hazır), günlük ızgara henüz yok.
- Eksik 11: arşiv sayfası; elle girilen eski maçlarda dağınık stoper sırası denetimi.
- Online modlar in-memory (sunucu yeniden başlayınca odalar sıfırlanır).
