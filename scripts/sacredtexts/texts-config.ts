// Sacred Texts Configuration
// Defines all texts to ingest from various sources

export interface TextSource {
  id: string;
  title: string;
  author: string;
  tradition: string;
  originalLanguage: string;
  source: 'sacred-texts' | 'gutenberg' | 'other';
  urls: string[];
  chunkStrategy: 'chapter' | 'verse' | 'section' | 'paragraph' | 'saying';
  parser: 'tao-te-ching' | 'bhagavad-gita' | 'dhammapada' | 'analects' | 'meditations' | 'enchiridion' | 'upanishads' | 'art-of-war' | 'prophet' | 'generic';
  era?: string;
  authorBio?: string;
}

export const TEXTS_TO_INGEST: TextSource[] = [
  // Tier 1: Must Have
  {
    id: 'tao-te-ching',
    title: 'Tao Te Ching',
    author: 'Lao Tzu',
    tradition: 'Taoist',
    originalLanguage: 'zh',
    source: 'sacred-texts',
    urls: ['https://sacred-texts.com/tao/taote.htm'],
    chunkStrategy: 'chapter',
    parser: 'tao-te-ching',
    era: 'Ancient',
    authorBio: 'Ancient Chinese philosopher and writer, reputed author of the Tao Te Ching, founder of philosophical Taoism.'
  },
  {
    id: 'bhagavad-gita',
    title: 'Bhagavad Gita',
    author: 'Vyasa',
    tradition: 'Hindu',
    originalLanguage: 'sa',
    source: 'sacred-texts',
    urls: [
      'https://sacred-texts.com/hin/sbg/sbg07.htm',
      'https://sacred-texts.com/hin/sbg/sbg08.htm',
      'https://sacred-texts.com/hin/sbg/sbg09.htm',
      'https://sacred-texts.com/hin/sbg/sbg10.htm',
      'https://sacred-texts.com/hin/sbg/sbg11.htm',
      'https://sacred-texts.com/hin/sbg/sbg12.htm',
      'https://sacred-texts.com/hin/sbg/sbg13.htm',
      'https://sacred-texts.com/hin/sbg/sbg14.htm',
      'https://sacred-texts.com/hin/sbg/sbg15.htm',
      'https://sacred-texts.com/hin/sbg/sbg16.htm',
      'https://sacred-texts.com/hin/sbg/sbg17.htm',
      'https://sacred-texts.com/hin/sbg/sbg18.htm',
      'https://sacred-texts.com/hin/sbg/sbg19.htm',
      'https://sacred-texts.com/hin/sbg/sbg20.htm',
      'https://sacred-texts.com/hin/sbg/sbg21.htm',
      'https://sacred-texts.com/hin/sbg/sbg22.htm',
      'https://sacred-texts.com/hin/sbg/sbg23.htm',
      'https://sacred-texts.com/hin/sbg/sbg24.htm'
    ],
    chunkStrategy: 'verse',
    parser: 'bhagavad-gita',
    era: 'Ancient',
    authorBio: 'Vyasa, also called Veda Vyasa, is a revered sage in Hindu traditions, traditionally credited as the author of the Mahabharata.'
  },
  {
    id: 'dhammapada',
    title: 'The Dhammapada',
    author: 'Buddha',
    tradition: 'Buddhist',
    originalLanguage: 'pi',
    source: 'sacred-texts',
    urls: [
      'https://sacred-texts.com/bud/sbe10/sbe1003.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1004.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1005.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1006.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1007.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1008.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1009.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1010.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1011.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1012.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1013.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1014.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1015.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1016.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1017.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1018.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1019.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1020.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1021.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1022.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1023.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1024.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1025.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1026.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1027.htm',
      'https://sacred-texts.com/bud/sbe10/sbe1028.htm'
    ],
    chunkStrategy: 'verse',
    parser: 'dhammapada',
    era: 'Ancient',
    authorBio: 'Siddhartha Gautama, known as the Buddha, was an ascetic and spiritual teacher of South Asia who founded Buddhism.'
  },
  {
    id: 'analects',
    title: 'The Analects',
    author: 'Confucius',
    tradition: 'Confucian',
    originalLanguage: 'zh',
    source: 'gutenberg',
    urls: ['https://www.gutenberg.org/cache/epub/4094/pg4094.txt'],
    chunkStrategy: 'saying',
    parser: 'analects',
    era: 'Ancient',
    authorBio: 'Confucius was a Chinese philosopher and politician of the Spring and Autumn period, founder of Confucianism.'
  },
  {
    id: 'meditations',
    title: 'Meditations',
    author: 'Marcus Aurelius',
    tradition: 'Stoic',
    originalLanguage: 'grc',
    source: 'gutenberg',
    urls: ['https://www.gutenberg.org/cache/epub/2680/pg2680.txt'],
    chunkStrategy: 'section',
    parser: 'meditations',
    era: 'Ancient',
    authorBio: 'Marcus Aurelius was Roman emperor from 161 to 180 CE and a Stoic philosopher. His Meditations is a series of personal writings.'
  },
  {
    id: 'enchiridion',
    title: 'Enchiridion',
    author: 'Epictetus',
    tradition: 'Stoic',
    originalLanguage: 'grc',
    source: 'gutenberg',
    urls: ['https://www.gutenberg.org/cache/epub/45109/pg45109.txt'],
    chunkStrategy: 'section',
    parser: 'enchiridion',
    era: 'Ancient',
    authorBio: 'Epictetus was a Greek Stoic philosopher who was born a slave. His teachings were written down by his pupil Arrian.'
  },

  // Tier 2: Important Additions
  {
    id: 'art-of-war',
    title: 'The Art of War',
    author: 'Sun Tzu',
    tradition: 'Chinese Philosophy',
    originalLanguage: 'zh',
    source: 'gutenberg',
    urls: ['https://www.gutenberg.org/cache/epub/132/pg132.txt'],
    chunkStrategy: 'section',
    parser: 'art-of-war',
    era: 'Ancient',
    authorBio: 'Sun Tzu was a Chinese military general, strategist, philosopher, and writer who lived in the Eastern Zhou period.'
  },
  {
    id: 'the-prophet',
    title: 'The Prophet',
    author: 'Khalil Gibran',
    tradition: 'Spiritual',
    originalLanguage: 'en',
    source: 'gutenberg',
    urls: ['https://www.gutenberg.org/cache/epub/58585/pg58585.txt'],
    chunkStrategy: 'chapter',
    parser: 'prophet',
    era: 'Modern',
    authorBio: 'Khalil Gibran was a Lebanese-American writer, poet and visual artist. The Prophet is his best-known work.'
  },
  {
    id: 'upanishads',
    title: 'The Upanishads',
    author: 'Various Sages',
    tradition: 'Hindu',
    originalLanguage: 'sa',
    source: 'sacred-texts',
    urls: [
      // Katha Upanishad (6 chapters)
      'https://sacred-texts.com/hin/sbe15/sbe15010.htm',
      'https://sacred-texts.com/hin/sbe15/sbe15011.htm',
      'https://sacred-texts.com/hin/sbe15/sbe15012.htm',
      'https://sacred-texts.com/hin/sbe15/sbe15013.htm',
      'https://sacred-texts.com/hin/sbe15/sbe15014.htm',
      'https://sacred-texts.com/hin/sbe15/sbe15015.htm',
      // Mundaka Upanishad (6 chapters)
      'https://sacred-texts.com/hin/sbe15/sbe15016.htm',
      'https://sacred-texts.com/hin/sbe15/sbe15017.htm',
      'https://sacred-texts.com/hin/sbe15/sbe15018.htm',
      'https://sacred-texts.com/hin/sbe15/sbe15019.htm',
      'https://sacred-texts.com/hin/sbe15/sbe15020.htm',
      'https://sacred-texts.com/hin/sbe15/sbe15021.htm',
      // Svetasvatara Upanishad (6 chapters)
      'https://sacred-texts.com/hin/sbe15/sbe15100.htm',
      'https://sacred-texts.com/hin/sbe15/sbe15101.htm',
      'https://sacred-texts.com/hin/sbe15/sbe15102.htm',
      'https://sacred-texts.com/hin/sbe15/sbe15103.htm',
      'https://sacred-texts.com/hin/sbe15/sbe15104.htm',
      'https://sacred-texts.com/hin/sbe15/sbe15105.htm',
      // Prasna Upanishad (6 chapters)
      'https://sacred-texts.com/hin/sbe15/sbe15106.htm',
      'https://sacred-texts.com/hin/sbe15/sbe15107.htm',
      'https://sacred-texts.com/hin/sbe15/sbe15108.htm',
      'https://sacred-texts.com/hin/sbe15/sbe15109.htm',
      'https://sacred-texts.com/hin/sbe15/sbe15110.htm',
      'https://sacred-texts.com/hin/sbe15/sbe15111.htm',
    ],
    chunkStrategy: 'verse',
    parser: 'upanishads',
    era: 'Ancient',
    authorBio: 'The Upanishads are late Vedic Sanskrit texts of Hindu philosophy, containing earliest discussions on ontology and soteriology.'
  },

];

export function getTextById(id: string): TextSource | undefined {
  return TEXTS_TO_INGEST.find(t => t.id === id);
}

export function getTextsByTier(): { tier1: TextSource[]; tier2: TextSource[]; tier3: TextSource[] } {
  return {
    tier1: TEXTS_TO_INGEST.slice(0, 6),
    tier2: TEXTS_TO_INGEST.slice(6, 9),
    tier3: TEXTS_TO_INGEST.slice(9)
  };
}
