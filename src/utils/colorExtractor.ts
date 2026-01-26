export const extractDominantColors = async (imageUrl: string): Promise<{ primary: string; secondary: string; accent: string }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      
      // Scale down for performance
      const scale = 0.1;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      
      // Simple color extraction - get average colors from different regions
      const colors: { r: number; g: number; b: number }[] = [];
      
      // Sample from 3 regions
      const regions = [
        { x: 0, y: 0, w: canvas.width / 3, h: canvas.height },
        { x: canvas.width / 3, y: 0, w: canvas.width / 3, h: canvas.height },
        { x: (canvas.width * 2) / 3, y: 0, w: canvas.width / 3, h: canvas.height },
      ];
      
      regions.forEach((region) => {
        let r = 0, g = 0, b = 0, count = 0;
        
        for (let y = region.y; y < region.y + region.h; y += 2) {
          for (let x = region.x; x < region.x + region.w; x += 2) {
            const i = (y * canvas.width + x) * 4;
            r += pixels[i];
            g += pixels[i + 1];
            b += pixels[i + 2];
            count++;
          }
        }
        
        colors.push({
          r: Math.round(r / count),
          g: Math.round(g / count),
          b: Math.round(b / count),
        });
      });
      
      // Convert RGB to HSL format for CSS
      const rgbToHsl = (r: number, g: number, b: number) => {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;
        
        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          
          switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
          }
        }
        
        return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
      };
      
      resolve({
        primary: rgbToHsl(colors[0].r, colors[0].g, colors[0].b),
        secondary: rgbToHsl(colors[1].r, colors[1].g, colors[1].b),
        accent: rgbToHsl(colors[2].r, colors[2].g, colors[2].b),
      });
    };
    
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageUrl;
  });
};
