// تصغير الصورة في المتصفح قبل الرفع.
//
// صورة الجوال ٥-١٠ ميغا، وحد فيرسل للطلب ٤٫٥ — فبدون تصغير يفشل
// الرفع على أغلب الصور أصلاً. وفوقها: القراءة ما تحتاج الدقة الكاملة،
// و١٢٨٠ بكسل تكفي لقراءة منيو، والرفع الأصغر أسرع وأرخص.

const MAX_DIMENSION = 1280;
const QUALITY = 0.82;

/**
 * @param {File} file
 * @returns {Promise<{base64: string, mimeType: string}>}
 */
export async function shrinkImage(file) {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  // خلفية بيضاء: تحويل PNG شفاف لـ JPEG بدونها يسوّد الشفاف،
  // ولقطات الشاشة كثيراً ما تكون PNG بحواف شفافة
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // JPEG دائماً بعد التصغير — أصغر من PNG للصور الفوتوغرافية بفرق كبير
  const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
  return {
    base64: dataUrl.slice(dataUrl.indexOf(",") + 1),
    mimeType: "image/jpeg",
  };
}
