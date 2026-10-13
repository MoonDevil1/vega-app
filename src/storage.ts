import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Preferences, Release } from './types';
const PREFIX = '@release-radar/v1/';
export const defaults: Preferences = {tmdbKey:'',region:'IN',accent:'violet',reminders:true};
export async function readJSON<T>(key: string, fallback:T): Promise<T> {
  try {const raw=await AsyncStorage.getItem(PREFIX+key); return raw ? JSON.parse(raw) as T : fallback;} catch{return fallback;}
}
export async function writeJSON(key:string,value:unknown){await AsyncStorage.setItem(PREFIX+key,JSON.stringify(value));}
export async function loadReleases(){return readJSON<{at:number;items:Release[]}>('release-cache',{at:0,items:[]});}
