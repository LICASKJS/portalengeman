"use client"

{/* Bibliotecas utilizadas */}

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  FileText,
  Filter,
  Loader2,
  LogOut,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  TrendingUp,
  Users,
  XCircle,
  ArrowRight,
} from "lucide-react"
import type { JSX } from "react/jsx-runtime"

{/* URL temporária de hospedagem do back-end*/}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
const STORAGE_TOKEN_KEY = "admin_portal_token"
const STORAGE_EMAIL_KEY = "admin_portal_email"

const ADMIN_HINT = "Acesso restrito aos administradores"

{/* Número real dos dados dos fornecedores */}

type DashboardResumo = {
  total_cadastrados: number
  total_aprovados: number
  total_em_analise: number
  total_reprovados: number
  total_documentos: number
}

{/* Documentos anexados pelos fornecedores no portal */}

type DocumentoResumo = {
  id: number
  nome: string
  categoria: string
  data_upload: string | null
}

{/* Aprovação do fornecedor */}

type FornecedorAdmin = {
  id: number
  nome: string
  email: string
  cnpj: string
  categoria?: string | null
  status: "APROVADO" | "A CADASTRAR " | "REPROVADO"
  aprovado: boolean
  nota_homologacao: number | null
  nota_iqf: number | null
  documentos: DocumentoResumo[]
  total_documentos: number
  ultima_atividade: string | null
  data_cadastro: string | null
}

{/* Notificação em tempo real */}

type NotificacaoItem = {
  id: string
  tipo: "cadastro" | "documento"
  titulo: string
  descricao: string
  timestamp: string
  detalhes?: Record<string, string>
}

type StatusFiltro = "TODOS" | "APROVADO" | "REPROVADO" | "PENDENTE"

function formatNumber(value: number | undefined): string {
  if (value === undefined || value === null) return "0"
  return new Intl.NumberFormat("pt-BR").format(value)
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}

function formatRelativeTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "agora"
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.round(diffMs / (60 * 1000))
  if (diffMinutes < 1) return "agora"
  if (diffMinutes < 60) return `há ${diffMinutes} min`
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `há ${diffHours} h`
  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 7) return `há ${diffDays} d`
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date)
}

function shortenDocumentName(value: string, maxLength = 36): string {
  const formatted = (value || "").trim()
  if (formatted.length <= maxLength) return formatted
  const safeLength = Math.max(3, maxLength - 3)
  return `${formatted.slice(0, safeLength).trimEnd()}...`
}

function normalizeNota(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null

    const numericSymbols = trimmed.replace(/[^\d,.\-]/g, "")
    if (!numericSymbols) return null

    const lastComma = numericSymbols.lastIndexOf(",")
    const lastDot = numericSymbols.lastIndexOf(".")
    let normalized = numericSymbols

    if (lastComma > -1 && lastDot > -1) {
      normalized =
        lastComma > lastDot
          ? numericSymbols.replace(/\./g, "").replace(/,/g, ".")
          : numericSymbols.replace(/,/g, "")
    } else if (lastComma > -1) {
      normalized = numericSymbols.replace(/\./g, "").replace(/,/g, ".")
    } else if (lastDot > -1) {
      const parts = numericSymbols.split(".")
      const decimal = parts.pop()
      normalized = `${parts.join("")}.${decimal ?? ""}`
    }

    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function formatNota(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—"
  }

  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

{/* Função de nota homologação e IQF na tabela/dashboard da tela de admin*/}

function adaptFornecedores(lista: unknown[]): FornecedorAdmin[] {
  return lista
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const base = item as Record<string, unknown> & Partial<FornecedorAdmin>
      const notaIQF =
        normalizeNota(
          base.nota_iqf ??
            base.notaIQF ??
            base["media_iqf"] ??
            base["mediaIQF"] ??
            base["iqf"] ??
            base["nota_iqf_media"] ??
            base["notaIQFMedia"],
        ) ?? null

      const notaHomologacao =
        normalizeNota(
          base.nota_homologacao ??
            base.notaHomologacao ??
            base["media_homologacao"] ??
            base["mediaHomologacao"] ??
            base["homologacao"] ??
            base["nota_homolog"],
        ) ?? null

      return {
        ...(item as FornecedorAdmin),
        nota_iqf: notaIQF,
        nota_homologacao: notaHomologacao,
      }
    })
}

function normalizarStatus(rawStatus: string | null | undefined): "APROVADO" | "REPROVADO" | "PENDENTE" {
  const normalized = (rawStatus ?? "").toString().trim().toUpperCase()
  if (normalized === "APROVADO") return "APROVADO"
  if (normalized === "REPROVADO") return "REPROVADO"
  return "PENDENTE"
}

function statusConfig(status: FornecedorAdmin["status"], isDarkMode: boolean) {
  const normalized = normalizarStatus(status)
  switch (normalized) {
    case "APROVADO":
      return {
        label: "Aprovado",
        color: isDarkMode ? "text-emerald-400" : "text-emerald-600",
        bg: isDarkMode ? "bg-emerald-500/10" : "bg-emerald-100",
        border: isDarkMode ? "border-emerald-500/30" : "border-emerald-300",
        icon: <CheckCircle2 className="w-4 h-4" />,
      }
    case "REPROVADO":
      return {
        label: "Reprovado",
        color: isDarkMode ? "text-red-400" : "text-red-600",
        bg: isDarkMode ? "bg-red-500/10" : "bg-red-100",
        border: isDarkMode ? "border-red-500/30" : "border-red-300",
        icon: <XCircle className="w-4 h-4" />,
      }
    default:
      return {
        label: "A cadastrar",
        color: isDarkMode ? "text-amber-400" : "text-amber-600",
        bg: isDarkMode ? "bg-amber-500/10" : "bg-amber-100",
        border: isDarkMode ? "border-amber-500/30" : "border-amber-300",
        icon: <AlertCircle className="w-4 h-4" />,
      }
  }
}

function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
{/* Funções para controlar os dados, documentos e notas dos fornecedores*/}

