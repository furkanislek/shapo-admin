# Shape Puzzle Studio

Türkçe, sunucusuz 2D parça yerleştirme içerik atölyesi. React + TypeScript + Vite seçildi: worker modülüyle statik derleme, düzenleyicilerde ortak durum ve Node tarafında aynı saf motoru kullanma imkânı verir. Başlangıç deposundaki boş Next.js şablonu Vite yapısıyla değiştirildi; aktif giriş `index.html` ve `src/main.tsx`.

## Çalıştırma

Node 22.12+ (bu teslimatta Node 26.7.0 ile denendi).

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Vite varsayılan portu 5173; doluysa terminalde yazan sonraki portu kullanın. `dist/` statik hosting çıktısıdır. API anahtarı, backend, üyelik ve harici servis yoktur. Tüm fontlar sistem fontudur. Kurulumdan sonra üretim ağ gerektirmez. **Service worker/PWA yoktur**: çevrimdışıyken tarayıcıyı yeniden açma garantisi verilmez. Açık uygulamanın hesaplamaları yereldir.

## Otomatik seri üretim

Üretici artık varsayılan olarak **yalnızca zorluk seviyesi ve bölüm adedi** ister. “Birden fazla seviye için üretim planı” altında başlangıç 30, kolay 100, orta 200, zor 250, uzman 250 hazır planı bulunur. Tek düğmeyle toplam 830 yeni bölüm üretip mevcut kataloğa ekler; önceki bölümleri silmez. Gelişmiş ayarlar bağlantısı eski elle üretim kontrollerini açar.

| Seviye | Tahta | Parça sayısı | Otomatik başlangıç yaklaşımı |
|---|---|---:|---|
| Başlangıç | 4×4 | 4 | Genellikle 1 parça oyuncuya kalır |
| Kolay | 6×5 | 6 | Genellikle 3 parça oyuncuya kalır |
| Orta | 7×6 | 8 | Eski uzman seviyesi; 5–6 parça oyuncuya kalır |
| Zor | 10×8 | 14 | 0 sabit, 14 parçanın tamamı oyuncuda |
| Uzman | 16×12 | 24 | 0 sabit, 24 parçanın tamamı oyuncuda |

Seviyeler yalnızca sabit parça sayısıyla etiketlenmez: ölçülen puan hedef aralıkta değilse aday reddedilir. İlk üç seviyede en çok 30 set kullanılır; zor ve uzmanda boş başlangıçlı aynı bulmacayı seed değiştirerek çoğaltmamak için her bölüm için ayrı bir set tasarlanır; aynı şekli farklı renkle çoğaltmak yerine gerçek parça çeşitliliği sağlanır. Setler, bilinen tam döşemelerden türetilir, bağlılık ve eşdeğer geometri kontrolünden geçer. Başlangıç, kolay ve ortada tekillik bağımsız çözücü geçişiyle ispatlanır. Zor ve uzman boş başladığından `any-valid` politikası kullanılır: referans döşeme ve onun 180° dönüşü bağımsız kapsama doğrulamasından geçer; iki farklı çözümün varlığı kanıtlanır ve toplam sayı bilinmediğinden “en az 2” yazılır. Bu kanıt sırasında arama yapılmadığından düğüm sayısı 0 olarak kaydedilir; arama yapılmış gibi metrik üretilmez. Zorluk yine tahminidir; insan oyuncularla kalibrasyon yapılmamıştır.

Arayüz worker mesajlarını küçük gruplar halinde kataloğa aktarır. Uzun üretimde üç saniyede bir ara kayıt alınır; durdur düğmesi alınan son mesajları da kaydeder. Büyük katalog listeleri hat başına 20 bölümle sayfalanır. Kapasite: tek planda hat başına 0–1000 istek, katalogda en çok 1000 set ve hat başına 1000 bölüm. Arama/çeşitlilik bütçesi nedeniyle bir hedef tamamlanamazsa gerçek kabul sayısı ve red nedenleri gösterilir; eksik sayı başarı diye sunulmaz.

