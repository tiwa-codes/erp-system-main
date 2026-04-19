import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { spawnSync } from "child_process"
import JSZip from "jszip"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

type MsaProviderInfo = {
  facility_name: string
  address?: string | null
  email?: string | null
  phone_whatsapp?: string | null
}

type MsaTariffService = {
  service_name: string
  category_name: string
  price: number
}

type GenerateMsaPdfInput = {
  msaId: string
  tariffPlanId: string
  version?: number | null
  provider: MsaProviderInfo
  services: MsaTariffService[]
  generatedAt: Date
  commenceDate?: Date
  approvalComment?: string
  cjhSignatoryName?: string
  cjhSignatoryTitle?: string
}

const PAGE_MARGIN = 48
const ROW_HEIGHT = 16
const MSA_TEMPLATE_RELATIVE_PATH = "app/api/settings/package-limits/Lola Facility MSA.docx"

let cachedTemplateParagraphs: string[] | null = null

function resolveMsaTemplatePath() {
  const candidates = [
    process.env.MSA_TEMPLATE_PATH,
    join(process.cwd(), MSA_TEMPLATE_RELATIVE_PATH),
    join("/root/erp-system-staging", MSA_TEMPLATE_RELATIVE_PATH),
    join("/root/erp-system", MSA_TEMPLATE_RELATIVE_PATH),
  ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim()))

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

