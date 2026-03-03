/**
 * API Response Translation Utility
 * Provides translation capabilities for API responses and dynamic content
 */

import { type Locale, locales, defaultLocale } from '@/i18n/config';

// Common error messages in all supported languages
// These are the most frequently used messages that should always be available
export const errorMessages: Record<string, Record<Locale, string>> = {
  'notFound': {
    'en': 'Not found',
    'ar': 'غير موجود',
    'zh-CN': '未找到',
    'zh-TW': '未找到',
    'es': 'No encontrado',
    'hi': 'नहीं मिला',
    'pt': 'Não encontrado',
    'ru': 'Не найдено',
    'ja': '見つかりません',
    'de': 'Nicht gefunden',
    'fr': 'Non trouvé',
    'ko': '찾을 수 없음',
    'it': 'Non trovato',
    'tr': 'Bulunamadı',
    'nl': 'Niet gevonden',
    'pl': 'Nie znaleziono',
    'vi': 'Không tìm thấy',
    'th': 'ไม่พบ',
    'id': 'Tidak ditemukan',
    'uk': 'Не знайдено',
    'fa': 'یافت نشد',
    'he': 'לא נמצא',
    // Add fallback for other languages
  } as Record<Locale, string>,
  'serverError': {
    'en': 'Server error',
    'ar': 'خطأ في الخادم',
    'zh-CN': '服务器错误',
    'zh-TW': '伺服器錯誤',
    'es': 'Error del servidor',
    'hi': 'सर्वर त्रुटि',
    'pt': 'Erro do servidor',
    'ru': 'Ошибка сервера',
    'ja': 'サーバーエラー',
    'de': 'Serverfehler',
    'fr': 'Erreur serveur',
    'ko': '서버 오류',
    'it': 'Errore del server',
    'tr': 'Sunucu hatası',
    'nl': 'Serverfout',
    'pl': 'Błąd serwera',
    'vi': 'Lỗi máy chủ',
    'th': 'ข้อผิดพลาดเซิร์ฟเวอร์',
    'id': 'Kesalahan server',
    'uk': 'Помилка сервера',
    'fa': 'خطای سرور',
    'he': 'שגיאת שרת',
  } as Record<Locale, string>,
  'unauthorized': {
    'en': 'Unauthorized',
    'ar': 'غير مصرح',
    'zh-CN': '未授权',
    'zh-TW': '未授權',
    'es': 'No autorizado',
    'hi': 'अनधिकृत',
    'pt': 'Não autorizado',
    'ru': 'Не авторизован',
    'ja': '認証されていません',
    'de': 'Nicht autorisiert',
    'fr': 'Non autorisé',
    'ko': '인증되지 않음',
    'it': 'Non autorizzato',
    'tr': 'Yetkisiz',
    'nl': 'Niet geautoriseerd',
    'pl': 'Nieautoryzowany',
    'vi': 'Không được phép',
    'th': 'ไม่ได้รับอนุญาต',
    'id': 'Tidak diizinkan',
    'uk': 'Не авторизовано',
    'fa': 'غیرمجاز',
    'he': 'לא מורשה',
  } as Record<Locale, string>,
  'badRequest': {
    'en': 'Bad request',
    'ar': 'طلب غير صالح',
    'zh-CN': '请求无效',
    'zh-TW': '請求無效',
    'es': 'Solicitud incorrecta',
    'hi': 'खराब अनुरोध',
    'pt': 'Requisição inválida',
    'ru': 'Неверный запрос',
    'ja': '不正なリクエスト',
    'de': 'Ungültige Anfrage',
    'fr': 'Mauvaise requête',
    'ko': '잘못된 요청',
    'it': 'Richiesta non valida',
    'tr': 'Geçersiz istek',
    'nl': 'Ongeldig verzoek',
    'pl': 'Nieprawidłowe żądanie',
    'vi': 'Yêu cầu không hợp lệ',
    'th': 'คำขอไม่ถูกต้อง',
    'id': 'Permintaan tidak valid',
    'uk': 'Невірний запит',
    'fa': 'درخواست نامعتبر',
    'he': 'בקשה שגויה',
  } as Record<Locale, string>,
  'rateLimited': {
    'en': 'Rate limit exceeded. Please try again later.',
    'ar': 'تم تجاوز حد المعدل. يرجى المحاولة مرة أخرى لاحقًا.',
    'zh-CN': '超出速率限制。请稍后重试。',
    'zh-TW': '超出速率限制。請稍後重試。',
    'es': 'Límite de velocidad excedido. Inténtalo más tarde.',
    'hi': 'दर सीमा पार हो गई। कृपया बाद में पुनः प्रयास करें।',
    'pt': 'Limite de taxa excedido. Tente novamente mais tarde.',
    'ru': 'Превышен лимит запросов. Повторите попытку позже.',
    'ja': 'レート制限を超えました。後でもう一度お試しください。',
    'de': 'Rate-Limit überschritten. Bitte später erneut versuchen.',
    'fr': 'Limite de débit dépassée. Veuillez réessayer plus tard.',
    'ko': '요청 한도 초과. 나중에 다시 시도해 주세요.',
    'it': 'Limite di velocità superato. Riprova più tardi.',
    'tr': 'Hız sınırı aşıldı. Lütfen daha sonra tekrar deneyin.',
    'nl': 'Rate limit overschreden. Probeer het later opnieuw.',
    'pl': 'Przekroczono limit. Spróbuj ponownie później.',
    'vi': 'Vượt quá giới hạn. Vui lòng thử lại sau.',
    'th': 'เกินขีดจำกัด กรุณาลองใหม่ภายหลัง',
    'id': 'Batas kecepatan terlampaui. Coba lagi nanti.',
    'uk': 'Перевищено ліміт запитів. Спробуйте пізніше.',
    'fa': 'محدودیت نرخ بیش از حد. لطفاً بعداً دوباره امتحان کنید.',
    'he': 'חריגה ממגבלת הקצב. נסה שוב מאוחר יותר.',
  } as Record<Locale, string>,
  'loading': {
    'en': 'Loading...',
    'ar': 'جار التحميل...',
    'zh-CN': '加载中...',
    'zh-TW': '載入中...',
    'es': 'Cargando...',
    'hi': 'लोड हो रहा है...',
    'pt': 'Carregando...',
    'ru': 'Загрузка...',
    'ja': '読み込み中...',
    'de': 'Wird geladen...',
    'fr': 'Chargement...',
    'ko': '로딩 중...',
    'it': 'Caricamento...',
    'tr': 'Yükleniyor...',
    'nl': 'Laden...',
    'pl': 'Ładowanie...',
    'vi': 'Đang tải...',
    'th': 'กำลังโหลด...',
    'id': 'Memuat...',
    'uk': 'Завантаження...',
    'fa': 'در حال بارگذاری...',
    'he': 'טוען...',
  } as Record<Locale, string>,
};

