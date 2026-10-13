import type {Release} from './types';
const asISO=(s:string|number)=>new Date(s).toISOString();
async function getJSON(url:string, options?:RequestInit):Promise<any>{
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 try{const res=await fetch(url,{...options,signal:controller.signal}); if(!res.ok)throw new Error('HTTP '+res.status);return await res.json();}
 finally{clearTimeout(timeout);}
}
const art=(url?:string|null)=>url||null;
export async function animeSchedule(from:number,to:number):Promise<Release[]> {
 const query='query($page:Int,$from:Int,$to:Int){Page(page:$page,perPage:50){pageInfo{hasNextPage}airingSchedules(airingAt_greater:$from,airingAt_lesser:$to,sort:TIME){id episode airingAt media{id title{english romaji native} coverImage{large} siteUrl format}}}}';
 const out:Release[]=[];
 for(let page=1;page<=5;page++){
  const json=await getJSON('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query,variables:{page,from,to}})});
  if(json.errors)throw Error(json.errors[0]?.message||'AniList error');
  const section=json.data?.Page;
  for(const x of section?.airingSchedules||[]){
   if(!x.media)continue;
   out.push({id:'anime-'+x.id,category:'Anime',title:x.media.title?.english||x.media.title?.romaji||x.media.title?.native||'Anime',date:asISO(x.airingAt*1000),subtitle:x.media.format||'Anime',image:art(x.media.coverImage?.large),url:x.media.siteUrl||null,source:'AniList',label:'Episode '+x.episode,certainty:'scheduled'});
  }
  if(!section?.pageInfo?.hasNextPage)break;
 }
 return out;
}
export async function tvSchedule(start:Date,days=14):Promise<Release[]> {
 const out:Release[]=[];
 // TVmaze publishes daily broadcast schedules (US), not global streaming premieres.
 const dates=Array.from({length:days},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');});
 for(let i=0;i<dates.length;i+=4){
  const batch=await Promise.allSettled(dates.slice(i,i+4).map(d=>getJSON('https://api.tvmaze.com/schedule?country=US&date='+d)));
  for(const b of batch){if(b.status!=='fulfilled')continue;for(const ep of b.value||[]){
   if(!ep.airstamp||!ep.show)continue;
   out.push({id:'tv-'+ep.id,category:'TV',title:ep.show.name||'TV show',date:asISO(ep.airstamp),subtitle:ep.name||'',image:art(ep.show.image?.medium),url:ep.url||ep.show.url||null,source:'TVmaze · US broadcast',label:'S'+String(ep.season||0).padStart(2,'0')+' E'+String(ep.number||0).padStart(2,'0'),certainty:'scheduled'});
  }}
 }
 return out;
}
export async function movieReleases(key:string,region:string,from:Date):Promise<Release[]>{
 if(!key.trim())return [];
 const start=[from.getFullYear(),String(from.getMonth()+1).padStart(2,'0'),String(from.getDate()).padStart(2,'0')].join('-');
 const endDate=new Date(from);endDate.setDate(endDate.getDate()+30);
 const end=[endDate.getFullYear(),String(endDate.getMonth()+1).padStart(2,'0'),String(endDate.getDate()).padStart(2,'0')].join('-');
 const url='https://api.themoviedb.org/3/discover/movie?api_key='+encodeURIComponent(key.trim())+'&region='+encodeURIComponent(region)+'&primary_release_date.gte='+start+'&primary_release_date.lte='+end+'&sort_by=primary_release_date.asc&page=1';
 const data=await getJSON(url);
 return (data.results||[]).filter((m:any)=>m.release_date).map((m:any)=>({
 id:'movie-'+m.id,category:'Movie' as const,title:m.title||m.original_title||'Movie',date:m.release_date+'T12:00:00',subtitle:m.overview||'Movie release',image:m.poster_path?'https://image.tmdb.org/t/p/w342'+m.poster_path:null,url:'https://www.themoviedb.org/movie/'+m.id,source:'TMDB · '+region,label:'Movie release (not OTT confirmed)',certainty:'announced' as const
 }));
}
export async function getAll(key:string,region:string):Promise<{items:Release[];warnings:string[]}>{
 const now=new Date(), from=Math.floor(new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime()/1000),to=from+14*86400;
 const all=await Promise.allSettled([animeSchedule(from,to),tvSchedule(now),movieReleases(key,region,now)]);
 const warnings:string[]=[];
 const names=['AniList','TVmaze','TMDB'];
 const items=all.flatMap((r,i)=>{if(r.status==='fulfilled')return r.value;warnings.push(names[i]+': '+String(r.reason?.message||'unavailable'));return [];});
 if(!key.trim())warnings.push('Add a TMDB API key in Settings to see movies.');
 return {items:items.sort((a,b)=>a.date.localeCompare(b.date)),warnings};
}
