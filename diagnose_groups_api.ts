import { storage } from './server/storage';

async function diagnose() {
  const groups = await storage.getVendorGroups();
  console.log("Groups in API response:", JSON.stringify(groups, null, 2));
}

diagnose().catch(console.error);
