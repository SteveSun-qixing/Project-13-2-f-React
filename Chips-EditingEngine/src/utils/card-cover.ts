export interface CardCoverResource {
    path: string;
    data: Uint8Array;
}

export const DEFAULT_COVER_RATIO = '3:4';
export const CARD_ROOT_BASE_HREF = '../';

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function normalizeCoverRatio(value?: string): string {
    if (typeof value !== 'string') {
        return DEFAULT_COVER_RATIO;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return DEFAULT_COVER_RATIO;
    }

    const normalized = trimmed.replace('/', ':');
    const parts = normalized.split(':').map((part) => part.trim());
    if (parts.length !== 2) {
        return DEFAULT_COVER_RATIO;
    }

    const [width, height] = parts;
    const widthValue = Number(width);
    const heightValue = Number(height);
    if (!Number.isFinite(widthValue) || !Number.isFinite(heightValue) || widthValue <= 0 || heightValue <= 0) {
        return DEFAULT_COVER_RATIO;
    }

    return `${width}:${height}`;
}

export function swapCoverRatio(value: string): string {
    const normalized = normalizeCoverRatio(value);
    const [width, height] = normalized.split(':');
    return `${height}:${width}`;
}

export function parseCoverRatio(value: string): { width: number; height: number } {
    const normalized = normalizeCoverRatio(value);
    const [width, height] = normalized.split(':');
    return {
        width: Number(width),
        height: Number(height),
    };
}

export function createDefaultCoverHtml(cardName: string): string {
    const safeCardName = escapeHtml(cardName);
    return ensureCoverHtmlUsesCardRootBase([
        '<!doctype html>',
        '<html lang="zh-CN">',
        '<head>',
        '  <meta charset="utf-8" />',
        '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
        '  <style>',
        '    html, body { margin: 0; width: 100%; height: 100%; }',
        '    body {',
        '      display: grid;',
        '      place-items: center;',
        '      background: linear-gradient(135deg, #f5f7fb 0%, #eef3ff 100%);',
        '      color: #111827;',
        '      font: 600 24px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
        '      text-align: center;',
        '      padding: 24px;',
        '      box-sizing: border-box;',
        '      overflow: hidden;',
        '    }',
        '  </style>',
        '</head>',
        `  <body>${safeCardName}</body>`,
        '</html>',
    ].join('\n'));
}

export function createImageCoverHtml(imageSrc: string): string {
    const safeImageSrc = escapeHtml(imageSrc);
    return ensureCoverHtmlUsesCardRootBase([
        '<!doctype html>',
        '<html lang="zh-CN">',
        '<head>',
        '  <meta charset="utf-8" />',
        '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
        '  <style>',
        '    html, body { margin: 0; width: 100%; height: 100%; background: #000; }',
        '    body {',
        '      overflow: hidden;',
        '    }',
        '    img {',
        '      width: 100%;',
        '      height: 100%;',
        '      object-fit: cover;',
        '      display: block;',
        '    }',
        '  </style>',
        '</head>',
        `  <body data-chips-cover-mode="image" data-chips-cover-image-source="${safeImageSrc}">`,
        `    <img src="${safeImageSrc}" alt="" />`,
        '  </body>',
        '</html>',
    ].join('\n'));
}

export function ensureCoverHtmlUsesCardRootBase(html: string): string {
    const trimmed = html.trim();
    if (!trimmed) {
        return trimmed;
    }

    if (/<base\b/i.test(trimmed)) {
        return trimmed;
    }

    const baseTag = `  <base href="${CARD_ROOT_BASE_HREF}" data-chips-cover-base="card-root" />`;

    if (/<\/head>/i.test(trimmed)) {
        return trimmed.replace(/<\/head>/i, `${baseTag}\n</head>`);
    }

    if (/<body\b/i.test(trimmed)) {
        return trimmed.replace(/<body\b/i, `<head>\n${baseTag}\n</head>\n<body`);
    }

    return [
        '<!doctype html>',
        '<html lang="zh-CN">',
        '<head>',
        '  <meta charset="utf-8" />',
        '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
        baseTag,
        '</head>',
        `<body>${trimmed}</body>`,
        '</html>',
    ].join('\n');
}

export function extractGeneratedImageSource(html: string): string | null {
    const match = html.match(/data-chips-cover-image-source="([^"]+)"/i);
    return match?.[1] ?? null;
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.addEventListener('load', () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
                return;
            }

            reject(new Error('Failed to convert blob to data URL.'));
        });

        reader.addEventListener('error', () => {
            reject(reader.error ?? new Error('Failed to convert blob to data URL.'));
        });

        reader.readAsDataURL(blob);
    });
}

export async function binaryToDataUrl(data: Uint8Array, mimeType: string): Promise<string> {
    const buffer = new ArrayBuffer(data.byteLength);
    new Uint8Array(buffer).set(data);
    return blobToDataUrl(new Blob([buffer], { type: mimeType }));
}
