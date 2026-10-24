# AI Uygulama Görevi: 2D Parça Yerleştirme Bölüm Üreticisi ve Admin Paneli

Bu dokümanı uygulamayı geliştirecek AI'a doğrudan görev olarak ver. İstenen çıktı yalnızca tasarım, plan veya örnek kod değil; yerelde çalışan, bölüm üreten, çözümleri gösteren ve doğrulanmış JSON kataloglarını dışa aktaran tamamlanmış bir web uygulamasıdır.

## 1. Amaç ve kapsam

Kanoodle / IQ Puzzler benzeri 2D parça yerleştirme oyunu için bir içerik üretim aracı geliştir. Ürün için geçici ad `Shape Puzzle Studio` kullan. Kendi parça setimizi ve bölüm kataloğumuzu tasarla; fiziksel bir ürünün bölüm kitapçığını, marka kimliğini veya görsel varlıklarını kopyalama.

Standart bölümler düz dikdörtgen tahtalarda oynanır. Özel bölümler kedi, köpek, kalp gibi uzaktan bakınca tanınabilecek silüet tahtalar kullanır. Oyuncu, başlangıçta sabit yerleştirilmiş parçaların yanına kalan parçaları yerleştirerek tüm kullanılabilir hücreleri boşluksuz ve çakışmasız doldurur.

Bu görev Star Battle içermez. 3D piramit, kullanıcı hesabı, ödeme, mobil oyun uygulaması ve bulut veritabanı kapsam dışıdır. Öncelik doğru ve kullanılabilir bir üretim aracıdır.

## 2. Referans: Recto admin paneli

Referans projeye erişimin varsa önce şu dosyaları incele:

- `admin/README.md`: mevcut iş akışı ve kullanım şekli.
- `admin/index.html`: form, önizleme ve katalog düzeni.
- `admin/css/admin.css`: sakin görsel dil ve tasarım değişkenleri.
- `admin/js/app.js`: katalog yönetimi ve dosya işlemleri.
- `admin/js/engine.js`: tohumlu üretim, çözücü ve doğrulama ayrımı.
- `tool/generate_catalog.mjs`: tarayıcı dışında aynı motorla üretim.
- `DESIGN.md`: erişilebilir olduğu ölçüde tipografi ve renk yaklaşımı.

Recto panelinin davranışını örnek al; Shikaku motorunu bu oyunun motoru olarak kullanma. Yeni geometri ve çözücü gerekir. Mevcut Recto dosyalarını, Firebase ayarlarını veya mobil kataloglarını değiştirme. Aynı depoda çalışıyorsan yeni uygulamayı `shape-puzzle-admin/` içinde oluştur. Referans dosyalar yoksa bu dokümandan bağımsız çalışan uygulama üret.

Recto'dan korunacak iş akışı: zorluk hattı seç → ayarları belirle → tek bölüm üret → çözümü incele → seri üret → kataloğa ekle → sırala → doğrulanmış JSON indir.

## 3. Teknik yaklaşım

- Statik olarak barındırılabilen TypeScript web uygulaması; Vite kullan. UI için React veya sade TypeScript seçebilirsin; seçim README'de açıklansın.
- Sunucu, API anahtarı, üyelik veya harici AI servisi gerektirme.
- Tahta ve parçaları SVG ile çiz; hücre merkezlerinde yuvarlak boncuk görünümü ve parçayı bütün gösteren bağlantılar kullan. İnceleme sırasında kare hücre katmanı açılabilsin.
- Üretim ve çözüm aramasını Web Worker içinde çalıştır. Ana UI uzun hesaplamalar sırasında kullanılabilir kalsın.
- Saf motor modülleri DOM, Worker ve tarayıcı depolamasından bağımsız olsun; aynı motor Node CLI'dan kullanılabilsin.
- Çalışma kataloğu, parça setleri ve silüetler IndexedDB'de saklansın. Küçük UI tercihleri localStorage'da tutulabilir.
- Türkçe arayüz; kod tanımları ve JSON anahtarları İngilizce.
- Kurulumdan sonra üretim için ağ bağlantısı gerekmesin. Çevrimdışı yeniden açılış gerekiyorsa bunu ayrıca service worker ile uygula; yalnızca statik dosya kullanmayı PWA desteği olarak sunma.
- Statik hosting için derleme üret; otomatik deploy yapma.

