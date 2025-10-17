FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json yarn.lock ./
RUN yarn install

# Copy application code
COPY . .

EXPOSE 3000

CMD ["yarn", "start"]
