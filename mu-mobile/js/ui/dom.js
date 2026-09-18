// Tiện ích DOM tối giản. Không framework — giao diện này chỉ cần dựng cây một
// lần rồi cập nhật vài thuộc tính mỗi khung hình, nên thư viện là thừa.

/**
 * Tạo phần tử.
 *   el('div.ae-chip', { text: 'xin chào' })
 *   el('button.ae-btn.ae-btn--primary', { onclick: fn }, [child])
 */
export function el(spec, props = null, children = null) {
  const [tagPart, ...classes] = String(spec).split('.');
  const node = document.createElement(tagPart || 'div');
  if (classes.length) node.className = classes.join(' ');

  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined) continue;
      if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') applyStyle(node, v);
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') {
        node.addEventListener(k.slice(2), v);
      } else if (k === 'hidden') node.hidden = !!v;
      // src phải gán bằng THUỘC TÍNH chứ không setAttribute: chế độ zip bọc
      // đúng thuộc tính .src của <img> để bung ảnh từ file nén (js/zip-net.js),
      // đi đường setAttribute là lọt qua lớp bọc và ảnh không hiện.
      else if (k === 'src') node.src = v;
      else node.setAttribute(k, v);
    }
  }

  if (children) {
    for (const c of [].concat(children)) {
      if (c === null || c === undefined || c === false) continue;
      node.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
  }
  return node;
}

/**
 * Gán một loạt thuộc tính style.
 *
 * Không dùng Object.assign được: biến CSS (khoá bắt đầu bằng "--") phải đi qua
 * setProperty, gán kiểu style['--x'] bị trình duyệt bỏ qua lặng lẽ — bảng màu
 * bậc cường hoá từng mất sạch vì lỗi này.
 */
export function applyStyle(node, obj) {
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('--')) node.style.setProperty(k, v);
    else node.style[k] = v;
  }
}

/** Gán text chỉ khi khác — tránh làm bẩn layout mỗi khung hình. */
export function setText(node, value) {
  const s = String(value);
  if (node.textContent !== s) node.textContent = s;
}

/** Gán một thuộc tính style chỉ khi khác. */
export function setStyle(node, prop, value) {
  if (node.style[prop] !== value) node.style[prop] = value;
}

/**
 * Gán biến CSS. Phải đi qua setProperty: gán kiểu node.style['--x'] không có
 * tác dụng, trình duyệt bỏ qua lặng lẽ.
 */
export function setVar(node, name, value) {
  if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
}

/** Bật/tắt lớp CSS. */
export function setClass(node, name, on) {
  node.classList.toggle(name, !!on);
}

/** Chạm nhanh, không kéo — dùng cho nút HUD để không nuốt thao tác xoay cảnh. */
export function onTap(node, handler) {
  let sx = 0;
  let sy = 0;
  let moved = false;

  node.addEventListener(
    'pointerdown',
    e => {
      sx = e.clientX;
      sy = e.clientY;
      moved = false;
    },
    { passive: true }
  );

  node.addEventListener(
    'pointermove',
    e => {
      if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) moved = true;
    },
    { passive: true }
  );

  node.addEventListener('pointerup', e => {
    if (moved) return;
    e.stopPropagation();
    handler(e);
  });

  return node;
}

/** Xoá sạch con của một nút. */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
