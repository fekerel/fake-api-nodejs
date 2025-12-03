# Fake API NodeJS

Quick start:

```bash
npm install --legacy-peer-deps
npm run start
# optional
npm run seed:demo
```

### Seeding

```bash
npm run seed:demo
```

- Belirli koleksiyonları sıfırdan üretir: users=10, categories=5, products=20, orders=15, reviews=30.
- mode=regenerate: sadece bu koleksiyonlar temizlenip yeniden oluşturulur; diğerleri korunur.
- Kayıtlar `database.json` dosyasına yazılır.

Swagger UI: http://localhost:8000/api-docs  •  OpenAPI JSON: http://localhost:8000/openapi.json

### Healing

Healing deneyi için uygulamayı çalıştırma şekli:

Yol 1:
```bash
npm run start:breaking
```
- routes/ dizini içerisindeki "breakingMeta" isimli değişken export eden dosyalardaki endpoint'ler için tanımlı handler değişikliklerinin rastgele bir alt kümesini aktif hale getir.

Yol 2:
```bash
npm run start:breaking:all
```
- routes/ dizini içerisindeki "breakingMeta" isimli değişken export eden dosyalardaki endpoint'ler için tanımlı handler değişikliklerinin tamamını aktif hale getir.

---