Hazır teslim: [830 bölümlük admin kataloğu](examples/automatic-admin-catalog.json), [oyuncu kataloğu](examples/automatic-player-catalog.json), [gerçek üretim raporu](docs/automatic-generation-report.json). Yeniden üretim:

```sh
npm run generate:auto
npm run cli -- validate examples/automatic-admin-catalog.json
```

Otomatik üretim `generation.method: automatic-2` ve `packingSeed` kaydeder; aynı tohum/ayarlarla saf `generate` API'si de aynı içeriği tekrar üretebilir. Dosyaları içe aktarırken birleştirme mevcut bölümleri korur; değiştirme seçimi dosyadaki 830 bölümle çalışma kataloğunu değiştirir.

## Kullanım

1. İlk açılışta 6×5 dikdörtgen ve kedi/köpek/kalp için dört doğrulanmış örnek katalogda görünür. Çözüm ilk görünümde kapalıdır. Her silüetin ayrı, açık envanteri vardır.
2. Üreticide tahta ve set sürümü seçin. Dikdörtgen/kedi/kalp için Orta hat + 3 sabit parça, köpek demosu için Kolay hat + 3 sabit parça uygun bir başlangıçtır. Hedef hat tutmazsa aday reddedilir; yanlış etiketlenmez. Baby için 5, kolay için 4 sabit parça denenebilir. Her hat için üretim garantisi yoktur.
3. Tohum ve bütçeleri seçip üretin. Tekil üretim de bütçe içinde yeni tohumlu adayları deneyebilir; kabul edilen gerçek tohum bölümde saklanır. Arama bütçeleri altında seri üretim için minimum/maksimum sabit parça aralığı seçilebilir; adaylar bu aralıkta deterministik sırayla denenir. Seri üretimde kabul edilenler doğrudan kataloğa eklenir; yinelenen içerik kabul sayılmaz. Durdur worker'ı sonlandırır ve kabul edilenleri korur. Süre dolarsa eksik adet olduğu rapordan görülür.
4. Çözümü açın; kaydırıcı arama yerleştirme sırasını gösterir. Bu bir insan çözüm açıklaması değildir. Çözüm inceleme düğmesi iki çözüme kadar yeniden arar.
5. Bölümü dene: parça seçin, yönelim değiştirin ve hedef başlangıç hücresine tıklayın; masaüstünde sürükleme de desteklenir. Klavyeyle parça/hücre düğmelerine Tab, Enter veya Space kullanın. Yönelimler izinli dönüş ve varsa yansımalar arasından seçilir. Geçersiz sürükleme kırmızı görünür. Sabit parçalar değişmez. İpucu mevcut hamleleri sabit kabul ederek yeni çözüm arar.
6. Katalogda hat filtresi, sıra okları, manuel hat taşıma, silme/geri alma, yeniden doğrulama ve JSON kopyalama/indirme bulunur. Tam kopya bölüm kataloğa eklenmez; kopyasını dosya olarak indirebilirsiniz. Yeniden üret seçeneği üreticiye yeni tohum taşır; üret düğmesinden sonra revizyon önizlemesini onaylayarak aynı kimliği koruyan revizyon kaydedin. Geçmiş `revisionHistory` içinde tutulur; geri al da kullanılabilir.
7. Dosya yükleme önce worker içinde şema ve semantik doğrulama yapar. Sonra birleştir/değiştir önizlemesi sunar. Hatalı dosya mevcut çalışmayı değiştirmez. Boyut sınırı 50 MB; yapısal sınırlar şemada. Aynı set kimliği/sürümünün farklı içeriği birleştirmede reddedilir.
8. Admin ve oyuncu dışa aktarımları yeniden doğrulamadan geçer. Oyuncu çıktısında revizyon geçmişi dahil `referenceSolution` yoktur; yeniden içe aktarma çözümleri hesaplar.
9. Parça editöründe 6×6 hücre tuvali, isim, kimlik, renk, sembol, dönüş/yansıma ayarları ve yönelim önizlemeleri bulunur. Kaydetme her zaman yeni sürüm oluşturur. Envanter alanı ve eşdeğer geometri kontrolleri uygulanır.
10. Silüet editöründe boyama/silme, yatay ayna, geri al/yinele, alan ve bağlılık kontrolleri bulunur. Doldurulabilirlik çözücüyle ayrıca sınanır. “Bu şekil için parça seti türet” bağlı bölgelerden yeni envanter tasarlar; ardından üreticiyle doğrulayın. Küçük tek renk önizleme tanınabilirliği insanın değerlendirmesi içindir.

