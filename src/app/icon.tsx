import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/**
 * Home-screen and tab mark. Drawn rather than shipped as a file so it stays in
 * step with the palette. The monogram sits well inside the edges, which is what
 * Android needs to crop it into whatever shape the launcher uses.
 */
export default function Icon() {
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
            "linear-gradient(145deg, #2c162f 0%, #150f1c 55%, #0b0910 100%)",
        }}
      >
        <div
          style={{
            width: 300,
            height: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 72,
            background: "#2c162f",
            border: "10px solid #d565d6",
            color: "#e77ae6",
            fontSize: 132,
            fontWeight: 800,
            letterSpacing: 4,
          }}
        >
          FB
        </div>
      </div>
    ),
    size,
  );
}
