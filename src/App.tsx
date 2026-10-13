import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,FlatList,Image,Linking,Modal,Platform,Pressable,RefreshControl,SafeAreaView,ScrollView,Share,StatusBar,StyleSheet,Switch,Text,TextInput,View,useWindowDimensions} from 'react-native';
import * as Notifications from 'expo-notifications';
import {getAll} from './api';
import {checkAndDownloadUpdate,otaConfigured,restartWithUpdate,type UpdateState} from './updater';
import {defaults,loadReleases,readJSON,writeJSON} from './storage';
import type {Category,Preferences,Release} from './types';
type Tab='Discover'|'Calendar'|'Saved'|'Settings';
const DARK={bg:'#0D061B',panel:'#1B1032',surface:'#291747',text:'#F8F3FF',muted:'#BAA7D1',line:'#49306B'};
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
 const [dark,setDark]=useState(true);
 const [selected,setSelected]=useState<Release|null>(null);
 const [updateState,setUpdateState]=useState<UpdateState>('disabled');
 const p=dark?DARK:LIGHT,accent=prefs.accent==='mint'?'#50E3C2':'#B66AFF';
 const load=useCallback(async(force=false,key=prefs.tmdbKey,region=prefs.region)=>{
  const cached=await loadReleases();
  if(cached.items.length&&!force){setItems(cached.items);setUpdated(cached.at);}
  if(!force&&Date.now()-cached.at<30*60*1000&&cached.items.length&&cached.items.some(x=>x.category==='Movie')===!!key.trim())return;
  setLoading(true);
  try{const data=await getAll(key,region);setWarnings(data.warnings);
   if(data.items.length){setItems(data.items);setUpdated(Date.now());await writeJSON('release-cache',{at:Date.now(),items:data.items});}
   else if(!cached.items.length)setWarnings(w=>[...w,'No schedule data available. Pull down to retry.']);
  }catch(e){setWarnings([String(e)]);}finally{setLoading(false);}
 },[prefs.tmdbKey,prefs.region]);
 useEffect(()=>{(async()=>{const [settings,bookmarks]=await Promise.all([readJSON<Preferences>('settings',defaults),readJSON<string[]>('saved',[])]);setPrefs(settings);setSaved(bookmarks);await load(false,settings.tmdbKey,settings.region);})();},[]);
 const checkUpdates=useCallback(async()=>{setUpdateState('checking');setUpdateState(await checkAndDownloadUpdate());},[]);
 useEffect(()=>{if(otaConfigured)void checkUpdates();},[checkUpdates]);
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
 const grouped=visible.slice(0,500);
 const now=Date.now(),todayDrops=grouped.filter(x=>dateKey(x.date)===today);
 const weekDrops=grouped.filter(x=>new Date(x.date).getTime()>=now-86400000&&new Date(x.date).getTime()<now+7*86400000);
 const movieDrops=grouped.filter(x=>x.category==='Movie');
 const savedDrops=items.filter(x=>saved.includes(x.id));
 const countdown=(item:Release)=>{if(item.certainty!=='scheduled')return 'Date announced · time unconfirmed';const delta=new Date(item.date).getTime()-Date.now();if(delta<=0)return 'Aired';const hours=Math.floor(delta/3600000);return hours<24?'Drops in '+hours+'h '+Math.floor(delta%3600000/60000)+'m':'Drops in '+Math.floor(hours/24)+' days';};
 const featured=weekDrops.find(x=>x.certainty==='scheduled')||weekDrops[0]||grouped[0];
 const openDetails=(item:Release)=>setSelected(item);
 const shareRelease=async(item:Release)=>{try{await Share.share({message:[item.title,item.label,item.certainty==='scheduled'?human(item.date):dayLabel(item.date)+' (time not confirmed)',item.url||''].filter(Boolean).join('\n')});}catch{setWarnings(['Sharing is unavailable on this device.']);}};
 const compact=(item:Release)=><Pressable key={item.id} onPress={()=>openDetails(item)} style={[s.compact,{backgroundColor:p.panel,borderColor:p.line}]}>
   {item.image?<Image source={{uri:item.image}} style={s.compactImage}/>:<View style={[s.compactImage,{backgroundColor:p.surface,alignItems:'center',justifyContent:'center'}]}><Text style={{fontSize:34,color:accent}}>◈</Text></View>}
   <Text numberOfLines={2} style={{color:p.text,fontWeight:'800',marginTop:7}}>{item.title}</Text>
   <Text numberOfLines={1} style={{color:accent,fontSize:11,fontWeight:'700'}}>{item.category} · {item.label}</Text>
   <Text style={{color:p.muted,fontSize:11}}>{dayLabel(item.date)}</Text>
 </Pressable>;
 const shelf=(heading:string,data:Release[],fallback:string)=><View style={{gap:12}}>
   <Text style={{color:p.text,fontWeight:'900',fontSize:19}}>{heading}</Text>
   {data.length?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:12}}>{data.slice(0,12).map(compact)}</ScrollView>:<Text style={{color:p.muted,fontSize:12}}>{fallback}</Text>}
 </View>;
 const button=(label:string,active:boolean,action:()=>void)=><Pressable onPress={action} style={[s.pill,{backgroundColor:active?accent:p.surface}]}><Text style={{color:active?'#111320':p.text,fontWeight:'800',fontSize:12}}>{label}</Text></Pressable>;
 const tile=({item}:{item:Release})=><View style={[s.tile,{backgroundColor:p.panel,borderColor:p.line}]}>
  {item.image?<Image source={{uri:item.image}} style={s.poster} resizeMode="cover"/>:<View style={[s.poster,{backgroundColor:p.surface,justifyContent:'center',alignItems:'center'}]}><Text style={{color:accent,fontSize:35}}>✦</Text></View>}
  <View style={{flex:1,gap:5,minWidth:0}}>
   <Text style={{color:accent,fontSize:10,fontWeight:'900',letterSpacing:1}}>{item.category.toUpperCase()}  ·  {item.source}</Text>
   <Text numberOfLines={2} style={{color:p.text,fontWeight:'800',fontSize:16}}>{item.title}</Text>
   <Text style={{color:p.muted,fontSize:12}}>{item.label}</Text>
   <Text style={{color:p.text,fontWeight:'700',fontSize:12}}>◷ {item.certainty==='announced'?dayLabel(item.date):human(item.date)}</Text>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:3}}>
    <Pressable accessibilityLabel={'Save '+item.title} onPress={()=>toggleSaved(item.id)} style={[s.small,{backgroundColor:p.surface}]}><Text style={{color:accent,fontWeight:'800'}}>{saved.includes(item.id)?'♥ Saved':'♡ Save'}</Text></Pressable>
    {item.category!=='Movie'&&prefs.reminders?<Pressable onPress={()=>{void remind(item)}} style={[s.small,{backgroundColor:p.surface}]}><Text style={{color:p.text}}>♧ Remind</Text></Pressable>:null}
    <Pressable onPress={()=>openDetails(item)} style={[s.small,{backgroundColor:accent}]}><Text style={{color:'#140622',fontWeight:'800'}}>View drop</Text></Pressable>
    {item.url?<Pressable onPress={()=>{void Linking.openURL(item.url!)}} style={[s.small,{backgroundColor:p.surface}]}><Text style={{color:p.text}}>↗ Details</Text></Pressable>:null}
   </View>
  </View>
 </View>;
 const menu:Tab[]=['Discover','Calendar','Saved','Settings'];
 return <SafeAreaView style={{flex:1,backgroundColor:p.bg}}><StatusBar barStyle={dark?'light-content':'dark-content'}/>
  <View style={[s.header,{borderBottomColor:p.line}]}>
   <View><Text style={{color:accent,fontSize:11,fontWeight:'900',letterSpacing:3}}>⚡ LIVE DROP RADAR</Text><Text style={{color:p.text,fontSize:30,fontWeight:'900',letterSpacing:-1}}>Drop<Text style={{color:accent}}>Day</Text></Text></View>
   <Pressable accessibilityLabel="Toggle color theme" onPress={()=>setDark(!dark)} style={[s.theme,{backgroundColor:p.surface}]}><Text style={{color:p.text,fontSize:19}}>{dark?'☀':'☾'}</Text></Pressable>
  </View>
  <View style={{flex:1,width:'100%',maxWidth:900,alignSelf:'center'}}>
   {tab==='Discover'?<ScrollView contentContainerStyle={{padding:16,gap:22,paddingBottom:35}}>
     <Text style={{color:p.text,fontSize:24,fontWeight:'900'}}>What's dropping next? ⚡</Text>
     <TextInput value={search} onChangeText={setSearch} placeholder="Search anime, shows or movies..." placeholderTextColor={p.muted} style={[s.input,{backgroundColor:p.panel,color:p.text}]}/>
     <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{(['All','Anime','TV','Movie'] as const).map(x=><React.Fragment key={x}>{button(x==='TV'?'Shows':x==='Movie'?'Movies':x,category===x,()=>setCategory(x))}</React.Fragment>)}</ScrollView>
     {featured?<Pressable onPress={()=>openDetails(featured)} style={[s.hero,{backgroundColor:p.panel,borderColor:accent,borderWidth:1,gap:8}]}>
        <Text style={{color:accent,fontSize:12,fontWeight:'900'}}>✦ FEATURED DROP</Text>
        <Text style={{color:p.text,fontSize:24,fontWeight:'900'}}>{featured.title}</Text>
        <Text style={{color:p.muted}}>{featured.category} · {featured.label}</Text>
        <Text style={{color:accent,fontWeight:'800'}}>{countdown(featured)}</Text>
        <Text style={{color:p.text,fontSize:12}}>View details  ↗</Text>
      </Pressable>:null}
     {updated?<Text style={{color:p.muted,fontSize:11}}>Updated {new Date(updated).toLocaleTimeString()} · Schedules refresh every 30 min</Text>:null}
     {loading?<ActivityIndicator color={accent}/>:null}
     {warnings.length?<Text style={{color:p.muted,fontSize:12}}>{warnings.join(' · ')}</Text>:null}
     {shelf('🔥 Upcoming Today',todayDrops,'No confirmed drops today. Pull to refresh, or try another category.')}
     {shelf('📆 This Week',weekDrops,'No scheduled releases found. If you're offline, cached data remains available.')}
     {category==='All'||category==='Movie'?shelf('🎬 Movie Drops',movieDrops,'Add your TMDB credential in Settings to load movies.'):null}
     {shelf('♡ Your Watchlist',savedDrops,'Save a title to find it here.')}
     <Pressable style={[s.action,{backgroundColor:accent}]} onPress={()=>{void load(true)}}><Text style={{color:'#140622',fontWeight:'900'}}>↻ Refresh releases</Text></Pressable>
    </ScrollView>:tab==='Settings'?<ScrollView contentContainerStyle={{padding:18,gap:16}}>
    <Text style={{fontSize:25,fontWeight:'900',color:p.text}}>Make it yours ✨</Text>
    <View style={[s.setting,{backgroundColor:p.panel}]}><Text style={{color:p.text,fontWeight:'800'}}>TMDB credential (movies + more shows)</Text><Text style={{color:p.muted,fontSize:12,marginVertical:6}}>Paste either a v3 API key or API Read Access Token (Bearer token). Stored on this device only. Tap Refresh after saving. Digital release does not confirm a particular OTT service.</Text><TextInput value={prefs.tmdbKey} onChangeText={v=>updatePrefs({...prefs,tmdbKey:v})} placeholder="TMDB v3 key or API Read Access Token" placeholderTextColor={p.muted} autoCapitalize="none" secureTextEntry style={[s.input,{color:p.text,backgroundColor:p.surface}]}/></View>
    <View style={[s.setting,{backgroundColor:p.panel}]}><Text style={{color:p.text,fontWeight:'800'}}>Release region</Text><View style={{flexDirection:'row',gap:8,marginTop:10}}>{['IN','US','GB'].map(r=><React.Fragment key={r}>{button(r,prefs.region===r,()=>updatePrefs({...prefs,region:r}))}</React.Fragment>)}</View></View>
    <View style={[s.setting,{backgroundColor:p.panel,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}]}><Text style={{color:p.text,fontWeight:'800'}}>Reminder buttons</Text><Switch value={prefs.reminders} onValueChange={v=>updatePrefs({...prefs,reminders:v})}/></View>
    <View style={[s.setting,{backgroundColor:p.panel}]}><Text style={{color:p.text,fontWeight:'800'}}>Accent</Text><View style={{flexDirection:'row',gap:8,marginTop:10}}>{button('💜 Violet',prefs.accent==='violet',()=>updatePrefs({...prefs,accent:'violet'}))}{button('🌿 Mint',prefs.accent==='mint',()=>updatePrefs({...prefs,accent:'mint'}))}</View></View>
    <View style={[s.setting,{backgroundColor:p.panel,gap:10}]}>
      <Text style={{color:p.text,fontWeight:'900',fontSize:17}}>App updates</Text>
      <Text style={{color:p.muted,fontSize:12,lineHeight:19}}>{updateState==='disabled'?'Automatic over-the-air updates need a configured Expo update service in the APK.':updateState==='checking'?'Checking for an update…':updateState==='downloaded'?'New app update downloaded. Restart to apply it.':updateState==='current'?'You have the latest available app update.':'Could not check for updates. Try again online.'}</Text>
      {updateState==='downloaded'?<Pressable onPress={()=>{void restartWithUpdate()}} style={[s.action,{backgroundColor:accent}]}><Text style={{color:'#170B22',fontWeight:'900'}}>Restart and update</Text></Pressable>:<Pressable disabled={updateState==='checking'||!otaConfigured} onPress={()=>{void checkUpdates()}} style={[s.action,{backgroundColor:otaConfigured?accent:p.surface}]}><Text style={{color:otaConfigured?'#170B22':p.muted,fontWeight:'900'}}>Check for updates</Text></Pressable>}
      <Text style={{color:p.muted,fontSize:11}}>JavaScript and styling updates can install without another APK. Changes to native Android code still need a new APK.</Text>
    </View>
    <Pressable onPress={()=>{void load(true)}} style={[s.action,{backgroundColor:accent}]}><Text style={{color:'#101021',fontWeight:'900'}}>Refresh live schedule</Text></Pressable>
    <Text style={{color:p.muted,lineHeight:20,fontSize:12}}>Anime: AniList public airing schedules. TV: TVmaze US broadcast plus TMDB upcoming episodes. Movies: TMDB digital and theatrical dates (key required). Times display in your device timezone. OTT platform premiere dates must be verified separately; this app never invents them. Cached schedules stay visible offline. Data providers may have gaps.</Text>
   </ScrollView>:<>
    <FlatList data={grouped} keyExtractor={x=>x.id} renderItem={tile} numColumns={wide?2:1} columnWrapperStyle={wide?{gap:12}:undefined}
     contentContainerStyle={{padding:16,paddingBottom:28,gap:12}}
     refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>{void load(true)}} tintColor={accent}/>}
     ListHeaderComponent={<View style={{gap:14,marginBottom:7}}>
      <View style={[s.hero,{backgroundColor:p.panel}]}><Text style={{color:accent,fontSize:12,fontWeight:'900'}}>DON'T MISS THE DROP ↗</Text><Text style={{color:p.text,fontSize:24,fontWeight:'900',marginTop:6}}>{tab==='Saved'?'Your watchlist ♥':tab==='Calendar'?'The next 14 days':'What’s dropping next?'}</Text><Text style={{color:p.muted,fontSize:12,marginTop:7}}>Anime · Series · Digital & theatrical movies</Text></View>
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
  <Modal visible={selected!==null} transparent animationType="slide" onRequestClose={()=>setSelected(null)}>
    <View style={{flex:1,backgroundColor:'rgba(7,2,17,0.94)',paddingTop:52}}>
      <ScrollView contentContainerStyle={{padding:20,gap:16}}>
       <Pressable accessibilityLabel="Close details" onPress={()=>setSelected(null)}><Text style={{color:accent,fontWeight:'900',fontSize:17}}>‹ Back to drops</Text></Pressable>
       {selected?.image?<Image source={{uri:selected.image}} resizeMode="contain" style={{width:'100%',height:260,borderRadius:22}}/>:null}
       <Text style={{color:accent,fontWeight:'900',letterSpacing:1}}>{selected?.category?.toUpperCase()} · {selected?.source}</Text>
       <Text style={{color:'#FFFFFF',fontWeight:'900',fontSize:27}}>{selected?.title}</Text>
       <Text style={{color:'#E0AAFF',fontWeight:'800',fontSize:16}}>{selected?.label}</Text>
       <Text style={{color:'#FFFFFF',fontWeight:'700'}}>📆 {selected?(selected.certainty==='scheduled'?human(selected.date):dayLabel(selected.date)+' · Exact time unconfirmed'):''}</Text>
       <Text style={{color:p.muted,fontSize:14,lineHeight:23}}>{selected?.subtitle}</Text>
       <Text style={{color:p.muted,fontSize:12}}>Release-tracking information only. Availability on streaming platforms may differ by region.</Text>
       {selected?<Pressable style={[s.action,{backgroundColor:accent}]} onPress={()=>toggleSaved(selected.id)}><Text style={{color:'#140622',fontWeight:'900'}}>{saved.includes(selected.id)?'♥ Remove from saved':'♡ Add to watchlist'}</Text></Pressable>:null}
       {selected?<Pressable style={[s.action,{backgroundColor:p.surface}]} onPress={()=>{void shareRelease(selected)}}><Text style={{color:p.text,textAlign:'center',fontWeight:'800'}}>↗ Share release details</Text></Pressable>:null}
       {selected?.url?<Pressable style={[s.action,{backgroundColor:p.surface}]} onPress={()=>{void Linking.openURL(selected.url!)}}><Text style={{color:p.text,textAlign:'center',fontWeight:'800'}}>↗ Open source details</Text></Pressable>:null}
      </ScrollView>
    </View>
   </Modal>
  <View style={[s.nav,{backgroundColor:p.panel,borderTopColor:p.line}]}>{menu.map(t=><Pressable key={t} onPress={()=>setTab(t)} style={s.navItem}><Text style={{fontSize:20,color:tab===t?accent:p.muted}}>{t==='Discover'?'⌂':t==='Calendar'?'▦':t==='Saved'?'♡':'⚙'}</Text><Text style={{fontSize:10,fontWeight:'800',color:tab===t?accent:p.muted}}>{t}</Text></Pressable>)}</View>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 header:{paddingHorizontal:20,paddingTop:Platform.OS==='android'?38:14,paddingBottom:15,borderBottomWidth:1,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
 theme:{width:42,height:42,borderRadius:14,justifyContent:'center',alignItems:'center'},
 hero:{padding:19,borderRadius:24},compact:{width:154,borderRadius:18,borderWidth:1,padding:9},compactImage:{width:136,height:170,borderRadius:12},input:{paddingHorizontal:16,paddingVertical:14,borderRadius:16,fontSize:14},
 pill:{paddingVertical:10,paddingHorizontal:17,borderRadius:100},
 tile:{flex:1,borderWidth:1,borderRadius:20,padding:11,flexDirection:'row',gap:12,minWidth:0},
 poster:{width:90,height:132,borderRadius:13},small:{paddingVertical:7,paddingHorizontal:11,borderRadius:9},
 nav:{flexDirection:'row',borderTopWidth:1,paddingVertical:9,paddingBottom:Platform.OS==='android'?14:8},
 navItem:{flex:1,alignItems:'center',gap:3},setting:{padding:16,borderRadius:18},action:{borderRadius:16,padding:17,alignItems:'center'}
});
