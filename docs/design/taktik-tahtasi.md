# Taktik Tahtası / Pitch Chess — tasarım belgesi (taslak v0.1)

Futbol temalı bir "auto battler" (TFT / Magic Chess türü). Adı Türkçede **Taktik Tahtası**,
İngilizcede **Pitch Chess**.
Bu belge oyunun kurallarını, sayılarını ve ilk sürümün kapsamını tanımlar. Sayılar
başlangıç değerleridir; motor yazıldıktan sonra simülasyonla dengelenecek.

---

## 1. Tek cümlede oyun

Her tur dükkândan futbolcu kartları al, sahana diz, aynı kulüp / ülke / kupadan
oyuncuları bir araya getirip sinerji kur; maçlar kendiliğinden oynanır, kaybettikçe
can gider, 8 menajerden son ayakta kalan kazanır.

**Bizi TFT'den ayıran şey:** futbol bilgisi. Dükkânda bazen gizli bir oyuncu çıkar;
ipuçlarından adını bilirsen ucuza alırsın (bkz. 9).

---

## 2. Oyun akışı

- **8 menajer**, her biri **100 can** ile başlar.
- Oyun **aşamalara** bölünür. Her aşamada 6 tur var:
  `Maç · Maç · Maç · Hazırlık maçı · Maç · Maç`
  - **Maç:** başka bir menajerle eşleşirsin.
  - **Hazırlık maçı:** bot bir takıma karşı oynarsın. Kazanırsan eşya ya da altın düşer.
- **Aşama 1** farklıdır: 3 hazırlık maçı oynanır, menajerler birbirine karşı oynamaz. Burada başlangıç birimleri ve ilk eşyalar gelir.
- **Hedef süre:** 12–15 dakika. TFT ~35 dakika sürüyor; mobilde kısa tutuyoruz:
  - Maçlar ~15 saniye ve atlanabilir.
  - Hazırlık turu süresi 25 saniye.
- **Bitiş:** Canı 0'a düşen elenir. Son kalan 1. olur. İlk 4 "başarılı" sayılır; XP ve rütbe buna göre verilir.

### Kaybedince giden can
`can kaybı = 6 + 3 × (aşama − 1) + gol farkı (en fazla 5)`; penaltılarla kaybetmek 1 gol sayılır.

Örnek: 4. aşamada 3-1 kaybettin → 6 + 9 + 2 = 17 can.

---

## 3. Saha, mevkiler ve kulüp seviyesi

- **Saha:** 4 bölge ve 12 yuva var.
  - **Kaleci:** 1 yuva
  - **Defans:** 4 yuva
  - **Orta saha:** 4 yuva
  - **Forvet:** 3 yuva
- **Kulübe:** Sahaya koymadıkların için 8 yuva.
- **Kulüp seviyesi** sahaya kaç oyuncu sürebileceğini belirler:

| Seviye | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| Sahadaki oyuncu | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | **11** |
| Sonraki seviyeye XP | 2 | 2 | 6 | 10 | 20 | 36 | 48 | 72 | — |

  9. seviye "tam ilk 11" demek; bu, oyunun en tatmin edici anlarından biri olmalı.

- **Mevki:** Her oyuncunun bir ana mevkisi var: kaleci, defans, orta saha ya da forvet.
  - Kendi bölgesinde tam güç oynar.
  - Komşu bölgede %70 güç (örneğin defansçı orta sahada).
  - Uzak bölgede %40 güç.
  - **Kaleci başka yerde, kaleci olmayan da kalede %20 oynar.** Kalesiz takım maçlara ciddi dezavantajla başlar.

---

## 4. Futbolcu kartları

