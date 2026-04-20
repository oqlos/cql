FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
# Copy only what's needed for the build — legacy/ and node_modules are
# excluded via .dockerignore so they never enter the image context.
COPY . .
RUN npm run build

FROM nginx:alpine
# envsubst is bundled in nginx:alpine; template is rendered on container start.
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
# Defaults — safe to override via `docker compose --env-file .env`
ENV BACKEND_API_URL="http://host.docker.internal:8080" \
    BACKEND_WS_URL="http://host.docker.internal:8080" \
    FRAME_ANCESTORS="'self' http://*.localhost https://*.localhost"
EXPOSE 80
# nginx:alpine auto-runs envsubst on /etc/nginx/templates/*.template at startup.
CMD ["nginx", "-g", "daemon off;"]
