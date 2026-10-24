# Test ve üretim raporu

Tarih: 18 Ekim 2026. Ortam: macOS, Node 26.7.0, React 19.3.0, Vite 8.3.4.

## Çalıştırılan kontroller

- `npm test`: **16 test geçti, 0 hata**. Son çalıştırmada toplam yaklaşık 0,84 saniye.
- `npm run build`: TypeScript strict + kullanılmayan tanım kontrolleri ve Vite statik derlemesi başarılı. Çıktı `dist/`.
- `npm run cli -- validate examples/admin-catalog.json`: 4 bölüm doğrulandı.
- `npm run cli -- validate examples/player-catalog.json`: 4 bölüm doğrulandı; çözümler yeniden hesaplandı.

Motor testleri normalizasyonu, dönüş ve yansıma kurallarını, kare simetrisinin tekilleşmesini, bilinen sıfır/bir/çok çözümü, sabitlerin korunmasını, eksiksiz kapsama ve tek envanter kullanımını denetler. Timeout, cancelled ve node_limit sonuçlarının yanlış tekillik bildirmemesi, özellikle bir çözümden sonra düğüm bütçesinin dolması test edilir. Brief'teki yanlış orientationKey reddedilir. Yansıtma kapalıyken yalnızca ayna görüntüsüyle çözülebilen fixture imkânsız çıkar; yansıtma açıkken tekil çözülür.

Katalog testleri tohum determinismi, içerik tekrarını isim/seed değişikliğiyle aşamama, kalıcı ID çakışması, JSON round-trip, bozuk importta mevcut verinin korunması, player çıktısında geçmiş revizyonlar dahil çözüm alanı olmaması ve player importta yeniden çözüm bulmayı kapsar. Sahte zorluk puanı içeren import reddedilir.

Worker entegrasyon testi gerçek worker_threads iş parçacığında **üretim worker'ının aynı kaynak dosyasını** yükler; yalnızca postMessage/self köprüsü Node'a uyarlanır. 100 bölümlük işin iki kabul mesajından sonra worker sonlandırılır. Kabul edilen iki bölümün bağımsız kapsama doğrulaması geçer; ana event loop heartbeat'i hesaplama boyunca çalışır. Bu test DOM etkileşimini ölçmez; tarayıcı iş akışı ayrıca aşağıda elle kontrol edilmiştir.

## Ölçülmüş demo üretimi

Ham ölçümler `generation-report.json` içinde. Dört ayrı sürümlü set, altışar parçayla kullanıldı. Hepsinde dönüş açık, yansıtma kapalı, politika unique, hedef üç sabit parça, düğüm bütçesi 500.000.

| Tahta | Seed | Aday | Kabul | Tahmini puan/hat | Süre |
|---|---|---:|---:|---|---:|
| 6×5 dikdörtgen | demo-rectangle-2026 | 3 | 1 | 41 / medium | 95,82 ms |
| Kedi 7×7 | demo-cat-2026 | 3 | 1 | 39 / medium | 46,92 ms |
| Köpek 9×6 | demo-dog-2026 | 2 | 1 | 38 / easy | 26,28 ms |
| Kalp 8×7 | demo-heart-2026 | 3 | 1 | 40 / medium | 73,19 ms |

Toplam **11 aday, 4 kabul, 7 hedef hat uyuşmazlığı reddi**. İstenen dört şablonun dördü için doğrulanmış örnek elde edildi. Her kabul tam aramayla unique ve countIsExact=true; her son doğrulama geçişi 4 düğüm. Süreler donanıma bağlı tanı alanlarıdır; zorluğa dahil edilmez. Bu küçük demo raporu büyük tahtalar veya uzman hat üretim kapasitesi için performans garantisi değildir.

## Tarayıcı QA

Codex içi tarayıcıda localhost:5174 üzerinden gerçek uygulama kullanıldı. Yaklaşık 670 px genişliğinde responsive görünüm kontrol edildi; bu genişlikte menü üstte, ayarlar ve tahta iki sütunda, bilgi paneli altta sıralanıyor. Masaüstü üç sütun CSS düzeni mevcut; bu rapor geniş ekran için ayrı otomatik viewport testi iddia etmez.

Kontrol edilenler:

- Başlangıç çözümü kapalı; aç/kapat ve çözüm adım kaydırıcısı görünür.
- Katalogda dört örnek, doğru set sürümleri, hat filtresi, seed ve doğrulama bilgileri görünür.
- Demo katalog dosyası browser worker'da doğrulanıp birleştir/değiştir önizlemesi sundu; değiştirme sonrası 1 kolay + 3 orta bölüm göründü.
- Kedi editöründe bir hücre boyandı; alan 30'dan 31'e çıktı. Geri al ile tekrar 30 ve eski sınırlayıcı kutu elde edildi.
- Kedi doldurulabilirlik kontrolü `multiple, 40 düğüm` döndürdü. Bu kontrol boş tahta için olduğundan, sabitli demoların unique sonucuyla çelişmez.
- Tarayıcı worker'ı kedi için bir adayda bir tekil bölüm üretti; UI raporu 1 aday / 1 kabul / yaklaşık 0,02 saniye gösterdi.
- Oynama modunda hücre düğmeleri erişilebilirlik ağacında göründü. İpucu F parçasını mevcut durumun tamamlanabilen çözümünden yerleştirdi; sıfırlama oyuncu hamlesini kaldırdı. Sabitler korundu.

Ekran görüntüleri: `screenshots/generator.png`, `solution.png`, `silhouette.png`, `catalog.png`. Görüntüler küçük tarayıcı panelinde alınmıştır, tüm sayfa içeriği tek kareye sığmaz.

Kalan sınırlar: insan zorluk kalibrasyonu, kilitli kenar önerisi ve PWA çevrimdışı yeniden açılış yok. Dokunmatik sürükleme, çoklu tarayıcı ve ayrı geniş ekran otomasyon testi yapılmadı; tıklama/klavye alternatifi mevcut. CLI `generate-config` özel ayarlı üretimi destekler.

## Üretim hata akışı düzeltmesi

17 test geçti. 20×20 / 30 hücre alan uyuşmazlığı worker tarafından aday döngüsüne girmeden bir kez reddediliyor. UI alan uyumsuzluğunu canlı gösteriyor, üretimi engelliyor ve çalışan demo ayarlarına dönüş sunuyor. Sıfır kabul başarı gibi bildirilmiyor. Tarayıcıda demo ayarlarına dönülüp gerçek üretim çalıştırıldı: 1 aday, 1 kabul, yaklaşık 0,02 saniye; tek çözüm doğrulandı. Derleme başarılı. Ekran: `screenshots/generation-fixed.png`.

## Otomatik kota üretimi — 19 Ekim 2026

- **23 test geçti, 0 hata.** Yeni testler: seviye bazında farklı parça profilleri ve bilinen döşeme kanıtı; beş hattın otomatik kotaları; dışa aktarılan ayarlarla gizli argüman gerektirmeden deterministik yeniden üretim; 830 teslim bölümünün envanter/kapsama/benzersiz ID kontrolleri; otomatik worker iptalinde sürümlü setlerle beraber kısmi sonuçların korunması.
- `npm run build` başarılı. Solver yerleşim indeksleri her hücre için tüm yerleşimleri tekrar taramak yerine tek geçişle kuruldu; arama sırası ve doğruluk testleri korundu.
- CLI tam plan: **3.016 adaydan 830 kabul**, 29,09 saniye. 30 başlangıç, 100 kolay, 200 orta, 250 zor, 250 uzman. 150 özgün otomatik set; hat başına 30 set. Puan aralıkları: başlangıç 14; kolay 27–38; orta 39–53; zor 56–71; uzman 72–129. Hedefe uymayan adaylar ve içerik tekrarları reddedildi; tam red sayıları `automatic-generation-report.json` içinde.
- `examples/automatic-admin-catalog.json` ve `automatic-player-catalog.json` CLI ile yeniden çözüldü: dosya başına **830 doğrulanmış bölüm**. Admin dosyası yaklaşık 6,4 MB olduğundan import sınırı 50 MB'a, set kapasitesi 500'e yükseltildi.
- Tarayıcıda yeni formdan beş seviyeli planın tamamı gerçekten çalıştırıldı: **3.025 aday, 830/830 kabul, 14,7 saniye**. Önceki 4 demo korundu, çalışma kataloğu **834** oldu. UI otomatik kaydı ve responsive kalması gözlendi. Son bölüm 7×6 / 8 parça uzman, puan 84, tek çözüm ve 2 sabit / 6 kalan parça olarak gösterildi.
- Görsel kanıt: `screenshots/automatic-830.png`. UI ile CLI koşuları farklı tohumlar kullandığı için farklı aday sayıları ve içerikler üretmeleri beklenir. İnsan oyuncularla zorluk kalibrasyonu yapılmadı.

## Zorluk ölçeği v2 — boş başlayan büyük tahtalar

