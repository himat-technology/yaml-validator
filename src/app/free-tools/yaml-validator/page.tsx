import type { Metadata } from "next";
import Link from "next/link";
import { PrivacyNotice } from "@/components/yaml-validator/PrivacyNotice";
import { ToolInfoSections } from "@/components/yaml-validator/ToolInfoSections";
import YamlValidatorTool from "@/components/yaml-validator/YamlValidatorTool";
import { SITE_URL } from "@/lib/site";

const title = "YAML Validator, Formatter & JSON Converter";
const description =
  "Free browser-based YAML validator, formatter and YAML to JSON / JSON to YAML converter for Kubernetes, OpenAPI and Docker Compose files.";
const path = "/free-tools/yaml-validator";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "YAML validator",
    "YAML formatter",
    "YAML to JSON",
    "JSON to YAML",
    "YAML lint",
    "Kubernetes YAML validator",
    "OpenAPI YAML",
    "Docker Compose validator",
  ],
  alternates: { canonical: path },
  openGraph: {
    title: `${title} | HIMAT Technology`,
    description,
    url: path,
    siteName: "HIMAT Technology",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `${title} | HIMAT Technology`,
    description,
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: title,
  description,
  url: `${SITE_URL}${path}`,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any (runs in the browser)",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  publisher: { "@type": "Organization", name: "HIMAT Technology" },
};

export default function YamlValidatorPage() {
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <Link href={path} className="font-semibold tracking-tight">
            HIMAT Technology
          </Link>
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
              <li>Free Tools</li>
              <li aria-hidden="true">/</li>
              <li>
                <span aria-current="page" className="text-foreground">
                  YAML Validator
                </span>
              </li>
            </ol>
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          <p className="max-w-3xl text-base text-muted">
            Validate, format, lint, and convert YAML manifests, Kubernetes specs, OpenAPI schemas, and Docker Compose
            files entirely in the browser.
          </p>
        </div>

        <PrivacyNotice />

        <YamlValidatorTool />

        <ToolInfoSections />
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-[1600px] px-4 py-4 text-sm text-muted sm:px-6">
          © HIMAT Technology · YAML processing runs locally in your browser.
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
    </>
  );
}
