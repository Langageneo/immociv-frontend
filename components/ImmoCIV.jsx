"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/* ═══════════════════════════════════════════════════════════
   API CONFIG
═══════════════════════════════════════════════════════════ */
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const getToken  = () => { try { return localStorage.getItem("immociv_token"); } catch { return null; } };
const saveToken = (t) => { try { localStorage.setItem("immociv_token", t); } catch {} };
const dropToken = () => { try { localStorage.removeItem("immociv_token"); } catch {} };

async function api(path, opts = {}) {
  const token   = getToken();
  const headers = { "Content-Type": "application/json", ...opts.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res  = await fetch(`${API}${path}`, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Erreur ${res.status}`);
  return data;
}

async function apiForm(path, formData) {
  const token   = getToken();
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res  = await fetch(`${API}${path}`, { method: "POST", headers, body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Erreur upload");
  return data;
}

const AUTH = {
  register: (b) => api("/auth/register", { method: "POST", body: JSON.stringify(b) }),
  login: async (b) => {
    const d = await api("/auth/login", { method: "POST", body: JSON.stringify(b) });
    if (d.token) saveToken(d.token);
    return d;
  },
  me:     () => api("/auth/me"),
  logout: () => dropToken(),
};

const PROPS = {
  list: (p = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(p).filter(([, v]) => v !== "" && v != null))
    ).toString();
    return api(`/properties${qs ? `?${qs}` : ""}`);
  },
  byId:   (id) => api(`/properties/${id}`),
  create: (fd)  => apiForm("/properties", fd),
  delete: (id)  => api(`/properties/${id}`, { method: "DELETE" }),
  mine:   ()    => api("/properties/user/mine"),
};

const ADMIN = {
  stats:      ()   => api("/admin/stats"),
  allProps:   (s)  => api(`/admin/properties${s ? `?status=${s}` : ""}`),
  toggleProp: (id) => api(`/admin/properties/${id}/toggle`, { method: "PATCH" }),
  delProp:    (id) => api(`/admin/properties/${id}`, { method: "DELETE" }),
  users:      ()   => api("/admin/users"),
  toggleUser: (id) => api(`/admin/users/${id}/toggle`, { method: "PATCH" }),
};

const TM = {
  maison:      { icon: "🏠", label: "Maison",      color: "#D97706", bg: "linear-gradient(135deg,#FEF3C7,#FDE68A)" },
  appartement: { icon: "🏢", label: "Appartement", color: "#0369A1", bg: "linear-gradient(135deg,#DBEAFE,#BFDBFE)" },
  terrain:     { icon: "🌿", label: "Terrain",     color: "#15803D", bg: "linear-gradient(135deg,#DCFCE7,#BBF7D0)" },
};

const fmt = (p, t) => {
  if (t === "location") return `${p.toLocaleString("fr-FR")} F/mois`;
  if (p >= 1_000_000)   return `${(p / 1_000_000).toFixed(p % 1_000_000 === 0 ? 0 : 1)}M FCFA`;
  return `${p.toLocaleString("fr-FR")} FCFA`;
};

/* ═══════════════════════════════════════════════════════════
   ROOT
═══════════════════════════════════════════════════════════ */
export default function ImmoCIV() {
  const [screen,   setScreen]   = useState("home");
  const [modal,    setModal]    = useState(null);
  const [user,     setUser]     = useState(null);
  const [selected, setSelected] = useState(null);
  const [toast,    setToast]    = useState(null);
  const [props,    setProps]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [fType,    setFType]    = useState("");
  const [fListing, setFListing] = useState("");
  const [fLoc,     setFLoc]     = useState("");
  const [fBudget,  setFBudget]  = useState("");

  useEffect(() => {
    if (!document.getElementById("icv-font")) {
      const l = document.createElement("link");
      l.id = "icv-font"; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap";
      document.head.appendChild(l);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    AUTH.me().then((d) => setUser(d.user)).catch(() => dropToken());
  }, []);

  const toast$ = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }, []);

  const loadProps = useCallback(async (ov = {}) => {
    setLoading(true);
    try {
      const d = await PROPS.list({
        type:        ov.type    !== undefined ? ov.type    : fType,
        listingType: ov.listing !== undefined ? ov.listing : fListing,
        location:    ov.loc     !== undefined ? ov.loc     : fLoc,
        maxPrice:    ov.budget  !== undefined ? ov.budget  : fBudget,
      });
      setProps(d.properties || []);
    } catch (err) {
      toast$("❌ " + err.message);
    } finally {
      setLoading(false);
    }
  }, [fType, fListing, fLoc, fBudget, toast$]);

  const goSearch = useCallback((type = "") => {
    setFType(type);
    setScreen("results");
    loadProps({ type });
  }, [loadProps]);

  const goDetail = useCallback(async (prop) => {
    try {
      const d = await PROPS.byId(prop._id);
      setSelected(d.property);
    } catch {
      setSelected(prop);
    }
    setScreen("detail");
  }, []);

  const logout = useCallback(() => {
    AUTH.logout();
    setUser(null);
    toast$("Déconnecté");
  }, [toast$]);

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {screen === "home"    && <HomeScreen    user={user} setModal={setModal} logout={logout} goSearch={goSearch} setScreen={setScreen} />}
        {screen === "results" && <ResultsScreen props={props} loading={loading} fType={fType} setFType={setFType} fListing={fListing} setFListing={setFListing} fLoc={fLoc} setFLoc={setFLoc} fBudget={fBudget} setFBudget={setFBudget} loadProps={loadProps} goDetail={goDetail} goBack={() => setScreen("home")} />}
        {screen === "detail"  && <DetailScreen  prop={selected} goBack={() => setScreen("results")} />}
        {screen === "admin"   && <AdminScreen   goBack={() => setScreen("home")} toast$={toast$} />}

        {modal === "login"    && <Sheet onClose={() => setModal(null)}><AuthSheet    mode="login"    setMode={setModal} setUser={setUser} onClose={() => setModal(null)} toast$={toast$} /></Sheet>}
        {modal === "register" && <Sheet onClose={() => setModal(null)}><AuthSheet    mode="register" setMode={setModal} setUser={setUser} onClose={() => setModal(null)} toast$={toast$} /></Sheet>}
        {modal === "publish"  && <Sheet onClose={() => setModal(null)}><PublishSheet user={user} onClose={() => setModal(null)} onDone={() => { toast$("✅ Annonce publiée !"); if (screen === "results") loadProps(); }} toast$={toast$} /></Sheet>}

        {(screen === "home" || screen === "results") && (
          <button className="fab" onClick={() => user ? setModal("publish") : setModal("login")}>
            <span style={{ fontSize: 26, lineHeight: 1 }}>+</span>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>PUBLIER</span>
          </button>
        )}

        {toast && <div className="toast">{toast}</div>}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   HOME
═══════════════════════════════════════════════════════════ */
function HomeScreen({ user, setModal, logout, goSearch, setScreen }) {
  return (
    <div className="screen">
      <nav className="nav">
        <div>
          <div className="logo">ImmoCIV</div>
          <div className="logo-sub">🇨🇮 Côte d'Ivoire</div>
        </div>
        {user ? (
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {user.role === "admin" && <button className="btn-outline" onClick={() => setScreen("admin")}>🛡 Admin</button>}
            <span className="user-pill">👤 {user.name.split(" ")[0]}</span>
            <button className="btn-ghost" onClick={logout}>✕</button>
          </div>
        ) : (
          <button className="btn-primary sm" onClick={() => setModal("login")}>Connexion</button>
        )}
      </nav>

      <div className="hero">
        <div className="hero-eyebrow">Immobilier simplifié</div>
        <h1 className="hero-title">Trouve ton<br />bien idéal<span className="dot">.</span></h1>
        <p className="hero-sub">Vente & Location partout en Côte d'Ivoire</p>
        <div className="cat-grid">
          {Object.entries(TM).map(([k, m]) => (
            <button key={k} className="cat-card" onClick={() => goSearch(k)}>
              <span className="cat-icon">{m.icon}</span>
              <span className="cat-label">{m.label}</span>
              <span className="cat-arrow">→</span>
            </button>
          ))}
        </div>
        <button className="btn-see-all" onClick={() => goSearch("")}>🔍 Voir toutes les annonces</button>
      </div>

      <div className="strip">
        {[["🏠","Maisons"],["🏢","Apparts"],["🌿","Terrains"],["💬","WhatsApp direct"]].map(([i,l]) => (
          <div key={l} className="strip-item"><span>{i}</span><span className="strip-lbl">{l}</span></div>
        ))}
      </div>

      <div className="section">
        <div className="section-title">Comment ça marche ?</div>
        <div className="steps">
          {[
            ["1","Choisis le type de bien","Maison, appartement ou terrain"],
            ["2","Filtre par budget et quartier","Affine ta recherche"],
            ["3","Contacte via WhatsApp","Direct, sans intermédiaire"],
          ].map(([n,t,s]) => (
            <div key={n} className="step">
              <div className="step-num">{n}</div>
              <div><div className="step-title">{t}</div><div className="step-sub">{s}</div></div>
            </div>
          ))}
        </div>
      </div>

      <div className="pub-banner">
        <div className="pub-title">Tu veux vendre ou louer ?</div>
        <div className="pub-sub">Publie ton annonce gratuitement en 2 minutes</div>
        <button className="btn-pub-big" onClick={() => user ? setModal("publish") : setModal("login")}>
          📢 Publier une annonce gratuite
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   RESULTS
═══════════════════════════════════════════════════════════ */
function ResultsScreen({ props, loading, fType, setFType, fListing, setFListing, fLoc, setFLoc, fBudget, setFBudget, loadProps, goDetail, goBack }) {
  const locRef    = useRef(null);
  const budgetRef = useRef(null);

  const search = () => loadProps({
    loc:    locRef.current?.value    || fLoc,
    budget: budgetRef.current?.value || fBudget,
  });

  const clear = () => {
    setFType(""); setFListing(""); setFLoc(""); setFBudget("");
    if (locRef.current)    locRef.current.value    = "";
    if (budgetRef.current) budgetRef.current.value = "";
    loadProps({ type:"", listing:"", loc:"", budget:"" });
  };

  return (
    <div className="screen">
      <nav className="nav">
        <button className="back-btn" onClick={goBack}>← Accueil</button>
        <span className="nav-title">{fType ? `${TM[fType]?.icon} ${TM[fType]?.label}s` : "Toutes les annonces"}</span>
        <span className="result-badge">{props.length}</span>
      </nav>

      <div className="filter-bar">
        <div className="type-pills">
          {[["","🔍 Tout"],["maison","🏠 Maison"],["appartement","🏢 Appart."],["terrain","🌿 Terrain"]].map(([v,l]) => (
            <button key={v} className={`type-pill${fType===v?" active":""}`}
              onClick={() => { setFType(v); loadProps({ type: v }); }}>{l}
            </button>
          ))}
        </div>
        <div className="frow">
          <input
            className="finput"
            placeholder="📍 Quartier ou ville..."
            defaultValue={fLoc}
            ref={locRef}
            onBlur={e => setFLoc(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search()}
          />
          <select className="fselect" value={fListing} onChange={e => { setFListing(e.target.value); loadProps({ listing: e.target.value }); }}>
            <option value="">Vente & Location</option>
            <option value="vente">À Vendre</option>
            <option value="location">À Louer</option>
          </select>
        </div>
        <div className="frow">
          <input
            className="finput"
            type="number"
            placeholder="💰 Budget max (FCFA)"
            defaultValue={fBudget}
            ref={budgetRef}
            onBlur={e => setFBudget(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search()}
          />
          <button className="search-btn" onClick={search}>Chercher</button>
          {(fType||fListing||fLoc||fBudget) && <button className="clear-btn" onClick={clear}>✕</button>}
        </div>
      </div>

      <div className="card-list">
        {loading ? (
          <div className="loading-state"><div className="spinner"/><p style={{marginTop:12,color:"#999",fontSize:14}}>Chargement...</p></div>
        ) : props.length === 0 ? (
          <div className="empty"><div style={{fontSize:52}}>🔍</div><div className="empty-t">Aucune annonce trouvée</div><div className="empty-s">Modifie tes filtres ou publie la première</div></div>
        ) : props.map((p, i) => <PropCard key={p._id} prop={p} idx={i} onClick={() => goDetail(p)} />)}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DETAIL
═══════════════════════════════════════════════════════════ */
function DetailScreen({ prop: p, goBack }) {
  if (!p) return null;
  const m = TM[p.type] || TM.maison;
  const wa = `https://wa.me/${p.contactPhone}?text=${encodeURIComponent(`Bonjour, je suis intéressé par : ${p.title} — ${p.location}`)}`;

  return (
    <div className="screen">
      <nav className="nav dark">
        <button className="back-btn light" onClick={goBack}>← Retour</button>
        <span className="nav-title light">Détail du bien</span>
        <div style={{width:60}}/>
      </nav>

      {p.images?.length > 0 ? (
        <div className="d-img-real">
          <img src={p.images[0]} alt={p.title} style={{width:"100%",height:"100%",objectFit:"cover"}} />
          <div className="d-img-badges">
            <span className="badge" style={{background:p.listingType==="vente"?"#D97706":"#15803D"}}>{p.listingType==="vente"?"À VENDRE":"À LOUER"}</span>
            <span className="badge dark-badge">👁 {p.views} vues</span>
          </div>
        </div>
      ) : (
        <div className="d-img" style={{background:m.bg}}>
          <span className="d-big-icon">{m.icon}</span>
          <div className="d-img-badges">
            <span className="badge" style={{background:p.listingType==="vente"?"#D97706":"#15803D"}}>{p.listingType==="vente"?"À VENDRE":"À LOUER"}</span>
            <span className="badge dark-badge">👁 {p.views} vues</span>
          </div>
        </div>
      )}

      {p.images?.length > 1 && (
        <div className="img-strip">
          {p.images.map((url, i) => <img key={i} src={url} alt="" className="img-thumb" />)}
        </div>
      )}

      <div className="d-body">
        <div className="d-type" style={{color:m.color}}>{m.icon} {m.label}</div>
        <h2 className="d-title">{p.title}</h2>
        <div className="d-price">{fmt(p.price, p.listingType)}</div>
        <div className="d-loc">📍 {p.location}</div>
        <div className="divider"/>
        {p.description && <><div className="d-section-label">Description</div><p className="d-desc">{p.description}</p><div className="divider"/></>}
        <div className="info-grid">
          {[["Type",`${m.icon} ${m.label}`],["Transaction",p.listingType==="vente"?"🔑 Vente":"🏷 Location"],["Quartier",`📍 ${p.location.split(",")[0]}`],["Vues",`👁 ${p.views}`]].map(([k,v])=>(
            <div key={k} className="info-cell"><div className="info-k">{k}</div><div className="info-v">{v}</div></div>
          ))}
        </div>
        <div className="divider"/>
        <div className="wa-label">Intéressé ? Contacte le vendeur directement</div>
        <a href={wa} target="_blank" rel="noreferrer" style={{textDecoration:"none",display:"block"}}>
          <button className="wa-btn"><span style={{fontSize:24}}>💬</span><span>Contacter sur WhatsApp</span></button>
        </a>
        <div className="wa-hint">Lien direct · Gratuit · Sans intermédiaire</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ADMIN
═══════════════════════════════════════════════════════════ */
function AdminScreen({ goBack, toast$ }) {
  const [stats, setStats] = useState(null);
  const [list,  setList]  = useState([]);
  const [busy,  setBusy]  = useState(true);

  useEffect(() => {
    Promise.all([ADMIN.stats(), ADMIN.allProps()])
      .then(([s, p]) => { setStats(s); setList(p.properties || []); })
      .catch(e => toast$("❌ " + e.message))
      .finally(() => setBusy(false));
  }, [toast$]);

  const toggle = async (id) => {
    try {
      await ADMIN.toggleProp(id);
      setList(l => l.map(p => p._id===id ? {...p, status: p.status==="active"?"inactive":"active"} : p));
      toast$("Statut mis à jour ✓");
    } catch (e) { toast$("❌ " + e.message); }
  };

  const del = async (id) => {
    try {
      await ADMIN.delProp(id);
      setList(l => l.filter(p => p._id !== id));
      toast$("🗑 Supprimée");
    } catch (e) { toast$("❌ " + e.message); }
  };

  return (
    <div className="screen">
      <nav className="nav dark">
        <button className="back-btn light" onClick={goBack}>← Accueil</button>
        <span className="nav-title light" style={{color:"#F59E0B"}}>🛡 Admin Panel</span>
        <div style={{width:60}}/>
      </nav>

      {busy ? <div className="loading-state"><div className="spinner"/></div> : <>
        <div style={{padding:"20px 20px 8px"}}>
          <div className="admin-title">Tableau de bord</div>
          <div className="admin-sub">ImmoCIV · Statistiques temps réel</div>
        </div>

        {stats && (
          <div className="stat-grid">
            {[[stats.totalProperties,"Total annonces","#E86A2E"],[stats.activeProperties,"Actives","#15803D"],[stats.inactiveProperties,"Inactives","#6B7280"],[stats.totalViews,"Vues totales","#D97706"],[stats.totalUsers,"Utilisateurs","#0369A1"]].map(([n,l,c]) => (
              <div key={l} className="stat-card" style={{"--c":c}}><div className="stat-n">{n}</div><div className="stat-l">{l}</div></div>
            ))}
          </div>
        )}

        {stats?.byType?.length > 0 && <>
          <div className="admin-sec-title">Répartition par type</div>
          <div className="type-bk">
            {stats.byType.map(({_id, count}) => TM[_id] && (
              <div key={_id} className="tbk-item" style={{"--c":TM[_id].color}}>
                <span style={{fontSize:22}}>{TM[_id].icon}</span>
                <span style={{fontWeight:800,fontSize:20}}>{count}</span>
                <span style={{fontSize:11,color:"#999"}}>{TM[_id].label}</span>
              </div>
            ))}
          </div>
        </>}

        <div className="admin-sec-title">Annonces ({list.length})</div>
        <div style={{padding:"0 16px 60px",display:"flex",flexDirection:"column",gap:10}}>
          {list.map(p => (
            <div key={p._id} className={`admin-row${p.status==="inactive"?" dimmed":""}`}>
              <div style={{fontSize:22,minWidth:28}}>{TM[p.type]?.icon||"🏠"}</div>
              <div style={{flex:1}}>
                <div className="arow-title">{p.title}</div>
                <div className="arow-meta">📍 {p.location} · 👁 {p.views} · {fmt(p.price,p.listingType)}</div>
                <div className={`arow-status ${p.status}`}>{p.status==="active"?"● Actif":"○ Inactif"}</div>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button className={`aaction ${p.status==="active"?"pause":"play"}`} onClick={()=>toggle(p._id)}>{p.status==="active"?"⏸":"▶"}</button>
                <button className="aaction del" onClick={()=>del(p._id)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      </>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PROP CARD
═══════════════════════════════════════════════════════════ */
function PropCard({ prop: p, idx, onClick }) {
  const m = TM[p.type] || TM.maison;
  return (
    <div className="pcard" style={{animationDelay:`${idx*50}ms`}} onClick={onClick}>
      <div className="pcard-img" style={{background: p.images?.[0] ? "none" : m.bg}}>
        {p.images?.[0]
          ? <img src={p.images[0]} alt={p.title} style={{width:"100%",height:"100%",objectFit:"cover"}} />
          : <span style={{fontSize:52}}>{m.icon}</span>
        }
        <div className="pcard-badges">
          <span className="badge sm" style={{background:p.listingType==="vente"?"#D97706":"#15803D"}}>{p.listingType==="vente"?"VENTE":"LOCATION"}</span>
          <span className="badge sm dark-badge">👁 {p.views}</span>
        </div>
      </div>
      <div className="pcard-body">
        <div className="pcard-title">{p.title}</div>
        <div className="pcard-loc">📍 {p.location}</div>
        <div className="pcard-price">{fmt(p.price, p.listingType)}</div>
        <div className="pcard-cta">Voir le détail →</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SHEET
═══════════════════════════════════════════════════════════ */
function Sheet({ children, onClose }) {
  return (
    <div className="overlay" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="sheet"><div className="sheet-handle"/>{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   AUTH SHEET — fix clavier : useRef + pas de re-render
═══════════════════════════════════════════════════════════ */
function AuthSheet({ mode, setMode, setUser, onClose, toast$ }) {
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";

  const nameRef     = useRef(null);
  const emailRef    = useRef(null);
  const passwordRef = useRef(null);
  const waRef       = useRef(null);

  const handle = async () => {
    const email    = emailRef.current?.value    || "";
    const password = passwordRef.current?.value || "";
    const name     = nameRef.current?.value     || "";
    const whatsapp = waRef.current?.value       || "";

    if (!email || !password) { toast$("⚠️ Email et mot de passe requis"); return; }
    if (!isLogin && (!name || !whatsapp)) { toast$("⚠️ Tous les champs sont requis"); return; }

    setBusy(true);
    try {
      const d = isLogin
        ? await AUTH.login({ email, password })
        : await AUTH.register({ name, email, password, whatsapp });
      setUser(d.user);
      onClose();
      toast$(`✅ Bienvenue ${d.user.name.split(" ")[0]} !`);
    } catch (e) {
      toast$("❌ " + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="sheet-title">{isLogin ? "Se connecter" : "Créer un compte"}</div>
      {!isLogin && (
        <div className="fg">
          <label className="fl">Nom complet <span style={{color:"#E86A2E"}}>*</span></label>
          <input className="fi" type="text" placeholder="Kouame Jean" ref={nameRef} />
        </div>
      )}
      <div className="fg">
        <label className="fl">Email <span style={{color:"#E86A2E"}}>*</span></label>
        <input className="fi" type="email" placeholder="email@exemple.com" ref={emailRef} />
      </div>
      <div className="fg">
        <label className="fl">Mot de passe <span style={{color:"#E86A2E"}}>*</span></label>
        <input className="fi" type="password" placeholder="••••••••" ref={passwordRef} onKeyDown={e => e.key==="Enter"&&handle()} />
      </div>
      {!isLogin && (
        <div className="fg">
          <label className="fl">WhatsApp <span style={{color:"#E86A2E"}}>*</span></label>
          <input className="fi" type="text" placeholder="2250700000000" ref={waRef} />
        </div>
      )}
      <button className="btn-submit" onClick={handle} disabled={busy}>
        {busy ? "⏳ Chargement..." : isLogin ? "Se connecter" : "Créer mon compte"}
      </button>
      <div className="sheet-switch">
        {isLogin ? "Pas de compte ? " : "Déjà un compte ? "}
        <button className="link-btn" onClick={() => setMode(isLogin ? "register" : "login")}>
          {isLogin ? "S'inscrire" : "Se connecter"}
        </button>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   PUBLISH SHEET — fix clavier : useRef
═══════════════════════════════════════════════════════════ */
function PublishSheet({ user, onClose, onDone, toast$ }) {
  const [type,        setType]        = useState("");
  const [listingType, setListingType] = useState("vente");
  const [files,       setFiles]       = useState([]);
  const [preview,     setPreview]     = useState([]);
  const [busy,        setBusy]        = useState(false);

  const titleRef    = useRef(null);
  const priceRef    = useRef(null);
  const locationRef = useRef(null);
  const descRef     = useRef(null);
  const phoneRef    = useRef(null);

  const onFiles = (e) => {
    const sel = Array.from(e.target.files).slice(0, 6);
    setFiles(sel);
    setPreview(sel.map(f => URL.createObjectURL(f)));
  };

  const handle = async () => {
    const title       = titleRef.current?.value    || "";
    const price       = priceRef.current?.value    || "";
    const location    = locationRef.current?.value || "";
    const description = descRef.current?.value     || "";
    const contactPhone= phoneRef.current?.value    || user?.whatsapp || "";

    if (!title || !type || !price || !location) {
      toast$("⚠️ Remplis les champs obligatoires");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("title",        title);
      fd.append("type",         type);
      fd.append("listingType",  listingType);
      fd.append("price",        price);
      fd.append("location",     location);
      fd.append("description",  description);
      fd.append("contactPhone", contactPhone);
      files.forEach(f => fd.append("images", f));
      await PROPS.create(fd);
      onDone();
      onClose();
    } catch (e) {
      toast$("❌ " + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="sheet-title">📢 Publier une annonce</div>

      <div className="fg">
        <label className="fl">Titre <span style={{color:"#E86A2E"}}>*</span></label>
        <input className="fi" type="text" placeholder="Villa moderne à Cocody..." ref={titleRef} />
      </div>

      <div style={{display:"flex",gap:10}}>
        <div className="fg" style={{flex:1}}>
          <label className="fl">Type <span style={{color:"#E86A2E"}}>*</span></label>
          <select className="fs" value={type} onChange={e => setType(e.target.value)}>
            <option value="">Choisir...</option>
            <option value="maison">🏠 Maison</option>
            <option value="appartement">🏢 Appartement</option>
            <option value="terrain">🌿 Terrain</option>
          </select>
        </div>
        <div className="fg" style={{flex:1}}>
          <label className="fl">Transaction</label>
          <select className="fs" value={listingType} onChange={e => setListingType(e.target.value)}>
            <option value="vente">Vente</option>
            <option value="location">Location</option>
          </select>
        </div>
      </div>

      <div className="fg">
        <label className="fl">Prix (FCFA) <span style={{color:"#E86A2E"}}>*</span></label>
        <input className="fi" type="number" placeholder="ex: 45000000" ref={priceRef} />
      </div>

      <div className="fg">
        <label className="fl">Localisation <span style={{color:"#E86A2E"}}>*</span></label>
        <input className="fi" type="text" placeholder="Cocody, Abidjan" ref={locationRef} />
      </div>

      <div className="fg">
        <label className="fl">Description</label>
        <textarea className="fta" placeholder="Superficie, état, équipements..." ref={descRef} />
      </div>

      <div className="fg">
        <label className="fl">WhatsApp contact</label>
        <input className="fi" type="text" placeholder="2250700000000" ref={phoneRef} defaultValue={user?.whatsapp || ""} />
      </div>

      <div className="fg">
        <label className="fl">Photos (max 6)</label>
        <label className="upload-zone">
          <input type="file" accept="image/*" multiple style={{display:"none"}} onChange={onFiles} />
          <span style={{fontSize:24}}>📷</span>
          <span style={{fontSize:13,color:"#999",marginTop:4}}>
            {files.length > 0 ? `${files.length} photo(s) sélectionnée(s)` : "Appuie pour ajouter des photos"}
          </span>
        </label>
        {preview.length > 0 && (
          <div className="preview-strip">
            {preview.map((url,i) => <img key={i} src={url} alt="" className="preview-thumb" />)}
          </div>
        )}
      </div>

      <button className="btn-submit" onClick={handle} disabled={busy}>
        {busy ? "⏳ Publication en cours..." : "📢 Publier maintenant"}
      </button>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   CSS
═══════════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:#E0D8CC;}
button{cursor:pointer;font-family:inherit;}
input,select,textarea{font-family:inherit;}
a{color:inherit;}
::-webkit-scrollbar{display:none;}
.app{font-family:'DM Sans',sans-serif;background:#F4EFE6;min-height:100vh;max-width:480px;margin:0 auto;position:relative;overflow-x:hidden;color:#1C1008;}
.screen{min-height:100vh;padding-bottom:100px;animation:fadeUp .3s ease both;}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.nav{position:sticky;top:0;z-index:90;background:#1C1008;padding:13px 18px;display:flex;align-items:center;justify-content:space-between;gap:8px;}
.logo{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:#F59E0B;letter-spacing:-.5px;}
.logo-sub{font-size:10px;color:#777;letter-spacing:2px;text-transform:uppercase;}
.nav-title{font-size:15px;font-weight:700;color:#F4EFE6;flex:1;text-align:center;}
.nav-title.light{color:#F4EFE6;}
.result-badge{background:#E86A2E;color:#fff;border-radius:20px;padding:3px 10px;font-size:12px;font-weight:800;min-width:28px;text-align:center;}
.back-btn{background:none;border:none;color:#C9A97A;font-size:13px;font-weight:700;padding:4px 0;white-space:nowrap;}
.back-btn.light{color:#C9A97A;}
.user-pill{background:rgba(245,158,11,.15);color:#F59E0B;border-radius:20px;padding:5px 12px;font-size:13px;font-weight:700;}
.btn-ghost{background:none;border:none;color:#666;font-size:16px;padding:4px 8px;}
.btn-outline{background:transparent;border:1.5px solid #F59E0B;color:#F59E0B;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;}
.btn-primary{background:#E86A2E;color:#fff;border:none;border-radius:9px;padding:9px 16px;font-size:13px;font-weight:700;}
.btn-primary.sm{padding:8px 14px;font-size:12px;}
.hero{background:linear-gradient(160deg,#1C1008 0%,#2D1A07 55%,#7C3A0A 100%);padding:28px 20px 32px;position:relative;overflow:hidden;}
.hero::after{content:'';position:absolute;bottom:-40px;right:-40px;width:160px;height:160px;background:radial-gradient(circle,rgba(245,158,11,.12) 0%,transparent 70%);pointer-events:none;}
.hero-eyebrow{font-size:11px;color:#F59E0B;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:10px;}
.hero-title{font-family:'Syne',sans-serif;font-size:38px;font-weight:800;color:#F4EFE6;line-height:1.1;margin-bottom:8px;}
.dot{color:#E86A2E;}
.hero-sub{font-size:14px;color:#B8956A;margin-bottom:24px;}
.cat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;}
.cat-card{background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.12);border-radius:14px;padding:14px 8px 12px;display:flex;flex-direction:column;align-items:center;gap:4px;position:relative;transition:background .18s,transform .15s;}
.cat-card:active{transform:scale(.95);}
.cat-icon{font-size:28px;}
.cat-label{font-size:12px;font-weight:700;color:#F4EFE6;}
.cat-arrow{position:absolute;top:8px;right:10px;font-size:12px;color:rgba(255,255,255,.3);}
.btn-see-all{width:100%;background:rgba(232,106,46,.15);border:1.5px solid #E86A2E;color:#E86A2E;border-radius:12px;padding:13px;font-size:14px;font-weight:700;}
.strip{background:#1C1008;display:flex;padding:12px 8px;border-bottom:1px solid rgba(255,255,255,.05);}
.strip-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:18px;}
.strip-lbl{font-size:10px;color:#777;font-weight:600;text-align:center;}
.section{padding:24px 20px 8px;}
.section-title{font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:#1C1008;margin-bottom:16px;}
.steps{display:flex;flex-direction:column;gap:12px;}
.step{display:flex;align-items:flex-start;gap:14px;background:#fff;border-radius:14px;padding:14px;border:1.5px solid #EDE5D5;}
.step-num{min-width:36px;height:36px;background:#E86A2E;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-size:16px;font-weight:800;flex-shrink:0;}
.step-title{font-size:14px;font-weight:700;color:#1C1008;margin-bottom:2px;}
.step-sub{font-size:12px;color:#999;}
.pub-banner{margin:20px;background:linear-gradient(135deg,#1C1008 0%,#3D1F06 100%);border-radius:20px;padding:24px 20px;text-align:center;}
.pub-title{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:#F4EFE6;margin-bottom:6px;}
.pub-sub{font-size:13px;color:#B8956A;margin-bottom:18px;}
.btn-pub-big{width:100%;background:#E86A2E;color:#fff;border:none;border-radius:12px;padding:15px;font-size:15px;font-weight:800;box-shadow:0 4px 20px rgba(232,106,46,.4);}
.filter-bar{background:#1C1008;padding:14px 16px 16px;}
.type-pills{display:flex;gap:6px;margin-bottom:12px;overflow-x:auto;padding-bottom:2px;}
.type-pill{white-space:nowrap;background:rgba(255,255,255,.08);border:1.5px solid rgba(255,255,255,.12);color:#C9A97A;border-radius:20px;padding:7px 12px;font-size:12px;font-weight:700;flex-shrink:0;transition:all .15s;}
.type-pill.active{background:#E86A2E;border-color:#E86A2E;color:#fff;}
.frow{display:flex;gap:8px;margin-bottom:8px;}
.frow:last-child{margin-bottom:0;}
.finput{flex:1;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 12px;font-size:13px;color:#F4EFE6;outline:none;}
.finput::placeholder{color:#777;}
.fselect{flex:1;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 12px;font-size:13px;color:#F4EFE6;outline:none;}
.fselect option{background:#1C1008;}
.search-btn{background:#E86A2E;border:none;border-radius:10px;padding:10px 14px;font-size:13px;font-weight:800;color:#fff;white-space:nowrap;}
.clear-btn{background:rgba(232,106,46,.2);border:1.5px solid #E86A2E;color:#E86A2E;border-radius:10px;padding:10px 10px;font-size:13px;font-weight:700;}
.card-list{padding:16px 16px 20px;display:flex;flex-direction:column;gap:14px;}
.pcard{background:#fff;border-radius:18px;overflow:hidden;border:1.5px solid #EDE5D5;box-shadow:0 2px 14px rgba(28,16,8,.06);cursor:pointer;animation:fadeUp .4s ease both;transition:transform .15s;}
.pcard:active{transform:scale(.985);}
.pcard-img{height:160px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;}
.pcard-badges{position:absolute;top:10px;left:10px;right:10px;display:flex;justify-content:space-between;}
.pcard-body{padding:14px 16px 16px;}
.pcard-title{font-size:15px;font-weight:700;color:#1C1008;margin-bottom:4px;line-height:1.35;}
.pcard-loc{font-size:12px;color:#999;margin-bottom:8px;}
.pcard-price{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:#E86A2E;margin-bottom:6px;}
.pcard-cta{font-size:12px;color:#B8956A;font-weight:600;}
.badge{color:#fff;border-radius:7px;padding:4px 10px;font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;}
.badge.sm{padding:3px 8px;font-size:10px;}
.dark-badge{background:rgba(28,16,8,.65);}
.loading-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;}
.spinner{width:36px;height:36px;border:3px solid #EDE5D5;border-top-color:#E86A2E;border-radius:50%;animation:spin .7s linear infinite;}
@keyframes spin{to{transform:rotate(360deg)}}
.empty{text-align:center;padding:60px 20px;}
.empty-t{font-size:17px;font-weight:700;color:#1C1008;margin-top:12px;}
.empty-s{font-size:13px;color:#999;margin-top:4px;}
.d-img{height:220px;display:flex;align-items:center;justify-content:center;position:relative;}
.d-img-real{height:220px;position:relative;overflow:hidden;}
.d-big-icon{font-size:80px;filter:drop-shadow(0 8px 24px rgba(0,0,0,.15));}
.d-img-badges{position:absolute;bottom:14px;left:14px;right:14px;display:flex;justify-content:space-between;}
.img-strip{display:flex;gap:8px;padding:10px 16px;overflow-x:auto;background:#fff;}
.img-thumb{width:72px;height:56px;border-radius:8px;object-fit:cover;flex-shrink:0;border:2px solid #EDE5D5;}
.d-body{padding:20px 20px 40px;}
.d-type{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;}
.d-title{font-family:'Syne',sans-serif;font-size:24px;font-weight:800;color:#1C1008;margin-bottom:8px;line-height:1.2;}
.d-price{font-family:'Syne',sans-serif;font-size:30px;font-weight:800;color:#E86A2E;margin-bottom:4px;}
.d-loc{font-size:14px;color:#888;margin-bottom:4px;}
.divider{height:1px;background:#EDE5D5;margin:18px 0;}
.d-section-label{font-size:11px;font-weight:800;color:#B8956A;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;}
.d-desc{font-size:14px;color:#555;line-height:1.65;}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.info-cell{background:#F9F5EE;border-radius:12px;padding:12px 14px;}
.info-k{font-size:10px;color:#B8956A;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;}
.info-v{font-size:14px;font-weight:700;color:#1C1008;}
.wa-label{font-size:13px;color:#999;text-align:center;margin-bottom:10px;}
.wa-btn{width:100%;background:#25D366;color:#fff;border:none;border-radius:14px;padding:17px;font-size:17px;font-weight:900;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 6px 24px rgba(37,211,102,.35);}
.wa-btn:active{transform:scale(.97);}
.wa-hint{font-size:11px;color:#B8956A;text-align:center;margin-top:8px;}
.fab{position:fixed;bottom:22px;right:18px;background:#E86A2E;color:#fff;border:none;border-radius:50px;padding:0 20px;height:58px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;box-shadow:0 6px 28px rgba(232,106,46,.5);z-index:150;}
.fab:active{transform:scale(.93);}
.overlay{position:fixed;inset:0;background:rgba(28,16,8,.72);z-index:200;display:flex;align-items:flex-end;animation:fadeIn .2s ease;}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.sheet{background:#F4EFE6;border-radius:22px 22px 0 0;width:100%;max-height:88vh;overflow-y:auto;padding:8px 20px 44px;max-width:480px;margin:0 auto;animation:slideUp .28s cubic-bezier(.34,1.56,.64,1);}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.sheet-handle{width:40px;height:4px;background:#D8CEBD;border-radius:2px;margin:12px auto 20px;}
.sheet-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:#1C1008;margin-bottom:20px;}
.sheet-switch{text-align:center;margin-top:16px;font-size:14px;color:#999;}
.link-btn{background:none;border:none;color:#E86A2E;font-size:14px;font-weight:700;text-decoration:underline;font-family:inherit;}
.fg{margin-bottom:14px;}
.fl{display:block;font-size:11px;font-weight:800;color:#B8956A;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;}
.fi{width:100%;background:#fff;border:2px solid #EDE5D5;border-radius:10px;padding:12px 14px;font-size:15px;color:#1C1008;outline:none;transition:border-color .15s;}
.fi:focus{border-color:#E86A2E;}
.fs{width:100%;background:#fff;border:2px solid #EDE5D5;border-radius:10px;padding:12px 14px;font-size:15px;color:#1C1008;outline:none;}
.fta{width:100%;background:#fff;border:2px solid #EDE5D5;border-radius:10px;padding:12px 14px;font-size:15px;color:#1C1008;outline:none;resize:vertical;min-height:80px;}
.btn-submit{width:100%;background:#E86A2E;color:#fff;border:none;border-radius:12px;padding:15px;font-size:16px;font-weight:800;margin-top:6px;box-shadow:0 4px 18px rgba(232,106,46,.35);}
.btn-submit:disabled{opacity:.6;}
.btn-submit:active{transform:scale(.97);}
.upload-zone{display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;border:2px dashed #D8CEBD;border-radius:12px;padding:20px;cursor:pointer;gap:4px;}
.upload-zone:hover{border-color:#E86A2E;}
.preview-strip{display:flex;gap:8px;margin-top:10px;overflow-x:auto;padding-bottom:4px;}
.preview-thumb{width:72px;height:56px;border-radius:8px;object-fit:cover;flex-shrink:0;border:2px solid #EDE5D5;}
.admin-title{font-family:'Syne',sans-serif;font-size:24px;font-weight:800;color:#1C1008;margin-bottom:3px;}
.admin-sub{font-size:13px;color:#B8956A;}
.stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px 20px;}
.stat-card{background:#fff;border-radius:14px;padding:16px;border-left:4px solid var(--c);}
.stat-n{font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:#1C1008;}
.stat-l{font-size:11px;color:#999;font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-top:2px;}
.admin-sec-title{font-size:12px;font-weight:800;color:#B8956A;text-transform:uppercase;letter-spacing:1px;padding:12px 20px 8px;}
.type-bk{display:flex;gap:10px;padding:0 20px 16px;}
.tbk-item{flex:1;background:#fff;border-radius:12px;padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:3px;border-left:3px solid var(--c);}
.admin-row{background:#fff;border-radius:14px;padding:14px;display:flex;align-items:flex-start;gap:10px;border:1.5px solid #EDE5D5;transition:opacity .2s;}
.admin-row.dimmed{opacity:.55;}
.arow-title{font-size:14px;font-weight:700;color:#1C1008;margin-bottom:3px;}
.arow-meta{font-size:11px;color:#999;margin-bottom:4px;}
.arow-status{font-size:12px;font-weight:700;}
.arow-status.active{color:#15803D;}
.arow-status.inactive{color:#999;}
.aaction{border:none;border-radius:8px;padding:8px 10px;font-size:14px;}
.aaction:active{transform:scale(.88);}
.aaction.pause{background:#FEF3C7;}
.aaction.play{background:#DCFCE7;}
.aaction.del{background:#FEE2E2;color:#DC2626;}
.toast{position:fixed;bottom:92px;left:50%;transform:translateX(-50%);background:#1C1008;color:#F59E0B;padding:12px 24px;border-radius:50px;font-size:14px;font-weight:700;z-index:999;white-space:nowrap;box-shadow:0 4px 24px rgba(0,0,0,.3);animation:toastPop .25s cubic-bezier(.34,1.56,.64,1);}
@keyframes toastPop{from{opacity:0;transform:translateX(-50%) scale(.85)}to{opacity:1;transform:translateX(-50%) scale(1)}}
`;
