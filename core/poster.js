import { escapeHtml as esc } from './engine.js';

// Preview and downloaded SVG share exactly the same measured layout.
// Fit each text block inside a fixed region, including single unbroken words.
const posterMeasure=document.createElement('canvas').getContext('2d');
function wrapPosterText(text,size,width,weight){
  if(posterMeasure)posterMeasure.font=`${weight} ${size}px Arial, sans-serif`;
  const measure=value=>posterMeasure?posterMeasure.measureText(value).width:Array.from(value).length*size*.65;
  const words=String(text??'').trim().split(/\s+/).filter(Boolean),lines=[];let line='';
  for(const word of words){
    if(measure(word)>width){
      if(line){lines.push(line);line='';}
      for(const char of Array.from(word)){
        if(line&&measure(line+char)>width){lines.push(line);line=char;}else line+=char;
      }
    }else if(line&&measure(`${line} ${word}`)>width){lines.push(line);line=word;}
    else line=line?`${line} ${word}`:word;
  }
  if(line)lines.push(line);
  return lines;
}
function fitPosterText(text,requestedSize,height,weight,lineSpacing){
  let size=requestedSize,lines=wrapPosterText(text,size,330,weight);
  while(size>6&&lines.length*size*lineSpacing>height){size--;lines=wrapPosterText(text,size,330,weight);}
  return {lines,size,lineHeight:size*lineSpacing,height:lines.length*size*lineSpacing};
}
export function posterLayout(p,placeholder=false){
  const titleSize=Math.min(56,Math.max(20,Number(p.titleSize)||34));
  const subtitleSize=Math.min(24,Math.max(10,Number(p.subtitleSize)||16));
  return {
    color:/^#[a-f0-9]{6}$/i.test(p.textColor)?p.textColor:'#263c31',
    bg:/^#[a-f0-9]{6}$/i.test(p.bgColor)?p.bgColor:'#f7d667',
    title:fitPosterText(p.title||(placeholder?'Заголовок постера':''),titleSize,190,800,1.13),
    subtitle:fitPosterText(p.subtitle||(placeholder?'Добавь важную деталь.':''),subtitleSize,78,400,1.45),
    cta:fitPosterText(p.cta||(placeholder?'Подскажи, что делать дальше':''),12,32,700,1.25),
  };
}
export function posterSvg(p,placeholder=false){
  const l=posterLayout(p,placeholder);
  const block=(text,top,weight)=>`<text font-size="${text.size}" font-weight="${weight}">${text.lines.map((line,i)=>`<tspan x="35" y="${top+text.size+i*text.lineHeight}">${esc(line)}</tspan>`).join('')}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 400 500" role="img" aria-label="${esc(p.title||'Предпросмотр постера')}"><rect width="400" height="500" fill="${l.bg}"/><circle cx="390" cy="30" r="75" fill="none" stroke="${l.color}" stroke-width="38" opacity=".08"/><g font-family="Arial,sans-serif" fill="${l.color}"><text x="35" y="45" font-size="9" letter-spacing="1">СОЗДАНО В MINDORA</text>${block(l.title,100,800)}${block(l.subtitle,315,400)}${block(l.cta,435,700)}</g></svg>`;
}
