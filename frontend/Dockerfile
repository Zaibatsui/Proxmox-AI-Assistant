FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install ajv@6 ajv-keywords@3 --legacy-peer-deps && \
    npm install --legacy-peer-deps

# Copy application code
COPY . .

EXPOSE 3000

CMD ["yarn", "start"]
