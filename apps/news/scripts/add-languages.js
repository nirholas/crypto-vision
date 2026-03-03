#!/usr/bin/env node
/**
 * Add new language translations
 * 
 * Uses simple string mapping for common UI terms
 */

const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '..', 'messages');

// New languages to add with their translations
const NEW_LANGUAGES = {
  // Hindi (India - 600M+ speakers)
  'hi': {
    name: 'Hindi',
    translations: {
      'common.appName': 'फ्री क्रिप्टो न्यूज़',
      'common.tagline': 'रीयल-टाइम क्रिप्टोकरेंसी समाचार एग्रीगेटर',
      'common.loading': 'लोड हो रहा है...',
      'common.error': 'कुछ गलत हो गया',
      'common.retry': 'पुनः प्रयास करें',
      'common.cancel': 'रद्द करें',
      'common.confirm': 'पुष्टि करें',
      'common.save': 'सहेजें',
      'common.delete': 'हटाएं',
      'common.edit': 'संपादित करें',
      'common.close': 'बंद करें',
      'common.back': 'वापस',
      'common.next': 'अगला',
      'common.previous': 'पिछला',
      'common.search': 'खोजें',
      'common.filter': 'फ़िल्टर',
      'common.sort': 'क्रमबद्ध करें',
      'common.refresh': 'रीफ्रेश',
      'common.share': 'साझा करें',
      'common.copy': 'कॉपी करें',
      'common.copied': 'कॉपी हो गया!',
      'common.viewAll': 'सभी देखें',
      'common.seeMore': 'और देखें',
      'common.seeLess': 'कम देखें',
      'common.showMore': 'अधिक दिखाएं',
      'common.showLess': 'कम दिखाएं',
      'common.noResults': 'कोई परिणाम नहीं मिला',
      'nav.home': 'होम',
      'nav.news': 'समाचार',
      'nav.markets': 'बाज़ार',
      'nav.trending': 'ट्रेंडिंग',
      'nav.sources': 'स्रोत',
      'nav.topics': 'विषय',
      'nav.defi': 'DeFi',
      'nav.digest': 'डाइजेस्ट',
      'nav.search': 'खोजें',
      'nav.bookmarks': 'बुकमार्क',
      'nav.watchlist': 'वॉचलिस्ट',
      'nav.portfolio': 'पोर्टफोलियो',
      'nav.settings': 'सेटिंग्स',
      'nav.about': 'के बारे में',
      'sentiment.bullish': 'तेजी',
      'sentiment.bearish': 'मंदी',
      'sentiment.neutral': 'तटस्थ',
    }
  },
  // Bengali (300M+ speakers)
  'bn': {
    name: 'Bengali',
    translations: {
      'common.appName': 'ফ্রি ক্রিপ্টো নিউজ',
      'common.tagline': 'রিয়েল-টাইম ক্রিপ্টোকারেন্সি সংবাদ সংগ্রাহক',
      'common.loading': 'লোড হচ্ছে...',
      'common.error': 'কিছু ভুল হয়েছে',
      'common.retry': 'আবার চেষ্টা করুন',
      'common.search': 'অনুসন্ধান',
      'nav.home': 'হোম',
      'nav.news': 'সংবাদ',
      'nav.markets': 'বাজার',
      'sentiment.bullish': 'বুলিশ',
      'sentiment.bearish': 'বিয়ারিশ',
      'sentiment.neutral': 'নিরপেক্ষ',
    }
  },
  // Ukrainian (40M+ speakers)
  'uk': {
    name: 'Ukrainian',
    translations: {
      'common.appName': 'Free Crypto News',
      'common.tagline': 'Агрегатор криптовалютних новин у реальному часі',
      'common.loading': 'Завантаження...',
      'common.error': 'Щось пішло не так',
      'common.retry': 'Спробувати ще раз',
      'common.cancel': 'Скасувати',
      'common.confirm': 'Підтвердити',
      'common.save': 'Зберегти',
      'common.delete': 'Видалити',
      'common.search': 'Пошук',
      'nav.home': 'Головна',
      'nav.news': 'Новини',
      'nav.markets': 'Ринки',
      'nav.trending': 'Популярне',
      'sentiment.bullish': 'Бичачий',
      'sentiment.bearish': 'Ведмежий',
      'sentiment.neutral': 'Нейтральний',
    }
  },
  // Persian/Farsi (110M+ speakers)
  'fa': {
    name: 'Persian',
    translations: {
      'common.appName': 'اخبار رایگان کریپتو',
      'common.tagline': 'جمع‌آوری اخبار ارز دیجیتال به صورت زنده',
      'common.loading': 'در حال بارگذاری...',
      'common.error': 'مشکلی پیش آمد',
      'common.search': 'جستجو',
      'nav.home': 'خانه',
      'nav.news': 'اخبار',
      'nav.markets': 'بازارها',
      'sentiment.bullish': 'صعودی',
      'sentiment.bearish': 'نزولی',
    }
  },
  // Swahili (100M+ speakers in Africa)
  'sw': {
    name: 'Swahili',
    translations: {
      'common.appName': 'Habari za Crypto Bure',
      'common.tagline': 'Mkusanyiko wa habari za cryptocurrency kwa wakati halisi',
      'common.loading': 'Inapakia...',
      'common.error': 'Kuna hitilafu',
      'common.search': 'Tafuta',
      'nav.home': 'Nyumbani',
      'nav.news': 'Habari',
      'nav.markets': 'Masoko',
    }
  },
  // Czech (10M+ speakers)
  'cs': {
    name: 'Czech',
    translations: {
      'common.appName': 'Free Crypto News',
      'common.tagline': 'Agregátor kryptoměnových zpráv v reálném čase',
      'common.loading': 'Načítání...',
      'common.error': 'Něco se pokazilo',
      'common.search': 'Hledat',
      'nav.home': 'Domů',
      'nav.news': 'Zprávy',
      'nav.markets': 'Trhy',
      'sentiment.bullish': 'Býčí',
      'sentiment.bearish': 'Medvědí',
    }
  },
  // Greek (13M+ speakers)
  'el': {
    name: 'Greek',
    translations: {
      'common.appName': 'Free Crypto News',
      'common.tagline': 'Συγκεντρωτής ειδήσεων κρυπτονομισμάτων σε πραγματικό χρόνο',
      'common.loading': 'Φόρτωση...',
      'common.error': 'Κάτι πήγε στραβά',
      'common.search': 'Αναζήτηση',
      'nav.home': 'Αρχική',
      'nav.news': 'Ειδήσεις',
      'nav.markets': 'Αγορές',
      'sentiment.bullish': 'Ανοδικό',
      'sentiment.bearish': 'Πτωτικό',
    }
  },
  // Hungarian (13M+ speakers)
  'hu': {
    name: 'Hungarian',
    translations: {
      'common.appName': 'Free Crypto News',
      'common.tagline': 'Valós idejű kriptovaluta hírgyűjtő',
      'common.loading': 'Betöltés...',
      'common.error': 'Valami hiba történt',
      'common.search': 'Keresés',
      'nav.home': 'Főoldal',
      'nav.news': 'Hírek',
      'nav.markets': 'Piacok',
    }
  },
  // Swedish (10M+ speakers)
  'sv': {
    name: 'Swedish',
    translations: {
      'common.appName': 'Free Crypto News',
      'common.tagline': 'Nyhetssamlare för kryptovalutor i realtid',
      'common.loading': 'Laddar...',
      'common.error': 'Något gick fel',
      'common.search': 'Sök',
      'nav.home': 'Hem',
      'nav.news': 'Nyheter',
      'nav.markets': 'Marknader',
    }
  },
  // Hebrew (9M+ speakers)
  'he': {
    name: 'Hebrew',
    translations: {
      'common.appName': 'חדשות קריפטו בחינם',
      'common.tagline': 'אגרגטור חדשות מטבעות קריפטו בזמן אמת',
      'common.loading': 'טוען...',
      'common.error': 'משהו השתבש',
      'common.search': 'חיפוש',
      'nav.home': 'בית',
      'nav.news': 'חדשות',
      'nav.markets': 'שווקים',
    }
  },
  // Romanian (24M+ speakers)
  'ro': {
    name: 'Romanian',
    translations: {
      'common.appName': 'Free Crypto News',
      'common.tagline': 'Agregator de știri despre criptomonede în timp real',
      'common.loading': 'Se încarcă...',
      'common.error': 'Ceva nu a funcționat',
      'common.search': 'Căutare',
      'nav.home': 'Acasă',
      'nav.news': 'Știri',
      'nav.markets': 'Piețe',
    }
  },
  // Filipino/Tagalog (100M+ speakers)
  'tl': {
    name: 'Filipino',
    translations: {
      'common.appName': 'Free Crypto News',
      'common.tagline': 'Real-time na tagapangalap ng balita tungkol sa cryptocurrency',
      'common.loading': 'Naglo-load...',
      'common.error': 'May nangyaring mali',
      'common.search': 'Maghanap',
      'nav.home': 'Home',
      'nav.news': 'Balita',
      'nav.markets': 'Mga Merkado',
    }
  },
};

