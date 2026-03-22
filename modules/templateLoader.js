import { findClosestPaletteIndexForPixel } from "./colorUtils.js";

function createSurface(width, height, willReadFrequently = false) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  return {
    canvas,
    context: canvas.getContext("2d", {
      alpha: true,
      willReadFrequently
    })
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Не удалось прочитать PNG файл."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Не удалось декодировать PNG изображение."));
    image.src = dataUrl;
  });
}

export async function fileToTemplateRecord(file) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);

  return {
    templateDataUrl: dataUrl,
    templateName: file.name || "template.png",
    templateWidth: image.width,
    templateHeight: image.height,
    templateUpdatedAt: Date.now()
  };
}

export async function loadTemplateFromDataUrl(dataUrl, metadata = {}) {
  if (!dataUrl) {
    return null;
  }

  const image = await loadImage(dataUrl);
  const width = image.width;
  const height = image.height;
  const { canvas, context } = createSurface(width, height, true);

  if (!context) {
    throw new Error("Не удалось получить 2D context для шаблона.");
  }

  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0);

  const imageData = context.getImageData(0, 0, width, height);
  const rgba = new Uint8ClampedArray(imageData.data);
  const paletteIndices = new Uint8Array(width * height);
  const alphaMask = new Uint8Array(width * height);
  paletteIndices.fill(255);

  let activePixels = 0;

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const alpha = rgba[offset + 3];
    const paletteIndex = findClosestPaletteIndexForPixel(
      rgba[offset],
      rgba[offset + 1],
      rgba[offset + 2],
      alpha
    );

    if (paletteIndex === -1) {
      continue;
    }

    paletteIndices[index] = paletteIndex;
    alphaMask[index] = 1;
    activePixels += 1;
  }

  return {
    name: metadata.name || "",
    dataUrl,
    width,
    height,
    activePixels,
    paletteIndices,
    alphaMask,
    rgba,
    sourceCanvas: canvas,
    loadedAt: Date.now()
  };
}
