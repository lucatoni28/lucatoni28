// Điều phối: dựng giao diện, khởi động engine, nối bridge, chuyển màn.

import { MU_ASSETS, ZIP_PATH, flatName } from './asset-paths.js';
import { DBG } from './debug.js';
import { openZip, zipSupported } from './zip-store.js';
import { openZipRemote, diaChiZipTuXa } from './zip-remote.js';
import { installZipNet } from './zip-net.js';
import { bootEngine } from './boot.js';
import { createBridge } from './store-bridge.js';
import { el } from './ui/dom.js';
import {
  createLoading,
  createFatal,
  createStartScreen,
  createHeroScreen,
  createRotatePrompt,
} from './ui/screens.js';
import { createHud } from './ui/hud.js';
import { createPanels } from './ui/panels.js';
import { HEROES, WORLD_NAMES } from './game-data.js';
import { preloadMap, mapWeight, releaseMap } from './asset-loader.js';

const SAVE_KEY = 'mu.save';

function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave(save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* riêng tư / hết chỗ — bỏ qua, phiên vẫn chơi được */
  }
}

function fmtClock(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * playOffline() của engine gọi history.replaceState(null,'','/offline').
 * Ở file:// lời gọi đó ném SecurityError và làm hỏng cả hàm; trên server tĩnh
 * nó đổi URL sang một đường dẫn không tồn tại khiến tải lại trang bị 404.
 * Vô hiệu hoá replaceState trong đúng lời gọi này rồi trả lại nguyên trạng.
 */
function playOfflineSafely(bridge) {
  const original = history.replaceState;
  history.replaceState = function () {};
  try {
    bridge.playOffline();
  } finally {
    history.replaceState = original;
  }
}

export async function startApp() {
  const ui = el('div.ae');
  const loading = createLoading();
  const fatal = createFatal();
  ui.append(loading.root, fatal.root, createRotatePrompt());
  document.body.append(ui);

  let bridge = null;
  let hud = null;

  /* Nhật ký hệ thống.
     Khung nhật ký nay nằm ở góc trái trên và gánh luôn thông báo nạp dữ liệu,
     để soi lỗi ngay trên điện thoại — ở đó không mở được bảng điều khiển trình
     duyệt. Những dòng phát ra TRƯỚC khi HUD dựng xong được xếp hàng rồi đổ vào
     sau, không mất dòng nào. */
  const hangCho = [];
  function sysLog(text, alsoHint = true) {
    if (alsoHint) loading.setHint(text);
    if (hud) hud.pushLog(text, 'sys');
    else hangCho.push(text);
  }
  function xaHangCho() {
    for (const t of hangCho) hud.pushLog(t, 'sys');
    hangCho.length = 0;
  }
  let panels = null;
  let start = null;
  let heroes = null;
  let sessionStart = 0;
  let chosenHero = HEROES[0];

  const showScreen = name => {
    start?.show(name === 'start');
    heroes?.show(name === 'heroes');
    hud?.show(name === 'game');
    if (name !== 'game') panels?.close();
  };

  /**
   * Nạp sẵn asset của một bản đồ, có thanh tiến độ.
   *
   * Chỉ THỰC SỰ cần ở chế độ zip: mỗi mục phải bung ra trước, mà engine lại
   * hỏi đường dẫn đồng bộ — chưa bung xong thì nó đi hỏi img/ phẳng, mà thư
   * mục ấy trống, đó đúng là lỗi làm địa hình Lorencia trống trơn lần trước.
   * Ở chế độ folder thì trình duyệt tự đi lấy theo đường dẫn thật, hàm này
   * chỉ còn là nạp trước cho đỡ khựng.
   */
  async function loadMapAssets(mapIndex) {
    const w = mapWeight(mapIndex);
    const verb = MU_ASSETS.mode === 'zip' ? 'ĐANG BUNG BẢN ĐỒ' : 'ĐANG TẢI BẢN ĐỒ';
    const ten = WORLD_NAMES[mapIndex] || `Bản đồ ${mapIndex}`;

    sysLog(`${ten} · ${w.files} tệp · ${(w.bytes / 1048576).toFixed(0)} MB`);
    loading.set(verb, 0.5);
    loading.show(true);

    const kq = await preloadMap(mapIndex, {
      onProgress: (done, total) => loading.set(verb, 0.5 + 0.5 * (done / total)),
    }).catch(e => ({ loi: e }));

    if (kq?.loi) sysLog(`Lỗi nạp ${ten}: ${kq.loi.message || kq.loi}`, false);
    else if (kq?.skipped) sysLog(`${ten}: đã có sẵn trong bộ nhớ`, false);
    else sysLog(`${ten}: ${kq.files} tệp` + (kq.failed ? ` · hụt ${kq.failed}` : ' · đủ'), false);

    loading.show(false);
  }

  async function enterWorld(hero) {
    chosenHero = hero;
    loading.set('ĐANG VÀO THẾ GIỚI', 0.45);
    loading.show(true);

    await loadMapAssets(0);

    playOfflineSafely(bridge);
    bridge.setCharClass(hero.cls);
    sessionStart = Date.now();

    // Áp thiết lập đồ hoạ mặc định (xem GFX_DEFAULT trong store-bridge.js).
    // Phải gọi SAU playOffline: trước đó chưa có camera nào để chỉnh.
    bridge.applyGfxDefaults();
    const g = bridge.gfxState();
    sysLog(`Đồ hoạ: ${g.camera} · ${g.scale}× · ${g.fpsCap || 'không'} giới hạn fps`, false);

    showScreen('game');
    hud.setHero(hero.name);
    hud.pushLog(`Bạn tiến vào ${WORLD_NAMES[0]}.`, 'info');
    hud.flash(hero.name.toUpperCase());
  }

  /* true khi người dùng chủ động chọn nguồn zip. Mặc định là không.

     Hai nguồn, cả hai NHÌN THẤY ĐƯỢC — giống hệt forcedMode() bên
     asset-paths.js, cố tình không đọc localStorage: trạng thái nhớ ngầm trong
     trình duyệt là thứ đè lên mặc định mà mở file ra đọc không thấy. */
  function muonZip() {
    try {
      if (new URLSearchParams(location.search).get('assets') === 'zip') return true;
    } catch {
      /* file:// không có search hợp lệ */
    }
    if (typeof window !== 'undefined' && window.MU_SOURCE === 'zip') return true;
    const m = document.querySelector('meta[name="mu-source"]');
    return m?.content === 'zip';
  }

  try {
    DBG.info('khởi động', `bắt đầu · ${navigator.userAgent.slice(0, 70)}`);
    loading.set('ĐANG DÒ NGUỒN DỮ LIỆU', 0.1);

    /* Chế độ zip nay phải XIN MỚI CÓ: ?assets=zip trên URL, window.MU_SOURCE
       = 'zip', hoặc lựa chọn đã nhớ trong localStorage.

       Vì sao không dò sẵn như trước: mặc định giờ là đọc thẳng cây thư mục,
       mà cứ dò thì mỗi lần mở trang lại có một yêu cầu img/assets.zip trả về
       404 nằm đỏ trong bảng điều khiển — vô hại nhưng gây hiểu nhầm là hỏng.
       Vẫn phải thử TRƯỚC khi vào thế giới vì mở zip là việc bất đồng bộ, mà
       engine thì hỏi đường dẫn theo kiểu đồng bộ. */
    /* Ghi kích thước vùng hiển thị thật và đơn vị --u suy ra từ đó.
       Giao diện dựng theo khung 430 × 932; ứng dụng nào có thanh công cụ trên
       hoặc thanh tab dưới thì vùng web lùn lại, tỉ lệ lệch đi. Có hai con số
       này trong nhật ký thì nhìn ảnh chụp là biết ngay layout lệch vì đâu,
       khỏi phải đoán máy người dùng. */
    {
      const w = Math.round(document.documentElement.clientWidth);
      const h = Math.round(document.documentElement.clientHeight);
      const u = Math.min(w / 430, h / 932);
      sysLog(
        `Màn hình: ${w} × ${h} · DPR ${window.devicePixelRatio || 1} · ` +
          `--u ${u.toFixed(3)} · sân khấu ${Math.round(430 * u)} × ${Math.round(932 * u)}`,
        false
      );
    }

    /* ───────── ZIP TỪ XA (tuỳ chọn, mặc định TẮT) ─────────
       Khai địa chỉ ở thẻ <meta name="mu-zip-url"> đầu index.html, hoặc thêm
       ?zipurl=… vào URL. Không khai thì khối này không chạy một dòng nào và
       game vẫn hoàn toàn cục bộ.

       Đọc bằng HTTP Range nên khởi động chỉ tốn cỡ bảng mục lục (~1,3 MB cho
       zip 275 MB), sau đó mỗi asset tốn đúng cỡ nó. Xem js/zip-remote.js.

       NÓI RÕ: đây là đường RA MẠNG, ngược quy tắc 4 trong CLAUDE.md, do bạn
       yêu cầu. Địa chỉ nằm ở index.html chứ không nhúng trong img/mu.js — xoá
       thẻ meta là cắt đứt, khỏi dựng lại gì. */
    const diaChiXa = zipSupported() ? diaChiZipTuXa() : null;
    if (diaChiXa) {
      sysLog(`Đang mở zip từ xa: ${diaChiXa}`);
      loading.set('ĐANG ĐỌC MỤC LỤC KHO', 0.2);
      try {
        const z = await openZipRemote(diaChiXa);
        MU_ASSETS.zip = z;
        MU_ASSETS.mode = 'zip';
        MU_ASSETS.forced = true;
        DBG.info('zip-xa', `${z.count} mục · tiền tố "${z.prefix}"`);
        sysLog(`Kho từ xa: ${z.count} mục · tiền tố "${z.prefix || '(gốc)'}"`, false);

        installZipNet(
          path => MU_ASSETS.readZip(path),
          path => {
            MU_ASSETS.ghiThieu(path);
            return MU_ASSETS.FLAT_BASE + flatName(path);
          }
        );
      } catch (e) {
        /* Hỏng thì NÓI RA rồi đi tiếp bằng kho cục bộ — không chặn khởi động. */
        DBG.error('zip-xa', `mở ${diaChiXa} hỏng`, e);
        sysLog(`Zip từ xa hỏng (${e.message}) — quay về kho cục bộ`, false);
      }
    }

    if (!MU_ASSETS.zip && muonZip() && zipSupported()) {
      sysLog(`Đang tìm ${ZIP_PATH}`);
      const n = await MU_ASSETS.openZipSource(u => fetch(u), openZip);
      if (n > 0) {
        /* Lớp chặn fetch/XHR/<img>. Phải cài NGAY sau khi mở zip và TRƯỚC
           bootEngine(): từ đây mọi đường dẫn trong zip được trả về dạng URL giả
           __muzip/, không cài thì chúng ra thẳng mạng và hỏng hết. */
        /* Đường lùi khi zip thiếu file: img/ phẳng, VẪN TRONG MÁY. Trước đây
           chỗ này trỏ ra CDN ngoài — đã cắt. */
        installZipNet(
          path => MU_ASSETS.readZip(path),
          path => {
            MU_ASSETS.ghiThieu(path);
            return MU_ASSETS.FLAT_BASE + flatName(path);
          }
        );

        const p = MU_ASSETS.zip.prefix;
        sysLog(
          `Đọc từ ${ZIP_PATH} · ${n.toLocaleString('vi')} mục` +
            (p ? ` · tiền tố "${p}"` : '')
        );

        // Phông chữ MU nằm sẵn trong zip — lấy ra luôn để khỏi bắt người dùng
        // nạp riêng ba file fonts_* vào img/. @font-face khai sau thì đè lên
        // khai trong CSS, cùng một họ 'MU Segoe'.
        MU_ASSETS.blobUrl('fonts/segoeuib.woff2')
          .then(url => {
            if (!url.startsWith('blob:')) return;
            const st = document.createElement('style');
            st.textContent =
              `@font-face{font-family:'MU Segoe';font-style:normal;` +
              `font-weight:400 700;font-display:swap;` +
              `src:url("${url}") format("woff2")}`;
            document.head.append(st);
          })
          .catch(() => {});
      }
    }

    /* ───────── DÒ NGUỒN ASSET — CHỈ DÒ, KHÔNG CHẶN ─────────
       Thử đọc một file mốc để CHỌN chế độ đọc nào hợp: thư mục → nén → phẳng.

       Bản trước tôi làm sai: dò không ra thì dựng bảng báo lỗi rồi `return`,
       chặn luôn khởi động — và còn chặn thẳng khi thấy file://. Sai ở chỗ
       fetch() hỏng KHÔNG có nghĩa là asset không đọc được: ứng dụng bọc
       trang (WebView, runtime riêng) có thể cấp file cho engine bằng đường
       khác mà fetch không nhìn thấy. Lấy kết quả một phép thử để chặn cả
       chương trình là tôi tự quyết thay người dùng.

       Nay: dò được thì chọn chế độ đó; dò không được thì GIỮ NGUYÊN chế độ
       đã khai trong index.html, ghi một dòng vào nhật ký, rồi vẫn chạy tiếp.
       Engine tự xoay xở — nó có nạp được hay không là việc của nó. */
    {
      const DUONG_THU = 'game-assets/World1/EncTerrain1.map';

      /** Thử đọc file mốc theo một đường dẫn. Trả true nếu đọc được. */
      const thuDoc = async url => {
        try {
          const r = await fetch(url, { method: 'GET' });
          return r.ok;
        } catch {
          return false;
        }
      };

      const daThu = [];
      let xong = false;

      // (a) chế độ đang khai — thường là 'folder' với gốc public/
      {
        const u = MU_ASSETS.resolve(DUONG_THU);
        daThu.push(`${MU_ASSETS.mode} → ${u}`);
        if (await thuDoc(u)) {
          sysLog(`Kho dữ liệu: đọc được ${u}`, false);
          xong = true;
        }
      }

      // (b) chưa được thì thử img/assets.zip
      if (!xong && MU_ASSETS.mode !== 'zip') {
        daThu.push('zip → img/assets.zip');
        const n = await MU_ASSETS.openZipSource(u => fetch(u), openZip).catch(() => 0);
        if (n > 0) {
          DBG.info('kho', `chuyển sang zip (${n} mục)`);
          sysLog(`Kho dữ liệu: dùng img/assets.zip · ${n} mục`, false);
          xong = true;
        }
      }

      // (c) vẫn chưa được thì thử img/ tên phẳng
      if (!xong) {
        const cu = MU_ASSETS.mode;
        MU_ASSETS.mode = 'flat';
        const u = MU_ASSETS.resolve(DUONG_THU);
        daThu.push(`flat → ${u}`);
        if (await thuDoc(u)) {
          MU_ASSETS.forced = true;
          DBG.info('kho', 'chuyển sang đọc img/ tên phẳng');
          sysLog('Kho dữ liệu: dùng img/ tên phẳng', false);
          xong = true;
        } else {
          MU_ASSETS.mode = cu; // trả lại chế độ đã khai, không tự đổi bừa
        }
      }

      /* Dò không ra thì GHI LẠI rồi đi tiếp — không dựng bảng, không dừng. */
      if (!xong) {
        DBG.warn('kho', `dò thử không đọc được: ${daThu.join(' · ')}`);
        DBG.warn('kho', `vẫn chạy tiếp với chế độ "${MU_ASSETS.mode}"` +
          (MU_ASSETS.mode === 'folder' ? ` · gốc "${MU_ASSETS.FOLDER_BASE}"` : ''));
        sysLog(`Kho dữ liệu: dò thử không đọc được, chạy tiếp với "${MU_ASSETS.mode}"`, false);
      }
    }

    const engine = bootEngine({
      onProgress: msg => {
        sysLog(msg);
        loading.set('ĐANG KHỞI ĐỘNG', 0.45);
      },
    });

    loading.set('ĐANG DỰNG GIAO DIỆN', 0.75);
    sysLog(
      {
        folder: `Dữ liệu nạp từ thư mục ${MU_ASSETS.FOLDER_BASE}`,
        flat: 'Dữ liệu nạp từ thư mục img/ (tên phẳng)',
        zip: `Dữ liệu nạp từ ${ZIP_PATH}`,
      }[MU_ASSETS.mode]
    );

    bridge = createBridge({
      store: engine.store,
      world: engine.world,
      eventBus: engine.eventBus,
      soundsManager: window.__soundsManager,
      scene: engine.scene,
      prepareMap: mapIndex => loadMapAssets(mapIndex),
    });

    const resolve = p => MU_ASSETS.resolve(p);
    const resolveBg = p => MU_ASSETS.blobUrl(p);

    hud = createHud({
      bridge,
      resolveIcon: resolve,
      resolveBg,
      onOpenPanel: id => {
        if (panels.current === id) {
          panels.close();
          hud.setPanelActive(id, false);
          return;
        }
        if (panels.current) hud.setPanelActive(panels.current, false);
        panels.open(id, bridge.snapshot());
        hud.setPanelActive(id, true);
      },
    });

    panels = createPanels({
      bridge,
      resolve,
      resolveBg,
      onClose: () => {
        const id = panels.current;
        panels.close();
        if (id) hud.setPanelActive(id, false);
      },
      onQuit: () => {
        panels.close();
        showScreen('start');
        start.setSave(readSave());
      },
    });

    start = createStartScreen({
      onContinue: () => {
        const save = readSave();
        const hero = HEROES.find(h => h.cls === save?.cls) || HEROES[0];
        enterWorld(hero);
      },
      onNewGame: () => showScreen('heroes'),
    });

    heroes = createHeroScreen({
      onBack: () => showScreen('start'),
      onEnter: hero => enterWorld(hero),
    });

    ui.append(start.root, heroes.root, hud.root, panels.root);
    xaHangCho();

    /* Lỗi và cảnh báo bắt được ở lớp gỡ lỗi hiện luôn lên khung nhật ký góc
       trái, để nhìn màn hình là biết có chuyện, không phải mở Cài đặt. */
    DBG.onLine((dong, muc) => {
      if (muc === 'error') hud.pushLog(dong.slice(0, 120), 'bad');
      else if (muc === 'net') hud.pushLog(dong.slice(0, 120), 'warn');
    });

    bridge.onLog((text, kind) => hud.pushLog(text, kind));

    /* Chiến đấu chơi đơn. Toàn bộ phép tính nằm trong engine
       (src/offline/ bên engine) và báo ra bằng sự kiện; lớp giao diện chỉ
       vẽ lại. Bốn sự kiện dưới đây là tất cả những gì HUD cần biết. */
    const bus = engine.eventBus;
    if (bus) {
      bus.on('offlineHit', ({ x, y, amount, kind }) => {
        // x, y là pixel màn hình do engine tính sẵn; popFloat nhận phần trăm.
        // Lệch ngẫu nhiên vài phần trăm: đánh liên tục mà số cứ rơi trúng
        // một chỗ thì chồng lên nhau đọc không ra.
        const lech = () => (Math.random() - 0.5) * 6;
        const px = (x > 0 ? (x / window.innerWidth) * 100 : 50) + lech();
        const py = (y > 0 ? (y / window.innerHeight) * 100 : 62) + lech();
        if (kind === 'miss') {
          hud.popFloat('TRƯỢT', 'mana', px, py);
        } else {
          hud.popFloat(String(amount), kind, px, py);
        }
      });

      bus.on('offlineKill', ({ name, exp, zen }) => {
        hud.pushLog(`Hạ ${name} · +${exp} KN · +${zen} Zen`, 'good');
      });

      bus.on('offlineLoot', ({ name }) => {
        hud.pushLog(name === 'TÚI ĐẦY' ? 'Túi đã đầy, không nhặt được' : `Nhặt được ${name}`,
          name === 'TÚI ĐẦY' ? 'warn' : 'good');
      });

      bus.on('offlineLevelUp', ({ level, points }) => {
        hud.pushLog(`LÊN CẤP ${level}! Có ${points} điểm cộng`, 'warn');
        hud.flash(`LÊN CẤP ${level}`);
      });

      /* Đổi bản đồ thì thu hồi blob URL của map cũ. Safari không tự dọn, không
         gọi là mỗi lần dịch chuyển lại giữ thêm vài trăm MB. */
      let mapDangChoi = 0;
      bus.on('warpCompleted', ({ map }) => {
        if (MU_ASSETS.mode === 'zip' && map !== mapDangChoi) {
          releaseMap(mapDangChoi);
          mapDangChoi = map;
        }
        // Đổi bản đồ là engine dựng lại camera, phải áp lại góc nhìn ĐANG CHỌN.
        bridge.applyGfx();
      });

      bus.on('offlinePlayerDied', () => {
        hud.pushLog('Bạn gục ngã — hồi sinh ngay tại chỗ', 'bad');
        hud.flash('BẠN ĐÃ GỤC');
      });
    }

    bridge.subscribe((snap, changed) => {
      hud.update(snap, changed);
      panels.update(snap, changed);
    });
    bridge.start();

    // Ghi lại phiên chơi mỗi 5 giây để màn khởi đầu có dữ liệu thật.
    setInterval(() => {
      if (!sessionStart) return;
      const snap = bridge.snapshot();
      writeSave({
        cls: chosenHero.cls,
        heroName: chosenHero.name,
        level: snap.level,
        mapName: snap.mapName,
        playtime: fmtClock(Date.now() - sessionStart),
        savedAt: Date.now(),
      });
    }, 5000);

    loading.show(false);
    start.setSave(readSave());
    showScreen('start');
  } catch (err) {
    DBG.error('khởi động', err);
    console.error(err);
    loading.show(false);
    fatal.show(err);
  }
}
