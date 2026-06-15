import { Link } from "wouter";
import { Film, Github, ExternalLink } from "lucide-react";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-white/5 bg-[#0d0d0d]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-[#e50914] flex items-center justify-center">
                <Film className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-black text-lg text-white">Movie<span className="text-[#e50914]">Box</span></span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed">
              Stream movies, series, and anime — powered by a self-hosted API proxy.
            </p>
          </div>

          {/* Browse */}
          <div>
            <h3 className="text-white text-xs font-semibold uppercase tracking-wider mb-3">Browse</h3>
            <ul className="space-y-2 text-sm">
              {[
                { href: "/search?q=movies&type=MOVIES", label: "Movies" },
                { href: "/search?q=series&type=TV_SERIES", label: "TV Series" },
                { href: "/search?q=anime&type=ANIME", label: "Anime" },
                { href: "/search?q=trending", label: "Trending" },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-gray-500 hover:text-gray-200 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Dev */}
          <div>
            <h3 className="text-white text-xs font-semibold uppercase tracking-wider mb-3">Developer</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="/api/healthz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-200 transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3 h-3" /> API Health
                </a>
              </li>
              <li>
                <a
                  href="/docs/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-200 transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3 h-3" /> API Docs
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/DevDoodle-69/Movie-Box-API-V1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-200 transition-colors flex items-center gap-1.5"
                >
                  <Github className="w-3 h-3" /> GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-gray-600 text-xs">
            © {year} MovieBox. For personal use only.
          </p>
          <p className="text-gray-700 text-xs">
            Made with <span className="text-[#e50914]">♥</span> · Powered by MovieBox API
          </p>
        </div>
      </div>
    </footer>
  );
}
