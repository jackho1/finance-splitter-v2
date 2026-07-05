# Frontend image: Vite dev server for the React web app.
FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5173

# --host exposes the dev server outside the container so it is reachable on the
# mapped port from the host machine.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
