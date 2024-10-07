# Use a lightweight version of Node.js
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy the package.json and package-lock.json from the backend folder
COPY package*.json ./

# Install backend dependencies
RUN npm install --legacy-peer-deps

# Copy the backend code
COPY backend ./backend

# Copy frontend files into the appropriate directory
COPY frontend ./frontend

# Expose the port your app runs on
EXPOSE 2000

# Start the app
CMD ["npm", "start"]
