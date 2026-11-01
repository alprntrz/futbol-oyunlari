# Apple Ads (eski adı Search Ads) planı (Tiktako)

Durum: plan hazır, 2026-11-01. Popülerlik ve SA/UK CPT önerisi Apple Ads'ten okundu; bütçe, teklif ve CPI hedefleri
varsayımdır. Apple Ads'te kampanya yok; "Strateji" bölümündeki 0. gün koşulları sağlanınca kurulur.

## Doğrulananlar (2026-11-01, Chrome ile)

- Ürünün adı artık **Apple Ads** (ads.apple.com). Yardım: "Apple Ads on the App Store Help".
- Apple'ın kendi yardım sayfası keşif, genel, rakip ve marka kelimelerini **ayrı reklam gruplarına** koymayı öneriyor;
  marka için Exact, keşif için Search Match. Rakip kelimesi kullanmak sayfada normal bir seçenek olarak geçiyor.
- Yeni eklenen kelime varsayılan olarak **Broad** gelir ve kaydedilince eşleşme türü **değiştirilemez**: Exact'ı baştan seç,
  yanlışsa kelimeyi durdurup yenisini ekle. CSV ile toplu yükleme var (UTF-8, ASCII dışı harfler için şart).
- App Review 2.3.7: ad en fazla 30 karakter; meta veriyi ticari marka, popüler uygulama adı vb. ile doldurma; alt başlık
  başka uygulamaya atıf yapmamalı. Yani mağaza anahtar kelimelerine rakip adı yazılmaz, ama Apple Ads kelimelerine yazılır.
- Mağazada (TR web araması): `tiktako` tek başına arandığında Tiktako ilk sonuçlarda yok, sonuçları TikTok ve benzerleri
  dolduruyor. `tiktako futbol` aramasında 3. sırada çıkıyor ve alt başlığı hâlâ eski ("Football trivia games").
  Yani marka kampanyası gerçekten gerekli.
- `futbol xox` TR aramasında Tiktako 12 sonucun içinde yok. Sonuçlar küçük uygulamalar (puan sayısı 4–494): TACTICO - Football XOX,
  CrossOver Football, Kick Tac Toe, GolGrid, OXO Football, Football Tic Tac Toe & Quiz... Başlıklarına anahtar kelime
  koymuşlar; bizim isim alanı değişikliği bu yüzden mantıklı.
- **Dil hedeflemesi yok, ülke hedeflemesi var.** Reklam grubu ayarları cihaz, müşteri türü (yeni/geri dönen), yaş, cinsiyet ve
  (bazı ülkelerde) konum; dil seçeneği yok. Türkçe + İngilizce için: Türkiye kampanyası (Türkçe ve İngilizce kelimeler birlikte,
  TR kullanıcısı `football tic tac toe` de arar), Arap ülkeleri kampanyası ve İngilizce konuşulan Avrupa kampanyası (aşağıda
  "Kampanyalar"). Konum daraltma çok ülkeli kampanyada kullanılamaz. Ülke başına maliyet farklıdır, bütçeyi ayrı koy.
- **Ülke listesi** (ads.apple.com/app-store/countries-and-regions): Türkiye, Suudi Arabistan, BAE, Mısır, Kuveyt, Katar,
  Bahreyn, Umman, Ürdün, Lübnan, Fas, Cezayir, Irak, Birleşik Krallık, İrlanda, Kıbrıs, Hollanda ve İskandinav ülkeleri var.
  **Tunus ve Malta yok.** Bahreyn, Mısır, Kuveyt ve BAE'de reklam gösterilen en düşük yaş 21.
