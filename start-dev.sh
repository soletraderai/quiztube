#!/bin/bash

# QuizTube Development Server Startup Script
# Starts all required services: Redis, Backend API, and Frontend

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   QuizTube Development Environment    ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to check if a port is in use
check_port() {
    lsof -i :"$1" >/dev/null 2>&1
}

# Function to kill process on port
kill_port() {
    local port=$1
    local pid=$(lsof -t -i :"$port" 2>/dev/null)
    if [ -n "$pid" ]; then
        echo -e "${YELLOW}Killing existing process on port $port (PID: $pid)${NC}"
        kill -9 $pid 2>/dev/null || true
        sleep 1
    fi
}

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down all services...${NC}"

    # Kill background jobs
    jobs -p | xargs -r kill 2>/dev/null || true

    # Kill processes on our ports
    for port in 3001 5173 5174 5175; do
        kill_port $port
    done

    echo -e "${GREEN}All services stopped.${NC}"
    exit 0
}

# Set up trap to cleanup on exit
trap cleanup SIGINT SIGTERM

# 1. Start Redis if not running
echo -e "${BLUE}[1/3] Checking Redis...${NC}"
if ! pgrep -x redis-server > /dev/null; then
    echo -e "${YELLOW}Starting Redis...${NC}"
    redis-server --daemonize yes
    sleep 1
fi
if pgrep -x redis-server > /dev/null; then
    echo -e "${GREEN}✓ Redis is running${NC}"
else
    echo -e "${RED}✗ Failed to start Redis${NC}"
    exit 1
fi

# 2. Start Backend API (port 3001)
echo ""
echo -e "${BLUE}[2/3] Starting Backend API (port 3001)...${NC}"
if check_port 3001; then
    echo -e "${YELLOW}Port 3001 already in use, restarting...${NC}"
    kill_port 3001
fi
cd "$SCRIPT_DIR/api"
npm run dev > /tmp/quiztube-api.log 2>&1 &
API_PID=$!
cd "$SCRIPT_DIR"

# Wait for API to be ready
echo -n "Waiting for API..."
for i in {1..30}; do
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        echo ""
        echo -e "${GREEN}✓ Backend API running on http://localhost:3001${NC}"
        break
    fi
    echo -n "."
    sleep 1
done
if ! curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo ""
    echo -e "${RED}✗ Backend API failed to start. Check /tmp/quiztube-api.log${NC}"
    cat /tmp/quiztube-api.log | tail -20
    exit 1
fi

# 3. Start Frontend (Vite)
echo ""
echo -e "${BLUE}[3/3] Starting Frontend (Vite)...${NC}"
# Vite will auto-select an available port (5173, 5174, etc.)
npm run dev > /tmp/quiztube-frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for frontend and detect the port
echo -n "Waiting for Frontend..."
FRONTEND_PORT=""
for i in {1..20}; do
    for port in 5173 5174 5175 5176 5177; do
        if curl -s "http://localhost:$port" > /dev/null 2>&1; then
            FRONTEND_PORT=$port
            break 2
        fi
    done
    echo -n "."
    sleep 1
done

if [ -n "$FRONTEND_PORT" ]; then
    echo ""
    echo -e "${GREEN}✓ Frontend running on http://localhost:$FRONTEND_PORT${NC}"
else
    echo ""
    echo -e "${RED}✗ Frontend failed to start. Check /tmp/quiztube-frontend.log${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}All services started successfully!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "  ${GREEN}Frontend:${NC}    http://localhost:${FRONTEND_PORT:-5173}"
echo -e "  ${GREEN}Backend API:${NC} http://localhost:3001"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Keep script running and show logs
tail -f /tmp/quiztube-api.log /tmp/quiztube-frontend.log 2>/dev/null
