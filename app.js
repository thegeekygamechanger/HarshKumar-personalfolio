const byId = (id) => document.getElementById(id);

const setText = (id, value) => {
  const el = byId(id);
  if (!el) return;
  if (!value) {
    el.textContent = "";
    return;
  }
  el.textContent = value;
};

const setLink = (id, value) => {
  const el = byId(id);
  if (!el) return;
  if (!value) {
    el.textContent = "";
    el.removeAttribute("href");
    return;
  }
  el.textContent = value;
  el.href = value;
};

const renderList = (container, items, className) => {
  container.innerHTML = "";
  if (!items || items.length === 0) {
    container.innerHTML = "<p class=\"muted\">No details available.</p>";
    return;
  }
  items.forEach((item) => {
    const li = document.createElement("li");
    if (className) li.className = className;
    li.textContent = item;
    container.appendChild(li);
  });
};

const renderHighlights = (items = []) => {
  const list = byId("highlightsList");
  const moreButton = byId("highlightsMore");
  if (!list || !moreButton) return;

  list.innerHTML = "";
  if (!items || items.length === 0) {
    list.innerHTML = "<li class=\"muted\">No highlights available.</li>";
    moreButton.hidden = true;
    return;
  }

  const preview = items.slice(0, 3);
  preview.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  });

  moreButton.hidden = items.length <= 3;

  const modalList = byId("highlightsModalList");
  if (!modalList) return;
  modalList.innerHTML = "";
  items.slice(3).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    modalList.appendChild(li);
  });
};

const initHighlightsModal = () => {
  const modal = byId("highlightsModal");
  const openButton = byId("highlightsMore");
  const closeButton = byId("highlightsModalClose");
  const canvas = byId("highlightsCanvas");
  if (!modal || !openButton || !closeButton || !canvas) return;

  let animationFrame;

  const resizeCanvas = () => {
    const rect = canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;
  };

  const draw = () => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const time = Date.now() * 0.0006;
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "rgba(255, 107, 61, 0.16)");
    gradient.addColorStop(1, "rgba(255, 210, 196, 0.08)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const blobs = 5;
    for (let i = 0; i < blobs; i += 1) {
      const radius = (height * 0.18) * (0.6 + 0.4 * Math.sin(time + i));
      const x = width * (0.2 + i * 0.15 + 0.1 * Math.sin(time + i));
      const y = height * (0.25 + i * 0.12 + 0.1 * Math.cos(time + i));
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 107, 61, ${0.12 + i * 0.02})`;
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    animationFrame = requestAnimationFrame(draw);
  };

  const open = () => {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    resizeCanvas();
    draw();
  };

  const close = () => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (animationFrame) cancelAnimationFrame(animationFrame);
  };

  openButton.addEventListener("click", open);
  closeButton.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  window.addEventListener("resize", () => {
    if (modal.classList.contains("is-open")) {
      resizeCanvas();
    }
  });
};

const renderStats = (container, stats) => {
  container.innerHTML = "";
  if (!stats || stats.length === 0) {
    container.innerHTML = "<p class=\"muted\">Add stats in data/profile.json.</p>";
    return;
  }
  stats.forEach((stat) => {
    const wrap = document.createElement("div");
    wrap.className = "stat";
    wrap.innerHTML = `<span>${stat.value || ""}</span><small>${stat.label || ""}</small>`;
    container.appendChild(wrap);
  });
};

const renderProjects = (container, projects) => {
  container.innerHTML = "";
  if (!projects || projects.length === 0) {
    container.innerHTML = "<p class=\"muted\">Add projects in data/profile.json.</p>";
    return;
  }
  projects.forEach((project) => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <h3>${project.name || ""}</h3>
      <p>${project.description || ""}</p>
      <strong>${project.impact || ""}</strong>
      ${project.link ? `<a href="${project.link}" target="_blank" rel="noreferrer">View project</a>` : ""}
    `;
    container.appendChild(card);
  });
};

const renderExperience = (container, items) => {
  container.innerHTML = "";
  if (!items || items.length === 0) {
    container.innerHTML = "<p class=\"muted\">Add experience in data/profile.json.</p>";
    return;
  }
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "timeline-item";
    card.innerHTML = `
      <h3>${item.role || ""}</h3>
      <span>${item.company || ""} • ${item.period || ""}</span>
      <p>${item.summary || ""}</p>
    `;
    container.appendChild(card);
  });
};

