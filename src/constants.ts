export interface AlphabetItem {
  letter: string;
  word: string;
  emoji: string;
  color: string;
}

export const ALPHABET_DATA: AlphabetItem[] = [
  { letter: 'A', word: 'Apple', emoji: '🍎', color: 'bg-red-400' },
  { letter: 'B', word: 'Ball', emoji: '⚽', color: 'bg-blue-400' },
  { letter: 'C', word: 'Cat', emoji: '🐱', color: 'bg-orange-400' },
  { letter: 'D', word: 'Dog', emoji: '🐶', color: 'bg-yellow-600' },
  { letter: 'E', word: 'Elephant', emoji: '🐘', color: 'bg-purple-400' },
  { letter: 'F', word: 'Fish', emoji: '🐟', color: 'bg-cyan-400' },
  { letter: 'G', word: 'Giraffe', emoji: '🦒', color: 'bg-amber-400' },
  { letter: 'H', word: 'Horse', emoji: '🐴', color: 'bg-orange-600' },
  { letter: 'I', word: 'Ice Cream', emoji: '🍦', color: 'bg-pink-300' },
  { letter: 'J', word: 'Jellyfish', emoji: '🪼', color: 'bg-indigo-400' },
  { letter: 'K', word: 'Kangaroo', emoji: '🦘', color: 'bg-orange-500' },
  { letter: 'L', word: 'Lion', emoji: '🦁', color: 'bg-yellow-500' },
  { letter: 'M', word: 'Monkey', emoji: '🐒', color: 'bg-amber-600' },
  { letter: 'N', word: 'Nest', emoji: '🪹', color: 'bg-stone-400' },
  { letter: 'O', word: 'Orange', emoji: '🍊', color: 'bg-orange-400' },
  { letter: 'P', word: 'Panda', emoji: '🐼', color: 'bg-slate-400' },
  { letter: 'Q', word: 'Queen', emoji: '👸', color: 'bg-fuchsia-400' },
  { letter: 'R', word: 'Rabbit', emoji: '🐰', color: 'bg-zinc-300' },
  { letter: 'S', word: 'Sun', emoji: '☀️', color: 'bg-yellow-400' },
  { letter: 'T', word: 'Tiger', emoji: '🐯', color: 'bg-orange-400' },
  { letter: 'U', word: 'Umbrella', emoji: '☂️', color: 'bg-blue-500' },
  { letter: 'V', word: 'Van', emoji: '🚐', color: 'bg-slate-500' },
  { letter: 'W', word: 'Whale', emoji: '🐋', color: 'bg-blue-600' },
  { letter: 'X', word: 'Xylophone', emoji: '🎹', color: 'bg-rainbow-400' }, // Rainbow is not a tailwind color, will use multi-color
  { letter: 'Y', word: 'Yo-yo', emoji: '🪀', color: 'bg-red-500' },
  { letter: 'Z', word: 'Zebra', emoji: '🦓', color: 'bg-neutral-400' },
];

// Fix for Xylophone color
ALPHABET_DATA[23].color = 'bg-teal-400';
