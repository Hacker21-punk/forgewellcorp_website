import os
import re
import urllib.parse
from bs4 import BeautifulSoup

SOLUTIONS_CONFIG = [
    {
        "source": "quantum-and-physics.html",
        "title": "Quantum & Physics",
        "primary_file": "quantum-and-physics.html",
        "aliases": ["quantum-&-physics.html", "quantum-physics.html"]
    },
    {
        "source": "tactical-and-surveillance-solutions.html",
        "title": "Tactical & Surveillance Solutions",
        "primary_file": "tactical-and-surveillance-solutions.html",
        "aliases": ["tactical-&-surveillance-solutions.html", "tactical-surveillance-solutions.html"]
    },
    {
        "source": "test-and-measurement-solutions.html",
        "title": "Test & Measurement Solutions",
        "primary_file": "test-and-measurement-solutions.html",
        "aliases": ["test-&-measurement-solutions.html", "test-measurement-solutions.html"]
    },
    {
        "source": "machine-vision-and-monitoring-solutions.html",
        "title": "Machine Vision & Monitoring Solutions",
        "primary_file": "machine-vision-and-monitoring-solutions.html",
        "aliases": ["machine-vision-&-monitoring-solutions.html", "machine-vision-monitoring-solutions.html"]
    },
    {
        "source": "automation-and-access-control-systems.html",
        "title": "Automation & Access Control Systems",
        "primary_file": "automation-and-access-control-systems.html",
        "aliases": ["automation-&-access-control-systems.html", "automation-access-control-systems.html"]
    },
    {
        "source": "aerial-survey.html",
        "title": "Aerial Survey",
        "primary_file": "aerial-survey.html",
        "aliases": ["aerial-surveys.html"]
    },
    {
        "source": "bim-and-3d-lidar-scanning.html",
        "title": "BIM & 3D Lidar Scanning",
        "primary_file": "bim-and-3d-lidar-scanning.html",
        "aliases": ["bim-&-3d-lidar-scanning.html", "bim-3d-lidar-scanning.html"]
    },
    {
        "source": "it-solutions.html",
        "title": "IT Solutions",
        "primary_file": "it-solutions.html",
        "aliases": []
    }
]