export default function AdminDashboardPage() {
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [dashboard, setDashboard] = useState<DashboardResumo | null>(null)
  const [fornecedores, setFornecedores] = useState<FornecedorAdmin[]>([])
  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>([])
  const [carregandoDashboard, setCarregandoDashboard] = useState(false)
  const [carregandoFornecedores, setCarregandoFornecedores] = useState(false)
  const [carregandoNotificacoes, setCarregandoNotificacoes] = useState(false)
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState("")
  const [filtroStatus, setFiltroStatus] = useState<StatusFiltro>("TODOS")
  const [filtroAberto, setFiltroAberto] = useState(false)
  const filtroRef = useRef<HTMLDivElement | null>(null)
  const [processandoDecisaoId, setProcessandoDecisaoId] = useState<number | null>(null)
  const [downloadDocumentoId, setDownloadDocumentoId] = useState<number | null>(null)
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [adminEmail, setAdminEmail] = useState<string | null>(null)
  const [loginEmail, setLoginEmail] = useState("")
  const [loginSenha, setLoginSenha] = useState("")
  const [loginErro, setLoginErro] = useState<string | null>(null)
  const [autenticando, setAutenticando] = useState(false)
  const buscaDebounced = useDebounce(busca)

  const totaisPorStatus = useMemo(() => (
    fornecedores.reduce(
      (acumulado, fornecedor) => {
        const statusNormalizado = normalizarStatus(fornecedor.status)
        acumulado[statusNormalizado] += 1
        return acumulado
      },
      { APROVADO: 0, REPROVADO: 0, PENDENTE: 0 } as Record<"APROVADO" | "REPROVADO" | "PENDENTE", number>,
    )
  ), [fornecedores])

  const fornecedoresFiltrados = useMemo(() => {
    if (filtroStatus === "TODOS") {
      return fornecedores
    }
    return fornecedores.filter((fornecedor) => {
      const statusNormalizado = normalizarStatus(fornecedor.status)
      if (filtroStatus === "PENDENTE") {
        return statusNormalizado === "PENDENTE"
      }
      return statusNormalizado === filtroStatus
    })
  }, [fornecedores, filtroStatus])

  {/* Filtragem de acesso*/}

  const opcoesFiltro = useMemo(() => [
    {
      valor: "TODOS" as StatusFiltro,
      rotulo: "Todos",
      descricao: "Mostrar todos os fornecedores",
      contagem: fornecedores.length,
    },
    {
      valor: "APROVADO" as StatusFiltro,
      rotulo: "Aprovados",
      descricao: "Somente fornecedores homologados",
      contagem: totaisPorStatus.APROVADO,
    },
    {
      valor: "PENDENTE" as StatusFiltro,
      rotulo: "A cadastrar",
      descricao: "Cadastros aguardando decisao",
      contagem: totaisPorStatus.PENDENTE,
    },
    {
      valor: "REPROVADO" as StatusFiltro,
      rotulo: "Reprovados",
      descricao: "Fornecedores nao aprovados",
      contagem: totaisPorStatus.REPROVADO,
    },
  ], [fornecedores.length, totaisPorStatus.APROVADO, totaisPorStatus.PENDENTE, totaisPorStatus.REPROVADO])

  const filtroSelecionado = useMemo(
    () => opcoesFiltro.find((opcao) => opcao.valor === filtroStatus),
    [opcoesFiltro, filtroStatus],
  )

  useEffect(() => {
    if (!filtroAberto) return
    const handleClickOutside = (event: MouseEvent) => {
      if (filtroRef.current && !filtroRef.current.contains(event.target as Node)) {
        setFiltroAberto(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [filtroAberto])

  useEffect(() => {
    if (!mensagemSucesso) return
    const timer = window.setTimeout(() => setMensagemSucesso(null), 4000)
    return () => window.clearTimeout(timer)
  }, [mensagemSucesso])

  useEffect(() => {
    const currentTheme = localStorage.getItem("theme") || "dark"
    setIsDarkMode(currentTheme === "dark")

    if (currentTheme === "dark") {
      document.body.classList.add("dark-mode")
      document.body.classList.remove("light-mode")
    } else {
      document.body.classList.add("light-mode")
      document.body.classList.remove("dark-mode")
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = isDarkMode ? "light" : "dark"
    setIsDarkMode(!isDarkMode)

    if (newTheme === "dark") {
      document.body.classList.add("dark-mode")
      document.body.classList.remove("light-mode")
    } else {
      document.body.classList.add("light-mode")
      document.body.classList.remove("dark-mode")
    }

    localStorage.setItem("theme", newTheme)
  }

  const getGradientClasses = () => {
    return isDarkMode ? "bg-gradient-to-r from-orange-400 to-red-500" : "bg-gradient-to-r from-orange-400 to-red-500"
  }

  const getAccentColor = () => {
    return isDarkMode ? "text-orange-400" : "text-orange-500"
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    const storedToken = localStorage.getItem(STORAGE_TOKEN_KEY)
    const storedEmail = localStorage.getItem(STORAGE_EMAIL_KEY)
    if (storedToken) {
      setToken(storedToken)
      setAdminEmail(storedEmail)
    }
  }, [])

  useEffect(() => {
    if (!token) {
      setDashboard(null)
      setFornecedores([])
      setNotificacoes([])
    }
  }, [token])

  const handleLogout = () => {
    setToken(null)
    setAdminEmail(null)
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_TOKEN_KEY)
      localStorage.removeItem(STORAGE_EMAIL_KEY)
    }
  }

  const authorizedFetch = async (path: string, options: RequestInit = {}) => {
    if (!token) throw new Error("Token não disponível")
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    })
    if (response.status === 401 || response.status === 403) {
      handleLogout()
      throw new Error("Sessão expirada")
    }
    return response
  }

  {/* Tela de Login com acesso apenas aos admin*/}

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoginErro(null)
    setAutenticando(true)
    try {
      const resposta = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, senha: loginSenha }),
      })
      if (!resposta.ok) {
        setLoginErro("Credenciais inválidas. Verifique o e-mail autorizado e a senha informada.")
        return
      }
      const dados = await resposta.json()
      const novoToken = dados.access_token as string
      setToken(novoToken)
      setAdminEmail(loginEmail.trim())
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_TOKEN_KEY, novoToken)
        localStorage.setItem(STORAGE_EMAIL_KEY, loginEmail.trim())
      }
      setLoginSenha("")
    } catch (error) {
      console.error(error)
      setLoginErro("Erro ao autenticar. Tente novamente em instantes.")
    } finally {
      setAutenticando(false)
    }
  }

  const handleSelecionarFiltroStatus = (valor: StatusFiltro) => {
    setFiltroStatus(valor)
    setFiltroAberto(false)
  }

