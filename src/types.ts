export type Category = 'Anime' | 'TV' | 'Movie';
export type Release = {
  id: string;
  category: Category;
  title: string;
  date: string; // ISO instant, converted to the device timezone for display
  subtitle: string;
  image: string | null;
  url: string | null;
  source: string;
  label: string; // e.g. Episode 4, Theatrical, Digital
  certainty: 'scheduled' | 'announced';
};
export type Preferences = { tmdbKey: string; region: string; accent: 'violet' | 'mint'; reminders: boolean };
