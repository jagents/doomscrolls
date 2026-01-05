# Doomscrolls: 6-Agent Ingestion Progress

**Compiled:** 2026-01-05T06:15:00Z

---

## Summary

| # | Source | Status | Authors | Works | Chunks | Data Size |
|---|--------|--------|---------|-------|--------|-----------|
| 1 | Standard Ebooks | 🔄 Running | 84 | 100 | 116,057 | 96 MB |
| 2 | Sacred Texts | ✅ Complete | 9 | 9 | 3,752 | 2.5 MB |
| 3 | Perseus | ✅ Complete | 13 | 44 | 18,122 | 18 MB |
| 4 | CCEL | ✅ Complete | 42 | 104 | 100,436 | 87 MB |
| 5 | New Advent | ✅ Complete | 33 | 125 | 67,452 | 64 MB |
| 6 | Bible Translations | ✅ Complete | 4 | 264 | 100,959 | 58 MB |
| | **TOTAL (new)** | **5/6 done** | **185** | **646** | **406,778** | **325 MB** |

### Combined with Previous Data

| Source | Chunks |
|--------|--------|
| Previous (Wikiquote, Bible KJV, PoetryDB) | 253,817 |
| New (6 agents above) | 406,778 |
| **GRAND TOTAL** | **660,595** |

### By Content Type

| Type | Source | Chunks |
|------|--------|--------|
| Quotes | Wikiquote (previous) | 219,798 |
| Verses (KJV) | Bible KJV (previous) | 31,009 |
| Poems | PoetryDB (previous) | 3,010 |
| Literary Passages | Standard Ebooks (new) | 116,057 |
| Sacred Wisdom | Sacred Texts (new) | 3,752 |
| Classical Literature | Perseus (new) | 18,122 |
| Christian Classics | CCEL (new) | 100,436 |
| Church Fathers | New Advent (new) | 67,452 |
| Bible Translations | Bible Translations (new) | 100,959 |
| **Total** | | **660,595** |

---

## Agent 1: Standard Ebooks

**Directory:** `data/standardebooks/`
**Status:** 🔄 Running (100/1354 books, 7.4% complete)

### Progress File Contents

# Standard Ebooks Ingestion Progress

**Started:** 2026-01-04T18:46:03.511Z
**Last Updated:** 2026-01-04T18:56:55.975Z

## Progress
- Books: 100 / 1354 (7.4%)
- Passages extracted: 116,057
- Runtime: 11 minutes
- Current: "The Painted Veil" by W Somerset Maugham

## Recent Completions
- The Painted Veil by W. Somerset Maugham - 845 passages
- Dark Princess by W. E. B. Du Bois - 1,429 passages
- The Paradise Mystery by J. S. Fletcher - 940 passages
- The New Freedom by Woodrow Wilson - 660 passages
- Women by Zofia Nalkowska - 757 passages
- The Road to Oz by L. Frank Baum - 470 passages
- Poetry by Matthew Arnold - 1,352 passages
- Wild Animals I Have Known by Ernest Thompson Seton - 609 passages
- Demian by Hermann Hesse - 618 passages
- The End of the Tether by Joseph Conrad - 626 passages

---

## Agent 2: Sacred Texts

**Directory:** `data/sacredtexts/`
**Status:** ✅ Complete

### DONE.txt Contents

```
Sacred Texts ingestion complete
Finished: 2026-01-05T03:15:00Z
Texts: 9
Passages: 3752
Authors: 9
Works: 9

Texts ingested:
- Tao Te Ching (Lao Tzu) - 74 chapters - Taoist
- Bhagavad Gita (Vyasa) - 631 verses - Hindu
- Dhammapada (Buddha) - 502 verses - Buddhist
- Analects (Confucius) - 389 sayings - Confucian
- Meditations (Marcus Aurelius) - 551 sections - Stoic
- Enchiridion (Epictetus) - 123 sections - Stoic
- Art of War (Sun Tzu) - 960 sections - Chinese Philosophy
- The Prophet (Khalil Gibran) - 191 prose poems - Spiritual
- Upanishads (Various Sages) - 331 verses - Hindu

Sources:
- sacred-texts.com
- Project Gutenberg
```

---

## Agent 3: Perseus

**Directory:** `data/perseus/`
**Status:** ✅ Complete

### DONE.txt Contents

```
Perseus ingestion complete
Finished: 2026-01-04T19:01:59.985Z
Texts: 44
Passages: 18122
Authors: 13
```

### Progress Summary

- Texts: 44 / 44 (100%)
- Authors: 13
- Works: 44
- Passages extracted: 18,122

