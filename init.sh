#!/bin/bash

# YouTube Learning Tool - Development Environment Setup Script
# This script initializes and runs the development environment

set -e

echo "=========================================="
echo "  YouTube Learning Tool - Setup Script"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed.${NC}"
    echo "Please install Node.js v18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${YELLOW}Warning: Node.js version 18+ recommended. Current: $(node -v)${NC}"
fi

echo -e "${GREEN}Node.js version: $(node -v)${NC}"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed.${NC}"
    exit 1
fi

echo -e "${GREEN}npm version: $(npm -v)${NC}"

# Navigate to project directory (if not already there)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "Installing dependencies..."
echo "------------------------"

# Install dependencies
if [ -f "package.json" ]; then
    npm install
else
    echo -e "${YELLOW}No package.json found. Initializing new React project...${NC}"

    # Create React app with Vite (faster than CRA)
    npm create vite@latest . -- --template react-ts

    # Install additional dependencies
    npm install

    # Install project-specific dependencies
    npm install zustand react-router-dom
    npm install -D tailwindcss postcss autoprefixer

    # Initialize Tailwind
    npx tailwindcss init -p
fi

echo ""
echo -e "${GREEN}Dependencies installed successfully!${NC}"
echo ""
echo "=========================================="
echo "  Starting Development Servers"
echo "=========================================="
echo ""

# Start the transcript proxy server in the background
echo -e "${YELLOW}Starting transcript proxy server...${NC}"
node server.js &
PROXY_PID=$!
sleep 2

# Check if proxy server started successfully
if kill -0 $PROXY_PID 2>/dev/null; then
    echo -e "${GREEN}Transcript proxy server running on http://localhost:3001${NC}"
else
    echo -e "${YELLOW}Warning: Transcript proxy server failed to start. Transcripts will use fallback mode.${NC}"
fi

echo ""
echo -e "${YELLOW}Starting Vite development server...${NC}"
echo -e "${GREEN}Frontend will be available at: http://localhost:5173${NC}"
echo -e "${GREEN}Transcript API at: http://localhost:3001/api/transcript/:videoId${NC}"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Trap to cleanup background process on exit
cleanup() {
    echo ""
    echo "Shutting down servers..."
    kill $PROXY_PID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM

# Start the Vite development server (foreground)
npm run dev
