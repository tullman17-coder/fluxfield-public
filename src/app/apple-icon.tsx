import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * iOS rounds the corners itself and does not like transparency, so this one
 * fills the square edge to edge.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(145deg, #3a1d3f 0%, #1b1224 55%, #0b0910 100%)",
          color: "#e77ae6",
          fontSize: 78,
          fontWeight: 800,
          letterSpacing: 2,
        }}
      >
        FB
      </div>
    ),
    size,
  );
}
