# Beyaz Nokta / The Spot

Bire bir penaltı düellosu. Tür ve temel fikir (gizli seçim, aynı taraf kurtarış) serbest bir mekanik; isim, görünüm, kod ve metinler bize ait. Başka bir oyunun adını, tasarımını ya da varlıklarını kopyalama.

## Kurallar (`src/lib/spot.ts`)

- Her penaltıda ikisi de gizlice sol / orta / sağ seçer. Aynı taraf kurtarış, başka taraf gol.
- 5'er penaltı, sırayla; X başlar. Fark kapanamaz hale gelince maç biter.
- Eşitlikte ani ölüm, her çift sonunda karar. 10'ar penaltıda hâlâ eşitse berabere.
- Seçim süresi 8 sn. Süresi dolan vurucu kaçırır, kaleci yerinde kalır.
- Bizim katkımız: rakibin önceki seçimleri ekranda durur (vururken atlayışları, kaledeyken vuruşları).

## Online (`server-games/sp.js`, `sp:*`)

Seçimler ikisi de gelene kadar sunucuda kalır; telefon yalnız kimin seçtiğini görür. Rövanş iki oyuncunun da istemesiyle başlar. Elo board ve XP kaynağı "sp".

## Görsel

Codex görsel üretimiyle yapıldı. Kaleci, top ve amblem düz magenta (#FF00FF) zeminde üretilir; `python3 scripts/nokta-assets.py <klasör>` zemini silip `mobile/assets/brand/nokta/` altına yazar. Stadyumu değiştirirsen `SpotBoard.tsx` içindeki `GOAL` ve `SPOT` oranlarını güncelle. Orijinaller commit edilmez.