IndexedDB katalog, sürümlü setler ve kayıtlı silüetleri saklar; küçük üretim tercihleri localStorage'dadır. Depolama başarısızsa üstte uyarılır; JSON indirerek yedek alın. Silüet editöründeki boyut, boyama ve geri alma değişiklikleri de otomatik kaydedilir. Katalog işlemleri için son 20 geri alma durumu oturum belleğinde tutulur.

## Motor ve doğruluk

[Motor API ve koordinat sözleşmesi](docs/ENGINE.md), [JSON Schema Draft 2020-12](src/engine/catalog.schema.json).

MRV exact cover eşdeğeri arama, hem en az adaylı hücreyi hem en az adaylı parça kimliğini seçer. Her envanter parçası tam bir kez kullanılır. Sabitler önce doğrulanır. Tüm çözümler bağımsız kapsama doğrulayıcısından geçer. Bir yönelimin aynı hücre kümesini veren simetrik tekrarları tekilleştirilir; tahta simetrileri ayrı çözümdür.

İkinci çözümde erken kesme `multiple`, `countIsExact:false` verir. Bütçe/iptal ile 0 veya 1 çözüm bulunması `unknown` verir. `unique` ve `unsolvable` yalnızca tam aramada yazılır. Önbellek yoktur; eski ayarların doğrulaması yeniden kullanılmaz. Arama süre sınırı güvenlik içindir; düğüm/deneme bütçeleri ve tohum sıralaması içerik determinismi içindir. Süre aşımı doğrulanmış tekillik gibi sunulmaz. CPU hızı, süre bütçesi içinde hangi adayların tamamlanabildiğini etkileyebilir.

Varsayılan setler bağlı tahtayı altı bağlı bölgeye deterministik bölerek türetilir. Envanter geometrileri birbirinden farklıdır. Dört demoda her setin doldurulabildiği ve başlangıç sabitleriyle tekillik ayrıca çözücüyle ispatlanmıştır. Her setin her farklı boyutta doldurulacağı iddia edilmez.

## Tahmini zorluk v2 ve arşiv uyumluluğu

Yeni üretim `estimate-2` kullanır: puan formülü aşağıdakiyle aynı, eşikler baby <27, easy <55, medium <140, hard <210, expert ≥210 olarak revize edildi. Böylece önceki uzmanın puanları artık orta aralığındadır. Zor/uzman profilleri daha büyük tahta ve sıfır sabit parça koşulunu da zorunlu tutar. Eski dosyaların `estimate-1` yorumlanması korunur; verileri sessizce yeniden etiketlenmez. Paneldeki “Mevcut otomatik bölümleri yeni ölçeğe uyarla” işlemi eski otomatik bölümleri yeni içeriklerle, aynı ID ve artırılmış revizyonla değiştirir; önceki bölüm `revisionHistory` içinde saklanır.

### Eski v1 formülü ve eşikleri

Deterministik ayrı doğrulama geçişi şu metrikleri kaydeder: kalan parçalar, her parçanın başlangıçta uygun yerleşim sayısı, zorunlu adımlar, dallanma noktaları, geri dönüş, derinlik, kullanılan yönelim çeşitliliği ve yansıtma izni. `elapsedMs` tanıdır; puana girmez.

```
score = round(9 * remaining
  + 6 * log2(1 + backtracks)
  + 3 * log2(1 + nodes)
  + 2 * max(0, maxDepth - forcedMoves)
  + 2 * sum(log2(max(1, initialPlacements[p]))) / max(1, remaining)
  + 2 * max(0, rotationDiversity - 1))
```

