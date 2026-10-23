# Dribbling Rush: tasarım dokümanı

Topu süren bir futbolcuyla sahada sonsuz ileri koşu. Üç şerit, zıpla / kay / şerit
değiştir, engellerden kaç, altın topla; arada kaleye gel, kısa bir futbol sorusunu bil,
gol at. Subway Surfers türünde bir "endless runner", ama tamamen kendi teması, karakteri
ve görselleriyle; uygulamanın futbol bilgisi kimliğine bağlı.

## 1. Telif ve sınırlar

- Serbest: tür ve mekanik (şerit, zıplama, kayma, hızlanan koşu, toplama). Telif konusu değil.
- Yasak: "Subway Surfers" adı, logosu, karakterleri, metro / tren / grafiti sahnesi, sesleri,
  arayüzün birebir kopyası. Mağaza metninde başka oyunun adını anmıyoruz.
- Kendi kurallarımız: gerçek oyuncu yüzü, kulüp arması, logo, sponsor yok. Formalar kulüp
  renklerinde düz forma (mevcut Jersey bileşeni). Reklam yok, uygulama içi satın alma yok,
  rastgele sandık yok, "devam etmek için izle / öde" yok.

## 2. Oyun döngüsü

1. **Başla:** Futbolcu orta sahadan topla koşmaya başlar. Kamera arkadan, hafif yukarıdan.
2. **Koş:** Hız saniyeler geçtikçe artar (2 dakikada yaklaşık 2 katı).
3. **Kaç:** Engeller üç şeritte gelir; doğru hareketle geçilir, çarpınca koşu biter.
4. **Topla:** Şeritlerde altın paralar; arada güçlendirmeler.
5. **Kale anı:** İlk kale 260 m'de, sonra her ~420–540 m'de; kale görününce ekranın üstünde
   soru çıkar, şıklar kalenin üç bölmesinde yazar (sorular `quizQuestions(…, "players", "easy")`). Doğru şeridi seçip kaleye girersen GOL: bonus puan + çarpan +1.
   Yanlış şerit "kaleci kurtardı": çarpan sıfırlanır, koşu devam eder (ölüm yok).
6. **Bitiş:** Çarpınca kısa "faul" yavaşlaması, sonra sonuç kartı: mesafe, gol, altın,
   en iyi skor, XP. Tek dokunuşla yeniden başla.

Bir koşu hedef olarak 1–3 dakika. Öğrenmesi 10 saniye.

## 3. Kontroller

- Sola / sağa kaydır: şerit değiştir.
- Yukarı kaydır: zıpla (kayan müdahale, alçak engeller üstünden).
- Aşağı kaydır: kay (yüksek engel / baraj altından).
- Kale anında: şık şeritlerin üstünde yazar; şeride geçmek cevaptır.
- Dokunmatik geri bildirim: şerit değişiminde hafif titreşim, çarpışmada güçlü.
- Sesler: sadece önemli anlarda (gol, rekor, çarpışma); "küçük sesler" kuralı geçerli.

## 4. Engeller

| Engel | Nasıl geçilir | Not |
|---|---|---|
| Kayarak müdahale eden defansçı | Zıpla | Şeride yandan girer, uyarı gölgesi önce görünür |
| Baraj (3–4 defansçı yan yana, kollar havada) | Kay | Yüksek engel |
| Ayakta bekleyen defansçı | Şerit değiştir | Tek şeridi kapatır |
| Hakem (kırmızı kart tutan, yüzsüz) | Şerit değiştir | Hareket eder: bir şeritten diğerine kayar |
| Antrenman konileri dizisi | Zıpla | Alçak, sık |
| Sulama fıskiyesi / su birikintisi | Şerit değiştir ya da zıpla | Kaygan, hafif yavaşlatır (ölümcül değil) |
| Reklam panosu yıkılması (logosuz) | Kay | Nadir, ileri seviye |
| Yedek kulübesi (3D) | Önündeki A-tipi saha panosundan (oklu rampa) çatısına çık ya da şerit değiştir | Önü cam duvar, yanı seni şeridine geri iter; çatısında altın dizisi, bazen bir sonrakine zıplanacak boşluk |
| Çim biçme makinesi (3D) | Şerit değiştir | Sahacı kullanıyor, farları ve tepe lambası yanık, sana doğru gelir; yanındaki şeritlerden biri hep boş |
| Çıta (3D, panonun yerine) | Kay | Kırmızı-beyaz çizgili, iki direk üstünde; altı açıkça boş |