### Complete Works List

| Author | Work | Passages |
|--------|------|----------|
| Homer | Iliad | 425 |
| Homer | Odyssey | 288 |
| Plato | Republic | 278 |
| Plato | Symposium | 54 |
| Plato | Apology | 26 |
| Plato | Phaedrus | 186 |
| Plato | Phaedo | 74 |
| Plato | Meno | 374 |
| Plato | Crito | 43 |
| Aristotle | Nicomachean Ethics | 1,136 |
| Aristotle | Poetics | 232 |
| Aristotle | Politics | 1,189 |
| Aristotle | Rhetoric | 887 |
| Sophocles | Oedipus Rex | 496 |
| Sophocles | Antigone | 345 |
| Sophocles | Ajax | 368 |
| Sophocles | Electra | 454 |
| Euripides | Medea | 335 |
| Euripides | Bacchae | 366 |
| Euripides | Hippolytus | 365 |
| Aeschylus | Agamemnon | 265 |
| Aeschylus | Libation Bearers | 242 |
| Aeschylus | Eumenides | 270 |
| Aeschylus | Prometheus Bound | 268 |
| Aeschylus | Persians | 233 |
| Virgil | Aeneid | 327 |
| Virgil | Eclogues | 57 |
| Virgil | Georgics | 84 |
| Ovid | Metamorphoses | 156 |
| Herodotus | Histories | 3,386 |
| Thucydides | History of the Peloponnesian War | 2,758 |
| Seneca | Moral Epistles | 54 |
| Horace | Odes | 2 |
| Horace | Satires | 132 |
| Horace | Ars Poetica | 37 |
| Plutarch | Life of Alexander | 375 |
| Plutarch | Life of Caesar | 286 |
| Plutarch | Life of Theseus | 136 |
| Plutarch | Life of Pericles | 181 |
| Plutarch | Life of Alcibiades | 22 |
| Plutarch | Life of Demosthenes | 129 |
| Plutarch | Life of Cicero | 225 |
| Plutarch | Life of Antony | 354 |
| Plutarch | Life of Brutus | 222 |

---

## Agent 4: CCEL

**Directory:** `data/ccel/`
**Status:** ✅ Complete

### DONE.txt Contents

```
CCEL ingestion complete
Finished: 2026-01-04T19:22:56.183Z
Texts: 104
Authors: 42
Passages: 100436
Works: 104
```

### Notable Works (Top Passage Counts)

| Author | Work | Passages |
|--------|------|----------|
| Thomas Aquinas | Summa Theologica (Second Part of Second Part) | 9,564 |
| Thomas Aquinas | Summa Theologica (First Part of Second Part) | 6,614 |
| Thomas Aquinas | Summa Theologica (First Part) | 6,493 |
| Thomas Aquinas | Summa Theologica (Third Part) | 6,149 |
| John Calvin | Institutes of the Christian Religion | 3,347 |
| Augustine of Hippo | City of God | 2,299 |
| Charles Spurgeon | Spurgeon's Sermons Vol 3 | 1,817 |
| Charles Spurgeon | Spurgeon's Sermons Vol 7 | 1,820 |
| John Owen | On the Mortification of Sin in Believers | 1,793 |
| A.W. Pink | The Attributes of God | 1,738 |
| Matthew Henry | Matthew Henry's Commentary on Romans | 1,637 |
| Blaise Pascal | Pensees | 1,608 |

---

## Agent 5: New Advent

**Directory:** `data/newadvent/`
**Status:** ✅ Complete

### DONE.txt Contents

```
New Advent ingestion complete
Finished: 2026-01-04T19:39:48.853Z
Authors: 33
Works: 125
Passages: 67452
```

### Church Fathers Included

- Augustine of Hippo (14 works)
- John Chrysostom (10 works)
- Athanasius of Alexandria (6 works)
- Basil the Great (3 works)
- Gregory of Nazianzus (2 works)
- Gregory of Nyssa (7 works)
- Jerome (8 works)
- Ambrose of Milan (6 works)
- Tertullian (12 works)
- Origen (5 works)
- Irenaeus of Lyons (2 works)
- Clement of Alexandria (4 works)
- Cyprian of Carthage (3 works)
- Justin Martyr (4 works)
- Ignatius of Antioch (7 works)
- Polycarp (2 works)
- Clement of Rome (2 works)
- Eusebius of Caesarea (2 works)
- And 15 more...

---

## Agent 6: Bible Translations

**Directory:** `data/bibletranslations/`
**Status:** ✅ Complete

