# Use a lightweight version of Node.js
FROM node:16-alpine

# Set the working directory
WORKDIR /app

# Copy the package.json and package-lock.json from the backend folder
COPY backend/package*.json ./backend/

# Install backend dependencies
RUN cd ./backend && npm install --only=production

# Copy the backend code
COPY backend ./backend

# Copy frontend files into the appropriate directory
COPY frontend ./frontend

# Expose the port your app runs on (internally)
EXPOSE 2000

# Start the application
CMD ["node", "./backend/server.js"]
