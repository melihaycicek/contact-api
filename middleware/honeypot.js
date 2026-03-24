/**
 * Honeypot middleware – spam botlarını yakalar
 * Form'a gizli bir '_hp' alanı eklenir; insan doldurmaz, bot doldurur.
 * Eğer _hp dolu geldiyse → sessizce başarılı gibi döner ama kaydetmez.
 */
function honeypotCheck(req, res, next) {
  const data = req.body.data || {};

  if (data._hp && data._hp.length > 0) {
    // Bot yakalandı — sessizce başarılı dön (botu bilgilendirme)
    return res.status(200).json({ success: 'Mesajınız başarıyla kaydedildi.' });
  }

  // Honeypot alanını data'dan temizle ki DB'ye kaydetmeyelim
  if (data._hp !== undefined) {
    delete data._hp;
    req.body.data = data;
  }

  next();
}

/**
 * Üst seviye honeypot — subscribe gibi data wrapper'ı olmayan body'ler için.
 * req.body._hp dolu geldiyse bot olarak değerlendirilir.
 */
function topLevelHoneypotCheck(req, res, next) {
  const hp = req.body._hp;
  if (hp && String(hp).length > 0) {
    return res.status(200).json({ success: 'Abonelik isteği alındı. Lütfen e-postanızı kontrol edin.' });
  }
  if (hp !== undefined) delete req.body._hp;
  next();
}

module.exports = { honeypotCheck, topLevelHoneypotCheck };
