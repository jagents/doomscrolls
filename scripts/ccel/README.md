# CCEL (Christian Classics Ethereal Library) Ingestion

Ingests Christian theological classics from Project Gutenberg and CCEL.

## Data Location

- `data/ccel/authors.json` - 42 authors
- `data/ccel/works.json` - 104 works
- `data/ccel/chunks.json` - 100,436 passages
- `data/ccel/progress.md` - Progress log
- `data/ccel/DONE.txt` - Completion signal

## Running

```bash
bun run scripts/ccel/ingest-ccel.ts
```

## Sources

Texts are sourced from:
- **Project Gutenberg** (preferred) - Plain text, easy to parse
- **CCEL.org** - For texts not on Gutenberg

## Texts Included

### Tier 1: Core Classics
- Augustine: Confessions, City of God
- Thomas Aquinas: Summa Theologica (all 4 parts)
- John Calvin: Institutes of the Christian Religion
- John Bunyan: Pilgrim's Progress
- Thomas a Kempis: Imitation of Christ
- G.K. Chesterton: Orthodoxy, Heretics, Everlasting Man
- Blaise Pascal: Pensees

### Tier 2-5: Extended Collection
- Church Fathers: Athanasius, John Chrysostom
- Mystics: Teresa of Avila, John of the Cross, Julian of Norwich, Cloud of Unknowing
- Puritans: John Owen, Richard Baxter, Thomas Brooks
- Reformers: Martin Luther, John Wesley, George Whitefield
- Devotional: Andrew Murray, E.M. Bounds, Charles Spurgeon
- Commentaries: Matthew Henry, Alexander Maclaren

## Chunking Strategy

- Target: 300-600 characters per chunk
- Split on paragraph breaks first
- Then on sentences if paragraphs too long
- 50-character overlap for context

## Rate Limiting

- Gutenberg: 500ms between requests
- CCEL: 1000ms between requests