### Maliyet (şöhret seviyesi)
Quiz'deki şöhret puanı (`kupa rozeti × 4 + klasik maç ilk 11'i`) ve kulüp sayısıyla
oyuncular 5 maliyete ayrılır:

| Maliyet | Kimler | Havuzdaki kopya |
|---|---|---|
| 1 | Kadro oyuncuları | 22 |
| 2 | Bilinen isimler | 18 |
| 3 | Yıldızlar | 15 |
| 4 | Süperstarlar | 10 |
| 5 | Efsaneler (Ballon d'Or, Dünya Kupası kahramanları) | 8 |

Havuz bütün menajerler için **ortaktır**. Biri bir oyuncuyu topluyorsa o oyuncu
herkes için azalır (TFT'deki "bağlantı" çekişmesi).

### Güç değerleri
Her kartın 3 değeri var: **HÜC** (hücum), **SAV** (savunma), **KAL** (kalecilik, yalnızca kalecilerde).
- Değerler maliyete ve mevkiye göre hesaplanır.
- Kart üzerinde tek bir "GÜÇ" sayısı olarak da gösterilir.

| Maliyet | Temel güç |
|---|---|
| 1 | 40 |
| 2 | 55 |
| 3 | 70 |
| 4 | 85 |
| 5 | 100 |

Değerler mevkiye göre dağıtılır:
- **Forvet:** %75 HÜC, %25 SAV
- **Orta saha:** %50 HÜC, %50 SAV
- **Defans:** %20 HÜC, %80 SAV
- **Kaleci:** %100 KAL

### Bronz → Gümüş → Altın
- Aynı oyuncudan **3 kart** birleşip **Gümüş** olur: güç ×1,8.
- **3 Gümüş** birleşip **Altın** olur: güç ×3,2.
- Birleşme kart alınınca kendiliğinden olur ve animasyonla gösterilir.

---

## 5. Sinerjiler (asıl strateji)

Her oyuncunun **1 kulüp**, **1 ülke** ve **0–2 kupa** özelliği var. Elimizdeki
veride bunların hepsi mevcut. Bir oyuncu birden fazla kulüpte oynamışsa, o oyun
için en çok anıldığı kulübü kullanırız.

### 5.1 Kulüp sinerjisi: "kimya"
Aynı kulüpten 2 / 4 / 6 oyuncu → **o oyuncular** +%15 / +%35 / +%60 güç kazanır.

### 5.2 Ülke sinerjisi
Ülke sinerjileri 2 / 3 / 5 oyuncuda açılır ve **tüm takıma** etki eder. Her ülkenin
kendi karakteri var. İlk liste:

| Ülke | 2 | 3 | 5 |
|---|---|---|---|
| Brezilya (Joga Bonito) | Takım HÜC +%8 | +%15 | +%25, şutlar daha isabetli |
| İtalya (Catenaccio) | Takım SAV +%8 | +%15 | +%25, ilk gol yenmez |
| İspanya (Tiki-taka) | Topa sahip olma +%10 | +%18 | +%30 |
| Almanya (Makine) | Son 30 dk HÜC+SAV +%10 | +%18 | +%30 |
| Arjantin (Hırs) | Gerideyken HÜC +%15 | +%25 | +%40 |
| Fransa (Atletizm) | Kontra atak şansı +%15 | +%25 | +%40 |
| Hollanda (Total futbol) | Mevki dışı ceza yarıya iner | ceza yok | +%10 tüm güç |
| İngiltere (Kafa golü) | Duran top golü şansı + | ++ | +++ |
| Portekiz (Yetenek) | En güçlü oyuncu +%20 | +%35 | +%55 |
| Türkiye (Son dakika) | 80'den sonra +%15 | +%25 | +%40, son dakika golü şansı |

Bu karakterler sabit kalıyor: bilinen futbol tarzlarını anlatıyorlar, kimseyi
küçümsemiyorlar. Denge simülasyonunda hepsinin ilk 4 oranı %40–60 arasına çekilecek.

Diğer ülkeler genel "Milli takım" bonusu alır: 2 / 3 / 5 oyuncuda takım gücü +%5 / +%9 / +%15.

### 5.3 Kupa sinerjileri
| Kupa | Eşik | Etki |
|---|---|---|
| 🏆 Dünya Kupası şampiyonu | 2 / 4 | Uzatma dakikalarında +%20 / +%40 |
| ⭐ Şampiyonlar Ligi şampiyonu | 2 / 4 | Güçlü rakibe karşı +%10 / +%25 |
| 🥇 Ballon d'Or | 1 | Bu oyuncu maçta bir kez "anlık dahilik" yapar: garanti pozisyon |
| 🌍 Avrupa Şampiyonu | 2 / 3 | Takım SAV +%10 / +%20 |

### 5.4 Maç havuzu (her oyuncu çıkabilir)
Lig ya da dönem sınırı yok: FIFA kartları gibi veri tabanındaki **her oyuncu**
herhangi bir oyunda çıkabilir. Ama 16 bin oyuncunun hepsi tek bir dükkâna
sığmaz; o zaman aynı kulüpten iki kişi bulmak, 3 kopya toplamak imkânsız olur.
Bu yüzden her lobi başında bütün veri tabanından rastgele bir **maç havuzu** çekilir:

- Rastgele ~10 kulüp ve ~10 ülke seçilir (her oyun farklı).
- ~60 oyuncu, bu kulüp ve ülkelerden **tüm veri tabanından** çekilir
  (13 / 13 / 13 / 12 / 9 kişi, maliyete göre), her dönemden ve her ligden.
- Böylece her oyuncu er geç bir oyunda karşına çıkar, ama bir oyun içinde
  sinerjiler tamamlanabilir.

---

## 6. Ekonomi

| Kaynak | Miktar |
|---|---|
| Tur başı gelir | 5 altın |
| Faiz | Her 10 altına +1, en fazla +5 (50 altında) |
| Seri bonusu (galibiyet ya da mağlubiyet serisi) | 2–3 maç +1 · 4 maç +2 · 5+ maç +3 |
| Maç kazanmak | +1 |
| Dükkânı yenilemek | 2 altın |
| 4 XP satın almak | 4 altın |
| Kart satmak | Maliyeti kadar (Gümüş/Altın: toplam maliyetinin 1 eksiği) |

Her tur ayrıca 2 XP kendiliğinden gelir.

### Dükkân olasılıkları (seviyeye göre, maliyet 1/2/3/4/5, %)
| Seviye | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| 1–2 | 100 | 0 | 0 | 0 | 0 |
| 3 | 75 | 25 | 0 | 0 | 0 |
| 4 | 55 | 30 | 15 | 0 | 0 |
| 5 | 45 | 33 | 20 | 2 | 0 |
| 6 | 30 | 40 | 25 | 5 | 0 |
| 7 | 19 | 30 | 35 | 15 | 1 |
| 8 | 16 | 20 | 35 | 25 | 4 |
| 9 | 9 | 15 | 30 | 30 | 16 |

---

## 7. Maç simülasyonu

Gerçek zamanlı hareket yok. Maç **12 atak dilimine** bölünür (her dilim ~7,5 dakika),
böylece hem hızlı hem açıklanabilir olur.

Her dilimde:
1. **Topa sahip olma:** `orta saha gücü + defansın %30'u`, iki taraf için oranlanır. Rastgelelik ±%15.
2. **Atak:** Topu alan taraf atağa çıkar.
   `şans kalitesi = (forvet + orta sahanın %40'ı) HÜC  ÷  rakip defans SAV`
