// Điểm vào. Thứ tự bắt buộc: đường dẫn asset → engine → giao diện.

import './asset-paths.js';

await import('./engine.js');

const { startApp } = await import('./app.js');
startApp();
