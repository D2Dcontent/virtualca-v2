FROM node:20-alpine

WORKDIR /app

# Install backend
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Install frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

# Copy all source
COPY backend ./backend
COPY frontend ./frontend

# Build frontend
RUN cd frontend && npm run build

# Copy frontend build to backend/public
RUN cp -r frontend/build public

# Build backend
RUN cd backend && npm run build

EXPOSE 5000

CMD ["node", "backend/dist/index.js"]
