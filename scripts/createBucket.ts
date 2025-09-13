import dotenv from "dotenv";
dotenv.config();
import { supabase, ARTIFACT_BUCKET } from "../src/lib/supabase";

async function main() {
  // Create if missing
  const { data: buckets, error: listErr } = await (supabase as any).storage.listBuckets();
  if (listErr) throw listErr;
  if (!buckets.find((b: any) => b.name === ARTIFACT_BUCKET)) {
    const { error } = await (supabase as any).storage.createBucket(ARTIFACT_BUCKET, { public: false });
    if (error) throw error;
    console.log("Created bucket:", ARTIFACT_BUCKET);
  } else {
    console.log("Bucket exists:", ARTIFACT_BUCKET);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
