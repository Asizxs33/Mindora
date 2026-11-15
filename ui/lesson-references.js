// Curated teaching figures. Credit and publication rights are recorded with each local asset.
const references = [
  {
    match: /binary tree|бинарн\S* дерев|екілік ағаш/iu,
    file: 'binary-tree.svg', size: [300, 250], author: 'Derrick Coetzee',
    source: 'https://commons.wikimedia.org/wiki/File:Binary_tree.svg',
    caption: ['Start at the root. Each node branches to at most two children.', 'Начни с корня. У каждого узла не более двух потомков.', 'Түбірден баста. Әр түйіннен ең көбі екі тармақ шығады.'],
  },
  {
    match: /normal distribution|gaussian distribution|нормальн\S* распределени|қалыпты (таралу|үлестірім)/iu,
    file: 'normal-distributions.svg', size: [720, 460], author: 'Inductiveload',
    source: 'https://commons.wikimedia.org/wiki/File:Normal_Distribution_PDF.svg',
    caption: ['Compare the curves. The mean sets the centre and the variance sets the spread.', 'Сравни кривые. Среднее определяет центр, а дисперсия — разброс.', 'Қисықтарды салыстыр. Орташа мән ортаны, ал дисперсия шашырауды анықтайды.'],
  },
  {
    match: /colou?r wheel|primary paint colou?rs|цветов\S* круг|түстер шеңбер|түстер дөңгелег/iu,
    file: 'color-wheel.svg', size: [400, 400], author: 'Mike Horvath',
    source: 'https://commons.wikimedia.org/wiki/File:RYBWheel.svg',
    caption: ['On this traditional painting wheel, blue sits opposite orange.', 'На этом художественном цветовом круге синий и оранжевый расположены напротив друг друга.', 'Бұл дәстүрлі бояу шеңберінде көк пен қызғылт сары қарама-қарсы орналасқан.'],
  },
  {
    match: /poster (design|layout|composition|headline)|design (?:a |your |the )?poster|афиш|композиц\S* плакат|дизайн\S* (?:плакат|постер)|постер\S* (?:композиция|дизайн|тақырып)/iu,
    file: 'yellowstone.jpg', size: [756, 1024], author: 'C. Don Powell · Library of Congress',
    source: 'https://www.loc.gov/item/2007676133/',
    caption: ['The large geyser draws your eye first. The dark band groups the park name and service details.', 'Сначала взгляд привлекает гейзер. На тёмной полосе собраны название парка и служебные подписи.', 'Алдымен үлкен гейзер көзге түседі. Саябақтың атауы мен мекеме туралы мәлімет төмендегі қою жолаққа топтастырылған.'],
  },
];

export function lessonReference(topic, language) {
  const ref = references.find(item => item.match.test(topic));
  if (!ref) return '';
  const locale = ['en','ru','kk'].includes(language) ? language : 'en';
  const caption = ref.caption[['en','ru','kk'].indexOf(locale)];
  const src = new URL('./assets/lesson-references/' + ref.file, import.meta.url).href;
  return `<figure class="lesson-reference" lang="${locale}"><img src="${src}" alt="" width="${ref.size[0]}" height="${ref.size[1]}" loading="lazy" decoding="async"><figcaption>${caption} <a href="${ref.source}" rel="noopener noreferrer" target="_blank">${ref.author}</a></figcaption></figure>`;
}