// Load English as base
const enPath = path.join(MESSAGES_DIR, 'en.json');
const enContent = JSON.parse(fs.readFileSync(enPath, 'utf-8'));

/**
 * Set nested value in object
 */
function setNestedValue(obj, keyPath, value) {
  const keys = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

/**
 * Get nested value from object
 */
function getNestedValue(obj, keyPath) {
  return keyPath.split('.').reduce((acc, key) => acc?.[key], obj);
}

/**
 * Deep clone and translate
 */
function createTranslation(locale, translations) {
  // Start with a deep clone of English
  const result = JSON.parse(JSON.stringify(enContent));
  
  // Apply known translations
  for (const [key, value] of Object.entries(translations)) {
    setNestedValue(result, key, value);
  }
  
  return result;
}

// Generate each language file
let created = 0;
for (const [locale, { name, translations }] of Object.entries(NEW_LANGUAGES)) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  
  if (fs.existsSync(filePath)) {
    console.log(`⏭️  ${name} (${locale}) already exists, skipping`);
    continue;
  }
  
  const content = createTranslation(locale, translations);
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
  console.log(`✅ Created ${name} (${locale})`);
  created++;
}

console.log(`\n📊 Added ${created} new languages`);
console.log(`📁 Total: ${fs.readdirSync(MESSAGES_DIR).filter(f => f.endsWith('.json')).length} languages`);
