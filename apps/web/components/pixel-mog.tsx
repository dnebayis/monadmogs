const pixels = [
  "ear left-ear",
  "ear right-ear",
  "inner left-inner",
  "inner right-inner",
  "fur head",
  "fur cheek-left",
  "fur cheek-right",
  "face faceplate",
  "shade face-shade",
  "eye eye-left",
  "eye eye-right",
  "shine shine-left",
  "shine shine-right",
  "nose",
  "mouth",
  "fur body",
  "paw paw-left",
  "paw paw-right",
  "foot foot-left",
  "foot foot-right",
];

export function PixelMog() {
  return (
    <div className="pixel-mog">
      {pixels.map((pixel) => (
        <span key={pixel} className={pixel} />
      ))}
    </div>
  );
}
