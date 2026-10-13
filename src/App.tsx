import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Appearance,FlatList,Image,Linking,Platform,Pressable,RefreshControl,SafeAreaView,ScrollView,StatusBar,StyleSheet,Switch,Text,TextInput,View,useWindowDimensions} from 'react-native';
import * as Notifications from 'expo-notifications';
import {getAll} from './api';
import {defaults,loadReleases,readJSON,writeJSON} from './storage';
import type {Category,Preferences,Release} from './types';
type Tab='Discover'|'Calendar'|'Saved'|'Settings';
const DARK={bg:'#0B0E1A',panel:'#171B2B',surface:'#23283C',text:'#F9F8FF',muted:'#A2A8BC',line:'#343B54'};
const LIGHT={bg:'#F6F6FB',panel:'#FFFFFF',surface:'#EDEDFC',text:'#151626',muted:'#6A7083',line:'#E3E4EE'};
const dateKey=(iso:string)=>{const d=new Date(iso);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
const human=(iso:string)=>new Date(iso).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const dayLabel=(iso:string)=>new Date(iso).toLocaleString(undefined,{month:'short',day:'numeric'});
Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:false,shouldSetBadge:false})});
export default function App(){
 const {width}=useWindowDimensions(),wide=width>=650;
 const [tab,setTab]=useState<Tab>('Discover'),[category,setCategory]=useState<'All'|Category>('All');
 const [prefs,setPrefs]=useState<Preferences>(defaults),[saved,setSaved]=useState<string[]>([]);
 const [items,setItems]=useState<Release[]>([]),[search,setSearch]=useState(''),[day,setDay]=useState<string>('');
 const [loading,setLoading]=useState(false),[updated,setUpdated]=useState(0),[warnings,setWarnings]=useState<string[]>([]);
 const [dark,setDark]=useState(Appearance.getColorScheme()!=='light');
 const p=dark?DARK:LIGHT,accent=prefs.accent==='mint'?'#50E3C2':'#A78BFA';
 const load=useCallback(async(force=false,key=prefs.tmdbKey,region=prefs.region)=>{
  const cached=await loadReleases();
  if(cached.items.length){setItems(cached.items);setUpdated(cached.at);}
  if(!force&&Date.now()-cached.at<30*60*1000&&cached.items.length)return;
  setLoading(true);
  try{const data=await getAll(key,region);setWarnings(data.warnings);
   if(data.items.length){setItems(data.items);setUpdated(Date.now());await writeJSON('release-cache',{at:Date.now(),items:data.items});}
   else if(!cached.items.length)setWarnings(w=>[...w,'No schedule data available. Pull down to retry.']);
  }catch(e){setWarnings([String(e)]);}finally{setLoading(false);}
 },[prefs.tmdbKey,prefs.region]);
 useEffect(()=>{(async()=>{const [settings,bookmarks]=await Promise.all([readJSON<Preferences>('settings',defaults),readJSON<string[]>('saved',[])]);setPrefs(settings);setSaved(bookmarks);await load(false,settings.tmdbKey,settings.region);})();},[]);
 const updatePrefs=(next:Preferences)=>{setPrefs(next);void writeJSON('settings',next);};
 const toggleSaved=(id:string)=>{const next=saved.includes(id)?saved.filter(x=>x!==id):[...saved,id];setSaved(next);void writeJSON('saved',next);};
 const remind=async(item:Release)=>{
  const seconds=Math.floor((new Date(item.date).getTime()-Date.now())/1000)-3600;
  if(seconds<1)return;
  const permission=await Notifications.requestPermissionsAsync();
  if(!permission.granted){setWarnings(['Allow notifications in Android settings to get reminders.']);return;}
  await Notifications.scheduleNotificationAsync({content:{title:'Coming up: '+item.title,body:item.label+' · starts in one hour'},trigger:{type:Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,seconds,repeats:false}});
  setWarnings(['Reminder scheduled for one hour before '+item.title+'.']);
 };
 const today=dateKey(new Date().toISOString());
 const days=useMemo(()=>Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()+i);return dateKey(d.toISOString());}),[]);
 const visible=items.filter(x=>(category==='All'||x.category===category)&&(!search||x.title.toLowerCase().includes(search.toLowerCase()))&&(tab!=='Saved'||saved.includes(x.id))&&(tab!=='Calendar'||!day||dateKey(x.date)===day));
 const grouped=visible.slice(0,250);
 const button=(label:string,active:boolean,action:()=>void)=><Pressable onPress={action} style={[s.pill,{backgroundColor:active?accent:p.surface}]}><Text style={{color:active?'#111320':p.text,fontWeight:'800',fontSize:12}}>{label}</Text></Pressable>;
 const tile=({item}:{item:Release})=><View style={[s.tile,{backgroundColor:p.panel,borderColor:p.line}]}>
  {item.image?<Image source={{uri:item.image}} style={s.poster} resizeMode="cover"/>:<View style={[s.poster,{backgroundColor:p.surface,justifyContent:'center',alignItems:'center'}]}><Text style={{color:accent,fontSize:35}}>✦</Text></View>}
  <View style={{flex:1,gap:5,minWidth:0}}>
   <Text style={{color:accent,fontSize:10,fontWeight:'900',letterSpacing:1}}>{item.category.toUpperCase()}  ·  {item.source}</Text>
   <Text numberOfLines={2} style={{color:p.text,fontWeight:'800',fontSize:16}}>{item.title}</Text>
   <Text style={{color:p.muted,fontSize:12}}>{item.label}</Text>
   <Text style={{color:p.text,fontWeight:'700',fontSize:12}}>◷ {item.category==='Movie'?dayLabel(item.date):human(item.date)}</Text>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:3}}>
    <Pressable accessibilityLabel={'Save '+item.title} onPress={()=>toggleSaved(item.id)} style={[s.small,{backgroundColor:p.surface}]}><Text style={{color:accent,fontWeight:'800'}}>{saved.includes(item.id)?'♥ Saved':'♡ Save'}</Text></Pressable>
    {item.category!=='Movie'&&prefs.reminders?<Pressable onPress={()=>{void remind(item)}} style={[s.small,{backgroundColor:p.surface}]}><Text style={{color:p.text}}>♧ Remind</Text></Pressable>:null}
    {item.url?<Pressable onPress={()=>{void Linking.openURL(item.url!)}} style={[s.small,{backgroundColor:p.surface}]}><Text style={{color:p.text}}>↗ Details</Text></Pressable>:null}
   </View>
  </View>
 </View>;
 const menu:Tab[]=['Discover','Calendar','Saved','Settings'];
 return <SafeAreaView style={{flex:1,backgroundColor:p.bg}}><StatusBar barStyle={dark?'light-content':'dark-content'}/>
  <View style={[s.header,{borderBottomColor:p.line}]}>
   <View><Text style={{color:accent,fontSize:11,fontWeight:'900',letterSpacing:3}}>YOUR NEXT OBSESSION</Text><Text style={{color:p.text,fontSize:30,fontWeight:'900',letterSpacing:-1}}>drop<Text style={{color:accent}}>day.</Text></Text></View>
   <Pressable accessibilityLabel="Toggle color theme" onPress={()=>setDark(!dark)} style={[s.theme,{backgroundColor:p.surface}]}><Text style={{color:p.text,fontSize:19}}>{dark?'☀':'☾'}</Text></Pressable>
  </View>
  <View style={{flex:1,width:'100%',maxWidth:900,alignSelf:'center'}}>
   {tab==='Settings'?<ScrollView contentContainerStyle={{padding:18,gap:16}}>
    <Text style={{fontSize:25,fontWeight:'900',color:p.text}}>Make it yours ✨</Text>
    <View style={[s.setting,{backgroundColor:p.panel}]}><Text style={{color:p.text,fontWeight:'800'}}>TMDB API key (for movies)</Text><Text style={{color:p.muted,fontSize:12,marginVertical:6}}>Get a free API key at themoviedb.org. Stored locally on this device. Movie dates are not proof of OTT availability.</Text><TextInput value={prefs.tmdbKey} onChangeText={v=>updatePrefs({...prefs,tmdbKey:v})} placeholder="Paste your TMDB v3 API key" placeholderTextColor={p.muted} autoCapitalize="none" secureTextEntry style={[s.input,{color:p.text,backgroundColor:p.surface}]}/></View>
    <View style={[s.setting,{backgroundColor:p.panel}]}><Text style={{color:p.text,fontWeight:'800'}}>Movie region</Text><View style={{flexDirection:'row',gap:8,marginTop:10}}>{['IN','US','GB'].map(r=><React.Fragment key={r}>{button(r,prefs.region===r,()=>updatePrefs({...prefs,region:r}))}</React.Fragment>)}</View></View>
    <View style={[s.setting,{backgroundColor:p.panel,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}]}><Text style={{color:p.text,fontWeight:'800'}}>Reminder buttons</Text><Switch value={prefs.reminders} onValueChange={v=>updatePrefs({...prefs,reminders:v})}/></View>
    <View style={[s.setting,{backgroundColor:p.panel}]}><Text style={{color:p.text,fontWeight:'800'}}>Accent</Text><View style={{flexDirection:'row',gap:8,marginTop:10}}>{button('💜 Violet',prefs.accent==='violet',()=>updatePrefs({...prefs,accent:'violet'}))}{button('🌿 Mint',prefs.accent==='mint',()=>updatePrefs({...prefs,accent:'mint'}))}</View></View>
    <Pressable onPress={()=>{void load(true)}} style={[s.action,{backgroundColor:accent}]}><Text style={{color:'#101021',fontWeight:'900'}}>Refresh live schedule</Text></Pressable>
    <Text style={{color:p.muted,lineHeight:20,fontSize:12}}>Anime: AniList public airing schedules. TV: TVmaze US broadcast schedule. Movies: TMDB release-date metadata (key required). Times display in your device timezone. OTT platform premiere dates must be verified separately; this app never invents them. Cached schedules stay visible offline. Data providers may have gaps.</Text>
   </ScrollView>:<>
    <FlatList data={grouped} keyExtractor={x=>x.id} renderItem={tile} numColumns={wide?2:1} columnWrapperStyle={wide?{gap:12}:undefined}
     contentContainerStyle={{padding:16,paddingBottom:28,gap:12}}
     refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>{void load(true)}} tintColor={accent}/>}
     ListHeaderComponent={<View style={{gap:14,marginBottom:7}}>
      <View style={[s.hero,{backgroundColor:p.panel}]}><Text style={{color:accent,fontSize:12,fontWeight:'900'}}>DON'T MISS THE DROP ↗</Text><Text style={{color:p.text,fontSize:24,fontWeight:'900',marginTop:6}}>{tab==='Saved'?'Your watchlist ♥':tab==='Calendar'?'The next 14 days':'What’s dropping next?'}</Text><Text style={{color:p.muted,fontSize:12,marginTop:7}}>Anime · Shows · Movie releases  •  Your local timezone</Text></View>
      <TextInput value={search} onChangeText={setSearch} placeholder="Search titles..." placeholderTextColor={p.muted} style={[s.input,{backgroundColor:p.panel,color:p.text}]}/>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{(['All','Anime','TV','Movie'] as const).map(c=><React.Fragment key={c}>{button(c,category===c,()=>setCategory(c))}</React.Fragment>)}</ScrollView>
      {tab==='Calendar'?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7}}>{button('Any day',!day,()=>setDay(''))}{days.map(d=><React.Fragment key={d}>{button(d===today?'Today':dayLabel(d+'T12:00:00'),day===d,()=>setDay(d))}</React.Fragment>)}</ScrollView>:null}
      {updated>0?<Text style={{color:p.muted,fontSize:11}}>Updated {new Date(updated).toLocaleTimeString()} · Pull to refresh {loading?'· Syncing…':''}</Text>:null}
      {warnings.length?<Text style={{color:p.muted,fontSize:11}}>{warnings.join('  •  ')}</Text>:null}
      <Text style={{color:p.text,fontSize:16,fontWeight:'900'}}>{grouped.length} upcoming drops</Text>
     </View>}
     ListEmptyComponent={<View style={{alignItems:'center',padding:30,gap:10}}>{loading?<ActivityIndicator color={accent}/>:<Text style={{fontSize:37}}>☁️</Text>}<Text style={{color:p.muted,textAlign:'center'}}>Nothing here yet. Change the filter or pull down to refresh.</Text></View>}
    />
   </>}
  </View>
  <View style={[s.nav,{backgroundColor:p.panel,borderTopColor:p.line}]}>{menu.map(t=><Pressable key={t} onPress={()=>setTab(t)} style={s.navItem}><Text style={{fontSize:20,color:tab===t?accent:p.muted}}>{t==='Discover'?'⌂':t==='Calendar'?'▦':t==='Saved'?'♡':'⚙'}</Text><Text style={{fontSize:10,fontWeight:'800',color:tab===t?accent:p.muted}}>{t}</Text></Pressable>)}</View>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 header:{paddingHorizontal:20,paddingTop:Platform.OS==='android'?38:14,paddingBottom:15,borderBottomWidth:1,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
 theme:{width:42,height:42,borderRadius:14,justifyContent:'center',alignItems:'center'},
 hero:{padding:19,borderRadius:24},input:{paddingHorizontal:16,paddingVertical:14,borderRadius:16,fontSize:14},
 pill:{paddingVertical:10,paddingHorizontal:17,borderRadius:100},
 tile:{flex:1,borderWidth:1,borderRadius:20,padding:11,flexDirection:'row',gap:12,minWidth:0},
 poster:{width:90,height:132,borderRadius:13},small:{paddingVertical:7,paddingHorizontal:11,borderRadius:9},
 nav:{flexDirection:'row',borderTopWidth:1,paddingVertical:9,paddingBottom:Platform.OS==='android'?14:8},
 navItem:{flex:1,alignItems:'center',gap:3},setting:{padding:16,borderRadius:18},action:{borderRadius:16,padding:17,alignItems:'center'}
});