CUSTOM_CSS = """
<style id="custom-solutions-css">
  /* 2-Column Dropdown Menu */
  nav ul li.solutions-nav-item {
    position: relative;
  }
  nav ul li.solutions-nav-item > ul.solutions-dropdown-menu {
    position: absolute !important;
    top: 104% !important;
    left: -240px !important;
    width: 634px !important;
    max-width: 90vw !important;
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    background: #ffffff !important;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12) !important;
    border: 1px solid #e5e7eb !important;
    opacity: 0 !important;
    visibility: hidden !important;
    transform: translateY(10px);
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
    z-index: 9999 !important;
    padding: 0 !important;
    margin: 0 !important;
    list-style: none !important;
    border-radius: 4px;
    text-align: left !important;
  }
  nav ul li.solutions-nav-item:hover > ul.solutions-dropdown-menu,
  nav ul li.solutions-nav-item:focus-within > ul.solutions-dropdown-menu {
    opacity: 1 !important;
    visibility: visible !important;
    transform: translateY(0) !important;
  }
  nav ul li.solutions-nav-item > ul.solutions-dropdown-menu > li {
    width: 100% !important;
    padding: 12px 18px !important;
    border-bottom: 1px solid #f3f3f3 !important;
    background: #ffffff !important;
    transition: background-color 0.2s ease;
    box-sizing: border-box !important;
  }
  nav ul li.solutions-nav-item > ul.solutions-dropdown-menu > li:hover {
    background-color: #f9fafb !important;
  }
  nav ul li.solutions-nav-item > ul.solutions-dropdown-menu > li > a {
    color: #1f2937 !important;
    font-size: 14px !important;
    font-weight: 500 !important;
    display: block !important;
    text-align: left !important;
    transition: color 0.2s ease !important;
    padding: 0 !important;
    background: transparent !important;
  }
  nav ul li.solutions-nav-item > ul.solutions-dropdown-menu > li > a:hover {
    color: #00d690 !important;
  }

  /* Solutions Link Active State in Header */
  nav ul li.solutions-nav-item > a.solutions-main-link {
    color: #00d690 !important;
    font-weight: 600 !important;
  }

  /* Product Submenu */
  nav ul li.product-nav-item {
    position: relative;
  }
  nav ul li.product-nav-item > ul.product-dropdown-menu {
    position: absolute !important;
    top: 104% !important;
    left: 0 !important;
    width: 220px !important;
    background: #ffffff !important;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12) !important;
    border: 1px solid #e5e7eb !important;
    opacity: 0 !important;
    visibility: hidden !important;
    transform: translateY(10px);
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
    z-index: 9999 !important;
    padding: 0 !important;
    margin: 0 !important;
    list-style: none !important;
    border-radius: 4px;
    text-align: left !important;
  }
  nav ul li.product-nav-item:hover > ul.product-dropdown-menu,
  nav ul li.product-nav-item:focus-within > ul.product-dropdown-menu {
    opacity: 1 !important;
    visibility: visible !important;
    transform: translateY(0) !important;
  }
  nav ul li.product-nav-item > ul.product-dropdown-menu > li {
    padding: 10px 18px !important;
    border-bottom: 1px solid #f3f3f3 !important;
  }
  nav ul li.product-nav-item > ul.product-dropdown-menu > li > a {
    color: #1f2937 !important;
    font-size: 14px !important;
    font-weight: 500 !important;
    display: block !important;
    text-align: left !important;
  }
  nav ul li.product-nav-item > ul.product-dropdown-menu > li > a:hover {
    color: #00d690 !important;
  }

  /* MUI Accordion Styling */
  .MuiAccordion-root {
    border: 1px solid #e5e7eb !important;
    border-radius: 8px !important;
    margin-bottom: 12px !important;
    background: #ffffff !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04) !important;
    overflow: hidden !important;
    transition: border-color 0.2s ease !important;
  }
  .MuiAccordion-root:hover {
    border-color: #00d690 !important;
  }
  .MuiAccordionSummary-root {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    padding: 16px 20px !important;
    cursor: pointer !important;
    user-select: none !important;
    font-weight: 600 !important;
    font-size: 16px !important;
    color: #1f2937 !important;
    transition: all 0.2s ease !important;
  }
  .MuiAccordionSummary-root:hover {
    color: #00d690 !important;
  }
  .MuiAccordionSummary-root::after {
    content: "+" !important;
    font-size: 20px !important;
    font-weight: 400 !important;
    color: #00d690 !important;
    margin-left: 12px !important;
    transition: transform 0.2s ease !important;
  }
  .MuiAccordionSummary-root.active-summary::after {
    content: "−" !important;
  }
  .MuiCollapse-root {
    display: none;
    padding: 0 20px 20px 20px !important;
    font-size: 15px !important;
    line-height: 1.7 !important;
    color: #4b5563 !important;
  }
  .MuiCollapse-root.show-collapse {
    display: block !important;
    animation: fadeInAccordion 0.25s ease !important;
  }
  @keyframes fadeInAccordion {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Destination Carousel Layout */
  .destination-carousel .slick-track {
    display: flex !important;
    gap: 20px !important;
    flex-wrap: wrap !important;
    width: 100% !important;
    transform: none !important;
  }
  .destination-carousel .slick-slide {
    width: calc(33.333% - 14px) !important;
    min-width: 280px !important;
    float: none !important;
  }
  .destination-carousel .slick-slide.slick-cloned {
    display: none !important;
  }
  .destination-carousel .destination-item {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 15px;
    background: #fff;
    text-align: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  }
  .destination-carousel .destination-img img {
    width: 100% !important;
    height: 200px !important;
    object-fit: contain !important;
    display: block !important;
  }
  .destination-carousel .destination-content h5 a {
    color: #1f2937 !important;
    font-weight: 600 !important;
    font-size: 16px !important;
    margin-top: 10px;
    display: inline-block;
  }
  .destination-carousel .destination-content h5 a:hover {
    color: #00d690 !important;
  }

  /* Back to top smooth floating button */
  .header-menu ul.smothscroll {
    position: fixed;
    bottom: 30px;
    right: 30px;
    z-index: 9999;
  }
  .header-menu ul.smothscroll li a {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: #00d690;
    color: #ffffff;
    border-radius: 50%;
    box-shadow: 0 4px 14px rgba(0, 214, 144, 0.4);
    transition: transform 0.2s ease, background 0.2s ease;
  }
  .header-menu ul.smothscroll li a:hover {
    transform: translateY(-3px);
    background: #00b67a;
  }

  /* Theme Toggle Button */
  .theme-toggle-btn {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 40px !important;
    height: 40px !important;
    border-radius: 8px !important;
    border: 1px solid rgba(0, 0, 0, 0.12) !important;
    background: #f8fafc !important;
    color: #0f172a !important;
    cursor: pointer !important;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
    vertical-align: middle !important;
    margin-right: 10px !important;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05) !important;
  }
  .theme-toggle-btn:hover {
    background: #f1f5f9 !important;
    border-color: #00d690 !important;
    color: #00d690 !important;
    transform: translateY(-1px) !important;
  }
  .theme-toggle-btn svg {
    width: 20px !important;
    height: 20px !important;
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
  }
  .theme-toggle-btn:hover svg {
    transform: rotate(18deg) !important;
  }

  /* Theme Icon Toggling */
  :root:not([data-theme="dark"]) .theme-toggle-btn .sun-icon,
  [data-theme="light"] .theme-toggle-btn .sun-icon {
    display: none !important;
  }
  :root:not([data-theme="dark"]) .theme-toggle-btn .moon-icon,
  [data-theme="light"] .theme-toggle-btn .moon-icon {
    display: block !important;
  }
  [data-theme="dark"] .theme-toggle-btn .sun-icon {
    display: block !important;
  }
  [data-theme="dark"] .theme-toggle-btn .moon-icon {
    display: none !important;
  }

  /* Dark mode theme styles for solutions pages */
  [data-theme="dark"] body {
    background-color: #08080c !important;
    color: #d4d0c8 !important;
  }
  [data-theme="dark"] .middle-header,
  [data-theme="dark"] .header-style-3 {
    background-color: #0f0f16 !important;
    border-color: rgba(255, 255, 255, 0.08) !important;
  }
  [data-theme="dark"] nav ul li a {
    color: #d4d0c8 !important;
  }
  [data-theme="dark"] .theme-toggle-btn {
    background: rgba(255, 255, 255, 0.06) !important;
    border-color: rgba(255, 255, 255, 0.15) !important;
    color: #f0ece0 !important;
  }
  [data-theme="dark"] .theme-toggle-btn:hover {
    border-color: #00d690 !important;
    color: #00d690 !important;
    background: rgba(0, 214, 144, 0.12) !important;
  }
  [data-theme="dark"] nav ul li.solutions-nav-item > ul.solutions-dropdown-menu,
  [data-theme="dark"] nav ul li.product-nav-item > ul.product-dropdown-menu {
    background: #15151e !important;
    border-color: rgba(255, 255, 255, 0.1) !important;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5) !important;
  }
  [data-theme="dark"] nav ul li.solutions-nav-item > ul.solutions-dropdown-menu > li,
  [data-theme="dark"] nav ul li.product-nav-item > ul.product-dropdown-menu > li {
    background: #15151e !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
  }
  [data-theme="dark"] nav ul li.solutions-nav-item > ul.solutions-dropdown-menu > li:hover,
  [data-theme="dark"] nav ul li.product-nav-item > ul.product-dropdown-menu > li:hover {
    background: #1c1c27 !important;
  }
  [data-theme="dark"] nav ul li.solutions-nav-item > ul.solutions-dropdown-menu > li > a,
  [data-theme="dark"] nav ul li.product-nav-item > ul.product-dropdown-menu > li > a {
    color: #e2e8f0 !important;
  }
  [data-theme="dark"] nav ul li.solutions-nav-item > ul.solutions-dropdown-menu > li > a:hover,
  [data-theme="dark"] nav ul li.product-nav-item > ul.product-dropdown-menu > li > a:hover {
    color: #00d690 !important;
  }
  [data-theme="dark"] .MuiAccordion-root {
    background: #15151e !important;
    border-color: rgba(255, 255, 255, 0.1) !important;
  }
  [data-theme="dark"] .MuiAccordionSummary-root {
    color: #f0ece0 !important;
  }
  [data-theme="dark"] .MuiCollapse-root {
    color: #94a3b8 !important;
  }
  [data-theme="dark"] .wpo-solutions-content-des h1,
  [data-theme="dark"] .wpo-solutions-content-des h2 {
    color: #f0ece0 !important;
  }
  [data-theme="dark"] .wpo-solutions-content-des p,
  [data-theme="dark"] .wpo-solutions-content-des li {
    color: #94a3b8 !important;
  }
  [data-theme="dark"] .room-details-item {
    background: #15151e !important;
    border-color: rgba(255, 255, 255, 0.08) !important;
  }
  [data-theme="dark"] .wpo-benefits-section h2 {
    color: #f0ece0 !important;
  }
  [data-theme="dark"] .logo img {
    filter: brightness(0) invert(1) opacity(0.92) !important;
  }
  :root:not([data-theme="dark"]) .logo img,
  [data-theme="light"] .logo img {
    filter: brightness(0) opacity(0.92) !important;
  }

  /* Mobile responsiveness */
  @media (max-width: 991px) {
    nav ul li.solutions-nav-item > ul.solutions-dropdown-menu {
      position: static !important;
      width: 100% !important;
      display: block !important;
      opacity: 1 !important;
      visibility: visible !important;
      box-shadow: none !important;
      border: none !important;
      transform: none !important;
    }
    .destination-carousel .slick-slide {
      width: 100% !important;
    }
  }
</style>
"""

