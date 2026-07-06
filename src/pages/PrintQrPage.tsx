import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../context/AuthContext";
import { SyncIcon } from "../components/Logo";

type Format = "poster" | "tent" | "stickers";

/** Printable QR sheets: A4 poster, table tent, sticker grid. */
export default function PrintQrPage() {
  const params = useParams();
  const format = (["poster", "tent", "stickers"].includes(params.format ?? "")
    ? params.format
    : "poster") as Format;
  const { restaurant } = useAuth();
  if (!restaurant) return null;

  const hubUrl = `${window.location.origin}/r/${restaurant.id}`;
  const accent = restaurant.brand_color || "#FF6B2C";

  return (
    <div className="min-h-screen bg-cloud">
      {/* toolbar (hidden when printing) */}
      <div className="print-hide sticky top-0 z-10 flex items-center gap-3 border-b border-mist bg-white px-5 py-3">
        <Link to="/app/public" className="btn-ghost">
          <ArrowLeft size={16} /> Back
        </Link>
        <p className="font-medium capitalize">
          {format === "poster" ? "A4 poster" : format === "tent" ? "Table tent" : "Sticker sheet"}
        </p>
        <button className="btn-primary ml-auto" onClick={() => window.print()}>
          <Printer size={15} /> Print
        </button>
      </div>

      <div className="flex justify-center p-8 print:p-0">
        <div className="print-sheet w-[210mm] bg-white shadow-xl print:shadow-none">
          {format === "poster" && <Poster name={restaurant.name} logo={restaurant.logo_url} accent={accent} url={hubUrl} />}
          {format === "tent" && <Tent name={restaurant.name} logo={restaurant.logo_url} accent={accent} url={hubUrl} />}
          {format === "stickers" && <Stickers name={restaurant.name} accent={accent} url={hubUrl} />}
        </div>
      </div>
    </div>
  );
}

function Branding({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-1.5 opacity-50">
      <SyncIcon size={small ? 12 : 16} />
      <span className={`font-display font-bold ${small ? "text-[9px]" : "text-xs"}`}>SyncMenu</span>
    </div>
  );
}

function Poster({
  name,
  logo,
  accent,
  url,
}: {
  name: string;
  logo: string | null;
  accent: string;
  url: string;
}) {
  return (
    <div className="flex h-[296mm] flex-col items-center justify-between p-[18mm] text-center">
      <div style={{ background: accent }} className="h-3 w-full rounded-full" />
      <div className="flex flex-col items-center">
        {logo && <img src={logo} alt="" className="mb-6 h-28 w-28 rounded-3xl object-contain" />}
        <p className="text-xl font-semibold uppercase tracking-[0.3em]" style={{ color: accent }}>
          {name}
        </p>
        <h1 className="font-display mt-3 text-6xl font-bold leading-tight">
          Scan for
          <br />
          our menu
        </h1>
        <div className="mt-10 rounded-3xl border-8 p-6" style={{ borderColor: accent }}>
          <QRCodeSVG value={url} size={340} />
        </div>
        <p className="mt-8 max-w-sm text-lg text-smoke">
          Menu, ordering & more — point your phone camera at the code.
        </p>
      </div>
      <Branding />
    </div>
  );
}

function Tent({
  name,
  logo,
  accent,
  url,
}: {
  name: string;
  logo: string | null;
  accent: string;
  url: string;
}) {
  const panel = (flipped: boolean) => (
    <div
      className="flex h-[125mm] flex-col items-center justify-center gap-4 p-10 text-center"
      style={flipped ? { transform: "rotate(180deg)" } : undefined}
    >
      {logo && <img src={logo} alt="" className="h-16 w-16 rounded-2xl object-contain" />}
      <p className="text-sm font-semibold uppercase tracking-[0.25em]" style={{ color: accent }}>
        {name}
      </p>
      <h2 className="font-display text-3xl font-bold">Scan for our menu</h2>
      <div className="rounded-2xl border-[6px] p-4" style={{ borderColor: accent }}>
        <QRCodeSVG value={url} size={170} />
      </div>
      <Branding small />
    </div>
  );
  return (
    <div className="h-[296mm] p-[18mm]">
      {panel(true)}
      <div className="my-2 border-t-2 border-dashed border-mist text-center text-[9px] uppercase tracking-widest text-smoke">
        fold here
      </div>
      {panel(false)}
    </div>
  );
}

function Stickers({ name, accent, url }: { name: string; accent: string; url: string }) {
  return (
    <div className="grid h-[296mm] grid-cols-3 grid-rows-4 gap-[6mm] p-[14mm]">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 text-center"
          style={{ borderColor: accent }}
        >
          <QRCodeSVG value={url} size={92} />
          <p className="text-[10px] font-semibold leading-tight">{name}</p>
          <p className="text-[8px] uppercase tracking-widest" style={{ color: accent }}>
            Scan for menu
          </p>
        </div>
      ))}
    </div>
  );
}
