import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Edit3,
  ExternalLink,
  Filter,
  Github,
  ImagePlus,
  Link as LinkIcon,
  Lock,
  LogOut,
  Mail,
  MapPin,
  RefreshCw,
  Save,
  Search,
  Upload,
  User
} from "lucide-react";
import { fallbackProfile, fallbackProjects } from "./data/fallback";
import {
  isSupabaseConfigured,
  STORAGE_BUCKET,
  supabase
} from "./lib/supabaseClient";

function getHashRoute() {
  const value = window.location.hash.replace("#", "");
  return value || "/";
}

function go(path) {
  window.location.hash = path;
}

function normalizeTags(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(String).filter(Boolean);
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function readableError(error) {
  if (!error) return "";
  return error.message || String(error);
}

function formatDefaultArtworkTitle() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();

  return `${hours}:${minutes} ${day}/${month}/${year}`;
}

async function uploadImage(file, folder = "projects") {
  if (!file) return null;
  const ext = file.name.split(".").pop() || "jpg";
  const cleanName = file.name
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);

  const filePath = `${folder}/${Date.now()}-${cleanName}.${ext}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (error) throw error;

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

function useSession() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setChecking(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  return { session, checking };
}

export default function App() {
  const [route, setRoute] = useState(getHashRoute());
  const [profile, setProfile] = useState(fallbackProfile);
  const [projects, setProjects] = useState(fallbackProjects);
  const [activeTag, setActiveTag] = useState("All");
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  async function loadData() {
    setLoading(true);
    try {
      if (!isSupabaseConfigured) {
        setProfile(fallbackProfile);
        setProjects(fallbackProjects);
        return;
      }

      const [profileResult, projectsResult] = await Promise.all([
        supabase.from("profile").select("*").eq("id", 1).maybeSingle(),
        supabase
          .from("projects")
          .select("*")
          .order("created_at", { ascending: false })
      ]);

      if (profileResult.error) throw profileResult.error;
      if (projectsResult.error) throw projectsResult.error;

      setProfile(profileResult.data || fallbackProfile);
      setProjects(projectsResult.data?.length ? projectsResult.data : []);
    } catch (error) {
      console.error(error);
      alert("Không tải được dữ liệu Supabase: " + readableError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    if (!isSupabaseConfigured) {
      go("/edit");
      return;
    }

    await supabase.auth.signOut();
    setSession(null);
    await loadData();
    go("/");
  }

  useEffect(() => {
    loadData();

    const onHashChange = () => setRoute(getHashRoute());
    window.addEventListener("hashchange", onHashChange);

    let authSubscription = null;

    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data }) => {
        setSession(data.session);
      });

      const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
      });

      authSubscription = data.subscription;
    }

    return () => {
      window.removeEventListener("hashchange", onHashChange);
      authSubscription?.unsubscribe();
    };
  }, []);

  const tags = useMemo(() => {
    const list = projects.flatMap((project) => normalizeTags(project.tags));
    return ["All", ...Array.from(new Set(list))];
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (activeTag === "All") return projects;
    return projects.filter((project) =>
      normalizeTags(project.tags).includes(activeTag)
    );
  }, [activeTag, projects]);

  const projectDetailId = route.startsWith("/art/") ? route.replace("/art/", "") : null;
  const selectedProject = projectDetailId
    ? projects.find((project) => String(project.id) === projectDetailId)
    : null;

  return (
    <div className="app">
      <Header route={route} profile={profile} session={session} onSignOut={handleSignOut} />

      {loading ? (
        <main className="page narrow">
          <div className="loading">
            <RefreshCw size={18} className="spin" />
            Đang tải dữ liệu...
          </div>
        </main>
      ) : projectDetailId ? (
        <ArtworkDetailPage project={selectedProject} profile={profile} />
      ) : route === "/about" ? (
        <AboutPage profile={profile} />
      ) : route === "/user" ? (
        <UserPage profile={profile} projects={projects} />
      ) : route === "/edit" || route === "/admin" ? (
        <EditPage profile={profile} projects={projects} onChanged={loadData} />
      ) : route === "/upload" ? (
        <UploadPage onChanged={loadData} />
      ) : (
        <GalleryPage
          profile={profile}
          projects={filteredProjects}
          tags={tags}
          activeTag={activeTag}
          onTagChange={setActiveTag}
        />
      )}

      <Footer />
    </div>
  );
}

function Header({ route, profile, session, onSignOut }) {
  return (
    <header className="site-header">
      <button className={session ? "brand" : "brand brand-guest"} onClick={() => go("/")}>
        {session ? <img src={profile.avatar_url} alt="Avatar" /> : null}
        <span>
          <strong>ArtPinner</strong>
          <small>{session ? profile.name : "Được tạo bởi Đăng Hà"}</small>
        </span>
      </button>

      <nav>
        <button
          className={route === "/" || route === "/user" ? "active" : ""}
          onClick={() => go("/")}
        >
          Gallery
        </button>
        <button
          className={route === "/about" ? "active" : ""}
          onClick={() => go("/about")}
        >
          About
        </button>
        <button
          className={route === "/upload" ? "active" : ""}
          onClick={() => go("/upload")}
        >
          Đăng ảnh
        </button>
        <button
          className={route === "/edit" || route === "/admin" ? "active" : ""}
          onClick={() => go("/edit")}
        >
          Chỉnh sửa
        </button>
        {session ? (
          <button className="logout-button" onClick={onSignOut} title="Đăng xuất">
            <LogOut size={16} /> Đăng xuất
          </button>
        ) : (
          <button className="logout-button" onClick={() => go("/edit")} title="Đăng nhập">
            <Lock size={16} /> Đăng nhập
          </button>
        )}
      </nav>
    </header>
  );
}


function GalleryPage({ profile, projects, tags, activeTag, onTagChange }) {
  const [searchTerm, setSearchTerm] = useState("");

  const visibleProjects = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return projects;

    const profileName = (profile.name || "").toLowerCase();
    const profileHeadline = (profile.headline || "").toLowerCase();

    return projects.filter((project) => {
      const title = (project.title || "").toLowerCase();
      const description = (project.description || "").toLowerCase();
      const tagText = normalizeTags(project.tags).join(" ").toLowerCase();

      return (
        title.includes(keyword) ||
        description.includes(keyword) ||
        tagText.includes(keyword) ||
        profileName.includes(keyword) ||
        profileHeadline.includes(keyword)
      );
    });
  }, [projects, profile.name, profile.headline, searchTerm]);

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">ArtPinner</p>
          <h1>{profile.name}</h1>
          <p>{profile.headline}</p>
          <div className="hero-actions">
            <button onClick={() => go("/upload")}>
              <ImagePlus size={16} /> Đăng ảnh mới
            </button>
            <button className="secondary" onClick={() => go("/about")}>
              <User size={16} /> Thông tin cá nhân
            </button>
            <button className="secondary" onClick={() => go("/edit")}>
              <Edit3 size={16} /> Chỉnh sửa
            </button>
          </div>
        </div>
        <button className="hero-card hero-card-button" onClick={() => go("/user")}>
          <img src={profile.avatar_url} alt={profile.name} />
          <strong>{profile.name}</strong>
          <span>{projects.length} artworks</span>
        </button>
      </section>

      <section className="gallery-tools">
        <div className="search-box">
          <Search size={18} />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Tìm theo tiêu đề, tag hoặc tên người..."
            aria-label="Tìm ảnh"
          />
          {searchTerm ? (
            <button type="button" onClick={() => setSearchTerm("")}>
              Xóa
            </button>
          ) : null}
        </div>

        <section className="toolbar">
          <div>
            <Filter size={18} />
            <strong>Filter theo tag</strong>
          </div>
          <div className="tags">
            {tags.map((tag) => (
              <button
                key={tag}
                className={activeTag === tag ? "active-tag" : ""}
                onClick={() => onTagChange(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </section>
      </section>

      <div className="result-line">
        Hiển thị <strong>{visibleProjects.length}</strong> / {projects.length} ảnh
        {searchTerm ? (
          <>
            {" "}cho từ khóa <strong>“{searchTerm}”</strong>
          </>
        ) : null}
      </div>

      <section className="grid">
        {visibleProjects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
        {!visibleProjects.length && (
          <div className="empty">
            Không tìm thấy ảnh phù hợp. Thử tìm bằng tiêu đề, tag hoặc tên người khác.
          </div>
        )}
      </section>
    </main>
  );
}

function ProjectCard({ project }) {
  const tags = normalizeTags(project.tags);

  return (
    <article className="card">
      <button className="thumb thumb-button" onClick={() => go(`/art/${project.id}`)}>
        <img src={project.image_url} alt={project.title} loading="lazy" />
      </button>
      <div className="card-body">
        <div className="card-title">
          <button className="title-button" onClick={() => go(`/art/${project.id}`)}>
            <h3>{project.title}</h3>
          </button>
          {project.external_url ? (
            <a href={project.external_url} target="_blank" rel="noreferrer">
              <LinkIcon size={16} />
            </a>
          ) : null}
        </div>
        <p>{project.description}</p>
        <div className="mini-tags">
          {tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>
    </article>
  );
}

function ArtworkDetailPage({ project, profile }) {
  if (!project) {
    return (
      <main className="page narrow">
        <section className="panel center-panel">
          <h1>Không tìm thấy ảnh</h1>
          <p>Artwork này có thể đã bị xóa hoặc link không còn đúng.</p>
          <button onClick={() => go("/")}>
            <ArrowLeft size={16} /> Quay lại Gallery
          </button>
        </section>
      </main>
    );
  }

  const tags = normalizeTags(project.tags);

  return (
    <main className="page artwork-page">
      <button className="back-button" onClick={() => go("/")}>
        <ArrowLeft size={16} /> Quay lại Gallery
      </button>

      <section className="artwork-detail">
        <div className="artwork-image-wrap">
          <img src={project.image_url} alt={project.title} />
        </div>

        <aside className="artwork-info">
          <p className="eyebrow">Artwork</p>
          <h1>{project.title}</h1>

          <button className="uploader-card" onClick={() => go("/user")}>
            <img src={profile.avatar_url} alt={profile.name} />
            <span>
              <small>Người đăng</small>
              <strong>{profile.name}</strong>
            </span>
          </button>

          <p className="bio">{project.description || "Chưa có mô tả cho ảnh này."}</p>

          <div className="mini-tags">
            {tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>

          <div className="detail-actions">
            <a href={project.image_url} target="_blank" rel="noreferrer">
              <ExternalLink size={16} /> Mở ảnh gốc
            </a>
            {project.external_url ? (
              <a href={project.external_url} target="_blank" rel="noreferrer">
                <LinkIcon size={16} /> Link ngoài
              </a>
            ) : null}
          </div>
        </aside>
      </section>
    </main>
  );
}

function AboutPage({ profile }) {
  const socials = profile.socials || {};
  const socialItems = Object.entries(socials).filter(([, value]) => value);

  return (
    <main className="page narrow">
      <section className="about">
        <img className="about-avatar" src={profile.avatar_url} alt={profile.name} />
        <div>
          <p className="eyebrow">About</p>
          <h1>{profile.name}</h1>
          <h2>{profile.headline}</h2>
          <p className="bio">{profile.bio}</p>

          <div className="info-list">
            {profile.location ? (
              <span>
                <MapPin size={16} /> {profile.location}
              </span>
            ) : null}
            {profile.email ? (
              <a href={`mailto:${profile.email}`}>
                <Mail size={16} /> {profile.email}
              </a>
            ) : null}
            {socialItems.map(([key, value]) => (
              <a key={key} href={value} target="_blank" rel="noreferrer">
                <LinkIcon size={16} /> {key}
              </a>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}


function UserPage({ profile, projects }) {
  const socials = profile.socials || {};
  const socialItems = Object.entries(socials).filter(([, value]) => value);

  return (
    <main className="page user-profile-page">
      <section className="user-summary">
        <div className="user-cover">
          <img src={profile.avatar_url} alt={profile.name} />
        </div>

        <div className="user-content">
          <p className="eyebrow">Người dùng</p>
          <h1>{profile.name}</h1>
          <h2>{profile.headline}</h2>
          <p className="bio">{profile.bio}</p>

          <div className="profile-stats">
            <span>
              <strong>{projects.length}</strong>
              Artwork
            </span>
            {profile.location ? (
              <span>
                <strong>{profile.location}</strong>
                Khu vực
              </span>
            ) : null}
          </div>

          <div className="info-list">
            {profile.email ? (
              <a href={`mailto:${profile.email}`}>
                <Mail size={16} /> {profile.email}
              </a>
            ) : null}
            {socialItems.map(([key, value]) => (
              <a key={key} href={value} target="_blank" rel="noreferrer">
                <LinkIcon size={16} /> {key}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="profile-artworks-head">
        <div>
          <p className="eyebrow">Artwork</p>
          <h2>Ảnh đã đăng bởi {profile.name}</h2>
        </div>
        <button onClick={() => go("/upload")}>
          <ImagePlus size={16} /> Đăng ảnh mới
        </button>
      </section>

      <section className="grid">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
        {!projects.length && (
          <div className="empty">
            Người dùng này chưa đăng artwork nào.
          </div>
        )}
      </section>
    </main>
  );
}

function AuthGate({ title = "Đăng nhập", children }) {
  const { session, checking } = useSession();

  if (!isSupabaseConfigured) {
    return (
      <main className="page narrow">
        <div className="panel">
          <h1>Chưa cấu hình Supabase</h1>
          <p>
            Tạo file <code>.env.local</code> theo mẫu <code>.env.example</code>,
            rồi điền <code>VITE_SUPABASE_URL</code> và{" "}
            <code>VITE_SUPABASE_ANON_KEY</code>.
          </p>
        </div>
      </main>
    );
  }

  if (checking) {
    return (
      <main className="page narrow">
        <div className="loading">Đang kiểm tra đăng nhập...</div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="page narrow">
        <LoginForm title={title} />
      </main>
    );
  }

  return children;
}

function EditPage({ profile, projects, onChanged }) {
  return (
    <AuthGate title="Đăng nhập để chỉnh sửa">
      <main className="page narrow">
        <div className="admin-head">
          <div>
            <p className="eyebrow">Chỉnh sửa</p>
            <h1>Chỉnh sửa thông tin</h1>
          </div>
          <button
            className="secondary"
            onClick={async () => {
              await supabase.auth.signOut();
              await onChanged();
              go("/");
            }}
          >
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>

        <ProfileEditor profile={profile} onChanged={onChanged} />
        <ProjectManager projects={projects} onChanged={onChanged} />
      </main>
    </AuthGate>
  );
}

function UploadPage({ onChanged }) {
  return (
    <AuthGate title="Đăng nhập để đăng ảnh">
      <main className="page narrow">
        <div className="admin-head">
          <div>
            <p className="eyebrow">Đăng ảnh mới</p>
            <h1>Upload artwork</h1>
          </div>
          <button
            className="secondary"
            onClick={async () => {
              await supabase.auth.signOut();
              await onChanged();
              go("/");
            }}
          >
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>

        <ProjectEditor onChanged={onChanged} />
      </main>
    </AuthGate>
  );
}


function LoginForm({ title = "Đăng nhập" }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(event) {
    event.preventDefault();

    if (mode === "register") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        alert("Không đăng ký được: " + readableError(error));
        return;
      }

      alert(
        "Đăng ký thành công. Nếu Supabase yêu cầu xác nhận email, hãy mở email để xác nhận trước khi đăng nhập."
      );
      setMode("login");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("Không đăng nhập được: " + readableError(error));
  }

  return (
    <form className="panel form" onSubmit={submit}>
      <Lock size={28} />
      <h1>{mode === "login" ? title : "Đăng ký tài khoản"}</h1>
      <p>
        {mode === "login"
          ? "Đăng nhập bằng email/password đã tạo"
          : "Tạo tài khoản mới để dùng trang Đăng ảnh và Chỉnh sửa."}
      </p>

      <label>
        Email
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>

      <label>
        Mật khẩu
        <input
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength="6"
          required
        />
      </label>

      <button type="submit">
        <Lock size={16} /> {mode === "login" ? "Đăng nhập" : "Đăng ký"}
      </button>

      <button
        type="button"
        className="text-switch"
        onClick={() => setMode(mode === "login" ? "register" : "login")}
      >
        {mode === "login"
          ? "Chưa có tài khoản? Đăng ký"
          : "Đã có tài khoản? Quay lại đăng nhập"}
      </button>
    </form>
  );
}

function ProfileEditor({ profile, onChanged }) {
  const [form, setForm] = useState({
    name: profile.name || "",
    headline: profile.headline || "",
    location: profile.location || "",
    email: profile.email || "",
    bio: profile.bio || "",
    avatar_url: profile.avatar_url || "",
    artstation: profile.socials?.artstation || "",
    github: profile.socials?.github || "",
    facebook: profile.socials?.facebook || "",
    website: profile.socials?.website || ""
  });
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar_url || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: profile.name || "",
      headline: profile.headline || "",
      location: profile.location || "",
      email: profile.email || "",
      bio: profile.bio || "",
      avatar_url: profile.avatar_url || "",
      artstation: profile.socials?.artstation || "",
      github: profile.socials?.github || "",
      facebook: profile.socials?.facebook || "",
      website: profile.socials?.website || ""
    });
    setAvatarPreview(profile.avatar_url || "");
  }, [profile]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));

    if (field === "avatar_url") {
      setAvatarPreview(value);
    }
  }

  function handleAvatarFile(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn file ảnh.");
      return;
    }

    setAvatar(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      let avatarUrl = form.avatar_url;
      if (avatar) {
        avatarUrl = await uploadImage(avatar, "avatars");
      }

      const payload = {
        id: 1,
        name: form.name,
        headline: form.headline,
        location: form.location,
        email: form.email,
        bio: form.bio,
        avatar_url: avatarUrl,
        socials: {
          artstation: form.artstation,
          github: form.github,
          facebook: form.facebook,
          website: form.website
        },
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from("profile").upsert(payload);
      if (error) throw error;

      setAvatar(null);
      setAvatarPreview(avatarUrl);
      await onChanged();
      alert("Đã lưu thông tin cá nhân.");
    } catch (error) {
      alert("Lỗi lưu profile: " + readableError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel form" onSubmit={save}>
      <h2>
        <User size={20} /> Thông tin cá nhân
      </h2>

      <div className="two">
        <label>
          Tên
          <input
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            required
          />
        </label>
        <label>
          Chức danh / mô tả ngắn
          <input
            value={form.headline}
            onChange={(event) => updateField("headline", event.target.value)}
          />
        </label>
      </div>

      <label>
        Bio
        <textarea
          rows="6"
          value={form.bio}
          onChange={(event) => updateField("bio", event.target.value)}
        />
      </label>

      <div className="two">
        <label>
          Khu vực
          <input
            value={form.location}
            onChange={(event) => updateField("location", event.target.value)}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
          />
        </label>
      </div>

      <div className="two">
        <label>
          ArtStation
          <input
            value={form.artstation}
            onChange={(event) => updateField("artstation", event.target.value)}
          />
        </label>
        <label>
          GitHub
          <input
            value={form.github}
            onChange={(event) => updateField("github", event.target.value)}
          />
        </label>
      </div>

      <div className="two">
        <label>
          Facebook
          <input
            value={form.facebook}
            onChange={(event) => updateField("facebook", event.target.value)}
          />
        </label>
        <label>
          Website
          <input
            value={form.website}
            onChange={(event) => updateField("website", event.target.value)}
          />
        </label>
      </div>

      <label>
        Avatar hiện tại hoặc URL ảnh
        <input
          value={form.avatar_url}
          onChange={(event) => updateField("avatar_url", event.target.value)}
        />
      </label>

      <div className="avatar-upload-field">
        <span>Upload avatar mới</span>

        <label
          className="avatar-drop-zone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            handleAvatarFile(event.dataTransfer.files?.[0]);
          }}
        >
          <input
            type="file"
            accept="image/*"
            onChange={(event) => handleAvatarFile(event.target.files?.[0])}
          />

          {avatarPreview ? (
            <img src={avatarPreview} alt="Avatar preview" />
          ) : (
            <div className="avatar-placeholder">
              <Upload size={32} />
              <strong>Kéo ảnh vào đây</strong>
              <small>hoặc bấm để chọn ảnh</small>
            </div>
          )}

          <div className="avatar-upload-overlay">
            <Upload size={18} />
            <span>Chọn / thay avatar</span>
          </div>
        </label>

        {avatar ? (
          <small className="file-picked">Đã chọn: {avatar.name}</small>
        ) : (
          <small className="file-picked">Chưa chọn file mới. Đang dùng ảnh hiện tại.</small>
        )}
      </div>

      <button type="submit" disabled={saving}>
        <Save size={16} /> {saving ? "Đang lưu..." : "Lưu thông tin"}
      </button>
    </form>
  );
}

function ProjectEditor({ onChanged }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    tags: "",
    external_url: ""
  });
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState("");
  const [saving, setSaving] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleArtworkFile(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn file ảnh.");
      return;
    }

    setFile(file);
    setFilePreview(URL.createObjectURL(file));
  }

  async function save(event) {
    event.preventDefault();
    if (!file) {
      alert("Bạn cần chọn ảnh để upload.");
      return;
    }

    setSaving(true);
    try {
      const imageUrl = await uploadImage(file, "projects");
      const payload = {
        title: form.title.trim() || formatDefaultArtworkTitle(),
        description: form.description,
        image_url: imageUrl,
        tags: normalizeTags(form.tags),
        external_url: form.external_url || null
      };

      const { error } = await supabase.from("projects").insert(payload);
      if (error) throw error;

      setForm({ title: "", description: "", tags: "", external_url: "" });
      setFile(null);
      setFilePreview("");
      event.target.reset();
      await onChanged();
      alert("Đã đăng ảnh.");
      go("/");
    } catch (error) {
      alert("Lỗi đăng ảnh: " + readableError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel form" onSubmit={save}>
      <h2>
        <ImagePlus size={20} /> Đăng ảnh mới
      </h2>

      <label>
        Tiêu đề
        <input
          value={form.title}
          placeholder="Bỏ trống sẽ tự đặt: giờ:phút ngày/tháng/năm"
          onChange={(event) => updateField("title", event.target.value)}
        />
      </label>

      <label>
        Mô tả
        <textarea
          rows="4"
          value={form.description}
          onChange={(event) => updateField("description", event.target.value)}
        />
      </label>

      <div className="two">
        <label>
          Tag, phân cách bằng dấu phẩy
          <input
            placeholder="Fantasy, Character, Game UI"
            value={form.tags}
            onChange={(event) => updateField("tags", event.target.value)}
          />
        </label>
        <label>
          Link ngoài, nếu có
          <input
            value={form.external_url}
            onChange={(event) => updateField("external_url", event.target.value)}
          />
        </label>
      </div>

      <div className="artwork-upload-field">
        <span>Ảnh artwork</span>

        <label
          className="artwork-drop-zone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            handleArtworkFile(event.dataTransfer.files?.[0]);
          }}
        >
          <input
            type="file"
            accept="image/*"
            onChange={(event) => handleArtworkFile(event.target.files?.[0])}
          />

          {filePreview ? (
            <img src={filePreview} alt="Artwork preview" />
          ) : (
            <div className="artwork-placeholder">
              <ImagePlus size={38} />
              <strong>Kéo ảnh vào đây</strong>
              <small>hoặc bấm để chọn ảnh artwork</small>
            </div>
          )}

          <div className="artwork-upload-overlay">
            <Upload size={18} />
            <span>Chọn / thay ảnh</span>
          </div>
        </label>

        {file ? (
          <small className="file-picked">Đã chọn: {file.name}</small>
        ) : (
          <small className="file-picked">Chưa chọn ảnh artwork.</small>
        )}
      </div>

      <button type="submit" disabled={saving}>
        <Upload size={16} /> {saving ? "Đang upload..." : "Đăng ảnh"}
      </button>
    </form>
  );
}

function ProjectManager({ projects, onChanged }) {
  async function removeProject(id) {
    const ok = confirm("Xóa artwork này khỏi database? Ảnh trong Storage chưa bị xóa.");
    if (!ok) return;

    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) {
      alert("Không xóa được: " + readableError(error));
      return;
    }

    await onChanged();
  }

  return (
    <section className="panel">
      <h2>Quản lý ảnh đã đăng</h2>
      <div className="admin-list">
        {projects.map((project) => (
          <div key={project.id} className="admin-row">
            <img src={project.image_url} alt={project.title} />
            <div>
              <strong>{project.title}</strong>
              <small>{normalizeTags(project.tags).join(", ")}</small>
            </div>
            <div className="row-actions">
              <button onClick={() => go(`/art/${project.id}`)}>Xem</button>
              <button className="danger" onClick={() => removeProject(project.id)}>
                Xóa
              </button>
            </div>
          </div>
        ))}
        {!projects.length && <p>Chưa có artwork nào.</p>}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <span>Trạm ảnh tạo bởi Đăng Hà</span>
    </footer>
  );
}