function formatCurrency(value: number) {
  return `NGN ${value.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function formatDateTime(value: Date) {
  return value.toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getOrdinalSuffix(day: number) {
  if (day % 100 >= 11 && day % 100 <= 13) {
    return "th"
  }

  switch (day % 10) {
    case 1:
      return "st"
    case 2:
      return "nd"
    case 3:
      return "rd"
    default:
      return "th"
  }
}

function formatLegalDate(value: Date) {
  const day = value.getDate()
  const month = value.toLocaleString("en-NG", { month: "long" })
  const year = value.getFullYear()
  return `${day}${getOrdinalSuffix(day)} day of ${month} ${year}`
}

function addOneYear(value: Date) {
  const endDate = new Date(value)
  endDate.setFullYear(endDate.getFullYear() + 1)
  return endDate
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#xA;/g, " ")
}

function normalizeDocLine(line: string) {
  return line
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim()
}

async function getTemplateParagraphs() {
  if (cachedTemplateParagraphs) {
    return cachedTemplateParagraphs
  }

  const templatePath = resolveMsaTemplatePath()
  if (!templatePath) {
    console.warn("[MSA PDF] DOCX template not found. Falling back to compact layout.")
    cachedTemplateParagraphs = []
    return cachedTemplateParagraphs
  }

  try {
    const templateBuffer = readFileSync(templatePath)
    const zip = await JSZip.loadAsync(templateBuffer)
    const docXml = await zip.file("word/document.xml")?.async("string")

    if (!docXml) {
      cachedTemplateParagraphs = []
      return cachedTemplateParagraphs
    }

    const paragraphs = [...docXml.matchAll(/<w:p[\s\S]*?<\/w:p>/g)].map((match) => match[0])
    const lines = paragraphs
      .map((paragraph) => {
        const runs = [...paragraph.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
          .map((match) => decodeXmlEntities(match[1]))
        return normalizeDocLine(runs.join(" "))
      })
      .filter(Boolean)

    cachedTemplateParagraphs = lines
    return lines
  } catch (error) {
    console.warn("[MSA PDF] Failed to read DOCX template:", error)
    cachedTemplateParagraphs = []
    return cachedTemplateParagraphs
  }
}

function applyTemplateReplacements(line: string, providerName: string, providerAddress: string, legalCommencementDate: string, legalTerminationDate: string) {
  let output = line
  output = output.replace(/LOLA\s+FACILITY,\s*AREA\s*1\s*ABUJA/gi, `${providerName}, ${providerAddress}`)
  output = output.replace(/\bLola\s+Facility\b/g, providerName)
  output = output.replace(/\bArea\s*1,\s*Abuja\b/gi, providerAddress)

  // Handles the sample red dates from the legal template regardless of spacing style.
  output = output.replace(/29\s*(?:st|nd|rd|th)?\s*day\s+of\s+March\s*20\s*26/gi, legalCommencementDate)
  output = output.replace(/29\s*(?:st|nd|rd|th)?\s*day\s+of\s+March\s*20\s*27/gi, legalTerminationDate)

  if (/^This\s+Agreement\s+is\s+valid\s+for\s+one\s*\(1\)\s+year/i.test(output)) {
    output = `This Agreement is valid for one (1) year, commencing from ${legalCommencementDate} and terminating on the ${legalTerminationDate}.`
  }

  return output
}

function buildCompactMsaHtml(input: GenerateMsaPdfInput): string {
  const rows = input.services
    .map((service, index) => {
      const serviceName = escapeHtml(service.service_name || "-")
      const categoryName = escapeHtml(service.category_name || "-")
      const amount = formatCurrency(service.price || 0)
      return `
        <tr>
          <td class="sn">${index + 1}</td>
          <td>${serviceName}</td>
          <td>${categoryName}</td>
          <td class="amount">${amount}</td>
        </tr>
      `
    })
    .join("\n")

  const providerName = escapeHtml(input.provider.facility_name || "Provider Hospital")
  const providerAddress = input.provider.address ? escapeHtml(input.provider.address) : "Address not provided"
  const providerEmail = input.provider.email ? escapeHtml(input.provider.email) : "-"
  const providerPhone = input.provider.phone_whatsapp ? escapeHtml(input.provider.phone_whatsapp) : "-"
  const approvalComment = input.approvalComment ? escapeHtml(input.approvalComment) : ""

  const commencementDate = input.commenceDate || input.generatedAt
  const terminationDate = addOneYear(commencementDate)
  const legalCommencementDate = escapeHtml(formatLegalDate(commencementDate))
  const legalTerminationDate = escapeHtml(formatLegalDate(terminationDate))
  const commencementDateLabel = escapeHtml(formatDateTime(commencementDate))
  const terminationDateLabel = escapeHtml(formatDateTime(terminationDate))

  const cjhSignatoryName = escapeHtml(input.cjhSignatoryName || "Authorized Signatory")
  const cjhSignatoryTitle = escapeHtml(input.cjhSignatoryTitle || "For: Crown Jewel HMO")
  const signedAtLabel = escapeHtml(formatDateTime(input.generatedAt))

  const totalTariff = input.services.reduce((sum, service) => sum + (service.price || 0), 0)

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>MSA ${escapeHtml(input.msaId)}</title>
    <style>
      @page {
        size: A4;
        margin: 16mm;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: Arial, Helvetica, sans-serif;
        color: #111827;
        font-size: 11px;
        line-height: 1.45;
      }

      .title {
        margin: 0 0 10px;
        font-size: 20px;
        color: #0f766e;
      }

      .meta {
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 10px;
        margin-bottom: 12px;
      }

      .meta p,
      .agreement p,
      .provider-summary p {
        margin: 4px 0;
      }

      .label {
        color: #374151;
        font-weight: 700;
      }

      .agreement {
        margin-bottom: 12px;
      }

      .provider-summary {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 10px;
        background: #f9fafb;
        margin-bottom: 12px;
      }

      .comment {
        margin: 14px 0;
        padding: 10px;
        border-left: 4px solid #0f766e;
        background: #f0fdfa;
      }

      .comment h3 {
        margin: 0 0 6px;
        font-size: 12px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      thead th {
        text-align: left;
        background: #f3f4f6;
        border-bottom: 1px solid #d1d5db;
        border-top: 1px solid #d1d5db;
        padding: 7px;
        font-size: 10px;
      }

      tbody td {
        padding: 6px 7px;
        border-bottom: 1px solid #e5e7eb;
        vertical-align: top;
        word-break: break-word;
      }

      .sn {
        width: 40px;
      }

      .amount {
        text-align: right;
        white-space: nowrap;
      }

      .summary {
        margin-top: 10px;
        display: flex;
        justify-content: space-between;
        font-weight: 700;
      }

      .signatures {
        margin-top: 24px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }

      .sig-card {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px;
        min-height: 120px;
      }

      .sig-line {
        border-bottom: 1px solid #6b7280;
        height: 1px;
        margin: 22px 0 8px;
        width: 100%;
      }

      .stamp {
        display: inline-block;
        padding: 3px 7px;
        border-radius: 999px;
        border: 1px solid #047857;
        color: #047857;
        font-size: 10px;
        font-weight: 700;
      }

      .muted {
        color: #6b7280;
      }
    </style>
  </head>
  <body>
    <h1 class="title">Medical Service Agreement (MSA)</h1>

    <section class="meta">
      <p><span class="label">MSA ID:</span> ${escapeHtml(input.msaId)}</p>
      <p><span class="label">Tariff Plan:</span> ${escapeHtml(input.tariffPlanId)}${input.version ? ` (v${input.version})` : ""}</p>
      <p><span class="label">Commencement Date:</span> ${commencementDateLabel}</p>
      <p><span class="label">Termination Date:</span> ${terminationDateLabel}</p>
      <p><span class="label">Generated:</span> ${escapeHtml(formatDateTime(input.generatedAt))}</p>
    </section>

    <section class="agreement">
      <p>
        This Medical Service Agreement is made this ${legalCommencementDate} BETWEEN Crown Jewel HMO
        (hereinafter called "CJH") and ${providerName} of ${providerAddress}
        (hereinafter called "Provider Hospital").
      </p>
      <p>
        The agreement shall commence from ${legalCommencementDate} and terminate on ${legalTerminationDate},
        unless earlier terminated in accordance with the terms of this Agreement.
      </p>
    </section>

    <section class="provider-summary">
      <p><span class="label">Provider Hospital:</span> ${providerName}</p>
      <p><span class="label">Address:</span> ${providerAddress}</p>
      <p><span class="label">Email:</span> ${providerEmail}</p>
      <p><span class="label">Phone:</span> ${providerPhone}</p>
    </section>

    ${approvalComment ? `<section class="comment"><h3>Executive Comment</h3><p>${approvalComment}</p></section>` : ""}

    <table>
      <thead>
        <tr>
          <th class="sn">S/N</th>
          <th>Service</th>
          <th>Category</th>
          <th class="amount">Tariff Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <section class="summary">
      <div>Total Services: ${input.services.length}</div>
      <div>Total Tariff Value: ${formatCurrency(totalTariff)}</div>
    </section>

    <section class="signatures">
      <div class="sig-card">
        <p class="label">For Provider Hospital</p>
        <div class="sig-line"></div>
        <p>${providerName}</p>
        <p class="muted">${providerAddress}</p>
        <p class="muted">Date: ____________________</p>
      </div>

      <div class="sig-card">
        <p class="label">For Crown Jewel HMO</p>
        <p><span class="stamp">DIGITALLY SIGNED</span></p>
        <div class="sig-line"></div>
        <p>${cjhSignatoryName}</p>
        <p class="muted">${cjhSignatoryTitle}</p>
        <p class="muted">Signed At: ${signedAtLabel}</p>
      </div>
    </section>
  </body>
</html>
  `
}