3. **Şut:** Kalite bir eşiği geçerse şut olur. Gol olasılığı = `kalite ÷ (kalite + rakip kaleci KAL × k)`.
4. **Olaylar:** Sinerji ve taktik etkileri ilgili dilimlerde devreye girer. Örnekler: Almanya son 4 dilimde güçlenir; Türkiye 11. ve 12. dilimde ek şans alır.

**Gösterim:**
- Mini saha üzerinde topun iki takım arasında gidip geldiği ~15 saniyelik özet.
- Gol anında kartın parlaması ve skor tabelası; "dakika 78, GOL — Hagi".
- Atla düğmesi.

**Deterministik:** Aynı tohum aynı maçı üretir. Böylece online sürümde sunucu ve
telefon aynı sonucu hesaplar, hile zorlaşır ve tekrar izlenebilir.

---

## 8. Eşyalar

Hazırlık maçlarından düşer. Sürükleyip bir oyuncuya takılır. Her oyuncuya en fazla 2 eşya takılabilir.

| Eşya | Etki |
|---|---|
| ⚽ Altın krampon | HÜC +20 |
| 🧤 Eldiven | KAL +25 (kalecide) |
| 🦵 Tekmelik | SAV +20 |
| 🫡 Kaptanlık bandı | Sahadaki herkese +%5 |
| ⚡ Enerji içeceği | Son 4 dilimde +%20 |
| 📋 Taktik tahtası | Oyuncu kendi bölgesinin dışında da tam güç oynar |