27 test geçti, 0 hata; statik derleme başarılı. Orta profil eski uzmanın 7×6 / 8 parça / 5–6 kalan parça yapısıyla birebir aynı. Zor 10×8 / 14 parça, uzman 16×12 / 24 parça. Uzman alanı 192 hücre; eski uzman 42 hücreydi (4,57 kat). Son iki profilde tüm bölümler `fixedPlacements: []` ve `solutionPolicy: any-valid` kullanır.

Yeni CLI planında 863 adaydan 830 bölüm kabul edildi, süre 52,30 saniye. Kotalar 30/100/200/250/250 korundu. Başlangıç, kolay ve orta tek çözümlü; zor/uzman için iki farklı tam döşeme bağımsız doğrulandı (`multiple`, en az 2, kesin toplam bilinmiyor). İspat, exact-cover araması yerine geçerli referans ve 180° dönüşünün ayrı ayrı kapsama doğrulamasını kullanır; arama düğümleri uydurulmadan 0 olarak kaydedilir.

Tarayıcıdaki eski 830 otomatik bölüm `upgrade-difficulty` ile gerçekten revize edildi: 856 aday, 830/830 kabul, 26,7 saniye. Kimlikler ve hat adetleri korundu; her bölüm revizyon 2 oldu ve eski içerik `revisionHistory` içine taşındı. Önceki dört demo da korundu, katalog toplamı 834. Son uzman görünümü 16×12, 24 parça, 0 sabit / 24 kalan, en az 2 çözüm ve tahmini puan 234 gösterdi. Görüntü: `screenshots/expert-v2-empty.png`.

Yeni testler, zor ve uzmanın boş başlamasını, iki tanığın farklılığını ve tam kapsamını, eski `estimate-1` dosyaların yorumunu korumayı ve worker revizyonunda ID/geçmişin korunmasını denetler. `automatic-v1-admin-catalog.json` eski kataloğun arşividir; güncel admin/oyuncu dosyaları yeni ölçeği kullanır. JSON Schema iki üretim yöntemini de kabul eder; yeni üretim `automatic-2`, zorluk `estimate-2`, motor 1.1.0.

## Katalog toplu işlemleri

32 test geçti; statik derleme başarılı. Bölüm satırlarına seçim kutuları, sayfa seçimi (hat başına 20), filtredeki bütün bölümleri seçme, seçimi temizleme, seçilenleri silme ve toplu hat taşıma eklendi. Seçimler filtre/sayfa değişiminde korunur. Her silme/taşıma tek geri alma kaydı oluşturur; sıra alanları yeniden düzenlenir, kalıcı kimlikler ve kaynak katalog korunur. Boşalan son sayfa güvenli biçimde geçerli sayfaya çekilir. Zor/uzmana toplu taşımada sabit parçalı bölümler reddedilir.

Tarayıcıda başlangıç hattındaki iki bölüm tek tek seçildi, topluca silindi (834 → 832; başlangıç 30 → 28) ve “Geri al” ile geri getirildi (834 ve 30). Test sonrası kullanıcı bölümleri korundu. Son görsel kontrol için aynı yerel panel yeni sekmede açıldı; 834 bölümün kalıcı kayıtta korunduğu ve toplu işlem kontrollerinin çalıştığı doğrulandı. Ekran görüntüsü: `screenshots/catalog-bulk.png`. Test seçimleri temizlendi.

## 100 silüetlik seri — 19 Ekim 2026

37 test geçti; üretim derlemesi başarılı. CLI hem admin hem oyuncu dosyasında 100 bölümü doğruladı. 100 adayın tamamı kabul edildi: 40 orta, 21 zor, 39 uzman. 12 bölüm standart uzmanın alan/parça/puan değerlerini aşar. Testler maskelerin bağlantısını ve farklılığını, bütün çözümlerin tam kapsamını, sıfır sabit parçayı, minimum orta seviyeyi, yeniden üretimi, oyuncu içe aktarımını ve seri filtresinin toplu seçim kapsamını denetler.

20 formun siyah maskeleri görsel incelendi; düşük çözünürlüklerde kaybolan ayrıntılar için minimum örnekleme 16'ya çıkarıldı. Tarayıcıda gerçek üretim çalıştırıldı; mevcut 834 bölüm korunarak 100 bölüm eklendi ve kalıcı katalog 934 oldu. Yeni seri filtresi 100 bölüm, başlangıç/kolay 0, orta 40, zor 21, uzman 39 gösterdi. Çift önizlemeler siyah şekil ile renkli dolumu birlikte gösterir. Kanıt: `screenshots/silhouette-catalog-100.png`.