CUSTOM_JS = """
<script id="custom-solutions-js">
  document.addEventListener('DOMContentLoaded', function() {
    // FAQ Accordion Toggle
    const summaries = document.querySelectorAll('.MuiAccordionSummary-root');
    summaries.forEach(function(summary) {
      summary.addEventListener('click', function() {
        const collapse = this.nextElementSibling;
        const isCurrentlyActive = this.classList.contains('active-summary');
        
        // Close siblings within the benefits section
        const parent = this.closest('.wpo-benefits-item');
        if (parent) {
          parent.querySelectorAll('.MuiAccordionSummary-root').forEach(function(s) {
            s.classList.remove('active-summary');
          });
          parent.querySelectorAll('.MuiCollapse-root').forEach(function(c) {
            c.classList.remove('show-collapse');
          });
        }

        if (!isCurrentlyActive && collapse) {
          this.classList.add('active-summary');
          collapse.classList.add('show-collapse');
        }
      });
    });

    // Smooth back to top
    const backToTop = document.querySelector('.smothscroll a');
    if (backToTop) {
      backToTop.addEventListener('click', function(e) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // Mobile menu toggle
    const menuToggle = document.querySelector('.showmenu');
    const mobileMenu = document.querySelector('.mobileMenu');
    const menuClose = document.querySelector('.menu-close');
    if (menuToggle && mobileMenu) {
      menuToggle.addEventListener('click', function() {
        mobileMenu.classList.add('show');
      });
    }
    if (menuClose && mobileMenu) {
      menuClose.addEventListener('click', function() {
        mobileMenu.classList.remove('show');
      });
    }
  });
</script>
"""

