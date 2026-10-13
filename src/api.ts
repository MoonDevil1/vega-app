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

const dateOnly=(d:Date)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const tmdbHeaders=(credential:string):Record<string,string>=>credential.trim().startsWith('eyJ')?{'Authorization':'Bearer '+credential.trim(),'accept':'application/json'}:{'accept':'application/json'};
async function tmdb(path:string,credential:string,params:Record<string,string>={}):Promise<any>{
 const url=new URL('https://api.themoviedb.org/3/'+path);
 Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
 if(!credential.trim().startsWith('eyJ'))url.searchParams.set('api_key',credential.trim());
 return getJSON(url.toString(),{headers:tmdbHeaders(credential)});
}
export async function movieReleases(credential:string,region:string,from:Date):Promise<Release[]> {
 if(!credential.trim())return [];
 const start=dateOnly(from),endDate=new Date(from);endDate.setDate(endDate.getDate()+60);
 const end=dateOnly(endDate);
 // Separate digital and theatrical dates: TMDB release_type 4 denotes digital, 3 theatrical.
 const combos=[{type:'4',label:'Digital release · OTT platform unconfirmed'},{type:'3',label:'Theatrical release'}];
 const out:Release[]=[];
 const requests=combos.flatMap(group=>[1,2,3].map(page=>({group,page})));
 const results=await Promise.allSettled(requests.map(async ({group,page})=>{
  const data=await tmdb('discover/movie',credential,{region,'release_date.gte':start,'release_date.lte':end,with_release_type:group.type,sort_by:'popularity.desc',page:String(page),'include_adult':'false'});
  return (data.results||[]).filter((m:any)=>m.release_date).map((m:any):Release=>({
   id:'movie-'+m.id+'-'+group.type,category:'Movie',title:m.title||m.original_title||'Movie',
   date:m.release_date+'T12:00:00',subtitle:m.overview||'Movie release',
   image:m.poster_path?'https://image.tmdb.org/t/p/w342'+m.poster_path:null,
   url:'https://www.themoviedb.org/movie/'+m.id,source:'TMDB · '+region,label:group.label,certainty:'announced'
  }));
 }));
 for(const result of results)if(result.status==='fulfilled')out.push(...result.value);
 if(results.every(x=>x.status==='rejected'))throw new Error('TMDB requests failed. Check the credential or your network.');
 return out.filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i);
}
export async function tmdbTV(credential:string,region:string,from:Date):Promise<Release[]>{
 if(!credential.trim())return [];
 const end=new Date(from);end.setDate(end.getDate()+30);
 const out:Release[]=[];
 const batches=await Promise.allSettled([1,2].map(page=>tmdb('tv/on_the_air',credential,{page:String(page),language:'en-US'})));
 const candidates=batches.flatMap(x=>x.status==='fulfilled'?(x.value.results||[]):[]).slice(0,28);
 const details=await Promise.allSettled(candidates.map(show=>tmdb('tv/'+show.id,credential,{})));
 for(const res of details){
  if(res.status!=='fulfilled')continue;
  const show=res.value,ep=show.next_episode_to_air;
  if(!ep?.air_date||ep.air_date<dateOnly(from)||ep.air_date>dateOnly(end))continue;
  out.push({id:'tmdb-tv-'+show.id+'-'+ep.id,category:'TV',title:show.name||'Series',
   date:ep.air_date+'T12:00:00',subtitle:ep.name||show.overview||'Upcoming episode',
   image:show.poster_path?'https://image.tmdb.org/t/p/w342'+show.poster_path:null,
   url:'https://www.themoviedb.org/tv/'+show.id,source:'TMDB · estimated date',label:'S'+ep.season_number+' E'+ep.episode_number+' · Air date, time unconfirmed',certainty:'announced'});
 }
 return out;
}
export async function getAll(key:string,region:string):Promise<{items:Release[];warnings:string[]}>{
 const now=new Date(),from=Math.floor(new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime()/1000),to=from+14*86400;
 const requests=[animeSchedule(from,to),tvSchedule(now),movieReleases(key,region,now),tmdbTV(key,region,now)];
 const results=await Promise.allSettled(requests);
 const warnings:string[]=[];
 const names=['AniList','TVmaze','TMDB movies','TMDB shows'];
 const raw=results.flatMap((r,i)=>{if(r.status==='fulfilled')return r.value;warnings.push(names[i]+': '+String(r.reason?.message||'unavailable'));return [];});
 if(!key.trim())warnings.push('Add your TMDB v3 key or API Read Access Token in Settings for movie and extra TV listings.');
 const seen=new Set<string>();
 const items=raw.filter(x=>{const identity=x.category+'|'+x.title.toLowerCase()+'|'+x.label+'|'+x.date.slice(0,10);if(seen.has(identity))return false;seen.add(identity);return true;});
 return {items:items.sort((a,b)=>a.date.localeCompare(b.date)),warnings};
}
