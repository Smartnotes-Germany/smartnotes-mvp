type BrandLogoProps = {
  logoImage: string;
  size?: "sm" | "md";
};

export function BrandLogo({ logoImage, size = "md" }: BrandLogoProps) {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src={logoImage}
        alt=""
        className={`brand-mark ${size === "sm" ? "h-8 w-8" : "h-9 w-9"}`}
      />
      <span className="brand-word">
        <span className="font-bold">stack</span>
        <span className="font-light">prep</span>
      </span>
    </div>
  );
}