Eşikler: baby <27, easy <39, medium <54, hard <72, expert ≥72. `metricsVersion: estimate-1`. İnsan oyuncularla kalibrasyon yapılmamıştır; farklı alanlardaki skorlar doğrudan karşılaştırılmamalıdır. Manuel taşıma orijinal etiketi/puanı korur ve `manualLabel` ekler.

## CLI ve örnekler

```sh
npm run cli -- generate examples/admin-catalog.json
npm run cli -- generate-config examples/generation-config.json /tmp/custom-catalog.json
npm run cli -- validate examples/admin-catalog.json
npm run cli -- export examples/admin-catalog.json examples/player-catalog.json
```

Generate dört şablonun her biri için tekil demo üretir, oyuncu çıktısını ve gerçek ölçüm raporunu da yazar. Hatalar sıfır olmayan çıkış kodudur. API üzerinden özel ayarla üretim `generate(board, set, settings)` ile yapılır. `generate-config` bir JSON ayar dosyasından tek/seri üretir; `boardId` veya doğrudan `board` + `pieceSet` kabul eder. Sonucu ve yanına gerçek rapor dosyasını yazar. İstenen adede ulaşamazsa kısmi kataloğu koruyup sıfır olmayan kodla çıkar.

- [Admin kataloğu](examples/admin-catalog.json)
- [Oyuncu kataloğu](examples/player-catalog.json)
- [Gerçek üretim ölçümleri](docs/generation-report.json)
- [Test/QA raporu](docs/TEST-REPORT.md)
- [Üretici](docs/screenshots/generator.png), [çözüm](docs/screenshots/solution.png), [silüet editörü](docs/screenshots/silhouette.png), [katalog](docs/screenshots/catalog.png)

## Sınırlar ve sonraki aşama

İsteğe bağlı kilitli kenarlar ve “uyumlu kenar öner” uygulanmadı; boş düğme yoktur. Zorluk insanlarla kalibre edilmedi. Otomatik adım animasyonu yerine adım kaydırıcısı vardır. Set editörünün çizim alanı 6×6, tahta sınırı 20×20 ve set başına en çok 30 parçadır; büyük problemlerde arama bütçesi dolabilir. Özel silüet bölme yöntemi altı bölgeyi sınırlı sayıda deneyerek türetir, her çizimde başarı garantisi yoktur. Dışa aktarma schema/solver doğrulaması yapar; dosyadaki geçmiş revizyonlar yapısal doğrulanır, aktif yayın bölümleri semantik olarak yeniden çözülür. Touch cihazlarda sürükleme yerine tıklama/klavye alternatifi kullanılmalıdır.

## Katalogda toplu seçim

Satır başındaki kutularla bölüm seçin. “Bu sayfayı seç” yalnızca görünen satırları, “Filtredekilerin tümünü seç” seçili hattın tüm sayfalarını kapsar; Tümü filtresindeyse kataloğun tamamını seçer. Seçimler filtreler arasında korunur ve seçili sayı her zaman gösterilir. “Seçilenleri sil” veya toplu hat taşıma bir işlemde uygulanır; üstteki “Geri al” ile tamamı geri getirilebilir. Geri alma geçmişi oturum belleğindedir. Silme, eski set tanımlarını ya da başka bölümlerin kimliklerini kaldırmaz. Zor/uzman boş başlangıç kuralını korumak için sabit parçalı bölümler bu hatlara topluca taşınamaz.

## 100 silüetlik seri

Üreticide “100 silüet bölümünü üret ve ekle” düğmesi 20 tanınabilir formun beş ölçeğini üretir. Şekle göre hücre sayısı ve 8–30 parçalık envanter birlikte hazırlanır. En düşük seviye ortadır; bütün bölümler boş başlar. Katalogdaki “Yeni 100 silüetlik seri” filtresi bu seriyi gösterir; siyah şekil ve renkli çözüm yan yanadır.

`npm run generate:silhouettes` aynı deterministik seriyi `examples/silhouette-admin-catalog.json` ve `examples/silhouette-player-catalog.json` dosyalarına yazar. Görsel form sayfası: `docs/silhouettes/overview-20.png`.
