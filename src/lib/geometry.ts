/** Retângulo em pixels. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Área ocupada por uma imagem desenhada dentro de um quadro. */
export interface FittedRect {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  scale: number;
}

/**
 * Área ocupada por uma imagem srcW×srcH desenhada com `object-fit: contain`
 * num quadro boxW×boxH (centralizada, sem cortar nada).
 */
export function containRect(srcW: number, srcH: number, boxW: number, boxH: number): FittedRect {
  if (srcW <= 0 || srcH <= 0 || boxW <= 0 || boxH <= 0) {
    return { offsetX: 0, offsetY: 0, width: 0, height: 0, scale: 0 };
  }
  const scale = Math.min(boxW / srcW, boxH / srcH);
  const width = srcW * scale;
  const height = srcH * scale;
  return { offsetX: (boxW - width) / 2, offsetY: (boxH - height) / 2, width, height, scale };
}

/** Converte uma caixa em pixels da imagem para pixels do quadro onde ela é exibida. */
export function mapBox(box: Box, rect: FittedRect): Box {
  return {
    x: rect.offsetX + box.x * rect.scale,
    y: rect.offsetY + box.y * rect.scale,
    width: box.width * rect.scale,
    height: box.height * rect.scale,
  };
}

/** Tamanho para reduzir uma imagem até `maxSide` no maior lado (nunca amplia). */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number; scale: number } {
  const largest = Math.max(width, height);
  const scale = largest > maxSide ? maxSide / largest : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

/** Caixa ampliada por uma margem proporcional (para recortar o rosto), limitada à imagem. */
export function expandBox(box: Box, marginRatio: number, maxW: number, maxH: number): Box {
  const mx = box.width * marginRatio;
  const my = box.height * marginRatio;
  const x = Math.max(0, Math.floor(box.x - mx));
  const y = Math.max(0, Math.floor(box.y - my));
  const right = Math.min(maxW, Math.ceil(box.x + box.width + mx));
  const bottom = Math.min(maxH, Math.ceil(box.y + box.height + my));
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
}

/** Topo do rótulo: acima da caixa se couber, senão dentro dela, junto à borda de cima. */
export function labelTop(boxY: number, labelHeight: number, gap = 2): number {
  const above = boxY - labelHeight - gap;
  return above >= 0 ? above : Math.max(0, boxY + gap);
}

/** Esquerda do rótulo, sem deixar que ele saia pela direita do quadro. */
export function labelLeft(boxX: number, labelWidth: number, frameWidth: number): number {
  return Math.max(0, Math.min(boxX, frameWidth - labelWidth));
}