def process_file(source_path, title):
    with open(source_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "html.parser")

    # Remove existing custom CSS/JS/theme elements to prevent duplication
    for old_css in soup.find_all("style", id="custom-solutions-css"):
        old_css.decompose()
    for old_js in soup.find_all("script", id="custom-solutions-js"):
        old_js.decompose()
    for old_btn in soup.find_all(id="themeToggleBtn"):
        old_btn.decompose()
    for old_m_btn in soup.find_all(class_="mobile-theme-btn"):
        parent_li = old_m_btn.find_parent("li")
        if parent_li: parent_li.decompose()
        else: old_m_btn.decompose()
    for old_scr in soup.find_all("script", src="/theme.js"):
        old_scr.decompose()

    # Title
    if soup.title:
        soup.title.string = f"{title} - Forgewell Corporation"
    else:
        t = soup.new_tag("title")
        t.string = f"{title} - Forgewell Corporation"
        soup.head.append(t)

    # CSS link
    has_css = False
    for link in soup.find_all("link", rel="stylesheet"):
        href = link.get("href", "")
        if "1ede6a71eafd663f.css" in href:
            link["href"] = "/_next/static/css/1ede6a71eafd663f.css"
            has_css = True
    if not has_css:
        l = soup.new_tag("link", rel="stylesheet", href="/_next/static/css/1ede6a71eafd663f.css")
        soup.head.append(l)

    # Favicon
    fav = soup.find("link", rel=re.compile(r"icon", re.I))
    if not fav:
        ft = soup.new_tag("link", rel="icon", type="image/svg+xml", href="/assets/media/logo-2.svg")
        soup.head.append(ft)
    else:
        fav["href"] = "/assets/media/logo-2.svg"

    # Logo in header
    for div_logo in soup.find_all("div", class_="logo"):
        a_tag = div_logo.find("a")
        if a_tag: a_tag["href"] = "/"
        img = div_logo.find("img")
        if img:
            img["src"] = "/assets/media/logo-2.svg"
            img["alt"] = "Forgewell Corporation"
            img["style"] = "height: 50px; width: auto;"
            for attr in ["srcset", "sizes", "data-nimg"]:
                if attr in img.attrs: del img[attr]

    # Logo in footer
    footer = soup.find("footer", class_="wpo-site-footer")
    if footer:
        for img in footer.find_all("img"):
            src = img.get("src", "")
            if "logo_full" in src or "logo" in img.get("alt", "").lower():
                img["src"] = "/assets/media/logo-full.svg"
                img["alt"] = "Forgewell Corporation"
                img["style"] = "height: 48px; width: auto; max-width: 280px;"
                for attr in ["srcset", "sizes", "data-nimg"]:
                    if attr in img.attrs: del img[attr]

    # Unpack Next.js image optimizer URLs everywhere
    for img in soup.find_all("img"):
        src = img.get("src", "")
        if "/_next/image?url=" in src:
            parsed = urllib.parse.urlparse(src)
            params = urllib.parse.parse_qs(parsed.query)
            if "url" in params:
                real_url = params["url"][0]
                img["src"] = real_url
        for attr in ["srcset", "sizes", "data-nimg"]:
            if attr in img.attrs: del img[attr]
        if "color: transparent" in img.get("style", ""):
            new_style = img["style"].replace("color: transparent;", "").strip()
            if new_style: img["style"] = new_style
            else: del img["style"]

    # Fix Navigation Menu
    nav = soup.find("nav")
    if nav:
        nav_html = """
        <ul>
          <li><a href="/" title="">Home</a></li>
          <li><a href="/#about" title="">About Us</a></li>
          <li class="has-menu solutions-nav-item">
            <a href="/solutions/it-solutions" class="solutions-main-link" title="">Solutions</a>
            <ul class="solutions-dropdown-menu">
              <li><a href="/solutions/quantum-&-physics">Quantum &amp; Physics</a></li>
              <li><a href="/solutions/tactical-&-surveillance-solutions">Tactical &amp; Surveillance Solutions</a></li>
              <li><a href="/solutions/test-&-measurement-solutions">Test &amp; Measurement Solutions</a></li>
              <li><a href="/solutions/machine-vision-&-monitoring-solutions">Machine Vision &amp; Monitoring Solutions</a></li>
              <li><a href="/solutions/automation-&-access-control-systems">Automation &amp; Access Control Systems</a></li>
              <li><a href="/solutions/aerial-survey">Aerial Survey</a></li>
              <li><a href="/solutions/bim-&-3d-lidar-scanning">BIM &amp; 3D Lidar Scanning</a></li>
              <li><a href="/solutions/it-solutions">IT Solutions</a></li>
            </ul>
          </li>
          <li class="has-menu product-nav-item">
            <a href="/#trueprogress" title="">Product</a>
            <ul class="product-dropdown-menu">
              <li><a href="/login">TrueProgress</a></li>
              <li><a href="/#trueprogress">Dashboard Builder</a></li>
              <li><a href="/#trueprogress">Pico Tech</a></li>
              <li><a href="/#trueprogress">Tabor Electronics</a></li>
            </ul>
          </li>
          <li><a href="/#blog" title="">Blog</a></li>
          <li><a href="/#contact" title="">Contact</a></li>
        </ul>
        """
        nav_soup = BeautifulSoup(nav_html, "html.parser")
        nav.clear()
        nav.append(nav_soup)

    # Theme support & Header TrueProgress button
    if soup.html:
        soup.html["data-theme"] = "light"
    if soup.head:
        theme_script = soup.new_tag("script", src="/theme.js")
        soup.head.append(theme_script)

    toggle_html = """<button class="theme-toggle-btn" id="themeToggleBtn" type="button" aria-label="Switch to Dark Mode" title="Switch to Dark Mode"><svg class="sun-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg><svg class="moon-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg></button>"""
    for btn in soup.find_all("a", class_="theme-btn-s2"):
        if "TrueProgress" in btn.text:
            btn["href"] = "/login"
            btn.insert_before(BeautifulSoup(toggle_html, "html.parser"))
            break

    # Mobile menu appearance toggle
    mobile_menu = soup.find("div", class_="mobileMenu")
    if mobile_menu:
        ul_resp = mobile_menu.find("ul", class_="responsivemenu")
        if ul_resp:
            mobile_toggle_html = """<li style="display:flex; justify-content:space-between; align-items:center; padding:12px 20px; border-bottom:1px solid rgba(0,0,0,0.08);"><span style="font-weight:600; font-size:15px;">Appearance</span><button class="theme-toggle-btn mobile-theme-btn" type="button" aria-label="Toggle theme" style="margin:0;"><svg class="sun-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg><svg class="moon-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg></button></li>"""
            ul_resp.insert(0, BeautifulSoup(mobile_toggle_html, "html.parser"))

    # Footer links
    if footer:
        for a in footer.find_all("a"):
            t = a.text.strip().lower()
            href = a.get("href", "")
            if "trueprogress" in t:
                a["href"] = "/login"
            elif "quantum" in t:
                a["href"] = "/solutions/quantum-&-physics"
            elif "tactical" in t:
                a["href"] = "/solutions/tactical-&-surveillance-solutions"
            elif "test &" in t or "test & measurement" in t:
                a["href"] = "/solutions/test-&-measurement-solutions"
            elif "machine vision" in t:
                a["href"] = "/solutions/machine-vision-&-monitoring-solutions"
            elif "automation" in t:
                a["href"] = "/solutions/automation-&-access-control-systems"
            elif "aerial" in t:
                a["href"] = "/solutions/aerial-survey"
            elif "bim" in t:
                a["href"] = "/solutions/bim-&-3d-lidar-scanning"
            elif "it solutions" in t or "website development" in t or "graphic design" in t or "digital marketing" in t:
                a["href"] = "/solutions/it-solutions"
            elif href.startswith("/"):
                if href in ["/about", "/contact"]:
                    a["href"] = f"/#{href[1:]}"

    # Remove Next.js script tags & clutter
    for s in soup.find_all("script"):
        src = s.get("src", "")
        s_id = s.get("id", "")
        if "/_next/static/" in src or s_id in ["__NEXT_DATA__", "__NEXT_P"] or "__NEXT" in s.text:
            s.decompose()

    for r in soup.find_all("next-route-announcer"):
        r.decompose()

    # Append custom CSS & JS
    css_soup = BeautifulSoup(CUSTOM_CSS, "html.parser")
    soup.head.append(css_soup)

    js_soup = BeautifulSoup(CUSTOM_JS, "html.parser")
    soup.body.append(js_soup)

    return str(soup)

