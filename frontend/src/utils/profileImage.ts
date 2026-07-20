const MAX_SOURCE_SIZE = 5 * 1024 * 1024;
const MAX_DIMENSION = 512;

export const compressProfileImage = (file: File): Promise<string> => {
  if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
    return Promise.reject(new Error("Choose a PNG, JPEG or WebP image."));
  }
  if (file.size > MAX_SOURCE_SIZE) {
    return Promise.reject(
      new Error("Profile images must be smaller than 5 MB."),
    );
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("The image format is not valid."));
      image.onload = () => {
        const scale = Math.min(
          1,
          MAX_DIMENSION / Math.max(image.width, image.height),
        );
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("The image could not be processed."));
          return;
        }

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
};