{/* Função de decisão para aprovar ou reprovar o fornecedor */}

  const handleRegistrarDecisao = async (fornecedor: FornecedorAdmin, status: "APROVADO" | "REPROVADO") => {
    const confirmacaoMensagem =
      status === "APROVADO"
        ? `Confirma a aprovacao do fornecedor ${fornecedor.nome}? Um e-mail será enviado com o resultado.`
        : `Confirma a reprovacao do fornecedor ${fornecedor.nome}? Um e-mail será enviado com o resultado.`
    const confirmacao = window.confirm(confirmacaoMensagem)
    if (!confirmacao) return
    try {
      setProcessandoDecisaoId(fornecedor.id)
      setErro(null)
      const observacaoPadrao =
        status === "APROVADO"
          ? "Fornecedor aprovado no processo de homologação."
          : "Fornecedor reprovado no processo de homologação."
      const payload = {
        status,
        notaReferencia: null,
        observacao: observacaoPadrao,
        enviarEmail: true,
      }
      const resposta = await authorizedFetch(`/api/admin/fornecedores/${fornecedor.id}/decisao`, {
        method: "POST",
        body: JSON.stringify(payload),
      })
      const dados = await resposta.json()
      if (!resposta.ok) {
        setErro(dados?.message ?? "Não foi possível registrar a decisão.")
        return
      }
      if (dados?.fornecedor) {
        const fornecedorAtualizado = adaptFornecedores([dados.fornecedor])[0]
        if (fornecedorAtualizado) {
          setFornecedores((prev) =>
            prev.map((item) => (item.id === fornecedorAtualizado.id ? fornecedorAtualizado : item)),
          )
        }
      } else {
        const params = buscaDebounced ? `?search=${encodeURIComponent(buscaDebounced)}` : ""
        const listaResposta = await authorizedFetch(`/api/admin/fornecedores${params}`)
        const listaDados = await listaResposta.json()
        if (Array.isArray(listaDados)) {
          setFornecedores(adaptFornecedores(listaDados))
        } else if (listaDados && Array.isArray(listaDados.fornecedores)) {
          setFornecedores(adaptFornecedores(listaDados.fornecedores))
        }
      }
      const emailEnviadoFlag = dados?.emailEnviado
      let mensagemFinal =
        status === "APROVADO"
          ? `Fornecedor ${fornecedor.nome} aprovado com sucesso.`
          : `Fornecedor ${fornecedor.nome} marcado como reprovado.`
      if (emailEnviadoFlag === false) {
        mensagemFinal += " Email nao foi enviado automaticamente. Verifique as configuracoes."
      } else {
        mensagemFinal += " Email enviado ao fornecedor com o resultado."
      }
      setMensagemSucesso(mensagemFinal.trim())
    } catch (error) {
      console.error(error)
      setErro("Falha ao registrar a decisao. Tente novamente.")
    } finally {
      setProcessandoDecisaoId(null)
    }
  }