Önerilen modüller: `geometry`, `pieces`, `placements`, `solver`, `generator`, `difficulty`, `silhouettes`, `validation`, `catalog`, `worker`, `storage`, `ui`, `cli`.

## 4. Koordinat ve oyun kuralları

Tüm koordinatlar `[x, y]` biçiminde sıfır tabanlı tamsayılardır. x sağa, y aşağı artar. Dizi satırları y, satır içindeki sütunlar x yönünü temsil eder.

Tahta `width`, `height` ve bu boyutlarla tam eşleşen `mask` içerir. Maskede `1` oynanabilir hücre, `0` tahta dışıdır. Standart tahta tamamen 1'dir. Silüet tahtalarda sıfırlar olabilir.

Her parça:

- Benzersiz, kalıcı bir kimliğe sahiptir.
- Yerel hücre koordinatlarından oluşur; tekrar eden hücre içermez.
- Kenardan komşulukla tek bağlı bileşen oluşturur.
- Renk dışında sembol/etiket ile de ayırt edilir.
- Normalleştirilmiş temel şekil olarak saklanır: min x ve min y sıfırdır; hücreler sabit sırada tutulur.

Her envanter parçası tam bir kez kullanılmalıdır. Başlangıç parçaları oyuncu tarafından taşınamaz. Hareketli parçalar yalnızca izin verilen dönüşlerle yerleştirilebilir. Parçalar çakışamaz, tahta dışına veya maskenin sıfır hücresine taşamaz. Tüm aktif hücreler kaplandığında bölüm tamamlanır.

İlk sürümde aynı geometriye sahip iki ayrı parça kimliğine izin verme; düzenleyicide açık hata ver. Böylece renkleri farklı ama geometrileri aynı parçaların yer değiştirmesinin çözüm sayısını şişirmesi önlenir. Sonradan bu destek eklenecekse eşdeğer parça sınıflarıyla çözüm kanonikleştirmesi gerekir.

## 5. Parça seti düzenleyicisi

Yeni set oluştur, kopyala, düzenle, JSON yükle ve indir. Hücreye tıklayarak şekil çiz; parça ekle/sil, isim, renk ve kısa sembol tanımla. Toplam alanı canlı göster.

Döndürme ve yansıtma kurallarını set seviyesinde açıkça ayarla. 90 derece dönüşler desteklenir. Yansıtma ayrı bir seçenektir; 2D oyunda kullanılabilir ama sessizce varsayılmaz.

İzin verilen dönüşleri hesapla, normalize et, simetrik tekrarları ele ve önizle. Örneğin kare tek bir yönelim üretmelidir. Birden çok yönelim aynı hücre kümesini veriyorsa farklı çözüm sayılmamalıdır.

Varsayılan demo seti 6×5 dikdörtgeni doldurabilen, birbirinden farklı geometrili parçalardan oluşsun. Seti bilinen tam bir döşemeden türetip geçerliliğini çözücüyle kanıtla. Çalıştığı doğrulanmamış rastgele seti varsayılan olarak sunma. JSON örneğindeki küçük eğitim seti, daha zengin demo setinden ayrıdır.

Parça setleri sürümlü ve değişmez referanslar olsun. Kullanılmış set düzenlendiğinde yeni sürüm oluştur; eski bölümler eski sürüme bağlı kalır.

## 6. Tahta ve silüet düzenleyicisi

İki mod sun:

1. Dikdörtgen: genişlik ve yükseklik seçimi.
2. Silüet: hücre boyama, silme, geri al/yinele ve isteğe bağlı yatay ayna ile düzenleme.

Canlı bilgiler: aktif alan, parça toplam alanı, bağlı bileşen sayısı, sınırlayıcı kutu, doldurulabilirlik durumu. İlk sürümde tek bağlı bileşen şarttır; iç delikler desteklenebilir ama açıkça gösterilmelidir.

