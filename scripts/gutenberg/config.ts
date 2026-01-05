// Gutenberg Ingestion Configuration

export const TOP_AUTHORS = [
  "Austen, Jane",
  "Dickens, Charles",
  "Twain, Mark",
  "Dostoevsky, Fyodor",
  "Tolstoy, Leo",
  "Hugo, Victor",
  "Melville, Herman",
  "Brontë, Charlotte",
  "Brontë, Emily",
  "Hardy, Thomas",
  "Wilde, Oscar",
  "Wells, H. G.",
  "Verne, Jules",
  "Doyle, Arthur Conan",
  "Poe, Edgar Allan",
  "Hawthorne, Nathaniel",
  "James, Henry",
  "Conrad, Joseph",
  "Lawrence, D. H.",
  "Woolf, Virginia",
  "Joyce, James",
  "Kafka, Franz",
  "Balzac, Honoré de",
  "Dumas, Alexandre",
  "Eliot, George",
  "Wharton, Edith",
  "London, Jack",
  "Kipling, Rudyard",
  "Stevenson, Robert Louis",
  "Scott, Walter"
];

export const GREATEST_BOOKS = [
  "Don Quixote",
  "The Divine Comedy",
  "The Canterbury Tales",
  "Paradise Lost",
  "Faust",
  "Madame Bovary",
  "The Brothers Karamazov",
  "The Idiot",
  "Notes from Underground",
  "Dead Souls",
  "Eugene Onegin",
  "Fathers and Sons",
  "Oblomov",
  "Candide",
  "The Red and the Black",
  "The Charterhouse of Parma",
  "Germinal",
  "One Thousand and One Nights",
  "Robinson Crusoe",
  "Gulliver's Travels",
  "Tom Jones",
  "Tristram Shandy",
  "Clarissa",
  "Vanity Fair",
  "Barchester Towers",
  "The Way of All Flesh",
  "Tess of the d'Urbervilles",
  "Jude the Obscure",
  "The Return of the Native",
  "Far from the Madding Crowd",
  "Bleak House",
  "David Copperfield",
  "Great Expectations",
  "Oliver Twist",
  "A Christmas Carol",
  "Northanger Abbey",
  "Mansfield Park",
  "Persuasion",
  "Sense and Sensibility",
  "Emma",
  "The Scarlet Letter",
  "The House of the Seven Gables",
  "Uncle Tom's Cabin",
  "Walden",
  "Leaves of Grass",
  "The Portrait of a Lady",
  "The Turn of the Screw",
  "Daisy Miller",
  "The Ambassadors"
];

export const BOOKSHELVES = [
  // Tier 1: Must Have
  "Harvard Classics",
  "Banned Books",
  "Philosophy",
  "Science",
  "Best Books Ever Listings",

  // Tier 2: High Value
  "Science Fiction",
  "Detective Fiction",
  "Gothic Fiction",
  "Mythology",
  "Children's Literature",

  // Tier 3: Important Topics
  "Political Science",
  "Psychology",
  "Economics",
  "African American Writers",

  // Tier 4: Genre Diversity
  "Adventure",
  "Humor",
  "Short Stories"
];

export const RATE_LIMITS = {
  API_DELAY_MS: 300,
  DOWNLOAD_DELAY_MS: 500,
  RETRY_COUNT: 3,
  RETRY_BASE_DELAY_MS: 1000
};

export const CHUNK_CONFIG = {
  MIN_LENGTH: 300,
  MAX_LENGTH: 600,
  OVERLAP: 50
};
