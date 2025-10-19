import { Link } from "react-router-dom";

const THEME = {
  bg: "#F7F2EA",
  panel: "#FFFAF3",
  text: "#1B1E22",
  subtext: "#4a4039",
  stripe1: "#e19638",
  stripe2: "#b44427",
  stripe3: "#5c0f14",
  link: "#b44427",
  linkHover: "#5c0f14",
  border: "rgba(92,15,20,0.12)",
};

function TopStripes() {
  return (
    <div aria-hidden className="w-full">
      <div style={{ background: THEME.stripe1 }} className="h-2" />
      <div style={{ background: THEME.stripe2 }} className="h-2" />
      <div style={{ background: THEME.stripe3 }} className="h-[10px]" />
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2
        className="text-2xl md:text-3xl mt-10 mb-4"
        style={{
          color: THEME.text,
          fontFamily: '"Apple Garamond","Garamond",ui-serif,serif',
        }}
      >
        {title}
      </h2>
      <div
        className="rounded-2xl p-5 md:p-6 shadow-[0_1px_0_#fff_inset,0_8px_20px_rgba(92,15,20,0.08)]"
        style={{
          background: THEME.panel,
          border: `1px solid ${THEME.border}`,
        }}
      >
        {children}
      </div>
    </section>
  );
}

