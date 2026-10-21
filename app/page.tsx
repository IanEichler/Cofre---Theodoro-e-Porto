"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Vault,
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  Star,
  Users,
  ShieldCheck,
  KeyRound,
  Settings,
  Trash2,
  Folder,
  SlidersHorizontal,
  List,
  LayoutGrid,
  Copy,
  Eye,
  EyeOff,
  X,
  ArrowUpRight,
  Check,
  LockKeyhole,
  LogOut,
  RefreshCw,
  WandSparkles,
  ArrowRight,
  CircleHelp,
  Menu,
  ArrowLeft,
  Clock3,
  Bell,
  MoreHorizontal,
  Fingerprint,
  Building2,
  ExternalLink,
} from "lucide-react";
import {
  Item,
  Person,
  roles,
  colors,
  initials,
  strength,
  dateLabel,
  Brand,
  Modal,
  api,
  ItemForm,
  Generator,
  Recovery,
} from "./components";
import { AuthScreen } from "./auth-screen";
type Activity = { actor: string; action: string; target: string; time: number };
type AppState = {
  phase: string;
  user?: Person;
  identity?: { email: string };
  workspace?: string;
  items?: Item[];
  members?: Person[];
  activity?: Activity[];
  error?: string;
};
function demoData(): Item[] {
  return [
    [
      "Google Workspace",
      "admin@escritorio.exemplo",
      "Google-Demo!9dR4xP7mZ",
      "https://workspace.google.com",
      "Administrativo",
      "login",
      true,
    ],
    [
      "Notion",
      "equipe@escritorio.exemplo",
      "Notion-Demo!2jH6qL8s",
      "https://notion.so",
      "Administrativo",
      "login",
      true,
    ],
    [
      "Figma",
      "design@escritorio.exemplo",
      "Figma-Demo!8fK3wN5v",
      "https://figma.com",
      "Marketing",
      "login",
      false,
    ],
    [
      "Banco Inter",
      "financeiro@escritorio.exemplo",
      "Exemplo123",
      "https://inter.co",
      "Financeiro",
      "login",
      true,
    ],
    [
      "Slack",
      "equipe@escritorio.exemplo",
      "Slack-Demo!4tS7bW2e",
      "https://slack.com",
      "Administrativo",
      "login",
      false,
    ],
    [
      "Instagram",
      "@escritorio.exemplo",
      "Exemplo123",
      "https://instagram.com",
      "Marketing",
      "login",
      false,
    ],
    [
      "Amazon Web Services",
      "ti@escritorio.exemplo",
      "AWS-Demo!6cY9nA4rX",
      "https://aws.amazon.com",
      "Tecnologia",
      "login",
      false,
    ],
    [
      "Servidor do escritório",
      "Acesso à rede interna",
      "",
      "",
      "Tecnologia",
      "note",
      false,
    ],
  ].map((r, i) => ({
    id: "demo-" + i,
    title: String(r[0]),
    username: String(r[1]),
    password: String(r[2]),
    url: String(r[3]),
    vault: String(r[4]),
    kind: String(r[5]),
    favorite: !!r[6],
    scope: i === 6 ? "personal" : "team",
    tags: i === 0 ? ["Trabalho", "Principal"] : [],
    notes:
      "Dados fictícios para demonstração. Substitua pelos dados do seu escritório após ativar o Cofre.",
    created: Date.now() - 86400000 * 30,
    updated: Date.now() - 86400000 * [0, 1, 2, 3, 4, 5, 7, 10][i],
    deleted: null,
    version: 1,
    canEdit: true,
  }));
}
const demoPeople: Person[] = [
  {
    name: "Ana Martins",
    email: "ana@escritorio.exemplo",
    role: "admin",
    status: "active",
    twoFactor: true,
  },
  {
    name: "Marina Costa",
    email: "marina@escritorio.exemplo",
    role: "editor",
    status: "active",
    twoFactor: true,
  },
  {
    name: "Pedro Alves",
    email: "pedro@escritorio.exemplo",
    role: "reader",
    status: "invited",
    twoFactor: false,
  },
];
export default function Cofre() {
  const [state, setState] = useState<AppState>({ phase: "loading" }),
    [demo, setDemo] = useState(false),
    [samples, setSamples] = useState<Item[]>([]),
    [samplePeople, setSamplePeople] = useState(demoPeople),
    [view, setView] = useState("all"),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("recent"),
    [kind, setKind] = useState("all"),
    [layout, setLayout] = useState("list"),
    [modal, setModal] = useState<string | null>(null),
    [selected, setSelected] = useState<Item | null>(null),
    [editing, setEditing] = useState<Partial<Item> | null>(null),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [mobile, setMobile] = useState(false),
    [reveal, setReveal] = useState(false),
    [secret, setSecret] = useState(""),
    [uri, setUri] = useState(""),
    [recovery, setRecovery] = useState<string[]>([]),
    [code, setCode] = useState(""),
    [filters, setFilters] = useState(false),
    [inviteLink, setInviteLink] = useState(""),
    [confirm, setConfirm] = useState<{
      title: string;
      text: string;
      action: () => Promise<void>;
    } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const items = demo ? samples : state.items || [],
    people = demo ? samplePeople : state.members || [],
    user = demo ? demoPeople[0] : state.user,
    office = demo ? "Escritório" : state.workspace || "Meu escritório",
    active = items.filter((i) => !i.deleted),
    weak = active.filter(
      (i) => i.kind === "login" && strength(i.password) === "Fraca",
    ),
    reused = active.filter(
      (i) =>
        i.kind === "login" &&
        i.password &&
        active.filter((j) => j.kind === "login" && j.password === i.password)
          .length > 1,
    ),
    vaults = Array.from(
      new Set([
        "Administrativo",
        "Financeiro",
        "Marketing",
        "Tecnologia",
        ...active.map((i) => i.vault),
      ]),
    );
  const logins = active.filter((i) => i.kind === "login");
  const score = logins.length
    ? Math.round(
        100 -
          (new Set([...weak, ...reused].map((i) => i.id)).size /
            logins.length) *
            100,
      )
    : 100;
  const notify = (text: string) => setToast(text);
  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/cofre", { cache: "no-store" }),
        data = (await res.json()) as AppState;
      setState(data);
      if (data.phase === "open") {
        setDemo(false);
      } else {
        setSelected(null);
      }
    } catch {
      setState({
        phase: "error",
        error: "Não foi possível conectar ao servidor. Tente novamente.",
      });
    }
  }, []);
  useEffect(() => {
    setSamples(demoData());
    reload();
  }, [reload]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        input.current?.focus();
      }
      if (e.key === "Escape") {
        setSelected(null);
        setMobile(false);
        setFilters(false);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);
  const lock = useCallback(async () => {
    if (demo) {
      setModal("demoLock");
      return;
    }
    try {
      await api("logout");
    } catch {
      setToast(
        "Não foi possível confirmar a saída no servidor. A sessão expira em até 15 minutos.",
      );
    } finally {
      setState({ phase: "signin" });
      setSelected(null);
      setModal(null);
    }
  }, [demo]);
  useEffect(() => {
    if (demo || state.phase !== "open") return;
    const t = setInterval(() => reload(), 60000);
    return () => clearInterval(t);
  }, [demo, state.phase, reload]);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
      notify(e.message);
      if (e.status === 423) {
        setState({ phase: "signin" });
        setSelected(null);
        setModal(null);
      }
    } finally {
      setBusy(false);
    }
  }
  async function copy(
    text: string,
    label = "Copiado para a área de transferência",
  ) {
    try {
      await navigator.clipboard.writeText(text);
      notify(label);
    } catch {
      notify("O navegador não permitiu copiar. Selecione o texto manualmente.");
    }
  }
  function nav(next: string) {
    setView(next);
    setSearch("");
    setKind("all");
    setMobile(false);
    setSelected(null);
  }
  function open(value: string) {
    setError("");
    setModal(value);
  }
  const close = () => {
    setModal(null);
    setError("");
    setCode("");
  };
  function newItem() {
    setEditing(null);
    open("item");
  }
  async function change(op: string, item: Item, value?: boolean) {
    await act(async () => {
      if (demo)
        setSamples((prev) =>
          op === "delete"
            ? prev.filter((i) => i.id !== item.id)
            : prev.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      ...(op === "favorite"
                        ? { favorite: !!value }
                        : op === "restore"
                          ? { deleted: null }
                          : { deleted: Date.now() }),
                    }
                  : i,
              ),
        );
      else {
        await api(op, { id: item.id, value });
        await reload();
      }
      if (op !== "favorite") setSelected(null);
      notify(
        op === "favorite"
          ? value
            ? "Adicionado aos favoritos"
            : "Removido dos favoritos"
          : op === "restore"
            ? "Item restaurado"
            : op === "delete"
              ? "Item excluído permanentemente"
              : "Item movido para a lixeira",
      );
    });
  }
  function begin() {
    setDemo(false);
    setSelected(null);
    setModal(null);
  }
  const vaultView =
      ["all", "favorites", "shared", "trash"].includes(view) ||
      view.startsWith("vault:"),
    titles: Record<string, string> = {
      all: "Todas as senhas",
      favorites: "Seus favoritos",
      shared: "Compartilhados",
      trash: "Lixeira",
      team: "Sua equipe",
      security: "Central de segurança",
      activity: "Histórico de atividades",
      settings: "Configurações",
    },
    title = view.startsWith("vault:") ? view.slice(6) : titles[view];
  const visible = items
    .filter(
      (i) =>
        (view === "trash" ? !!i.deleted : !i.deleted) &&
        (view !== "favorites" || i.favorite) &&
        (view !== "shared" || i.scope === "team") &&
        (!view.startsWith("vault:") || i.vault === view.slice(6)) &&
        (kind === "all" || i.kind === kind) &&
        (!search ||
          [i.title, i.username, i.url, i.vault, ...i.tags]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase())),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title, "pt-BR")
        : b.updated - a.updated,
    );
  const navItems = [
    { id: "all", label: "Todas as senhas", Icon: Vault, count: active.length },
    {
      id: "favorites",
      label: "Favoritos",
      Icon: Star,
      count: active.filter((i) => i.favorite).length,
    },
    { id: "shared", label: "Compartilhados", Icon: Users },
    { id: "trash", label: "Lixeira", Icon: Trash2 },
  ];
  if (!demo && state.phase !== "open")
    return (
      <AuthScreen
        phase={state.phase}
        user={state.user}
        serverError={state.error}
        reload={reload}
        onRecovery={(codes) => {
          setRecovery(codes);
          setModal("recovery");
        }}
        onPreview={() => {
          setDemo(true);
          setView("all");
          setSearch("");
        }}
      />
    );
  return (
    <div className="app-shell">
      {mobile && (
        <div className="sidebar-scrim" onClick={() => setMobile(false)} />
      )}
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <a
          className="wordmark"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            nav("all");
          }}
        >
          <span className="logo-box">
            <Vault size={25} strokeWidth={1.7} />
          </span>
          Cofre<span className="wordmark-dot">.</span>
        </a>
        <button className="workspace-picker" onClick={() => nav("settings")}>
          <span className="office-icon">
            <Building2 size={18} />
          </span>
          <span>
            <strong>{office}</strong>
            <small>Espaço de trabalho</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <div className="nav-label">MEU COFRE</div>
        <nav aria-label="Navegação principal">
          {navItems.map(({ id, label, Icon, count }) => (
            <button
              className={`nav-item ${view === id ? "active" : ""}`}
              onClick={() => nav(id)}
              key={id}
            >
              <Icon size={18} />
              <span>{label}</span>
              {count !== undefined && <em>{count}</em>}
            </button>
          ))}
        </nav>
        <div className="nav-label with-button">
          COFRES DA EQUIPE
          <button aria-label="Adicionar cofre" onClick={() => open("vault")}>
            <Plus size={15} />
          </button>
        </div>
        <nav aria-label="Cofres da equipe">
          {vaults.map((v) => (
            <button
              key={v}
              className={`nav-item vault-nav ${view === "vault:" + v ? "active" : ""}`}
              onClick={() => nav("vault:" + v)}
            >
              <Folder size={17} className={`folder-${colors[v] || "green"}`} />
              <span>{v}</span>
              <small>{active.filter((i) => i.vault === v).length}</small>
            </button>
          ))}
        </nav>
        <div className="nav-label tools-label">FERRAMENTAS</div>
        <nav aria-label="Ferramentas">
          {[
            { id: "generator", label: "Gerador de senhas", Icon: WandSparkles },
            { id: "team", label: "Equipe e acessos", Icon: Users },
            { id: "security", label: "Segurança", Icon: ShieldCheck },
            { id: "activity", label: "Atividades", Icon: Clock3 },
          ].map(({ id, label, Icon }) => (
            <button
              className={`nav-item ${view === id ? "active" : ""}`}
              key={id}
              onClick={() => (id === "generator" ? open("generator") : nav(id))}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "security" && weak.length > 0 && (
                <i className="nav-alert" />
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="protected-box">
            <span>
              <ShieldCheck size={18} />
            </span>
            <div>
              <strong>Um lugar mais seguro.</strong>
              <small>
                {demo
                  ? "Conheça o seu novo Cofre."
                  : "Seus dados são criptografados."}
              </small>
            </div>
          </div>
          <button
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            onClick={() => nav("settings")}
          >
            <Settings size={18} />
            <span>Configurações</span>
          </button>
          <button className="profile" onClick={() => nav("settings")}>
            <span className="avatar">
              {initials(user?.name || "Meu perfil")}
            </span>
            <span>
              <strong>{user?.name || "Meu perfil"}</strong>
              <small>{roles[user?.role || "admin"]}</small>
            </span>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-toggle"
              onClick={() => setMobile(true)}
              aria-label="Abrir menu"
            >
              <Menu size={21} />
            </button>
            <a
              className="mobile-brand"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                nav("all");
              }}
            >
              Cofre<span>.</span>
            </a>
            <span className="desktop-crumb">Espaço de trabalho</span>
            <ChevronRight size={14} className="desktop-crumb" />
            <strong>{office}</strong>
            <span className="team-plan">Equipe</span>
          </div>
          <div className="topbar-actions">
            <div className="global-search">
              <Search size={16} />
              <input
                ref={input}
                aria-label="Buscar no cofre"
                placeholder="Buscar no seu cofre..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (!vaultView) setView("all");
                }}
              />
              <kbd>⌘ K</kbd>
            </div>
            <button
              className="icon-btn"
              onClick={() => open("help")}
              aria-label="Ajuda"
            >
              <CircleHelp size={19} />
            </button>
            <button
              className="icon-btn notification-btn"
              onClick={() => nav("security")}
              aria-label="Avisos de segurança"
            >
              <Bell size={19} />
              {weak.length > 0 && <i />}
            </button>
            <span className="header-divider" />
            <button
              className="mini-avatar"
              onClick={() => nav("settings")}
              aria-label="Meu perfil"
            >
              {initials(user?.name || "MP")}
            </button>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <span>
              <span className="status-dot" />
              Você está explorando uma prévia com dados fictícios.
            </span>
            <button onClick={begin}>
              Ativar meu cofre <ArrowRight size={14} />
            </button>
          </div>
        )}
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">SEU ESCRITÓRIO, MAIS PROTEGIDO</div>
              <h1>
                {title}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {vaultView
                  ? view === "trash"
                    ? "Itens excluídos ficam aqui até você removê-los permanentemente."
                    : "Tudo o que sua equipe precisa. Seguro e em um só lugar."
                  : view === "team"
                    ? "As pessoas certas, com o acesso certo."
                    : view === "security"
                      ? "Pequenos cuidados. Uma grande diferença na sua proteção."
                      : view === "activity"
                        ? "Acompanhe os acessos e as alterações no seu escritório."
                        : "Deixe o Cofre do jeito que o seu escritório precisa."}
              </p>
            </div>
            <div className="heading-actions">
              {vaultView ? (
                <>
                  <button
                    className="button secondary generator-shortcut"
                    onClick={() => open("generator")}
                  >
                    <WandSparkles size={16} />
                    Gerar senha
                  </button>
                  <button className="button primary" onClick={newItem}>
                    <Plus size={17} />
                    Novo item
                  </button>
                </>
              ) : view === "team" && (user?.role === "admin" || demo) ? (
                <button
                  className="button primary"
                  onClick={() => open("invite")}
                >
                  <Plus size={17} />
                  Adicionar pessoa
                </button>
              ) : (
                <button className="button secondary" onClick={() => nav("all")}>
                  <ArrowLeft size={16} />
                  Voltar ao cofre
                </button>
              )}
            </div>
          </div>
          {vaultView && (
            <>
              <section className="stats-grid" aria-label="Resumo do cofre">
                <button className="stat-card" onClick={() => nav("all")}>
                  <span className="stat-label">
                    Senhas no cofre
                    <span className="stat-icon gray">
                      <KeyRound size={17} />
                    </span>
                  </span>
                  <div className="stat-value">
                    {active.filter((i) => i.kind === "login").length}
                    <span>credenciais protegidas</span>
                  </div>
                  <div className="stat-bottom">
                    <span className="tiny-dot green" />
                    Tudo em um só lugar
                  </div>
                </button>
                <button className="stat-card" onClick={() => nav("shared")}>
                  <span className="stat-label">
                    Compartilhadas
                    <span className="stat-icon blue">
                      <Users size={17} />
                    </span>
                  </span>
                  <div className="stat-value">
                    {active.filter((i) => i.scope === "team").length}
                    <span>itens da equipe</span>
                  </div>
                  <div className="stat-bottom">Acesso organizado e seguro</div>
                </button>
                <button className="stat-card" onClick={() => nav("security")}>
                  <span className="stat-label">
                    Saúde das senhas
                    <span className="stat-icon green">
                      <ShieldCheck size={17} />
                    </span>
                  </span>
                  <div className="stat-value">
                    {score}
                    <span className="score-unit">/ 100</span>
                    <span
                      className={`stat-tag ${score >= 90 ? "good" : "warn"}`}
                    >
                      {score >= 90 ? "Excelente" : "Pode melhorar"}
                    </span>
                  </div>
                  <div className="stat-bottom">
                    {weak.length
                      ? `${weak.length} senhas precisam de atenção`
                      : "Nenhuma senha fraca detectada"}
                  </div>
                </button>
                <button className="stat-card" onClick={() => nav("team")}>
                  <span className="stat-label">
                    Pessoas na equipe
                    <span className="stat-icon purple">
                      <Users size={17} />
                    </span>
                  </span>
                  <div className="stat-value">
                    {people.filter((p) => p.status !== "revoked").length}
                    <span>pessoas autorizadas</span>
                  </div>
                  <div className="stat-bottom">
                    <span className="avatar-stack">
                      {people
                        .filter((p) => p.status !== "revoked")
                        .slice(0, 3)
                        .map((p, i) => (
                          <i key={p.email} className={`stack-${i}`}>
                            {initials(p.name)}
                          </i>
                        ))}
                    </span>
                    {people.filter((p) => p.status === "invited").length}{" "}
                    convite pendente
                  </div>
                </button>
              </section>
              <section className="vault-table-section">
                <div className="table-tabs">
                  <div role="tablist" aria-label="Tipo de item">
                    {[
                      ["all", "Todos os itens"],
                      ["login", "Senhas"],
                      ["note", "Notas seguras"],
                      ["card", "Cartões"],
                    ].map(([id, label]) => (
                      <button
                        role="tab"
                        aria-selected={kind === id}
                        key={id}
                        className={kind === id ? "selected" : ""}
                        onClick={() => setKind(id)}
                      >
                        {label}
                        {id === "all" && (
                          <span>
                            {
                              items.filter((i) =>
                                view === "trash" ? i.deleted : !i.deleted,
                              ).length
                            }
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="table-view-switch">
                    <button
                      className={layout === "list" ? "selected" : ""}
                      onClick={() => setLayout("list")}
                      aria-label="Exibir lista"
                    >
                      <List size={17} />
                    </button>
                    <button
                      className={layout === "grid" ? "selected" : ""}
                      onClick={() => setLayout("grid")}
                      aria-label="Exibir cartões"
                    >
                      <LayoutGrid size={16} />
                    </button>
                  </div>
                </div>
                <div className="table-toolbar">
                  <div className="table-search">
                    <Search size={17} />
                    <input
                      placeholder="Buscar nome, usuário ou site..."
                      aria-label="Filtrar itens"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                      <button
                        className="icon-btn"
                        onClick={() => setSearch("")}
                        aria-label="Limpar busca"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div className="toolbar-right">
                    <span className="item-count">{visible.length} itens</span>
                    <select
                      aria-label="Ordenar itens"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="recent">Mais recentes</option>
                      <option value="name">Nome (A–Z)</option>
                    </select>
                    <div className="filter-wrap">
                      <button
                        className={`button small secondary ${filters ? "chosen" : ""}`}
                        onClick={() => setFilters(!filters)}
                      >
                        <SlidersHorizontal size={15} />
                        <span>Filtros</span>
                      </button>
                      {filters && (
                        <div className="filter-pop">
                          <strong>Mostrar itens</strong>
                          {[
                            ["all", "Todos os itens"],
                            ["shared", "Compartilhados com a equipe"],
                            ["favorites", "Somente favoritos"],
                          ].map(([id, label]) => (
                            <button
                              key={id}
                              onClick={() => {
                                nav(id);
                                setFilters(false);
                              }}
                            >
                              {label}
                            </button>
                          ))}
                          <p>
                            Selecione um cofre na lateral para filtrar por
                            departamento.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {visible.length === 0 ? (
                  <div className="empty">
                    <div className="empty-icon">
                      <Vault size={30} />
                    </div>
                    <h3>
                      {search
                        ? "Nenhum item encontrado"
                        : view === "trash"
                          ? "Tudo limpo por aqui"
                          : "Seu próximo segredo fica aqui"}
                    </h3>
                    <p>
                      {search
                        ? "Tente outro nome, usuário ou site."
                        : view === "trash"
                          ? "Os itens que você excluir aparecerão nesta lista."
                          : "Adicione uma senha, uma nota segura ou um cartão."}
                    </p>
                    {!search && view !== "trash" && (
                      <button className="button primary" onClick={newItem}>
                        <Plus size={16} />
                        Adicionar primeiro item
                      </button>
                    )}
                  </div>
                ) : layout === "list" ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th className="star-col" />
                          <th>Nome do item</th>
                          <th>Usuário / e-mail</th>
                          <th>Cofre</th>
                          <th>Segurança</th>
                          <th>Atualizado</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((item) => (
                          <tr
                            key={item.id}
                            onClick={() => {
                              setSelected(item);
                              setReveal(false);
                            }}
                          >
                            <td className="star-col">
                              <button
                                className={`star-btn ${item.favorite ? "is-favorite" : ""}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  change("favorite", item, !item.favorite);
                                }}
                                aria-label={
                                  item.favorite
                                    ? "Remover dos favoritos"
                                    : "Adicionar aos favoritos"
                                }
                              >
                                <Star
                                  size={16}
                                  fill={item.favorite ? "currentColor" : "none"}
                                />
                              </button>
                            </td>
                            <td>
                              <button className="item-name">
                                <Brand item={item} />
                                <span>
                                  <strong>{item.title}</strong>
                                  <small>
                                    {item.kind === "note"
                                      ? "Nota segura"
                                      : item.kind === "card"
                                        ? "Cartão"
                                        : item.url.replace(
                                            /^https?:\/\//,
                                            "",
                                          ) || "Credencial"}
                                  </small>
                                </span>
                              </button>
                            </td>
                            <td>
                              <span className="username">
                                {item.username || "—"}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`vault-pill ${colors[item.vault] || "green"}`}
                              >
                                <Folder size={11} />
                                {item.vault}
                              </span>
                            </td>
                            <td>
                              {item.kind === "note" ? (
                                <span className="strength neutral">
                                  <LockKeyhole size={12} />
                                  Protegida
                                </span>
                              ) : (
                                <span
                                  className={`strength ${strength(item.password) === "Forte" ? "strong" : strength(item.password) === "Fraca" ? "weak" : "medium"}`}
                                >
                                  <span />
                                  {strength(item.password)}
                                </span>
                              )}
                            </td>
                            <td className="date-cell">
                              {dateLabel(item.updated)}
                            </td>
                            <td>
                              <button
                                className="icon-btn row-more"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelected(item);
                                  setReveal(false);
                                }}
                                aria-label={`Detalhes de ${item.title}`}
                              >
                                <MoreHorizontal size={19} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="items-grid">
                    {visible.map((item) => (
                      <button
                        key={item.id}
                        className="item-grid-card"
                        onClick={() => {
                          setSelected(item);
                          setReveal(false);
                        }}
                      >
                        <div>
                          <Brand item={item} />
                          <Star
                            size={16}
                            fill={item.favorite ? "#737373" : "none"}
                            color={item.favorite ? "#737373" : "#bdbdbd"}
                          />
                        </div>
                        <strong>{item.title}</strong>
                        <p>{item.username || "Nota segura"}</p>
                        <footer>
                          <span
                            className={`vault-pill ${colors[item.vault] || "green"}`}
                          >
                            {item.vault}
                          </span>
                          <span>{dateLabel(item.updated)}</span>
                        </footer>
                      </button>
                    ))}
                  </div>
                )}
                <div className="table-footer">
                  <span>
                    <LockKeyhole size={12} />
                    {demo
                      ? "Dados fictícios · Apenas para demonstração"
                      : "Criptografia AES-256-GCM no armazenamento"}
                  </span>
                  <span>Mostrando {visible.length} itens</span>
                </div>
              </section>
              <div className="bottom-cards">
                <section className="security-tip">
                  <div className="tip-illustration">
                    <ShieldCheck size={34} strokeWidth={1.4} />
                    <span className="sparkle s1">✦</span>
                    <span className="sparkle s2">✧</span>
                  </div>
                  <div>
                    <span className="mini-eyebrow">
                      SEGURANÇA EM CADA DETALHE
                    </span>
                    <h3>Uma camada extra de tranquilidade.</h3>
                    <p>
                      Proteja sua conta com a verificação em duas etapas
                      <br className="desktop-break" /> do Google Authenticator.
                    </p>
                    <button onClick={() => nav("security")}>
                      Conhecer a proteção <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <div className="tip-badge">
                    <Fingerprint size={62} strokeWidth={1} />
                  </div>
                </section>
                <section className="generator-tip">
                  <span className="generator-tip-icon">
                    <WandSparkles size={21} />
                  </span>
                  <div>
                    <h3>Senhas fortes, sem esforço.</h3>
                    <p>Crie combinações únicas em um clique.</p>
                    <button onClick={() => open("generator")}>
                      Abrir gerador <ArrowRight size={14} />
                    </button>
                  </div>
                </section>
              </div>
            </>
          )}
          {view === "team" && (
            <section className="content-panel">
              <div className="panel-top">
                <div>
                  <h2>
                    Pessoas e permissões{" "}
                    <span className="count-badge">{people.length}</span>
                  </h2>
                  <p>
                    Administradores gerenciam acessos. Editores alteram itens.
                    Leitores consultam.
                  </p>
                </div>
              </div>
              {!demo && user?.role !== "admin" ? (
                <div className="empty">
                  <Users size={30} />
                  <h3>A gestão da equipe é exclusiva dos administradores.</h3>
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="people-table">
                    <thead>
                      <tr>
                        <th>Pessoa</th>
                        <th>Permissão</th>
                        <th>Autenticação</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {people.map((p) => (
                        <tr key={p.email}>
                          <td>
                            <div className="person-cell">
                              <span className="avatar">{initials(p.name)}</span>
                              <span>
                                <strong>
                                  {p.name}
                                  {p.email === user?.email ? " (você)" : ""}
                                </strong>
                                <small>{p.email}</small>
                              </span>
                            </div>
                          </td>
                          <td>
                            <select
                              aria-label={`Permissão de ${p.name}`}
                              value={p.role}
                              disabled={
                                p.email === user?.email ||
                                p.status === "revoked"
                              }
                              onChange={(e) => {
                                const role = e.target.value;
                                act(async () => {
                                  if (demo)
                                    setSamplePeople((prev) =>
                                      prev.map((v) =>
                                        v.email === p.email
                                          ? { ...v, role }
                                          : v,
                                      ),
                                    );
                                  else {
                                    await api("member", {
                                      email: p.email,
                                      role,
                                    });
                                    await reload();
                                  }
                                  notify("Permissão atualizada");
                                });
                              }}
                            >
                              {Object.entries(roles).map(([id, label]) => (
                                <option key={id} value={id}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <span
                              className={`strength ${p.twoFactor ? "strong" : "medium"}`}
                            >
                              <ShieldCheck size={13} />
                              {p.twoFactor ? "2FA ativado" : "A configurar"}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`status-pill ${p.status === "active" ? "green" : p.status === "invited" ? "orange" : "gray"}`}
                            >
                              {p.status === "active"
                                ? "Ativo"
                                : p.status === "invited"
                                  ? "Aguardando acesso"
                                  : "Revogado"}
                            </span>
                          </td>
                          <td>
                            {p.email !== user?.email &&
                              p.status !== "revoked" && (
                                <>
                                  <button
                                    className="text-button reset-account-button"
                                    onClick={() =>
                                      act(async () => {
                                        if (demo) {
                                          notify(
                                            "Disponível no seu cofre ativo.",
                                          );
                                          return;
                                        }
                                        const result = await api(
                                          "reset-account",
                                          { email: p.email },
                                        );
                                        setInviteLink(result.invitationUrl);
                                        setModal("inviteLink");
                                      })
                                    }
                                  >
                                    Gerar novo link
                                  </button>
                                  <button
                                    className="text-button danger-text"
                                    onClick={() =>
                                      setConfirm({
                                        title: "Revogar acesso?",
                                        text: `${p.name} perderá o acesso aos cofres da equipe e suas sessões serão encerradas.`,
                                        action: async () => {
                                          if (demo)
                                            setSamplePeople((prev) =>
                                              prev.map((v) =>
                                                v.email === p.email
                                                  ? { ...v, status: "revoked" }
                                                  : v,
                                              ),
                                            );
                                          else {
                                            await api("member", {
                                              email: p.email,
                                              revoke: true,
                                            });
                                            await reload();
                                          }
                                          notify("Acesso revogado");
                                        },
                                      })
                                    }
                                  >
                                    Revogar
                                  </button>
                                </>
                              )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="info-note">
                <CircleHelp size={17} />
                <p>
                  Os convites são individuais, de uso único e válidos por sete
                  dias. Compartilhe o link por um canal do escritório. Cada
                  pessoa define a própria senha no convite e configura seu
                  Google Authenticator.
                </p>
              </div>
            </section>
          )}
          {view === "security" && (
            <>
              <section className="security-hero">
                <div
                  className="security-ring"
                  style={{ "--score": score + "%" } as React.CSSProperties}
                >
                  <div>
                    <strong>{score}</strong>
                    <span>de 100</span>
                  </div>
                </div>
                <div>
                  <span className="eyebrow">SAÚDE DO SEU COFRE</span>
                  <h2>
                    {score >= 90
                      ? "Tudo sob controle."
                      : "Vamos deixar suas senhas mais fortes?"}
                  </h2>
                  <p>
                    {weak.length
                      ? `${weak.length} senhas fracas e ${reused.length} credenciais com senha repetida merecem atenção.`
                      : "Continue usando uma senha longa e exclusiva em cada serviço."}
                  </p>
                  <small>
                    A análise considera tamanho, composição e repetição. Não
                    consulta vazamentos externos.
                  </small>
                </div>
              </section>
              <div className="security-grid">
                <section className="content-panel">
                  <div className="panel-top">
                    <div className="section-icon green">
                      <ShieldCheck size={23} />
                    </div>
                    <div>
                      <h2>Verificação em duas etapas</h2>
                      <p>Google Authenticator</p>
                    </div>
                    <span
                      className={`status-pill ${user?.twoFactor ? "green" : "orange"}`}
                    >
                      {demo
                        ? "Exemplo"
                        : user?.twoFactor
                          ? "Ativada"
                          : "Pendente"}
                    </span>
                  </div>
                  <div className="panel-body">
                    <p>
                      Além da sua conta de acesso, o Cofre exige um código de
                      seis dígitos do aplicativo autenticador. Cada pessoa
                      configura o próprio segundo fator.
                    </p>
                    {demo ? (
                      <button className="button primary" onClick={begin}>
                        Ativar meu cofre
                        <ArrowRight size={15} />
                      </button>
                    ) : (
                      <div className="inline-success">
                        <Check size={17} />
                        Sua conta está protegida por duas etapas.
                      </div>
                    )}
                  </div>
                </section>
                <section className="content-panel">
                  <div className="panel-top">
                    <div className="section-icon purple">
                      <LockKeyhole size={23} />
                    </div>
                    <div>
                      <h2>Proteção dos dados</h2>
                      <p>Criptografia e bloqueio</p>
                    </div>
                  </div>
                  <div className="panel-body protection-list">
                    <p>
                      <Check size={16} />
                      Senhas e notas criptografadas no banco
                    </p>
                    <p>
                      <Check size={16} />
                      Itens pessoais restritos ao proprietário
                    </p>
                    <p>
                      <Check size={16} />
                      Sessões de até 15 minutos
                    </p>
                    <p>
                      <Check size={16} />
                      Limite de tentativas de desbloqueio
                    </p>
                    <small>
                      A criptografia é feita no servidor. Esta versão não
                      oferece criptografia de ponta a ponta.
                    </small>
                  </div>
                </section>
              </div>
              <section className="content-panel attention-panel">
                <div className="panel-top">
                  <div>
                    <h2>Itens que precisam de atenção</h2>
                    <p>
                      Use uma senha exclusiva, com 16 ou mais caracteres, para
                      cada conta.
                    </p>
                  </div>
                  <button
                    className="button secondary small"
                    onClick={() => open("generator")}
                  >
                    <WandSparkles size={15} />
                    Gerar senha
                  </button>
                </div>
                {Array.from(
                  new Map([...weak, ...reused].map((i) => [i.id, i])).values(),
                ).map((i) => (
                  <button
                    className="attention-row"
                    key={i.id}
                    onClick={() => {
                      setSelected(i);
                      setReveal(false);
                    }}
                  >
                    <Brand item={i} />
                    <span>
                      <strong>{i.title}</strong>
                      <small>{i.username}</small>
                    </span>
                    <span className="status-pill orange">
                      {weak.some((w) => w.id === i.id)
                        ? "Senha fraca"
                        : "Senha repetida"}
                    </span>
                    <ChevronRight size={17} />
                  </button>
                ))}
                {!weak.length && !reused.length && (
                  <div className="empty compact">
                    <ShieldCheck size={30} />
                    <h3>Nenhum alerta por aqui.</h3>
                    <p>
                      Suas senhas atendem aos critérios locais de força e
                      exclusividade.
                    </p>
                  </div>
                )}
              </section>
            </>
          )}
          {view === "activity" && (
            <section className="content-panel">
              <div className="panel-top">
                <div>
                  <h2>Registro de atividades</h2>
                  <p>
                    Acessos e alterações recentes, sem expor o conteúdo das
                    senhas.
                  </p>
                </div>
              </div>
              {(demo
                ? [
                    {
                      actor: "ana@escritorio.exemplo",
                      action: "Item criado",
                      target: "Google Workspace",
                      time: Date.now() - 3600000,
                    },
                    {
                      actor: "marina@escritorio.exemplo",
                      action: "Item atualizado",
                      target: "Figma",
                      time: Date.now() - 7200000,
                    },
                    {
                      actor: "ana@escritorio.exemplo",
                      action: "Acesso autorizado",
                      target: "pedro@escritorio.exemplo",
                      time: Date.now() - 86400000,
                    },
                  ]
                : state.activity || []
              ).map((a, i) => (
                <div className="activity-row" key={i}>
                  <span className="activity-icon">
                    <Clock3 size={18} />
                  </span>
                  <div>
                    <strong>{a.action}</strong>
                    <p>
                      {a.target}
                      <span> · {a.actor}</span>
                    </p>
                  </div>
                  <time>
                    {new Date(a.time).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </time>
                </div>
              ))}
              {!demo && !state.activity?.length && (
                <div className="empty">
                  <Clock3 size={30} />
                  <h3>Seu histórico começa aqui.</h3>
                </div>
              )}
            </section>
          )}
          {view === "settings" && (
            <div className="settings-grid">
              <section className="content-panel">
                <div className="panel-top">
                  <div>
                    <h2>Seu escritório</h2>
                    <p>Informações do espaço de trabalho.</p>
                  </div>
                </div>
                <form
                  className="panel-body form-stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const d = new FormData(e.currentTarget);
                    act(async () => {
                      if (demo)
                        notify(
                          "Ative seu Cofre para personalizar o escritório.",
                        );
                      else {
                        await api("workspace", { name: d.get("name") });
                        await reload();
                        notify("Configurações salvas");
                      }
                    });
                  }}
                >
                  <label>
                    Nome do escritório
                    <input
                      name="name"
                      defaultValue={office}
                      key={office}
                      required
                      maxLength={80}
                      disabled={!demo && user?.role !== "admin"}
                    />
                  </label>
                  <label>
                    Seu e-mail
                    <input value={user?.email || ""} readOnly />
                  </label>
                  <label>
                    Seu perfil
                    <input value={roles[user?.role || "admin"]} readOnly />
                  </label>
                  <button
                    className="button primary"
                    disabled={busy || (!demo && user?.role !== "admin")}
                    type="submit"
                  >
                    Salvar alterações
                  </button>
                </form>
              </section>
              <div>
                <section className="content-panel">
                  <div className="panel-top">
                    <div>
                      <h2>Sessão e privacidade</h2>
                      <p>Proteção em computadores compartilhados.</p>
                    </div>
                  </div>
                  <div className="panel-body">
                    <div className="setting-line">
                      <span>
                        <strong>Bloqueio automático</strong>
                        <small>A sessão expira em até 15 minutos.</small>
                      </span>
                      <span className="status-pill green">Ativado</span>
                    </div>
                    <div className="setting-line">
                      <span>
                        <strong>Segundo fator obrigatório</strong>
                        <small>Cada pessoa usa o próprio autenticador.</small>
                      </span>
                      <ShieldCheck size={20} />
                    </div>
                    <button className="button secondary" onClick={lock}>
                      <LockKeyhole size={15} />
                      Bloquear agora
                    </button>
                    {!demo && (
                      <button className="signout-link" onClick={lock}>
                        <LogOut size={15} />
                        Sair da conta
                      </button>
                    )}
                  </div>
                </section>
                {!demo && (
                  <section className="content-panel password-settings">
                    <div className="panel-top">
                      <div>
                        <h2>Alterar senha de acesso</h2>
                        <p>Confirme a senha atual e o segundo fator.</p>
                      </div>
                    </div>
                    <form
                      className="panel-body form-stack"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const d = new FormData(e.currentTarget);
                        if (d.get("newPassword") !== d.get("confirmPassword")) {
                          notify("As novas senhas não coincidem.");
                          return;
                        }
                        act(async () => {
                          await api("change-password", {
                            currentPassword: d.get("currentPassword"),
                            newPassword: d.get("newPassword"),
                            code: d.get("code"),
                          });
                          setState({ phase: "signin" });
                          setSelected(null);
                          notify("Senha alterada. Entre novamente.");
                        });
                      }}
                    >
                      <label>
                        Senha atual
                        <input
                          type="password"
                          name="currentPassword"
                          autoComplete="current-password"
                          maxLength={128}
                          required
                        />
                      </label>
                      <label>
                        Nova senha
                        <input
                          type="password"
                          name="newPassword"
                          autoComplete="new-password"
                          minLength={12}
                          maxLength={128}
                          required
                        />
                      </label>
                      <label>
                        Confirme a nova senha
                        <input
                          type="password"
                          name="confirmPassword"
                          autoComplete="new-password"
                          minLength={12}
                          maxLength={128}
                          required
                        />
                      </label>
                      <label>
                        Código do Google Authenticator
                        <input
                          name="code"
                          autoComplete="one-time-code"
                          placeholder="000 000"
                          required
                          maxLength={32}
                        />
                      </label>
                      <button className="button primary" disabled={busy}>
                        Alterar senha e encerrar sessões
                      </button>
                    </form>
                  </section>
                )}
                <div className="settings-note">
                  <ShieldCheck size={20} />
                  <p>
                    Guarde seus códigos de recuperação fora do Cofre. Eles
                    permitem desbloquear a conta quando você não tem o celular.
                  </p>
                </div>
              </div>
            </div>
          )}
          <footer className="page-footer">
            <span>
              Cofre <i>·</i> Tranquilidade para trabalhar.
            </span>
            <button onClick={lock}>
              <LockKeyhole size={13} />
              {demo ? "Bloquear prévia" : "Bloquear cofre"}
            </button>
          </footer>
        </main>
      </div>
      {selected && (
        <>
          <div
            className="drawer-shade"
            onClick={() => {
              setSelected(null);
              setReveal(false);
            }}
          />
          <aside
            className="detail-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Detalhes do item"
          >
            <div className="drawer-top">
              <span>DETALHES DO ITEM</span>
              <button
                className="icon-btn"
                onClick={() => {
                  setSelected(null);
                  setReveal(false);
                }}
                aria-label="Fechar detalhes"
              >
                <X size={21} />
              </button>
            </div>
            <div className="detail-heading">
              <Brand item={selected} />
              <h2>{selected.title}</h2>
              <span
                className={`vault-pill ${colors[selected.vault] || "green"}`}
              >
                <Folder size={12} />
                {selected.vault}
              </span>
            </div>
            <div className="detail-content">
              <div className="detail-field">
                <label>Usuário / e-mail</label>
                <div>
                  <span>{selected.username || "Não informado"}</span>
                  <button
                    className="icon-btn"
                    onClick={() => copy(selected.username)}
                    aria-label="Copiar usuário"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>
              {selected.kind !== "note" && (
                <div className="detail-field">
                  <label>
                    {selected.kind === "card"
                      ? "Número / dado seguro"
                      : "Senha"}
                  </label>
                  <div>
                    <code>
                      {reveal ? selected.password : "••••••••••••••••"}
                    </code>
                    <button
                      className="icon-btn"
                      onClick={() => setReveal(!reveal)}
                      aria-label={reveal ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {reveal ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => copy(selected.password, "Senha copiada")}
                      aria-label="Copiar senha"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                  <span
                    className={`strength ${strength(selected.password) === "Forte" ? "strong" : "weak"}`}
                  >
                    <span />
                    {strength(selected.password)}
                  </span>
                </div>
              )}
              {selected.url && (
                <div className="detail-field">
                  <label>Site</label>
                  <div>
                    <a
                      href={
                        /^https?:\/\//.test(selected.url) ? selected.url : "#"
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {selected.url}
                      <ArrowUpRight size={14} />
                    </a>
                    <button
                      className="icon-btn"
                      onClick={() => copy(selected.url)}
                      aria-label="Copiar site"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
              )}
              <div className="detail-field">
                <label>Visibilidade</label>
                <p className="visibility">
                  <Users size={16} />
                  {selected.scope === "personal"
                    ? "Pessoal · Somente você"
                    : "Equipe · Todos os membros autorizados"}
                </p>
              </div>
              {selected.notes && (
                <div className="detail-field">
                  <label>Notas seguras</label>
                  <p className="note-text">{selected.notes}</p>
                </div>
              )}
              {selected.tags.length > 0 && (
                <div className="detail-field">
                  <label>Marcadores</label>
                  <div className="tags">
                    {selected.tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
              <p className="detail-timestamp">
                Atualizado em{" "}
                {new Date(selected.updated).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <div className="detail-actions">
              {selected.deleted ? (
                <>
                  <button
                    className="button primary"
                    disabled={busy || selected.canEdit === false}
                    onClick={() => change("restore", selected)}
                  >
                    <RefreshCw size={16} />
                    Restaurar item
                  </button>
                  <button
                    className="button danger"
                    disabled={busy || selected.canEdit === false}
                    onClick={() =>
                      setConfirm({
                        title: "Excluir permanentemente?",
                        text: `O item “${selected.title}” será removido. Esta ação não pode ser desfeita.`,
                        action: () => change("delete", selected),
                      })
                    }
                  >
                    <Trash2 size={16} />
                    Excluir permanentemente
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="button primary"
                    disabled={selected.canEdit === false}
                    onClick={() => {
                      setEditing(selected);
                      setSelected(null);
                      open("item");
                    }}
                  >
                    Editar item
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => {
                      change("favorite", selected, !selected.favorite);
                      setSelected({
                        ...selected,
                        favorite: !selected.favorite,
                      });
                    }}
                  >
                    <Star
                      size={16}
                      fill={selected.favorite ? "currentColor" : "none"}
                    />
                    {selected.favorite ? "Remover favorito" : "Favoritar"}
                  </button>
                  <button
                    className="text-button danger-text"
                    disabled={busy || selected.canEdit === false}
                    onClick={() => change("trash", selected)}
                  >
                    <Trash2 size={15} />
                    Mover para a lixeira
                  </button>
                </>
              )}
            </div>
          </aside>
        </>
      )}
      {modal === "item" && (
        <Modal
          title={editing?.id ? "Editar item" : "Um novo item, em segurança."}
          subtitle="Guarde os detalhes. O Cofre cuida do resto."
          onClose={close}
          wide
        >
          <ItemForm
            item={editing}
            vaults={vaults}
            busy={busy}
            error={error}
            reader={!demo && user?.role === "reader"}
            onSave={(value) =>
              act(async () => {
                if (demo) {
                  const now = Date.now();
                  setSamples((prev) =>
                    editing?.id
                      ? prev.map((i) =>
                          i.id === editing.id
                            ? {
                                ...i,
                                ...value,
                                updated: now,
                                version: i.version + 1,
                              }
                            : i,
                        )
                      : [
                          {
                            ...value,
                            id: crypto.randomUUID(),
                            created: now,
                            updated: now,
                            deleted: null,
                            favorite: false,
                            version: 1,
                            canEdit: true,
                          },
                          ...prev,
                        ],
                  );
                } else {
                  await api("save", {
                    item: editing ? { ...editing, ...value } : value,
                  });
                  await reload();
                }
                close();
                notify(
                  editing?.id ? "Item atualizado" : "Item adicionado ao cofre",
                );
              })
            }
          />
        </Modal>
      )}
      {modal === "inviteLink" && (
        <Modal
          title="O convite está pronto."
          subtitle="Compartilhe este link apenas com a pessoa autorizada. Ele pode ser usado uma única vez."
          onClose={close}
        >
          <div className="info-note">
            <ShieldCheck size={18} />
            <p>
              Convites são válidos por sete dias; links de redefinição por uma
              hora. O Google Authenticator existente continua obrigatório após
              redefinir a senha.
            </p>
          </div>
          <div className="invite-link-box">
            <input aria-label="Link do convite" value={inviteLink} readOnly />
            <button
              className="button primary"
              onClick={() => copy(inviteLink, "Link copiado")}
            >
              <Copy size={15} />
              Copiar link
            </button>
          </div>
        </Modal>
      )}
      {modal === "generator" && <Generator onClose={close} copy={copy} />}
      {modal === "invite" && (
        <Modal
          title="Quem vem para a equipe?"
          subtitle="Autorize uma pessoa a acessar os cofres compartilhados."
          onClose={close}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              act(async () => {
                const p = {
                  name: String(d.get("name")),
                  email: String(d.get("email")).toLowerCase(),
                  role: String(d.get("role")),
                  status: "invited",
                  twoFactor: false,
                };
                if (demo) {
                  if (samplePeople.some((v) => v.email === p.email))
                    throw new Error("Este e-mail já faz parte da equipe.");
                  setSamplePeople((prev) => [...prev, p]);
                } else {
                  const result = await api("invite", p);
                  setInviteLink(result.invitationUrl);
                  await reload();
                  setModal("inviteLink");
                  return;
                }
                close();
                notify("Convite de demonstração criado.");
              });
            }}
          >
            <label>
              Nome
              <input
                name="name"
                placeholder="Nome da pessoa"
                required
                maxLength={80}
              />
            </label>
            <label>
              E-mail de acesso
              <input
                name="email"
                type="email"
                placeholder="pessoa@escritorio.com.br"
                required
                maxLength={200}
              />
            </label>
            <label>
              Permissão
              <select name="role" defaultValue="reader">
                <option value="reader">
                  Leitor · Consultar e copiar itens
                </option>
                <option value="editor">Editor · Criar e editar itens</option>
                <option value="admin">
                  Administrador · Gerenciar equipe e itens
                </option>
              </select>
            </label>
            <div className="info-note">
              <ShieldCheck size={18} />
              <p>
                Um link individual será criado para a pessoa definir a senha e
                configurar o Google Authenticator. Nenhum e-mail é enviado
                automaticamente.
              </p>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={close}
              >
                Cancelar
              </button>
              <button type="submit" className="button primary" disabled={busy}>
                {busy ? "Autorizando..." : "Autorizar acesso"}
                <ArrowRight size={15} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "vault" && (
        <Modal
          title="Organize em um novo cofre."
          subtitle="Agrupe os itens da equipe por departamento."
          onClose={close}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const name = String(
                new FormData(e.currentTarget).get("name"),
              ).trim();
              setView("vault:" + name);
              setEditing({ vault: name, scope: "team", kind: "login" });
              setModal("item");
            }}
          >
            <label>
              Nome do cofre
              <input
                name="name"
                placeholder="Ex.: Jurídico"
                required
                maxLength={60}
              />
            </label>
            <p className="muted">
              O cofre será criado ao salvar o primeiro item. Todos os membros
              autorizados poderão consultar seus itens compartilhados.
            </p>
            <button className="button primary" type="submit">
              Continuar e adicionar item
              <ArrowRight size={15} />
            </button>
          </form>
        </Modal>
      )}
      {modal === "help" && (
        <Modal
          title="Bem-vindo ao Cofre."
          subtitle="Tudo o que você precisa para começar com tranquilidade."
          onClose={close}
        >
          <div className="help-steps">
            {[
              [
                "1",
                "Ative o seu escritório",
                "Use o link reservado do administrador para definir sua senha e configurar o Google Authenticator.",
              ],
              [
                "2",
                "Organize suas credenciais",
                "Adicione senhas, notas ou cartões. Escolha um cofre e a visibilidade pessoal ou de equipe.",
              ],
              [
                "3",
                "Trabalhe em equipe",
                "Crie convites individuais e escolha a permissão adequada. Cada pessoa define sua senha e seu autenticador.",
              ],
            ].map(([n, t, d]) => (
              <div key={n}>
                <span>{n}</span>
                <section>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </section>
              </div>
            ))}
          </div>
          <div className="shortcut-note">
            <kbd>Ctrl</kbd> + <kbd>K</kbd> para buscar. <kbd>Esc</kbd> para
            fechar.
          </div>
          <button className="button primary full-width" onClick={close}>
            Entendi, vamos lá
            <ArrowRight size={16} />
          </button>
        </Modal>
      )}
      {modal === "demoLock" && (
        <Modal
          title="Prévia bloqueada."
          subtitle="No seu Cofre, o desbloqueio exige o código do autenticador."
          onClose={close}
        >
          <div className="auth-symbol">
            <LockKeyhole size={38} />
          </div>
          <p className="center-muted">
            Ative o seu escritório para proteger seus próprios dados com o
            Google Authenticator.
          </p>
          <div className="modal-actions">
            <button className="button secondary" onClick={close}>
              Voltar à prévia
            </button>
            <button className="button primary" onClick={begin}>
              Ativar meu cofre
            </button>
          </div>
        </Modal>
      )}
      {modal === "recovery" && (
        <Recovery
          codes={recovery}
          onClose={() => {
            setRecovery([]);
            setModal(null);
          }}
        />
      )}
      {confirm && (
        <Modal title={confirm.title} onClose={() => setConfirm(null)}>
          <p className="muted">{confirm.text}</p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setConfirm(null)}
            >
              Cancelar
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  await confirm.action();
                  setConfirm(null);
                })
              }
            >
              Confirmar
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button onClick={() => setToast("")} aria-label="Fechar aviso">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
