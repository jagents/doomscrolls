// Sacred Texts Expansion Configuration
// Round 2: Additional wisdom literature texts

export interface ExpansionText {
  id: string;
  title: string;
  author: string;
  tradition: string;
  originalLanguage: string;
  era: string;
  authorBio: string;
  baseUrl: string;
  pages: string[];  // List of page URLs to fetch
  parserType: 'numbered-verses' | 'paragraphs' | 'pre-formatted' | 'numbered-sections';
}

export const EXPANSION_TEXTS: ExpansionText[] = [
  // Taoist texts
  {
    id: 'chuang-tzu',
    title: 'Chuang Tzu (Musings of a Chinese Mystic)',
    author: 'Chuang Tzu',
    tradition: 'Taoist',
    originalLanguage: 'zh',
    era: 'Ancient',
    authorBio: 'Chuang Tzu (Zhuangzi) was an influential Chinese philosopher who lived around the 4th century BCE, known for his foundational texts of Taoism.',
    baseUrl: 'https://sacred-texts.com/tao/mcm/',
    pages: [
      'mcm05.htm', 'mcm06.htm', 'mcm07.htm', 'mcm08.htm', 'mcm09.htm',
      'mcm10.htm', 'mcm11.htm', 'mcm12.htm', 'mcm13.htm', 'mcm14.htm',
      'mcm15.htm', 'mcm16.htm'
    ],
    parserType: 'paragraphs'
  },
  {
    id: 'lieh-tzu',
    title: 'Lieh Tzu (Taoist Teachings)',
    author: 'Lieh Tzu',
    tradition: 'Taoist',
    originalLanguage: 'zh',
    era: 'Ancient',
    authorBio: 'Lieh Tzu was a Taoist philosopher who lived around 400 BCE, author of the Liezi text of philosophical fables and dialogues.',
    baseUrl: 'https://sacred-texts.com/tao/tt/',
    pages: [
      'tt04.htm', 'tt05.htm', 'tt06.htm', 'tt07.htm', 'tt08.htm',
      'tt09.htm', 'tt10.htm'
    ],
    parserType: 'paragraphs'
  },

  // Confucian texts
  {
    id: 'mencius',
    title: 'Mencius',
    author: 'Mencius',
    tradition: 'Confucian',
    originalLanguage: 'zh',
    era: 'Ancient',
    authorBio: 'Mencius (Mengzi) was a Chinese Confucian philosopher who is considered the second most important Confucian thinker after Confucius.',
    baseUrl: 'https://sacred-texts.com/cfu/menc/',
    pages: Array.from({length: 28}, (_, i) => `menc${String(i + 1).padStart(2, '0')}.htm`),
    parserType: 'paragraphs'
  },
  {
    id: 'great-learning',
    title: 'The Great Learning',
    author: 'Confucian Scholars',
    tradition: 'Confucian',
    originalLanguage: 'zh',
    era: 'Ancient',
    authorBio: 'The Great Learning is one of the Four Books of Confucianism, attributed to Confucius or Zengzi.',
    baseUrl: 'https://sacred-texts.com/cfu/',
    pages: ['conf2.htm'],
    parserType: 'pre-formatted'
  },
  {
    id: 'doctrine-of-the-mean',
    title: 'Doctrine of the Mean',
    author: 'Confucian Scholars',
    tradition: 'Confucian',
    originalLanguage: 'zh',
    era: 'Ancient',
    authorBio: 'The Doctrine of the Mean is one of the Four Books of Confucianism, traditionally attributed to Kong Ji.',
    baseUrl: 'https://sacred-texts.com/cfu/',
    pages: ['conf3.htm'],
    parserType: 'pre-formatted'
  },

  // I Ching
  {
    id: 'i-ching',
    title: 'I Ching (Book of Changes)',
    author: 'King Wen and Duke of Zhou',
    tradition: 'Chinese Philosophy',
    originalLanguage: 'zh',
    era: 'Ancient',
    authorBio: 'The I Ching is an ancient Chinese divination text, one of the oldest of the Chinese classics.',
    baseUrl: 'https://sacred-texts.com/ich/',
    pages: Array.from({length: 64}, (_, i) => `ic${String(i + 1).padStart(2, '0')}.htm`),
    parserType: 'paragraphs'
  },

  // Islamic/Sufi texts
  {
    id: 'quran-pickthall',
    title: 'The Quran (Pickthall Translation)',
    author: 'Prophet Muhammad',
    tradition: 'Islamic',
    originalLanguage: 'ar',
    era: 'Medieval',
    authorBio: 'The Quran is the central religious text of Islam, believed to be a revelation from God to the Prophet Muhammad.',
    baseUrl: 'https://sacred-texts.com/isl/pick/',
    pages: Array.from({length: 114}, (_, i) => `${String(i + 1).padStart(3, '0')}.htm`),
    parserType: 'numbered-verses'
  },
  {
    id: 'rumi-masnavi',
    title: 'The Masnavi',
    author: 'Rumi',
    tradition: 'Sufi',
    originalLanguage: 'fa',
    era: 'Medieval',
    authorBio: 'Jalal ad-Din Muhammad Rumi was a 13th-century Persian poet, Islamic scholar, and Sufi mystic.',
    baseUrl: 'https://sacred-texts.com/isl/masnavi/',
    pages: ['msn01.htm', 'msn02.htm', 'msn03.htm', 'msn04.htm', 'msn05.htm', 'msn06.htm'],
    parserType: 'paragraphs'
  },

  // Gnostic/Apocryphal texts
  {
    id: 'gospel-of-thomas',
    title: 'Gospel of Thomas',
    author: 'Didymos Judas Thomas',
    tradition: 'Gnostic',
    originalLanguage: 'cop',
    era: 'Ancient',
    authorBio: 'The Gospel of Thomas is a non-canonical collection of sayings attributed to Jesus, discovered in 1945 at Nag Hammadi.',
    baseUrl: 'https://sacred-texts.com/chr/',
    pages: ['thomas.htm'],
    parserType: 'numbered-sections'
  },
  {
    id: 'book-of-enoch',
    title: 'Book of Enoch',
    author: 'Enoch (attributed)',
    tradition: 'Jewish/Christian',
    originalLanguage: 'he',
    era: 'Ancient',
    authorBio: 'The Book of Enoch is an ancient Hebrew apocalyptic religious text, attributed to Enoch, the great-grandfather of Noah.',
    baseUrl: 'https://sacred-texts.com/bib/boe/',
    pages: Array.from({length: 109}, (_, i) => `boe${String(i + 4).padStart(3, '0')}.htm`),
    parserType: 'paragraphs'
  },

  // Hindu texts
  {
    id: 'yoga-sutras',
    title: 'Yoga Sutras of Patanjali',
    author: 'Patanjali',
    tradition: 'Hindu',
    originalLanguage: 'sa',
    era: 'Ancient',
    authorBio: 'Patanjali was a sage in ancient India, credited with compiling the Yoga Sutras, a foundational text of Raja Yoga.',
    baseUrl: 'https://sacred-texts.com/hin/',
    pages: ['yogasutr.htm'],
    parserType: 'numbered-sections'
  },
];

export function getExpansionTextById(id: string): ExpansionText | undefined {
  return EXPANSION_TEXTS.find(t => t.id === id);
}
