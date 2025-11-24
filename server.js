// Самый простой сервер
const express = require('express');
const path = require('path');

const app = express();
// Используем порт, который дает Render, или 3000 для локального запуска
const PORT = process.env.PORT || 3000;

// Просто отдаем файлы из папки public
app.use(express.static(path.join(__dirname, 'public')));

// Запуск
app.listen(PORT, () => {
    console.log(`✅ Сайт-визитка запущен: http://localhost:${PORT}`);
});