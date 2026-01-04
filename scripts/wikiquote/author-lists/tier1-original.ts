// Tier 1: Original 70 curated authors from Phase 1
// These have already been ingested

export const TIER1_AUTHORS: Array<{ name: string; era: string }> = [
  // Ancient Philosophy
  { name: 'Marcus Aurelius', era: 'Ancient' },
  { name: 'Seneca the Younger', era: 'Ancient' },
  { name: 'Epictetus', era: 'Ancient' },
  { name: 'Plato', era: 'Ancient' },
  { name: 'Aristotle', era: 'Ancient' },
  { name: 'Socrates', era: 'Ancient' },
  { name: 'Heraclitus', era: 'Ancient' },
  { name: 'Epicurus', era: 'Ancient' },
  { name: 'Cicero', era: 'Ancient' },
  { name: 'Plutarch', era: 'Ancient' },

  // Eastern Philosophy
  { name: 'Confucius', era: 'Ancient' },
  { name: 'Lao Tzu', era: 'Ancient' },
  { name: 'Sun Tzu', era: 'Ancient' },
  { name: 'Gautama Buddha', era: 'Ancient' },

  // Enlightenment & Modern Philosophy
  { name: 'Voltaire', era: 'Enlightenment' },
  { name: 'Michel de Montaigne', era: 'Renaissance' },
  { name: 'Blaise Pascal', era: 'Enlightenment' },
  { name: 'René Descartes', era: 'Enlightenment' },
  { name: 'Immanuel Kant', era: 'Enlightenment' },
  { name: 'Friedrich Nietzsche', era: 'Modern' },
  { name: 'Arthur Schopenhauer', era: 'Romantic' },
  { name: 'Søren Kierkegaard', era: 'Romantic' },
  { name: 'Albert Camus', era: 'Modern' },
  { name: 'Jean-Paul Sartre', era: 'Modern' },

  // American Transcendentalists & Writers
  { name: 'Ralph Waldo Emerson', era: 'Romantic' },
  { name: 'Henry David Thoreau', era: 'Romantic' },
  { name: 'Walt Whitman', era: 'Romantic' },
  { name: 'Mark Twain', era: 'Victorian' },
  { name: 'Benjamin Franklin', era: 'Enlightenment' },
  { name: 'Ernest Hemingway', era: 'Modern' },
  { name: 'F. Scott Fitzgerald', era: 'Modern' },

  // British Writers
  { name: 'William Shakespeare', era: 'Renaissance' },
  { name: 'Oscar Wilde', era: 'Victorian' },
  { name: 'George Bernard Shaw', era: 'Victorian' },
  { name: 'Jane Austen', era: 'Romantic' },
  { name: 'Charles Dickens', era: 'Victorian' },
  { name: 'Virginia Woolf', era: 'Modern' },
  { name: 'George Orwell', era: 'Modern' },
  { name: 'Aldous Huxley', era: 'Modern' },
  { name: 'Samuel Johnson', era: 'Enlightenment' },
  { name: 'Jonathan Swift', era: 'Enlightenment' },
  { name: 'Alexander Pope', era: 'Enlightenment' },

  // Russian Writers
  { name: 'Leo Tolstoy', era: 'Victorian' },
  { name: 'Fyodor Dostoevsky', era: 'Victorian' },
  { name: 'Anton Chekhov', era: 'Victorian' },

  // European Writers
  { name: 'Franz Kafka', era: 'Modern' },
  { name: 'Johann Wolfgang von Goethe', era: 'Romantic' },
  { name: 'Victor Hugo', era: 'Romantic' },

  // Poets
  { name: 'Emily Dickinson', era: 'Victorian' },
  { name: 'Robert Frost', era: 'Modern' },
  { name: 'William Blake', era: 'Romantic' },
  { name: 'John Keats', era: 'Romantic' },
  { name: 'Percy Bysshe Shelley', era: 'Romantic' },
  { name: 'Lord Byron', era: 'Romantic' },
  { name: 'William Wordsworth', era: 'Romantic' },

  // Scientists & Thinkers
  { name: 'Albert Einstein', era: 'Modern' },
  { name: 'Isaac Newton', era: 'Enlightenment' },
  { name: 'Carl Sagan', era: 'Contemporary' },
  { name: 'Charles Darwin', era: 'Victorian' },

  // Historical Figures
  { name: 'Winston Churchill', era: 'Modern' },
  { name: 'Abraham Lincoln', era: 'Victorian' },
  { name: 'Theodore Roosevelt', era: 'Modern' },
  { name: 'Mahatma Gandhi', era: 'Modern' },
  { name: 'Martin Luther King Jr.', era: 'Contemporary' },
  { name: 'Nelson Mandela', era: 'Contemporary' },

  // Wit & Aphorists
  { name: 'Dorothy Parker', era: 'Modern' },
  { name: 'Ambrose Bierce', era: 'Victorian' },
  { name: 'H. L. Mencken', era: 'Modern' },
  { name: 'G. K. Chesterton', era: 'Modern' }
];

export const TIER1_AUTHOR_NAMES = TIER1_AUTHORS.map(a => a.name);