- **$100 (ABD) başlangıç kredisi** (Apple yardım sayfası, "Promo Credit"): yeni hesaba otomatik verilir, bir kereliktir.
  Şartlar: App Store Connect'te kayıtlı geliştirici hesap sahibi olmak ve satışta en az bir uygulaman olmak (Tiktako var);
  Apple Ads hesabını üst düzey hesap olarak App Store Connect'e bağlamak (kampanya grubunu bağlarsan kredi gelmez); geçerli
  ödeme yöntemi eklemek. Kredi Billing sayfasının üstünde, ödeme yöntemi eklenince görünür. Vergi ve ücretleri ödemez,
  nakde çevrilmez. Hesap para birimi USD olduğu için $100 olarak gelir.
  **Doğrulanamayan:** son kullanma tarihi (şartlar "süreli olabilir" diyor, $100 için tarih yazmıyor), Türkiye hesabının uygun
  olup olmadığı. Ödeme yöntemi ekleyince Billing sayfasında Promo Credit bölümünden kontrol et.
  (Başka bir sayfadaki $150 kredi Apple Maps reklamları içindir, App Store'a uygulanmaz.)

## Ön koşullar

- 1.2 App Store'da yayında ve mağaza sayfası güncel olmadan kampanya açma.
- `mobile/store.config.json` içindeki yeni ad / alt başlık / anahtar kelimeler `eas metadata:push` ile gitmiş olmalı
  (1.2 incelemedeyken gönderme, `metadata.md` v1.1 notundaki kural geçerli).
- Ölçüm için koda bir şey eklenmez: Apple Ads panelinin dokunma / indirme sayıları yeter. Apple'ın AdServices
  attribution SDK'sını eklersen gizlilik sayfası ve App Privacy cevapları gözden geçirilmeli (CLAUDE.md gizlilik sözleri).
- Rakip markasını reklam metnine koyma; reklam görseli zaten mağaza sayfandan gelir.
- Anahtar kelime alanına (store.config.json) rakip marka adı yazma, Apple reddeder.

## Strateji (karar, 2026-11-01)

**Hacim ve dönüşüm nereden:**
1. **Körfez (Suudi Arabistan, BAE, Kuveyt, Katar).** Rakip neredeyse yok (Arapça quiz uygulamaları 2–120 puan), önerilen CPT
   düşük (SA $0.74), uygulamada Suudi ve Mısır ligleri var; bu bizim tek gerçek farkımız. Gelir değeri de Mısır'dan yüksek.
2. **Türkiye.** Ana dilimiz, içerik (Süper Lig, Türkçe arayüz) tam uyuyor, CPT düşük bekleniyor; rakipler küçük (en büyüğü 1890 puan).
3. **Birleşik Krallık / İrlanda sonra.** CPT $1.65 (Körfez'in 2 katı), rakipler daha güçlü (Footy Brains, Tiki Taka Toe).
   Sadece 1–2. adım CPI hedefinde kalırsa test et.
4. **Mısır sonra, ayrı kampanya.** Büyük futbol pazarı, çok ucuz olması beklenir ama BAE ile aynı kampanyada bütçeyi yer.

**Dönüşüm en yüksek:** Exact niş kelimeler (`football quiz`, `football trivia`, `tiki taka toe`, `futbol quiz`,
`اسئلة كرة قدم`...) ve marka. Hepsinin hacmi küçük (Popülerlik 1–2), yani tek başına yetmez.
**Hacim:** Search Match + Broad. Apple uygulamayı ilgili aramalara kendisi eşler; mağaza metnindeki kelimeler (1.2 adı)
bu eşleşmeyi besler. Geniş kelimelere (`football`, `futbol`, `كرة القدم`, `tic tac toe`) Exact teklif verilmez.

**Yapı: bölge başına iki kampanya.** Niyet başına üç-dört ayrı kampanya (aso-skills önerisi) $100'lük bütçeyi çok böler;
Marka / Tür / Rakip aynı Exact kampanyada ayrı reklam gruplarıdır, teklif farkı reklam grubu teklifiyle verilir. Keşif ayrı
kampanya, çünkü Search Match bütçeyi hızlı yer ve Exact'ı aç bırakmamalı.

| Kampanya | Ülkeler | Reklam grupları (eşleşme, başlangıç CPT) | Günlük bütçe |
|---|---|---|---|
| `GULF Exact` | SA, AE, KW, QA | Marka (Exact, $0.60) · Tür (Exact, $0.50) · Rakip (Exact, $0.35) | $3 |
| `GULF Discovery` | SA, AE, KW, QA | Search Match açık + Tür kelimeleri Broad ($0.30) | $1.5 |
| `TR Exact` | Türkiye | Marka (Exact, $0.40) · Tür (Exact, $0.30) · Rakip (Exact, $0.20) | $2 |
| `TR Discovery` | Türkiye | Search Match açık + Tür kelimeleri Broad ($0.15) | $1 |

- Toplam $7.5/gün: $100 kredi yaklaşık 13 gün. Teklifler Apple önerisinin altında başlar; gösterim payı %50'nin altındaysa
  haftada en fazla %20 artır.
- Exact kampanyalarında Search Match **kapalı** (varsayılan açık geliyor, kapat). Keşif kampanyasında Exact kelimelerin
  hepsi **negatif Exact** olarak eklenir; aynı arama iki kampanyada yarışmasın.
- Kitle: "New Users" (sadece Tiktako'yu hiç indirmemiş olanlar), iPhone + iPad, yaş/cinsiyet serbest.
- Reklam: varsayılan ürün sayfası. 2. haftadan sonra rakip grubu için Custom Product Page (XOX / Ben Kimim ekranları).
- TR CPT önerisi okunmadı: kampanyayı kurarken reklam grubu ekranındaki "Suggested" değerine bak, $0.30 ondan yüksekse düşür.

**Hedefler (varsayım, 2 hafta sonra gerçek veriyle güncelle):** TTR ≥ %5, dokunma→indirme ≥ %40, CPI: Körfez ≤ $1.20,
TR ≤ $0.60. CPI hedefi 2 katı aşan reklam grubu durur.

**Aşamalar**
1. **0. gün:** 1.2 yayında, `store.config.json` metinleri `eas metadata:push` ile gitti, ödeme yöntemi eklendi, Billing'de
   $100 kredisi görünüyor. Dördü olmadan kampanya açılmaz.
2. **1–7. gün:** dört kampanya, değiştirme yok (sadece açıkça alakasız arama terimini negatife ekle).
3. **8–14. gün:** Keşif arama terimi raporundan indirme getiren terimi Exact'a taşı; 20+ dokunma ve 0 indirmeli kelimeyi durdur;
   CPI'si en iyi bölgeye bütçeyi kaydır.
4. **15. gün karar:** CPI hedefteyse kendi kartınla devam ($5–10/gün), Mısır kampanyası ve UK/IE testi ($3/gün, `football quiz`,
   `football trivia`, `tiki taka toe`, `guess the player` Exact) ekle. Hedefte değilse önce ürün sayfasını (ekran görüntüleri,
   Arapça görseller) düzelt, bütçe artırma.

## Talep verisi (2026-11-01)

Kaynak 1: App Store otomatik tamamlama (MZSearchHints, mağaza başına). Apple önerileri popülerliğe göre sıralar ama sayı
vermez; bu yüzden "öneride var / ilk sıralarda" ölçüsü sadece göreli talep gösterir. Kaynak 2: iTunes Search API
(ilk 15 sonuç, puan sayısı = uygulamanın gücü). Kaynak 3: **Apple Ads Popülerlik** (1–5 nokta). Kampanya kaydetmeden,
"Create Campaign" formundaki Add Keywords penceresinde okundu (ülke tek tek değiştirildi, hiçbir şey kaydedilmedi).

### Apple Ads Popülerlik (2026-11-01, 1–5)

| Pazar | 4 | 3 | 2 | 1 (geri kalan hepsi) |
|---|---|---|---|---|
| Türkiye | – | `futbol`, `tic tac toe` | `football quiz`, `football trivia`, `tiki taka toe`, `xox`, `ben kimim` | `futbol bilgi oyunu`, `futbol quiz`, `futbol bilgi yarışması`, `futbolcu tahmin et`, `futbolcu bilme`, `tic tac toe football`, `futbol xox`, `futbol bilgi`, `futbolcu`, `futbol oyunları`, `ilk 11 kur`, `tiktako`, `guess the footballer` |
| Suudi Arabistan | `football` | `كرة القدم`, `tic tac toe` | `football quiz`, `football trivia`, `tiki taka toe`, `football iq`, `ذكاء كروي`, `اكس او`, `اسئلة`, `خمن` | `اسئلة كرة قدم`, `اسئلة كروية`, `خمن الاعب`, `لاعب كرة قدم`, `الدوري السعودي`, `guess the footballer`, `football tic tac toe`, `tiktako` |
| Birleşik Krallık | `football`, `football games` | `tic tac toe` | `football quiz`, `football trivia`, `tiki taka toe`, `football iq`, `ball knowledge`, `guess the player` | `guess the footballer`, `football quiz games`, `football grid`, `football bingo`, `footy tic tac toe`, `football tic tac toe`, `who are ya`, `footy brains`, `whos the player`, `soccer quiz`, `tiktako` |

Apple'ın önerdiği reklam grubu CPT'si: **Suudi Arabistan $0.74, Birleşik Krallık $1.65** (Türkiye okunmadı). Mısır, BAE, İrlanda
okunmadı.

**Sonuç:** Tür kelimelerinin neredeyse hepsi en alt seviyede (1). En büyük niş kelimeler her pazarda aynı:
`football quiz`, `football trivia`, `tiki taka toe` (2). Sadece Exact ile çok az gösterim olur; ana hacim Keşif'ten
(Search Match + Broad) gelecek. `football`, `futbol`, `كرة القدم`, `tic tac toe` yüksek ama geniş (oyun / skor / XO arayanlar):
Exact'ta teklif verme, sadece Broad'da düşük teklifle ve arama terimi raporuyla izle.

**Türkiye**
- `futbol bilgi` yazınca ilk öneri `futbol bilgi oyunu`, sonra `futbol bilgi yarışması`. `futbol quiz` ve `futbol quiz oyunu` güçlü.
- `futbolcu` önerileri: `futbolcu bilme`, `futbolcu tahmin et`, `futbolcuyu tahmin et`, `futbolcu bilmece`, `futbolcu bulmaca`.
- `tic tac toe` yazınca ilk öneri `tic tac toe football`, sonra `footy tic tac toe`, `tic tac toe futbol`.
  `tiki taka` yazınca ilk öneri `tiki taka toe`.
- **`futbol xox` hiç öneri getirmiyor, `xox` tek öneri getiriyor: bu kelimeye talep çok az.** 1.2 Türkçe adındaki "XOX" zayıf.
- `ben kimim` talebi yüksek ama genel (çocuk, tabu); futbolla ilgili değil. `ilk 11` → `ilk 11 kur(ma)` (kadro kurucu niyeti).
- Geniş ama alakasız: `futbol oyunları`, `futbol kariyer oyunu`, `futbol manager` (oyun arayanlar, quiz değil).

**Birleşik Krallık / İrlanda**
- `football quiz` → `football quiz games`, `football quizzes`, `football quiz questions`. `football trivia` → `football trivia games`.
- `guess the footballer`, `name the footballer`, `footballer quiz` güçlü. `football grid` öneri listesi rakiplerle dolu (yeni tür).
- `tiki taka toe`, `football tiki taka toe`, `footy tic tac toe` var; `football tic tac toe` sadece 2 öneri (orta-düşük).
- `football bingo`, `who are ya`, `football career path`, `football 501`, `football imposter` ayrı küçük talepler.

**Arap ülkeleri (SA, AE, EG)**
- `اسئلة` (sorular) önerilerinde `اسئلة كرة قدم` ve `اسئلة كروية` var. `خمن` (tahmin et) → `خمن الاعب`, `خمن اسم الاعب`.
- `اكس او` (XO) çok güçlü ve çok varyantlı (`اكس او اونلاين`, `لعبة اكس او`), ama genel XO; futbol değil. Keşif'te dene, Exact'ta değil.
- `football quiz` İngilizce olarak SA/AE/EG'de de öneriliyor. `الدوري السعودي` güçlü (lig, haber niyeti, dikkat).
- `مسابقة` (yarışma) genel; futbol önerisi yok.

**Rakipler (puan sayısı, ilk 15'teki yer)**
- TR: Football Quiz - Players, clubs (1890), Griddy: Futbol Quiz & Oyun (900, `futbol quiz` #1), Football Quiz Guess The Player
  (642), TACTICO - Football XOX (494, 3.3★), Transfermarkt: Football Quiz (127), Kick Tac Toe (71), Tiki Taka Toe (46).
  Öneri listesinde: Hunt11, Footellect, Futboxo, GolGrid, Santra, 3·2·1 Futbol Quiz, Goalmind, Golriva, Regista, Topatut, Futbil.
- GB: Football Quiz - Players, clubs (3626), Footy Brains (2000), Whos the Player? (1484), Guess the Football Team 2026 (1065),
  Football Guess Player Quiz (1044), Tiki Taka Toe (991, `tiki taka toe` ve `football grid` #1). Öneride: Football IQ,
  Ball Knowledge, FootyIQ, Hunt11, Kickgrid, Goalrow, Onze.
- Arap: çok boş. EG'de en büyük quiz 1278 puanlı İngilizce uygulama; Arapça olanlar 2–120 puan (Kortifo, WhoBaller, Remontada,
  Derby). Football IQ'nun Arapça adı var (`ذكاء كروي`). **Arap pazarında rekabet ve muhtemelen CPT en düşük.**
- Tür küçük: en güçlü quiz rakibi bile birkaç bin puanda. Büyük futbol oyunları (EA FC, OSM, Top Eleven) sadece geniş
  kelimelerde çıkıyor; onlarla yarışma.

## 1.2 adı (store.config.json'a işlendi, 2026-11-01; henüz mağazaya gönderilmedi)

Kelime alanları: TR `yarışma,trivia,football,tiki taka,tic tac toe,ilk 11,kadro,süper lig,derbi,maç,kariyer,bilme,bulmaca` (100),
EN `trivia,soccer,footballer,tiki taka,grid,bingo,starting xi,lineup,premier league,derby,career,rondo` (98),
AR `كرة القدم,مسابقة,معلومات,لاعبين,تشكيلة,كروية,الدوري السعودي,ديربي,football,quiz,trivia,xo` (89, kulüp adları çıkarıldı).

| Dil | Şu anki 1.2 | Öneri | Neden |
|---|---|---|---|
| TR ad | `Tiktako: Futbol Bilgi & XOX` | `Tiktako: Futbol Bilgi Oyunu` (27) | `futbol bilgi oyunu` 1. öneri, `xox` talepsiz |
| TR alt başlık | `Quiz, Ben Kimim, Düello` | `Quiz, Futbolcu Tahmin, XOX` (26) | `futbol quiz` + `futbolcu tahmin et` kapsanır |
| EN ad | `Tiktako: Football Quiz` | aynı | `football quiz` en güçlü genel kelime |
| EN alt başlık | `Tic Tac Toe, Trivia & Duels` | `Guess the Player & Tic Tac Toe` (30) | `guess the footballer` hiçbir alanda yok; `trivia` kelime alanına taşınır |
| AR ad | `Tiktako` | `Tiktako: اسئلة كرة قدم` | Arapça sayfada hiç tür kelimesi yok |
| AR alt başlık | `ألعاب ومسابقات كرة القدم` | `خمن الاعب، اكس او، تحدي` | `خمن الاعب` ve `اكس او` önerilerde |

- Popülerliğe göre: TR'de İngilizce `football quiz` / `football trivia` / `tiki taka toe` (2) Türkçe karşılıklarından (1) büyük.
  TR adı için otomatik tamamlama sırası belirleyici kaldı; `XOX` tek başına 2, alt başlıkta kalsın.
- AR anahtar kelimelerindeki kulüp adlarını (`الهلال`, `النصر`, `الأهلي`) çıkar: 2.3.7 ticari marka riski.
- Kelime alanında başlıkta geçen kelimeyi tekrar etme (TR'de `futbol`, `bilgi`, `oyun`; EN'de `football`, `quiz`).

## Anahtar kelime tohumları

Tür ve Rakip grupları Exact; Keşif kampanyasına Tür kelimeleri Broad olarak da girer. Popülerliği 1 olan kelimeler de kalır:
dönüşümleri yüksek, gösterim almazlarsa maliyetleri sıfır.

**Marka:** `tiktako`, `tik tako`, `tiktako futbol`

**Tür (TR), öncelik sırasıyla:** `futbol bilgi oyunu`, `futbol quiz`, `futbol bilgi yarışması`, `futbolcu tahmin et`,
`futbolcu bilme`, `futbol quiz oyunu`, `tic tac toe football`, `tiki taka toe`, `futbolcuyu tahmin et`, `futbolcu bilmece`,
`futbolcu bulmaca`, `footy tic tac toe`, `tic tac toe futbol`, `football quiz`. Keşif'te: `ben kimim`, `ilk 11 kur`, `xox`.

**Tür (EN, UK/IE):** `football quiz`, `football quiz games`, `football trivia`, `football trivia games`, `guess the footballer`,
`name the footballer`, `footballer quiz`, `tiki taka toe`, `football tiki taka toe`, `footy tic tac toe`,
`football tic tac toe`, `football grid`, `football bingo`, `football quiz questions`. Keşif'te: `who are ya`, `football career path`.

**Tür (AR):** `اسئلة كرة قدم`, `اسئلة كروية`, `خمن الاعب`, `خمن اسم الاعب`, `لاعب كرة قدم`, ve İngilizce `football quiz`,
`football trivia`, `guess the footballer`. Keşif'te: `اكس او`, `لعبة اكس او`, `الدوري السعودي`.

**Rakip:** TR: `griddy`, `tactico`, `futboxo`, `golgrid`, `hunt11`, `footellect`, `santra`, `3 2 1 futbol`, `goalmind`,
`futbil`, `kick tac toe`, `football quiz players clubs`. UK/IE: `footy brains`, `whos the player`, `football iq`,
`ball knowledge`, `footyiq`, `hunt11`, `kickgrid`. AR: `football iq`, `ذكاء كروي`, `whoballer`, `kortifo`, `remontada`.
`tiki taka toe` hem tür hem rakip adı (Digital Football Games); Tür grubunda tut.

## Negatif kelimeler (tüm kampanyalar)

`tiktok`, `tik tok`, `tiktok lite`, `tiktok live`, `free fire`, `fifa mobile`, `efootball`, `fc mobile`, `dream league`,
`football manager`, `video`, `müzik`. Keşif grubunda ilk haftada arama terimi raporuna bak, alakasızları ekle.

## Haftalık kontrol

- Keşif arama terimi raporu: indirme getireni Exact'a taşı, alakasızı negatife ekle.
- Gösterim payı < %50 olan Exact kelimede teklifi artır; 20+ dokunma ve 0 indirmede durdur.
- Bütçe öğleden önce bitiyorsa teklifi düşür ya da bütçeyi CPI'si en iyi kampanyaya kaydır.

## Notlar

- Apple Ads sadece iOS. Android için ayrı iş (Google App Campaigns).
- Reklam organik sıralamayı doğrudan düzeltmez; isim alanı değişikliği ayrı ve gerekli.
- İleride: Custom Product Page ile rakip kampanyasına XOX / Ortak Futbolcu ekran görüntüleri göster.