Hazır şablonlar: kedi, köpek, kalp. Bunları doldurulabilirliği doğrulanmış parça seti/alt envanteri ile sun. Her silüetin aynı parça setiyle doldurulacağını varsayma. Gerekirse özel bölüme ayrı, açıkça tanımlanmış parça seti bağla. Envanterde hangi parçaların bulunduğu oyuncu JSON'unda açık olsun; gizli parça atma yapma.

Kedi için kulaklar ve kuyruk, köpek için kulak/burun/gövde gibi belirgin noktalar tasarımda korunmalıdır. Tanınabilirlik insan tarafından incelenir; çözücü bunu ölçmüş gibi bir garanti verme.

Silüeti iki şekilde göster: siyah tek renk dolu şekil ve renkli parça yerleşimi. Küçük önizleme, şeklin uzaktan okunmasını kontrol etmeye yardımcı olsun.

### İsteğe bağlı kenar düzeltme

Editör hücreleri `lockedOn`, `lockedOff`, `editable` olarak işaretleyebilsin. Ayrı bir “Uyumlu kenar öner” işlemi, yalnızca düzenlenebilir hücrelerde sınırlı ekleme/silme deneyebilir. Alan, bağlılık ve doldurulabilirliği denetlesin. Değişiklik bütçesi ve deneme sınırı olsun. Korunan kulak/burun hücrelerine dokunmasın. Öneriyi önce/sonra farkıyla göster; kullanıcı uygulamadan asıl silüeti değiştirme.

Bu özellik ilk sürümün zorunlu çekirdeği değildir. Yapılmazsa gizli/boş buton bırakmak yerine README'de sonraki aşama olarak belirt.

## 7. Çözücü: temel doğruluk şartları

Exact cover (Algorithm X) veya eşdeğer MRV + backtracking kullan. Her aktif hücre bir kez kaplanmalı, her parça kimliği bir kez seçilmelidir. Her satır bir parçanın belirli yönelim ve konumdaki geçerli yerleşimini temsil eder.

Akış:

1. İzin verilen benzersiz parça yönelimlerini üret.
2. Maske içinde kalan tüm geçerli yerleşimleri üret.
3. Sabit parçaları doğrula; kapladıkları hücreleri ve parça kimliklerini aramadan çıkar.
4. En az adaylı kısıtı seçerek ara; sıralama deterministik olsun.
5. Tekillik kontrolünde ikinci farklı çözüm bulunduğunda dur.

API en az şunları dönsün:

- `status`: `complete`, `timeout`, `cancelled`, `node_limit`.
- `solutionCount`: bulunan çözüm sayısı; limitte kesildiyse toplam sayıyı temsil etmez.
- `countIsExact`: tüm arama tamamlandıysa true, ikinci çözümde veya bütçede kesildiyse false.
- `classification`: `unsolvable`, `unique`, `multiple`, `unknown`.
- `solutions`: limit dahilinde geçerli yerleşimler.
- `stats`: nodes, backtracks, forcedMoves, maxDepth, elapsedMs.

Kurallar:

- Tam arama + 0 çözüm = unsolvable.
- Tam arama + 1 çözüm = unique.
- En az 2 çözüm = multiple; toplam sayı bilinmeyebilir.
- Bütçede kesilip 0 veya 1 çözüm bulunması = unknown; asla unique veya unsolvable yazma.
- Her dönen çözümü bağımsız kapsama doğrulayıcısından geçir.

Tahta simetrileriyle birbirine dönüşen farklı yerleşimler ilk sürümde ayrı çözümdür. Yalnızca aynı parçanın aynı hücre kümesini veren yönelim tekrarları birleştirilir. Bu sayım politikası panelde ve JSON'da açıkça kaydedilsin.

Önbellek anahtarlarına maske, set sürümü, dönüş kuralları ve sabit parçalar dahil olsun. Eski bir tekillik sonucunu farklı ayarda kullanma.

## 8. Bölüm üretimi

### Tek bölüm

- Tohumlu PRNG ile deterministik tam döşeme bul.
- Bazı parçaları başlangıçta sabit bırak; diğerlerini oyuncu envanterine koy.
- Seçilen çözüm politikasına göre çözücü çalıştır.
- Zorluk ve kalite koşullarını kontrol et.
- Başarısız adayları deneme bütçesi içinde değiştir.

İki politika destekle:

