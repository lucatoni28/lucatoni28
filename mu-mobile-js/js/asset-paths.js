// Đường dẫn asset. Một nguồn duy nhất: thư mục assets/ cạnh index.html.

import { suaHoaThuong } from './asset-manifest.js';
import { DBG } from './debug.js';

export const GOC = 'assets/';

export const MU_ASSETS = {
  GOC,

  /** Đường dẫn kho không có, ghi ra nhật ký gỡ lỗi. */
  thieu: new Set(),

  /** Đồng bộ — engine đòi vậy. suaHoaThuong() vì bảng vật phẩm MU lệch hoa thường. */
  resolve(logicalPath) {
    return GOC + suaHoaThuong(logicalPath.replace(/^\/+/, ''));
  },

  ghiThieu(logicalPath) {
    if (this.thieu.has(logicalPath)) return;
    this.thieu.add(logicalPath);
    DBG.warn('kho thiếu', logicalPath);
  },

  /** Engine gọi với đường dẫn tương đối gốc game-assets. */
  game(relPath) {
    return this.resolve('game-assets/' + relPath.replace(/^[./]+/, ''));
  },

  /** Ba tiền tố dưới đây được nối thẳng với tên file ở nơi khác. */
  get itemsBase() {
    return GOC + 'items/';
  },

  get decoderBase() {
    return GOC + 'js/';
  },

  get fontBase() {
    return GOC + 'fonts/';
  },
};

window.MU_ASSETS = MU_ASSETS;
