FROM node:24-alpine AS build
ARG VITE_API_URL=http://backend:8000/api
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN VITE_API_URL=$VITE_API_URL npm run build

FROM node:24-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
RUN npm install -g serve
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173", "--no-clipboard"]
