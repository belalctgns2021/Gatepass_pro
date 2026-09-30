import QRCode from 'qrcode';

export interface QrOptions {
  width?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
  overlayLogo?: boolean;
  logoText?: string;
  subText?: string;
}

/**
 * Draws a rounded rectangle path on a 2D canvas context.
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Generates a high-resolution QR code data URL with the 'Feng Qun' factory logo
 * branded in the center of the QR code using error correction level 'H' (up to 30% error budget).
 */
export async function generateQrDataUrl(
  text: string,
  options: QrOptions = {}
): Promise<string> {
  const {
    width = 380,
    margin = 2,
    darkColor = '#0f172a',
    lightColor = '#ffffff',
    overlayLogo = true,
    logoText = 'FQ',
    subText = 'FENG QUN',
  } = options;

  try {
    // If running in browser environment with HTML5 canvas:
    if (typeof document !== 'undefined' && document.createElement) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = width;

      // Render base QR code onto canvas with High error-correction
      await QRCode.toCanvas(canvas, text, {
        width,
        margin,
        color: {
          dark: darkColor,
          light: lightColor,
        },
        errorCorrectionLevel: 'H',
      });

      if (overlayLogo) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const cx = width / 2;
          const cy = width / 2;

          // Logo size is approximately 22% of total QR size (e.g. 84px on a 380px QR code)
          // This stays well within the 30% Reed-Solomon error correction capacity of Level H
          const outerSize = Math.round(width * 0.22);
          const outerRadius = 12;
          const x0 = cx - outerSize / 2;
          const y0 = cy - outerSize / 2;

          // 1. Crisp white protective background cushion with subtle shadow
          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 2;

          drawRoundedRect(ctx, x0, y0, outerSize, outerSize, outerRadius);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.restore();

          // 2. Crisp outer slate border
          ctx.save();
          drawRoundedRect(ctx, x0, y0, outerSize, outerSize, outerRadius);
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.restore();

          // 3. Inner badge container (Dark industrial slate with emerald accent)
          const inset = 3.5;
          const innerSize = outerSize - inset * 2;
          const innerX = x0 + inset;
          const innerY = y0 + inset;
          const innerRadius = 9;

          ctx.save();
          drawRoundedRect(ctx, innerX, innerY, innerSize, innerSize, innerRadius);
          const grad = ctx.createLinearGradient(innerX, innerY, innerX, innerY + innerSize);
          grad.addColorStop(0, '#0f172a');
          grad.addColorStop(1, '#064e3b'); // deep emerald tint
          ctx.fillStyle = grad;
          ctx.fill();

          // Emerald inner trim
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.restore();

          // 4. Miniature Security / Factory Shield Crest at top of badge
          ctx.save();
          const shieldW = 10;
          const shieldH = 12;
          const shieldX = cx - shieldW / 2;
          const shieldY = innerY + 5;

          ctx.beginPath();
          ctx.moveTo(shieldX, shieldY);
          ctx.lineTo(shieldX + shieldW, shieldY);
          ctx.lineTo(shieldX + shieldW, shieldY + shieldH * 0.6);
          ctx.quadraticCurveTo(shieldX + shieldW / 2, shieldY + shieldH, shieldX + shieldW / 2, shieldY + shieldH);
          ctx.quadraticCurveTo(shieldX, shieldY + shieldH * 0.6, shieldX, shieldY + shieldH * 0.6);
          ctx.closePath();
          ctx.fillStyle = '#34d399';
          ctx.fill();
          ctx.restore();

          // 5. Bold Monogram "FQ"
          ctx.save();
          ctx.fillStyle = '#ffffff';
          ctx.font = '900 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(logoText, cx, cy + 3);
          ctx.restore();

          // 6. Crisp Subtext "FENG QUN"
          ctx.save();
          ctx.fillStyle = '#34d399'; // Emerald-400
          ctx.font = '800 6.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(subText, cx, innerY + innerSize - 4);
          ctx.restore();
        }
      }

      return canvas.toDataURL('image/png');
    }

    // Fallback: standard QR data URL
    return await QRCode.toDataURL(text, {
      width,
      margin,
      color: {
        dark: darkColor,
        light: lightColor,
      },
      errorCorrectionLevel: 'H',
    });
  } catch (err) {
    console.error('Failed to generate branded QR code:', err);
    return '';
  }
}

export function formatDateTime(isoString?: string): string {
  if (!isoString) return '--';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

export function formatTime(isoString?: string): string {
  if (!isoString) return '--:--';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

export function formatDate(dateString?: string): string {
  if (!dateString) return '--';
  try {
    const [year, month, day] = dateString.split('-');
    if (year && month && day) {
      const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    return dateString;
  } catch {
    return dateString;
  }
}
