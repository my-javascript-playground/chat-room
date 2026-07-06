# Stage 1 — build
FROM node:20-alpine AS builder
WORKDIR /app

ARG BACKEND_URL
ARG RECAPTCHA_SITE_KEY

COPY package*.json ./
RUN npm ci
COPY . .

# Inject runtime values into the production environment file before the build
RUN sed -i "s|__BACKEND_URL__|${BACKEND_URL}|g" src/environments/environment.prod.ts && \
    sed -i "s|__RECAPTCHA_SITE_KEY__|${RECAPTCHA_SITE_KEY}|g" src/environments/environment.prod.ts

RUN npm run build -- --configuration production

# Stage 2 — serve
FROM nginx:1.27-alpine
COPY --from=builder /app/dist/chatroom-angular/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
