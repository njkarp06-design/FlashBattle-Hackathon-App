const CATEGORIES = [
  'General Knowledge',
  'Language',
  'Technology',
  'Mathematics',
  'Science',
  'History',
  'Geography',
  'Literature',
  'Music',
  'Film & TV',
  'Sports',
  'Business',
  'Medicine',
  'Philosophy',
  'Psychology',
  'Gaming',
  'Food & Cooking',
  'Nature',
  'Art & Design',
  'Law & Politics',
];

const CATEGORY_ICONS = {
  'General Knowledge': '⭐',
  'Language': '💬',
  'Technology': '💻',
  'Mathematics': '🔢',
  'Science': '🔬',
  'History': '📜',
  'Geography': '🌍',
  'Literature': '📖',
  'Music': '🎵',
  'Film & TV': '🎬',
  'Sports': '⚽',
  'Business': '💼',
  'Medicine': '🩺',
  'Philosophy': '💭',
  'Psychology': '🧠',
  'Gaming': '🎮',
  'Food & Cooking': '🍳',
  'Nature': '🌿',
  'Art & Design': '🎨',
  'Law & Politics': '⚖️',
};

const AVATAR_COLORS = [
  { hex: '#00F5D4', name: 'Cyan' },
  { hex: '#A855F7', name: 'Purple' },
  { hex: '#FF6B35', name: 'Orange' },
  { hex: '#3B82F6', name: 'Blue' },
  { hex: '#10B981', name: 'Green' },
  { hex: '#F59E0B', name: 'Amber' },
  { hex: '#EF4444', name: 'Red' },
  { hex: '#EC4899', name: 'Pink' },
  { hex: '#06B6D4', name: 'Teal' },
  { hex: '#84CC16', name: 'Lime' },
  { hex: '#8B5CF6', name: 'Violet' },
  { hex: '#F97316', name: 'Flame' },
];

function catSlug(cat) {
  return cat.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

module.exports = { CATEGORIES, CATEGORY_ICONS, AVATAR_COLORS, catSlug };