// Get translated error message
export function getErrorMessage(key: string, locale: Locale): string {
  const messages = errorMessages[key];
  if (!messages) return key;
  
  // Return message for locale, fallback to English
  return messages[locale] || messages['en'] || key;
}

// Market terms that should be translated
export const marketTerms: Record<string, Record<Locale, string>> = {
  'bullish': {
    'en': 'Bullish',
    'ar': 'صعودي',
    'zh-CN': '看涨',
    'zh-TW': '看漲',
    'es': 'Alcista',
    'hi': 'तेजी',
    'pt': 'Altista',
    'ru': 'Бычий',
    'ja': '強気',
    'de': 'Bullisch',
    'fr': 'Haussier',
    'ko': '강세',
    'it': 'Rialzista',
    'tr': 'Yükseliş',
  } as Record<Locale, string>,
  'bearish': {
    'en': 'Bearish',
    'ar': 'هبوطي',
    'zh-CN': '看跌',
    'zh-TW': '看跌',
    'es': 'Bajista',
    'hi': 'मंदी',
    'pt': 'Baixista',
    'ru': 'Медвежий',
    'ja': '弱気',
    'de': 'Bärisch',
    'fr': 'Baissier',
    'ko': '약세',
    'it': 'Ribassista',
    'tr': 'Düşüş',
  } as Record<Locale, string>,
  'neutral': {
    'en': 'Neutral',
    'ar': 'محايد',
    'zh-CN': '中性',
    'zh-TW': '中性',
    'es': 'Neutral',
    'hi': 'तटस्थ',
    'pt': 'Neutro',
    'ru': 'Нейтральный',
    'ja': '中立',
    'de': 'Neutral',
    'fr': 'Neutre',
    'ko': '중립',
    'it': 'Neutrale',
    'tr': 'Nötr',
  } as Record<Locale, string>,
};

