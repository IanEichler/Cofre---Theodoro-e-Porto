"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Vault,
  ShieldCheck,
  LockKeyhole,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Mail,
  Copy,
  Check,
  KeyRound,
  Fingerprint,
  CircleHelp,
} from "lucide-react";
import { api, Person } from "./components";

export function AuthScreen({
  phase,
  user,
  serverError,
  reload,
  onRecovery,
  onPreview,
}: {
  phase: string;
  user?: Person;
  serverError?: string;
  reload: () => Promise<void>;
  onRecovery: (codes: string[]) => void;
  onPreview: () => void;
}) {
  const [mode, setMode] = useState("login"),
    [token, setToken] = useState(""),
    [email, setEmail] = useState(""),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reveal, setReveal] = useState(false),
    [secret, setSecret] = useState(""),
    [qr, setQr] = useState(""),
    [copied, setCopied] = useState(false),
    [help, setHelp] = useState(false);
  useEffect(() => {
    let current = "";
    function readAccessLink() {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const setup = fragment.get("configurar"), invitation = fragment.get("convite");
      if (!setup && !invitation) return;
      const value = setup || invitation!;
      current = value;
      setToken(value);
      setError("");
      setMode("checking");
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      api(setup ? "setup-info" : "invite-info", { token: value }).then(result => {
        if (current !== value) return;
        setEmail(result.email);
        setName(result.name || "");
        setMode(setup ? "setup" : result.reset ? "reset" : "invite");
      }).catch(error => {
        if (current !== value) return;
        setError(error.message);
        setMode("login");
      });
    }
    readAccessLink();
    window.addEventListener("hashchange", readAccessLink);
    return () => { current = ""; window.removeEventListener("hashchange", readAccessLink); };
  }, []);
  useEffect(() => {
    if (phase !== "enroll" || secret) return;
    let active = true;
    api("enroll")
      .then(async (result) => {
        const image = await QRCode.toDataURL(result.uri, {
          width: 208,
          margin: 1,
          color: { dark: "#262626", light: "#ffffff" },
        });
        if (active) {
          setSecret(result.secret);
          setQr(image);
        }
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [phase, secret]);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (error: any) {
      setError(error.message);
      if (error.status === 401 && phase !== "signin") await reload();
    } finally {
      setBusy(false);
    }
  }
  const passwordStep = ["setup", "invite", "reset"].includes(mode),
    secondFactor = phase === "locked" || phase === "enroll",
    checking = phase === "loading" || mode === "checking";
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <a href="/" className="auth-logo">
          <span>
            <Vault size={27} strokeWidth={1.6} />
          </span>
          Cofre<span className="auth-logo-dot">.</span>
        </a>
        <div className="auth-story-copy">
          <span className="auth-kicker">THEODORO & PORTO · USO INTERNO</span>
          <h1>
            Seu escritório.
            <br />
            Seus acessos.
            <br />
            <span>Tudo protegido.</span>
          </h1>
          <p>
            Um lugar seguro para as senhas que
            <br className="desktop-break" /> fazem o seu trabalho acontecer.
          </p>
          <div className="auth-art" aria-hidden="true">
            <div className="art-orbit orbit-1" />
            <div className="art-orbit orbit-2" />
            <div className="art-grid" />
            <div className="art-vault">
              <Vault size={85} strokeWidth={1} />
              <i />
            </div>
            <span className="art-key">
              <KeyRound size={22} />
            </span>
            <span className="art-shield">
              <ShieldCheck size={23} />
            </span>
            <span className="art-dot dot-1" />
            <span className="art-dot dot-2" />
          </div>
        </div>
        <div className="auth-story-footer">
          <ShieldCheck size={16} />
          <span>Acesso por e-mail, senha e Google Authenticator.</span>
        </div>
      </aside>
      <section className="auth-form-side">
        <div className="auth-topline">
          <span>ACESSO AO ESCRITÓRIO</span>
          <button onClick={() => setHelp(!help)}>
            <CircleHelp size={16} />
            Precisa de ajuda?
          </button>
        </div>
        <div className="auth-form-wrap">
          <div className="auth-step-icon">
            {secondFactor ? (
              <Fingerprint size={26} />
            ) : passwordStep ? (
              <KeyRound size={25} />
            ) : (
              <LockKeyhole size={25} />
            )}
          </div>
          <span className="auth-small-label">
            {secondFactor
              ? "SEGUNDO FATOR"
              : passwordStep
                ? "CONFIGURAÇÃO RESERVADA"
                : "BEM-VINDO AO COFRE"}
          </span>
          <h2>
            {checking
              ? "Preparando seu acesso..."
              : passwordStep
                ? mode === "setup"
                  ? "Defina sua senha de acesso."
                  : mode === "reset"
                    ? "Uma nova senha de acesso."
                    : "Você faz parte da equipe."
                : phase === "enroll"
                  ? "Uma camada extra de proteção."
                  : phase === "locked"
                    ? "Só falta confirmar que é você."
                    : "Entre no seu cofre."}
          </h2>
          <p className="auth-intro">
            {checking
              ? "Estamos verificando a conexão segura."
              : passwordStep
                ? "Defina sua senha pessoal. O próximo passo é o Google Authenticator."
                : phase === "enroll"
                  ? "Escaneie o QR Code no Google Authenticator e informe o código de seis dígitos."
                  : phase === "locked"
                    ? `Abra o Google Authenticator para continuar como ${user?.email || "sua conta"}.`
                    : "Use seu e-mail e sua senha para acessar as credenciais do escritório."}
          </p>
          {help && (
            <div className="auth-help">
              <strong>Primeiro acesso ou esqueceu a senha?</strong>
              <p>
                Peça ao administrador um link de convite ou redefinição. O
                convite permite definir sua senha. Se sua conta já tem segundo
                fator, ele continua obrigatório após a redefinição.
              </p>
            </div>
          )}
          {(error || serverError) && (
            <p className="form-error auth-error" role="alert">
              {error || serverError}
            </p>
          )}
          {checking ? (
            <div className="auth-loading">
              <span />
              <span />
              <span />
            </div>
          ) : secondFactor ? (
            <>
              {phase === "enroll" && (
                <>
                  <div className="qr-box">
                    {qr ? (
                      <img
                        src={qr}
                        width={184}
                        height={184}
                        alt="QR Code para configurar o Google Authenticator"
                      />
                    ) : (
                      <span>Preparando QR Code...</span>
                    )}
                  </div>
                  <details className="manual-key">
                    <summary>Prefiro inserir a chave manualmente</summary>
                    <p>
                      No Authenticator, toque em +, escolha “Inserir chave de
                      configuração”, nome Cofre e tipo “Baseada no horário”.
                    </p>
                    <div>
                      <code>{secret.match(/.{1,4}/g)?.join(" ")}</code>
                      <button
                        type="button"
                        aria-label="Copiar chave do autenticador"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(secret);
                            setCopied(true);
                          } catch {
                            setError("Selecione a chave e copie manualmente.");
                          }
                        }}
                      >
                        {copied ? <Check size={17} /> : <Copy size={17} />}
                      </button>
                    </div>
                  </details>
                </>
              )}
              <form
                className="form-stack auth-login-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const code = String(
                    new FormData(event.currentTarget).get("code"),
                  );
                  run(async () => {
                    const result = await api("verify", { code });
                    setSecret("");
                    setQr("");
                    setMode("login");
                    if (result.recoveryCodes?.length)
                      onRecovery(result.recoveryCodes);
                    await reload();
                  });
                }}
              >
                <label>
                  {phase === "enroll"
                    ? "Código do autenticador"
                    : "Código do autenticador ou de recuperação"}
                  <input
                    className="auth-code"
                    name="code"
                    placeholder="000 000"
                    autoComplete="one-time-code"
                    maxLength={32}
                    required
                    spellCheck={false}
                  />
                </label>
                <button
                  className="button primary auth-submit"
                  type="submit"
                  disabled={busy || (phase === "enroll" && !secret)}
                >
                  {busy
                    ? "Verificando..."
                    : phase === "enroll"
                      ? "Ativar proteção e entrar"
                      : "Desbloquear cofre"}
                  <ArrowRight size={17} />
                </button>
              </form>
              <button
                className="auth-back"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api("logout");
                    setSecret("");
                    await reload();
                  })
                }
              >
                <ArrowLeft size={14} />
                Voltar ao login
              </button>
            </>
          ) : passwordStep ? (
            <form
              className="form-stack auth-login-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget),
                  password = String(form.get("password"));
                if (password !== form.get("confirm")) {
                  setError("As senhas não coincidem.");
                  return;
                }
                run(async () => {
                  await api(mode === "setup" ? "initialize" : "accept-invite", {
                    token,
                    password,
                  });
                  setToken("");
                  setMode("login");
                  await reload();
                });
              }}
            >
              <label>
                E-mail
                <input
                  type="email"
                  value={email}
                  readOnly
                  autoComplete="username"
                />
              </label>
              {mode === "invite" && name && (
                <p className="auth-invite-name">Bem-vindo, {name}.</p>
              )}
              <label>
                Crie sua senha
                <div className="password-input">
                  <input
                    type={reveal ? "text" : "password"}
                    name="password"
                    autoComplete="new-password"
                    placeholder="Pelo menos 12 caracteres"
                    minLength={12}
                    maxLength={128}
                    required
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Mostrar ou ocultar senha"
                    onClick={() => setReveal(!reveal)}
                  >
                    {reveal ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>
              <label>
                Confirme a senha
                <input
                  type={reveal ? "text" : "password"}
                  name="confirm"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </label>
              <small className="auth-password-tip">
                Use uma senha longa e exclusiva para o Cofre.
              </small>
              <button
                className="button primary auth-submit"
                type="submit"
                disabled={busy}
              >
                {busy
                  ? "Preparando acesso..."
                  : "Continuar para o segundo fator"}
                <ArrowRight size={16} />
              </button>
            </form>
          ) : (
            <form
              className="form-stack auth-login-form"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                run(async () => {
                  await api("login", {
                    email: data.get("email"),
                    password: data.get("password"),
                  });
                  await reload();
                });
              }}
            >
              <label>
                E-mail
                <div className="auth-email-input">
                  <Mail size={17} />
                  <input
                    name="email"
                    type="email"
                    autoComplete="username"
                    placeholder="voce@theodoroeporto.adv.br"
                    required
                    maxLength={200}
                  />
                </div>
              </label>
              <label>
                Senha
                <div className="password-input">
                  <input
                    name="password"
                    type={reveal ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Sua senha de acesso"
                    required
                    maxLength={128}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Mostrar ou ocultar senha"
                    onClick={() => setReveal(!reveal)}
                  >
                    {reveal ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>
              <button
                type="button"
                className="auth-forgot"
                onClick={() => setHelp(true)}
              >
                Esqueci minha senha
              </button>
              <button
                className="button primary auth-submit"
                type="submit"
                disabled={busy}
              >
                {busy ? "Verificando acesso..." : "Entrar com segurança"}
                <ArrowRight size={17} />
              </button>
            </form>
          )}
          {!checking && !passwordStep && !secondFactor && (
            <>
              <div className="auth-divider">
                <span>SEU ACESSO, MAIS PROTEGIDO</span>
              </div>
              <div className="auth-second-factor-note">
                <span>
                  <ShieldCheck size={21} />
                </span>
                <p>
                  Depois da senha, vamos pedir o código do
                  <br />
                  Google Authenticator. Uma camada extra de cuidado.
                </p>
              </div>
              {process.env.NODE_ENV === "development" && (
                <button className="auth-demo-link" onClick={onPreview}>
                  Conhecer a interface com dados fictícios
                  <ArrowRight size={13} />
                </button>
              )}
            </>
          )}
        </div>
        <footer className="auth-page-footer">
          <span>Cofre · Theodoro & Porto</span>
          <span>
            <LockKeyhole size={11} />
            Conexão protegida
          </span>
        </footer>
      </section>
    </div>
  );
}