export default function InfoPage() {
  return (
    <div
      className="min-h-screen"
      style={{
        background: THEME.bg,
        color: THEME.text,
        fontFamily:
          '"IBM Plex Sans","Segoe UI","Helvetica Neue",Arial,system-ui,-apple-system,sans-serif',
      }}
    >
      <TopStripes />

      {/* Header */}
      <header className="px-5 md:px-8 pt-8 md:pt-10 max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <h1
            className="text-4xl md:text-5xl leading-none"
            style={{
              fontFamily: '"Apple Garamond","Garamond",ui-serif,serif',
            }}
          >
            Heatwave
          </h1>

          <Link
            to="/"
            className="rounded-xl px-4 py-2 text-sm font-medium transition"
            style={{
              background: THEME.stripe3,
              color: "#fff",
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.2) inset, 0 4px 14px rgba(92,15,20,0.25)",
            }}
          >
            ← Back to map
          </Link>
        </div>

        <p
          className="mt-3 text-base md:text-lg max-w-2xl"
          style={{ color: THEME.subtext }}
        >
          Walk safer on hot days. Heatwave suggests routes that balance speed
          and shade so you can get there comfortably.
        </p>

        {/* Quick nav */}
        <nav className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {[
              ["about", "About"],
              ["how", "How it works"],
              ["data", "Data & attribution"],
              ["privacy", "Privacy"],
              ["terms", "Terms"],
              ["contact", "Contact"],
            ].map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="px-3 py-1.5 rounded-lg text-sm"
                  style={{
                    background: THEME.panel,
                    border: `1px solid ${THEME.border}`,
                    color: THEME.link,
                  }}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {/* Content */}
      <main className="px-5 md:px-8 pb-20 max-w-4xl mx-auto">
        <Section id="about" title="About">
          <p className="leading-relaxed" style={{ color: THEME.subtext }}>
            Heatwave is a simple navigator for pedestrians that helps you avoid
            the hottest stretches of a walk. You’ll see three options:
          </p>
          <ul className="mt-4 space-y-2">
            <li className="flex items-start gap-3">
              <span
                className="mt-1 inline-block h-5 w-1.5 rounded-full"
                style={{ background: THEME.stripe3 }}
              />
              <p>
                <strong>Fastest</strong> — the quickest ETA.
              </p>
            </li>
            <li className="flex items-start gap-3">
              <span
                className="mt-1 inline-block h-5 w-1.5 rounded-full"
                style={{ background: THEME.stripe2 }}
              />
              <p>
                <strong>Balanced</strong> — trades a bit of time for comfort.
              </p>
            </li>
            <li className="flex items-start gap-3">
              <span
                className="mt-1 inline-block h-5 w-1.5 rounded-full"
                style={{ background: THEME.stripe1 }}
              />
              <p>
                <strong>Coolest</strong> — prioritizes shadier, cooler segments.
              </p>
            </li>
          </ul>
        </Section>

        <Section id="how" title="How it works">
          <div className="space-y-3">
            <p style={{ color: THEME.subtext }}>
              Heatwave uses open map data and a routing engine to compute
              multiple pedestrian paths. A “coolness” score favors segments with
              tree cover, parks, and lower heat exposure, while “fastest” simply
              minimizes time.
            </p>
            <ul
              className="list-disc pl-5 space-y-1"
              style={{ color: THEME.subtext }}
            >
              <li>Pick a destination from search or long-press on the map.</li>
              <li>
                Compare the three routes; tap <em>Start</em> to navigate.
              </li>
              <li>
                Location stays on-device for positioning; routing happens on a
                server using open data.
              </li>
            </ul>
            <p className="text-sm" style={{ color: THEME.subtext }}>
              Always use your judgment outdoors—shade and access can change.
            </p>
          </div>
        </Section>

        <Section id="data" title="Data & attribution">
          <div className="space-y-2" style={{ color: THEME.subtext }}>
            <p>
              Base map © OpenStreetMap contributors via OpenMapTiles and served
              with PMTiles / MapLibre GL JS.
            </p>
            <p>
              Routing powered by a pedestrian profile with heat-aware scoring.
            </p>
            <p>
              You can view full license texts inside the app and here. External
              credits:{" "}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
                className="underline"
                style={{ color: THEME.link }}
              >
                OSM
              </a>
              {" · "}
              <a
                href="https://openmaptiles.org/"
                target="_blank"
                rel="noreferrer"
                className="underline"
                style={{ color: THEME.link }}
              >
                OpenMapTiles
              </a>
              {" · "}
              <a
                href="https://maplibre.org/"
                target="_blank"
                rel="noreferrer"
                className="underline"
                style={{ color: THEME.link }}
              >
                MapLibre
              </a>
              .
            </p>
          </div>
        </Section>

        <Section id="privacy" title="Privacy">
          <div className="space-y-2" style={{ color: THEME.subtext }}>
            <p>
              Heatwave doesn’t sell your data. Your live GPS location is used on
              your device to show you on the map and to request routes from your
              location to a destination.
            </p>
            <p>
              When you search, we send your query to a geocoding service to
              return suggestions. Map tiles and routing requests are standard
              web requests and include your IP address.
            </p>
            <p>
              If you contact us, we keep the message to respond and to improve
              the app.
            </p>
          </div>
        </Section>

        <Section id="terms" title="Terms of use">
          <div className="space-y-2" style={{ color: THEME.subtext }}>
            <p>
              Heatwave is provided “as is,” without warranties of any kind. You
              are responsible for your safety and for obeying local laws and
              access rules. Map data can be incomplete or out of date.
            </p>
            <p>
              By using the app you agree not to misuse the service and to abide
              by the licenses of the included open-source projects.
            </p>
          </div>
        </Section>

        <Section id="contact" title="Contact">
          <div className="space-y-2">
            <p style={{ color: THEME.subtext }}>
              Questions, feedback, or a takedown request? Email{" "}
              <a
                href="mailto:hello@heatwaves.app"
                className="underline"
                style={{ color: THEME.link }}
              >
                hello@heatwaves.app
              </a>
              .
            </p>
            <p className="text-sm" style={{ color: THEME.subtext }}>
              © {new Date().getFullYear()} Heatwave.
            </p>
          </div>
        </Section>

        <div className="mt-10 text-xs">
          <div
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2"
            style={{
              background: THEME.panel,
              border: `1px solid ${THEME.border}`,
              color: THEME.subtext,
              fontFamily: '"IBM Plex Mono",ui-monospace,monospace',
            }}
          >
            <span
              className="inline-flex h-4 w-4 items-center justify-center rounded-full"
              style={{ background: THEME.stripe1, color: "#fff", fontSize: 10 }}
              aria-hidden
              title="Information"
            >
              i
            </span>
            <span>
              © OpenMapTiles © OpenStreetMap contributors · This info page:{" "}
              <Link to="/" className="underline" style={{ color: THEME.link }}>
                back to Heatwave
              </Link>
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