// Get translated market term
export function getMarketTerm(term: string, locale: Locale): string {
  const translations = marketTerms[term.toLowerCase()];
  if (!translations) return term;
  return translations[locale] || translations['en'] || term;
}

// Time-related translations
export const timeTerms: Record<string, Record<Locale, string>> = {
  'justNow': {
    'en': 'Just now',
    'ar': 'الآن',
    'zh-CN': '刚刚',
    'es': 'Ahora mismo',
    'ja': 'たった今',
    'ko': '방금',
    'ru': 'Только что',
    'de': 'Gerade eben',
    'fr': "À l'instant",
  } as Record<Locale, string>,
  'minutesAgo': {
    'en': '{count} minutes ago',
    'ar': 'منذ {count} دقائق',
    'zh-CN': '{count}分钟前',
    'es': 'Hace {count} minutos',
    'ja': '{count}分前',
    'ko': '{count}분 전',
    'ru': '{count} минут назад',
    'de': 'Vor {count} Minuten',
    'fr': 'Il y a {count} minutes',
  } as Record<Locale, string>,
  'hoursAgo': {
    'en': '{count} hours ago',
    'ar': 'منذ {count} ساعات',
    'zh-CN': '{count}小时前',
    'es': 'Hace {count} horas',
    'ja': '{count}時間前',
    'ko': '{count}시간 전',
    'ru': '{count} часов назад',
    'de': 'Vor {count} Stunden',
    'fr': 'Il y a {count} heures',
  } as Record<Locale, string>,
  'daysAgo': {
    'en': '{count} days ago',
    'ar': 'منذ {count} أيام',
    'zh-CN': '{count}天前',
    'es': 'Hace {count} días',
    'ja': '{count}日前',
    'ko': '{count}일 전',
    'ru': '{count} дней назад',
    'de': 'Vor {count} Tagen',
    'fr': 'Il y a {count} jours',
  } as Record<Locale, string>,
};

// Get relative time translation
export function getRelativeTime(key: string, count: number, locale: Locale): string {
  const translations = timeTerms[key];
  if (!translations) return key;
  const template = translations[locale] || translations['en'] || key;
  return template.replace('{count}', count.toString());
}

// Extract locale from request headers
export function getLocaleFromRequest(request: Request): Locale {
  // Check Accept-Language header
  const acceptLang = request.headers.get('accept-language');
  if (acceptLang) {
    const preferred = acceptLang.split(',')[0].split('-')[0];
    if (locales.includes(preferred as Locale)) {
      return preferred as Locale;
    }
  }
  
  // Check custom header
  const customLang = request.headers.get('x-locale');
  if (customLang && locales.includes(customLang as Locale)) {
    return customLang as Locale;
  }
  
  // Check URL parameter
  const url = new URL(request.url);
  const langParam = url.searchParams.get('lang');
  if (langParam && locales.includes(langParam as Locale)) {
    return langParam as Locale;
  }
  
  return defaultLocale;
}

// Create localized API response
export function createLocalizedResponse<T>(
  data: T,
  locale: Locale,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Content-Language': locale,
      'Vary': 'Accept-Language',
    },
  });
}

// Create localized error response
export function createLocalizedError(
  errorKey: string,
  locale: Locale,
  status = 400,
  details?: Record<string, unknown>
): Response {
  const message = getErrorMessage(errorKey, locale);
  return createLocalizedResponse(
    { error: message, errorKey, ...details },
    locale,
    status
  );
}