const renderEducation = (container, items) => {
  container.innerHTML = "";
  if (!items || items.length === 0) {
    container.innerHTML = "<p class=\"muted\">Add education in data/profile.json.</p>";
    return;
  }
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "education-card";
    card.innerHTML = `
      <h3>${item.program || ""}</h3>
      <span>${item.school || ""} • ${item.period || ""}</span>
    `;
    container.appendChild(card);
  });
};

const renderSkills = (container, items) => {
  container.innerHTML = "";
  if (!items || items.length === 0) {
    container.innerHTML = "<p class=\"muted\">Add skills in data/profile.json.</p>";
    return;
  }
  items.forEach((item) => {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = item;
    container.appendChild(pill);
  });
};

const renderServices = (container, items) => {
  container.innerHTML = "";
  if (!items || items.length === 0) {
    container.innerHTML = "<p class=\"muted\">Add services in data/profile.json.</p>";
    return;
  }
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "service-card";
    card.textContent = item;
    container.appendChild(card);
  });
};

const renderSocials = (container, items) => {
  container.innerHTML = "";
  if (!items || items.length === 0) {
    container.innerHTML = "<p class=\"muted\">Add social links in data/profile.json.</p>";
    return;
  }
  items.forEach((item) => {
    const link = document.createElement("a");
    link.href = item.url || "#";
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = item.label || "Link";
    container.appendChild(link);
  });
};

const initAnimations = () => {
  const targets = document.querySelectorAll("[data-animate]");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      });
    },
    { threshold: 0.2 }
  );

  targets.forEach((target) => observer.observe(target));
};

const renderProfile = (profile, source = "manual") => {
  if (!profile) {
    throw new Error("profile not found");
  }

  setText("profileName", profile.name);
  setText("profileRole", profile.role);
  setText("profileLocation", profile.location);
  setText("profileTagline", profile.tagline);
  setText("profileSummary", profile.summary);
  setText("profilePhone", profile.phone);
  setLink("profileWebsite", profile.website);

  const email = byId("profileEmail");
  if (profile.email) {
    email.textContent = profile.email;
    email.href = `mailto:${profile.email}`;
  }

  const profilePhoto = byId("profilePhoto");
  if (profile.profilePhoto) {
    profilePhoto.src = profile.profilePhoto;
    profilePhoto.alt = `${profile.name} profile photo`;
  }

  const sourceBadge = byId("sourceBadge");
  if (sourceBadge) {
    const label = source === "static" ? "Static snapshot" : "Manual data";
    sourceBadge.textContent = label;
  }

  renderStats(byId("stats"), profile.stats);
  renderHighlights(profile.highlights || []);
  renderProjects(byId("projectsGrid"), profile.projects);
  renderExperience(byId("experienceTimeline"), profile.experience);
  renderSkills(byId("skillsList"), profile.skills);
  renderServices(byId("servicesList"), profile.services);
  renderEducation(byId("educationList"), profile.education);
  renderSocials(byId("socialLinks"), profile.socialLinks);
};

const loadProfile = async () => {
  const emptyState = byId("emptyState");
  const inlineProfile = window.__PROFILE_DATA__;
  if (inlineProfile && Object.keys(inlineProfile).length > 0) {
    renderProfile(inlineProfile, window.__PROFILE_SOURCE__ || "static");
    initAnimations();
    emptyState.hidden = true;
    return;
  }
  try {
    const res = await fetch("/api/profile");
    if (!res.ok) throw new Error("profile not found");
    const data = await res.json();
    renderProfile(data.profile || {}, data.source || "manual");

    initAnimations();
    emptyState.hidden = true;
  } catch (error) {
    document.querySelectorAll("[data-section]").forEach((section) => {
      section.style.display = "none";
    });
    emptyState.hidden = false;
  }
};

const initMenu = () => {
  const toggle = document.querySelector(".mobile-toggle");
  const nav = document.querySelector(".site-nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    nav.classList.toggle("open");
  });
};

initMenu();
initHighlightsModal();
loadProfile();