3D oyunda (Unity) bir de **kovalayan** var: **hakem**. Koşunun başında ve her yan çarpmadan sonra hemen
arkanda koşar, sonra geride kalır; ikinci çarpmada yakalar ve kart gösterir. 3D oyunda fıskiye yok.

**Kale ve soru yok (3D):** yerine sahada **harfler** çıkar ve bir futbolcunun adını yazar (`src/lib/kosu/names.ts`,
ekranın üstünde kutular). İsim tamamlanınca: bonus puan, çarpan +1 ve bedava roket top uçuşu; sonra yeni isim.
Kaçırılan harf bir sonraki seferde yine gelir. Harf, sıranın paralarından birkaç metre sonra, boş şeritte tek başına
durur: koşucunun formasını giymiş, askıda bir **forma** üstünde sırt numarası gibi kalın bir 3D harf (iki yüzden de okunur).
Hareket 3D'de daha yumuşak (daha uzun zıplama, yumuşak şerit geçişi).

**Sahne (3D, 2026-10-20 düzeni, Subway Surfers'tan alınan dersler):**

- Kamera koşucunun arkasında alçakta, hiç dönmez (şeritler ekranda hep düz); şerit değişimini kendi hızlı
  yumuşatmasıyla izler, görüş açısı sabit (güçlendirmede kısa bir açılma). Kare hızı ekranın hızı (120 Hz dahil).
- Dünya ufka doğru **kıvrılır** (`RushCurve.cginc`: kameradan d m ileri olan nokta d²·0.0018 m alçalır): saha ~50 m
  sonra ufkun altına yuvarlanır, kuralların 90 m ileride koyduğu her şey "yüklenmek" yerine ufuktan yükselerek gelir.
  Uzaktakiler sise (gök rengi) karışır; karşı tribün resmi kıvrılmaz, ufkun arkasında durur.
- Zemin sakin: daha koyu, az doygun çim, hafif biçme şeritleri, silik şerit çizgileri; 64 m'de bir gerçek saha
  çizgileri (kale çizgisi, ceza sahası, penaltı noktası ve yayı, orta çizgi ve orta yuvarlak). Tribün biraz kısık,
  panolar biraz koyu: parlak olan şey hep şeritteki nesneler (altın, forma-harf, kulübe çatısı). Rampa okları
  lacivert-beyaz, kulübe koltukları açık gri.
- Futbol dokunuşları: koşu **orta yuvarlaktan, santra noktasından** başlar; taç çizgisinde dalgalanan
  **köşe bayrakları**; LED panolar akar; tribünde **fotoğraf makinesi flaşları** (isim tamamlanınca bir fırtına).
- Sahnedeki her uzun parça (tribün, kulübe, pano) kıvrılmaya uyması için dilimli mesh (`Look.LongCube`,
  `Look.GridQuad`); yazılar `Rush/Text` shader'ıyla kıvrılır. Çizim çağrıları için GPU instancing açık; havuzlar ve
  shader'lar açılışta ısıtılır (`Prewarm`), koşu sırasında yeni nesne yaratılmaz.

Görseller: `kosu-3d-brief.md`.

Engel desenleri önceden tasarlanmış küçük "parçalar" (chunk) halinde gelir; her parça en az
bir geçilebilir yol bırakır (bunu üretici kod doğrular).

## 5. Toplanabilirler ve güçlendirmeler

- **Altın para:** Skor + oyun içi altın (sadece istatistik ve XP'ye döner, harcama yok).
- **Krampon (hız botu):** 6 sn hızlanma ve engellerden geçme (dokunulmazlık).
- **Mıknatıslı top:** 8 sn yakındaki paraları çeker.
- **Kaptanlık bandı:** Bir çarpışmayı affeder (kalkan).
- **2× rozet:** 10 sn çift puan.
- **Roket top (3D):** 6 sn her şeyin üstünden uç; havada bir altın yolu, arkanda gökkuşağı izi.
- **Yaylı krampon (3D):** 10 sn yüksek zıpla: otobüs çatılarına, duvarların ve defansçıların üstünden.

Kulübeler, makine, harfler, roket top ve yaylı krampon sadece 3D oyunda: kurallarda `newRun(…, extras)` ile açılır, 2.5D sürüm
eski kurallarla oynar.

Güçlendirmeler satın alınmaz, yükseltilmez; sadece koşu içinde bulunur.

## 6. Puan ve ilerleme

- Puan = mesafe + paralar + goller × 100, hepsi çarpanla.
- Çarpan: her gol +1 (en fazla ×5), yanlış kale anında sıfır.
- XP: mevcut `awardXp` ile; günlük oyun sınırı (practice cap) geçerli, kaynak yeni oyun kodu "run".
- Rekor: telefonda saklanır; giriş yapılmışsa ileride liderlik tablosu "run" eklenebilir
  (sunucuya sadece skor, gizlilik sayfasıyla uyumlu).
- Günlük görevler: "Bir koşuda 3 gol at", "500 m koş" gibi görevler `quests.ts`'e eklenir.
- Rozetler: "İlk 1 km", "5 gol arka arkaya".

## 7. Görünüm (2.5D)

- Uygulamanın tasarım dili: açık, yuvarlak, "3D oyuncak" görünümü; Taktik Tahtası'nın
  eğik saha tekniği (perspektif + rotateX) ileri akan sahaya uyarlanır.
- Saha: çim şeritleri, çizgiler, kenarda tribün silüeti; zemin parçaları sonsuz döner.
- Karakter: arkadan görünen, yüzsüz, tombul oranlı oyuncak futbolcu; forma rengi oyuncunun
  seçtiği kulüp ya da avatar rengi (Jersey katmanlarıyla boyanır).
- Engeller ve toplanabilirler: önceden çizilmiş sprite'lar, mesafeye göre ölçeklenir
  (uzakta küçük, yakında büyük), z-sıralaması kodla.
- 60 fps hedefi: animasyonlar Reanimated / Skia ile UI thread'inde; JS'te sadece
  oyun mantığı (sabit adımlı döngü).

## 8. Teknik plan

- Motor (saf, platformsuz): `src/lib/kosu/` → `rules.ts` (hızlar, aralıklar), `chunks.ts`
  (engel desenleri, geçilebilirlik kontrolü), `engine.ts` (adım fonksiyonu: konum, şerit,
  çarpışma, toplama, kale anı), `questions.ts` (`src/lib/quiz.ts`'teki soru üreticisinden
  3 şıklı kısa sorular). Deterministik (seed), test edilebilir.
- Ekran: `mobile/src/app/kosu/` → `index.tsx` (giriş, rekor), `oyun.tsx` (oyun),
  `components/kosu/` (saha, karakter, engel sprite'ları, HUD, sonuç kartı).
- Çizim: `@shopify/react-native-skia` (Expo uyumlu) ya da mevcut Reanimated + Image
  katmanları; önce Reanimated ile prototip, akıcı değilse Skia.
- Kontrol: `react-native-gesture-handler` kaydırma algılama.
- Denge: `mobile/scripts/kosu-sim.mts` ile otomatik koşucu; ortalama koşu süresi ve
  engel yoğunluğu hedefte tutulur.
- Android ve kısa ekranlar baştan desteklenir.

## 9. Aşamalar

1. Prototip: düz renkli kutularla şerit, zıplama, kayma, çarpışma, hızlanma (1 oturum).
2. Kale anı ve sorular, puan, sonuç kartı, XP (1 oturum).
3. Görseller (brief: `futbol-kosu-brief.md`), saha akışı, karakter animasyonu (1–2 oturum).
4. Güçlendirmeler, görevler, rozetler, ayarlar, rehber (HowTo) ve denge (1 oturum).

## 10. Açık sorular

- Oyunun adı: **Dribbling Rush** (2026-10-17'de seçildi; TR ve EN aynı). Kod adı `kosu` (klasörler, XP kaynağı "run").
- Karakter forması: kullanıcının favori kulübü mü, avatar rengi mi?
- Online: ileride "aynı parkurda arkadaşınla yarış" (aynı seed, skor karşılaştırma) eklenebilir.
