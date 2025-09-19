#!/usr/bin/env zx

// 🚀 NOFX Developer Superpower Tools Setup
// This script sets up all the amazing tools for maximum development fun

import { $ } from 'zx'

console.log('🚀 Setting up NOFX Developer Superpower Tools...\n')

// 🎬 Changesets - Professional Release Management
console.log('🎬 Setting up Changesets for professional releases...')
try {
  await $`npx changeset init`
  console.log('✅ Changesets initialized!')
} catch (error) {
  console.log('ℹ️  Changesets already initialized')
}

// 🔄 Lefthook - Lightning Fast Git Hooks
console.log('\n🔄 Installing Lefthook git hooks...')
try {
  await $`npx lefthook install`
  console.log('✅ Lefthook hooks installed!')
} catch (error) {
  console.log('⚠️  Lefthook installation failed:', error.message)
}

// 🎭 MSW - API Mocking Magic
console.log('\n🎭 Setting up MSW for API mocking...')
try {
  // Create public directory if it doesn't exist
  await $`mkdir -p public`
  await $`npx msw init public --save`
  console.log('✅ MSW service worker ready!')
} catch (error) {
  console.log('⚠️  MSW setup failed:', error.message)
}

// 📊 Create demo directories
console.log('\n📊 Setting up demo directories...')
await $`mkdir -p demos/architecture`
await $`mkdir -p demos/performance`
await $`mkdir -p demos/security`

// 🎯 Create Storybook config if frontend exists
console.log('\n🎯 Checking for frontend Storybook setup...')
try {
  if (await $`test -d apps/frontend`.exitCode === 0) {
    console.log('📚 Frontend detected - Storybook ready for setup!')
    console.log('   Run: cd apps/frontend && npx storybook@latest init')
  }
} catch (error) {
  console.log('ℹ️  No frontend directory found')
}

// 🏰 Fortress Status Check
console.log('\n🏰 Running fortress status check...')
try {
  await $`npm run fortress:demo`
} catch (error) {
  console.log('ℹ️  Fortress demo will be available after first build')
}

console.log('\n🎉 DEVELOPER SUPERPOWER TOOLS ACTIVATED!')
console.log('🚀 Your development experience is now 10x more addictive!')

console.log('\n📋 Quick Commands You Can Try:')
console.log('   npm run fortress:build     # 🏰 Build the unbreakable fortress')
console.log('   npm run analyze:all        # 📊 Visualize your architecture')
console.log('   npm run changeset          # 🎬 Create a professional release')
console.log('   npm run size:analyze       # 📏 Optimize bundle sizes')
console.log('   npm run mock:start         # 🎭 Start API mocking')
console.log('   npm run storybook          # 📚 Component playground')

console.log('\n🎯 Pro Tip: Run "npm run fortress:demo" to see all your tools in action!')