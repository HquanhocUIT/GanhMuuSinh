// Visual descriptions describe typical appearances, not confirmed ingredients.
// Keep lookalikes explicit: toppings and plate colour alone cannot identify a dish.
export const dishVisionProfiles = [
  {
    key: 'bot-chien',
    name: 'Bột chiên',
    aliases: ['Bột chiên', 'Bánh bột chiên', 'Bột chiên trứng'],
    cues: {
      'rice-cake-blocks':
        'Separate thick rectangular/cuboid or irregular flat rice-cake pieces with pale starchy interiors and browned fried faces.',
      'egg-layer': 'Fried egg forms flat yellow/white sheets around or binding the cake pieces.',
      'papaya-shreds':
        'Fine pale-green shredded papaya piled on top or beside the fried cakes; these are NOT noodles.',
    },
    required: [['rice-cake-blocks'], ['egg-layer']],
    referenceRequired: [['rice-cake-blocks']],
    lookalikes: ['banh-khot', 'banh-beo'],
    distinguish:
      'Cut starchy cake blocks with browned fried faces are the main feature; fried egg often binds them but egg can be omitted. NOT uniform little cup-shaped pancakes with a topping in each centre. Papaya, egg colour or dipping sauce alone is insufficient.',
  },
  {
    key: 'banh-khot',
    name: 'Bánh khọt',
    aliases: ['Bánh khọt'],
    cues: {
      'individual-cups':
        'Many separate small round EDIBLE moulded pancakes, each with its own fried rim. Ceramic serving saucers and paper cupcake wrappers are NOT edible pancake cups. Some cakes are flipped, showing their golden rounded bases.',
      'crisp-cup-rims':
        'Golden fried circular rims surround paler soft centres; the cakes retain their round moulded shapes.',
      'centre-topping':
        'A visible topping sits in the centre of individual little pancakes; it may be chopped small, not necessarily a whole shrimp.',
    },
    required: [['individual-cups'], ['crisp-cup-rims']],
    lookalikes: ['bot-chien', 'banh-beo'],
    distinguish:
      'Not fried egg with cut rice-cake blocks, not one large folded bánh xèo. Soft white centres and hidden/chopped fillings are possible: do not mistake white filling for fried egg. Whole shrimp are NOT required. Diagnose the moulded round cups and fried rims, not the species of filling.',
  },
  {
    key: 'banh-beo',
    name: 'Bánh bèo',
    aliases: ['Bánh bèo bì', 'Bánh bèo'],
    cues: {
      'steamed-white-discs':
        'Small soft smooth white steamed rice discs, on a plate or in shallow saucers; no golden fried crust.',
      'beo-toppings':
        'Small savoury toppings such as orange shrimp crumble, mung-bean paste, pork-skin shreds or scallion oil on smooth steamed white discs. The white ceramic bowl rim is not a fried cake rim.',
    },
    required: [['steamed-white-discs'], ['beo-toppings']],
    lookalikes: ['banh-khot', 'bot-chien'],
    distinguish:
      'Soft steamed white discs, often individually in WHITE CERAMIC SAUCERS. Ignore the saucer rims: the edible cake has no golden fried crust. Not fried round cups or browned rice-cake blocks.',
  },
  {
    key: 'goi-kho-bo',
    name: 'Gỏi khô bò',
    aliases: ['Gỏi khô bò', 'Gỏi đu đủ khô bò'],
    cues: {
      'shredded-salad-base':
        'A loose mound of fine pale-green/white crunchy salad shreds under or beside the dark jerky; it may be served in a takeaway cup, not only on a plate.',
      'dark-jerky-strips':
        'Dark brown/red/near-black seasoned beef pieces on the shredded salad: thin jerky strips OR glossy irregular chunks/liver-like pieces in Saigon versions. They are savoury solid pieces, not black dessert jelly. Shrimp crackers and peanuts are optional.',
    },
    required: [['shredded-salad-base'], ['dark-jerky-strips']],
    lookalikes: ['bot-chien', 'goi-mang-cut'],
    distinguish:
      'Papaya on top of a fried egg-and-rice-cake base is bột chiên, not a jerky salad. Do not call every shredded salad gỏi khô bò.',
  },
  {
    key: 'pha-lau',
    name: 'Phá lấu',
    aliases: ['Phá lấu', 'Phá lấu bò', 'Phá lấu xào', 'Mì phá lấu'],
    cues: {
      'creamy-orange-broth': 'A bowl of orange/brown creamy curry-like broth is the main dish.',
      'offal-shapes':
        'Visible glossy offal with folded, tubular, layered or honeycomb tripe texture. May be in orange/brown coconut broth OR dry/stir-fried over curly noodles with greens.',
      'dry-offal-noodles':
        'A dry stir-fry of glossy reddish brown folded/tubular offal pieces, often on curly instant noodles with green stems.',
    },
    required: [['creamy-orange-broth', 'dry-offal-noodles'], ['offal-shapes']],
    lookalikes: [],
    distinguish:
      'A dry plate of rice, grilled pork and fried egg is cơm tấm, NEVER phá lấu. Ordinary beef stew or soup without identifiable offal is insufficient.',
  },
  {
    key: 'banh-mi',
    name: 'Bánh mì',
    aliases: ['Bánh mì', 'Bánh mì chả', 'Bánh mì thịt'],
    cues: {
      'split-baguette': 'A small oblong crusty baguette split lengthwise.',
      'sandwich-filling': 'Visible savoury filling, herbs or pickles inside the split bread.',
    },
    required: [['split-baguette'], ['sandwich-filling']],
    lookalikes: [],
    distinguish:
      'Recognize an actual sandwich, not words or a picture printed on a cart/menu. Unsliced bread alone does not show the dish.',
  },
  {
    key: 'che',
    name: 'Chè đậu xanh',
    aliases: ['Chè đậu xanh'],
    cues: {
      'mung-bean-dessert':
        'Clearly visible yellow/green mung beans or thick grainy mung-bean paste in a dessert bowl/glass.',
      'sweet-soup-form':
        'A sweet soup/pudding form with syrup or white coconut cream, not a savoury soup.',
    },
    required: [['mung-bean-dessert'], ['sweet-soup-form']],
    lookalikes: ['dau-hu'],
    distinguish: 'A generic white dessert or an unidentifiable drink cannot establish mung beans.',
  },
  {
    key: 'dau-hu',
    name: 'Tàu hũ nước đường',
    aliases: ['Tàu hũ nước đường', 'Tàu hũ', 'Đậu hũ nước đường'],
    cues: {
      'silky-white-curds':
        'Large soft silky white pudding-like tofu folds/curds rather than rice discs or cubes.',
      'amber-ginger-syrup':
        'Thin clear/amber sugar syrup around the broad white tofu folds; ginger slices, coconut milk or small toppings may also be present. The curd folds, not syrup colour, are the main distinction.',
    },
    required: [['silky-white-curds'], ['amber-ginger-syrup']],
    lookalikes: ['che'],
    distinguish: 'White coconut cream alone cannot distinguish tofu pudding from other chè.',
  },
  {
    key: 'goi-mang-cut',
    name: 'Gỏi gà măng cụt',
    aliases: ['Gỏi gà măng cụt', 'Gỏi măng cụt'],
    cues: {
      'chicken-salad': 'Shredded/chopped pale chicken mixed with fresh herbs as a dry salad.',
      'mangosteen-segments':
        'Ivory/white petal segments or sliced unripe mangosteen cross-sections, often flower/ring-shaped with multiple little segment holes, visibly mixed through the salad.',
    },
    required: [['chicken-salad'], ['mangosteen-segments']],
    lookalikes: ['goi-kho-bo'],
    distinguish:
      'Generic chicken salad does not prove mangosteen. If the fruit segments are hidden, abstain.',
  },
  {
    key: 'banh-bong-lan',
    name: 'Bánh bông lan',
    aliases: ['Bánh bông lan', 'Bông lan', 'Bông lan trứng muối', 'Bánh bông lan trứng muối'],
    cues: {
      'sponge-crumb':
        'Airy yellow sponge cake: a slice/block with porous crumb OR small golden domed/flower-shaped baked sponge cakes. Paper wrappers are possible; no savoury fried rice batter.',
      'salted-yolk-topping':
        'Round deep-orange salted egg yolks on top, often with pale pork floss or cream.',
    },
    required: [['sponge-crumb']],
    lookalikes: [],
    distinguish:
      'Recognize the SPONGE CAKE FAMILY, including plain mini cakes and salted-egg versions. Salted yolks are optional. Do not claim a salted-egg subtype or hidden toppings from a plain cake. Bread, flan and tofu pudding are different foods.',
  },
  {
    key: 'nuoc-mia',
    name: 'Nước mía',
    aliases: ['Nước mía', 'Nước mía tắc'],
    cues: {
      'pale-cane-juice': 'A cup/glass of opaque pale yellow-green iced juice.',
      'cane-context':
        'Actual sugarcane stalks or a sugarcane crushing machine visible beside the served juice.',
    },
    required: [['pale-cane-juice']],
    lookalikes: ['ca-phe'],
    distinguish:
      'Colour alone cannot distinguish sugarcane juice from lime juice or tea. Require visible cane context OR clear agreement with multiple supplied visual references. Abstain when the drink could equally be tea, lemonade or another juice.',
  },
  {
    key: 'ca-phe',
    name: 'Cà phê',
    aliases: [
      'Cà phê',
      'Cà phê đen',
      'Cà phê đen đá',
      'Cà phê đen nóng',
      'Cà phê sữa',
      'Cà phê sữa đá',
      'Cà phê vợt',
    ],
    cues: {
      'coffee-drink':
        'A served black/brown coffee drink, OR coffee-and-milk with dark coffee and a pale milk layer/creamy foam, in a cup or glass. Includes hot, iced, black and milk coffee.',
      'coffee-context':
        'Actual coffee brewing equipment (phin, cloth filter or espresso machine) or coffee beans/grounds visible beside the served drink, not just a printed sign.',
      'coffee-layers-or-crema':
        'A concentrated dark coffee layer with a pale milk layer, OR characteristic dense tan espresso crema above the darker coffee; not simply any glass of dark iced liquid.',
    },
    required: [['coffee-drink']],
    lookalikes: ['nuoc-mia'],
    distinguish:
      'Recognize the COFFEE FAMILY, not just black coffee. Brewing equipment/beans, espresso crema or distinct coffee/milk layers support recognition. A generic dark iced drink can be tea/cola: abstain if ambiguous. Do not claim brewing method or exact milk ingredients.',
  },
];

const normalize = (text) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function buildDishCatalog(vendors) {
  return dishVisionProfiles.flatMap((profile) => {
    const names = new Set(profile.aliases.map(normalize));
    const vendorIds = vendors
      .filter((vendor) => names.has(normalize(vendor.dish)))
      .map((vendor) => vendor.id);
    return vendorIds.length ? [{ ...profile, vendorIds }] : [];
  });
}

export function visibleProfile(profile) {
  const { key, name, cues, distinguish } = profile;
  return { key, name, cues, distinguish };
}

export function hasRequiredCues(profile, cueIds) {
  const observed = new Set(cueIds);
  return profile.required.every((group) => group.some((cue) => observed.has(cue)));
}
