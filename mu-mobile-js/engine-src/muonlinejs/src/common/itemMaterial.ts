import { CustomMaterial, type Scene } from '../libs/babylon/exports';

/**
 * Mặt nạ bit đưa vào shader:
 *   bit 0–3  cấp cường hoá 0–15
 *   bit 4    đồ Xuất sắc  (0x10)
 *   bit 5    đồ Thần      (0x20)
 *
 * Bit 5 là MỚI. Bản gốc chỉ có hai trường đầu, và bit "Xuất sắc" tuy được đọc
 * ra biến bIsExcellent nhưng KHÔNG dùng ở đâu cả — đồ Xuất sắc sáng y hệt đồ
 * thường. Giờ cả hai đều có lớp phủ riêng, xem phần "lớp phủ phẩm cấp" dưới.
 */
const ITEM_OPTIONS_UNIFORM_NAME = `itemOptions`;

export function createItemMaterial(scene: Scene) {
  const simpleMaterial = new CustomMaterial('itemMaterial', scene);

  simpleMaterial.diffuseColor.setAll(1);

  simpleMaterial.specularColor.setAll(0);

  simpleMaterial.AddUniform(ITEM_OPTIONS_UNIFORM_NAME, 'float', 0);
  simpleMaterial.AddUniform('time', 'float', 0);

  simpleMaterial.Fragment_Definitions(`
    float noise2(vec2 coords){
      vec2 texSize = vec2(1.0);
      vec2 pc = coords * texSize;
      vec2 base = floor(pc);
      float s1 = getRand((base + vec2(0.0,0.0)) / texSize);
      float s2 = getRand((base + vec2(1.0,0.0)) / texSize);
      float s3 = getRand((base + vec2(0.0,1.0)) / texSize);
      float s4 = getRand((base + vec2(1.0,1.0)) / texSize);
      vec2 f = smoothstep(0.0, 1.0, fract(pc));
      float px1 = mix(s1,s2,f.x);
      float px2 = mix(s3,s4,f.x);
      float result = mix(px1,px2,f.y);
      return result;
    }
  `);

  simpleMaterial.Fragment_Before_FragColor(`
    int iItemOptions = int(${ITEM_OPTIONS_UNIFORM_NAME});
    int iItemLvl = iItemOptions & 0x0F;
    bool bIsExcellent = (iItemOptions & 0x10) != 0;
    bool bIsDivine = (iItemOptions & 0x20) != 0;

    float wave = float(int(time * 1000.0) % 10000) * 0.0001;

    vec3 view = normalize(vEyePosition.xyz-vPositionW) + vNormalW + vec3(10000.5);
    float mixAmount = (1.0 + sin(time * 4.0)) / 2.0;
    float lvl = float(iItemLvl);
    if (lvl < 1.5) { // 0,1

    }
    else if (lvl < 4.5) { // 2,3,4 (red)
      vec3 minColor = vec3(0.4,0.3,0.3);
      vec3 maxColor = vec3(0.7,0.5,0.5);
      vec3 vPartColor = mix(minColor, maxColor, mixAmount);
      color.rgb = color.rgb * vPartColor;
    }
    else if (lvl < 6.5) { // 5,6 (blue)
      vec3 minColor = vec3(0.3,0.4,0.4);
      vec3 maxColor = vec3(0.5,0.6,0.6);
      vec3 vPartColor = mix(minColor, maxColor, mixAmount);
      color.rgb = color.rgb * vPartColor;
    }
    else if (lvl < 8.5) { // 7,8 (gold)
      float n_second = normalW.z * 0.5 + wave;
      float n_first = normalW.y * 0.5 + wave * 2.0;

      uvOffset = vec2(n_first, n_second);
      vec4 texColor = texture2D(diffuseSampler, vDiffuseUV + uvOffset);

      color.rgb = color.rgb * 0.8 + texColor.rgb * color.rgb * .9;
    }
    else if (lvl < 9.5) { // 9, (more gold)
      float n_second = normalW.z * 0.5 + wave;
      float n_first = normalW.y * 0.5 + wave * 2.0;

      uvOffset = vec2(n_first, n_second);
      vec4 texColor = texture2D(diffuseSampler, vDiffuseUV + uvOffset);

      color.rgb = color.rgb * 0.8 + color.rgb * vec3(1.0,0.9,0.0) + texColor.rgb * vec3(.7,.6,.5) * .3;
    }
    else { // 10 trở lên — TRẢ VỀ ĐÚNG MỘT NHÁNH NHƯ BẢN GỐC
      /* Để ý: MỌI số hạng đều nhân với color.rgb, tức nhân với chính vân của
         món đồ. Nhờ thế vân vẫn nhìn rõ, món chỉ lấp lánh thêm.

         Bản trước tôi tách riêng +15 rồi CỘNG THẲNG một màu trắng ngà
         (vec3(1.0,0.97,0.92) * n * pulse * 1.6). Cộng thẳng thì không ăn theo
         vân nữa — bề mặt bị xoá trắng, nhân vật mặc đủ bộ thành một cục sáng
         vàng. Bỏ hẳn nhánh ấy. */
      color.rgb = color.rgb * 1.4 + color.rgb * 2.0 * noise2(view.xz + time);
    }

    /* ══════════ ĐỒ XUẤT SẮC / ĐỒ THẦN ══════════
       Ba lớp, đúng thứ client MU thật cho ra: màu lên tươi, ánh trắng thuỷ
       tinh lấp lánh, và một dải tím hồng chạy vòng quanh thân.

       Bản gốc afrokick đọc cờ bIsExcellent ra biến rồi BỎ KHÔNG DÙNG, nên đồ
       Xuất sắc sáng y hệt đồ thường. Đây là chỗ lắp nó vào.

       Nguyên tắc xuyên suốt: KHÔNG phủ màu đè lên bề mặt. Lớp 1 kéo chính vân
       gốc lên, lớp 2 và 3 chỉ cộng ở những chỗ hẹp (đỉnh nhiễu, dải mỏng), nên
       vân model vẫn nhìn rõ. Bản trước tôi cộng thẳng một màu ra cả mặt, thế
       là nhân vật thành cục sáng — không lặp lại. */
    if (bIsExcellent || bIsDivine) {
      /* ── CƠ CHẾ: LẤY ĐÚNG CỦA BẢN GỐC ──
         Nhánh +7..+9 ở trên làm thế này:

           uvOffset = vec2(n_first, n_second);   // trượt theo pháp tuyến + thời gian
           texColor = texture2D(diffuseSampler, vDiffuseUV + uvOffset);
           color.rgb = color.rgb * 0.8 + texColor.rgb * color.rgb * .9;

         Tức là lấy mẫu CHÍNH VÂN của món đồ tại một toạ độ UV đang trượt, rồi
         trộn ngược lên chính nó. Vệt sáng chạy chính là vân món đồ trượt trên
         bản thân nó. Đây là cách MU làm, và dùng lại đúng cơ chế ấy thì hiệu
         ứng ăn nhập với vân từng món, không phải lớp sơn phủ bên ngoài.

         Trượt nhanh hơn nhánh +7..+9 (hệ số 1,5 và 3,0 thay vì 1,0 và 2,0)
         để đồ Xuất sắc "sống" hơn đồ thường cùng cấp. */
      float e_second = normalW.z * 0.5 + wave * 1.5;
      float e_first  = normalW.y * 0.5 + wave * 3.0;
      vec4 excTex = texture2D(diffuseSampler, vDiffuseUV + vec2(e_first, e_second));

      /* ── 1. LÊN MÀU TƯƠI ──
         Kéo bão hoà của chính vân gốc chứ không tô màu mới: giáp Rồng vốn đỏ
         nâu sẫm sẽ bật thành đỏ tươi, giáp bạc vẫn ra bạc. Trộn ngược qua mức
         xám với hệ số > 1 là cách tăng bão hoà mà không đụng sắc độ. */
      float xam = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(xam), color.rgb, 1.45);

      /* ── 2. ÁNH TRẮNG THUỶ TINH LẤP LÁNH ──
         Lấy kênh sáng nhất của mẫu đang trượt rồi nâng luỹ thừa 3: chỗ vân
         vốn sáng thì bật hẳn lên trắng, chỗ tối gần như không đổi. Ra đúng
         kiểu đốm chói trượt trên mặt thuỷ tinh — và vì nguồn là vân thật của
         món nên đốm bám theo hoạ tiết giáp, không rải đều vô hồn. */
      float sang = pow(max(max(excTex.r, excTex.g), excTex.b), 3.0);
      color.rgb += vec3(1.0, 0.98, 0.95) * sang * 0.85;

      /* ── 3. DẢI TÍM HỒNG CHẠY VÒNG QUANH THÂN ──
         Góc phương vị của pháp tuyến, pha quay theo thời gian: mặt nào đang
         quay đúng hướng thì dải quét qua, nên nhìn như dải sáng đi vòng quanh
         người. Luỹ thừa 10 cho dải MỎNG, không loang cả mặt. Nhân thêm mẫu
         trượt nên dải cũng gợn theo vân chứ không phải vạch sơn phẳng. */
      float goc = atan(normalW.z, normalW.x);
      float dai = pow(0.5 + 0.5 * cos(goc - time * 1.7), 10.0);
      color.rgb += vec3(0.86, 0.32, 0.95) * dai * (0.5 + 0.5 * excTex.r) * 1.6;

      /* Đồ Thần: dải ngả tím đậm hơn, để phân biệt với đồ Xuất sắc thường mà
         không đổi ba lớp trên. Cùng màu chữ tên món trong bảng chú giải —
         xem itemRank() bên src/offline/itemStats.ts. */
      if (bIsDivine) {
        vec3 V = normalize(vEyePosition.xyz - vPositionW);
        float rim = pow(1.0 - abs(dot(normalize(vNormalW), V)), 3.0);
        color.rgb += vec3(0.62, 0.35, 1.0) * rim * 0.45;
      }
    }
`);

  let time = 0;

  scene.onReadyObservable.addOnce(() => {
    scene.onBeforeRenderObservable.add(() => {
      time += scene.getEngine()!.getDeltaTime()! / 1000;
    });

    simpleMaterial.onBindObservable.add(mesh => {
      const effect = simpleMaterial.getEffect();
      if (!effect) return;
      effect.setFloat('time', time + (mesh.metadata?.timeOffset ?? 0));

      let itemOptions = 0;

      if (mesh.metadata?.itemLvl) {
        itemOptions = mesh.metadata.itemLvl;
      }

      if (mesh.metadata?.isExcellent) {
        itemOptions |= 0x10;
      }

      if (mesh.metadata?.isDivine) {
        itemOptions |= 0x20;
      }

      effect.setFloat(ITEM_OPTIONS_UNIFORM_NAME, itemOptions);

      effect.setTexture('diffuseSampler', mesh.metadata!.diffuseTexture);

      if (mesh.metadata?.diffuseColor) {
        effect.setColor4(
          'vDiffuseColor',
          mesh.metadata.diffuseColor,
          mesh.metadata.diffuseColor.a
        );
      }
    });
  });

  return simpleMaterial;
}