- `unique`: tek çözümlülüğü ispatlanmış bölümler; varsayılan yayın politikası.
- `any-valid`: birden fazla tamamlanması kabul edilen bölümler. En az bir çözüm doğrulanmış olmalı; ipucu sistemi mevcut oyuncu durumunu tamamlayabilen bir çözüm bulmalıdır. Saklanan tek referans çözüme uymamak hata değildir.

`unique` için tam yerleşimden başlayıp sabit parçaları sırayla kaldırmak uygun bir yöntemdir. Her kaldırmada tekilliği tekrar kontrol et. Hedef sabit parça sayısına ulaşamıyorsa sessizce farklı ayarla üretme; hedefe ulaşılamadığını bildir.

### Toplu üretim

Ayarlar: adet, başlangıç tohumu, tahta/şablon, set sürümü, çözüm politikası, zorluk hedefi, sabit parça aralığı, aday başına düğüm sınırı, toplam deneme sınırı ve güvenlik zaman sınırı.

İlerleme: denenen aday, kabul edilen bölüm, reddetme nedenleri ve geçen süre. ETA yalnızca yeterli veri varsa “tahmini” etiketiyle gösterilsin.

Durdur düğmesi gerçekten aramayı iptal etsin. Worker senkron aramada mesaj işleyemiyorsa aramayı parçalara bölerek event loop'a dön veya worker'ı sonlandırıp yeniden kur. O ana kadar kabul edilen bölümleri koru.

Tohum + normalleştirilmiş ayarlar + motor sürümü aynıysa aynı içerik üretilmeli. Zaman bütçesi cihaz hızına göre sonucu değiştirebileceğinden içerik seçiminde deterministik düğüm/deneme bütçeleri kullan. Zaman aşımını başarı gibi dışa aktarma. Tarih ve elapsedMs gibi değişken tanı alanlarını içerik determinismi testinden hariç tut.

### Tekrar önleme

Tahta, set sürümü ve sıralanmış sabit yerleşimlerden kararlı içerik parmak izi üret. Aynı oynanabilir bölümü farklı seed veya id ile yeniden ekleme. Tamamen simetrik tekrarları engelleyen ek filtre varsa bunu ayrı katalog kalite tercihi olarak uygula; çözücüdeki tekillik politikasıyla karıştırma.

## 9. Zorluk değerlendirmesi

Hatlar: `baby`, `easy`, `medium`, `hard`, `expert`. Sabit parça sayısı yalnızca bir girdidir; tek başına zorluk değildir.

Sabit sıralamalı ayrı değerlendirme geçişinde şunları ölç:

- Kalan parça sayısı ve her parça için başlangıçta mümkün yerleşim sayısı.
- Zorunlu yerleşim sayısı.
- Dallanma noktaları, geri dönüş sayısı ve arama derinliği.
- Gerekli görsel döndürme/yansıtma çeşitliliği.

İlk sürümde puanı “tahmini zorluk” olarak göster. Formül ve eşikler README'de yazılı olsun; metrik sürümü JSON'da saklansın. CPU süresini ana zorluk ölçütü yapma. Farklı tahta boyutlarında puanların doğrudan karşılaştırılabilir olduğunu varsayma.

Hatlara kademeli üretim ekle. Hedef hatta uygun aday bulunamazsa daha kolay/zor adayı sessizce o hatta etiketleme. Operatör bölümü manuel taşıyabilsin; orijinal puan ve manuel etiket ayrı kalsın.

## 10. Panel ekranları ve kullanıcı akışı

### Üretici

Masaüstünde üç ana alan: solda ayarlar, ortada büyük tahta, sağda bölüm bilgileri ve çözüm kontrolleri. Altta/ayrı sekmede katalog. Dar ekranda bölümler dikey sıralansın.

Kontroller:

- Hat seçimi; dikdörtgen/silüet; set ve sürüm; seed.
- Boyutlar, sabit parça hedefi, çözüm politikası ve üretim bütçeleri.
- Tek üret, seed değiştir, seri üret, durdur.
- Üretileni önizle, kataloğa ekle veya seçili hattı onayla değiştir.
- İlk görünüm yalnızca sabit parçaları ve boş hücreleri göstersin; çözüm varsayılan kapalı olsun.

