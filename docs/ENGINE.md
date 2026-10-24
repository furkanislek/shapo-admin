# Motor API ve veri sözleşmesi

Tüm saf modüller `src/engine/` altındadır. DOM, Worker ve depolama bağımlılığı yoktur. Node CLI ile tarayıcı worker aynı kaynakları kullanır.

```ts
normalize(cells: Cell[]): Cell[]
orientations(piece: Piece, rules: Rules): [orientationKey: string, cells: Cell[]][]
placements(board: Board, piece: Piece, rules: Rules): Placement[]
preflight(board: Board, set: PieceSet, rules: Rules): void
validatePlacements(board, set, rules, placements, full = false): true
solve(board, set, rules, fixed = [], options = {}): Result
generate(board: Board, set: PieceSet, settings: Settings): Level
validateCatalog(value: unknown): Catalog
addLevel(catalog: Catalog, level: Level): Catalog
serialize(catalog: Catalog, player = false): string
```

`Cell = [x,y]`; x sağa ve y aşağı büyür, sıfır tabanlıdır. `mask[y][x]` değeri `1` aktif, `0` dışarıdır. `width`, `height` ve her maske satırı eşleşmelidir. Normalizasyon min x ve min y'yi sıfıra taşır, önce y sonra x ile sıralar. Şekil anahtarı bu sıralamanın `x,y;x,y` metnidir. 90° dönüş `[x,y] → [-y,x]`; yansıtma `[-x,y]`; her dönüş normalize edilir. Kurallar set sürümünde açıkça saklanır. Geometrik eşdeğer parçalar izinli dönüşler altında reddedilir.

Yerleşim `origin` ile normalize yönelimin ofsetidir. `cells` bunun mutlak hücrelerinin sıralı listesidir. `orientationKey`, `origin` ve `cells` birbiriyle tam eşleşmelidir. Hatalı brief örneğindeki A anahtarı `0,0;0,1;0,2` yanlıştır; yatay domino için doğru anahtar `0,0;1,0`'dır. İki durum da test edilmiştir.

Solve seçenekleri: `nodeLimit=200000`, `timeLimit=15000` (ms), `limit=2`, isteğe bağlı `cancelled:()=>boolean` ve ilk döşeme sıralaması için sayısal `seed`. Sonuç `status`, `solutionCount`, `countIsExact`, `classification`, `solutions`, `stats` içerir. Düğüm sınırı tamsayı iş bütçesidir. İki çözümde durmak toplam sayının kesin olduğu anlamına gelmez. `stats` düğüm, geri dönüş, zorunlu adım, dallanma noktası, maksimum derinlik ve geçen süreyi kaydeder. Arama deterministik hücre/parça sırasını kullanır. İlk döşeme için LCG ile karıştırılmış yerleşimler seçilir. `hash` FNV-1a tabanlıdır.

`generate` bir tohumlu tam döşeme bulur, sabitleri hedefe doğru kaldırır; unique politikasında her kaldırma sonrası tekillik ispatı arar. Hedef sabit sayısına ulaşmazsa hata verir. Ardından sabit sıralamalı aramayla zorluğu ölçer ve hedef hat uyuşmazsa reddeder. Worker toplam aday/deneme bütçesini yönetir; reddedilen adaylardan sonra `seed-i` dizisini kullanır. Başarılı adayın gerçek tohumu saklanır. Yalnızca düğüm/deneme bütçeleri ve tamamlanmış hesaplamalarda içerik deterministiktir; saat süreli güvenlik kesilmesi ayrıca raporlanır.

`fingerprint` tahta, sürümlü set, kurallar ve sıralanmış sabit yerleşimlerden kanonik metin üretir. Katalog birleştirme/ekleme bunu karşılaştırır. ID seed/ayarların 32 bit özetidir ve sıralamadan bağımsızdır; çakışan ID katalog eklemede ayrıca reddedilir. Simetrik tahta tekrarları için ek kalite filtresi yoktur. Katalog sürümü her işlemle artar; bölüm revizyonları mevcut ID korunarak saklanır.

`validateCatalog` Ajv Draft 2020-12 yapısal doğrulamasını, envanter/alan/bağlılık/yönelim/kapsama kontrolünü ve yeniden çözümü uygular. Player JSON çözüm içermiyorsa referans yeniden hesaplanır. Validation alanındaki ithal edilmiş iddia körü körüne kullanılmaz. Üretim/doğrulama hataları atılır; UI bunları metin olarak gösterir, HTML çalıştırmaz.