async function buildMsaHtml(input: GenerateMsaPdfInput): Promise<string> {
  const commencementDate = input.commenceDate || input.generatedAt
  const terminationDate = addOneYear(commencementDate)
  const legalCommencementDate = formatLegalDate(commencementDate)
  const legalTerminationDate = formatLegalDate(terminationDate)
  const cjhSignatoryName = escapeHtml(input.cjhSignatoryName || "Authorized Signatory")
  const cjhSignatoryTitle = escapeHtml(input.cjhSignatoryTitle || "For: Crown Jewel HMO")
  const signedAtLabel = escapeHtml(formatDateTime(input.generatedAt))

  const providerName = input.provider.facility_name || "Provider Hospital"
  const providerAddress = input.provider.address || "Address not provided"

  const templateParagraphs = await getTemplateParagraphs()
  if (templateParagraphs.length === 0) {
    return buildCompactMsaHtml(input)
  }

  const renderedAgreement = templateParagraphs
    .map((line) => applyTemplateReplacements(line, providerName, providerAddress, legalCommencementDate, legalTerminationDate))
    .map((line) => {
      const escaped = escapeHtml(line)
      if (/^\d+\./.test(line) || /^[A-Z\s()\-]{6,}$/.test(line)) {
        return `<p class=\"clause-heading\">${escaped}</p>`
      }
      return `<p>${escaped}</p>`
    })
    .join("\n")

  const rows = input.services
    .map((service, index) => {
      const serviceName = escapeHtml(service.service_name || "-")
      const categoryName = escapeHtml(service.category_name || "-")
      const amount = formatCurrency(service.price || 0)
      return `
        <tr>
          <td class="sn">${index + 1}</td>
          <td>${serviceName}</td>
          <td>${categoryName}</td>
          <td class="amount">${amount}</td>
        </tr>
      `
    })
    .join("\n")

  const totalTariff = input.services.reduce((sum, service) => sum + (service.price || 0), 0)

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>MSA ${escapeHtml(input.msaId)}</title>
    <style>
      @page {
        size: A4;
        margin: 16mm;
      }

      body {
        margin: 0;
        font-family: "Times New Roman", Times, serif;
        color: #111827;
        font-size: 12px;
        line-height: 1.45;
      }

      .agreement p {
        margin: 0 0 9px;
        text-align: justify;
      }

      .agreement .clause-heading {
        margin-top: 14px;
        margin-bottom: 8px;
        font-weight: 700;
        text-transform: uppercase;
      }

      .page-break {
        page-break-before: always;
      }

      .appendix-title {
        margin: 0 0 8px;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 18px;
        color: #0f766e;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      thead th {
        text-align: left;
        background: #f3f4f6;
        border-bottom: 1px solid #d1d5db;
        border-top: 1px solid #d1d5db;
        padding: 7px;
        font-size: 10px;
        font-family: Arial, Helvetica, sans-serif;
      }

      tbody td {
        padding: 6px 7px;
        border-bottom: 1px solid #e5e7eb;
        vertical-align: top;
        word-break: break-word;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 11px;
      }

      .sn { width: 40px; }
      .amount { text-align: right; white-space: nowrap; }

      .summary {
        margin-top: 10px;
        display: flex;
        justify-content: space-between;
        font-weight: 700;
        font-family: Arial, Helvetica, sans-serif;
      }

      .signatures {
        margin-top: 20px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 18px;
      }

      .sig-card {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px;
        min-height: 120px;
        font-family: Arial, Helvetica, sans-serif;
      }

      .sig-line {
        border-bottom: 1px solid #6b7280;
        height: 1px;
        margin: 22px 0 8px;
        width: 100%;
      }

      .stamp {
        display: inline-block;
        padding: 3px 7px;
        border-radius: 999px;
        border: 1px solid #047857;
        color: #047857;
        font-size: 10px;
        font-weight: 700;
      }

      .muted { color: #6b7280; }
    </style>
  </head>
  <body>
    <section class="agreement">
      ${renderedAgreement}
    </section>

    <section class="page-break">
      <h2 class="appendix-title">Tariff Schedule (Appendix)</h2>
      <table>
        <thead>
          <tr>
            <th class="sn">S/N</th>
            <th>Service</th>
            <th>Category</th>
            <th class="amount">Tariff Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <section class="summary">
        <div>Total Services: ${input.services.length}</div>
        <div>Total Tariff Value: ${formatCurrency(totalTariff)}</div>
      </section>

      <section class="signatures">
        <div class="sig-card">
          <p><strong>For Provider Hospital</strong></p>
          <div class="sig-line"></div>
          <p>${escapeHtml(providerName)}</p>
          <p class="muted">${escapeHtml(providerAddress)}</p>
          <p class="muted">Date: ____________________</p>
        </div>

        <div class="sig-card">
          <p><strong>For Crown Jewel HMO</strong></p>
          <p><span class="stamp">DIGITALLY SIGNED</span></p>
          <div class="sig-line"></div>
          <p>${cjhSignatoryName}</p>
          <p class="muted">${cjhSignatoryTitle}</p>
          <p class="muted">Signed At: ${signedAtLabel}</p>
        </div>
      </section>
    </section>
  </body>
</html>
  `
}

function getChromeExecutablePath() {
  const envCandidates = [
    process.env.MSA_PDF_CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
  ].filter((candidate): candidate is string => Boolean(candidate))

  const commonPaths = [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/snap/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ]

  for (const candidate of [...envCandidates, ...commonPaths]) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  const commandCandidates = ["google-chrome", "google-chrome-stable", "chromium-browser", "chromium"]
  for (const command of commandCandidates) {
    const result = spawnSync("which", [command], { encoding: "utf8" })
    if (result.status === 0) {
      const resolved = result.stdout.trim()
      if (resolved) {
        return resolved
      }
    }
  }

  return null
}

async function tryGenerateMsaPdfFromHtml(input: GenerateMsaPdfInput): Promise<Uint8Array | null> {
  const chromePath = getChromeExecutablePath()
  if (!chromePath) {
    return null
  }

  const tempDir = mkdtempSync(join(tmpdir(), "msa-html-pdf-"))
  const inputPath = join(tempDir, "msa.html")
  const outputPath = join(tempDir, "msa.pdf")

  try {
    writeFileSync(inputPath, await buildMsaHtml(input), "utf8")
    const fileUrl = `file://${inputPath}`

    const args = [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      `--print-to-pdf=${outputPath}`,
      "--print-to-pdf-no-header",
      fileUrl,
    ]

    let result = spawnSync(chromePath, args, {
      encoding: "utf8",
      timeout: 60000,
      maxBuffer: 1024 * 1024 * 4,
    })

    if (result.status !== 0 || !existsSync(outputPath)) {
      // Fall back for older Chrome versions that do not support --headless=new.
      result = spawnSync(
        chromePath,
        [
          "--headless",
          "--disable-gpu",
          "--no-sandbox",
          "--disable-dev-shm-usage",
          `--print-to-pdf=${outputPath}`,
          "--print-to-pdf-no-header",
          fileUrl,
        ],
        {
          encoding: "utf8",
          timeout: 60000,
          maxBuffer: 1024 * 1024 * 4,
        }
      )
    }

    if (result.status !== 0 || !existsSync(outputPath)) {
      const stderr = result.stderr?.trim()
      if (stderr) {
        console.warn("[MSA PDF] HTML renderer failed:", stderr)
      }
      return null
    }

    return new Uint8Array(readFileSync(outputPath))
  } catch (error) {
    console.warn("[MSA PDF] HTML renderer exception:", error)
    return null
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

function drawHeader(page: any, width: number, y: number, boldFont: any, normalFont: any, input: GenerateMsaPdfInput) {
  const commencementDate = input.commenceDate || input.generatedAt
  const terminationDate = addOneYear(commencementDate)

  page.drawText("Medical Service Agreement (MSA)", {
    x: PAGE_MARGIN,
    y,
    size: 18,
    font: boldFont,
    color: rgb(0.05, 0.34, 0.3),
  })

  page.drawText(`MSA ID: ${input.msaId}`, {
    x: PAGE_MARGIN,
    y: y - 24,
    size: 10,
    font: normalFont,
    color: rgb(0.2, 0.2, 0.2),
  })

  page.drawText(`Tariff Plan: ${input.tariffPlanId}${input.version ? ` (v${input.version})` : ""}`, {
    x: PAGE_MARGIN,
    y: y - 38,
    size: 10,
    font: normalFont,
    color: rgb(0.2, 0.2, 0.2),
  })

  page.drawText(`Commencement Date: ${formatDateTime(commencementDate)}`, {
    x: PAGE_MARGIN,
    y: y - 52,
    size: 10,
    font: normalFont,
    color: rgb(0.2, 0.2, 0.2),
  })

  page.drawText(`Termination Date: ${formatDateTime(terminationDate)}`, {
    x: PAGE_MARGIN,
    y: y - 66,
    size: 10,
    font: normalFont,
    color: rgb(0.2, 0.2, 0.2),
  })

  page.drawText(`Generated: ${formatDateTime(input.generatedAt)}`, {
    x: PAGE_MARGIN,
    y: y - 80,
    size: 10,
    font: normalFont,
    color: rgb(0.2, 0.2, 0.2),
  })

  const rightColX = width - PAGE_MARGIN - 220
  page.drawText("Provider", {
    x: rightColX,
    y: y - 24,
    size: 10,
    font: boldFont,
    color: rgb(0.12, 0.12, 0.12),
  })

  const providerLines = [
    input.provider.facility_name,
    input.provider.address || "",
    input.provider.email || "",
    input.provider.phone_whatsapp || "",
  ].filter(Boolean)

  providerLines.forEach((line, index) => {
    page.drawText(line, {
      x: rightColX,
      y: y - 38 - index * 12,
      size: 9,
      font: normalFont,
      color: rgb(0.2, 0.2, 0.2),
      maxWidth: 220,
    })
  })
}

function drawAgreementClause(page: any, y: number, normalFont: any, input: GenerateMsaPdfInput) {
  const providerName = input.provider.facility_name || "Provider Hospital"
  const providerAddress = input.provider.address || "Address not provided"
  const commencementDate = input.commenceDate || input.generatedAt
  const terminationDate = addOneYear(commencementDate)

  const clauseOne = `This Medical Service Agreement is made this ${formatLegalDate(commencementDate)} BETWEEN Crown Jewel HMO and ${providerName} of ${providerAddress} (Provider Hospital).`
  const clauseTwo = `The agreement shall commence from ${formatLegalDate(commencementDate)} and terminate on ${formatLegalDate(terminationDate)}, unless earlier terminated in accordance with the terms of this Agreement.`

  page.drawText(clauseOne, {
    x: PAGE_MARGIN,
    y,
    size: 9,
    font: normalFont,
    color: rgb(0.16, 0.16, 0.16),
    maxWidth: 500,
    lineHeight: 12,
  })

  page.drawText(clauseTwo, {
    x: PAGE_MARGIN,
    y: y - 30,
    size: 9,
    font: normalFont,
    color: rgb(0.16, 0.16, 0.16),
    maxWidth: 500,
    lineHeight: 12,
  })
}

function drawTableHeader(page: any, y: number, boldFont: any) {
  page.drawRectangle({
    x: PAGE_MARGIN,
    y: y - 4,
    width: 500,
    height: 18,
    color: rgb(0.93, 0.94, 0.95),
  })

  page.drawText("S/N", { x: PAGE_MARGIN + 6, y, size: 9, font: boldFont })
  page.drawText("Service", { x: PAGE_MARGIN + 40, y, size: 9, font: boldFont })
  page.drawText("Category", { x: PAGE_MARGIN + 275, y, size: 9, font: boldFont })
  page.drawText("Price", { x: PAGE_MARGIN + 430, y, size: 9, font: boldFont })
}

function splitTextToLines(text: string, font: any, fontSize: number, maxWidth: number) {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (!normalized) {
    return [""]
  }

  const words = normalized.split(" ")
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    const width = font.widthOfTextAtSize(candidate, fontSize)
    if (width <= maxWidth) {
      current = candidate
      continue
    }

    if (current) {
      lines.push(current)
      current = word
    } else {
      lines.push(word)
      current = ""
    }
  }

  if (current) {
    lines.push(current)
  }

  return lines
}

function isClauseHeading(line: string) {
  const normalized = line.trim()
  if (!normalized) return false
  if (/^\d+\s*\./.test(normalized)) return true
  if (/^[A-Z\s()\-]{8,}$/.test(normalized)) return true
  if (/^[IVXLC]+\s*\./.test(normalized)) return true
  return false
}

async function generateMsaPdfBufferWithPdfLib(input: GenerateMsaPdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const normalFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const pageSize: [number, number] = [595.28, 841.89] // A4
  let page = pdfDoc.addPage(pageSize)
  const width = pageSize[0]
  const height = pageSize[1]
  let cursorY = height - PAGE_MARGIN
  const contentWidth = width - PAGE_MARGIN * 2

  const commencementDate = input.commenceDate || input.generatedAt
  const terminationDate = addOneYear(commencementDate)
  const providerName = input.provider.facility_name || "Provider Hospital"
  const providerAddress = input.provider.address || "Address not provided"
  const legalCommencementDate = formatLegalDate(commencementDate)
  const legalTerminationDate = formatLegalDate(terminationDate)

  const templateParagraphs = await getTemplateParagraphs()
  const renderedParagraphs = templateParagraphs
    .map((line) => applyTemplateReplacements(line, providerName, providerAddress, legalCommencementDate, legalTerminationDate))
    .filter((line) => line.trim().length > 0)

  if (renderedParagraphs.length > 0) {
    page.drawText("Medical Service Agreement (MSA)", {
      x: PAGE_MARGIN,
      y: cursorY,
      size: 14,
      font: boldFont,
      color: rgb(0.05, 0.34, 0.3),
    })
    cursorY -= 24

    for (const paragraph of renderedParagraphs) {
      const heading = isClauseHeading(paragraph)
      const font = heading ? boldFont : normalFont
      const fontSize = heading ? 10 : 9
      const lineHeight = heading ? 14 : 12
      const lines = splitTextToLines(paragraph, font, fontSize, contentWidth)
      const blockHeight = lines.length * lineHeight + (heading ? 8 : 6)

      if (cursorY - blockHeight < PAGE_MARGIN) {
        page = pdfDoc.addPage(pageSize)
        cursorY = height - PAGE_MARGIN
      }

      for (const line of lines) {
        page.drawText(line, {
          x: PAGE_MARGIN,
          y: cursorY,
          size: fontSize,
          font,
          color: rgb(0.12, 0.12, 0.12),
          maxWidth: contentWidth,
        })
        cursorY -= lineHeight
      }

      cursorY -= heading ? 8 : 6
    }

    if (input.approvalComment) {
      const commentHeadingHeight = 16
      const commentLines = splitTextToLines(input.approvalComment, normalFont, 9, contentWidth)
      const commentBlockHeight = commentHeadingHeight + commentLines.length * 12 + 8
      if (cursorY - commentBlockHeight < PAGE_MARGIN) {
        page = pdfDoc.addPage(pageSize)
        cursorY = height - PAGE_MARGIN
      }

      page.drawText("Executive Comment:", {
        x: PAGE_MARGIN,
        y: cursorY,
        size: 10,
        font: boldFont,
        color: rgb(0.12, 0.12, 0.12),
      })
      cursorY -= 14

      for (const line of commentLines) {
        page.drawText(line, {
          x: PAGE_MARGIN,
          y: cursorY,
          size: 9,
          font: normalFont,
          color: rgb(0.2, 0.2, 0.2),
          maxWidth: contentWidth,
        })
        cursorY -= 12
      }

      cursorY -= 6
    }
  } else {
    // Fallback if template parsing fails completely.
    drawHeader(page, width, cursorY, boldFont, normalFont, input)
    cursorY -= 140
    drawAgreementClause(page, cursorY, normalFont, input)
  }

  // Tariff schedule must remain on the final appendix pages.
  page = pdfDoc.addPage(pageSize)
  cursorY = height - PAGE_MARGIN

  page.drawText("Tariff Schedule (Appendix)", {
    x: PAGE_MARGIN,
    y: cursorY,
    size: 14,
    font: boldFont,
    color: rgb(0.05, 0.34, 0.3),
  })
  cursorY -= 28

  drawTableHeader(page, cursorY, boldFont)
  cursorY -= 22

  let total = 0
  input.services.forEach((service, index) => {
    if (cursorY < PAGE_MARGIN + 30) {
      page = pdfDoc.addPage(pageSize)
      cursorY = height - PAGE_MARGIN
      drawTableHeader(page, cursorY, boldFont)
      cursorY -= 22
    }

    total += service.price || 0
    const rowY = cursorY
    page.drawText(String(index + 1), {
      x: PAGE_MARGIN + 6,
      y: rowY,
      size: 9,
      font: normalFont,
      color: rgb(0.2, 0.2, 0.2),
    })

    page.drawText(service.service_name || "-", {
      x: PAGE_MARGIN + 40,
      y: rowY,
      size: 9,
      font: normalFont,
      maxWidth: 220,
      color: rgb(0.2, 0.2, 0.2),
    })

    page.drawText(service.category_name || "-", {
      x: PAGE_MARGIN + 275,
      y: rowY,
      size: 9,
      font: normalFont,
      maxWidth: 140,
      color: rgb(0.2, 0.2, 0.2),
    })

    page.drawText(formatCurrency(service.price || 0), {
      x: PAGE_MARGIN + 430,
      y: rowY,
      size: 9,
      font: normalFont,
      maxWidth: 90,
      color: rgb(0.2, 0.2, 0.2),
    })

    cursorY -= ROW_HEIGHT
  })

  if (cursorY < PAGE_MARGIN + 40) {
    page = pdfDoc.addPage(pageSize)
    cursorY = height - PAGE_MARGIN
  }

  page.drawLine({
    start: { x: PAGE_MARGIN, y: cursorY },
    end: { x: width - PAGE_MARGIN, y: cursorY },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  })
  cursorY -= 18

  page.drawText(`Total Services: ${input.services.length}`, {
    x: PAGE_MARGIN,
    y: cursorY,
    size: 10,
    font: boldFont,
  })

  page.drawText(`Total Tariff Value: ${formatCurrency(total)}`, {
    x: PAGE_MARGIN + 250,
    y: cursorY,
    size: 10,
    font: boldFont,
  })

  cursorY -= 42

  const cjhSignatoryName = input.cjhSignatoryName || "Authorized Signatory"
  const cjhSignatoryTitle = input.cjhSignatoryTitle || "For: Crown Jewel HMO"

  page.drawText("For Provider Hospital", {
    x: PAGE_MARGIN,
    y: cursorY,
    size: 10,
    font: boldFont,
  })

  cursorY -= 14
  page.drawText("Authorized Signatory: ___________________________", {
    x: PAGE_MARGIN,
    y: cursorY,
    size: 10,
    font: normalFont,
  })

  cursorY -= 14
  page.drawText(`Provider: ${input.provider.facility_name}`, {
    x: PAGE_MARGIN,
    y: cursorY,
    size: 9,
    font: normalFont,
    maxWidth: 260,
    color: rgb(0.2, 0.2, 0.2),
  })

  cursorY -= 12
  page.drawText(`Address: ${providerAddress}`, {
    x: PAGE_MARGIN,
    y: cursorY,
    size: 9,
    font: normalFont,
    maxWidth: 260,
    color: rgb(0.2, 0.2, 0.2),
  })

  const rightColX = PAGE_MARGIN + 280
  let rightColY = cursorY + 26
  page.drawText("For Crown Jewel HMO", {
    x: rightColX,
    y: rightColY,
    size: 10,
    font: boldFont,
  })

  rightColY -= 14
  page.drawText("Digitally Signed", {
    x: rightColX,
    y: rightColY,
    size: 9,
    font: boldFont,
    color: rgb(0.03, 0.48, 0.33),
  })

  rightColY -= 14
  page.drawText(cjhSignatoryName, {
    x: rightColX,
    y: rightColY,
    size: 9,
    font: normalFont,
    maxWidth: 220,
  })

  rightColY -= 12
  page.drawText(cjhSignatoryTitle, {
    x: rightColX,
    y: rightColY,
    size: 9,
    font: normalFont,
    maxWidth: 220,
    color: rgb(0.2, 0.2, 0.2),
  })

  rightColY -= 12
  page.drawText(`Signed At: ${formatDateTime(input.generatedAt)}`, {
    x: rightColX,
    y: rightColY,
    size: 8,
    font: normalFont,
    maxWidth: 220,
    color: rgb(0.2, 0.2, 0.2),
  })

  return pdfDoc.save()
}

export async function generateMsaPdfBuffer(input: GenerateMsaPdfInput): Promise<Uint8Array> {
  const htmlRenderedPdf = await tryGenerateMsaPdfFromHtml(input)
  if (htmlRenderedPdf) {
    return htmlRenderedPdf
  }

  return generateMsaPdfBufferWithPdfLib(input)
}