### Çözüm inceleme ve oynama

- “Çözümü göster” aç/kapat; sabit parçalarda kilit işareti.
- Parça seçince hücrelerini, id'sini ve yönelimini göster.
- Birden çok çözüm bulunmuşsa bulunan çözümler arasında gezin; “en az 2” ile kesin toplamı ayır.
- Adım adım gösterim, solver yerleştirme sırasını oynatabilir; bunu “mantıksal insan çözümü” diye sunma.
- Basit “Bölümü dene” modu: kalan parçayı sürükle, döndür, izin varsa yansıt; grid snapping ve geçersiz konum önizlemesi. Klavye/butonla alternatif yerleştirme de olsun.
- Sabit parça taşınamasın; sıfırla yalnızca oyuncu hamlelerini kaldırsın.
- “İpucu” oyuncunun mevcut durumundan çözüm arar. Durum çözümsüzse rastgele referans parçası basmak yerine geri alınması gereken durum olduğunu bildir.
- Silüet için çözüm sınırlarını ve parça renklerini kapatıp tek renk görünümü aç.

### Katalog

Hatlara göre liste, küçük tahta önizlemesi, sıra, id, tür, seed, zorluk ve doğrulama durumu. Filtrele, yeniden sırala, taşı, kopyala, sil, yeniden üret ve yeniden doğrula.

Yeniden üretme mevcut bölümün id'sini ve geçmişini sessizce değiştirmesin; yeni revizyon olarak değiştirildiğini bildir. Silme ve hat değiştirme geri alınabilsin. ID'ler sıralamadan bağımsız, kalıcı olsun; sıra `order` ile değişsin.

Özel bölüm ritmi: seçilen her N standart bölümden sonra silüet eklemeye yardımcı sıra düzenleme; örneğin N=15. Yeterli doğrulanmış özel bölüm yoksa açıkça bildir.

### Dosyalar ve kalıcılık

- Tam katalog JSON indir/yükle/kopyala.
- Yalnızca seçili bölüm JSON indir.
- Oyuncu kataloğu ve çözümlü admin kataloğunu ayrı dışa aktar.
- İçe aktarmada dosya boyutu ve yapısal sınırlar uygula; hatayı alan yolu ve bölüm id'siyle göster.
- Önce geçici bellekte doğrula, sonra mevcut kataloğa birleştir/değiştir seçimi sun. Hatalı import mevcut çalışmayı ezmesin.
- Otomatik kayıt durumu ve son kayıt zamanı; depolama hatalarında indirme ile kurtarma.
- İçe aktarılan metinleri HTML olarak çalıştırma.

## 11. JSON sözleşmesi

JSON Schema Draft 2020-12 sağla. Boyut eşleşmesi, alan toplamı ve kapsama gibi JSON Schema'nın tek başına garanti edemediği kontrolleri semantik doğrulayıcıyla yap.

Kök alanlar:

- `schemaVersion`: sayısal sözleşme sürümü.
- `game`: `shape-packing-2d`.
- `catalogId`, `catalogRevision`, `engineVersion`.
- `coordinateSystem`: `xy-zero-based`.
- `pieceSets`: sürümlü parça tanımları.
- `tracks`: beş hattın bölüm dizileri.

Bölüm alanları:

- Kalıcı `id`, `revision`, `order`, `kind` (`rectangle` veya `silhouette`).
- `pieceSetId`, `pieceSetVersion`, `pieceIds`: bu bölümün tam envanteri.
- `board`: width, height, mask; silüette ayrıca templateId ve shapeLabel.
- `fixedPlacements`: oyuncunun başlangıçta gördüğü parçalar.
- `rules`: allowRotations, allowReflections, solutionPolicy.
- `generation`: seed ve kullanılan normalleştirilmiş üretim ayarları.
- `difficulty`: label, estimatedScore, metricsVersion, metrics ve varsa manualLabel.
- `validation`: classification, solutionCount, countIsExact, status, symmetryPolicy ve motor sürümü.
- Admin çıktısında `referenceSolution`; oyuncu çıktısında çıkarılır.

