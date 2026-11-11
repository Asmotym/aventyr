export const BAG_ICON_CATEGORIES = [
  { id: 'all', icon: 'mdi-view-grid-outline' },
  { id: 'recent', icon: 'mdi-history' },
  { id: 'people', icon: 'mdi-emoticon-outline' },
  { id: 'nature', icon: 'mdi-leaf' },
  { id: 'food', icon: 'mdi-food-apple-outline' },
  { id: 'activity', icon: 'mdi-soccer' },
  { id: 'travel', icon: 'mdi-airplane' },
  { id: 'objects', icon: 'mdi-lightbulb-outline' },
  { id: 'symbols', icon: 'mdi-shape-outline' },
  { id: 'flags', icon: 'mdi-flag-outline' },
  { id: 'rpg', icon: 'mdi-sword-cross' },
] as const;
export type BagIconCategory = typeof BAG_ICON_CATEGORIES[number]['id'];
type ContentCategory = Exclude<BagIconCategory, 'all' | 'recent'>;
const prefixes: Array<[ContentCategory, RegExp]> = [
  ['flags', /^(flag|windsock)(-|$)/],
  ['people', /^(account|human|emoticon|face|head|hand|arm|foot|fingerprint|gesture|baby|family|gender|hair|mustache|brain|ear|eye|nose|tooth|bone|skull|heart|meditation)(-|$)/],
  ['food', /^(food|fruit|silverware|coffee|tea|beer|glass|bottle|cup|cake|candy|cookie|bread|baguette|cheese|chili|carrot|corn|egg|hamburger|pizza|pasta|noodles|rice|sushi|taco|muffin|popcorn|sausage|shaker|spoon|bowl|kettle|ice-cream|ice-pop|peanut|nutrition|grill)(-|$)/],
  ['nature', /^(cat|dog|bird|duck|owl|penguin|dove|bat|butterfly|bee|bug|ant|ladybug|spider|snake|fish|dolphin|shark|jellyfish|octopus|paw|rabbit|rodent|turtle|tortoise|snail|sheep|cow|pig|horse|kangaroo|koala|panda|elephant|fox|unicorn|dragon|deer|camel|feather|flower|leaf|tree|pine-tree|sprout|seed|mushroom|cactus|clover|grass|forest|palm-tree|weather|cloud|snowflake|water|waves|fire|earth|moon|sun|volcano|mountain|terrain)(-|$)/],
  ['rpg', /^(sword|shield|axe|bow|arrow-projectile|archery|mace|spear|dagger|knife-military|wizard|magic|crystal|dice|cards|chess|crown|castle|treasure|sack|gold|diamond|gem|ring|bottle-tonic|potion|flask|rune|spell|creation|shimmer|sparkles|auto-fix|anvil|armor|helmet|pistol|rifle|ammunition|bomb|horseshoe)(-|$)/],
  ['activity', /^(run|walk|hike|swim|ski|skate|snowboard|surf|yoga|dance|weight|dumbbell|fitness|basketball|baseball|football|soccer|tennis|golf|hockey|cricket|rugby|volleyball|badminton|boxing|karate|fencing|rowing|jump|parachute|trophy|medal|podium|whistle|stadium|gamepad|controller|puzzle|music|guitar|piano|violin|drum|trumpet|saxophone|microphone|theater|drama|palette|brush|party|balloon|ticket|film|movie)(-|$)/],
  ['travel', /^(airplane|airport|helicopter|car|bus|truck|train|tram|subway|railroad|ferry|sail|sailing|boat|ship|submarine|anchor|bike|bicycle|motorbike|scooter|rocket|satellite|space-station|ufo|map|compass|navigation|sign-direction|sign-pole|road|highway|bridge|traffic|tunnel|parking|gas-station|ev-station|home|house|city|office-building|domain|bank|hospital|school|store|warehouse|factory|church|mosque|synagogue|temple|eiffel-tower|tower|lighthouse|pier|tent|campfire|beach|island|palm|passport|bag-suitcase|luggage|transit|earth)(-|$)/],
  ['symbols', /^(abjad|abugida|alphabet|alpha|numeric|roman-numeral|arrow|chevron|menu|check|close|plus|minus|equal|not-equal|greater-than|less-than|approximately|division|multiplication|percent|fraction|math|function|infinity|pi|sigma|omega|delta|lambda|currency|format|translate|language|sort|filter|circle|square|triangle|rectangle|pentagon|hexagon|octagon|rhombus|ellipse|star|asterisk|at|ampersand|pound|exclamation|question|help|information|alert|cancel|block|stop|pause|play|skip|rewind|fast-forward|repeat|shuffle|sync|refresh|reload|undo|redo|copyright|registered-trademark|trademark|peace|yin-yang|zodiac|religion|cross|om|islam|judaism|hinduism|buddhism|braille|barcode|qrcode|link|unlink|selection|vector|shape|circle-slice)(-|$)/],
];
// Every installed icon remains discoverable; uncategorized tools, devices, and brands belong to Objects.
export function bagIconCategory(icon: string): ContentCategory {
  const name = icon.replace(/^mdi-/, '');
  return prefixes.find(([, expression]) => expression.test(name))?.[0] ?? 'objects';
}
