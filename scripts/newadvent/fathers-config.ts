// New Advent Church Fathers Configuration
// Priority authors and works for ingestion

export interface AuthorConfig {
  name: string;
  slug: string;
  era: "Apostolic" | "Ante-Nicene" | "Nicene" | "Post-Nicene";
  birthYear: number | null;
  deathYear: number | null;
  originalLanguage: "la" | "grc"; // Latin or Greek
  tier: 1 | 2;
}

export interface WorkConfig {
  title: string;
  sourceId: string; // e.g., "1101" for /fathers/1101.htm
  genre: "Theology" | "Homily" | "Letter" | "Apologetics" | "History" | "Commentary" | "Treatise" | "Spiritual";
  form: "treatise" | "sermon" | "letter" | "commentary" | "autobiography" | "dialogue" | "manual";
  priority: number; // 1 = highest
  maxChapters?: number; // Limit for massive works
}

export interface FatherConfig {
  author: AuthorConfig;
  works: WorkConfig[];
}

export const FATHERS_CONFIG: FatherConfig[] = [
  // =========== TIER 1: Greatest Fathers ===========

  {
    author: {
      name: "Augustine of Hippo",
      slug: "augustine",
      era: "Post-Nicene",
      birthYear: 354,
      deathYear: 430,
      originalLanguage: "la",
      tier: 1
    },
    works: [
      { title: "Confessions", sourceId: "1101", genre: "Spiritual", form: "autobiography", priority: 1 },
      { title: "On Christian Doctrine", sourceId: "1202", genre: "Theology", form: "treatise", priority: 1 },
      { title: "The Enchiridion", sourceId: "1302", genre: "Theology", form: "treatise", priority: 1 },
      { title: "On the Holy Trinity", sourceId: "1301", genre: "Theology", form: "treatise", priority: 2 },
      { title: "City of God", sourceId: "1201", genre: "Theology", form: "treatise", priority: 2, maxChapters: 50 },
      { title: "On the Catechising of the Uninstructed", sourceId: "1303", genre: "Theology", form: "treatise", priority: 3 },
      { title: "On Faith and the Creed", sourceId: "1304", genre: "Theology", form: "treatise", priority: 3 },
      { title: "On the Profit of Believing", sourceId: "1306", genre: "Theology", form: "treatise", priority: 3 },
      { title: "On Continence", sourceId: "1308", genre: "Theology", form: "treatise", priority: 3 },
      { title: "On the Good of Marriage", sourceId: "1309", genre: "Theology", form: "treatise", priority: 3 },
      { title: "On Patience", sourceId: "1315", genre: "Theology", form: "treatise", priority: 3 },
      { title: "On Grace and Free Will", sourceId: "1510", genre: "Theology", form: "treatise", priority: 2 },
      { title: "Our Lord's Sermon on the Mount", sourceId: "1601", genre: "Commentary", form: "commentary", priority: 2 },
      { title: "Soliloquies", sourceId: "1703", genre: "Spiritual", form: "dialogue", priority: 2 },
    ]
  },

  {
    author: {
      name: "John Chrysostom",
      slug: "john-chrysostom",
      era: "Post-Nicene",
      birthYear: 349,
      deathYear: 407,
      originalLanguage: "grc",
      tier: 1
    },
    works: [
      { title: "Homilies on the Gospel of Matthew", sourceId: "2001", genre: "Homily", form: "sermon", priority: 1, maxChapters: 50 },
      { title: "Homilies on Romans", sourceId: "2102", genre: "Homily", form: "sermon", priority: 1, maxChapters: 40 },
      { title: "Homilies on the Gospel of John", sourceId: "2401", genre: "Homily", form: "sermon", priority: 1, maxChapters: 50 },
      { title: "On the Priesthood", sourceId: "1922", genre: "Treatise", form: "treatise", priority: 1 },
      { title: "Homilies on the Statues", sourceId: "1901", genre: "Homily", form: "sermon", priority: 2 },
      { title: "No One Can Harm the Man Who Does Not Injure Himself", sourceId: "1902", genre: "Treatise", form: "treatise", priority: 2 },
      { title: "Two Letters to Theodore After His Fall", sourceId: "1903", genre: "Letter", form: "letter", priority: 2 },
      { title: "Instructions to Catechumens", sourceId: "1908", genre: "Treatise", form: "treatise", priority: 2 },
      { title: "Homilies on First Corinthians", sourceId: "2201", genre: "Homily", form: "sermon", priority: 2, maxChapters: 30 },
      { title: "Homilies on Ephesians", sourceId: "2301", genre: "Homily", form: "sermon", priority: 2, maxChapters: 25 },
    ]
  },

  {
    author: {
      name: "Athanasius of Alexandria",
      slug: "athanasius",
      era: "Nicene",
      birthYear: 296,
      deathYear: 373,
      originalLanguage: "grc",
      tier: 1
    },
    works: [
      { title: "On the Incarnation of the Word", sourceId: "2802", genre: "Theology", form: "treatise", priority: 1 },
      { title: "Life of St. Anthony", sourceId: "2811", genre: "Spiritual", form: "treatise", priority: 1 },
      { title: "Against the Heathen", sourceId: "2801", genre: "Apologetics", form: "treatise", priority: 2 },
      { title: "Four Discourses Against the Arians", sourceId: "2816", genre: "Theology", form: "treatise", priority: 2 },
      { title: "On Luke 10:22", sourceId: "2805", genre: "Commentary", form: "commentary", priority: 3 },
      { title: "Apologia de Fuga", sourceId: "2814", genre: "Apologetics", form: "treatise", priority: 3 },
    ]
  },

  {
    author: {
      name: "Basil the Great",
      slug: "basil-the-great",
      era: "Nicene",
      birthYear: 330,
      deathYear: 379,
      originalLanguage: "grc",
      tier: 1
    },
    works: [
      { title: "On the Holy Spirit", sourceId: "3203", genre: "Theology", form: "treatise", priority: 1 },
      { title: "Hexaemeron", sourceId: "3201", genre: "Commentary", form: "sermon", priority: 1 },
      { title: "Letters", sourceId: "3202", genre: "Letter", form: "letter", priority: 2, maxChapters: 50 },
    ]
  },

  {
    author: {
      name: "Gregory of Nazianzus",
      slug: "gregory-of-nazianzus",
      era: "Nicene",
      birthYear: 329,
      deathYear: 390,
      originalLanguage: "grc",
      tier: 1
    },
    works: [
      { title: "Orations", sourceId: "3102", genre: "Theology", form: "sermon", priority: 1 },
      { title: "Letters", sourceId: "3103", genre: "Letter", form: "letter", priority: 2, maxChapters: 30 },
    ]
  },

  {
    author: {
      name: "Gregory of Nyssa",
      slug: "gregory-of-nyssa",
      era: "Nicene",
      birthYear: 335,
      deathYear: 395,
      originalLanguage: "grc",
      tier: 1
    },
    works: [
      { title: "On the Making of Man", sourceId: "2914", genre: "Theology", form: "treatise", priority: 1 },
      { title: "On the Soul and the Resurrection", sourceId: "2915", genre: "Theology", form: "dialogue", priority: 1 },
      { title: "The Great Catechism", sourceId: "2908", genre: "Theology", form: "treatise", priority: 1 },
      { title: "On Virginity", sourceId: "2907", genre: "Spiritual", form: "treatise", priority: 2 },
      { title: "On the Baptism of Christ", sourceId: "2910", genre: "Theology", form: "sermon", priority: 2 },
      { title: "On Infants' Early Deaths", sourceId: "2912", genre: "Theology", form: "treatise", priority: 3 },
      { title: "On Pilgrimages", sourceId: "2913", genre: "Spiritual", form: "treatise", priority: 3 },
    ]
  },

  {
    author: {
      name: "Jerome",
      slug: "jerome",
      era: "Post-Nicene",
      birthYear: 342,
      deathYear: 420,
      originalLanguage: "la",
      tier: 1
    },
    works: [
      { title: "Letters", sourceId: "3001", genre: "Letter", form: "letter", priority: 1, maxChapters: 60 },
      { title: "Illustrious Men", sourceId: "2708", genre: "History", form: "treatise", priority: 1 },
      { title: "Against Jovinianus", sourceId: "3009", genre: "Apologetics", form: "treatise", priority: 2 },
      { title: "The Perpetual Virginity of Blessed Mary", sourceId: "3007", genre: "Theology", form: "treatise", priority: 2 },
      { title: "The Life of Malchus", sourceId: "3006", genre: "Spiritual", form: "treatise", priority: 2 },
      { title: "The Life of Paulus the First Hermit", sourceId: "3008", genre: "Spiritual", form: "treatise", priority: 2 },
      { title: "The Life of S. Hilarion", sourceId: "3003", genre: "Spiritual", form: "treatise", priority: 2 },
      { title: "The Dialogue Against the Luciferians", sourceId: "3005", genre: "Apologetics", form: "dialogue", priority: 3 },
    ]
  },

  {
    author: {
      name: "Ambrose of Milan",
      slug: "ambrose",
      era: "Post-Nicene",
      birthYear: 340,
      deathYear: 397,
      originalLanguage: "la",
      tier: 1
    },
    works: [
      { title: "On the Duties of the Clergy", sourceId: "3401", genre: "Treatise", form: "treatise", priority: 1 },
      { title: "On the Holy Spirit", sourceId: "3402", genre: "Theology", form: "treatise", priority: 1 },
      { title: "On the Christian Faith", sourceId: "3404", genre: "Theology", form: "treatise", priority: 1 },
      { title: "On the Mysteries", sourceId: "3405", genre: "Theology", form: "treatise", priority: 2 },
      { title: "On Repentance", sourceId: "3406", genre: "Spiritual", form: "treatise", priority: 2 },
      { title: "Concerning Virgins", sourceId: "3407", genre: "Spiritual", form: "treatise", priority: 3 },
    ]
  },

  {
    author: {
      name: "Tertullian",
      slug: "tertullian",
      era: "Ante-Nicene",
      birthYear: 155,
      deathYear: 220,
      originalLanguage: "la",
      tier: 1
    },
    works: [
      { title: "The Apology", sourceId: "0301", genre: "Apologetics", form: "treatise", priority: 1 },
      { title: "Against Marcion", sourceId: "0312", genre: "Apologetics", form: "treatise", priority: 1, maxChapters: 40 },
      { title: "The Prescription Against Heretics", sourceId: "0311", genre: "Apologetics", form: "treatise", priority: 1 },
      { title: "On the Flesh of Christ", sourceId: "0315", genre: "Theology", form: "treatise", priority: 2 },
      { title: "On the Resurrection of the Flesh", sourceId: "0316", genre: "Theology", form: "treatise", priority: 2 },
      { title: "Against Praxeas", sourceId: "0317", genre: "Theology", form: "treatise", priority: 2 },
      { title: "A Treatise on the Soul", sourceId: "0310", genre: "Theology", form: "treatise", priority: 2 },
      { title: "On Repentance", sourceId: "0320", genre: "Spiritual", form: "treatise", priority: 2 },
      { title: "On Baptism", sourceId: "0321", genre: "Theology", form: "treatise", priority: 2 },
      { title: "On Prayer", sourceId: "0322", genre: "Spiritual", form: "treatise", priority: 2 },
      { title: "Of Patience", sourceId: "0325", genre: "Spiritual", form: "treatise", priority: 3 },
      { title: "Ad Martyras", sourceId: "0323", genre: "Spiritual", form: "treatise", priority: 3 },
    ]
  },

  {
    author: {
      name: "Origen",
      slug: "origen",
      era: "Ante-Nicene",
      birthYear: 184,
      deathYear: 253,
      originalLanguage: "grc",
      tier: 1
    },
    works: [
      { title: "De Principiis", sourceId: "0412", genre: "Theology", form: "treatise", priority: 1 },
      { title: "Against Celsus", sourceId: "0416", genre: "Apologetics", form: "treatise", priority: 1, maxChapters: 50 },
      { title: "Commentary on the Gospel of John", sourceId: "1015", genre: "Commentary", form: "commentary", priority: 2, maxChapters: 40 },
      { title: "Commentary on the Gospel of Matthew", sourceId: "1016", genre: "Commentary", form: "commentary", priority: 2, maxChapters: 40 },
      { title: "Letter to Gregory", sourceId: "1014", genre: "Letter", form: "letter", priority: 3 },
    ]
  },

  {
    author: {
      name: "Irenaeus of Lyons",
      slug: "irenaeus",
      era: "Ante-Nicene",
      birthYear: 130,
      deathYear: 202,
      originalLanguage: "grc",
      tier: 1
    },
    works: [
      { title: "Against Heresies", sourceId: "0103", genre: "Apologetics", form: "treatise", priority: 1, maxChapters: 60 },
      { title: "Fragments from the Lost Writings", sourceId: "0134", genre: "Theology", form: "treatise", priority: 3 },
    ]
  },

  {
    author: {
      name: "Clement of Alexandria",
      slug: "clement-of-alexandria",
      era: "Ante-Nicene",
      birthYear: 150,
      deathYear: 215,
      originalLanguage: "grc",
      tier: 1
    },
    works: [
      { title: "Exhortation to the Heathen", sourceId: "0208", genre: "Apologetics", form: "treatise", priority: 1 },
      { title: "The Instructor", sourceId: "0209", genre: "Theology", form: "treatise", priority: 1, maxChapters: 40 },
      { title: "The Stromata", sourceId: "0210", genre: "Theology", form: "treatise", priority: 1, maxChapters: 50 },
      { title: "Who is the Rich Man That Shall Be Saved", sourceId: "0207", genre: "Spiritual", form: "treatise", priority: 2 },
    ]
  },

  {
    author: {
      name: "Cyprian of Carthage",
      slug: "cyprian",
      era: "Ante-Nicene",
      birthYear: 210,
      deathYear: 258,
      originalLanguage: "la",
      tier: 1
    },
    works: [
      { title: "The Treatises of Cyprian", sourceId: "0507", genre: "Theology", form: "treatise", priority: 1, maxChapters: 20 },
      { title: "The Epistles of Cyprian", sourceId: "0506", genre: "Letter", form: "letter", priority: 2, maxChapters: 40 },
      { title: "The Life and Passion of Cyprian", sourceId: "0505", genre: "History", form: "treatise", priority: 3 },
    ]
  },

  {
    author: {
      name: "Justin Martyr",
      slug: "justin-martyr",
      era: "Ante-Nicene",
      birthYear: 100,
      deathYear: 165,
      originalLanguage: "grc",
      tier: 1
    },
    works: [
      { title: "First Apology", sourceId: "0126", genre: "Apologetics", form: "treatise", priority: 1 },
      { title: "Second Apology", sourceId: "0127", genre: "Apologetics", form: "treatise", priority: 1 },
      { title: "Dialogue with Trypho", sourceId: "0128", genre: "Apologetics", form: "dialogue", priority: 1, maxChapters: 50 },
      { title: "Hortatory Address to the Greeks", sourceId: "0129", genre: "Apologetics", form: "treatise", priority: 3 },
    ]
  },

  // =========== TIER 2: Important Fathers ===========

  {
    author: {
      name: "Ignatius of Antioch",
      slug: "ignatius-of-antioch",
      era: "Apostolic",
      birthYear: 35,
      deathYear: 108,
      originalLanguage: "grc",
      tier: 2
    },
    works: [
      { title: "Epistle to the Ephesians", sourceId: "0104", genre: "Letter", form: "letter", priority: 1 },
      { title: "Epistle to the Romans", sourceId: "0107", genre: "Letter", form: "letter", priority: 1 },
      { title: "Epistle to the Magnesians", sourceId: "0105", genre: "Letter", form: "letter", priority: 2 },
      { title: "Epistle to the Trallians", sourceId: "0106", genre: "Letter", form: "letter", priority: 2 },
      { title: "Epistle to the Philadelphians", sourceId: "0108", genre: "Letter", form: "letter", priority: 2 },
      { title: "Epistle to the Smyrnaeans", sourceId: "0109", genre: "Letter", form: "letter", priority: 2 },
      { title: "Epistle to Polycarp", sourceId: "0110", genre: "Letter", form: "letter", priority: 2 },
    ]
  },

  {
    author: {
      name: "Polycarp",
      slug: "polycarp",
      era: "Apostolic",
      birthYear: 69,
      deathYear: 155,
      originalLanguage: "grc",
      tier: 2
    },
    works: [
      { title: "Epistle to the Philippians", sourceId: "0136", genre: "Letter", form: "letter", priority: 1 },
      { title: "The Martyrdom of Polycarp", sourceId: "0102", genre: "History", form: "treatise", priority: 1 },
    ]
  },

  {
    author: {
      name: "Clement of Rome",
      slug: "clement-of-rome",
      era: "Apostolic",
      birthYear: null,
      deathYear: 99,
      originalLanguage: "grc",
      tier: 2
    },
    works: [
      { title: "First Epistle to the Corinthians", sourceId: "1010", genre: "Letter", form: "letter", priority: 1 },
      { title: "Second Epistle to the Corinthians", sourceId: "1011", genre: "Letter", form: "letter", priority: 2 },
    ]
  },

  {
    author: {
      name: "The Didache",
      slug: "didache",
      era: "Apostolic",
      birthYear: null,
      deathYear: null,
      originalLanguage: "grc",
      tier: 2
    },
    works: [
      { title: "The Didache", sourceId: "0714", genre: "Theology", form: "manual", priority: 1 },
    ]
  },

  {
    author: {
      name: "Hermas",
      slug: "hermas",
      era: "Apostolic",
      birthYear: null,
      deathYear: null,
      originalLanguage: "grc",
      tier: 2
    },
    works: [
      { title: "The Shepherd", sourceId: "0201", genre: "Spiritual", form: "treatise", priority: 1, maxChapters: 30 },
    ]
  },

  {
    author: {
      name: "Eusebius of Caesarea",
      slug: "eusebius",
      era: "Nicene",
      birthYear: 260,
      deathYear: 340,
      originalLanguage: "grc",
      tier: 2
    },
    works: [
      { title: "Church History", sourceId: "2501", genre: "History", form: "treatise", priority: 1, maxChapters: 60 },
      { title: "Life of Constantine", sourceId: "2502", genre: "History", form: "treatise", priority: 2, maxChapters: 30 },
    ]
  },

  {
    author: {
      name: "Cyril of Jerusalem",
      slug: "cyril-of-jerusalem",
      era: "Nicene",
      birthYear: 313,
      deathYear: 386,
      originalLanguage: "grc",
      tier: 2
    },
    works: [
      { title: "Catechetical Lectures", sourceId: "3101", genre: "Theology", form: "sermon", priority: 1, maxChapters: 30 },
    ]
  },

  {
    author: {
      name: "Leo the Great",
      slug: "leo-the-great",
      era: "Post-Nicene",
      birthYear: 400,
      deathYear: 461,
      originalLanguage: "la",
      tier: 2
    },
    works: [
      { title: "Sermons", sourceId: "3603", genre: "Homily", form: "sermon", priority: 1, maxChapters: 50 },
      { title: "Letters", sourceId: "3604", genre: "Letter", form: "letter", priority: 2, maxChapters: 40 },
    ]
  },

  {
    author: {
      name: "Gregory the Great",
      slug: "gregory-the-great",
      era: "Post-Nicene",
      birthYear: 540,
      deathYear: 604,
      originalLanguage: "la",
      tier: 2
    },
    works: [
      { title: "Pastoral Rule", sourceId: "3601", genre: "Treatise", form: "treatise", priority: 1 },
    ]
  },

  {
    author: {
      name: "Hippolytus of Rome",
      slug: "hippolytus",
      era: "Ante-Nicene",
      birthYear: 170,
      deathYear: 235,
      originalLanguage: "grc",
      tier: 2
    },
    works: [
      { title: "The Refutation of All Heresies", sourceId: "0501", genre: "Apologetics", form: "treatise", priority: 1, maxChapters: 30 },
      { title: "Against the Heresy of Noetus", sourceId: "0521", genre: "Apologetics", form: "treatise", priority: 2 },
      { title: "The Antichrist", sourceId: "0516", genre: "Theology", form: "treatise", priority: 2 },
    ]
  },

  {
    author: {
      name: "Lactantius",
      slug: "lactantius",
      era: "Ante-Nicene",
      birthYear: 250,
      deathYear: 325,
      originalLanguage: "la",
      tier: 2
    },
    works: [
      { title: "The Divine Institutes", sourceId: "0701", genre: "Apologetics", form: "treatise", priority: 1, maxChapters: 40 },
      { title: "On the Anger of God", sourceId: "0703", genre: "Theology", form: "treatise", priority: 2 },
      { title: "On the Workmanship of God", sourceId: "0704", genre: "Theology", form: "treatise", priority: 2 },
      { title: "Of the Manner In Which the Persecutors Died", sourceId: "0705", genre: "History", form: "treatise", priority: 2 },
    ]
  },

  {
    author: {
      name: "Hilary of Poitiers",
      slug: "hilary-of-poitiers",
      era: "Nicene",
      birthYear: 310,
      deathYear: 367,
      originalLanguage: "la",
      tier: 2
    },
    works: [
      { title: "On the Trinity", sourceId: "3302", genre: "Theology", form: "treatise", priority: 1, maxChapters: 20 },
      { title: "On the Councils", sourceId: "3301", genre: "Theology", form: "treatise", priority: 2 },
    ]
  },

  {
    author: {
      name: "Ephraim the Syrian",
      slug: "ephraim-the-syrian",
      era: "Nicene",
      birthYear: 306,
      deathYear: 373,
      originalLanguage: "grc", // Actually Syriac, but translated through Greek
      tier: 2
    },
    works: [
      { title: "On Our Lord", sourceId: "3706", genre: "Theology", form: "treatise", priority: 1 },
      { title: "On Admonition and Repentance", sourceId: "3707", genre: "Spiritual", form: "treatise", priority: 2 },
      { title: "Nisibene Hymns", sourceId: "3702", genre: "Spiritual", form: "treatise", priority: 2, maxChapters: 30 },
    ]
  },

  {
    author: {
      name: "John Cassian",
      slug: "john-cassian",
      era: "Post-Nicene",
      birthYear: 360,
      deathYear: 435,
      originalLanguage: "la",
      tier: 2
    },
    works: [
      { title: "Institutes", sourceId: "3507", genre: "Spiritual", form: "treatise", priority: 1, maxChapters: 20 },
      { title: "Conferences", sourceId: "3508", genre: "Spiritual", form: "treatise", priority: 1, maxChapters: 30 },
    ]
  },

  {
    author: {
      name: "Vincent of Lerins",
      slug: "vincent-of-lerins",
      era: "Post-Nicene",
      birthYear: null,
      deathYear: 445,
      originalLanguage: "la",
      tier: 2
    },
    works: [
      { title: "Commonitory", sourceId: "3506", genre: "Theology", form: "treatise", priority: 1 },
    ]
  },

  {
    author: {
      name: "Athenagoras of Athens",
      slug: "athenagoras",
      era: "Ante-Nicene",
      birthYear: 133,
      deathYear: 190,
      originalLanguage: "grc",
      tier: 2
    },
    works: [
      { title: "A Plea for the Christians", sourceId: "0205", genre: "Apologetics", form: "treatise", priority: 1 },
      { title: "The Resurrection of the Dead", sourceId: "0206", genre: "Theology", form: "treatise", priority: 2 },
    ]
  },

  {
    author: {
      name: "Epistle to Diognetus",
      slug: "diognetus",
      era: "Ante-Nicene",
      birthYear: null,
      deathYear: null,
      originalLanguage: "grc",
      tier: 2
    },
    works: [
      { title: "Epistle to Diognetus", sourceId: "0101", genre: "Apologetics", form: "letter", priority: 1 },
    ]
  },

  {
    author: {
      name: "Minucius Felix",
      slug: "minucius-felix",
      era: "Ante-Nicene",
      birthYear: null,
      deathYear: 250,
      originalLanguage: "la",
      tier: 2
    },
    works: [
      { title: "Octavius", sourceId: "0410", genre: "Apologetics", form: "dialogue", priority: 1 },
    ]
  },

  {
    author: {
      name: "John of Damascus",
      slug: "john-of-damascus",
      era: "Post-Nicene",
      birthYear: 675,
      deathYear: 749,
      originalLanguage: "grc",
      tier: 2
    },
    works: [
      { title: "Exposition of the Orthodox Faith", sourceId: "3304", genre: "Theology", form: "treatise", priority: 1, maxChapters: 50 },
    ]
  },
];

// Calculate expected totals
export function getConfigStats() {
  let totalWorks = 0;
  let tier1Works = 0;
  let tier2Works = 0;

  for (const father of FATHERS_CONFIG) {
    totalWorks += father.works.length;
    if (father.author.tier === 1) {
      tier1Works += father.works.length;
    } else {
      tier2Works += father.works.length;
    }
  }

  return {
    totalAuthors: FATHERS_CONFIG.length,
    totalWorks,
    tier1Authors: FATHERS_CONFIG.filter(f => f.author.tier === 1).length,
    tier2Authors: FATHERS_CONFIG.filter(f => f.author.tier === 2).length,
    tier1Works,
    tier2Works,
  };
}
