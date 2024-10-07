# Use a lightweight version of Node.js
FROM node:16-alpine

# Set the working directory
WORKDIR /app

# Copy the package.json and package-lock.json from the backend folder
COPY backend/package*.json ./backend/

# Install backend dependencies
RUN npm install --only=production --prefix ./backend

# Copy the backend code
COPY backend ./backend

# Copy frontend files into the appropriate directory
COPY frontend ./frontend

# Expose the port your app runs on
EXPOSE 2000

# Start the application
CMD ["node", "./backend/server.js"]  
# Change to your entry point
