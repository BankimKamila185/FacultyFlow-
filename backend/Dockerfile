FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the source code
COPY . .

# Build TypeScript to dist
RUN npm run build

EXPOSE 4000

# Start production server
CMD ["npm", "start"]
