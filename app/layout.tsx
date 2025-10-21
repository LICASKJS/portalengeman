import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Portal de Fornecedores - Engeman",
  description:
    "Portal oficial de fornecedores da Engeman. Cadastre-se, acompanhe homologações e gerencie seus documentos.",
  keywords: "engeman, fornecedores, portal, homologação, cadastro, documentos",
  authors: [{ name: "Engeman" }],
  viewport: "width=device-width, initial-scale=1",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ff8e53" },
    { media: "(prefers-color-scheme: dark)", color: "#00d9ff" },
  ],
  openGraph: {
    title: "Portal de Fornecedores - Engeman",
    description:
      "Portal oficial de fornecedores da Engeman. Cadastre-se, acompanhe homologações e gerencie seus documentos.",
    type: "website",
    locale: "pt_BR",
  },
  robots: {
    index: true,
    follow: true,
  },
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="/ico.png" type="image/png" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Portal Engeman" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />

      </head>
      <body className={`${inter.className} antialiased`}>
        <div id="root">{children}</div>
      </body>
    </html>
  )
}