def main():
    out_dir = "solutions"
    os.makedirs(out_dir, exist_ok=True)
    
    for cfg in SOLUTIONS_CONFIG:
        source_path = os.path.join("live_solutions_rendered", cfg["source"])
        if not os.path.exists(source_path):
            source_path = os.path.join(out_dir, cfg["primary_file"])
        if not os.path.exists(source_path):
            print(f"ERROR: {source_path} does not exist!")
            continue
        
        print(f"Processing {cfg['title']} from {source_path}...")
        cleaned_html = process_file(source_path, cfg["title"])
        
        primary_path = os.path.join(out_dir, cfg["primary_file"])
        with open(primary_path, "w", encoding="utf-8") as f:
            f.write(cleaned_html)
        print(f"  -> Wrote {primary_path}")
        
        for alias in cfg["aliases"]:
            alias_path = os.path.join(out_dir, alias)
            with open(alias_path, "w", encoding="utf-8") as f:
                f.write(cleaned_html)
            print(f"  -> Wrote alias {alias_path}")

    # Also create solutions/index.html that redirects or shows solutions
    # Matching forgewellcorp.com/solutions
    solutions_index_path = os.path.join(out_dir, "index.html")
    # For index.html, we can use it-solutions.html or a dedicated solutions overview
    it_path = os.path.join(out_dir, "it-solutions.html")
    if os.path.exists(it_path):
        with open(it_path, "r", encoding="utf-8") as f:
            content = f.read()
        with open(solutions_index_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"  -> Wrote {solutions_index_path}")

if __name__ == "__main__":
    main()