### DONE.txt Contents

```
Bible Translations ingestion complete
Finished: 2026-01-04T22:02:30.337Z
Translations: 4
Books: 264
Verses: 100959
```

### Translation Breakdown

| Translation | Books | Verses |
|-------------|-------|--------|
| WEB (World English Bible) | 66 | 31,010 |
| ASV (American Standard Version) | 66 | 31,009 |
| YLT (Young's Literal Translation) | 66 | 7,884 (NT only) |
| DBY (Darby Translation) | 66 | 31,056 |
| **Total** | **264** | **100,959** |

**Runtime:** 2 hours 47 minutes

---

## Files Found

### standardebooks/
```
total 196872
-rw-r--r--  1 jasondavis  staff       4417  5 Jan 02:56 .progress.json
-rw-r--r--  1 jasondavis  staff      25196  5 Jan 02:56 authors.json
-rw-r--r--  1 jasondavis  staff  100709110  5 Jan 02:56 chunks.json
drwxr-xr-x  2 jasondavis  staff         64  5 Jan 02:56 epubs
-rw-r--r--  1 jasondavis  staff        844  5 Jan 02:56 progress.md
-rw-r--r--  1 jasondavis  staff      41789  5 Jan 02:56 works.json
```

### sacredtexts/
```
total 5216
-rw-r--r--  1 jasondavis  staff      237  5 Jan 03:11 .progress.json
-rw-r--r--  1 jasondavis  staff     3666  5 Jan 03:11 authors.json
-rw-r--r--  1 jasondavis  staff  2649452  5 Jan 03:11 chunks.json
-rw-r--r--  1 jasondavis  staff      634  5 Jan 03:12 DONE.txt
-rw-r--r--  1 jasondavis  staff      992  5 Jan 03:12 progress.md
-rw-r--r--  1 jasondavis  staff     3537  5 Jan 03:11 works.json
```

### perseus/
```
total 36280
-rw-r--r--  1 jasondavis  staff      1288  5 Jan 03:01 .progress.json
-rw-r--r--  1 jasondavis  staff      3791  5 Jan 03:01 authors.json
-rw-r--r--  1 jasondavis  staff  18534684  5 Jan 03:01 chunks.json
-rw-r--r--  1 jasondavis  staff       100  5 Jan 03:01 DONE.txt
-rw-r--r--  1 jasondavis  staff      1921  5 Jan 03:01 progress.md
drwxr-xr-x  4 jasondavis  staff       128  5 Jan 02:35 repos
-rw-r--r--  1 jasondavis  staff     16876  5 Jan 03:01 works.json
```

### ccel/
```
total 178280
-rw-r--r--  1 jasondavis  staff      2928  5 Jan 03:22 .progress.json
-rw-r--r--  1 jasondavis  staff     16454  5 Jan 03:22 authors.json
-rw-r--r--  1 jasondavis  staff  91195019  5 Jan 03:22 chunks.json
-rw-r--r--  1 jasondavis  staff       110  5 Jan 03:22 DONE.txt
-rw-r--r--  1 jasondavis  staff      7029  5 Jan 03:22 progress.md
-rw-r--r--  1 jasondavis  staff     43715  5 Jan 03:22 works.json
```

### newadvent/
```
total 130928
-rw-r--r--  1 jasondavis  staff         0  5 Jan 03:18 .gitkeep
-rw-r--r--  1 jasondavis  staff      6464  5 Jan 03:39 .progress.json
-rw-r--r--  1 jasondavis  staff     10015  5 Jan 03:39 authors.json
-rw-r--r--  1 jasondavis  staff  66945345  5 Jan 03:39 chunks.json
-rw-r--r--  1 jasondavis  staff       104  5 Jan 03:39 DONE.txt
-rw-r--r--  1 jasondavis  staff      5554  5 Jan 03:39 progress.md
-rw-r--r--  1 jasondavis  staff     49749  5 Jan 03:39 works.json
```

### bibletranslations/
```
total 119112
-rw-r--r--  1 jasondavis  staff      5361  5 Jan 06:02 .progress.json
-rw-r--r--  1 jasondavis  staff      1945  5 Jan 05:21 authors.json
-rw-r--r--  1 jasondavis  staff  60826615  5 Jan 06:02 chunks.json
-rw-r--r--  1 jasondavis  staff       115  5 Jan 06:02 DONE.txt
-rw-r--r--  1 jasondavis  staff       524  5 Jan 06:02 progress.md
-rw-r--r--  1 jasondavis  staff    103238  5 Jan 06:02 works.json
```