Eşyaların birleşip daha güçlü eşya olması (TFT'deki gibi) ikinci sürüme kalıyor.

---

## 9. Bilgi mekaniği: "Gözcü raporu" (bizim imzamız)

Bazı turlarda dükkândaki 5 karttan biri **gizli** gelir:
- Kartta siluet ve 3 ipucu var: ülke bayrağı, bir eski kulübü ve mevkisi.
- Adını yazıp bilirsen kart **2 altın ucuza** alınır (en az 1 altın) ve hemen
  **parlayarak** açılır; kartın köşesinde küçük bir "gözcü" rozeti kalır.
  Güç bonusu yok: avantaj sadece ekonomide.
- Bilemezsen normal fiyatına alabilir ya da bırakabilirsin.
- Bir aşamada en fazla 3 kez çıkar. Hedef: bilen oyuncunun ilk 4 oranı +%3–5
  (simülasyonda şu an +2; 1 altınlık indirim hiç fark yaratmıyordu).
- İpuçları Gizli Oyuncu oyunundaki altyapıdan gelir.

**Transfer günü** (aşama 3 ve 5'te):
- Ortaya 8 kart dizilir. Canı en az olan menajer ilk seçer.
- Seçmeden önce kısa bir soru gelir ("Bu oyuncu hangi kulüpte Şampiyonlar Ligi kazandı?").
- Doğru cevap verirsen seçim sırasında öne geçersin.

Böylece futbol bilen oyuncu küçük ama hissedilir bir avantaj alır. Asıl güç
yine strateji ve ekonomiden gelir; bilgi kazandırmaz, **yardım eder**.

---

## 10. Taktik kartları (TFT'deki "augment")

Aşama 2, 3 ve 4'ün başında 3 karttan biri seçilir. İlk liste:

| Kart | Etki |
|---|---|
| Gegenpress | Rakibin topa sahip olma oranı −%10 |
| Otobüsü çek | SAV +%25, HÜC −%10 |
| Uzun top | Forvetler orta sahayı atlar: HÜC +%15, sahip olma −%10 |
| Altyapı | Hemen 3 farklı 2 maliyetli oyuncudan ikişer kart |
| Kasa dolu | Hemen 15 altın |
| Yıldız transferi | Hemen rastgele bir 4 maliyetli kart |
| Kanat oyunu | Forvet bölgesinde en az 2 kişi varsa şut kalitesi +%15 |
| Seyirci desteği | Kaybettiğin maçlarda 3 can daha az kaybedersin |
| Kulüp efsanesi | En güçlü kulüp sinerjin bir eşik yukarı sayılır |
| Milli ara | En güçlü ülke sinerjin bir eşik yukarı sayılır |

---

## 11. Teknik direktör (Magic Chess'teki "komutan")

Oyun başında 3 arketipten biri seçilir. Gerçek kişi değil, tarz:

| Arketip | Pasif | Aktif (maçta 1 kez, otomatik) |
|---|---|---|
| Pas ustası | Orta saha +%15 | 2 dilim boyunca topa sahip olma garantisi |
| Otobüs hocası | Defans +%15 | Rakibin en iyi şansını iptal eder |
| Pres canavarı | Rakip orta saha −%8 | Top kaptığında hızlı atak |
| Yıldız avcısı | Dükkânda 4–5 maliyet şansı biraz yüksek | — |
| Altyapı hocası | 1–2 maliyetli oyuncular +%15 | — |
| Para babası | Faiz tavanı 5 değil 7 | — |

Teknik direktörler ileride kilitli ödüller olarak açılabilir. Seviye ve rütbe sistemiyle bağlanır.

---

## 12. Botlar

İlk sürümde lobideki diğer 7 menajer bot olur. Her botun bir **kişiliği** var:
- **Kulüp sadığı:** Tek bir kulübe gider.
- **Ekonomist:** 50 altını tutar.
- **Yenileyici:** Erken seviye atlar, dükkânı çok yeniler.
- **Fırsatçı:** Ne gelirse onu toplar.

Zorluk, botun karar kalitesiyle ayarlanır. Botlara Tic-Tac-Toe'daki gibi gerçekçi isimler verilir.

---

## 13. Ekranlar

1. **Lobi:** 8 menajerin avatarı ve teknik direktör seçimi.
2. **Hazırlık ekranı (ana ekran):**
   - **Üst:** 8 menajerin can sıralaması. Dokununca rakibin sahası görünür.
   - **Orta:** Saha ve 12 yuva. Aktif sinerjiler solda dikey liste halinde.
   - **Alt:** Kulübe (8 yuva). Dükkânda 5 kart; yenile ve XP düğmeleri; altın ve seviye göstergesi.
   - Kartlar sürükle-bırak ile taşınır. Satmak için dükkâna sürüklenir.
3. **Maç ekranı:** Mini saha, skor, olay akışı, atla.
4. **Sonuç:** Sıralama ve XP. Mevcut ödül ekranı kullanılır.

---

## 14. Teknik yapı

- **Ortak motor:** `src/lib/taktik/`, platformdan bağımsız, React yok:
  - `pool.ts`: sezon havuzu
  - `rules.ts`: sayılar ve tablolar
  - `economy.ts`, `shop.ts`
  - `sim.ts`: deterministik maç
  - `bot.ts`
- **Denge betiği:** `mobile/scripts/taktik-sim.mts`. Binlerce botlu lobi oynatır ve şunları ölçer:
  - Her sinerji tipinin ilk 4 oranı. **Hedef:** 6 farklı kurgu %40–60 arasında.
  - Ortalama oyun süresi (tur sayısı).
  - Altın kartların görülme sıklığı. **Hedef:** 5 maliyetli altın kart her 50 oyunda bir civarı.
  - Gözcü raporunu bilenlerin kazanma farkı. **Hedef:** +%3–5 ilk 4 oranı; fazlası değil.
- **Veri ihtiyacı:**
  - **Mevki:** Transfermarkt kadro sayfalarında yazıyor. `tiki-scrape-seasons.mjs` mevkiyi de kaydedecek şekilde genişletilir. Bunun için sayfalar yeniden çekilir ve önbelleğe alınır.
  - **Ana kulüp:** En çok sezon geçirdiği kulüp. Sezon verisinden çıkar.
- **Çok oyunculu yol haritası:**
  - **v1:** Çevrimdışı, 7 bota karşı.
  - **v2:** 1'e 1 online. Sunucu tohumu dağıtır, iki telefon aynı maçı hesaplar.
  - **v3:** 4–8 kişilik online lobi.

---

## 15. İlk sürüm (v1) kapsamı

**Var:**
- 8 kişilik çevrimdışı lobi (7 bot)
- Sezon havuzu, dükkân, ekonomi, seviye
- Bronz / Gümüş / Altın birleşme
- Kulüp, ülke ve kupa sinerjileri
- 12 dilimli maç ve gösterimi
- Hazırlık maçları ve 6 temel eşya
- Gözcü raporu
- 10 taktik kartı
- 3 teknik direktör

**Yok (sonraya):**
- Online
- Eşya birleştirme
- Transfer günü
- Teknik direktör kilitleri
- Lig temalı sezonlar

---

## 16. Kararlar

1. **İsim:** Taktik Tahtası / Pitch Chess.
2. **Süre:** 12–15 dakika.
3. **Gözcü raporu:** 2 altın indirim ve "gözcü" rozeti, güç bonusu yok (bkz. 9).
4. **Ülke karakterleri:** Tablodaki gibi kalıyor; denge simülasyonla ayarlanacak.
5. **Havuz:** Lig sınırı yok, her oyuncu çıkabilir; her lobiye rastgele maç havuzu (bkz. 5.4).

## 17. Görseller

`mobile/assets/brand/taktik/` (kaynak: `tiktako-kadro` paketi, GPT Image):
`hero` (oyun kartı), `card-scout` (gizli kart), `coach-pass-master`,
`coach-defensive`, `coach-pressing`, ve 6 eşya: `item-golden-boot`, `item-gloves`,
`item-shin-guard`, `item-captain-band`, `item-energy-drink`, `item-tactics-board`.

## 18. İlk denge ölçümü (motor v0, 400 bot lobisi)

`node --import ./scripts/lib/alias.mjs mobile/scripts/taktik-sim.mts 400`

| Ölçü | Sonuç | Hedef |
|---|---|---|
| Oyun uzunluğu | ort. 24 tur (20–28) ≈ 14,7 dk | 12–15 dk |
| Gol / takım / maç | 1,75 | 1,3–1,8 |
| Penaltıya giden maç | %21 | — |
| Ülke stilleri ilk 4 | %44–54 | %40–60 |
| Teknik direktörler ilk 4 | %45–55 | %40–60 |
| Bot kişilikleri ilk 4 | %47–55 | %40–60 |
| Gözcüyü bilen / bilmeyen | %51 / %49 | +3–5 |

Not: Mevki verisi henüz kazınıyor; o gelene kadar mevkiler bilinen ilk 11'lerden ve
geri kalanlar için isimden türetilen sabit bir tahminden geliyor. Veri gelince ölçüm yenilenecek.

### Mevki verisiyle yeniden ölçüm (400 lobi)

Mevkiler artık Transfermarkt kadro sayfalarından (16.553 oyuncunun 15.665'i).
Oyun ~24 tur (≈ 14,7 dk), gol 1,85, ülke stilleri %48–53, teknik direktörler
%48–54, bot kişilikleri %48–52. Gözcü raporunun botlar arasındaki etkisi ~0;
gerçek oyuncuda 2 altınlık indirim ekonomide işe yarıyor ama ilk 4'e etkisi küçük.
