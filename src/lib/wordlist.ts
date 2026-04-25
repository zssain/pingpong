/**
 * Word lists for generating daily rotating pseudonyms.
 *
 * 64 adjectives x 64 animals x 100 numbers = ~409,600 unique aliases.
 * That's enough that collisions are rare in a local mesh of dozens of devices,
 * while keeping names short and memorable ("amber-wolf-17").
 */

/** 64 evocative, short adjectives — colors, metals, natural elements. */
export const ADJECTIVES = [
  'amber', 'arctic', 'ashen', 'azure',
  'blaze', 'bold', 'bright', 'bronze',
  'calm', 'cedar', 'clear', 'cobalt',
  'coral', 'crimson', 'crystal', 'cyan',
  'dusk', 'dusty', 'ember', 'faded',
  'flint', 'frosty', 'gilt', 'golden',
  'granite', 'haze', 'holly', 'hushed',
  'indigo', 'iron', 'ivory', 'jade',
  'keen', 'lapis', 'lunar', 'maple',
  'misty', 'moss', 'noble', 'obsidian',
  'olive', 'opal', 'pale', 'pine',
  'prism', 'quartz', 'quiet', 'rapid',
  'raven', 'rouge', 'rustic', 'sage',
  'scarlet', 'shadow', 'silver', 'slate',
  'solar', 'stark', 'steel', 'storm',
  'tawny', 'timber', 'velvet', 'violet',
] as const

/** 64 common, recognizable animals — easy to spell and say aloud. */
export const ANIMALS = [
  'badger', 'bear', 'bison', 'bobcat',
  'crane', 'crow', 'deer', 'dolphin',
  'eagle', 'elk', 'falcon', 'ferret',
  'finch', 'fox', 'gecko', 'goose',
  'hare', 'hawk', 'heron', 'horse',
  'ibis', 'jackal', 'jay', 'kite',
  'lark', 'lemur', 'lion', 'lizard',
  'lynx', 'magpie', 'marten', 'moth',
  'newt', 'osprey', 'otter', 'owl',
  'panda', 'parrot', 'pelican', 'pike',
  'puma', 'quail', 'rabbit', 'raven',
  'robin', 'salmon', 'seal', 'shrike',
  'snipe', 'sparrow', 'stork', 'swan',
  'swift', 'tern', 'thrush', 'tiger',
  'viper', 'vole', 'whale', 'wolf',
  'wren', 'yak', 'zebra', 'zephyr',
] as const
