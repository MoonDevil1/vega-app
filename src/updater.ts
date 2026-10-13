import * as Updates from 'expo-updates';
export type UpdateState = 'disabled' | 'checking' | 'current' | 'downloaded' | 'error';
export const otaConfigured = Updates.isEnabled;
export async function checkAndDownloadUpdate():Promise<UpdateState>{
 if(!Updates.isEnabled)return 'disabled';
 try {
  const check=await Updates.checkForUpdateAsync();
  if(!check.isAvailable)return 'current';
  await Updates.fetchUpdateAsync();
  return 'downloaded';
 }catch{return 'error';}
}
export async function restartWithUpdate(){if(Updates.isEnabled)await Updates.reloadAsync();}
