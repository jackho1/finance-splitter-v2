#!/bin/bash

# Color codes for pretty output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Parse command line arguments
MODE="${1:-preview}"  # Default to preview mode

# Show help message
if [ "$MODE" == "--help" ] || [ "$MODE" == "-h" ]; then
    echo "Usage: $0 [MODE]"
    echo ""
    echo "Modes:"
    echo "  dev      - Start frontend in development mode (npm run dev, port 5173)"
    echo "  preview  - Start frontend in preview mode (npm run preview, port 4173) [default]"
    echo ""
    echo "Examples:"
    echo "  $0           # Uses preview mode"
    echo "  $0 dev       # Uses development mode"
    echo "  $0 preview   # Uses preview mode"
    exit 0
fi

# Validate mode
if [ "$MODE" != "dev" ] && [ "$MODE" != "preview" ]; then
    echo -e "${RED}Error: Invalid mode '$MODE'${NC}"
    echo "Use 'dev' or 'preview'. Run with --help for more information."
    exit 1
fi

# Set port and command based on mode
if [ "$MODE" == "dev" ]; then
    FRONTEND_PORT=5173
    FRONTEND_CMD="npm run dev -- --host 0.0.0.0"
    FRONTEND_MODE_NAME="Development"
else
    FRONTEND_PORT=4173
    FRONTEND_CMD="npm run preview -- --host 0.0.0.0 --port 4173"
    FRONTEND_MODE_NAME="Preview"
fi

# Get WSL IP
WSL_IP=$(hostname -I | awk '{print $1}')

# Get Windows IP (try Wi-Fi first, then Ethernet)
WINDOWS_IP=$(powershell.exe "(Get-NetIPAddress -InterfaceAlias 'Wi-Fi' -AddressFamily IPv4).IPAddress" 2>/dev/null | tr -d '\r')
if [ -z "$WINDOWS_IP" ]; then
    WINDOWS_IP=$(powershell.exe "(Get-NetIPAddress -InterfaceAlias 'Ethernet' -AddressFamily IPv4).IPAddress" 2>/dev/null | tr -d '\r')
fi

# Trap to cleanup background processes on exit
cleanup() {
    echo -e "\n${RED}Shutting down all services...${NC}"
    kill $(jobs -p) 2>/dev/null
    exit
}
trap cleanup SIGINT SIGTERM

echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}  Finance Splitter - Development Setup ${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""
echo -e "${BLUE}Network Information:${NC}"
echo -e "  WSL IP (internal):    ${YELLOW}http://$WSL_IP${NC}"
echo -e "  Windows IP (network): ${YELLOW}http://$WINDOWS_IP${NC}"
echo ""
echo -e "${GREEN}Starting services...${NC}"
echo ""

# Start Backend (Node.js API)
echo -e "${BLUE}[1/3]${NC} Starting Backend API on port 5000..."
cd backend
node index.js &
BACKEND_PID=$!
cd ..
sleep 2

# Start Mobile (Expo)
echo -e "${BLUE}[2/3]${NC} Starting Mobile App (Expo)..."
cd mobile
npx expo start &
MOBILE_PID=$!
cd ..
sleep 2

# Start Frontend (Vite)
echo -e "${BLUE}[3/3]${NC} Starting Frontend in $FRONTEND_MODE_NAME mode on port $FRONTEND_PORT..."
cd frontend
$FRONTEND_CMD &
FRONTEND_PID=$!
cd ..
sleep 3

echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}  All Services Started Successfully!   ${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""
echo -e "${GREEN}Backend API:${NC}"
echo -e "  Local:   http://localhost:5000"
echo -e "  Network: http://$WINDOWS_IP:5000"
echo ""
echo -e "${GREEN}Frontend Web App ($FRONTEND_MODE_NAME mode):${NC}"
echo -e "  Local:   http://localhost:$FRONTEND_PORT"
echo -e "  Network: http://$WINDOWS_IP:$FRONTEND_PORT"
echo -e "  ${YELLOW}📱 Use this on mobile: http://$WINDOWS_IP:$FRONTEND_PORT${NC}"
echo ""
echo -e "${GREEN}Mobile App (Expo):${NC}"
echo -e "  Check terminal output above for QR code"
echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${RED}Press Ctrl+C to stop all services${NC}"
echo -e "${BOLD}========================================${NC}"

# Wait for all background processes
wait