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
    return;
  }
  
  const emojiMap = {
    LinkedIn: "💼",
    GitHub: "🐙",
    HackerRank: "🏆",
    LeetCode: "💻"
  };
  
  items.forEach((item) => {
    const link = document.createElement("a");
    link.href = item.url || "#";
    link.target = "_blank";
    link.rel = "noreferrer";
    const emoji = emojiMap[item.label] || "🔗";
    link.innerHTML = `<span class="social-emoji">${emoji}</span> ${item.label || "Link"}`;
    link.className = "social-link";
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
  renderSocials(byId("socialMenu"), profile.socialLinks);
};

const loadProfile = async () => {
  const emptyState = byId("emptyState");
  const inlineProfile = window.__PROFILE_DATA__;
  
  // If inline data exists and is not null, use it (fallback)
  if (inlineProfile && Object.keys(inlineProfile).length > 0) {
    renderProfile(inlineProfile, window.__PROFILE_SOURCE__ || "static");
    initAnimations();
    emptyState.hidden = true;
    return;
  }
  
  try {
    // Add timeout for API call
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const res = await fetch("/api/profile", {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'max-age=300' // 5 minutes cache
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    
    const data = await res.json();
    
    if (data.profile) {
      renderProfile(data.profile, data.source || "api");
      initAnimations();
      emptyState.hidden = true;
      
      // Cache the profile data
      window.__PROFILE_DATA__ = data.profile;
      window.__PROFILE_SOURCE__ = data.source;
    } else {
      throw new Error("No profile data received");
    }
  } catch (error) {
    console.error("Profile load error:", error);
    
    // Show error state
    document.querySelectorAll("[data-section]").forEach((section) => {
      section.style.display = "none";
    });
    
    emptyState.hidden = false;
    emptyState.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <h3>⚠️ Unable to Load Profile</h3>
        <p>Please check your connection and try again.</p>
        <button onclick="location.reload()" class="button" style="margin-top: 1rem;">
          🔄 Retry
        </button>
      </div>
    `;
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

const initDownloadResume = () => {
  const downloadBtn = byId("downloadResume");
  if (!downloadBtn) return;
  downloadBtn.addEventListener("click", async () => {
    try {
      const response = await fetch("./assets/resume.pdf");
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const blob = await response.blob();
      
      // Check if blob is empty or not a PDF
      if (blob.size === 0) throw new Error("Downloaded file is empty");
      if (!blob.type.includes("pdf") && !blob.type.includes("octet-stream")) {
        console.warn(`Unexpected mime type: ${blob.type}`);
      }
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Amrita_Ranjan_Resume.pdf";
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }, 100);
    } catch (error) {
      console.error("Download error:", error);
      alert("Unable to download resume. Please try again or contact support.");
    }
  });
};

const initSmoothScroll = () => {
  const navLinks = document.querySelectorAll(".site-nav a");
  if (!navLinks.length) return;
  
  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = link.getAttribute("href");
      const targetSection = document.querySelector(targetId);
      
      if (!targetSection) return;
      
      const headerHeight = document.querySelector(".site-header")?.offsetHeight || 0;
      const sectionTop = targetSection.getBoundingClientRect().top + window.scrollY;
      const scrollPosition = sectionTop - headerHeight;
      
      window.scrollTo({
        top: scrollPosition,
        behavior: "smooth"
      });
      
      targetSection.style.transition = "all 0.6s ease";
      targetSection.style.backgroundColor = "rgba(255, 107, 61, 0.03)";
      setTimeout(() => {
        targetSection.style.backgroundColor = "transparent";
      }, 1500);
    });
  });
};

const initSocialDropdown = () => {
  const dropdown = document.querySelector(".social-dropdown");
  const toggle = byId("socialToggle");
  if (!toggle || !dropdown) return;
  
  toggle.addEventListener("click", () => {
    dropdown.classList.toggle("open");
  });
  
  document.addEventListener("click", (event) => {
    if (!dropdown.contains(event.target)) {
      dropdown.classList.remove("open");
    }
  });
};

const initContactForm = () => {
  const form = byId("contactForm");
  const modal = byId("contactFormModal");
  const openBtn = byId("openContactForm");
  const closeBtn = byId("contactFormClose");

  if (!form || !modal || !openBtn || !closeBtn) return;

  // Open modal
  openBtn.addEventListener("click", () => {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  });

  // Close modal
  closeBtn.addEventListener("click", () => {
    closeContactModal();
  });

  // Close on overlay click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeContactModal();
    }
  });

  // Form submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = byId("contactName").value;
    const email = byId("contactEmail").value;
    const message = byId("contactMessage").value;

    if (!name || !email || !message) {
      alert("Please fill all fields");
      return;
    }

    try {
      const timestamp = new Date().toISOString();
      const response = {
        name,
        email,
        message,
        timestamp,
      };

      // Save to localStorage and assets folder
      await saveContactResponse(response);

      // Clear form
      form.reset();

      // Close modal
      closeContactModal();

      // Show thank you chip
      showThankYouChip();
    } catch (error) {
      console.error("Form submission error:", error);
      alert("Error submitting form. Please try again.");
    }
  });
};

const closeContactModal = () => {
  const modal = byId("contactFormModal");
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
};

const saveContactResponse = async (response) => {
  // Store in localStorage as backup
  const existing = JSON.parse(localStorage.getItem("contactResponses")) || [];
  existing.push(response);
  localStorage.setItem("contactResponses", JSON.stringify(existing));

  // Save to backend (assets/contacts.json)
  try {
    const res = await fetch("/api/save-contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(response),
    });

    if (res.ok) {
      const data = await res.json();
      console.log("✅ Contact saved to server:", data);
    } else {
      console.error("Server error:", res.status);
    }
  } catch (error) {
    console.log(
      "⚠️ Backend not available - using localStorage only. Start server with: npm start",
      error
    );
  }
};

const showThankYouChip = () => {
  const chip = document.createElement("div");
  chip.className = "thank-you-chip";
  chip.textContent = "✨ Thank you for your message! We'll get back soon.";

  document.body.appendChild(chip);

  setTimeout(() => {
    chip.classList.add("exit");
    setTimeout(() => {
      chip.remove();
    }, 500);
  }, 20000); // 20 seconds
};

const initDownloadContact = () => {
  const downloadBtn = byId("downloadContactBtn");
  if (!downloadBtn) return;
  
  let isDownloading = false;
  
  // Remove any existing event listeners by cloning the button
  const newBtn = downloadBtn.cloneNode(true);
  downloadBtn.parentNode.replaceChild(newBtn, downloadBtn);
  
  newBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isDownloading) {
      console.log('Download already in progress...');
      return;
    }
    
    isDownloading = true;
    newBtn.disabled = true;
    newBtn.textContent = '⬇️ Downloading...';
    
    try {
      // Get profile data from the inline data or current page
      const profile = window.__PROFILE_DATA__ || {};
      
      // Create vCard content
      const vcardContent = `BEGIN:VCARD
VERSION:3.0
FN:${profile.name || 'Harsh Kumar'}
N:${profile.name?.split(' ').reverse().join(';') || 'Kumar;Harsh;;'}
EMAIL:${profile.email || 'harshkumargoluku2001@gmail.com'}
TEL:${profile.phone || '+91-7547000491'}
ADR:;;${profile.location || 'Pune, India'};;;;
ORG:${profile.role || 'Software Engineer x Gen AI'}
TITLE:${profile.role || 'Software Engineer x Gen AI'}
URL:${profile.website || 'https://harshkumar-personalfolio.netlify.app/'}
NOTE:${profile.tagline || 'Entry-level Software Dev with a Data-driven mindset and hands-on ML experience.'}
END:VCARD`;

      // Create blob and download
      const blob = new Blob([vcardContent], { type: 'text/vcard;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${profile.name?.replace(/\s+/g, '_') || 'Harsh_Kumar'}.vcf`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
        isDownloading = false;
        newBtn.disabled = false;
        newBtn.textContent = '⬇️ Download Contact';
      }, 100);
      
      console.log('✅ vCard downloaded successfully');
    } catch (error) {
      console.error('Error downloading vCard:', error);
      alert('Unable to download contact card. Please try again.');
      isDownloading = false;
      newBtn.disabled = false;
      newBtn.textContent = '⬇️ Download Contact';
    }
  });
};

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
  // Initialize all components
  initMenu();
  initDownloadResume();
  initDownloadContact();
  initSmoothScroll();
  initSocialDropdown();
  initContactForm();
  initHighlightsModal();
  loadProfile();
});