Her yerleşim `pieceId`, `orientationKey`, `origin: [x,y]`, `cells` içerir. `orientationKey`, normalize edilmiş yönelimin hücrelerinden türetilen kararlı anahtardır; çalıştırma sırasında oluşan geçici indeks olmasın. `cells` mutlak tahta koordinatlarıdır. Gereksiz görünse de Flutter tüketicisinin çözümü kolayca incelemesi için saklanır; validator bunların şekil, yönelim ve origin ile tutarlı olduğunu doğrular.

### Küçük, gerçekten çözülebilir JSON örneği

Aşağıdaki örnek alanları göstermek için 3×2 eğitim tahtasıdır. A sabit olduğunda B için kalan konum tektir. Bu örneği tüm zorluk hattının içerik kalitesi için örnek alma.

```json
{
  "schemaVersion": 1,
  "game": "shape-packing-2d",
  "catalogId": "demo",
  "catalogRevision": 1,
  "engineVersion": "1.0.0",
  "coordinateSystem": "xy-zero-based",
  "pieceSets": [
    {
      "id": "tutorial-6",
      "version": 1,
      "pieces": [
        { "id": "A", "color": "#647D68", "symbol": "A", "cells": [[0,0],[1,0]] },
        { "id": "B", "color": "#CA956B", "symbol": "B", "cells": [[2,0],[0,1],[1,1],[2,1]] }
      ]
    }
  ],
  "tracks": {
    "baby": [
      {
        "id": "tutorial-001",
        "revision": 1,
        "order": 1,
        "kind": "rectangle",
        "pieceSetId": "tutorial-6",
        "pieceSetVersion": 1,
        "pieceIds": ["A", "B"],
        "board": { "width": 3, "height": 2, "mask": ["111", "111"] },
        "rules": { "allowRotations": true, "allowReflections": true, "solutionPolicy": "unique" },
        "fixedPlacements": [
          { "pieceId": "A", "orientationKey": "0,0;1,0", "origin": [0,0], "cells": [[0,0],[1,0]] }
        ],
        "referenceSolution": [
          { "pieceId": "A", "orientationKey": "0,0;0,1;0,2", "origin": [0,0], "cells": [[0,0],[1,0]] },
          { "pieceId": "B", "orientationKey": "2,0;0,1;1,1;2,1", "origin": [0,0], "cells": [[2,0],[0,1],[1,1],[2,1]] }
        ]
      }
    ],
    "easy": [], "medium": [], "hard": [], "expert": []
  }
}
```

Bu kısaltılmış örnekte A yatay domino, B ise kalan dört hücreyi dolduran L parçasıdır. orientationKey hücreleri önce y, sonra x sırasıyla yazar. Örneği otomatik validator testlerine de ekle. Eksik generation/difficulty/validation alanlarını nihai uygulamanın dışa aktardığı tam örnekte doldur.

Oyuncu kataloğundan admin çözümünü çıkarmak bir güvenlik garantisi değildir; bulmaca zaten çözülebilir. Amaç veri boyutu ve tüketici sözleşmesidir. Oyuncu kataloğu yeniden içe alındığında çözümü yeniden hesaplayabilmeli.

## 12. Ön kontroller ve hata mesajları

Üretimden önce şunları kontrol et:

- Aktif alan = seçilen envanterin toplam alanı.
- Maske ve parça bağlılıkları, geçerli koordinatlar, benzersiz id'ler.
- Parçaların izinli yönelimlerden en az biri tahtaya sığabiliyor mu?
- Sabit parçalar envanterde mi, bir kez mi kullanılmış, çakışıyor mu?
- Parite, alan bileşenleri veya başka budama koşulları varsa yalnızca matematiksel olarak güvenli eleme uygula. Bir sezgisel başarısız oldu diye imkânsız ilan etme.

Hata metinleri somut olsun: “Tahta 42 hücre, parça envanteri 40 hücre”; “B parçası sabit A ile (3,2) hücresinde çakışıyor”; “Arama sınırına ulaşıldı; tek çözümlülük henüz doğrulanamadı”.

## 13. Görsel dil ve erişilebilirlik