{/*Função para baixar documentos dos fornecedores */}

  const handleDownloadDocumento = async (documento: DocumentoResumo) => {
    try {
      setDownloadDocumentoId(documento.id)
      setErro(null)
      const resposta = await authorizedFetch(`/api/admin/documentos/${documento.id}/download`, {
        method: "GET",
      })
      if (!resposta.ok) {
        setErro("Nao foi possivel baixar o documento. Tente novamente.")
        return
      }
      const blob = await resposta.blob()
      const url = window.URL.createObjectURL(blob)
      window.open(url, "_blank", "noopener")
      const link = document.createElement("a")
      link.href = url
      link.download = documento.nome || `documento-${documento.id}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => window.URL.revokeObjectURL(url), 2000)
      setMensagemSucesso(`Download iniciado para ${documento.nome}`)
    } catch (error) {
      console.error(error)
      setErro("Nao foi possivel baixar o documento. Tente novamente.")
    } finally {
      setDownloadDocumentoId(null)
    }
  }

  useEffect(() => {
    if (!token) return
    const carregarDashboard = async () => {
      try {
        setCarregandoDashboard(true)
        const resposta = await authorizedFetch("/api/admin/dashboard")
        const dados = await resposta.json()
        setDashboard(dados)
      } catch (error) {
        console.error(error)
        setErro("Falha ao carregar os indicadores do painel.")
      } finally {
        setCarregandoDashboard(false)
      }
    }

    const carregarNotificacoes = async () => {
      try {
        setCarregandoNotificacoes(true)
        const resposta = await authorizedFetch("/api/admin/notificacoes?limit=25")
        const dados = await resposta.json()
        if (Array.isArray(dados)) {
          setNotificacoes(dados)
        } else if (dados && Array.isArray(dados.eventos)) {
          setNotificacoes(dados.eventos)
        } else {
          setNotificacoes([])
          if (dados?.message) {
            setErro(dados.message)
          }
        }
      } catch (error) {
        console.error(error)
      } finally {
        setCarregandoNotificacoes(false)
      }
    }

    carregarDashboard()
    carregarNotificacoes()
  }, [token])

  useEffect(() => {
    if (!token) return
    const carregarFornecedores = async () => {
      try {
        setCarregandoFornecedores(true)
        const params = buscaDebounced ? `?search=${encodeURIComponent(buscaDebounced)}` : ""
        const resposta = await authorizedFetch(`/api/admin/fornecedores${params}`)
        const dados = await resposta.json()
        if (Array.isArray(dados)) {
          setFornecedores(adaptFornecedores(dados))
        } else if (dados && Array.isArray(dados.fornecedores)) {
          setFornecedores(adaptFornecedores(dados.fornecedores))
        } else {
          setFornecedores([])
          if (dados?.message) {
            setErro(dados.message)
          }
        }
      } catch (error) {
        console.error(error)
        setErro("Falha ao carregar a lista de fornecedores.")
      } finally {
        setCarregandoFornecedores(false)
      }
    }

    carregarFornecedores()
  }, [buscaDebounced, token])

  const handleGenerateMonthlyReport = () => {
    if (gerandoRelatorio || typeof window === "undefined") {
      return
    }

    {/* Função para gerar relatório mensal */}

    setGerandoRelatorio(true)
    setErro(null)

    try {
      const agora = new Date()
      const mesAtual = agora.getMonth()
      const anoAtual = agora.getFullYear()

      const fornecedoresDoMes = fornecedores.filter((fornecedor) => {
        if (!fornecedor.data_cadastro) return false
        const dataCadastro = new Date(fornecedor.data_cadastro)
        if (Number.isNaN(dataCadastro.getTime())) return false
        return dataCadastro.getMonth() === mesAtual && dataCadastro.getFullYear() === anoAtual
      })

      const totais = fornecedoresDoMes.reduce(
        (acumulado, fornecedor) => {
          acumulado.total += 1
          if (fornecedor.status === "APROVADO") {
            acumulado.aprovados += 1
          } else if (fornecedor.status === "REPROVADO") {
            acumulado.reprovados += 1
          } else {
            acumulado.emAnalise += 1
          }
          return acumulado
        },
        { total: 0, aprovados: 0, reprovados: 0, emAnalise: 0 },
      )

      const mesLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(agora)
      const dataGeracao = formatDateTime(agora.toISOString())

      const summaryCards = [
        {
          label: "Total cadastrados",
          valor: totais.total,
          bg: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(37,99,235,0.12))",
          border: "rgba(59,130,246,0.45)",
          text: "#1d4ed8",
        },
        {
          label: "Aprovados",
          valor: totais.aprovados,
          bg: "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(16,185,129,0.12))",
          border: "rgba(34,197,94,0.45)",
          text: "#047857",
        },
        {
          label: "A cadastrar",
          valor: totais.emAnalise,
          bg: "linear-gradient(135deg, rgba(234,179,8,0.1), rgba(249,115,22,0.12))",
          border: "rgba(234,179,8,0.45)",
          text: "#b45309",
        },
        {
          label: "Reprovados",
          valor: totais.reprovados,
          bg: "linear-gradient(135deg, rgba(248,113,113,0.1), rgba(239,68,68,0.12))",
          border: "rgba(248,113,113,0.45)",
          text: "#b91c1c",
        },
      ]

      const cardsHtml = summaryCards
        .map((card) => {
          const valorFormatado = formatNumber(card.valor)
          return `
            <div class="card" style="background:${card.bg};border-color:${card.border}">
              <div class="card-label">${card.label.toUpperCase()}</div>
              <div class="card-value" style="color:${card.text}">${valorFormatado}</div>
            </div>
          `
        })
        .join("")

      const emptyStateHtml =
        totais.total === 0 ? '<p class="empty-state">Não há fornecedores cadastrados neste mês.</p>' : ""

      const popup = window.open("", "_blank", "width=900,height=720")
      if (!popup || popup.closed) {
        throw new Error("popup_closed")
      }

      const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Relatório Mensal de Fornecedores</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', Arial, sans-serif;
      background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 60%, #e2e8f0 100%);
      color: #0f172a;
      padding: 40px 0 60px;
    }
    .wrapper {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffffcc;
      backdrop-filter: blur(12px);
      border-radius: 24px;
      padding: 48px;
      border: 1px solid rgba(148, 163, 184, 0.25);
      box-shadow: 0 40px 80px -32px rgba(15, 23, 42, 0.2);
    }
    header {
      text-align: center;
      margin-bottom: 40px;
    }
    header h1 {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 12px;
    }
    header p {
      font-size: 14px;
      color: #475569;
    }
    .meta {
      display: flex;
      justify-content: center;
      gap: 32px;
      margin-top: 12px;
      font-size: 13px;
      color: #64748b;
    }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px;
      margin-bottom: 28px;
    }
    .card {
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 18px;
      padding: 20px 22px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
    }
    .card-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.12em;
      color: #475569;
    }
    .card-value {
      margin-top: 12px;
      font-size: 34px;
      font-weight: 700;
      letter-spacing: -0.03em;
    }
    .divider {
      margin: 36px 0;
      height: 1px;
      background: linear-gradient(90deg, rgba(148, 163, 184, 0), rgba(148, 163, 184, 0.45), rgba(148, 163, 184, 0));
    }
    .context {
      text-align: center;
      font-size: 13px;
      color: #475569;
      line-height: 1.6;
    }
    .empty-state {
      margin-top: 16px;
      text-align: center;
      font-size: 14px;
      font-weight: 500;
      color: #64748b;
    }
    footer {
      margin-top: 40px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <header>
      <h1>Relatório Mensal de Fornecedores</h1>
      <p>Resumo de homologações e status no período.</p>
      <div class="meta">
        <span>Período: ${mesLabel}</span>
        <span>Gerado em: ${dataGeracao}</span>
      </div>
    </header>
    <section>
      <div class="cards-grid">
        ${cardsHtml}
      </div>
      ${emptyStateHtml}
      <div class="divider"></div>
      <p class="context">
        Os números refletem fornecedores com data de cadastro dentro do mês selecionado.
      </p>
    </section>
    <footer>
      Portal de Fornecedores Engeman — Relatório automático
    </footer>
  </div>
  <script>
    window.onload = function () {
      window.focus();
      setTimeout(function () {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`

      popup.document.open()
      popup.document.write(htmlContent)
      popup.document.close()
      popup.focus()
      setTimeout(() => {
        setGerandoRelatorio(false)
      }, 800)
    } catch (error) {
      console.error(error)
      setGerandoRelatorio(false)
      setErro("Não foi possível gerar o relatório mensal. Tente novamente.")
    }
  }

  {/* Cards com os resumos dos fornecedores cadastrados, reprovados, aprovados, a cadastrar*/}
  const resumoCards = useMemo(
    () => (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 transition-all duration-500">
        <ResumoCard
          title="Fornecedores cadastrados"
          value={formatNumber(dashboard?.total_cadastrados)}
          icon={<Users className="w-5 h-5" />}
          accent="from-orange-500 to-red-500"
          loading={carregandoDashboard}
          isDarkMode={isDarkMode}
        />
        <ResumoCard
          title="Aprovados"
          value={formatNumber(dashboard?.total_aprovados)}
          icon={<CheckCircle2 className="w-5 h-5" />}
          accent="from-emerald-500 to-green-500"
          loading={carregandoDashboard}
          isDarkMode={isDarkMode}
        />
        <ResumoCard
          title="A cadastrar"
          value={formatNumber(dashboard?.total_em_analise)}
          icon={<ShieldCheck className="w-5 h-5" />}
          accent="from-amber-500 to-orange-500"
          loading={carregandoDashboard}
          isDarkMode={isDarkMode}
        />
        <ResumoCard
          title="Reprovados"
          value={formatNumber(dashboard?.total_reprovados)}
          icon={<XCircle className="w-5 h-5" />}
          accent="from-pink-500 to-rose-500"
          loading={carregandoDashboard}
          isDarkMode={isDarkMode}
        />
        <ResumoCard
          title="Documentos enviados"
          value={formatNumber(dashboard?.total_documentos)}
          icon={<FileText className="w-5 h-5" />}
          accent="from-purple-500 to-indigo-500"
          loading={carregandoDashboard}
          isDarkMode={isDarkMode}
        />
      </div>
    ),
    [dashboard, carregandoDashboard, isDarkMode],
  )

  if (!token) {
    return (
      <div
        className={`min-h-screen transition-all duration-300 ${
          isDarkMode ? "bg-slate-900 text-white" : "bg-white text-slate-900"
        }`}
      >
        <div className="fixed inset-0 pointer-events-none z-0">
          <div
            className={`absolute w-96 h-96 -top-48 -right-48 rounded-full ${
              isDarkMode
                ? "bg-gradient-to-br  from-orange-400 to-red-500 opacity-5"
                : "bg-gradient-to-br from-orange-400 to-red-500 opacity-10"
            } animate-pulse`}
          ></div>
          <div
            className={`absolute w-72 h-72 -bottom-36 -left-36 rounded-full ${
              isDarkMode
                ? "bg-gradient-to-br  from-orange-400 to-red-500 opacity-5"
                : "bg-gradient-to-br from-orange-400 to-red-500 opacity-10"
            } animate-pulse delay-1000`}
          ></div>
        </div>

        {/* Menu principal (NAV) */}

        <div className="relative z-10 min-h-screen flex items-center justify-center px-6">
          <div
            className={`w-full max-w-xl rounded-3xl border backdrop-blur-xl shadow-2xl overflow-hidden transition-all duration-300 ${
              isDarkMode ? "bg-slate-800/95 border-slate-700" : "bg-white/95 border-slate-200"
            }`}
          >
            <div className="px-8 py-10 space-y-8">
              <div>
                <div
                  className={`inline-flex items-center gap-3 rounded-full border px-4 py-2 text-sm mb-4 ${
                    isDarkMode
                      ? "border-orange-500/30 bg-orange-500/10 text-orange-700"
                      : "border-orange-500/30 bg-orange-500/10 text-orange-700"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Portal Administrativo
                </div>
                <h1 className="text-3xl font-bold mb-2">Acesso restrito</h1>
                <p className={`text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>{ADMIN_HINT}</p>
              </div>

              {/* Input de e-mail e senha  */}

              <form className="space-y-5" onSubmit={handleLogin}>
                <div className="space-y-2">
                  <label
                    className={`text-xs uppercase tracking-widest ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                  >
                    E-mail corporativo
                  </label>
                  <div className="relative">
                    <Search
                      className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                    />
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(event) => setLoginEmail(event.target.value)}
                      placeholder="nome.sobrenome@engeman.net"
                      className={`w-full rounded-xl border py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 transition-all duration-300 ${
                        isDarkMode
                          ? "border-slate-700 bg-slate-900/80 focus:ring-orange-400/40"
                          : "border-slate-300 bg-slate-50 focus:ring-orange-400/40"
                      }`}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    className={`text-xs uppercase tracking-widest ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                  >
                    Senha
                  </label>
                  <input
                    type="password"
                    required
                    value={loginSenha}
                    onChange={(event) => setLoginSenha(event.target.value)}
                    placeholder="••••••••"
                    className={`w-full rounded-xl border py-3 px-3 text-sm focus:outline-none focus:ring-2 transition-all duration-300 ${
                      isDarkMode
                        ? "border-slate-700 bg-slate-900/80 focus:ring-orange-400/40"
                        : "border-slate-300 bg-slate-50 focus:ring-orange-400/40"
                    }`}
                  />
                  
                </div>

                {loginErro && (
                  <div
                    className={`rounded-xl border px-3 py-2 text-sm flex items-center gap-2 ${
                      isDarkMode
                        ? "border-red-500/30 bg-red-500/10 text-red-300"
                        : "border-red-300 bg-red-50 text-red-700"
                    }`}
                  >
                    <AlertCircle className="w-4 h-4" />
                    {loginErro}
                  </div>
                )}

                {/* Botão de acesso ao painel de admin*/}

                <button
                  type="submit"
                  disabled={autenticando}
                  className={`w-full flex items-center justify-center gap-2 text-white py-3 rounded-xl font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                    isDarkMode
                      ? "bg-gradient-to-r from-orange-400 to-red-500 hover:shadow-orange-400/25"
                      : "bg-gradient-to-r from-orange-400 to-red-500 hover:shadow-orange-400/25"
                  } ${autenticando ? "opacity-70 cursor-not-allowed" : ""}`}
                >
                  {autenticando ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Entrando...
                    </>
                  ) : (
                    <>
                      ENTRAR NO PAINEL
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              
            </div>
          </div>
        </div>

        {/* Botão de alterar tema (Modo claro/escuro)*/}

        <button
          onClick={toggleTheme}
          className={`fixed bottom-8 right-8 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl z-50 ${
            isDarkMode
              ? "bg-gradient-to-r from-orange-400 to-red-500 shadow-orange-400/25 hover:shadow-orange-400/40"
              : "bg-gradient-to-r from-orange-400 to-red-500 shadow-orange-400/25 hover:shadow-orange-400/40"
          }`}
          title="Alternar tema"
        >
          {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
        </button>
      </div>
    )
  }

  return (
    <div
      className={`min-h-screen transition-all duration-300 ${
        isDarkMode ? "bg-slate-900 text-white" : "bg-white text-slate-900"
      }`}
    >
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className={`absolute w-96 h-96 -top-48 -right-48 rounded-full ${
            isDarkMode
              ? "bg-gradient-to-br from-orange-400 to-red-500 opacity-5"
              : "bg-gradient-to-br from-orange-400 to-red-500 opacity-10"
          } animate-pulse`}
        ></div>
        <div
          className={`absolute w-72 h-72 -bottom-36 -left-36 rounded-full ${
            isDarkMode
              ? "bg-gradient-to-br from-orange-400 to-red-500 opacity-5"
              : "bg-gradient-to-br from-orange-400 to-red-500 opacity-10"
          } animate-pulse delay-1000`}
        ></div>
      </div>

      {/* Cabeçalho */}

      <header
        className={`fixed top-0 left-0 right-0 backdrop-blur-xl border-b z-50 transition-all duration-300 ${
          isDarkMode ? "bg-slate-900/95 border-slate-700" : "bg-white/95 border-slate-200"
        }`}
      >
        <div className="max-w-7xl mx-auto px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div>
              <img
              src={isDarkMode ? "/logo-marca.png" : "/colorida.png"}
              alt="Logo Engeman"
              className="h-8 mx-auto mb-3 transition-transform duration-300 hover:scale-100"
            />
            <p className={`text-xs ${isDarkMode ? "text-slate-300 text-center" : "text-slate-400 text-center"}`}>
                Portal de Fornecedores
              </p>
            </div>
            <div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-3 rounded-full border px-4 py-2 text-sm ${
                isDarkMode
                  ? "bg-slate-800 border-slate-700 text-slate-300"
                  : "bg-slate-100 border-slate-300 text-slate-600"
              }`}
            >
              <Users className={`w-4 h-4 ${getAccentColor()}`} />
              {adminEmail}
            </div>

            {/* Leva ao Mapa indicador de Suprimentos*/}
            <a
              href="https://mapaindicador-engeman.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5 ${
                isDarkMode
                  ? "border-slate-700 text-slate-300 hover:text-white hover:border-orange-400/60"
                  : "border-slate-300 text-slate-600 hover:text-slate-900 hover:border-orange-400/60"
              }`}
            >
              Mapa indicador
              <ArrowRight className="w-4 h-4" />
            </a>
            <button
              onClick={handleLogout}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5 ${
                isDarkMode
                  ? "border-slate-700 text-slate-300 hover:text-white hover:border-slate-600"
                  : "border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-400"
              }`}
            >
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </div>
      </header>

      {/* Sessão principal */}

      <main className="relative z-10 pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-8">
          <div className="mb-12">
            
            <h2 className="text-3xl md:text-4xl font-bold mb-4 p-1">
              Bem-vindo ao{" "}
              <span
                className={`bg-clip-text text-transparent ${
                  isDarkMode
                    ? "bg-gradient-to-r from-orange-400 to-red-500"
                    : "bg-gradient-to-r from-orange-400 to-red-500"
                }`}
              >
                Painel de Controle
              </span>
            </h2>
            <p className={`text-lg ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
              Acompanhe em tempo real o desempenho dos fornecedores, receba alertas sobre novos cadastros e monitore
              envios de documentos.
            </p>
          </div>

          {resumoCards}

          {mensagemSucesso && (
            <div
              className={`mt-8 rounded-xl border px-4 py-3 flex items-center gap-3 ${
                isDarkMode ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{mensagemSucesso}</span>
            </div>
          )}

          {erro && (
            <div
              className={`mt-8 rounded-xl border px-4 py-3 flex items-center gap-3 ${
                isDarkMode ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-red-300 bg-red-50 text-red-700"
              }`}
            >
              <AlertCircle className="w-5 h-5" />
              <span>{erro}</span>
            </div>
          )}
            {/* Tabela com os dados dos fornecedores e documentações */} 

          <div className="flex flex-col xl:flex-row gap-8 mt-12">
            <section className="flex-1">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-2xl font-bold mb-2">Fornecedores</h3>
                  <p className={`text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                    Pesquise por nome fantasia ou CNPJ para visualizar status e documentos atualizados.
                  </p>
                </div>
                <div className="flex items-center gap-3 w-full lg:w-auto">
                  <div className="relative flex-1 lg:w-72">
                    <Search
                      className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    />
                    <input
                      value={busca}
                      onChange={(event) => setBusca(event.target.value)}
                      placeholder="Buscar por nome ou CNPJ"
                      className={`w-full border rounded-xl py-2.5 pl-10 pr-12 text-sm focus:outline-none focus:ring-2 transition-all duration-300 ${
                        isDarkMode
                          ? "bg-slate-800 border-slate-700 focus:ring-orange-400/40"
                          : "bg-slate-50 border-slate-300 focus:ring-orange-400/40"
                      }`}
                    />
                    {busca && (
                      <button
                        onClick={() => setBusca("")}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                          isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Botão de filtragem com fornecedores aprovados, reprovados ou a cadastrar*/}

                  <div ref={filtroRef} className="relative w-full lg:w-auto">
                    <button
                      type="button"
                      onClick={() => setFiltroAberto((prev) => !prev)}
                      className={`flex items-center justify-between gap-2 w-full lg:w-auto border rounded-xl px-4 py-2 text-sm transition-all duration-300 ${
                        isDarkMode
                          ? "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                          : "bg-slate-50 border-slate-300 text-slate-600 hover:border-slate-400"
                      } ${filtroAberto ? "ring-2 ring-orange-400/40" : ""}`}
                      aria-expanded={filtroAberto}
                      aria-haspopup="true"
                    >
                      <Filter className="w-4 h-4" />
                      <span>{filtroSelecionado?.rotulo ?? "Filtro"}</span>
                      {filtroStatus !== "TODOS" && (
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            isDarkMode ? "bg-slate-700 text-slate-200" : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {fornecedoresFiltrados.length}
                        </span>
                      )}
                    </button>
                    {filtroAberto && (
                      <div
                        className={`absolute right-0 mt-2 w-64 rounded-2xl border shadow-xl z-30 ${
                          isDarkMode ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
                        }`}
                      >
                        <div className="p-2 space-y-1">
                          {opcoesFiltro.map((opcao) => {
                            const selecionado = opcao.valor === filtroStatus
                            return (
                              <button
                                key={opcao.valor}
                                type="button"
                                onClick={() => handleSelecionarFiltroStatus(opcao.valor)}
                                className={`w-full rounded-xl px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors duration-200 ${
                                  selecionado
                                    ? isDarkMode
                                      ? "bg-slate-800 border border-orange-400/40 text-orange-200"
                                      : "bg-orange-50 border border-orange-400/40 text-orange-700"
                                    : isDarkMode
                                      ? "text-slate-200 hover:bg-slate-800/70"
                                      : "text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                <div>
                                  <p className="font-semibold">{opcao.rotulo}</p>
                                  <p className={`text-xs mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                                    {opcao.descricao}
                                  </p>
                                </div>
                                <span
                                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                    selecionado
                                      ? isDarkMode
                                        ? "bg-orange-500/30 text-orange-200"
                                        : "bg-orange-100 text-orange-600"
                                      : isDarkMode
                                        ? "bg-slate-800 text-slate-300"
                                        : "bg-slate-200 text-slate-600"
                                  }`}
                                >
                                  {opcao.contagem}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Tabela de fornecedores */}
              <div
                className={`rounded-3xl border backdrop-blur shadow-2xl overflow-hidden transition-all duration-300 ${
                  isDarkMode ? "bg-slate-800/60 border-slate-700" : "bg-white/60 border-slate-200"
                }`}
              >
                <div className="overflow-x-auto">
                  <div className="md:min-w-[960px]">
                    <div
                      className={`hidden md:grid grid-cols-[24rem_repeat(4,_minmax(0,_1fr))] gap-8 px-8 py-5 text-xs font-medium uppercase tracking-widest border-b ${
                        isDarkMode
                          ? "text-slate-400 border-slate-700 bg-slate-800/80"
                          : "text-slate-500 border-slate-200 bg-slate-50/80"
                      }`}
                    >
                      <span>Fornecedor</span>
                      <span>Status</span>
                      <span>Notas</span>
                      <span>Documentos</span>
                      <span>Ações</span>
                    </div>

                    <div className={`divide-y ${isDarkMode ? "divide-slate-700/40" : "divide-slate-200/40"}`}>
                  {carregandoFornecedores ? (
                    <div
                      className={`flex items-center justify-center py-16 gap-3 ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Carregando fornecedores...
                    </div>
                  ) : fornecedoresFiltrados.length === 0 ? (
                    <div
                      className={`flex flex-col items-center justify-center py-16 gap-2 ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      <ShieldCheck className="w-8 h-8 opacity-50" />
                      <p className="text-sm">Nenhum fornecedor encontrado. Ajuste a busca ou os filtros.</p>
                    </div>
                  ) : (
                    fornecedoresFiltrados.map((fornecedor) => {
                      const status = statusConfig(fornecedor.status, isDarkMode)
                      const documentosVisiveis = fornecedor.documentos.slice(0, 3)
                      const documentosRestantes = fornecedor.total_documentos - documentosVisiveis.length

                      return (
                        <div
                          key={fornecedor.id}
                          className={`flex flex-col md:grid md:grid-cols-[24rem_repeat(4,_minmax(0,_1fr))] gap-5 md:gap-8 px-8 py-6 transition-colors ${
                            isDarkMode ? "hover:bg-slate-800/80" : "hover:bg-slate-50/80"
                          }`}
                        >
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-3">
                              <div
                                className={`rounded-xl p-2 ${
                                  isDarkMode
                                    ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/20 text-orange-300"
                                    : "bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/20 text-orange-600"
                                }`}
                              >
                                <Users className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-semibold leading-tight">{fornecedor.nome}</p>
                                <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                                  CNPJ {fornecedor.cnpj}
                                </p>
                                {fornecedor.categoria && (
                                  <p className={`text-xs mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                                    Categoria: {fornecedor.categoria}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div
                              className={`flex items-center gap-2 text-xs ${
                                isDarkMode ? "text-slate-400" : "text-slate-500"
                              }`}
                            >
                              <AlertCircle className="w-3 h-3" />
                              {fornecedor.email}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <span
                              className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-center border leading-tight ${status.bg} ${status.border} ${status.color}`}
                            >
                              {status.icon}
                              {status.label}
                            </span>
                            <span className={`text-[11px] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                              Desde {formatDateTime(fornecedor.data_cadastro)}
                            </span>
                          </div>

                          <div className="flex flex-col gap-1 text-sm">
                            <div className="flex items-center gap-2">
                              <TrendingUp className={`w-4 h-4 ${getAccentColor()}`} />
                              <span>IQF {formatNota(fornecedor.nota_iqf)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <ShieldCheck className={`w-4 h-4 ${getAccentColor()}`} />
                              <span>Homologação {formatNota(fornecedor.nota_homologacao)}</span>
                            </div>
                          </div>

                          {/* Documentações registradas na tabela*/}

                          <div className="flex flex-wrap gap-3 text-xs md:pr-4">
                            {documentosVisiveis.map((doc) => (
                              <button
                                key={doc.id}
                                type="button"
                                onClick={() => handleDownloadDocumento(doc)}
                                disabled={downloadDocumentoId === doc.id}
                                className={`inline-flex h-10 w-44 items-center gap-2 rounded-full border px-3 text-left transition-colors ${
                                  isDarkMode
                                    ? "border-slate-700 bg-slate-800/60 hover:border-orange-400/40"
                                    : "border-slate-300 bg-slate-100/60 hover:border-orange-400/60"
                                } ${downloadDocumentoId === doc.id ? "opacity-70 cursor-wait" : ""}`}
                                title={doc.nome}
                              >
                                {downloadDocumentoId === doc.id ? (
                                  <Loader2 className={`w-3 h-3 animate-spin ${getAccentColor()}`} />
                                ) : (
                                  <FileText className={`w-3 h-3 ${getAccentColor()}`} />
                                )}
                                <span className="flex-1 truncate text-left">{shortenDocumentName(doc.nome)}</span>
                              </button>
                            ))}
                            {documentosRestantes > 0 && (
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-xs ${
                                  isDarkMode ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"
                                }`}
                              >
                                +{documentosRestantes} outros
                              </span>
                            )}
                          </div>

                          
                            {/* Botão que aprova e reprova o fornecedor */}

                          <div className="flex flex-wrap gap-2 md:justify-start">
                            <button
                              type="button"
                              onClick={() => handleRegistrarDecisao(fornecedor, "APROVADO")}
                              disabled={processandoDecisaoId === fornecedor.id}
                              className={`inline-flex min-w-[8.5rem] items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                                isDarkMode
                                  ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 hover:border-emerald-400"
                                  : "bg-emerald-50 border border-emerald-200 text-emerald-600 hover:border-emerald-300"
                              } ${processandoDecisaoId === fornecedor.id ? "opacity-70 cursor-wait" : ""}`}
                            >
                              {processandoDecisaoId === fornecedor.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Processando
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  Aprovar
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRegistrarDecisao(fornecedor, "REPROVADO")}
                              disabled={processandoDecisaoId === fornecedor.id}
                              className={`inline-flex min-w-[8.5rem] items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                                isDarkMode
                                  ? "bg-red-500/15 border border-red-500/30 text-red-200 hover:border-red-400"
                                  : "bg-red-50 border border-red-200 text-red-600 hover:border-red-300"
                              } ${processandoDecisaoId === fornecedor.id ? "opacity-70 cursor-wait" : ""}`}
                            >
                              {processandoDecisaoId === fornecedor.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Processando
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3" />
                                  Reprovar
                                </>
                              )}
                            </button>
                          </div>

                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
            </section>

                  {/* Mostra as notificações em tempo real do portal */}

            <aside className="xl:w-80 flex-shrink-0 space-y-6">
              <div
                className={`rounded-3xl border backdrop-blur p-6 shadow-2xl transition-all duration-300 ${
                  isDarkMode ? "bg-slate-800/70 border-slate-700" : "bg-white/70 border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Bell className={`w-4 h-4 ${getAccentColor()}`} />
                    Notificações
                  </h3>
                  {carregandoNotificacoes && (
                    <Loader2 className={`w-4 h-4 animate-spin ${isDarkMode ? "text-slate-400" : "text-slate-500"}`} />
                  )}
                </div>

                <div className="space-y-4 max-h-[28rem] overflow-y-auto pr-2">
                  {notificacoes.length === 0 ? (
                    <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                      Nenhuma notificação recente.
                    </p>
                  ) : (
                    notificacoes.map((item) => (
                      <div
                        key={item.id}
                        className={`rounded-2xl border p-4 flex flex-col gap-2 transition-all duration-300 ${
                          isDarkMode
                            ? "border-slate-700/50 bg-slate-900/60 hover:bg-slate-900/80"
                            : "border-slate-200/50 bg-slate-50/60 hover:bg-slate-50/80"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span
                            className={`text-xs uppercase tracking-widest ${
                              isDarkMode ? "text-slate-400" : "text-slate-500"
                            }`}
                          >
                            {item.tipo === "cadastro" ? "Cadastro" : "Documento"}
                          </span>
                          <span className={`text-xs ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                            {formatRelativeTime(item.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm font-medium">{item.titulo}</p>
                        <p className={`text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                          {item.descricao}
                        </p>
                        {item.detalhes && (
                          <div className={`text-[11px] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                            {Object.entries(item.detalhes).map(([chave, valor]) => (
                              <div key={`${item.id}-${chave}`}>
                                • {chave}: {valor}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/*Card para gerar PDF mensal */}

              <div
                className={`rounded-3xl border p-6 transition-all duration-300 ${
                  isDarkMode
                    ? "border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-transparent"
                    : "border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-red-500/10 to-transparent"
                }`}
              >
                <h3 className="text-lg font-semibold mb-2">Dica Rápida</h3>
                <p className={`text-sm mb-4 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                  Mantenha o painel aberto enquanto realiza homologações. As métricas são atualizadas em tempo real
                  conforme os documentos chegam.
                </p>
                <button
                  onClick={handleGenerateMonthlyReport}
                  disabled={gerandoRelatorio || carregandoFornecedores || fornecedores.length === 0}
                  className={`flex items-center gap-2 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:-translate-y-0 ${
                    isDarkMode
                      ? "bg-gradient-to-r from-orange-400 to-red-500 shadow-orange-500/20 hover:shadow-orange-500/30"
                      : "bg-gradient-to-r from-orange-400 to-red-500 shadow-orange-500/20 hover:shadow-orange-500/30"
                  }`}
                >
                  {gerandoRelatorio ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gerando PDF...
                    </>
                  ) : (
                    <>
                      Gerar relatório (PDF)
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <button
        onClick={toggleTheme}
        className={`fixed bottom-8 right-8 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl z-50 ${
          isDarkMode
            ? "bg-gradient-to-r from-orange-400 to-red-500 shadow-orange-400/25 hover:shadow-orange-400/40"
            : "bg-gradient-to-r from-orange-400 to-red-500 shadow-orange-400/25 hover:shadow-orange-400/40"
        }`}
        title="Alternar tema"
      >
        {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
      </button>
    </div>
  )
}

type ResumoCardProps = {
  title: string
  value: string
  icon: JSX.Element
  accent: string
  loading?: boolean
  isDarkMode: boolean
}

function ResumoCard({ title, value, icon, accent, loading, isDarkMode }: ResumoCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border backdrop-blur px-6 py-5 shadow-2xl transition-all duration-500 hover:-translate-y-2 ${
        isDarkMode ? "bg-slate-800/70 border-slate-700" : "bg-white/70 border-slate-200"
      }`}
    >
      <div
        className={`absolute inset-x-0 -top-10 h-28 bg-gradient-to-br ${accent} opacity-[0.22] blur-3xl pointer-events-none`}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className={`text-xs uppercase tracking-widest ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            {title}
          </p>
          <p className="mt-3 text-3xl font-semibold">
            {loading ? (
              <Loader2 className={`w-6 h-6 animate-spin ${isDarkMode ? "text-slate-400" : "text-slate-500"}`} />
            ) : (
              value
            )}
          </p>
        </div>
        <div
          className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
            isDarkMode ? "bg-slate-700/50" : "bg-slate-100"
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}