Worker protokolü: `generate {board,set,settings,count,existing}`, `solve {board,set,rules,fixed,nodeLimit?}`, `import {catalog}`. Dönüşler `level`, `progress`, `done`, `solved`, `imported`, `error`. İptal için ana iş parçacığı `worker.terminate()` çağırır; yeni işte yeni worker açılır. Kabul edilenler her level mesajında ana duruma aktarılır; iptal kısmi kataloğu geri almaz.

## Otomatik plan API'si

`runAutomatic(plan, seed, existingCatalog, onLevel, onProgress)` hedef hat/adet haritası alır. `onLevel(level, pieceSet)` kabul edilen tam doğrulanmış bölüm ve sürümlü seti iletir. `createAutomaticPacking(track, seed)` yerel bağlı bölgelerden aynı alanlı envanter ve bağımsız doğrulanmış tam döşeme türetir. `packing.ts` bu işi yapar; `automatic.ts` aday kotalarını, ölçülen zorluk filtresini ve tekrar kontrolünü yürütür.

`generate` isteğe bağlı dördüncü argüman olarak doğrulanacak bir tam döşeme kabul eder; döşemeye güvenip doğrulamayı atlamaz. Dışa aktarılan otomatik ayarlar `method: automatic-1` ve `packingSeed` içerir; argüman verilmediğinde tam döşeme bu bilgilerle yeniden oluşturulur.

Worker protokolüne `automatic {plan,seed,catalog}`, `automatic-level {level,set}`, `automatic-progress {report}` ve `automatic-done {report}` eklendi. UI kabul mesajlarını 120 ms aralıklarla birleştirir, durdurmada kalan tamponu aktarır. Otomatik üretimde sabit parça sırası tohumlu Fisher–Yates ile seçilir; genel manuel üretimin önceki sıralaması korunur.

## Zorluk revizyonu v2 — motor 1.1.0

`automatic-2` profilleri: 4×4 / 4, 6×5 / 6, 7×6 / 8, 10×8 / 14, 16×12 / 24. Son iki profilin `fixedCount` değeri kesinlikle 0 ve politikası `any-valid` olur. `certifyTilings` tam referans döşemeyi ve 180° döndürülmüş döşemeyi bağımsız kapsama doğrulayıcısından geçirir, farklılıklarını denetler ve `multiple`, `solutionCount:2`, `countIsExact:false` verir. Bu bir exact-cover araması değildir; arama istatistikleri 0'dır. İkinci bir döşemenin doğrulanması çözüm çoğulluğu için yeterli tanıktır.

Oyuncu dosyasının içe aktarımında referans yoksa `packingSeed` ile aynı döşeme yeniden tasarlanır ve kapsama doğrulamasından geçirilir. `automatic-1` eski parça profillerini; `estimate-1` eski zorluk eşiklerini kullanmaya devam eder. Yeni `estimate-2` eşikleri 27/55/140/210'dur. İki sürümün aynı isimli seviyeleri aynı zorluğu ifade etmez.

Worker `upgrade-difficulty` eski otomatik bölümlerin hat adetlerini koruyup yeni içerik üretir. Her sonuç `replaceId` taşır; UI mevcut ID'yi korur, revizyon artırır ve eski sürümü geçmişe alır. Durdurma kısmi revizyonları korur.

## Tanınabilir silüet serisi (1.2.0)

20 özgün vektör formu, 16–20 arasındaki beş çözünürlükte örneklenir: toplam 100 farklı, tek bileşenli maske. Hücre sayısı şekilden gelir; envantere uydurmak için maske dikdörtgene çevrilmez. Bağlı ve dönüş altında birbirinden farklı 8–30 parça, maskeyi tam kaplayan deterministik bölüştürmeden üretilir. `silhouette-1` yöntemi, tohum ve parça sayısıyla yeniden üretilebilir.

Bütün seri sıfır sabit parçayla, `any-valid` politikasıyla başlar. Referans dolum bağımsız olarak doğrulanır. Asimetrik maskede 180° dönüş geçerli değilse `certifyTilings` tek doğrulanmış tanığı saklar: `unknown`, sayı 1, `countIsExact:false`. Bu, tek çözüm iddiası değildir; benzersizlik ölçülmemiştir. Geçerli ve farklı ikinci tanık varsa `multiple` kullanılır.

Son seri: 40 orta, 21 zor, 39 uzman. 12 bölümün alanı 192 hücreden, parça sayısı 24'ten ve tahmini puanı standart uzmanın 234 puanından büyüktür. Zorluk puanları tahminidir; insan oyuncularla kalibrasyon yapılmamıştır.