Recto'daki açık kırık beyaz yüzeyler, koyu okunaklı yazı, ince çizgiler ve sakin yeşil vurgu yaklaşımını kullan. Hanken Grotesk / JetBrains Mono yerelde varsa kullan, yoksa sistem fontu seç. Büyük gölgeler ve gereksiz animasyonlarla paneli ağırlaştırma.

Renk tek bilgi taşıyıcısı olmasın: parça harfleri, kilit simgesi ve durum metinleri kullan. Klavye odağı görünür, form alanları etiketli, hata mesajları alanlara bağlı olsun. Uzun çalışan işlemler ve sonuçlar erişilebilir durum alanında bildirilsin. Animasyon azaltma tercihini destekle.

## 14. Test ve kabul kriterleri

Algoritma testleri zorunludur; yalnızca UI'nın açılması tamamlanma sayılmaz.

- Normalizasyon, rotasyon, yansıtma ve simetrik yönelim tekilleştirme testleri.
- Sıfır, bir ve birden çok çözümü bilinen küçük fixture'lar.
- Timeout/iptal/düğüm sınırında classification'ın yanlışlıkla unique olmaması.
- Sabit parçaların bütün çözümlerde korunması.
- Her aktif hücrenin tam bir kez kaplanması; her envanter parçasının bir kez kullanılması.
- İzin verilmeyen yansıtmanın kullanılmaması.
- Dikdörtgen ve silüet üretimi, alan uyuşmazlığı ve doldurulamayan maske durumları.
- Aynı seed + sürüm + ayar için içerik determinismi.
- Katalog tekrar kontrolü; JSON import/export round-trip; bozuk importta verinin korunması.
- Oyuncu çıktısında çözüm alanının bulunmaması, yeniden importta çözümün hesaplanabilmesi.
- Worker iptali, kısmi serinin korunması ve üretim sırasında UI'nın yanıt vermesi.
- Basit oynama modunda geçerli/çakışan yerleşim ve tamamlama kontrolü.

Ölçülmüş bir üretim raporu ekle: kullanılan set/tahta, seed'ler, aday sayısı, kabul/red nedenleri, üretim süresi ve doğrulanmış bölüm sayısı. İstenen adedi üretemediysen gerçek sonucu yaz; başarı yüzdesi uydurma.

Teslimatta en az bir standart dikdörtgen ve kedi/köpek/kalp şablonlarının her biri için en az bir doğrulanmış oynanabilir bölüm bulunmalı. Şablonlar farklı set kullanıyorsa bunu panel ve katalog açıkça göstersin. Tek çözümlülük gerektiren örnekler ispatlanmış olmalı.

## 15. Teslimatlar

1. Çalışan kaynak kod ve kilit dosyası.
2. Kurulum, geliştirme, test ve statik build komutlarını içeren README.
3. Motor API ve koordinat/dönüş sözleşmesi dokümanı.
4. JSON Schema, admin katalog örneği ve oyuncu katalog örneği.
5. Node CLI: üret, doğrula ve katalog dışa aktar işlemleri; hatada sıfır olmayan çıkış kodu.
6. Geçerli varsayılan parça seti, üç silüet şablonu ve doğrulanmış demo bölümleri.
7. Çalıştırılmış testlerin ve gerçek üretim ölçümlerinin kısa raporu.
8. Kullanım ekran görüntüleri: üretici, çözüm görünümü, silüet düzenleyici ve katalog.

## 16. Uygulama sırası

Önce veri modeli ve geometriyi kur; küçük fixture'larla çözücüyü doğrula. Sonra dikdörtgen üretimi ve JSON doğrulamayı tamamla. Ardından worker, panel ve katalog akışını bağla. Sonra silüet editörü, doğrulanmış şablonlar ve oynama önizlemesini ekle. Son olarak toplu üretim, zorluk kalibrasyonu, import/export ve görsel QA yap.

Rutin teknik tercihlerde makul varsayımla ilerle; her adımda kullanıcıdan izin isteme. Çalışmayan özellikleri çalışıyor gibi gösterme. Özellikle sahte çözüm sayısı, sabit yazılmış zorluk puanı ve kanıtlanmamış tek çözümlülük kabul edilmez. Nihai yanıtta çalıştırma komutlarını, test sonucunu ve varsa gerçek sınırlamaları açıkça belirt.
