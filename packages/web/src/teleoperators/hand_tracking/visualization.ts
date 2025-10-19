import type { HandKeypoints } from "../../types/hand_tracking.js";

export function renderHandKeypoints(
  canvas: HTMLCanvasElement,
  keypoints: HandKeypoints
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;

  // Mirror the canvas horizontally (flip X axis)
  ctx.save();
  ctx.scale(-1, 1);
  ctx.translate(-width, 0);

  // Draw calibration guides
  drawCalibrationGuides(ctx, width, height);

  // Draw keypoints (mirrored)
  if (keypoints["index_finger_tip"]) {
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.arc(
      keypoints["index_finger_tip"].x,
      keypoints["index_finger_tip"].y,
      10,
      0,
      2 * Math.PI
    );
    ctx.fill();

    // Draw label
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-width, 0);
    ctx.fillStyle = "#3b82f6";
    ctx.font = "bold 12px 'Geist Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText(
      "INDEX",
      width - keypoints["index_finger_tip"].x - 12,
      keypoints["index_finger_tip"].y - 12
    );
    ctx.restore();
  }

  if (keypoints["thumb_tip"]) {
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.arc(
      keypoints["thumb_tip"].x,
      keypoints["thumb_tip"].y,
      10,
      0,
      2 * Math.PI
    );
    ctx.fill();

    // Draw label
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-width, 0);
    ctx.fillStyle = "#f59e0b";
    ctx.font = "bold 12px 'Geist Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText(
      "THUMB",
      width - keypoints["thumb_tip"].x - 12,
      keypoints["thumb_tip"].y - 12
    );
    ctx.restore();
  }

  if (keypoints["index_finger_tip"] && keypoints["thumb_tip"]) {
    const distance = Math.sqrt(
      Math.pow(keypoints["thumb_tip"].x - keypoints["index_finger_tip"].x, 2) +
        Math.pow(keypoints["thumb_tip"].y - keypoints["index_finger_tip"].y, 2)
    );

    if (distance < 50) {
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(
        keypoints["index_finger_tip"].x,
        keypoints["index_finger_tip"].y
      );
      ctx.lineTo(keypoints["thumb_tip"].x, keypoints["thumb_tip"].y);
      ctx.stroke();
    }
  }

  if (keypoints["wrist"]) {
    ctx.fillStyle = "#ec4899";
    ctx.beginPath();
    ctx.arc(keypoints["wrist"].x, keypoints["wrist"].y, 8, 0, 2 * Math.PI);
    ctx.fill();

    // Draw label
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-width, 0);
    ctx.fillStyle = "#ec4899";
    ctx.font = "bold 12px 'Geist Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText(
      "WRIST",
      width - keypoints["wrist"].x - 12,
      keypoints["wrist"].y - 12
    );
    ctx.restore();
  }

  ctx.restore();
}

function drawCalibrationGuides(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const centerX = width / 2;
  const centerY = height / 2;

  // Draw center crosshair
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);

  ctx.beginPath();
  ctx.moveTo(centerX - 30, centerY);
  ctx.lineTo(centerX + 30, centerY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(centerX, centerY - 30);
  ctx.lineTo(centerX, centerY + 30);
  ctx.stroke();

  // Draw buffer zone (70% of center)
  const bufferWidth = (width * 0.7) / 2;
  const bufferHeight = (height * 0.7) / 2;

  ctx.strokeStyle = "rgba(59, 130, 246, 0.2)";
  ctx.lineWidth = 2;
  ctx.setLineDash([]);

  ctx.strokeRect(
    centerX - bufferWidth,
    centerY - bufferHeight,
    bufferWidth * 2,
    bufferHeight * 2
  );

  // Draw safe zone label
  ctx.save();
  ctx.scale(-1, 1);
  ctx.translate(-width, 0);
  ctx.fillStyle = "rgba(59, 130, 246, 0.5)";
  ctx.font = "12px 'Geist Mono', monospace";
  ctx.textAlign = "right";
  ctx.fillText(
    "SAFE ZONE (70%)",
    width - (centerX - bufferWidth) - 5,
    centerY - bufferHeight - 5
  );
  ctx.restore();
}
