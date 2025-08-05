npm#!/bin/bash

# Fix production build issue on Linux server
# This script addresses the Rollup optional dependencies issue

echo "🔧 Fixing production build issue..."

# Step 1: Remove package-lock.json and node_modules
echo "📦 Removing package-lock.json and node_modules..."
rm -rf package-lock.json node_modules

# Step 2: Clear npm cache
echo "🧹 Clearing npm cache..."
npm cache clean --force

# Step 3: Install dependencies with legacy peer deps flag
echo "⬇️ Installing dependencies..."
npm install --legacy-peer-deps

# Step 4: Try building
echo "🔨 Building application..."
npm run build

echo "✅ Build fix completed!"
