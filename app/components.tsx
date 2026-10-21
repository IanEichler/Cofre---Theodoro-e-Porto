"use client";
import { useState, useEffect, useRef } from "react";
import {
  Vault,
  KeyRound,
  FileText,
  CreditCard,
  X,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  WandSparkles,
  Check,
  LockKeyhole,
  ShieldCheck,
  ArrowRight,
  Download,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
export type Item = {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  kind: string;
  scope: string;
  vault: string;
  tags: string[];
  favorite: boolean;
  created: number;
  updated: number;
  deleted: number | null;
  version: number;
  canEdit?: boolean;
};
export type Person = {
  email: string;
  name: string;
  role: string;
  status: string;
  twoFactor: boolean;
};
export const roles: Record<string, string> = {
  admin: "Administrador",
  editor: "Editor",
  reader: "Leitor",
};
export const colors: Record<string, string> = {
  Administrativo: "green",
  Financeiro: "blue",
  Marketing: "purple",
  Tecnologia: "orange",
  Geral: "green",
};
export const initials = (name: string) =>
  name
    .split(/[ @.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
export function strength(p: string) {
  return p.length >= 16 &&
    /[A-Z]/.test(p) &&
    /[a-z]/.test(p) &&
    /\d/.test(p) &&
    /[^\w]/.test(p)
    ? "Forte"
    : p.length >= 12
      ? "Razoável"
      : "Fraca";
}
export function dateLabel(t: number) {
  const d = Math.floor((Date.now() - t) / 86400000);
  return d === 0 ? "Hoje" : d === 1 ? "Ontem" : `Há ${d} dias`;
}
function random(max: number) {
  const a = new Uint32Array(1),
    limit = Math.floor(4294967296 / max) * max;
  do {
    crypto.getRandomValues(a);
  } while (a[0] >= limit);
  return a[0] % max;
}
export function generatePassword(
  length = 20,
  options = [true, true, true, true],
) {
  const sets = [
    "abcdefghijkmnopqrstuvwxyz",
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "23456789",
    "!@#$%&*+-=?",
  ].filter((_, i) => options[i]);
  if (!sets.length) return "";
  const all = sets.join(""),
    chars = sets.map((s) => s[random(s.length)]);
  while (chars.length < length) chars.push(all[random(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
function faviconOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    // The request contains only the website origin, never credentials, paths or query strings.
    url.protocol = "https:";
    return url.origin;
  } catch {
    return null;
  }
}
function WebsiteFavicon({
  origin,
  kind,
}: {
  origin: string | null;
  kind: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const paths = ["/favicon.ico", "/favicon.svg", "/apple-touch-icon.png"];
  const source =
    origin && attempt < paths.length ? origin + paths[attempt] : null;
  return (
    <div
      className={`brand ${source ? "website-favicon" : "generic"}`}
      aria-hidden="true"
    >
      {!loaded &&
        (kind === "note" ? (
          <FileText size={21} />
        ) : kind === "card" ? (
          <CreditCard size={21} />
        ) : (
          <KeyRound size={21} />
        ))}
      {source && (
        <img
          key={source}
          src={source}
          alt=""
          width={22}
          height={22}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          className={loaded ? "favicon-image is-loaded" : "favicon-image"}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setAttempt((value) => value + 1);
          }}
        />
      )}
    </div>
  );
}
export function Brand({ item }: { item: Item }) {
  const origin = item.kind === "login" ? faviconOrigin(item.url) : null;
  return (
    <WebsiteFavicon
      key={`${item.kind}:${origin || "none"}`}
      origin={origin}
      kind={item.kind}
    />
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    const elements = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          "button,input,select,textarea,a[href]",
        ) || [],
      ).filter((e) => !e.hasAttribute("disabled"));
    elements()[0]?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const els = elements(),
          first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", listener, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", listener, true);
      document.body.style.overflow = overflow;
      old?.focus();
    };
  }, []);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export async function api(
  op: string,
  data: Record<string, unknown> = {},
): Promise<any> {
  const res = await fetch("/api/cofre", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, ...data }),
  });
  const value = (await res.json()) as any;
  if (!res.ok)
    throw Object.assign(
      new Error(value.error || "Não foi possível concluir."),
      { status: res.status },
    );
  return value;
}
export function ItemForm({
  item,
  vaults,
  busy,
  error,
  reader,
  onSave,
}: {
  item: Partial<Item> | null;
  vaults: string[];
  busy: boolean;
  error: string;
  reader: boolean;
  onSave: (value: any) => void;
}) {
  const [password, setPassword] = useState(item?.password || ""),
    [reveal, setReveal] = useState(false),
    [kind, setKind] = useState(item?.kind || "login");
  return (
    <form
      className="form-stack item-form"
      onSubmit={(e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        onSave({
          title: d.get("title"),
          username: d.get("username") || "",
          password,
          url: d.get("url") || "",
          notes: d.get("notes") || "",
          kind,
          scope: d.get("scope"),
          vault: d.get("vault"),
          tags: String(d.get("tags") || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        });
      }}
    >
      <div className="type-picker">
        {[
          { id: "login", label: "Senha", Icon: KeyRound },
          { id: "note", label: "Nota segura", Icon: FileText },
          { id: "card", label: "Cartão", Icon: CreditCard },
        ].map(({ id, label, Icon }) => (
          <button
            type="button"
            key={id}
            className={kind === id ? "selected" : ""}
            onClick={() => setKind(id)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </div>
      <label>
        Nome do item
        <input
          name="title"
          defaultValue={item?.title || ""}
          placeholder="Nome do serviço ou acesso"
          required
          maxLength={120}
        />
      </label>
      {kind !== "note" && (
        <>
          <label>
            {kind === "card" ? "Titular do cartão" : "Usuário ou e-mail"}
            <input
              name="username"
              defaultValue={item?.username || ""}
              placeholder="Usuário ou e-mail de acesso"
              maxLength={200}
              autoComplete="off"
            />
          </label>
          <label>
            {kind === "card" ? "Número e dados do cartão" : "Senha"}
            <div className="password-input">
              <input
                type={reveal ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={2000}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => setReveal(!reveal)}
                aria-label="Mostrar ou ocultar senha"
              >
                {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              {kind === "login" && (
                <button
                  type="button"
                  className="generate-inline"
                  onClick={() => {
                    setPassword(generatePassword());
                    setReveal(true);
                  }}
                >
                  <WandSparkles size={14} />
                  Gerar
                </button>
              )}
            </div>
          </label>
          {kind === "login" && (
            <label>
              Site
              <input
                name="url"
                type="url"
                defaultValue={item?.url || ""}
                placeholder="https://"
                maxLength={1000}
              />
            </label>
          )}
        </>
      )}
      <div className="form-columns">
        <label>
          Cofre
          <input
            name="vault"
            list="vault-options"
            defaultValue={item?.vault || ""}
            placeholder="Nome do departamento ou grupo"
            required
            maxLength={60}
          />
          <datalist id="vault-options">
            {vaults.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </label>
        <label>
          Visibilidade
          <select
            name="scope"
            defaultValue={reader ? "personal" : item?.scope || "team"}
          >
            <option value="team" disabled={reader}>
              Compartilhado com a equipe
            </option>
            <option value="personal">Pessoal · Somente eu</option>
          </select>
        </label>
      </div>
      <label>
        Notas {kind !== "note" && <small>(opcional)</small>}
        <textarea
          name="notes"
          rows={3}
          defaultValue={item?.notes || ""}
          placeholder="Informações que merecem ficar em segurança..."
          maxLength={10000}
          required={kind === "note"}
        />
      </label>
      <label>
        Marcadores <small>(separados por vírgula)</small>
        <input
          name="tags"
          defaultValue={item?.tags?.join(", ") || ""}
          placeholder="Separe os marcadores por vírgula"
          maxLength={300}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-save">
        <span>
          <LockKeyhole size={13} />
          Protegido no seu cofre
        </span>
        <button type="submit" className="button primary" disabled={busy}>
          {busy
            ? "Salvando..."
            : item?.id
              ? "Salvar alterações"
              : "Adicionar ao cofre"}
          <Check size={16} />
        </button>
      </div>
    </form>
  );
}
export function Generator({
  onClose,
  copy,
}: {
  onClose: () => void;
  copy: (text: string, label?: string) => void;
}) {
  const [length, setLength] = useState(20),
    [options, setOptions] = useState([true, true, true, true]),
    [password, setPassword] = useState("");
  useEffect(() => setPassword(generatePassword()), []);
  return (
    <Modal
      title="Uma senha só sua."
      subtitle="Combinações aleatórias para deixar suas contas mais seguras."
      onClose={onClose}
    >
      <div className="generator-output">
        <code>{password}</code>
        <button
          className="icon-btn"
          onClick={() => setPassword(generatePassword(length, options))}
          aria-label="Gerar outra senha"
        >
          <RefreshCw size={20} />
        </button>
      </div>
      <div className="generated-strength">
        <span className={`strength ${length >= 16 ? "strong" : "medium"}`}>
          <span />
          {length >= 16 ? "Senha forte" : "Use 16 ou mais caracteres"}
        </span>
        <span>Gerada no navegador</span>
      </div>
      <div className="range-label">
        <strong>Tamanho da senha</strong>
        <span>{length} caracteres</span>
      </div>
      <input
        className="range"
        type="range"
        min={8}
        max={64}
        value={length}
        onChange={(e) => {
          const n = Number(e.target.value);
          setLength(n);
          setPassword(generatePassword(n, options));
        }}
        aria-label="Tamanho da senha"
      />
      <div className="generator-options">
        {[
          "Letras minúsculas (a–z)",
          "Letras maiúsculas (A–Z)",
          "Números (0–9)",
          "Símbolos (!@#$)",
        ].map((label, i) => (
          <label key={label}>
            <input
              type="checkbox"
              checked={options[i]}
              disabled={options[i] && options.filter(Boolean).length === 1}
              onChange={() => {
                const next = options.map((v, j) => (j === i ? !v : v));
                setOptions(next);
                setPassword(generatePassword(length, next));
              }}
            />
            {label}
          </label>
        ))}
      </div>
      <div className="modal-actions">
        <button
          className="button secondary"
          onClick={() => setPassword(generatePassword(length, options))}
        >
          <RefreshCw size={16} />
          Gerar outra
        </button>
        <button
          className="button primary"
          onClick={() => copy(password, "Senha gerada e copiada")}
        >
          <Copy size={16} />
          Copiar senha
        </button>
      </div>
    </Modal>
  );
}
export function Recovery({
  codes,
  onClose,
}: {
  codes: string[];
  onClose: () => void;
}) {
  return (
    <Modal
      title="Guarde seus códigos de recuperação."
      subtitle="Eles são exibidos uma única vez. Cada código pode ser usado uma vez."
      onClose={() => {}}
    >
      <div className="info-note">
        <AlertTriangle size={18} />
        <p>
          Guarde em um local seguro fora do Cofre. Você precisará deles se
          perder o acesso ao celular.
        </p>
      </div>
      <div className="recovery-grid">
        {codes.map((c) => (
          <code key={c}>{c}</code>
        ))}
      </div>
      <button
        className="button secondary full-width"
        onClick={() => {
          const blob = new Blob(
            [
              "Cofre — códigos de recuperação\nCada código pode ser utilizado uma única vez. Guarde fora do Cofre.\n\n" +
                codes.join("\n"),
            ],
            { type: "text/plain;charset=utf-8" },
          );
          const url = URL.createObjectURL(blob),
            a = document.createElement("a");
          a.href = url;
          a.download = "cofre-codigos-recuperacao.txt";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      >
        <Download size={16} />
        Baixar códigos
      </button>
      <button
        className="button primary full-width recovery-done"
        onClick={onClose}
      >
        Já salvei. Abrir meu cofre <ArrowRight size={16} />
      </button>
    </Modal>
  );
}
