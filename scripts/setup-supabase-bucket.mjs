#!/usr/bin/env zx
import 'zx/globals'
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || 'artifacts';

if (!URL || !KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log('Supabase URL:', URL);
console.log('Bucket name:', BUCKET);

const supabase = createClient(URL, KEY);

// List existing buckets
console.log('\nListing existing buckets...');
const { data: buckets, error: listError } = await supabase.storage.listBuckets();

if (listError) {
  console.error('Error listing buckets:', listError);
  process.exit(1);
}

console.log('Existing buckets:', buckets.map(b => b.name).join(', ') || 'none');

// Check if bucket exists
const bucketExists = buckets.some(b => b.name === BUCKET);

if (bucketExists) {
  console.log(`\n✅ Bucket "${BUCKET}" already exists`);
} else {
  console.log(`\n📦 Creating bucket "${BUCKET}"...`);

  const { data, error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 10485760, // 10MB
    allowedMimeTypes: ['text/*', 'application/json', 'application/octet-stream']
  });

  if (error) {
    console.error('❌ Error creating bucket:', error);
    process.exit(1);
  }

  console.log('✅ Bucket created successfully');
}

// Test upload
console.log('\n🧪 Testing upload...');
const testPath = `test/${Date.now()}.txt`;
const testContent = 'Test artifact content';

const { error: uploadError } = await supabase.storage
  .from(BUCKET)
  .upload(testPath, Buffer.from(testContent), {
    upsert: true,
    contentType: 'text/plain'
  });

if (uploadError) {
  console.error('❌ Upload failed:', uploadError);
  process.exit(1);
}

console.log('✅ Upload successful');

// Test download
console.log('\n📥 Testing download...');
const { data: downloadData, error: downloadError } = await supabase.storage
  .from(BUCKET)
  .download(testPath);

if (downloadError) {
  console.error('❌ Download failed:', downloadError);
  process.exit(1);
}

const content = await downloadData.text();
console.log('✅ Download successful');
console.log('Content matches:', content === testContent);

console.log('\n✨ Supabase Storage is configured correctly!');
