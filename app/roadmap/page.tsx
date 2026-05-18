import Link from "next/link";
import { PageFrame } from "@/components/app/page-frame";

const milestones = [
  {
    phase: "MVP",
    status: "Built",
    items: [
      "Fhenix-enabled encrypted signal contract",
      "On-chain ETH subscriptions with tier gating",
      "ACL grant flow for subscriber decrypt access",
      "Encrypted private watchlists",
      "Analyst console and signal dashboard",
      "Owner-only admin page for analyst approvals and tier prices",
    ],
  },
  {
    phase: "Testnet",
    status: "Ready",
    items: [
      "Deploy with PRIVATE_KEY and SEPOLIA_RPC_URL",
      "Set NEXT_PUBLIC_SILENT_WHALE_ADDRESS",
      "Publish first analyst signal through the app",
      "Unlock/decrypt with the browser wallet extension",
      "Run npm run qa:sepolia for live end-to-end verification",
    ],
  },
  {
    phase: "V2",
    status: "Planned",
    items: [
      "Indexer for whale movement ingestion",
      "AI scoring service writing encrypted confidence values",
      "ERC20/USDC subscription settlement",
      "Shared permits for teams and DAO dashboards",
      "Optional confidential auto-copy execution",
    ],
  },
];

export default function RoadmapPage() {
  return (
    <PageFrame
      eyebrow="Build Notes"
      title="Protocol roadmap."
      copy="SilentWhale is wired as a production-oriented MVP: privacy primitives first, indexing and AI enrichment next."
    >
      <div className="divide-y divide-white/10 border-y border-white/10">
        {milestones.map((milestone) => (
          <section key={milestone.phase} className="grid gap-8 py-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="font-mono text-xs uppercase tracking-widest text-white/35">
                {milestone.status}
              </p>
              <h2 className="mt-3 font-display text-5xl">{milestone.phase}</h2>
            </div>
            <ul className="space-y-4 lg:col-span-8">
              {milestone.items.map((item) => (
                <li key={item} className="border-b border-white/10 pb-4 text-white/65">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-12 grid gap-6 text-sm text-white/55 lg:grid-cols-3">
        <div className="border-t border-white/10 pt-5">
          <p className="font-mono text-xs uppercase tracking-widest text-white/35">
            Contract
          </p>
          <p className="mt-3">
            `contracts/SilentWhale.sol` stores encrypted handles and grants FHE
            ACL access only after tier checks pass.
          </p>
        </div>
        <div className="border-t border-white/10 pt-5">
          <p className="font-mono text-xs uppercase tracking-widest text-white/35">
            Deploy
          </p>
          <p className="mt-3">
            Use `npm run deploy:sepolia` with funded testnet ETH. Keep
            `PRIVATE_KEY` in the shell or `.env.local`, never in source.
          </p>
        </div>
        <div className="border-t border-white/10 pt-5">
          <p className="font-mono text-xs uppercase tracking-widest text-white/35">
            Docs
          </p>
          <Link
            href="https://cofhe-docs.fhenix.zone/"
            target="_blank"
            className="mt-3 inline-flex border-b border-white/30 pb-1 text-white"
          >
            Fhenix CoFHE documentation
          </Link>
        </div>
      </div>
    </PageFrame>
  );
}
