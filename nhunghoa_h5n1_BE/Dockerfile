# Sử dụng image chính chủ của Playwright (đã cài sẵn Chromium và mọi thư viện cần thiết)
FROM mcr.microsoft.com/playwright:v1.41.0-jammy
WORKDIR /app
# Khai báo biến môi trường cho Playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8000
CMD ["npm", "start"]