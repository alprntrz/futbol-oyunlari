# Veri kapsam raporu: Transfermarkt yerine serbest kaynaklar (19.10.2026)

Soru: Bugün Transfermarkt'tan gelen veri ne kadar **Wikidata** (CC0, atıfsız serbest) ve **Wikipedia**
(CC BY-SA, atıfla serbest) ile karşılanabilir? Hiçbir veri değiştirilmedi; sadece ölçüldü.

Yöntem: Her oyuncu kendi Transfermarkt kimliğiyle Wikidata'da arandı (özellik P2446), kulüp geçmişi (P54, tüm
kayıtlar) ve ülkesi (P1532 / P27) bizimkiyle karşılaştırıldı. Her tarihi maç için ilgili İngilizce Wikipedia
maddesi okunup bizim ilk 11'deki soyadlarının kaçının geçtiği sayıldı. İstekler yavaş ve toplu yapıldı.

## 1. Oyuncular (Tic-Tac-Toe, Rondo, Ben Kimim?, Bingo, Gizli Oyuncu, Taktik Tahtası, Kart Düellosu)

Toplam 16.553 oyuncu; liste ünlüden az bilinene sıralı.

| Dilim | Wikidata'da var | Tüm kulüpleri eşleşiyor | Kulüp bağlarının eşleşen payı | Ülke eşleşiyor |
|---|---|---|---|---|
| İlk 500 | %99,2 | %80,0 | %88,8 | %95,8 |
| İlk 2.000 | %98,0 | %79,7 | %88,8 | %96,5 |
| İlk 5.000 | %90,9 | %73,2 | %86,6 | %89,4 |
| 5.001 ve sonrası | %82,3 | %66,3 | %80,6 | %80,2 |
| **Hepsi** | **%84,9** | **%68,4** | **%83,4** | **%82,9** |

- Rakamlar alt sınır: Eşleştirme isimden yapıldığı için tek isimli Brezilyalılar ("Fernando", "Alex") ve birkaç
  ünlü (van Dijk, Firmino) bizim taraftaki eşleştirme hatasından kaçtı; Wikidata'da varlar.
- Ballon d'Or: 13 oyuncunun 13'ü Wikidata'da.
- **Zayıf nokta: takım kupaları.** Şampiyonlar Ligi / Dünya Kupası / Avrupa Şampiyonası kazananları ve lig şampiyonluğu
  sayıları (`src/data/honours.ts`) Wikidata'da oyuncu başına tutulmuyor. Büyük turnuvaların final kadroları ve
  "kazanan oyuncular" listeleri Wikipedia'da var; lig şampiyonluğu sayıları için kaynak ayrıca bulunmalı.
- Ölçülmedi: "birlikte oynadı" ve "teknik direktörü" kriterleri (`teammates.ts`, `coaches.ts`). Wikidata'daki kulüp
  kayıtlarının çoğunda başlangıç / bitiş yılı var, bunlardan türetilebilir ama ayrıca ölçülmeli.
- Kart Düellosu'nun sayıları zaten Wikidata'dan geliyor.

## 2. Tarihi maçlar (Eksik 11)

Toplam 901 maç (2000'lerden 208, 2010'lardan 427, 2020'lerden 257).

| Tür | Maç | Wikipedia'da ilk 11 (10+ isim) |
|---|---|---|
| Şampiyonlar Ligi finali | 28 | 28 |
| Dünya Kupası finali / yarı final / çeyrek final | 44 | 44 |
| Avrupa Ligi / UEFA Kupası finali | 21 | 20 |
| Türkiye Kupası finali | 20 | 13 |
| Copa América, Euro 2024 eleme turları | 5 | 5 |
| Şampiyonlar Ligi / Avrupa Ligi / UEFA Kupası çeyrek ve yarı finalleri | 150 | 0 |
| Lig ve kupa derbileri (Süper Lig, El Clásico, Kuzey Londra…) | 616 | 0 |
| **Toplam** | **901** | **yaklaşık 110 (%12)** |

Wikipedia'da kadro sadece final ve Dünya Kupası maçlarında var. Avrupa kupalarının çeyrek ve yarı final sayfalarında
sadece skorlar var; derbilerin ise maç başına maddesi yok.

## 3. Sonuç

- **Oyuncuya dayalı oyunlar Wikidata'ya taşınabilir.** Ünlü oyuncuların neredeyse hepsi var; kaybedilecek olan büyük
  ölçüde listenin sonundaki az bilinen oyuncular. Takım kupaları için Wikipedia listeleri gerekiyor.
- **Eksik 11 asıl sorun.** Serbest kaynaklarla maçların yalnızca yaklaşık %12'si karşılanıyor. Seçenekler:
  1. Eksik 11'i Wikipedia'da kadrosu olan yaklaşık 110 maça indirmek (finaller ve Dünya Kupası). Dikkat: maç listesi
     değişirse günlük bulmacanın gelecekteki sırası değişir.
  2. Derbiler ve Avrupa kupası maçları için lisanslı bir API'den kadro almak. API'lerde kadrolar genelde 2010'lardan
     sonrası için var; önce ücretsiz planla kaç maçın karşılandığı ölçülmeli.
  3. İkisini birleştirmek: finaller Wikipedia'dan, 2010 sonrası derbiler API'den.
